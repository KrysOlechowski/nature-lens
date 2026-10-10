import { z } from "zod";
import { GBIFIntegrationError } from "./gbif-integration.error.js";

const gbifOccurrenceSchema = z
  .object({
    key: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    eventDate: z.string().min(1).nullish(),
    decimalLatitude: z.number().min(-90).max(90).nullish(),
    decimalLongitude: z.number().min(-180).max(180).nullish(),
    coordinateUncertaintyInMeters: z.number().nonnegative().nullish(),
    license: z.string().min(1).nullish(),
    datasetKey: z.uuid().nullish(),
    datasetTitle: z.string().min(1).nullish(),
    publishingOrgKey: z.uuid().nullish(),
    publisher: z.string().min(1).nullish(),
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

const gbifBackboneKeySchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);

const gbifTaxonUsageSchema = z.object({
  key: gbifBackboneKeySchema,
  canonicalName: z.string().min(1),
  rank: z.string().min(1),
});

const gbifTaxonMatchResponseSchema = z
  .object({
    usage: gbifTaxonUsageSchema.optional(),
    acceptedUsage: gbifTaxonUsageSchema.optional(),
    synonym: z.boolean(),
    diagnostics: z.object({
      matchType: z.enum(["EXACT", "FUZZY", "HIGHERRANK", "NONE"]),
      confidence: z.number().int().min(0).max(100),
    }),
  })
  .superRefine((match, context) => {
    if (match.diagnostics.matchType === "NONE") {
      if (match.usage !== undefined || match.acceptedUsage !== undefined) {
        context.addIssue({
          code: "custom",
          message: "A GBIF no-match response cannot contain taxon usages",
        });
      }

      if (match.synonym) {
        context.addIssue({
          code: "custom",
          message: "A GBIF no-match response cannot be a synonym",
          path: ["synonym"],
        });
      }

      return;
    }

    if (match.usage === undefined) {
      context.addIssue({
        code: "custom",
        message: "A GBIF taxon match must contain a matched usage",
        path: ["usage"],
      });
    }

    if (match.synonym && match.acceptedUsage === undefined) {
      context.addIssue({
        code: "custom",
        message: "A GBIF synonym match must contain an accepted usage",
        path: ["acceptedUsage"],
      });
    }
  });

export type GBIFOccurrencesResponse = z.infer<
  typeof gbifOccurrencesResponseSchema
>;

export type GBIFTaxonMatchResponse = z.infer<
  typeof gbifTaxonMatchResponseSchema
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

export function parseGBIFTaxonMatchResponse(
  response: unknown,
): GBIFTaxonMatchResponse {
  const result = gbifTaxonMatchResponseSchema.safeParse(response);

  if (!result.success) {
    throw new GBIFIntegrationError("GBIF returned an invalid taxon match", {
      cause: result.error,
    });
  }

  return result.data;
}
