import { describe, expect, it } from "vitest";
import { protectedAreaGeometrySchema } from "../src/protected-areas/protected-area-geometry.schema.js";
import {
  calculateProtectedAreaSimplificationTolerance,
  MAX_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE,
  MIN_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE,
  simplifyProtectedAreasForPresentation,
} from "../src/protected-areas/protected-area-simplifier.js";
import type {
  ProtectedArea,
  ProtectedAreaGeometry,
} from "../src/protected-areas/protected-area.model.js";

describe("protected area presentation simplification", () => {
  it("derives a bounded tolerance from the viewport span", () => {
    expect(
      calculateProtectedAreaSimplificationTolerance({
        west: 20,
        south: 50,
        east: 20.001,
        north: 50.001,
      }),
    ).toBe(MIN_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE);

    expect(
      calculateProtectedAreaSimplificationTolerance({
        west: 20,
        south: 50,
        east: 20.4096,
        north: 50.2,
      }),
    ).toBeCloseTo(0.0001);

    expect(
      calculateProtectedAreaSimplificationTolerance({
        west: 14,
        south: 49,
        east: 24,
        north: 55,
      }),
    ).toBe(MAX_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE);
  });

  it("substantially reduces a dense geometry while preserving its GeoJSON contract and properties", () => {
    const ring = Array.from({ length: 12_000 }, (_, index) => {
      const angle = (index / 12_000) * Math.PI * 2;
      const radius = 0.1 + Math.sin(angle * 32) * 0.002;

      return [
        20.2 + Math.cos(angle) * radius,
        50.2 + Math.sin(angle) * radius,
      ] as [number, number];
    });
    ring.push(ring[0]!);
    const area: ProtectedArea = {
      category: "protected-landscape-area",
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
      inspireCode: "PL.ZIPOP.1393.OCHK.1",
      name: "Dense test boundary",
    };

    const [simplifiedArea] = simplifyProtectedAreasForPresentation([area], {
      west: 20,
      south: 50,
      east: 20.4096,
      north: 50.4096,
    });

    expect(simplifiedArea).toMatchObject({
      category: area.category,
      inspireCode: area.inspireCode,
      name: area.name,
    });
    expect(simplifiedArea).not.toBe(area);
    expect(
      protectedAreaGeometrySchema.safeParse(simplifiedArea?.geometry).success,
    ).toBe(true);
    expect(countPositions(simplifiedArea!.geometry)).toBeLessThan(
      countPositions(area.geometry) / 10,
    );
    expect(countPositions(area.geometry)).toBe(12_001);
  });
});

function countPositions(geometry: ProtectedAreaGeometry): number {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.reduce((count, ring) => count + ring.length, 0);
  }

  return geometry.coordinates.reduce(
    (polygonCount, polygon) =>
      polygonCount +
      polygon.reduce((ringCount, ring) => ringCount + ring.length, 0),
    0,
  );
}
