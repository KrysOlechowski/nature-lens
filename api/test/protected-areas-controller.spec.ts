import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProtectedAreasController } from "../src/protected-areas/protected-areas.controller.js";
import type { ProtectedAreasService } from "../src/protected-areas/protected-areas.service.js";

describe("ProtectedAreasController", () => {
  it("returns protected areas for a validated viewport bounding box", async () => {
    const collection = {
      type: "FeatureCollection" as const,
      features: [],
      metadata: {
        attribution:
          "General Directorate for Environmental Protection (GDOŚ)" as const,
        geometryPurpose: "display-simplified" as const,
        returnedAreaCount: 0,
        sourceUrl:
          "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych" as const,
        truncated: false,
      },
    };
    const getWithinBoundingBox = vi.fn().mockResolvedValue(collection);
    const controller = new ProtectedAreasController({
      getWithinBoundingBox,
    } as Pick<
      ProtectedAreasService,
      "getWithinBoundingBox"
    > as ProtectedAreasService);

    await expect(
      controller.getProtectedAreas(" 20,49,22,51 "),
    ).resolves.toEqual(collection);
    expect(getWithinBoundingBox).toHaveBeenCalledWith({
      west: 20,
      south: 49,
      east: 22,
      north: 51,
    });
  });

  it.each([
    ["missing bbox", undefined],
    ["repeated bbox", ["20,49,22,51"]],
    ["reversed longitude", "22,49,20,51"],
    ["reversed latitude", "20,51,22,49"],
    ["excessive longitude span", "0,49,21,51"],
    ["excessive latitude span", "20,0,22,16"],
    ["out-of-range longitude", "-181,49,22,51"],
    ["out-of-range latitude", "20,-91,22,51"],
  ])("rejects %s", async (_case, boundingBox) => {
    const getWithinBoundingBox = vi.fn();
    const controller = new ProtectedAreasController({
      getWithinBoundingBox,
    } as Pick<
      ProtectedAreasService,
      "getWithinBoundingBox"
    > as ProtectedAreasService);

    const request = controller.getProtectedAreas(boundingBox);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message:
          'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges, increasing non-antimeridian bounds, longitude span no greater than 20 degrees, and latitude span no greater than 15 degrees',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getWithinBoundingBox).not.toHaveBeenCalled();
  });
});
