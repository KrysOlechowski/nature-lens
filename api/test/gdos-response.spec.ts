import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  GDOS_PROTECTED_AREA_FETCH_LIMIT,
  MAX_PROTECTED_AREAS_PER_VIEWPORT,
} from "../src/gdos/gdos.constants.js";
import { GdosIntegrationError } from "../src/gdos/gdos-integration.error.js";
import { parseGdosProtectedAreasResponse } from "../src/gdos/gdos-response.schema.js";

const polygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [20, 50],
      [21, 50],
      [21, 51],
      [20, 50],
    ],
  ],
};

function createFeature(index = 1) {
  return {
    type: "Feature",
    id: `ParkiNarodowe.${index}`,
    geometry: polygon,
    properties: {
      gid: index,
      nazwa: `Protected area ${index}`,
      kodinspire: `PL.ZIPOP.1393.PN.${index}`,
    },
  };
}

describe("parseGdosProtectedAreasResponse", () => {
  it("normalizes only the provider fields used by the application", () => {
    expect(
      parseGdosProtectedAreasResponse({
        type: "FeatureCollection",
        features: [
          createFeature(),
          {
            type: "Feature",
            id: "SpecjalneObszaryOchrony.2",
            geometry: {
              type: "MultiPolygon",
              coordinates: [polygon.coordinates],
            },
            properties: {
              nazwa: "Habitat area",
              kodinspire: "PL.ZIPOP.1393.N2K.PLH000002",
              unused: "provider-specific value",
            },
          },
        ],
        crs: { type: "EPSG", properties: { code: "4326" } },
      }),
    ).toEqual({
      areas: [
        {
          category: "national-park",
          geometry: polygon,
          inspireCode: "PL.ZIPOP.1393.PN.1",
          name: "Protected area 1",
        },
        {
          category: "natura-2000-habitat",
          geometry: {
            type: "MultiPolygon",
            coordinates: [polygon.coordinates],
          },
          inspireCode: "PL.ZIPOP.1393.N2K.PLH000002",
          name: "Habitat area",
        },
      ],
      truncated: false,
    });
  });

  it("uses the extra fetched feature only to report truncation", () => {
    const result = parseGdosProtectedAreasResponse({
      type: "FeatureCollection",
      features: Array.from(
        { length: GDOS_PROTECTED_AREA_FETCH_LIMIT },
        (_, index) => createFeature(index + 1),
      ),
    });

    expect(result.areas).toHaveLength(MAX_PROTECTED_AREAS_PER_VIEWPORT);
    expect(result.truncated).toBe(true);
    expect(result.areas.at(-1)?.name).toBe("Protected area 200");
  });

  it.each([
    [
      "a point geometry",
      {
        ...createFeature(),
        geometry: { type: "Point", coordinates: [20, 50] },
      },
    ],
    [
      "coordinates outside WGS84",
      {
        ...createFeature(),
        geometry: {
          ...polygon,
          coordinates: [
            [
              [181, 50],
              [21, 50],
              [21, 51],
              [181, 50],
            ],
          ],
        },
      },
    ],
    ["an unexpected source layer", { ...createFeature(), id: "Unknown.1" }],
  ])("reports %s as a controlled integration error", (_case, feature) => {
    expect(() =>
      parseGdosProtectedAreasResponse({
        type: "FeatureCollection",
        features: [feature],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<GdosIntegrationError>>({
        cause: expect.any(z.ZodError),
        kind: "invalid-response",
        provider: "GDOŚ",
      }),
    );
  });
});
