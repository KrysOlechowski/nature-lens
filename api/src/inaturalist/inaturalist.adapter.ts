import { Injectable } from "@nestjs/common";
import type {
  ObservationPage,
  ObservationPageRequest,
  ObservationProvider,
  SpeciesSearchProvider,
} from "../biodiversity/biodiversity-provider.contract.js";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import {
  parseINaturalistObservationsResponse,
  parseINaturalistTaxaResponse,
} from "./inaturalist-response.schema.js";
import { throwINaturalistProviderError } from "./inaturalist-error.mapper.js";

const INATURALIST_PROVIDER = "iNaturalist";
const INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
const INATURALIST_OBSERVATIONS_URL =
  "https://api.inaturalist.org/v1/observations";
const POLAND_PLACE_ID = 7800;
const SPECIES_SEARCH_LIMIT = 10;
const OBSERVATIONS_MAX_PER_PAGE = 200;

export interface INaturalistSpeciesSearchResult {
  externalId: number;
  scientificName: string;
  preferredCommonName?: string;
  rank: string;
}

export interface INaturalistObservationResult {
  externalId: number;
  observedOn: string | null;
  timeObservedAt: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  positionalAccuracyMeters: number | null;
  publicPositionalAccuracyMeters: number | null;
  geoprivacy: "open" | "obscured" | "private" | null;
  taxonGeoprivacy: "open" | "obscured" | "private" | null;
  obscured: boolean;
  sourceUrl: string;
}

@Injectable()
export class INaturalistAdapter
  implements
    SpeciesSearchProvider<INaturalistSpeciesSearchResult>,
    ObservationProvider<number, INaturalistObservationResult>
{
  readonly providerName = INATURALIST_PROVIDER;

  constructor(private readonly externalHttpClient: ExternalHttpClient) {}

  async searchSpecies(
    query: string,
  ): Promise<INaturalistSpeciesSearchResult[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new TypeError("iNaturalist species search requires a query");
    }

    const url = new URL(INATURALIST_TAXA_URL);
    url.searchParams.set("q", normalizedQuery);
    url.searchParams.set("rank", "species");
    url.searchParams.set("is_active", "true");
    url.searchParams.set("per_page", String(SPECIES_SEARCH_LIMIT));
    url.searchParams.set("locale", "en");

    try {
      const response = await this.externalHttpClient.getJson({
        provider: INATURALIST_PROVIDER,
        url,
      });
      const taxa = parseINaturalistTaxaResponse(response);

      return taxa.results.map((taxon) => ({
        externalId: taxon.id,
        scientificName: taxon.name,
        ...(taxon.preferred_common_name
          ? { preferredCommonName: taxon.preferred_common_name }
          : {}),
        rank: taxon.rank,
      }));
    } catch (error) {
      throwINaturalistProviderError(error);
    }
  }

  async getObservations(
    taxonId: number,
    pagination: ObservationPageRequest,
  ): Promise<ObservationPage<INaturalistObservationResult>> {
    assertPositiveInteger(taxonId, "taxon ID");
    assertPositiveInteger(pagination.page, "observation page");
    assertPositiveInteger(pagination.perPage, "observations per page");

    if (pagination.perPage > OBSERVATIONS_MAX_PER_PAGE) {
      throw new TypeError(
        `iNaturalist observations per page cannot exceed ${OBSERVATIONS_MAX_PER_PAGE}`,
      );
    }

    const url = new URL(INATURALIST_OBSERVATIONS_URL);
    url.searchParams.set("taxon_id", String(taxonId));
    url.searchParams.set("place_id", String(POLAND_PLACE_ID));
    url.searchParams.set("page", String(pagination.page));
    url.searchParams.set("per_page", String(pagination.perPage));

    try {
      const response = await this.externalHttpClient.getJson({
        provider: INATURALIST_PROVIDER,
        url,
      });
      const observations = parseINaturalistObservationsResponse(response);

      return {
        totalResults: observations.total_results,
        page: observations.page,
        perPage: observations.per_page,
        results: observations.results.map((observation) => ({
          externalId: observation.id,
          observedOn: observation.observed_on,
          timeObservedAt: observation.time_observed_at,
          coordinates: observation.geojson
            ? {
                latitude: observation.geojson.coordinates[1],
                longitude: observation.geojson.coordinates[0],
              }
            : null,
          positionalAccuracyMeters: observation.positional_accuracy,
          publicPositionalAccuracyMeters:
            observation.public_positional_accuracy,
          geoprivacy: observation.geoprivacy,
          taxonGeoprivacy: observation.taxon_geoprivacy,
          obscured: observation.obscured,
          sourceUrl: observation.uri,
        })),
      };
    } catch (error) {
      throwINaturalistProviderError(error);
    }
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`iNaturalist ${field} must be a positive integer`);
  }
}
