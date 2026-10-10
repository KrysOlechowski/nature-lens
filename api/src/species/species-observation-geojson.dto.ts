import type {
  SpeciesObservationGeoJsonFeature,
  SpeciesObservationGeoJsonFeatureCollection,
} from "./species-observation-geojson.model.js";

class SpeciesObservationGeoJsonMetadataDto {
  readonly datasetScope: "locally-synchronized";
  readonly truncated: boolean;

  constructor(
    metadata: SpeciesObservationGeoJsonFeatureCollection["metadata"],
  ) {
    this.datasetScope = metadata.datasetScope;
    this.truncated = metadata.truncated;
  }
}

export class SpeciesObservationGeoJsonDto {
  readonly type = "FeatureCollection" as const;
  readonly features: SpeciesObservationGeoJsonFeature[];
  readonly metadata: SpeciesObservationGeoJsonMetadataDto;

  constructor(collection: SpeciesObservationGeoJsonFeatureCollection) {
    this.features = collection.features;
    this.metadata = new SpeciesObservationGeoJsonMetadataDto(
      collection.metadata,
    );
  }
}
