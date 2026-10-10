import { z } from "zod";

export const maximumMapObservations = "1000";

export const observationGeoJsonPropertiesSchema = z.object({
  observedOn: z.string().nullable(),
  observedAt: z.string().nullable(),
  accuracyMeters: z.number().nonnegative().nullable(),
  locationPrecision: z.enum(["approximate", "limited", "unknown"]),
  locationPrivacy: z.enum(["open", "obscured", "private", "unknown"]),
  source: z.object({
    provider: z.string(),
    url: z.url({ protocol: /^https?$/ }),
  }),
});

export const observationGeoJsonFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }),
  properties: observationGeoJsonPropertiesSchema,
});

export const observationGeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(observationGeoJsonFeatureSchema),
  metadata: z.object({
    datasetScope: z.literal("locally-synchronized"),
    truncated: z.boolean(),
  }),
});

export type SpeciesObservationGeoJson = z.infer<
  typeof observationGeoJsonSchema
>;
