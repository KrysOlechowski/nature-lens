import { environment } from "../env";
import { polandBoundingBox } from "../lib/poland-bounds";
import {
  maximumMapObservations,
  observationGeoJsonSchema,
  type SpeciesObservationGeoJson,
} from "./species-observation-geojson";
import {
  observationSeasonalitySchema,
  type SpeciesObservationSeasonality,
} from "./species-observation-seasonality";
import {
  parseObservationSynchronization,
  type ObservationSynchronization,
} from "./species-observation-providers";

export type SpeciesObservationsResponse =
  | {
      status: "success";
      observations: SpeciesObservationGeoJson;
    }
  | {
      status: "unavailable";
    };

export type SpeciesObservationSeasonalityResponse =
  | {
      status: "success";
      seasonality: SpeciesObservationSeasonality;
    }
  | {
      status: "unavailable";
    };

export interface SpeciesObservationData {
  observations: SpeciesObservationsResponse;
  seasonality: SpeciesObservationSeasonalityResponse;
  synchronization: ObservationSynchronization;
}

const bootstrapPageSize = "200";

export async function getSpeciesObservations(
  speciesId: string,
): Promise<SpeciesObservationData> {
  const synchronization = await bootstrapSpeciesObservations(speciesId);

  const [observations, seasonality] = await Promise.all([
    getSpatialObservations(speciesId),
    getObservationSeasonality(speciesId),
  ]);

  return { observations, seasonality, synchronization };
}

async function getSpatialObservations(
  speciesId: string,
): Promise<SpeciesObservationsResponse> {
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

async function getObservationSeasonality(
  speciesId: string,
): Promise<SpeciesObservationSeasonalityResponse> {
  try {
    const response = await fetch(
      new URL(
        `/api/species/${speciesId}/observation-seasonality`,
        environment.NEXT_PUBLIC_API_BASE_URL,
      ),
      { cache: "no-store" },
    );

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const seasonality = observationSeasonalitySchema.safeParse(
      await response.json(),
    );

    if (!seasonality.success) {
      return { status: "unavailable" };
    }

    return { status: "success", seasonality: seasonality.data };
  } catch {
    return { status: "unavailable" };
  }
}

async function bootstrapSpeciesObservations(
  speciesId: string,
): Promise<ObservationSynchronization> {
  try {
    const url = createObservationsUrl(speciesId);

    url.searchParams.set("page", "1");
    url.searchParams.set("perPage", bootstrapPageSize);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      await response.arrayBuffer();

      return { status: "unavailable" };
    }

    return parseObservationSynchronization(await response.json());
  } catch {
    // The spatial read may still return previously synchronized observations.
    return { status: "unavailable" };
  }
}

function createObservationsUrl(speciesId: string): URL {
  return new URL(
    `/api/species/${speciesId}/observations`,
    environment.NEXT_PUBLIC_API_BASE_URL,
  );
}
