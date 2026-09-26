import { describe, expect, it, vi } from "vitest";
import type { INaturalistAdapter } from "../src/inaturalist/inaturalist.adapter.js";
import { SpeciesService } from "../src/species/species.service.js";

describe("SpeciesService", () => {
  it("returns Nature Lens species models instead of provider results", async () => {
    const searchSpecies = vi.fn().mockResolvedValue([
      {
        externalId: 1696537,
        scientificName: "Bos bonasus",
        preferredCommonName: "Wisent",
        rank: "species",
      },
    ]);
    const iNaturalistAdapter = {
      searchSpecies,
    } as Pick<INaturalistAdapter, "searchSpecies"> as INaturalistAdapter;
    const service = new SpeciesService(iNaturalistAdapter);

    await expect(service.searchSpecies("bison")).resolves.toEqual([
      {
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
      },
    ]);
    expect(searchSpecies).toHaveBeenCalledWith("bison");
  });
});
