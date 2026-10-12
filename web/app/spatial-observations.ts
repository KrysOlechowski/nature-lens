import { z } from "zod";
import {
  maximumMapObservations,
  observationGeoJsonPropertiesSchema,
} from "./species-observation-geojson";

export { maximumMapObservations };
export const maximumListedSpecies = "25";

const spatialObservationSpeciesSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  scientificName: z.string().min(1),
  displayName: z.string().min(1),
});

const spatialObservationFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  }),
  properties: observationGeoJsonPropertiesSchema.extend({
    species: spatialObservationSpeciesSchema,
  }),
});

export const spatialObservationsSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(spatialObservationFeatureSchema),
    species: z.object({
      items: z.array(
        spatialObservationSpeciesSchema.extend({
          observationCount: z.number().int().nonnegative(),
        }),
      ),
      returnedCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      truncated: z.boolean(),
    }),
    metadata: z.object({
      datasetScope: z.literal("locally-synchronized"),
      returnedObservationCount: z.number().int().nonnegative(),
      totalObservationCount: z.number().int().nonnegative(),
      truncated: z.boolean(),
    }),
  })
  .superRefine((collection, context) => {
    if (
      collection.metadata.returnedObservationCount !==
        collection.features.length ||
      collection.metadata.totalObservationCount < collection.features.length ||
      collection.metadata.truncated !==
        collection.features.length < collection.metadata.totalObservationCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Observation count metadata is inconsistent",
        path: ["metadata"],
      });
    }

    if (
      collection.species.returnedCount !== collection.species.items.length ||
      collection.species.totalCount < collection.species.items.length ||
      collection.species.truncated !==
        collection.species.items.length < collection.species.totalCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Species list metadata is inconsistent",
        path: ["species"],
      });
    }
  });

export type SpatialObservations = z.infer<typeof spatialObservationsSchema>;
