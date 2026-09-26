import { Injectable } from "@nestjs/common";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import { parseINaturalistTaxaResponse } from "./inaturalist-response.schema.js";

const INATURALIST_PROVIDER = "iNaturalist";
const INATURALIST_TAXA_URL = "https://api.inaturalist.org/v1/taxa";
const SPECIES_SEARCH_LIMIT = 10;

export interface INaturalistSpeciesSearchResult {
  externalId: number;
  scientificName: string;
  preferredCommonName?: string;
  rank: string;
}

@Injectable()
export class INaturalistAdapter {
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
  }
}
