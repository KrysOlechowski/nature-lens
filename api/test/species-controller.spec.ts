import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SpeciesController } from "../src/species/species.controller.js";
import type { SpeciesService } from "../src/species/species.service.js";

describe("SpeciesController", () => {
  it("returns normalized species search response DTOs", async () => {
    const searchSpecies = vi.fn().mockResolvedValue([
      {
        commonName: "Red Deer",
        displayName: "Red Deer",
        scientificName: "Cervus elaphus",
        source: {
          externalId: "42115",
          provider: "iNaturalist",
        },
        taxonomy: {
          rank: "species",
        },
      },
      {
        displayName: "Cervus nippon",
        scientificName: "Cervus nippon",
        source: {
          externalId: "42116",
          provider: "iNaturalist",
        },
        taxonomy: {
          rank: "species",
        },
      },
    ]);
    const speciesService = {
      searchSpecies,
    } as Pick<SpeciesService, "searchSpecies"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await expect(controller.searchSpecies("  jeleń  ")).resolves.toEqual([
      {
        commonName: "Red Deer",
        displayName: "Red Deer",
        scientificName: "Cervus elaphus",
        source: {
          externalId: "42115",
          provider: "iNaturalist",
        },
        taxonomy: {
          rank: "species",
        },
      },
      {
        displayName: "Cervus nippon",
        scientificName: "Cervus nippon",
        source: {
          externalId: "42116",
          provider: "iNaturalist",
        },
        taxonomy: {
          rank: "species",
        },
      },
    ]);
    expect(searchSpecies).toHaveBeenCalledWith("jeleń");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["repeated", ["deer", "elk"]],
  ])("rejects a %s query with a bad request", async (_case, query) => {
    const searchSpecies = vi.fn();
    const speciesService = {
      searchSpecies,
    } as Pick<SpeciesService, "searchSpecies"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    const request = controller.searchSpecies(query);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message: 'Query parameter "q" must be a non-empty string',
        statusCode: 400,
      },
      status: 400,
    });
    expect(searchSpecies).not.toHaveBeenCalled();
  });
});
