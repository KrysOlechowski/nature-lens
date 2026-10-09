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

export interface SpeciesObservation {
  observedOn: string | null;
  observedAt: string | null;
  location: ObservationLocation | null;
  locationPrivacy: ObservationLocationPrivacy;
  source: {
    provider: string;
    externalId: string;
    url: string;
  };
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
