import type {
  SpatialObservationFeature,
  SpatialObservationFeatureCollection,
  SpatialObservationSpeciesSummary,
} from "./spatial-observation.model.js";

class SpatialObservationMetadataDto {
  readonly datasetScope: "locally-synchronized";
  readonly returnedObservationCount: number;
  readonly totalObservationCount: number;
  readonly truncated: boolean;

  constructor(metadata: SpatialObservationFeatureCollection["metadata"]) {
    this.datasetScope = metadata.datasetScope;
    this.returnedObservationCount = metadata.returnedObservationCount;
    this.totalObservationCount = metadata.totalObservationCount;
    this.truncated = metadata.truncated;
  }
}

class SpatialObservationSpeciesListDto {
  readonly items: SpatialObservationSpeciesSummary[];
  readonly returnedCount: number;
  readonly totalCount: number;
  readonly truncated: boolean;

  constructor(species: SpatialObservationFeatureCollection["species"]) {
    this.items = species.items;
    this.returnedCount = species.returnedCount;
    this.totalCount = species.totalCount;
    this.truncated = species.truncated;
  }
}

export class SpatialObservationFeatureCollectionDto {
  readonly type = "FeatureCollection" as const;
  readonly features: SpatialObservationFeature[];
  readonly species: SpatialObservationSpeciesListDto;
  readonly metadata: SpatialObservationMetadataDto;

  constructor(collection: SpatialObservationFeatureCollection) {
    this.features = collection.features;
    this.species = new SpatialObservationSpeciesListDto(collection.species);
    this.metadata = new SpatialObservationMetadataDto(collection.metadata);
  }
}
