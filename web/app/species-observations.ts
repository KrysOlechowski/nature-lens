import { z } from "zod";
import { environment } from "../env";
import { polandBoundingBox } from "../lib/poland-bounds";

const observationGeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ]),
      }),
      properties: z.object({
        observedOn: z.string().nullable(),
        observedAt: z.string().nullable(),
        accuracyMeters: z.number().nonnegative().nullable(),
        locationPrecision: z.enum(["approximate", "limited", "unknown"]),
        locationPrivacy: z.enum(["open", "obscured", "private", "unknown"]),
        source: z.object({
          provider: z.string(),
          url: z.url({ protocol: /^https?$/ }),
        }),
      }),
    }),
  ),
  metadata: z.object({
    datasetScope: z.literal("locally-synchronized"),
    truncated: z.boolean(),
  }),
});

export type SpeciesObservationGeoJson = z.infer<
  typeof observationGeoJsonSchema
>;

export type SpeciesObservationsResponse =
  | {
      status: "success";
      observations: SpeciesObservationGeoJson;
    }
  | {
      status: "unavailable";
    };

const bootstrapPageSize = "200";
const maximumMapObservations = "1000";

export async function getSpeciesObservations(
  speciesId: string,
): Promise<SpeciesObservationsResponse> {
  await bootstrapSpeciesObservations(speciesId);

  try {
    const url = createObservationsUrl(speciesId);
    const { west, south, east, north } = polandBoundingBox;

    url.searchParams.set("bbox", `${west},${south},${east},${north}`);
    url.searchParams.set("limit", maximumMapObservations);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const observations = observationGeoJsonSchema.safeParse(
      await response.json(),
    );

    if (!observations.success) {
      return { status: "unavailable" };
    }

    return { status: "success", observations: observations.data };
  } catch {
    return { status: "unavailable" };
  }
}

async function bootstrapSpeciesObservations(speciesId: string): Promise<void> {
  try {
    const url = createObservationsUrl(speciesId);

    url.searchParams.set("page", "1");
    url.searchParams.set("perPage", bootstrapPageSize);

    const response = await fetch(url, { cache: "no-store" });

    await response.arrayBuffer();
  } catch {
    // The spatial read may still return previously synchronized observations.
  }
}

function createObservationsUrl(speciesId: string): URL {
  return new URL(
    `/api/species/${speciesId}/observations`,
    environment.NEXT_PUBLIC_API_BASE_URL,
  );
}
