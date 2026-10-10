import type { SpeciesDetail } from "./species-detail.model.js";

class SpeciesDetailTaxonomyDto {
  readonly rank?: string;

  constructor(rank?: string) {
    if (rank !== undefined) {
      this.rank = rank;
    }
  }
}

export class SpeciesDetailDto {
  readonly id: string;
  readonly scientificName: string;
  readonly displayName: string;
  readonly taxonomy: SpeciesDetailTaxonomyDto;

  constructor(species: SpeciesDetail) {
    this.id = species.id;
    this.scientificName = species.scientificName;
    this.displayName = species.displayName;
    this.taxonomy = new SpeciesDetailTaxonomyDto(species.taxonomy.rank);
  }
}
