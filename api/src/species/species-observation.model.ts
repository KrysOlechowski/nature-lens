export type ObservationLocationPrivacy =
  "open" | "obscured" | "private" | "unknown";

export type ObservationLocationPrecision =
  "approximate" | "limited" | "unknown";

export interface ObservationLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  precision: ObservationLocationPrecision;
}

export type ObservationLicense =
  | {
      code: string;
      url: string | null;
    }
  | {
      code: null;
      url: string;
    };

export interface ObservationDatasetPublisher {
  externalId: string | null;
  name: string | null;
}

export interface ObservationDataset {
  externalId: string | null;
  title: string | null;
  url: string | null;
  publisher: ObservationDatasetPublisher | null;
}

export type ObservationDeduplicationMethod =
  "provider-record-id" | "gbif-occurrence-id";

export interface ObservationDeduplicationIdentity {
  key: string;
  method: ObservationDeduplicationMethod;
}

export interface ObservationSource {
  provider: string;
  externalId: string;
  url: string;
  license: ObservationLicense | null;
  dataset: ObservationDataset | null;
}

export interface SpeciesObservation {
  observedOn: string | null;
  observedAt: string | null;
  location: ObservationLocation | null;
  locationPrivacy: ObservationLocationPrivacy;
  deduplication: ObservationDeduplicationIdentity;
  source: ObservationSource;
}

export interface GroupedSpeciesObservation {
  observedOn: string | null;
  observedAt: string | null;
  location: ObservationLocation | null;
  locationPrivacy: ObservationLocationPrivacy;
  sources: ObservationSource[];
}

export interface SpeciesObservationPageData {
  totalResults: number;
  page: number;
  perPage: number;
  results: SpeciesObservation[];
}

export interface StoredSpeciesObservationPage extends SpeciesObservationPageData {
  lastSuccessfulSyncAt: string;
}

export type ObservationPageServedFrom = "local-database" | "provider-sync";

export type ObservationPageFreshness = "fresh" | "stale";

export interface SpeciesObservationPage {
  totalResults: number;
  page: number;
  perPage: number;
  results: SpeciesObservation[];
  metadata: {
    servedFrom: ObservationPageServedFrom;
    freshness: ObservationPageFreshness;
    lastSuccessfulSyncAt: string;
  };
}
