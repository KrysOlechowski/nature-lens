import type { SpeciesSearchResult } from "./species-search-result.model.js";

class SpeciesTaxonomyDto {
  readonly rank: string;

  constructor(rank: string) {
    this.rank = rank;
  }
}

class SpeciesSourceDto {
  readonly provider: string;
  readonly externalId: string;

  constructor(provider: string, externalId: string) {
    this.provider = provider;
    this.externalId = externalId;
  }
}

export class SpeciesSearchResultDto {
  readonly scientificName: string;
  readonly commonName?: string;
  readonly displayName: string;
  readonly taxonomy: SpeciesTaxonomyDto;
  readonly source: SpeciesSourceDto;

  constructor(result: SpeciesSearchResult) {
    this.scientificName = result.scientificName;
    if (result.commonName !== undefined) {
      this.commonName = result.commonName;
    }
    this.displayName = result.displayName;
    this.taxonomy = new SpeciesTaxonomyDto(result.taxonomy.rank);
    this.source = new SpeciesSourceDto(
      result.source.provider,
      result.source.externalId,
    );
  }
}
