import { Injectable } from "@nestjs/common";
import type {
  ObservationPage,
  ObservationPageRequest,
  ObservationProvider,
  TaxonMatchProvider,
  TaxonMatchRequest,
} from "../biodiversity/biodiversity-provider.contract.js";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import {
  GBIF_BACKBONE_CHECKLIST_KEY,
  GBIF_PROVIDER,
} from "./gbif.constants.js";
import { throwGBIFProviderError } from "./gbif-error.mapper.js";
import {
  parseGBIFOccurrencesResponse,
  parseGBIFTaxonMatchResponse,
} from "./gbif-response.schema.js";

const GBIF_OCCURRENCES_URL = "https://api.gbif.org/v1/occurrence/search";
const GBIF_TAXON_MATCH_URL = "https://api.gbif.org/v2/species/match";
const POLAND_COUNTRY_CODE = "PL";
const OCCURRENCES_MAX_PER_PAGE = 300;
const OCCURRENCES_MAX_RESULT_WINDOW = 100_000;

export interface GBIFObservationResult {
  externalId: number;
  eventDate: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  coordinateUncertaintyMeters: number | null;
  sourceUrl: string;
}

export interface GBIFTaxonUsage {
  externalId: number;
  scientificName: string;
  rank: string;
}

export interface GBIFTaxonMatchResult {
  usage?: GBIFTaxonUsage;
  acceptedUsage?: GBIFTaxonUsage;
  synonym: boolean;
  diagnostics: {
    matchType: "EXACT" | "FUZZY" | "HIGHERRANK" | "NONE";
    confidence: number;
  };
}

@Injectable()
export class GBIFAdapter
  implements
    ObservationProvider<number, GBIFObservationResult>,
    TaxonMatchProvider<GBIFTaxonMatchResult>
{
  readonly providerName = GBIF_PROVIDER;

  constructor(private readonly externalHttpClient: ExternalHttpClient) {}

  async getObservations(
    taxonKey: number,
    pagination: ObservationPageRequest,
  ): Promise<ObservationPage<GBIFObservationResult>> {
    assertPositiveInteger(taxonKey, "taxon key");
    assertPositiveInteger(pagination.page, "observation page");
    assertPositiveInteger(pagination.perPage, "observations per page");

    if (pagination.perPage > OCCURRENCES_MAX_PER_PAGE) {
      throw new TypeError(
        `GBIF observations per page cannot exceed ${OCCURRENCES_MAX_PER_PAGE}`,
      );
    }

    const offset = (pagination.page - 1) * pagination.perPage;

    if (
      !Number.isSafeInteger(offset) ||
      offset + pagination.perPage > OCCURRENCES_MAX_RESULT_WINDOW
    ) {
      throw new TypeError(
        `GBIF observation offset plus page size cannot exceed ${OCCURRENCES_MAX_RESULT_WINDOW}`,
      );
    }

    const url = new URL(GBIF_OCCURRENCES_URL);
    url.searchParams.set("taxonKey", String(taxonKey));
    url.searchParams.set("checklistKey", GBIF_BACKBONE_CHECKLIST_KEY);
    url.searchParams.set("country", POLAND_COUNTRY_CODE);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(pagination.perPage));

    try {
      const response = await this.externalHttpClient.getJson({
        provider: GBIF_PROVIDER,
        url,
      });
      const occurrences = parseGBIFOccurrencesResponse(response);

      return {
        totalResults: occurrences.count,
        page: pagination.page,
        perPage: occurrences.limit,
        results: occurrences.results.map((occurrence) => ({
          externalId: occurrence.key,
          eventDate: occurrence.eventDate ?? null,
          coordinates:
            occurrence.decimalLatitude != null &&
            occurrence.decimalLongitude != null
              ? {
                  latitude: occurrence.decimalLatitude,
                  longitude: occurrence.decimalLongitude,
                }
              : null,
          coordinateUncertaintyMeters:
            occurrence.coordinateUncertaintyInMeters ?? null,
          sourceUrl: `https://www.gbif.org/occurrence/${occurrence.key}`,
        })),
      };
    } catch (error) {
      throwGBIFProviderError(error);
    }
  }

  async matchTaxon(request: TaxonMatchRequest): Promise<GBIFTaxonMatchResult> {
    const scientificName = request.scientificName.trim();
    const rank = request.rank.trim();

    if (!scientificName) {
      throw new TypeError("GBIF taxon match requires a scientific name");
    }

    if (!rank) {
      throw new TypeError("GBIF taxon match requires a rank");
    }

    const url = new URL(GBIF_TAXON_MATCH_URL);
    url.searchParams.set("scientificName", scientificName);
    url.searchParams.set("taxonRank", rank);
    url.searchParams.set("checklistKey", GBIF_BACKBONE_CHECKLIST_KEY);

    try {
      const response = await this.externalHttpClient.getJson({
        provider: GBIF_PROVIDER,
        url,
      });
      const match = parseGBIFTaxonMatchResponse(response);

      return {
        ...(match.usage
          ? {
              usage: {
                externalId: match.usage.key,
                scientificName: match.usage.canonicalName,
                rank: match.usage.rank,
              },
            }
          : {}),
        ...(match.acceptedUsage
          ? {
              acceptedUsage: {
                externalId: match.acceptedUsage.key,
                scientificName: match.acceptedUsage.canonicalName,
                rank: match.acceptedUsage.rank,
              },
            }
          : {}),
        synonym: match.synonym,
        diagnostics: match.diagnostics,
      };
    } catch (error) {
      throwGBIFProviderError(error);
    }
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`GBIF ${field} must be a positive integer`);
  }
}
