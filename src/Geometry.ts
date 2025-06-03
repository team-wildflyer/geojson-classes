import * as turf from '@turf/turf'
import { MultiPolygon, Point, Polygon } from 'geojson'
import { isArray } from 'lodash'
import * as wkx from 'wkx'
import { arrayEquals, memoized } from 'ytil'

import { BBox } from './BBox'
import { Feature } from './Feature'
import { coordinate, Coordinate, Coordinate2D, coordinates, Ring, SupportedGeometry } from './types'

export class Geometry<G extends SupportedGeometry = SupportedGeometry, Flat extends boolean = boolean> {

  public constructor(
    public readonly type: G['type'],
    public readonly coordinates: coordinates<G, Flat>
  ) {
    if (!supportedGeometryTypes.includes(type)) {
      throw new Error(`Unsupported geometry type: ${type}`)
    }
  }

  // #region Factory

  public static from<G extends SupportedGeometry, Flat extends boolean = boolean>(input: Geometry<G, Flat> | G | Buffer): Geometry<G, Flat> {
    if (input instanceof Geometry) {
      return input
    } else if (input instanceof Buffer) {
      const geojson = wkx.Geometry.parse(input).toGeoJSON() as G
      if (!supportedGeometryTypes.includes(geojson.type)) {
        throw new Error(`Unsupported geometry type: ${geojson.type}`)
      }
      return new Geometry(geojson.type, geojson.coordinates as coordinates<G, Flat>)
    } else {
      return new Geometry(input.type, input.coordinates as coordinates<G, Flat>)
    }
  }

  public static point(coordinate: number[]): Geometry<Point>
  public static point(lng: number, lat: number, elevation: number): Geometry<Point, false>
  public static point(lng: number, lat: number): Geometry<Point, true>
  public static point(lng: number, lat: number, elevation?: number): Geometry<Point, boolean>
  public static point(...args: any[]): Geometry<Point> {
    if (args.length === 1 && isArray(args[0]) && args[0].length < 2) {
      throw new Error('Invalid coordinates')
    }

    if (args.length === 1) {
      const [lng, lat, elevation] = args[0]
      return new Geometry('Point', elevation == null ? [lng, lat] : [lng, lat, elevation])
    } else {
      const [lng, lat, elevation] = args
      return new Geometry('Point', elevation == null ? [lng, lat] : [lng, lat, elevation])
    }
  }

  public static polygon(coordinates: Ring[]) {
    return new Geometry<Polygon>('Polygon', coordinates)
  }

  public static multiPolygon(coordinates: Ring[][]) {
    return new Geometry<MultiPolygon>('MultiPolygon', coordinates)
  }

  // #endregion

  // #region Static methods

  public static isGeometry<G extends SupportedGeometry>(input: any, type?: G['type']): input is Geometry<G> {
    if (!(input instanceof Geometry)) { return false }
    if (type != null && input.type !== type) { return false }
    return true
  }

  // #endregion

  // #region Properties
  
  private _center: Geometry<Point> | undefined
  public center(): Geometry<Point> {
    return this._center ??= Geometry.from(turf.center(this.geojson).geometry)
  }
  
  private _centroid: Geometry<Point> | undefined
  public centroid(): Geometry<Point> {
    return this._centroid ??= Geometry.from(turf.centroid(this.geojson).geometry)
  }
  
  private _bbox: BBox | undefined
  public bbox(): BBox {
    return this._bbox ??= BBox.around(this)
  }
  
  // #endregion

  // #region Testers

  public isPoint(): this is Geometry<GeoJSON.Point, Flat> {
    return this.type === 'Point'
  }

  public isPolygon(): this is Geometry<GeoJSON.Polygon, Flat> {
    return this.type === 'Polygon'
  }

  public isMultiPolygon(): this is Geometry<GeoJSON.MultiPolygon, Flat> {
    return this.type === 'MultiPolygon'
  }

  // #endregion

  // #region Coordinates

  public get allCoordinates(): Array<Flat extends true ? Coordinate2D : Coordinate> {
    return Array.from(this.eachCoordinate())
  }

  private *eachCoordinate(): Generator<Flat extends true ? Coordinate2D : Coordinate> {
    switch (this.type) {
    case 'Point':
      yield (this as Geometry<Point>).coordinates as Flat extends true ? Coordinate2D : Coordinate
      break
    case 'Polygon':
      for (const ring of (this as Geometry<Polygon>).coordinates) {
        for (const coordinate of ring) {
          yield coordinate as Flat extends true ? Coordinate2D : Coordinate
        }
      }
      break
    case 'MultiPolygon':
      for (const polygon of (this as Geometry<MultiPolygon>).coordinates) {
        for (const ring of polygon) {
          for (const coordinate of ring) {
            yield coordinate as Flat extends true ? Coordinate2D : Coordinate
          }
        }
      }
      break
    }
  }

