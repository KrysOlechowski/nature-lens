import type {
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
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
    source: {
      provider: string;
      url: string;
    };
  };
}
