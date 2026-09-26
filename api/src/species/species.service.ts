import { Injectable } from "@nestjs/common";
import { INaturalistAdapter } from "../inaturalist/inaturalist.adapter.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";

@Injectable()
export class SpeciesService {
  constructor(private readonly iNaturalistAdapter: INaturalistAdapter) {}

  async searchSpecies(query: string): Promise<SpeciesSearchResult[]> {
    const providerResults = await this.iNaturalistAdapter.searchSpecies(query);

    return providerResults.map(mapINaturalistSpecies);
  }
}
