import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  ObservationPageRequest,
  ObservationProvider,
} from "../biodiversity/biodiversity-provider.contract.js";
import {
  INATURALIST_OBSERVATION_PROVIDER,
  INATURALIST_SPECIES_SEARCH_PROVIDER,
  type INaturalistObservationProvider,
  type INaturalistSpeciesSearchProvider,
} from "../inaturalist/inaturalist.tokens.js";
import { environment } from "../config/environment.js";
import {
  GBIF_OBSERVATION_PROVIDER,
  type GBIFObservationProvider,
} from "../gbif/gbif.tokens.js";
import { ProviderError } from "../provider-errors/provider.error.js";
import { mapGBIFObservation } from "./gbif-observation.mapper.js";
import { mapINaturalistObservation } from "./inaturalist-observation.mapper.js";
import {
  ObservationRepository,
  type ObservationBoundingBox,
} from "./observation.repository.js";
import type { SpeciesDetail } from "./species-detail.model.js";
import type { SpeciesProviderMappingResolution } from "./species-identity.model.js";
import { SpeciesIdentityResolver } from "./species-identity.resolver.js";
import type {
  SpeciesObservationGeoJsonFeature,
  SpeciesObservationGeoJsonFeatureCollection,
} from "./species-observation-geojson.model.js";
import type { SpeciesObservationSeasonality } from "./species-observation-seasonality.model.js";
import type {
  GroupedSpeciesObservation,
  ObservationDataProvider,
  ObservationProviderStatus,
  SpeciesObservation,
  SpeciesObservationPage,
  SpeciesObservationPageData,
  SpeciesObservationPageSourceMetadata,
  StoredSpeciesObservationPage,
} from "./species-observation.model.js";
import { mapINaturalistSpecies } from "./inaturalist-species.mapper.js";
import type {
  NormalizedSpecies,
  SpeciesSearchResult,
} from "./species-search-result.model.js";
import { SpeciesRepository } from "./species.repository.js";

@Injectable()
export class SpeciesService {
  private readonly logger = new Logger(SpeciesService.name);
  private readonly observationRefreshes = new Map<
    string,
    Promise<SynchronizedObservationPage>
  >();

  constructor(
    @Inject(INATURALIST_SPECIES_SEARCH_PROVIDER)
    private readonly speciesSearchProvider: INaturalistSpeciesSearchProvider,
    @Inject(INATURALIST_OBSERVATION_PROVIDER)
    private readonly observationProvider: INaturalistObservationProvider,
    @Inject(GBIF_OBSERVATION_PROVIDER)
    private readonly gbifObservationProvider: GBIFObservationProvider,
    private readonly speciesRepository: SpeciesRepository,
    private readonly observationRepository: ObservationRepository,
    private readonly speciesIdentityResolver: SpeciesIdentityResolver,
  ) {}

  async searchSpecies(query: string): Promise<SpeciesSearchResult[]> {
    const providerResults =
      await this.speciesSearchProvider.searchSpecies(query);
    const normalizedSpecies = providerResults.map(mapINaturalistSpecies);

    return Promise.all(
      normalizedSpecies.map(async (species) => {
        const equivalentMapping = await this.resolveEquivalentMapping(species);
        const id = equivalentMapping
          ? await this.speciesRepository.upsert(species, equivalentMapping)
          : await this.speciesRepository.upsert(species);

        return {
          ...species,
          id,
        };
      }),
    );
  }

  private async resolveEquivalentMapping(
    species: NormalizedSpecies,
  ): Promise<SpeciesProviderMappingResolution | null> {
    try {
      return await this.speciesIdentityResolver.resolve(species);
    } catch (error) {
      if (error instanceof ProviderError) {
        this.logger.warn(
          "Provider taxon identity resolution failed; continuing without a provider mapping",
          {
            event: "species.identity-resolution.failed",
            provider: error.provider,
            errorKind: error.kind,
          },
        );

        return null;
      }

      throw error;
    }
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
    const [externalTaxonId, gbifExternalTaxonId] = await Promise.all([
      this.speciesRepository.findProviderExternalId(
        speciesId,
        this.observationProvider.providerName,
      ),
      this.speciesRepository.findProviderExternalId(
        speciesId,
        this.gbifObservationProvider.providerName,
      ),
    ]);

    if (!externalTaxonId) {
      throw new NotFoundException("Species was not found");
    }

    const primaryPagePromise = this.synchronizeObservationPage(
      speciesId,
      this.observationProvider,
      parseExternalTaxonId(externalTaxonId, "iNaturalist"),
      pagination,
      mapINaturalistObservation,
    );
    const gbifStatusPromise = gbifExternalTaxonId
      ? this.synchronizeSecondaryObservationPage(
          speciesId,
          parseExternalTaxonId(gbifExternalTaxonId, "GBIF"),
          pagination,
        )
      : Promise.resolve(null);
    const [primaryPage, gbifStatus] = await Promise.all([
      primaryPagePromise,
      gbifStatusPromise,
    ]);

    return {
      ...primaryPage,
      metadata: {
        ...primaryPage.metadata,
        providers: [
          toProviderStatus("inaturalist", primaryPage.metadata.freshness),
          ...(gbifStatus ? [gbifStatus] : []),
        ],
      },
    };
  }

