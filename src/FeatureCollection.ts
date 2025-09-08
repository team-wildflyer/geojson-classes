



import { sparse } from 'ytil'

import { BBox } from './BBox'
import { Feature } from './Feature'
import { Geometry } from './Geometry'
import { MultiPolygon, Polygon, SupportedGeometry } from './types'

export class FeatureCollection<G extends SupportedGeometry = SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any> {

  constructor(
    public readonly features: Feature<G, P>[],
  ) {}

  public clone() {
    return new FeatureCollection<G, P>(this.features)
  }

  public static from<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any>(collection: FeatureCollection<G, P> | GeoJSON.FeatureCollection<G, P>) {
    if (collection instanceof FeatureCollection) {
      return collection
    }
    return new FeatureCollection(
      collection.features.map(it => Feature.from(it)),
    )
  }

  public static empty<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any>() {
    return new FeatureCollection<G, P>([])
  }

  public static of<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any>(features: Array<Feature<G, P> | GeoJSON.Feature<G, P>>) {
    return new FeatureCollection<G, P>(
      features.map(it => it instanceof Feature ? it : Feature.from<G, P>(it)),
    )
  }

  public get size() {
    return this.features.length
  }

  public [Symbol.iterator]() {
    return this.features[Symbol.iterator]()
  }

  public add(...features: Array<Feature<G, P> | GeoJSON.Feature<G, P>>) {
    this.features.push(...features.map(it => it instanceof Feature ? it : Feature.from(it)))
  }

  public addFrom(collection: FeatureCollection<G, P> | GeoJSON.FeatureCollection<G, P>) {
    if (collection instanceof FeatureCollection) {
      this.features.push(...collection.features)
    } else {
      this.features.push(...collection.features.map(it => Feature.from(it)))
    }
  }

  public removeAt(index: number) {
    if (index < 0 || index >= this.features.length) {
      throw new Error(`Index out of bounds: ${index}`)
    }
    this.features.splice(index, 1)
  }

  public clear() {
    this.features.splice(0)
  }

  public clip(geometry: Geometry<Polygon | MultiPolygon>) {
    const nextGeometries = this.features.map(feature => {
      if (feature.isPoint()) {
        return feature.geometry.within(geometry) ? feature : null
      } else if (feature.isPolygon() || feature.isMultiPolygon()) {
        return feature.intersect(geometry)
      } else {
        return null
      }
    })

    return FeatureCollection.of(sparse(nextGeometries))
  }

  public map<GG extends SupportedGeometry, PP extends GeoJSON.GeoJsonProperties>(fn: (feature: Feature<G, P>) => Feature<GG, PP>): FeatureCollection<GG, PP> {
    return new FeatureCollection<GG, PP>(
      this.features.map(fn)
    )
  }


  public mapGeometries<GG extends Geometry>(fn: (geometry: Geometry) => GG) {
    return this.map(it => it.cloneWithGeometry(fn(it.geometry)))
  }

  public mapProperties<PP extends GeoJSON.GeoJsonProperties>(fn: (properties: P) => PP) {
    return this.map(it => it.cloneWithProperties(fn(it.properties)))
  }

  public get bbox() {
    return BBox.around(this.features.map(it => it.geometry))
  }

  public get geojson(): GeoJSON.FeatureCollection<G, P> {
    return {
      type:     'FeatureCollection',
      features: this.features.map(it => it.geojson),
    }
  }

}

export type FeatureCollectionWithProps<P extends GeoJSON.GeoJsonProperties> = FeatureCollection<SupportedGeometry, P>