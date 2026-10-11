export interface ObservationSeasonalityMonth {
  month: number;
  count: number;
}

export interface ObservationSeasonalityYear {
  year: number;
  count: number;
}

export interface SpeciesObservationSeasonality {
  months: ObservationSeasonalityMonth[];
  years: ObservationSeasonalityYear[];
  undatedCount: number;
  metadata: {
    datasetScope: "locally-synchronized";
  };
}
