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

export interface SpeciesObservationPage {
  totalResults: number;
  page: number;
  perPage: number;
  results: SpeciesObservation[];
}
