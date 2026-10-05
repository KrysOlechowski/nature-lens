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
        id: "1",
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
        id: "2",
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
        id: "1",
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
        id: "2",
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

  it("returns a normalized page of live species observations", async () => {
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [
        {
          observedOn: "2026-10-03",
          observedAt: "2026-10-03T16:45:26+02:00",
          location: {
            latitude: 53.4029839302,
            longitude: 23.2064155596,
            accuracyMeters: 25_876,
            precision: "limited",
          },
          locationPrivacy: "obscured",
          source: {
            provider: "iNaturalist",
            externalId: "405566287",
            url: "https://www.inaturalist.org/observations/405566287",
          },
        },
      ],
    });
    const speciesService = {
      getObservations,
    } as Pick<SpeciesService, "getObservations"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await expect(
      controller.getObservations("1696537", "2", "20"),
    ).resolves.toEqual({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [
        {
          observedOn: "2026-10-03",
          observedAt: "2026-10-03T16:45:26+02:00",
          location: {
            latitude: 53.4029839302,
            longitude: 23.2064155596,
            accuracyMeters: 25_876,
            precision: "limited",
          },
          locationPrivacy: "obscured",
          source: {
            provider: "iNaturalist",
            externalId: "405566287",
            url: "https://www.inaturalist.org/observations/405566287",
          },
        },
      ],
    });
    expect(getObservations).toHaveBeenCalledWith(1696537, {
      page: 2,
      perPage: 20,
    });
  });

  it("uses bounded pagination defaults for live observations", async () => {
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 0,
      page: 1,
      perPage: 50,
      results: [],
    });
    const speciesService = {
      getObservations,
    } as Pick<SpeciesService, "getObservations"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await controller.getObservations("1696537", undefined, undefined);

    expect(getObservations).toHaveBeenCalledWith(1696537, {
      page: 1,
      perPage: 50,
    });
  });

  it.each([
    ["zero species ID", "0", undefined, undefined],
    ["non-numeric species ID", "deer", undefined, undefined],
    ["repeated species ID", ["1", "2"], undefined, undefined],
    ["zero page", "1696537", "0", undefined],
    ["fractional page", "1696537", "1.5", undefined],
    ["repeated page", "1696537", ["1", "2"], undefined],
    ["zero page size", "1696537", undefined, "0"],
    ["oversized page size", "1696537", undefined, "201"],
    ["repeated page size", "1696537", undefined, ["20", "50"]],
  ])("rejects a request with %s", async (_case, id, page, perPage) => {
    const getObservations = vi.fn();
    const speciesService = {
      getObservations,
    } as Pick<SpeciesService, "getObservations"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    const request = controller.getObservations(id, page, perPage);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message:
          'Path parameter "id" and query parameters "page" and "perPage" must be positive integers; "perPage" cannot exceed 200',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getObservations).not.toHaveBeenCalled();
  });
});
