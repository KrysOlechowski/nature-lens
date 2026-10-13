import type {
  ProtectedAreaFeature,
  ProtectedAreaFeatureCollection,
} from "./protected-area.model.js";

class ProtectedAreaMetadataDto {
  readonly attribution: ProtectedAreaFeatureCollection["metadata"]["attribution"];
  readonly geometryPurpose: ProtectedAreaFeatureCollection["metadata"]["geometryPurpose"];
  readonly returnedAreaCount: number;
  readonly sourceUrl: ProtectedAreaFeatureCollection["metadata"]["sourceUrl"];
  readonly truncated: boolean;

  constructor(metadata: ProtectedAreaFeatureCollection["metadata"]) {
    this.attribution = metadata.attribution;
    this.geometryPurpose = metadata.geometryPurpose;
    this.returnedAreaCount = metadata.returnedAreaCount;
    this.sourceUrl = metadata.sourceUrl;
    this.truncated = metadata.truncated;
  }
}

export class ProtectedAreaFeatureCollectionDto {
  readonly type = "FeatureCollection" as const;
  readonly features: ProtectedAreaFeature[];
  readonly metadata: ProtectedAreaMetadataDto;

  constructor(collection: ProtectedAreaFeatureCollection) {
    this.features = collection.features;
    this.metadata = new ProtectedAreaMetadataDto(collection.metadata);
  }
}
