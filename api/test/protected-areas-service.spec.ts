import { describe, expect, it, vi } from "vitest";
import type { ProtectedAreasProvider } from "../src/protected-areas/protected-areas-provider.contract.js";
import { ProtectedAreasService } from "../src/protected-areas/protected-areas.service.js";

describe("ProtectedAreasService", () => {
  it("maps provider-neutral areas into attributed GeoJSON", async () => {
    const area = {
      category: "nature-reserve" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [20, 50] as [number, number],
            [21, 50] as [number, number],
            [21, 51] as [number, number],
            [20, 50] as [number, number],
          ],
        ],
      },
      inspireCode: "PL.ZIPOP.1393.RP.1",
      name: "Test reserve",
    };
    const provider: ProtectedAreasProvider = {
      providerName: "Test provider",
      getWithinBoundingBox: vi.fn().mockResolvedValue({
        areas: [area],
        truncated: true,
      }),
    };
    const service = new ProtectedAreasService(provider);
    const boundingBox = { west: 20, south: 49, east: 22, north: 51 };

    await expect(service.getWithinBoundingBox(boundingBox)).resolves.toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: area.geometry,
          properties: {
            category: "nature-reserve",
            inspireCode: "PL.ZIPOP.1393.RP.1",
            name: "Test reserve",
          },
        },
      ],
      metadata: {
        attribution: "General Directorate for Environmental Protection (GDOŚ)",
        geometryPurpose: "display-simplified",
        returnedAreaCount: 1,
        sourceUrl:
          "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych",
        truncated: true,
      },
    });
    expect(provider.getWithinBoundingBox).toHaveBeenCalledWith(boundingBox);
  });
});
