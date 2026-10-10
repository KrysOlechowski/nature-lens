import { z } from "zod";

export const maximumMapObservations = "1000";

const observationLicenseSchema = z
  .object({
    code: z.string().nullable(),
    url: z.url({ protocol: /^https?$/ }).nullable(),
  })
  .refine((license) => license.code !== null || license.url !== null, {
    message: "An observation license requires a code or URL",
  });

const observationSourceSchema = z.object({
  provider: z.string(),
  externalId: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  license: observationLicenseSchema.nullable(),
  dataset: z
    .object({
      externalId: z.string().nullable(),
      title: z.string().nullable(),
      url: z.url({ protocol: /^https?$/ }).nullable(),
      publisher: z
        .object({
          externalId: z.string().nullable(),
          name: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

export const observationGeoJsonPropertiesSchema = z.object({
  observedOn: z.string().nullable(),
  observedAt: z.string().nullable(),
  accuracyMeters: z.number().nonnegative().nullable(),
  locationPrecision: z.enum(["approximate", "limited", "unknown"]),
  locationPrivacy: z.enum(["open", "obscured", "private", "unknown"]),
  sources: z.array(observationSourceSchema).min(1),
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
