import { Injectable, NotFoundException } from "@nestjs/common";
import {
  INaturalistAdapter,
  type INaturalistObservationPageRequest,
} from "../inaturalist/inaturalist.adapter.js";
import { environment } from "../config/environment.js";
import { ProviderError } from "../provider-errors/provider.error.js";
import { mapINaturalistObservation } from "./inaturalist-observation.mapper.js";
import { ObservationRepository } from "./observation.repository.js";
import type {
  SpeciesObservationPage,
  StoredSpeciesObservationPage,
} from "./species-observation.model.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";
import { SpeciesRepository } from "./species.repository.js";

const INATURALIST_PROVIDER = "iNaturalist";

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
      INATURALIST_PROVIDER,
    );

    if (!externalTaxonId) {
      throw new NotFoundException("Species was not found");
    }

    const taxonId = Number(externalTaxonId);

    if (!Number.isSafeInteger(taxonId) || taxonId < 1) {
      throw new Error("Persisted iNaturalist taxon identifier is invalid");
    }

    const storedPage = await this.observationRepository.findPage(
      speciesId,
      INATURALIST_PROVIDER,
      pagination,
    );

    if (storedPage && isFresh(storedPage.lastSuccessfulSyncAt)) {
      return toObservationPage(storedPage, "local-database", "fresh");
    }

    let providerPage;

    try {
      providerPage = await this.iNaturalistAdapter.getObservations(
        taxonId,
        pagination,
      );
    } catch (error) {
      if (storedPage && error instanceof ProviderError) {
        return toObservationPage(storedPage, "local-database", "stale");
      }

      throw error;
    }

    const observations = providerPage.results.map(mapINaturalistObservation);

    await this.observationRepository.replacePage(
      speciesId,
      INATURALIST_PROVIDER,
      {
        totalResults: providerPage.totalResults,
        page: providerPage.page,
        perPage: providerPage.perPage,
        results: observations,
      },
    );

    const synchronizedPage = await this.observationRepository.findPage(
      speciesId,
      INATURALIST_PROVIDER,
      pagination,
    );

    if (!synchronizedPage) {
      throw new Error("Synchronized observation page could not be read");
    }

    return toObservationPage(synchronizedPage, "provider-sync", "fresh");
  }
}

function isFresh(lastSuccessfulSyncAt: string): boolean {
  const expiresAt =
    Date.parse(lastSuccessfulSyncAt) +
    environment.OBSERVATION_FRESHNESS_WINDOW_SECONDS * 1_000;

  return Date.now() < expiresAt;
}

function toObservationPage(
  page: StoredSpeciesObservationPage,
  servedFrom: "local-database" | "provider-sync",
  freshness: "fresh" | "stale",
): SpeciesObservationPage {
  return {
    totalResults: page.totalResults,
    page: page.page,
    perPage: page.perPage,
    results: page.results,
    metadata: {
      servedFrom,
      freshness,
      lastSuccessfulSyncAt: page.lastSuccessfulSyncAt,
    },
  };
}
