import { z } from "zod";
import { INaturalistIntegrationError } from "./inaturalist-integration.error.js";

const iNaturalistTaxonSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  preferred_common_name: z.string().min(1).optional(),
  rank: z.string().min(1),
});

const iNaturalistTaxaResponseSchema = z.object({
  results: z.array(iNaturalistTaxonSchema),
});

const iNaturalistObservationSchema = z.object({
  id: z.number().int().positive(),
  observed_on: z.iso.date().nullable(),
  time_observed_at: z.iso.datetime({ offset: true }).nullable(),
  positional_accuracy: z.number().nonnegative().nullable(),
  public_positional_accuracy: z.number().nonnegative().nullable(),
  geojson: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
      ]),
    })
    .nullable(),
  geoprivacy: z.enum(["open", "obscured", "private"]).nullable(),
  taxon_geoprivacy: z.enum(["open", "obscured", "private"]).nullable(),
  obscured: z.boolean(),
  uri: z.url(),
  license_code: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value ?? null),
});

const iNaturalistObservationsResponseSchema = z.object({
  total_results: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  per_page: z.number().int().min(1).max(200),
  results: z.array(iNaturalistObservationSchema),
});

export type INaturalistTaxaResponse = z.infer<
  typeof iNaturalistTaxaResponseSchema
>;

export type INaturalistObservationsResponse = z.infer<
  typeof iNaturalistObservationsResponseSchema
>;

export function parseINaturalistTaxaResponse(
  response: unknown,
): INaturalistTaxaResponse {
  const result = iNaturalistTaxaResponseSchema.safeParse(response);

  if (!result.success) {
    throw new INaturalistIntegrationError(
      "iNaturalist returned an invalid taxa response",
      { cause: result.error },
    );
  }

  return result.data;
}

export function parseINaturalistObservationsResponse(
  response: unknown,
): INaturalistObservationsResponse {
  const result = iNaturalistObservationsResponseSchema.safeParse(response);

  if (!result.success) {
    throw new INaturalistIntegrationError(
      "iNaturalist returned an invalid observations response",
      { cause: result.error },
    );
  }

  return result.data;
}
