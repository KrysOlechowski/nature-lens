import type { INaturalistSpeciesSearchResult } from "../inaturalist/inaturalist.adapter.js";
import type { SpeciesSearchResult } from "./species-search-result.model.js";

export function mapINaturalistSpecies(
  species: INaturalistSpeciesSearchResult,
): SpeciesSearchResult {
  return {
    scientificName: species.scientificName,
    ...(species.preferredCommonName
      ? { commonName: species.preferredCommonName }
      : {}),
    displayName: species.preferredCommonName ?? species.scientificName,
    taxonomy: {
      rank: species.rank,
    },
    source: {
      provider: "iNaturalist",
      externalId: String(species.externalId),
    },
  };
}
