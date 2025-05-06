import * as turf from '@turf/turf'
import { Point, Polygon } from 'geojson'
import { Geometry } from 'geojson-classes'
import { arrayEquals, memoized } from 'ytil'
import { FlatBBox } from './types'

/**
 * Utility wrapper for GeoJSON BBox.
 * 
 * Note: this BBox is always 2d, meaning that any elevation values are ignored.
 */
export class BBox {

  constructor(bbox: GeoJSON.BBox) {
    this.bbox = ensureBBox2D(bbox)

    // Latitudes must be strictly increasing.
    if (this.lat1 > this.lat2) {
      throw new Error("Invalid bbox: lat1 > lat2")
    }
    if (this.lat1 < -90) {
      throw new Error("Invalid bbox: lat1 < -90")
    }
    if (this.lat1 > 90) {
      throw new Error("Invalid bbox: lat1 > 90")
    }

    // Longitudes do not have to, but they must be between -180 and 180.
    if (this.lon1 < -180) {
      throw new Error("Invalid bbox: lon1 < -180")
    }
    if (this.lon1 > 180) {
      throw new Error("Invalid bbox: lon1 > 180")
    }
    if (this.lon2 < -180) {
      throw new Error("Invalid bbox: lon2 < -180")
    }
    if (this.lon2 > 180) {
      throw new Error("Invalid bbox: lon2 > 180")
    }
  }

  public static from(input: BBoxLike) {
    if (input instanceof BBox) {
      return new BBox([...input.bbox])
    } else {
      return new BBox(input)
    }
  }

  public readonly bbox: [number, number, number, number]

  public static world(latExtent: number = 85.0511287798066) {
    return new BBox([-180, -latExtent, 180, latExtent])
  }

  public static zero() {
    return new BBox([0, 0, 0, 0])
  }

  public static fromVectorTile(z: number, x: number, y: number) {
    const raw = tileToBBOX(x, y, z) as GeoJSON.BBox
    return new BBox(raw)
  }

  public static around(...geometries: Array<Geometry | GeoJSON.Geometry>) {
    const features = geometries.map(g => turf.feature(g instanceof Geometry ? g.geometry : g))
    const collection = turf.featureCollection(features)
    const bbox = turf.bbox(collection)
    return new BBox(bbox)
  }

  // #region Derived

  public get lon1() { return this.bbox[0] }
  public get lat1() { return this.bbox[1] }
  public get lon2() { return this.bbox[2] }
  public get lat2() { return this.bbox[3] }

  public get lonspan() {
    if (this.inverted) {
      return 360 - Math.abs(this.lon1 - this.lon2)
    } else {
      return this.lon2 - this.lon1
    }
  }
  public get latspan() {
    return this.bbox[3] - this.bbox[1]
  }

  public get southWest(): Geometry<Point> {
    return Geometry.point(this.lon1, this.lat1)
  }

  public get northWest(): Geometry<Point> {
    return Geometry.point(this.lon1, this.lat2)
  }

  public get southEast(): Geometry<Point> {
    return Geometry.point(this.lon2, this.lat1)
  }

  public get northEast(): Geometry<Point> {
    return Geometry.point(this.lon2, this.lat2)
  }

  /**
   * Returns true if the bbox is inverted (and therefore wraps around the date line). Note that even though the world
   * bbox "wraps around the dateline", it is not considered inverted.
   */
  public get inverted() {
    return this.lon1 > this.lon2
  }

  /**
   * Returns true if the bbox wraps around the date line. This includes the world bbox, and any bbox that includes the
   * date line.
   */
  public get wrapsAround() {
    return this.inverted || this.lon1 === -180 || this.lon2 === 180
  }

  public get global() {
    if (this.bbox[0] > -180) { return false }
    if (this.bbox[2] < 180) { return false }
    if (this.bbox[1] > -90) { return false }
    if (this.bbox[3] < 90) { return false }

    return true    
  }

  @memoized
  public get center(): Geometry<Point> {
    const lon = this.inverted ? (this.bbox[0] + this.bbox[2] + 360) / 2 : (this.bbox[0] + this.bbox[2]) / 2
    const lat = (this.bbox[1] + this.bbox[3]) / 2
    return Geometry.point(lon, lat)
  }

  @memoized
  public get polygon(): Geometry<Polygon> {
    return new Geometry(turf.bboxPolygon(this.bbox).geometry)
  }

  // #endregion

  // #region Testers

  public equals(other: BBox) {
    return arrayEquals(this.bbox, other.bbox)
  }

  public contains(point: Geometry<Point>) {
    const [lon, lat] = point.coordinates
    if (lat < this.lat1 || lat > this.lat2) { return false }

    if (this.inverted) {
      if (lon > this.lon2 && lon < this.lon1) { return false }
    } else {
      if (lon < this.lon1 || lon > this.lon2) { return false }
    }
    return true
  }

  public overlaps(other: BBox) {
    if (this.lat1 > other.lat2) { return false }
    if (this.lat2 < other.lat1) { return false }

    const baseRanges = denormalizeLonRange([this.lon1, this.lon2])
    const otherRanges = denormalizeLonRange([other.lon1, other.lon2])
    return baseRanges.some(base => otherRanges.some(other => {
      if (base[0] > other[1]) { return false }
      if (base[1] < other[0]) { return false }
      return true      
    }))
  }

