import { Injectable, NotFoundException } from "@nestjs/common";
import {
  INaturalistAdapter,
  type INaturalistObservationPageRequest,
} from "../inaturalist/inaturalist.adapter.js";
import { mapINaturalistObservation } from "./inaturalist-observation.mapper.js";
import { ObservationRepository } from "./observation.repository.js";
import type { SpeciesObservationPage } from "./species-observation.model.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";
import { SpeciesRepository } from "./species.repository.js";

@Injectable()
export class SpeciesService {
  constructor(
    private readonly iNaturalistAdapter: INaturalistAdapter,
    private readonly speciesRepository: SpeciesRepository,
    private readonly observationRepository: ObservationRepository,
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
    speciesId: string,
    pagination: INaturalistObservationPageRequest,
  ): Promise<SpeciesObservationPage> {
    const externalTaxonId = await this.speciesRepository.findProviderExternalId(
      speciesId,
      "iNaturalist",
    );

    if (!externalTaxonId) {
      throw new NotFoundException("Species was not found");
    }

    const taxonId = Number(externalTaxonId);

    if (!Number.isSafeInteger(taxonId) || taxonId < 1) {
      throw new Error("Persisted iNaturalist taxon identifier is invalid");
    }

    const providerPage = await this.iNaturalistAdapter.getObservations(
      taxonId,
      pagination,
    );

    const observations = providerPage.results.map(mapINaturalistObservation);

    await this.observationRepository.upsertMany(speciesId, observations);

    return {
      totalResults: providerPage.totalResults,
      page: providerPage.page,
      perPage: providerPage.perPage,
      results: observations,
    };
  }
}
