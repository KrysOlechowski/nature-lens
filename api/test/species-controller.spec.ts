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
    ["too long", "a".repeat(101)],
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
        message:
          'Query parameter "q" must be a non-empty string no longer than 100 characters',
        statusCode: 400,
      },
      status: 400,
    });
    expect(searchSpecies).not.toHaveBeenCalled();
  });

  it("returns an explicit species detail DTO", async () => {
    const getSpecies = vi.fn().mockResolvedValue({
      id: "42",
      scientificName: "Bos bonasus",
      displayName: "Wisent",
      taxonomy: {
        rank: "species",
      },
    });
    const speciesService = {
      getSpecies,
    } as Pick<SpeciesService, "getSpecies"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await expect(controller.getSpecies("42")).resolves.toEqual({
      id: "42",
      scientificName: "Bos bonasus",
      displayName: "Wisent",
      taxonomy: {
        rank: "species",
      },
    });
    expect(getSpecies).toHaveBeenCalledWith("42");
  });

  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["non-numeric", "bison"],
    ["repeated", ["42", "43"]],
    ["outside PostgreSQL bigint range", "9223372036854775808"],
  ])("rejects a %s species identifier", async (_case, id) => {
    const getSpecies = vi.fn();
    const speciesService = {
      getSpecies,
    } as Pick<SpeciesService, "getSpecies"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    const request = controller.getSpecies(id);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message: 'Path parameter "id" must be a positive integer',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getSpecies).not.toHaveBeenCalled();
  });

  it("returns observation seasonality with all calendar buckets", async () => {
    const getObservationSeasonality = vi.fn().mockResolvedValue({
      months: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        count: index === 0 ? 3 : 0,
      })),
      years: [{ year: 2026, count: 3 }],
      undatedCount: 1,
      metadata: {
        datasetScope: "locally-synchronized",
      },
    });
    const speciesService = {
      getObservationSeasonality,
    } as Pick<SpeciesService, "getObservationSeasonality"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    await expect(controller.getObservationSeasonality("42")).resolves.toEqual({
      months: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        count: index === 0 ? 3 : 0,
      })),
      years: [{ year: 2026, count: 3 }],
      undatedCount: 1,
      metadata: {
        datasetScope: "locally-synchronized",
      },
    });
    expect(getObservationSeasonality).toHaveBeenCalledWith("42");
  });

  it.each([
    ["zero", "0"],
    ["non-numeric", "bison"],
    ["repeated", ["42", "43"]],
    ["outside PostgreSQL bigint range", "9223372036854775808"],
  ])("rejects a %s seasonality species identifier", async (_case, id) => {
    const getObservationSeasonality = vi.fn();
    const speciesService = {
      getObservationSeasonality,
    } as Pick<SpeciesService, "getObservationSeasonality"> as SpeciesService;
    const controller = new SpeciesController(speciesService);

    const request = controller.getObservationSeasonality(id);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message: 'Path parameter "id" must be a positive integer',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getObservationSeasonality).not.toHaveBeenCalled();
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
            license: {
              code: "cc-by-nc",
              url: null,
            },
            dataset: null,
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
            license: {
              code: "cc-by-nc",
              url: null,
            },
            dataset: null,
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

  it("accepts the maximum supported observation result window", async () => {
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 100_000,
      page: 500,
      perPage: 200,
      results: [],
      metadata: {
        servedFrom: "provider-sync",
        freshness: "fresh",
        lastSuccessfulSyncAt: "2026-10-09T11:30:00.000Z",
      },
    });
    const controller = new SpeciesController({
      getObservations,
    } as Pick<SpeciesService, "getObservations"> as SpeciesService);

    await controller.getObservations("1696537", "500", "200");

    expect(getObservations).toHaveBeenCalledWith("1696537", {
      page: 500,
      perPage: 200,
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
            sources: [
              {
                provider: "iNaturalist",
                externalId: "405566290",
                url: "https://www.inaturalist.org/observations/405566290",
                license: null,
                dataset: null,
              },
            ],
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
            sources: [
              {
                provider: "iNaturalist",
                externalId: "405566290",
                url: "https://www.inaturalist.org/observations/405566290",
                license: null,
                dataset: null,
              },
            ],
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
            'Path parameter "id" must be a positive integer; "bbox" must contain west,south,east,north coordinates with valid ranges, increasing non-antimeridian bounds, longitude span no greater than 20 degrees, and latitude span no greater than 15 degrees; "limit" must be a positive integer no greater than 1000; spatial and pagination parameters cannot be combined',
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
    ["oversized result window", "1696537", "501", "200"],
    ["unsafe page", "1696537", "9007199254740992", "1"],
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
          'Path parameter "id" and query parameters "page" and "perPage" must be positive integers; "perPage" cannot exceed 200; the requested page window cannot exceed 100000 records',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getObservations).not.toHaveBeenCalled();
  });
});
