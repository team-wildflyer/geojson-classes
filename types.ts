import { LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon } from 'geojson'

export type { MultiPolygon, Point, Polygon, MultiPoint, LineString, MultiLineString }

export interface SupportedGeoJSONTypeMap {
  Point: Point,
  MultiPoint: MultiPoint,
  LineString: LineString,
  Polygon: Polygon,
  MultiLineString: MultiLineString,
  MultiPolygon: MultiPolygon,
}
export type SupportedGeoJSONType = keyof SupportedGeoJSONTypeMap
export const SupportedGeoJSONTypes: SupportedGeoJSONType[] = [
  'Point',
  'MultiPoint',
  'LineString',
  'Polygon',
  'MultiLineString',
  'MultiPolygon',
]

export function isSupportedGeoJSONType(type: string): type is SupportedGeoJSONType {
  return SupportedGeoJSONTypes.includes(type as SupportedGeoJSONType)
}

export type SupportedGeometry = Point | MultiPoint | LineString | Polygon | MultiLineString | MultiPolygon

export type Coordinate = Coordinate2D | Coordinate3D
export type Coordinate2D = [number, number]
export type Coordinate3D = [number, number, number]

export type Ring = Ring2D | Ring3D
export type Ring2D = Coordinate2D[]
export type Ring3D = Coordinate3D[]

export interface TileCoordinates {
  z: number
  x: number
  y: number
}

export type coordinate<Flat extends boolean> = Flat extends true ? Coordinate2D : Coordinate3D

export type coordinates<G extends SupportedGeometry, Flat extends boolean> =
  Flat extends true
    ? ensureCoordinate2D<G['coordinates']>
    : ensureCoordinate<G['coordinates']>

export type ensureCoordinate<A extends number[] | number[][] | number[][][] | number[][][][]> =
  A extends number[] ? Coordinate :
    A extends number[][] ? Coordinate[] :
      A extends number[][][] ? Ring[] :
        A extends number[][][][] ? Ring[][] :
          never

export type ensureCoordinate2D<A extends number[] | number[][] | number[][][] | number[][][][]> =
  A extends number[] ? Coordinate2D :
    A extends number[][] ? Coordinate2D[] :
      A extends number[][][] ? Ring2D[] :
        A extends number[][][][] ? Ring2D[][] :
          never
