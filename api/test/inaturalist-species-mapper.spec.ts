import { describe, expect, it } from "vitest";
import { mapINaturalistSpecies } from "../src/species/inaturalist-species.mapper.js";

describe("mapINaturalistSpecies", () => {
  it("normalizes names, taxonomy, and provider identity", () => {
    expect(
      mapINaturalistSpecies({
        externalId: 1696537,
        scientificName: "Bos bonasus",
        preferredCommonName: "Wisent",
        rank: "species",
      }),
    ).toEqual({
      commonName: "Wisent",
      displayName: "Wisent",
      scientificName: "Bos bonasus",
      source: {
        externalId: "1696537",
        provider: "iNaturalist",
      },
      taxonomy: {
        rank: "species",
      },
    });
  });

  it("uses the scientific name for display without inventing a common name", () => {
    expect(
      mapINaturalistSpecies({
        externalId: 1712933,
        scientificName: "Colaspis deleta",
        rank: "species",
      }),
    ).toEqual({
      displayName: "Colaspis deleta",
      scientificName: "Colaspis deleta",
      source: {
        externalId: "1712933",
        provider: "iNaturalist",
      },
      taxonomy: {
        rank: "species",
      },
    });
  });
});
