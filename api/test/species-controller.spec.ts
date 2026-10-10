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

  it("returns a normalized page of species observations with sync metadata", async () => {
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
      metadata: {
        servedFrom: "local-database",
        freshness: "fresh",
        lastSuccessfulSyncAt: "2026-10-09T11:30:00.000Z",
      },
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
      metadata: {
        servedFrom: "local-database",
        freshness: "fresh",
        lastSuccessfulSyncAt: "2026-10-09T11:30:00.000Z",
      },
    });
    expect(getObservations).toHaveBeenCalledWith("1696537", {
      page: 2,
      perPage: 20,
    });
  });

  it("uses bounded pagination defaults for observations", async () => {
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 0,
      page: 1,
      perPage: 50,
      results: [],
      metadata: {
        servedFrom: "provider-sync",
        freshness: "fresh",
        lastSuccessfulSyncAt: "2026-10-09T11:30:00.000Z",
      },
    });
    const speciesService = {
      getObservations,
    } as Pick<SpeciesService, "getObservations"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await controller.getObservations("1696537", undefined, undefined);

    expect(getObservations).toHaveBeenCalledWith("1696537", {
      page: 1,
      perPage: 50,
    });
  });

  it("returns bounded local observations as GeoJSON", async () => {
    const getObservationsWithinBoundingBox = vi.fn().mockResolvedValue({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [21.0122, 52.2297],
          },
          properties: {
            observedOn: "2026-10-05",
            observedAt: "2026-10-05T09:00:00.000Z",
            accuracyMeters: 10,
            locationPrecision: "approximate",
            locationPrivacy: "open",
            source: {
              provider: "iNaturalist",
              url: "https://www.inaturalist.org/observations/405566290",
            },
          },
        },
      ],
      metadata: {
        datasetScope: "locally-synchronized",
        truncated: true,
      },
    });
    const speciesService = {
      getObservationsWithinBoundingBox,
    } as Pick<
      SpeciesService,
      "getObservationsWithinBoundingBox"
    > as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await expect(
      controller.getObservations(
        "1696537",
        undefined,
        undefined,
        "20,51,22,53",
        undefined,
      ),
    ).resolves.toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [21.0122, 52.2297],
          },
          properties: {
            observedOn: "2026-10-05",
            observedAt: "2026-10-05T09:00:00.000Z",
            accuracyMeters: 10,
            locationPrecision: "approximate",
            locationPrivacy: "open",
            source: {
              provider: "iNaturalist",
              url: "https://www.inaturalist.org/observations/405566290",
            },
          },
        },
      ],
      metadata: {
        datasetScope: "locally-synchronized",
        truncated: true,
      },
    });
    expect(getObservationsWithinBoundingBox).toHaveBeenCalledWith(
      "1696537",
      {
        west: 20,
        south: 51,
        east: 22,
        north: 53,
      },
      1_000,
    );
  });

  it.each([
    ["missing bbox", "1696537", undefined, undefined, undefined, "100"],
    ["malformed bbox", "1696537", undefined, undefined, "20,51,22", undefined],
    [
      "out-of-range bbox",
      "1696537",
      undefined,
      undefined,
      "20,51,181,53",
      undefined,
    ],
    [
      "non-increasing bbox",
      "1696537",
      undefined,
      undefined,
      "22,53,20,51",
      undefined,
    ],
    ["zero limit", "1696537", undefined, undefined, "20,51,22,53", "0"],
    ["oversized limit", "1696537", undefined, undefined, "20,51,22,53", "1001"],
    ["mixed pagination", "1696537", "1", undefined, "20,51,22,53", undefined],
  ])(
    "rejects a spatial observation request with %s",
    async (_case, id, page, perPage, boundingBox, limit) => {
      const getObservationsWithinBoundingBox = vi.fn();
      const speciesService = {
        getObservationsWithinBoundingBox,
      } as Pick<
        SpeciesService,
        "getObservationsWithinBoundingBox"
      > as SpeciesService;
      const controller = new SpeciesController(speciesService);

      const request = controller.getObservations(
        id,
        page,
        perPage,
        boundingBox,
        limit,
      );

      await expect(request).rejects.toBeInstanceOf(BadRequestException);
      await expect(request).rejects.toMatchObject({
        response: {
          error: "Bad Request",
          message:
            'Path parameter "id" must be a positive integer; "bbox" must contain west,south,east,north coordinates with valid ranges and increasing bounds; "limit" must be a positive integer no greater than 1000; spatial and pagination parameters cannot be combined',
          statusCode: 400,
        },
        status: 400,
      });
      expect(getObservationsWithinBoundingBox).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["zero species ID", "0", undefined, undefined],
    ["non-numeric species ID", "deer", undefined, undefined],
    ["repeated species ID", ["1", "2"], undefined, undefined],
    ["out-of-range species ID", "9223372036854775808", undefined, undefined],
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
