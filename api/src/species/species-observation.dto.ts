import type {
  ObservationPageFreshness,
  ObservationPageServedFrom,
  ObservationLocation,
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
  SpeciesObservation,
  SpeciesObservationPage,
} from "./species-observation.model.js";

class SpeciesObservationPageMetadataDto {
  readonly servedFrom: ObservationPageServedFrom;
  readonly freshness: ObservationPageFreshness;
  readonly lastSuccessfulSyncAt: string;

  constructor(metadata: SpeciesObservationPage["metadata"]) {
    this.servedFrom = metadata.servedFrom;
    this.freshness = metadata.freshness;
    this.lastSuccessfulSyncAt = metadata.lastSuccessfulSyncAt;
  }
}

class ObservationLocationDto {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number | null;
  readonly precision: ObservationLocationPrecision;

  constructor(location: ObservationLocation) {
    this.latitude = location.latitude;
    this.longitude = location.longitude;
    this.accuracyMeters = location.accuracyMeters;
    this.precision = location.precision;
  }
}

class ObservationSourceDto {
  readonly provider: string;
  readonly externalId: string;
  readonly url: string;

  constructor(source: SpeciesObservation["source"]) {
    this.provider = source.provider;
    this.externalId = source.externalId;
    this.url = source.url;
  }
}

class SpeciesObservationDto {
  readonly observedOn: string | null;
  readonly observedAt: string | null;
  readonly location: ObservationLocationDto | null;
  readonly locationPrivacy: ObservationLocationPrivacy;
  readonly source: ObservationSourceDto;

  constructor(observation: SpeciesObservation) {
    this.observedOn = observation.observedOn;
    this.observedAt = observation.observedAt;
    this.location = observation.location
      ? new ObservationLocationDto(observation.location)
      : null;
    this.locationPrivacy = observation.locationPrivacy;
    this.source = new ObservationSourceDto(observation.source);
  }
}

export class SpeciesObservationPageDto {
  readonly totalResults: number;
  readonly page: number;
  readonly perPage: number;
  readonly results: SpeciesObservationDto[];
  readonly metadata: SpeciesObservationPageMetadataDto;

  constructor(observationPage: SpeciesObservationPage) {
    this.totalResults = observationPage.totalResults;
    this.page = observationPage.page;
    this.perPage = observationPage.perPage;
    this.results = observationPage.results.map(
      (observation) => new SpeciesObservationDto(observation),
    );
    this.metadata = new SpeciesObservationPageMetadataDto(
      observationPage.metadata,
    );
  }
}
