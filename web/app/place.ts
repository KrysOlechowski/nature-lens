import { z } from "zod";

export const placeTypeSchema = z.enum([
  "city",
  "town",
  "village",
  "administrative-area",
  "natural-area",
  "other",
]);

const longitudeSchema = z.number().min(-180).max(180);
const latitudeSchema = z.number().min(-90).max(90);

const placeCenterSchema = z.object({
  longitude: longitudeSchema,
  latitude: latitudeSchema,
});

const placeBoundingBoxSchema = z
  .object({
    west: longitudeSchema,
    south: latitudeSchema,
    east: longitudeSchema,
    north: latitudeSchema,
  })
  .refine(({ west, east }) => west <= east, {
    message: "Place bounding box west must not exceed east",
  })
  .refine(({ south, north }) => south <= north, {
    message: "Place bounding box south must not exceed north",
  });

export const placeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
  type: placeTypeSchema,
  center: placeCenterSchema,
  bbox: placeBoundingBoxSchema.nullable(),
});

export const placeSearchResponseSchema = z.array(placeSchema);

export type Place = z.infer<typeof placeSchema>;
