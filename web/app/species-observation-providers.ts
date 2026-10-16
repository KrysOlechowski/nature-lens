import { z } from "zod";

export const observationProviderStatusSchema = z.object({
  provider: z.enum(["inaturalist", "gbif"]),
  status: z.enum(["available", "stale", "unavailable"]),
});

export const observationProviderStatusesSchema = z
  .array(observationProviderStatusSchema)
  .min(1)
  .superRefine((providers, context) => {
    const providerIds = providers.map(({ provider }) => provider);

    if (new Set(providerIds).size !== providerIds.length) {
      context.addIssue({
        code: "custom",
        message: "Observation provider statuses must be unique",
      });
    }
  });

export const observationSynchronizationSchema = z.object({
  metadata: z.object({
    providers: observationProviderStatusesSchema,
  }),
});

export type ObservationProviderStatus = z.infer<
  typeof observationProviderStatusSchema
>;

export type ObservationSynchronization =
  | {
      status: "success";
      providers: ObservationProviderStatus[];
    }
  | {
      status: "unavailable";
    };

export function parseObservationSynchronization(
  responseBody: unknown,
): ObservationSynchronization {
  const synchronization =
    observationSynchronizationSchema.safeParse(responseBody);

  if (!synchronization.success) {
    return { status: "unavailable" };
  }

  return {
    status: "success",
    providers: synchronization.data.metadata.providers,
  };
}
