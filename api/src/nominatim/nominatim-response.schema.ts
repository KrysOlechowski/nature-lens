import { z } from "zod";
import { NominatimIntegrationError } from "./nominatim-integration.error.js";

const latitudeSchema = numericStringSchema(-90, 90);
const longitudeSchema = numericStringSchema(-180, 180);

const boundingBoxSchema = z
  .tuple([latitudeSchema, latitudeSchema, longitudeSchema, longitudeSchema])
  .refine(
    ([south, north, west, east]) => south <= north && west <= east,
    "Nominatim bounding box coordinates are not ordered",
  );

const nominatimPlaceSchema = z.object({
  osm_type: z.enum(["node", "way", "relation"]).optional(),
  osm_id: z.number().int().positive().safe().optional(),
  lat: latitudeSchema,
  lon: longitudeSchema,
  category: z.string().min(1),
  type: z.string().min(1),
  display_name: z.string().min(1),
  name: z.string().min(1).optional(),
  boundingbox: boundingBoxSchema,
});

const nominatimLookupPlaceSchema = nominatimPlaceSchema.extend({
  address: z
    .object({
      country_code: z.string().trim().toLowerCase().optional(),
    })
    .optional(),
});

const nominatimSearchResponseSchema = z.array(nominatimPlaceSchema);
const nominatimLookupResponseSchema = z.array(nominatimLookupPlaceSchema);

export type NominatimPlaceResult = z.infer<typeof nominatimPlaceSchema>;
export type NominatimLookupPlaceResult = z.infer<
  typeof nominatimLookupPlaceSchema
>;

export function parseNominatimSearchResponse(
  response: unknown,
): NominatimPlaceResult[] {
  const result = nominatimSearchResponseSchema.safeParse(response);

  if (!result.success) {
    throw new NominatimIntegrationError(
      "OpenStreetMap Nominatim returned an invalid search response",
      { cause: result.error },
    );
  }

  return result.data;
}

export function parseNominatimLookupResponse(
  response: unknown,
): NominatimLookupPlaceResult[] {
  const result = nominatimLookupResponseSchema.safeParse(response);

  if (!result.success) {
    throw new NominatimIntegrationError(
      "OpenStreetMap Nominatim returned an invalid lookup response",
      { cause: result.error },
    );
  }

  return result.data;
}

function numericStringSchema(minimum: number, maximum: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .pipe(z.number().finite().min(minimum).max(maximum));
}
