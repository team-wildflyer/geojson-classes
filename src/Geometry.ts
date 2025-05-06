import * as turf from '@turf/turf'
import { MultiPolygon, Point, Polygon } from 'geojson'
import { isArray } from 'lodash'
import { isPlainObject, objectEquals } from 'ytil'

import { BBox } from './BBox'
import {
  Coordinate,
  Coordinate2D,
  coordinates,
  ensureCoordinate2D,
  Ring,
  SupportedGeometry,
} from './types'

export class Geometry<G extends SupportedGeometry = SupportedGeometry, Flat extends boolean = boolean> {

  public constructor(
    public readonly geometry: G
  ) {}

  // #region Factory

  public static from<G extends SupportedGeometry>(input: Geometry<G> | G): Geometry<G> {
    if (input instanceof Geometry) {
      return input
    } else {
      return new Geometry(input)
    }
  }

  public static point(point: Geometry<Point> | Point | Coordinate): Geometry<Point>
  public static point(lng: number, lat: number, elevation?: number): Geometry<Point>
  public static point(...args: any[]): Geometry<Point> {
    if (args.length === 1 && args[0] instanceof Geometry) {
      const [lng, lat, elevation] = args[0].geometry.coordinates
      return new Geometry(turf.point(elevation == null ? [lng, lat] : [lng, lat, elevation]).geometry)
    } else if (args.length === 1 && isPlainObject(args[0]) && args[0].type === 'Point') {
      return new Geometry(args[0] as unknown as Point)
    } else if (args.length === 1 && isArray(args[0])) {
      const [lng, lat, elevation] = args[0]
      return new Geometry(turf.point(elevation == null ? [lng, lat] : [lng, lat, elevation]).geometry)
    } else {
      const [lng, lat, elevation] = args
      return new Geometry(turf.point(elevation == null ? [lng, lat] : [lng, lat, elevation]).geometry)
    }
  }

  public static polygon(coordinates: Ring[]) {
    return new Geometry({
      type: 'Polygon',
      coordinates,
    })
  }

  public static multiPolygon(coordinates: Ring[][]) {
    return new Geometry({
      type: 'MultiPolygon',
      coordinates,
    })
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

  public get type(): G['type'] {
    return this.geometry.type
  }
  
  public get center(): Geometry<Point> {
    return Geometry.point(turf.center(this.geometry).geometry)
  }
  
  public get centroid(): Geometry<Point> {
    return Geometry.point(turf.centroid(this.geometry).geometry)
  }
  
  public get bbox(): BBox {
    return BBox.around(this)
  }
  
  // #endregion

  // #region Coordinates

  public get coordinates(): coordinates<G, Flat> {
    return this.geometry.coordinates as coordinates<G, Flat>
  }

  public get allCoordinates(): Array<Flat extends true ? Coordinate2D : Coordinate> {
    return Array.from(this.eachCoordinate())
  }

  private *eachCoordinate(): Generator<Flat extends true ? Coordinate2D : Coordinate> {
    switch (this.geometry.type) {
    case 'Point':
      yield (this as Geometry<Point>).geometry.coordinates as Flat extends true ? Coordinate2D : Coordinate
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

  public isFlat(): Flat extends true ? true : boolean {
    const isFlat = this.allCoordinates[0].length === 2
    return isFlat as Flat extends true ? true : boolean
  }

  public flat(): Geometry<G, true> {
    const coordinates2D = (() => {
      switch (this.geometry.type) {
      case 'Point':
        return (this as Geometry<Point>).coordinates.slice(0, 2) as ensureCoordinate2D<G['coordinates']>
      case 'Polygon':
        return (this as Geometry<Polygon>).coordinates.map(ring => ring.map(coordinate => coordinate.slice(0, 2))) as ensureCoordinate2D<G['coordinates']>
      case 'MultiPolygon':
        return (this as Geometry<MultiPolygon>).coordinates.map(polygon => polygon.map(ring => ring.map(coordinate => coordinate.slice(0, 2)))) as ensureCoordinate2D<G['coordinates']>
      }
    })()
  
    const geometry = {
      type:        this.type,
      coordinates: coordinates2D,
    } as SupportedGeometry as G
    return new Geometry(geometry) as Geometry<G, true>
  }

  // #endregion

  public feature<P extends GeoJSON.GeoJsonProperties>(properties: P, options: {id?: turf.helpers.Id, bbox?: boolean} = {}): GeoJSON.Feature<G, P> {
    return turf.feature(this.geometry, properties, {
      bbox: options.bbox ? this.bbox.bbox : undefined,
      id:   options.id,
    })
  }

  public toMultiPolygon(this: Geometry<Polygon>): Geometry<MultiPolygon> {
    return Geometry.multiPolygon([this.coordinates])
  }

  public get searchParam() {
    if (this.geometry.type === 'Point') {
      return `${this.center.coordinates[0]},${this.center.coordinates[1]}`
    } else {
      return turf.coordAll(this.geometry).map(([x, y]) => `${x},${y}`).join(';')
    }
  }

  public transpose(): Geometry {
    switch (this.geometry.type) {
    case 'Point':
      return new Geometry({
        type:        'Point',
        coordinates: [this.geometry.coordinates[1], this.geometry.coordinates[0], this.geometry.coordinates[2]],
      })
    case 'Polygon':
      return new Geometry({
        type:        'Polygon',
        coordinates: this.geometry.coordinates.map(ring => ring.map(([x, y, elevation]) => [y, x, elevation])),
      })
    case 'MultiPolygon':
      return new Geometry({
        type:        'MultiPolygon',
        coordinates: this.geometry.coordinates.map(polygon => polygon.map(ring => ring.map(([x, y, elevation]) => [y, x, elevation]))),
      })
    }
  }

  public equals(other: Geometry): boolean {
    return objectEquals(this.geometry, other.geometry)
  }

  public intersects(this: Geometry<Polygon | MultiPolygon>, other: Geometry<Polygon | MultiPolygon>): boolean {
    return turf.booleanIntersects(this.geometry, other.geometry)
  }

}