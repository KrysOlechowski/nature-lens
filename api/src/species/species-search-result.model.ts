export interface NormalizedSpecies {
  scientificName: string;
  commonName?: string;
  displayName: string;
  taxonomy: {
    rank: string;
  };
  source: {
    provider: string;
    externalId: string;
  };
}

export interface SpeciesSearchResult extends NormalizedSpecies {
  id: string;
}
