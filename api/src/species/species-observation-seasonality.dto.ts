import type {
  ObservationSeasonalityMonth,
  ObservationSeasonalityYear,
  SpeciesObservationSeasonality,
} from "./species-observation-seasonality.model.js";

class SpeciesObservationSeasonalityMetadataDto {
  readonly datasetScope: "locally-synchronized";

  constructor(metadata: SpeciesObservationSeasonality["metadata"]) {
    this.datasetScope = metadata.datasetScope;
  }
}

export class SpeciesObservationSeasonalityDto {
  readonly months: ObservationSeasonalityMonth[];
  readonly years: ObservationSeasonalityYear[];
  readonly undatedCount: number;
  readonly metadata: SpeciesObservationSeasonalityMetadataDto;

  constructor(seasonality: SpeciesObservationSeasonality) {
    this.months = seasonality.months;
    this.years = seasonality.years;
    this.undatedCount = seasonality.undatedCount;
    this.metadata = new SpeciesObservationSeasonalityMetadataDto(
      seasonality.metadata,
    );
  }
}