  public isFlat(): this is Geometry<G, true> {
    const isFlat = this.allCoordinates[0].length === 2
    return isFlat as Flat extends true ? true : boolean
  }

  public flat(): Geometry<G, true> {
    if (this.isFlat()) {
      return this as Geometry<G, true>
    } else {
      return this.map(coordinate => coordinate.slice(0, 2), false) as Geometry<G, true>
    }
  }

  public elevated(): Geometry<G, false> {
    if (this.isFlat()) {
      return this.map(coordinate => [...coordinate, 0]) as Geometry<G, false>
    } else {
      return this as Geometry<G, false>
    }
  }

  // #endregion

  @memoized
  public get geojson(): G {
    return {
      type:        this.type,
      coordinates: this.coordinates as G['coordinates'],
    } as G
  }

  @memoized
  public get wkb() {
    const wkxGeometry = wkx.Geometry.parseGeoJSON(this.geojson)
    return wkxGeometry.toWkb()
  }

  public feature<P extends GeoJSON.GeoJsonProperties>(properties: P, options: {id?: turf.helpers.Id} = {}): Feature<G, P> {
    return new Feature(this, properties, options.id)
  }

  public toMultiPolygon<Flat extends boolean>(this: Geometry<Polygon, Flat>): Geometry<MultiPolygon, Flat> {
    return Geometry.multiPolygon([this.coordinates])
  }

  public get searchParam() {
    if (this.type === 'Point') {
      return `${this.center().coordinates[0]},${this.center().coordinates[1]}`
    } else {
      return this.allCoordinates.map(([x, y]) => `${x},${y}`).join(';')
    }
  }

  public transpose(): Geometry {
    return this.map(coordinate => coordinate.length === 2
      ? [coordinate[1], coordinate[0]]
      : [coordinate[1], coordinate[0], coordinate[2]]
    )
  }

  public intersect(this: Geometry<Polygon | MultiPolygon>, geometry: Geometry<Polygon | MultiPolygon>): Geometry | null {
    const features = turf.featureCollection([
      turf.feature(this.geojson),
      turf.feature(geometry.geojson)
    ])
    
    const intersection = turf.intersect(features)
    if (intersection == null) { return null }

    return Geometry.from(intersection.geometry)
  }

  public map(fn: (coordinate: coordinate<Flat>) => number[], flatten: boolean = true): Geometry<G, Flat> {
    const flat = this.isFlat()
    const mapCoords = (prev: coordinate<Flat>): coordinate<Flat> => {
      const next = fn(prev)
      if (!flatten) { return next as coordinate<Flat> }
      if (flat) {
        return next.slice(0, 2) as coordinate<Flat>
      } else if (next.length >= 3) {
        return next.slice(0, 3) as coordinate<Flat>
      } else {
        return [...next, 0] as coordinate<Flat>
      }
    }

    if (this.isPoint()) {
      const prev = this.coordinates as coordinate<Flat>
      const next = mapCoords(prev) as coordinates<Point, Flat>
      return new Geometry<Point, Flat>('Point', next) as Geometry<G, Flat>
    } else if (this.isPolygon()) {
      const prev = this.coordinates as coordinate<Flat>[][]
      const next = prev.map(coords => coords.map(mapCoords)) as coordinate<Flat>[][]
      return new Geometry<Polygon, Flat>('Polygon', next as coordinates<Polygon, Flat>) as Geometry<G, Flat>
    } else if (this.isMultiPolygon()) {
      const prev = this.coordinates as coordinate<Flat>[][][]
      const next = prev.map(ring => ring.map(coords => coords.map(mapCoords))) as coordinate<Flat>[][][]
      return new Geometry<MultiPolygon, Flat>('MultiPolygon', next as coordinates<MultiPolygon, Flat>) as Geometry<G, Flat>
    } else {
      throw new Error(`Unsupported geometry type: ${this.type}`) // Will not happen.
    }
  }

  public equals(other: Geometry): boolean {
    if (this.type !== other.type) { return false }
    return arrayEquals(this.allCoordinates, other.allCoordinates)
  }

  public contains(this: Geometry<Polygon | MultiPolygon>, other: Geometry): boolean {
    return turf.booleanContains(this.geojson, other.geojson)
  }

  public within(other: Geometry<Polygon | MultiPolygon>): boolean {
    return turf.booleanWithin(this.geojson, other.geojson)
  }

  public intersects(this: Geometry<Polygon | MultiPolygon>, other: Geometry<Polygon | MultiPolygon>): boolean {
    return turf.booleanIntersects(this.geojson, other.geojson)
  }

}

const supportedGeometryTypes = [
  'Point',
  'Polygon',
  'MultiPolygon',
]