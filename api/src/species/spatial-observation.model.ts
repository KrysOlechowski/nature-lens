import type {
  GroupedSpeciesObservation,
  ObservationLocationPrecision,
  ObservationSource,
} from "./species-observation.model.js";

export interface SpatialObservationSpecies {
  id: string;
  scientificName: string;
  displayName: string;
}

export interface SpatialObservation extends GroupedSpeciesObservation {
  species: SpatialObservationSpecies;
}

export interface SpatialObservationSpeciesSummary extends SpatialObservationSpecies {
  observationCount: number;
}

export interface SpatialObservationFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [longitude: number, latitude: number];
  };
  properties: {
    species: SpatialObservationSpecies;
    observedOn: string | null;
    observedAt: string | null;
    accuracyMeters: number | null;
    locationPrecision: ObservationLocationPrecision;
    locationPrivacy: SpatialObservation["locationPrivacy"];
    sources: ObservationSource[];
  };
}

export interface SpatialObservationFeatureCollection {
  type: "FeatureCollection";
  features: SpatialObservationFeature[];
  species: {
    items: SpatialObservationSpeciesSummary[];
    returnedCount: number;
    totalCount: number;
    truncated: boolean;
  };
  metadata: {
    datasetScope: "locally-synchronized";
    returnedObservationCount: number;
    totalObservationCount: number;
    truncated: boolean;
  };
}
