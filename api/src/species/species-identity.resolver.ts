import { Inject, Injectable } from "@nestjs/common";
import { GBIF_BACKBONE_CHECKLIST_KEY } from "../gbif/gbif.constants.js";
import {
  GBIF_TAXON_MATCH_PROVIDER,
  type GBIFTaxonMatchProvider,
} from "../gbif/gbif.tokens.js";
import type { SpeciesProviderMappingResolution } from "./species-identity.model.js";
import type { NormalizedSpecies } from "./species-search-result.model.js";

const MINIMUM_AUTOMATIC_MATCH_CONFIDENCE = 95;
const GBIF_BACKBONE_MATCH_METHOD = "gbif-backbone-match-v2";

@Injectable()
export class SpeciesIdentityResolver {
  constructor(
    @Inject(GBIF_TAXON_MATCH_PROVIDER)
    private readonly gbifTaxonMatchProvider: GBIFTaxonMatchProvider,
  ) {}

  async resolve(
    species: NormalizedSpecies,
  ): Promise<SpeciesProviderMappingResolution | null> {
    const match = await this.gbifTaxonMatchProvider.matchTaxon({
      scientificName: species.scientificName,
      rank: species.taxonomy.rank,
    });
    const usage = match.usage;

    if (
      !usage ||
      match.diagnostics.matchType !== "EXACT" ||
      match.diagnostics.confidence < MINIMUM_AUTOMATIC_MATCH_CONFIDENCE ||
      normalizeScientificName(usage.scientificName) !==
        normalizeScientificName(species.scientificName) ||
      normalizeRank(usage.rank) !== normalizeRank(species.taxonomy.rank)
    ) {
      return null;
    }

    const acceptedUsage = match.synonym ? match.acceptedUsage : usage;

    if (
      !acceptedUsage ||
      normalizeRank(acceptedUsage.rank) !== normalizeRank(species.taxonomy.rank)
    ) {
      return null;
    }

    return {
      provider: this.gbifTaxonMatchProvider.providerName,
      externalId: String(acceptedUsage.externalId),
      resolutionMethod: GBIF_BACKBONE_MATCH_METHOD,
      resolutionContext: {
        checklistKey: GBIF_BACKBONE_CHECKLIST_KEY,
        inputScientificName: species.scientificName,
        inputTaxonRank: species.taxonomy.rank,
        matchedUsageKey: String(usage.externalId),
        matchedScientificName: usage.scientificName,
        matchedTaxonRank: usage.rank,
        acceptedUsageKey: String(acceptedUsage.externalId),
        acceptedScientificName: acceptedUsage.scientificName,
        acceptedTaxonRank: acceptedUsage.rank,
        synonym: match.synonym,
        matchType: match.diagnostics.matchType,
        confidence: match.diagnostics.confidence,
      },
    };
  }
}

export function normalizeScientificName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeRank(rank: string): string {
  return rank.trim().toLowerCase();
}
