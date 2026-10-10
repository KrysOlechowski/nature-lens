import { describe, expect, it, vi } from "vitest";
import type { GBIFTaxonMatchProvider } from "../src/gbif/gbif.tokens.js";
import { SpeciesIdentityResolver } from "../src/species/species-identity.resolver.js";
import type { NormalizedSpecies } from "../src/species/species-search-result.model.js";

const species: NormalizedSpecies = {
  scientificName: "Bos bonasus",
  commonName: "Wisent",
  displayName: "Wisent",
  taxonomy: {
    rank: "species",
  },
  source: {
    provider: "iNaturalist",
    externalId: "1696537",
  },
};

function createResolver(match: object) {
  const matchTaxon = vi.fn().mockResolvedValue(match);
  const provider = {
    providerName: "GBIF",
    matchTaxon,
  } as GBIFTaxonMatchProvider;

  return {
    matchTaxon,
    resolver: new SpeciesIdentityResolver(provider),
  };
}

describe("SpeciesIdentityResolver", () => {
  it("resolves an exact synonym to its accepted GBIF Backbone usage", async () => {
    const { resolver, matchTaxon } = createResolver({
      usage: {
        externalId: 2_441_185,
        scientificName: "Bos bonasus",
        rank: "SPECIES",
      },
      acceptedUsage: {
        externalId: 2_441_184,
        scientificName: "Bison bonasus",
        rank: "SPECIES",
      },
      synonym: true,
      diagnostics: {
        matchType: "EXACT",
        confidence: 98,
      },
    });

    await expect(resolver.resolve(species)).resolves.toEqual({
      provider: "GBIF",
      externalId: "2441184",
      resolutionMethod: "gbif-backbone-match-v2",
      resolutionContext: {
        checklistKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
        inputScientificName: "Bos bonasus",
        inputTaxonRank: "species",
        matchedUsageKey: "2441185",
        matchedScientificName: "Bos bonasus",
        matchedTaxonRank: "SPECIES",
        acceptedUsageKey: "2441184",
        acceptedScientificName: "Bison bonasus",
        acceptedTaxonRank: "SPECIES",
        synonym: true,
        matchType: "EXACT",
        confidence: 98,
      },
    });
    expect(matchTaxon).toHaveBeenCalledWith({
      scientificName: "Bos bonasus",
      rank: "species",
    });
  });

  it("uses the matched usage for an accepted taxon", async () => {
    const { resolver } = createResolver({
      usage: {
        externalId: 2_441_184,
        scientificName: "  BOS   BONASUS ",
        rank: "SPECIES",
      },
      synonym: false,
      diagnostics: {
        matchType: "EXACT",
        confidence: 99,
      },
    });

    await expect(resolver.resolve(species)).resolves.toMatchObject({
      externalId: "2441184",
      resolutionContext: {
        matchedUsageKey: "2441184",
        acceptedUsageKey: "2441184",
        synonym: false,
      },
    });
  });

  it.each([
    [
      "no match",
      {
        synonym: false,
        diagnostics: { matchType: "NONE", confidence: 100 },
      },
    ],
    [
      "a fuzzy match",
      {
        usage: {
          externalId: 2_441_184,
          scientificName: "Bos bonasus",
          rank: "SPECIES",
        },
        synonym: false,
        diagnostics: { matchType: "FUZZY", confidence: 99 },
      },
    ],
    [
      "low confidence",
      {
        usage: {
          externalId: 2_441_184,
          scientificName: "Bos bonasus",
          rank: "SPECIES",
        },
        synonym: false,
        diagnostics: { matchType: "EXACT", confidence: 94 },
      },
    ],
    [
      "a different name",
      {
        usage: {
          externalId: 2_441_184,
          scientificName: "Bison bison",
          rank: "SPECIES",
        },
        synonym: false,
        diagnostics: { matchType: "EXACT", confidence: 99 },
      },
    ],
    [
      "a different rank",
      {
        usage: {
          externalId: 2_441_184,
          scientificName: "Bos bonasus",
          rank: "SUBSPECIES",
        },
        synonym: false,
        diagnostics: { matchType: "EXACT", confidence: 99 },
      },
    ],
  ])("does not automatically merge %s", async (_description, match) => {
    const { resolver } = createResolver(match);

    await expect(resolver.resolve(species)).resolves.toBeNull();
  });
});