  // #endregion 

  // #region Operations

  /**
   * Creates an intersection between this bbox and the given bbox, taking into consideration that bboxes may
   * wrap around the date line.
   * 
   * @param other
   *   The other BBox to intersect with.
   * @returns
   *   A set of disjoint BBoxes that form the intersection. Due to the fact that bboxes may wrap around the
   *   date line, the bboxes may actually intersect on both sides of the base, resulting in two disjoint
   *   bboxes.
   */
  public intersect(other: BBox): BBox[] {
    const lat1 = Math.max(this.lat1, other.lat1)
    const lat2 = Math.min(this.lat2, other.lat2)
    if (lat1 > lat2) { return [] }

    const baseRanges = denormalizeLonRange([this.lon1, this.lon2])
    const otherRanges = denormalizeLonRange([other.lon1, other.lon2])

    const intersect = (left: [number, number], right: [number, number]): Array<[number, number]> => {
      const lon1 = Math.max(left[0], right[0])
      const lon2 = Math.min(left[1], right[1])
      if (lon1 > lon2) { return [] }

      return [[lon1, lon2]]
    }

    const intersections: Array<[number, number]> = []
    for (const baseRange of baseRanges) {
      for (const otherRange of otherRanges) {
        const intersection = intersect(baseRange, otherRange)
        intersections.push(...intersection)
      }
    }

    const normalized = intersections.map(normalizeLonRange)

    // If we intersect two wrapping bboxes, this will leed to duplicates. Remove them.
    const deduped = normalized.reduce<Array<[number, number]>>((deduped, range) => {
      if (deduped.some(r => arrayEquals(r, range))) { return deduped }
      return [...deduped, range]
    }, [])
    return deduped.map(([lon1, lon2]) => new BBox([lon1, lat1, lon2, lat2]))
  }

  // #endregion

  // #region Conversions

  public toArray() {
    return [...this.bbox]
  }

  public toString(decimals: number = 2) {
    const lon1 = this.lon1.toFixed(decimals)
    const lat1 = this.lat1.toFixed(decimals)
    const lon2 = this.lon2.toFixed(decimals)
    const lat2 = this.lat2.toFixed(decimals)


    return `[(${lon1},${lat1}) ↗︎ (${lon2},${lat2})]`
  }

  public [Symbol.toPrimitive](hint: 'string' | 'number') {
    if (hint === 'string') {
      return this.toString()
    } else {
      return NaN
    }
  }

  // #endregion

}

export type BBoxLike = BBox | GeoJSON.BBox

export function ensureBBox2D(bbox: GeoJSON.BBox): FlatBBox {
  if (bbox.length === 4) {
    return bbox
  } else {
    return [bbox[0], bbox[1], bbox[3], bbox[4]]
  }
}

/**
 * Takes an input range. If this input range is not inverted, and stays within [-180, 180), it is returned as is.
 * In any other case, it duplicates the range such that it appears in the western hemisphere and in the eastern
 * hemisphere.
 * 
 * Examples:
 * 
 * ```typescript
 * normalizeLonRange([-180, 180])  // => [[-180, 180]]
 * normalizeLonRange([-160, 160])  // => [[-160, 160]]
 * normalizeLonRange([180, -180])  // => [[-180, -180], [180, 180]]
 * normalizeLonRange([160, -160])  // => [[-200, -160], [160, 200]]
 * normalizeLonRange([160, 180])   // => [[160, 180], [-200, -180]]
 * normalizeRonRange([-180, -160]) // => [[-180, -160], [180, 200]]
 * ```
 */
function denormalizeLonRange(range: [number, number]): Array<[number, number]> {
  const [lon1, lon2] = range

  if (lon1 === -180 && lon2 === 180) { return [[lon1, lon2]] }
  
  if (lon1 === -180) {
    return [[180, 180], [lon1 + 360, lon2 + 360]]
  }

  if (lon2 === 180) {
    return [[lon1 - 180, lon2 - 180], [lon1, lon2]]
  }

  if (lon1 <= lon2) {
    return [[lon1, lon2]]
  } else {
    return [[lon1 - 360, lon2], [lon1, lon2 + 360]]
  }
}

/**
 * Normalizes a range such that both coordinates are always in [-180, 180].
 */
function normalizeLonRange(range: [number, number]): [number, number] {
  let [lon1, lon2] = range
  while (lon1 < -180) { lon1 += 360 }
  while (lon2 < -180) { lon2 += 360 }
  while (lon1 > 180) { lon1 -= 360 }
  while (lon2 > 180) { lon2 -= 360 }

  return [lon1, lon2]
}


function tileToBBOX(x: number, y: number, z: number): [number, number, number, number] {
  const n = Math.pow(2, z)
  
  const lonLeft = x / n * 360 - 180
  const lonRight = (x + 1) / n * 360 - 180
  
  const latTop = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * (180 / Math.PI)
  const latBottom = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * (180 / Math.PI)

  return [lonLeft, latBottom, lonRight, latTop] // [west, south, east, north]
}