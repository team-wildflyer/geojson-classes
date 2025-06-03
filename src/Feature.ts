import { memoized } from 'ytil'
import { BBox } from './BBox'
import { Geometry } from './Geometry'
import { MultiPolygon, Polygon, SupportedGeometry } from './types'

export class Feature<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any> {

  constructor(
    public readonly geometry: Geometry<G>,
    public readonly properties: P,
    public readonly id?: string | number,
  ) {}

  public static from<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties>(feature: Feature<G, P> | GeoJSON.Feature<G, P>): Feature<G, P> {
    if (feature instanceof Feature) {
      return feature
    }
    
    return new Feature(
      Geometry.from(feature.geometry),
      feature.properties,
      feature.id,
    )
  }

  public get type() {
    return this.geometry.type
  }

  public get coordinates() {
    return this.geometry.coordinates  
  }

  public isPoint(): this is Feature<GeoJSON.Point, P> {
    return this.geometry.isPoint()
  }

  public isPolygon(): this is Feature<GeoJSON.Polygon, P> {
    return this.geometry.isPolygon()
  }

  public isMultiPolygon(): this is Feature<GeoJSON.MultiPolygon, P> {
    return this.geometry.isMultiPolygon()
  }

  public intersect(this: Feature<Polygon | MultiPolygon>, geometry: Geometry<Polygon | MultiPolygon>) {
    const clipped = this.geometry.intersect(geometry)
    if (clipped === null) { return null }

    return new Feature(clipped, this.properties, this.id)
  }

  public cloneWithGeometry<GG extends SupportedGeometry>(geometry: Geometry<GG>): Feature<GG, P> {
    return new Feature(
      geometry,
      this.properties,
      this.id,
    )
  }

  public cloneWithProperties<PP extends GeoJSON.GeoJsonProperties>(properties: PP): Feature<G, PP> {
    return new Feature(
      this.geometry,
      properties,
      this.id,
    )
  }

  public cloneWithId(id: string | number): Feature<G, P> {
    return new Feature(
      this.geometry,
      this.properties,
      id,
    )
  }

  @memoized
  public get geojson(): GeoJSON.Feature<G, P> {
    return {
      type:       'Feature',
      geometry:   this.geometry.geojson,
      properties: this.properties,
      id:         this.id,
    } 
  }

}

export interface FeatureOptions {
  bbox?: BBox | GeoJSON.BBox
  id?:   string | number  
}

export type FeatureWithProps<P extends GeoJSON.GeoJsonProperties> = Feature<SupportedGeometry, P>
