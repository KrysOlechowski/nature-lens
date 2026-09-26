export interface SpeciesSearchResult {
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
