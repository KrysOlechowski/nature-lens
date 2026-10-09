import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import type {
  ObservationLocationPrivacy,
  SpeciesObservation,
} from "./species-observation.model.js";

interface PersistedObservationInput {
  provider: string;
  external_id: string;
  observed_on: string | null;
  observed_at: string | null;
  longitude: number | null;
  latitude: number | null;
  positional_accuracy_meters: number | null;
  location_obscured: boolean | null;
  source_url: string;
}

@Injectable()
export class ObservationRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsertMany(
    speciesId: string,
    observations: SpeciesObservation[],
  ): Promise<void> {
    if (observations.length === 0) {
      return;
    }

    const inputs = observations.map(toPersistedObservationInput);

    await this.database.withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO observations (
            species_id,
            provider,
            external_id,
            observed_on,
            observed_at,
            location,
            positional_accuracy_meters,
            location_obscured,
            source_url
          )
          SELECT
            $1::bigint,
            input.provider,
            input.external_id,
            input.observed_on,
            input.observed_at,
            CASE
              WHEN input.longitude IS NULL OR input.latitude IS NULL THEN NULL
              ELSE extensions.ST_SetSRID(
                extensions.ST_MakePoint(input.longitude, input.latitude),
                4326
              )
            END,
            input.positional_accuracy_meters,
            input.location_obscured,
            input.source_url
          FROM jsonb_to_recordset($2::jsonb) AS input (
            provider text,
            external_id text,
            observed_on date,
            observed_at timestamp with time zone,
            longitude double precision,
            latitude double precision,
            positional_accuracy_meters double precision,
            location_obscured boolean,
            source_url text
          )
          ON CONFLICT (provider, external_id)
          DO UPDATE SET
            species_id = EXCLUDED.species_id,
            observed_on = EXCLUDED.observed_on,
            observed_at = EXCLUDED.observed_at,
            location = EXCLUDED.location,
            positional_accuracy_meters = EXCLUDED.positional_accuracy_meters,
            location_obscured = EXCLUDED.location_obscured,
            source_url = EXCLUDED.source_url
        `,
        [speciesId, JSON.stringify(inputs)],
      );
    });
  }
}

function toPersistedObservationInput(
  observation: SpeciesObservation,
): PersistedObservationInput {
  return {
    provider: observation.source.provider,
    external_id: observation.source.externalId,
    observed_on: observation.observedOn,
    observed_at: observation.observedAt,
    longitude: observation.location?.longitude ?? null,
    latitude: observation.location?.latitude ?? null,
    positional_accuracy_meters: observation.location?.accuracyMeters ?? null,
    location_obscured: toLocationObscured(observation.locationPrivacy),
    source_url: observation.source.url,
  };
}

function toLocationObscured(
  privacy: ObservationLocationPrivacy,
): boolean | null {
  if (privacy === "obscured" || privacy === "private") {
    return true;
  }

  if (privacy === "open") {
    return false;
  }

  return null;
}
