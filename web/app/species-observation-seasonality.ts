import { z } from "zod";

const observationSeasonalityBucketSchema = z.object({
  count: z.number().int().nonnegative(),
});

export const observationSeasonalitySchema = z
  .object({
    months: z
      .array(
        observationSeasonalityBucketSchema.extend({
          month: z.number().int().min(1).max(12),
        }),
      )
      .length(12),
    years: z.array(
      observationSeasonalityBucketSchema.extend({
        year: z.number().int(),
      }),
    ),
    undatedCount: z.number().int().nonnegative(),
    metadata: z.object({
      datasetScope: z.literal("locally-synchronized"),
    }),
  })
  .refine(
    ({ months }) => months.every(({ month }, index) => month === index + 1),
    {
      message: "Seasonality months must contain January through December",
      path: ["months"],
    },
  );

export type SpeciesObservationSeasonality = z.infer<
  typeof observationSeasonalitySchema
>;
