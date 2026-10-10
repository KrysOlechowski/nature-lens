import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ObservationPageRequest } from "../biodiversity/biodiversity-provider.contract.js";
import {
  INATURALIST_OBSERVATION_PROVIDER,
  INATURALIST_SPECIES_SEARCH_PROVIDER,
  type INaturalistObservationProvider,
  type INaturalistSpeciesSearchProvider,
} from "../inaturalist/inaturalist.tokens.js";
import { environment } from "../config/environment.js";
import { ProviderError } from "../provider-errors/provider.error.js";
import { mapINaturalistObservation } from "./inaturalist-observation.mapper.js";
import {
  ObservationRepository,
  type ObservationBoundingBox,
} from "./observation.repository.js";
import type { SpeciesDetail } from "./species-detail.model.js";
import type {
  SpeciesObservationGeoJsonFeature,
  SpeciesObservationGeoJsonFeatureCollection,
} from "./species-observation-geojson.model.js";
import type {
  SpeciesObservation,
  SpeciesObservationPage,
  StoredSpeciesObservationPage,
} from "./species-observation.model.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";
import { SpeciesRepository } from "./species.repository.js";

@Injectable()
export class SpeciesService {
  constructor(
    @Inject(INATURALIST_SPECIES_SEARCH_PROVIDER)
    private readonly speciesSearchProvider: INaturalistSpeciesSearchProvider,
    @Inject(INATURALIST_OBSERVATION_PROVIDER)
    private readonly observationProvider: INaturalistObservationProvider,
    private readonly speciesRepository: SpeciesRepository,
    private readonly observationRepository: ObservationRepository,
  ) {}

  async searchSpecies(query: string): Promise<SpeciesSearchResult[]> {
    const providerResults =
      await this.speciesSearchProvider.searchSpecies(query);
    const normalizedSpecies = providerResults.map(mapINaturalistSpecies);

    return Promise.all(
      normalizedSpecies.map(async (species) => ({
        ...species,
        id: await this.speciesRepository.upsert(species),
      })),
    );
  }

  async getSpecies(speciesId: string): Promise<SpeciesDetail> {
    const species = await this.speciesRepository.findById(speciesId);

    if (!species) {
      throw new NotFoundException("Species was not found");
    }

    return species;
  }

  async getObservations(
    speciesId: string,
    pagination: ObservationPageRequest,
  ): Promise<SpeciesObservationPage> {
    const externalTaxonId = await this.speciesRepository.findProviderExternalId(
      speciesId,
      this.observationProvider.providerName,
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
      this.observationProvider.providerName,
      pagination,
    );

    if (storedPage && isFresh(storedPage.lastSuccessfulSyncAt)) {
      return toObservationPage(storedPage, "local-database", "fresh");
    }

    let providerPage;

    try {
      providerPage = await this.observationProvider.getObservations(
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
      this.observationProvider.providerName,
      {
        totalResults: providerPage.totalResults,
        page: providerPage.page,
        perPage: providerPage.perPage,
        results: observations,
      },
    );

    const synchronizedPage = await this.observationRepository.findPage(
      speciesId,
      this.observationProvider.providerName,
      pagination,
    );

    if (!synchronizedPage) {
      throw new Error("Synchronized observation page could not be read");
    }

    return toObservationPage(synchronizedPage, "provider-sync", "fresh");
  }

  async getObservationsWithinBoundingBox(
    speciesId: string,
    boundingBox: ObservationBoundingBox,
    limit: number,
  ): Promise<SpeciesObservationGeoJsonFeatureCollection> {
    if (!(await this.speciesRepository.exists(speciesId))) {
      throw new NotFoundException("Species was not found");
    }

    const result = await this.observationRepository.findWithinBoundingBox(
      speciesId,
      boundingBox,
      limit,
    );

    return {
      type: "FeatureCollection",
      features: result.observations.map(toGeoJsonFeature),
      metadata: {
        datasetScope: "locally-synchronized",
        truncated: result.truncated,
      },
    };
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

function toGeoJsonFeature(
  observation: SpeciesObservation,
): SpeciesObservationGeoJsonFeature {
  if (!observation.location) {
    throw new Error("Spatial observation query returned a missing location");
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [
        observation.location.longitude,
        observation.location.latitude,
      ],
    },
    properties: {
      observedOn: observation.observedOn,
      observedAt: observation.observedAt,
      accuracyMeters: observation.location.accuracyMeters,
      locationPrecision: observation.location.precision,
      locationPrivacy: observation.locationPrivacy,
      source: {
        provider: observation.source.provider,
        url: observation.source.url,
      },
    },
  };
}
