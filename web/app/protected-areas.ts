import { z } from "zod";

export const protectedAreaCategorySchema = z.enum([
  "documentation-site",
  "ecological-site",
  "landscape-park",
  "landscape-nature-complex",
  "national-park",
  "natural-monument-area",
  "natura-2000-bird",
  "natura-2000-habitat",
  "nature-reserve",
  "protected-landscape-area",
]);

const positionSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const linearRingSchema = z.array(positionSchema).min(4);
const polygonCoordinatesSchema = z.array(linearRingSchema).min(1);
const protectedAreaGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Polygon"),
    coordinates: polygonCoordinatesSchema,
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(polygonCoordinatesSchema).min(1),
  }),
]);

export const protectedAreasSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: protectedAreaGeometrySchema,
      properties: z.object({
        category: protectedAreaCategorySchema,
        inspireCode: z.string().min(1),
        name: z.string().min(1),
      }),
    }),
  ),
  metadata: z.object({
    attribution: z.literal(
      "General Directorate for Environmental Protection (GDOŚ)",
    ),
    returnedAreaCount: z.number().int().nonnegative().max(200),
    sourceUrl: z.literal(
      "https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych",
    ),
    truncated: z.boolean(),
  }),
});

export type ProtectedAreas = z.infer<typeof protectedAreasSchema>;
export type ProtectedAreaCategory = z.infer<typeof protectedAreaCategorySchema>;
