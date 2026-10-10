import { z } from "zod";
import { GBIFIntegrationError } from "./gbif-integration.error.js";

const gbifOccurrenceSchema = z
  .object({
    key: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    eventDate: z.string().min(1).nullish(),
    decimalLatitude: z.number().min(-90).max(90).nullish(),
    decimalLongitude: z.number().min(-180).max(180).nullish(),
    coordinateUncertaintyInMeters: z.number().nonnegative().nullish(),
  })
  .superRefine((occurrence, context) => {
    const hasLatitude = occurrence.decimalLatitude != null;
    const hasLongitude = occurrence.decimalLongitude != null;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "GBIF occurrence coordinates must be provided together",
        path: hasLatitude ? ["decimalLongitude"] : ["decimalLatitude"],
      });
    }
  });

const gbifOccurrencesResponseSchema = z.object({
  offset: z.number().int().nonnegative().max(100_000),
  limit: z.number().int().min(1).max(300),
  count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  results: z.array(gbifOccurrenceSchema),
});

export type GBIFOccurrencesResponse = z.infer<
  typeof gbifOccurrencesResponseSchema
>;

export function parseGBIFOccurrencesResponse(
  response: unknown,
): GBIFOccurrencesResponse {
  const result = gbifOccurrencesResponseSchema.safeParse(response);

  if (!result.success) {
    throw new GBIFIntegrationError(
      "GBIF returned an invalid occurrences response",
      { cause: result.error },
    );
  }

  return result.data;
}
