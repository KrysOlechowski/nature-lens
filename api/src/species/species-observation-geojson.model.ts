import type {
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
  ObservationSource,
} from "./species-observation.model.js";

export interface SpeciesObservationGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: SpeciesObservationGeoJsonFeature[];
  metadata: {
    datasetScope: "locally-synchronized";
    truncated: boolean;
  };
}

export interface SpeciesObservationGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [longitude: number, latitude: number];
  };
  properties: {
    observedOn: string | null;
    observedAt: string | null;
    accuracyMeters: number | null;
    locationPrecision: ObservationLocationPrecision;
    locationPrivacy: ObservationLocationPrivacy;
    sources: ObservationSource[];
  };
}
