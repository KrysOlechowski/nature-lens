import { Injectable } from "@nestjs/common";
import {
  INaturalistAdapter,
  type INaturalistObservationPageRequest,
} from "../inaturalist/inaturalist.adapter.js";
import { mapINaturalistObservation } from "./inaturalist-observation.mapper.js";
import type { SpeciesObservationPage } from "./species-observation.model.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";
import { SpeciesRepository } from "./species.repository.js";

@Injectable()
export class SpeciesService {
  constructor(
    private readonly iNaturalistAdapter: INaturalistAdapter,
    private readonly speciesRepository: SpeciesRepository,
  ) {}

  async searchSpecies(query: string): Promise<SpeciesSearchResult[]> {
    const providerResults = await this.iNaturalistAdapter.searchSpecies(query);
    const normalizedSpecies = providerResults.map(mapINaturalistSpecies);

    return Promise.all(
      normalizedSpecies.map(async (species) => ({
        ...species,
        id: await this.speciesRepository.upsert(species),
      })),
    );
  }

  async getObservations(
    taxonId: number,
    pagination: INaturalistObservationPageRequest,
  ): Promise<SpeciesObservationPage> {
    const providerPage = await this.iNaturalistAdapter.getObservations(
      taxonId,
      pagination,
    );

    return {
      totalResults: providerPage.totalResults,
      page: providerPage.page,
      perPage: providerPage.perPage,
      results: providerPage.results.map(mapINaturalistObservation),
    };
  }
}
