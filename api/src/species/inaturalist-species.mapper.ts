import type { INaturalistSpeciesSearchResult } from "../inaturalist/inaturalist.adapter.js";
import type { NormalizedSpecies } from "./species-search-result.model.js";

export function mapINaturalistSpecies(
  species: INaturalistSpeciesSearchResult,
): NormalizedSpecies {
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
