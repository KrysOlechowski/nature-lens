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

export type INaturalistTaxaResponse = z.infer<
  typeof iNaturalistTaxaResponseSchema
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
