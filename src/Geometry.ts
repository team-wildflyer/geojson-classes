import * as turf from '@turf/turf'
import { MultiPolygon, Point, Polygon } from 'geojson'

import { BBox } from './BBox'

/**
 * Utility wrapper for (some) GeoJSON geometries.
 */
export class Geometry<R extends SupportedGeometry = SupportedGeometry> {

  private constructor(
    public readonly raw: R,
    private readonly flat: boolean,
  ) {}

  public static from<R extends SupportedGeometry>(raw: R, flat: boolean = true): Geometry<R> {
    if (flat) {
      return new Geometry(ensure2D(raw), true)
    } else {
      return new Geometry(raw, false)
    }
  }

  public static point(lng: number, lat: number) {
    return new Geometry({
      type:        'Point',
      coordinates: [lng, lat],
    }, true)
  }

  public static point3D(lng: number, lat: number, elevation: number) {
    return new Geometry({
      type:        'Point',
      coordinates: [lng, lat, elevation],
    }, false)
  }

  public static polygon(coordinates: Array<Array<[number, number]>>) {
    return new Geometry({
      type: 'Polygon',
      coordinates,
    }, true)
  }

  public static polygon3D(coordinates: Array<Array<[number, number, number]>>) {
    return new Geometry({
      type: 'Polygon',
      coordinates,
    }, false)
  }

  public static isGeometry(arg: unknown, type?: SupportedGeometry['type']): arg is Geometry {
    if (!(arg instanceof Geometry)) {
      return false
    }

    if (type !== undefined && arg.type !== type) {
      return false
    }

    return true
  }

  public get type() {
    return this.raw.type
  }

  public get coordinates(): R['coordinates'] {
    return this.raw.coordinates
  }

  public get center(): Point {
    return turf.center(this.raw).geometry
  }

  public get centroid(): Point {
    return turf.centroid(this.raw).geometry
  }

  public get bbox(): BBox {
    return new BBox(turf.bbox(this.raw))
  }

  public equals(other: Geometry<R> | R) {
    const ensureDimensionality = this.flat ? ensure2D : ensure3D
    if (other instanceof Geometry) {
      return turf.booleanEqual(this.raw, ensureDimensionality(other.raw))
    } else {
      return turf.booleanEqual(this.raw, ensureDimensionality(other))
    }
  }

}

export function ensure2D<G extends SupportedGeometry>(geometry: G): G {
  if (geometry.type === 'Point') {
    return {
      ...geometry,
      coordinates: [geometry.coordinates[0], geometry.coordinates[1]],
    }
  } else if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(ring => ring.map(point => [point[0], point[1]])),
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(point => [point[0], point[1]]))),
    }
  } else {
    return geometry
  }
}

export function ensure3D<G extends SupportedGeometry>(geometry: G): G {
  if (geometry.type === 'Point') {
    return {
      ...geometry,
      coordinates: [geometry.coordinates[0], geometry.coordinates[1], 0],
    }
  } else if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(ring => ring.map(point => [point[0], point[1], 0])),
    }
  } else if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(point => [point[0], point[1], 0]))),
    }
  } else {
    return geometry
  }
}

export type SupportedGeometry = Point | Polygon | MultiPolygon