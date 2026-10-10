import { environment } from "../env";
import { polandBoundingBox } from "../lib/poland-bounds";
import {
  maximumMapObservations,
  observationGeoJsonSchema,
  type SpeciesObservationGeoJson,
} from "./species-observation-geojson";

export type SpeciesObservationsResponse =
  | {
      status: "success";
      observations: SpeciesObservationGeoJson;
    }
  | {
      status: "unavailable";
    };

const bootstrapPageSize = "200";

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
