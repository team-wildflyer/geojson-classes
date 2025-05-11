

import { memoized } from 'ytil'

import { BBox } from './BBox'
import { Feature } from './Feature'
import { SupportedGeometry } from './types'

export class FeatureCollection<G extends SupportedGeometry, P extends GeoJSON.GeoJsonProperties = any> {

  constructor(
    public readonly features: Feature<G, P>[],
  ) {}

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

  public get bbox() {
    return BBox.around(this.features.map(it => it.geometry))
  }

  @memoized
  public get geoJSON(): GeoJSON.FeatureCollection<G, P> {
    return {
      type: 'FeatureCollection',
      features: this.features.map(it => it.geoJSON),
    }
  }

  public [Symbol.iterator]() {
    return this.features[Symbol.iterator]()
  }

}

export type FeatureCollectionWithProps<P extends GeoJSON.GeoJsonProperties> = FeatureCollection<SupportedGeometry, P>