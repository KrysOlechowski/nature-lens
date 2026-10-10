export interface SpeciesDetail {
  id: string;
  scientificName: string;
  displayName: string;
  taxonomy: {
    rank?: string;
  };
}