  private async synchronizeSecondaryObservationPage(
    speciesId: string,
    externalTaxonId: number,
    pagination: ObservationPageRequest,
  ): Promise<ObservationProviderStatus> {
    try {
      const page = await this.synchronizeObservationPage(
        speciesId,
        this.gbifObservationProvider,
        externalTaxonId,
        pagination,
        mapGBIFObservation,
      );

      return toProviderStatus("gbif", page.metadata.freshness);
    } catch (error) {
      if (error instanceof ProviderError) {
        this.logger.warn(
          "Provider observation synchronization failed; continuing with available observations",
          {
            event: "species.observation-synchronization.failed",
            provider: error.provider,
            errorKind: error.kind,
          },
        );
        return { provider: "gbif", status: "unavailable" };
      }

      throw error;
    }
  }

  private async synchronizeObservationPage<TResult>(
    speciesId: string,
    provider: ObservationProvider<number, TResult>,
    externalTaxonId: number,
    pagination: ObservationPageRequest,
    mapObservation: (observation: TResult) => SpeciesObservation,
  ): Promise<SynchronizedObservationPage> {
    const storedPage = await this.observationRepository.findPage(
      speciesId,
      provider.providerName,
      pagination,
    );

    if (storedPage && isFresh(storedPage.lastSuccessfulSyncAt)) {
      return toObservationPage(storedPage, "local-database", "fresh");
    }

    const refreshKey = createObservationRefreshKey(
      speciesId,
      provider.providerName,
      pagination,
    );
    const inFlightRefresh = this.observationRefreshes.get(refreshKey);

    if (inFlightRefresh) {
      return inFlightRefresh;
    }

    const refresh = this.refreshObservationPage(
      speciesId,
      provider,
      externalTaxonId,
      pagination,
      mapObservation,
      storedPage,
    ).finally(() => {
      if (this.observationRefreshes.get(refreshKey) === refresh) {
        this.observationRefreshes.delete(refreshKey);
      }
    });

    this.observationRefreshes.set(refreshKey, refresh);

    return refresh;
  }

  private async refreshObservationPage<TResult>(
    speciesId: string,
    provider: ObservationProvider<number, TResult>,
    externalTaxonId: number,
    pagination: ObservationPageRequest,
    mapObservation: (observation: TResult) => SpeciesObservation,
    storedPage: StoredSpeciesObservationPage | null,
  ): Promise<SynchronizedObservationPage> {
    let providerPage;

    try {
      providerPage = await provider.getObservations(
        externalTaxonId,
        pagination,
      );
    } catch (error) {
      if (storedPage && error instanceof ProviderError) {
        return toObservationPage(storedPage, "local-database", "stale");
      }

      throw error;
    }

    await this.observationRepository.replacePage(
      speciesId,
      provider.providerName,
      {
        totalResults: providerPage.totalResults,
        page: providerPage.page,
        perPage: providerPage.perPage,
        results: providerPage.results.map(mapObservation),
      },
    );

    const synchronizedPage = await this.observationRepository.findPage(
      speciesId,
      provider.providerName,
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

  async getObservationSeasonality(
    speciesId: string,
  ): Promise<SpeciesObservationSeasonality> {
    if (!(await this.speciesRepository.exists(speciesId))) {
      throw new NotFoundException("Species was not found");
    }

    return this.observationRepository.getSeasonality(speciesId);
  }
}

function createObservationRefreshKey(
  speciesId: string,
  provider: string,
  { page, perPage }: ObservationPageRequest,
): string {
  return JSON.stringify([speciesId, provider, page, perPage]);
}

function parseExternalTaxonId(value: string, provider: string): number {
  const externalTaxonId = Number(value);

  if (!Number.isSafeInteger(externalTaxonId) || externalTaxonId < 1) {
    throw new Error(`Persisted ${provider} taxon identifier is invalid`);
  }

  return externalTaxonId;
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
): SynchronizedObservationPage {
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

interface SynchronizedObservationPage extends SpeciesObservationPageData {
  metadata: SpeciesObservationPageSourceMetadata;
}

function toProviderStatus(
  provider: ObservationDataProvider,
  freshness: "fresh" | "stale",
): ObservationProviderStatus {
  return {
    provider,
    status: freshness === "stale" ? "stale" : "available",
  };
}

function toGeoJsonFeature(
  observation: GroupedSpeciesObservation,
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
      sources: observation.sources,
    },
  };
}
