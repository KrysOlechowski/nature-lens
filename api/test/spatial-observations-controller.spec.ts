import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SpatialObservationsController } from "../src/species/spatial-observations.controller.js";
import type { SpatialObservationsService } from "../src/species/spatial-observations.service.js";

describe("SpatialObservationsController", () => {
  it("returns observations for a validated viewport bounding box", async () => {
    const collection = {
      type: "FeatureCollection" as const,
      features: [],
      species: {
        items: [],
        returnedCount: 0,
        totalCount: 0,
        truncated: false,
      },
      metadata: {
        datasetScope: "locally-synchronized" as const,
        returnedObservationCount: 0,
        totalObservationCount: 0,
        truncated: false,
      },
    };
    const getWithinBoundingBox = vi.fn().mockResolvedValue(collection);
    const service = {
      getWithinBoundingBox,
    } as Pick<
      SpatialObservationsService,
      "getWithinBoundingBox"
    > as SpatialObservationsService;
    const controller = new SpatialObservationsController(service);

    await expect(
      controller.getObservations("20,49,22,51", "500", "20"),
    ).resolves.toEqual(collection);
    expect(getWithinBoundingBox).toHaveBeenCalledWith(
      { west: 20, south: 49, east: 22, north: 51 },
      500,
      20,
    );
  });

  it("uses bounded defaults independently for features and species", async () => {
    const getWithinBoundingBox = vi.fn().mockResolvedValue({
      type: "FeatureCollection",
      features: [],
      species: {
        items: [],
        returnedCount: 0,
        totalCount: 0,
        truncated: false,
      },
      metadata: {
        datasetScope: "locally-synchronized",
        returnedObservationCount: 0,
        totalObservationCount: 0,
        truncated: false,
      },
    });
    const controller = new SpatialObservationsController({
      getWithinBoundingBox,
    } as Pick<
      SpatialObservationsService,
      "getWithinBoundingBox"
    > as SpatialObservationsService);

    await controller.getObservations("20,49,22,51");

    expect(getWithinBoundingBox).toHaveBeenCalledWith(
      { west: 20, south: 49, east: 22, north: 51 },
      1_000,
      25,
    );
  });

  it.each([
    ["missing bbox", undefined, undefined, undefined],
    ["repeated bbox", ["20,49,22,51"], undefined, undefined],
    ["reversed longitude", "22,49,20,51", undefined, undefined],
    ["out-of-range latitude", "20,-91,22,51", undefined, undefined],
    ["zero feature limit", "20,49,22,51", "0", undefined],
    ["excessive feature limit", "20,49,22,51", "1001", undefined],
    ["zero species limit", "20,49,22,51", undefined, "0"],
    ["excessive species limit", "20,49,22,51", undefined, "101"],
  ])("rejects %s", async (_case, boundingBox, limit, speciesLimit) => {
    const getWithinBoundingBox = vi.fn();
    const controller = new SpatialObservationsController({
      getWithinBoundingBox,
    } as Pick<
      SpatialObservationsService,
      "getWithinBoundingBox"
    > as SpatialObservationsService);

    const request = controller.getObservations(
      boundingBox,
      limit,
      speciesLimit,
    );

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message:
          'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges and increasing bounds; "limit" must be a positive integer no greater than 1000; "speciesLimit" must be a positive integer no greater than 100',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getWithinBoundingBox).not.toHaveBeenCalled();
  });
});
