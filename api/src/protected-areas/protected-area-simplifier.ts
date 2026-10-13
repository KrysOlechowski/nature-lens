import { simplify } from "@turf/simplify";
import { protectedAreaGeometrySchema } from "./protected-area-geometry.schema.js";
import type {
  ProtectedArea,
  ProtectedAreaBoundingBox,
} from "./protected-area.model.js";

const TARGET_COORDINATE_RESOLUTION = 4_096;
export const MIN_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE = 0.000_005;
export const MAX_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE = 0.001;

export function calculateProtectedAreaSimplificationTolerance({
  west,
  south,
  east,
  north,
}: ProtectedAreaBoundingBox): number {
  const viewportSpan = Math.max(east - west, north - south);
  const viewportTolerance = viewportSpan / TARGET_COORDINATE_RESOLUTION;

  return Math.min(
    Math.max(viewportTolerance, MIN_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE),
    MAX_PROTECTED_AREA_SIMPLIFICATION_TOLERANCE,
  );
}

export function simplifyProtectedAreasForPresentation(
  areas: ProtectedArea[],
  boundingBox: ProtectedAreaBoundingBox,
): ProtectedArea[] {
  const tolerance = calculateProtectedAreaSimplificationTolerance(boundingBox);

  return areas.map((area) => {
    const simplifiedFeature = simplify(
      {
        type: "Feature",
        geometry: area.geometry,
        properties: {},
      },
      {
        tolerance,
        highQuality: false,
        mutate: false,
      },
    );
    const simplifiedGeometry = protectedAreaGeometrySchema.safeParse(
      simplifiedFeature.geometry,
    );

    if (!simplifiedGeometry.success) {
      throw new Error(
        "Protected area simplification produced invalid GeoJSON",
        {
          cause: simplifiedGeometry.error,
        },
      );
    }

    return {
      ...area,
      geometry: simplifiedGeometry.data,
    };
  });
}
