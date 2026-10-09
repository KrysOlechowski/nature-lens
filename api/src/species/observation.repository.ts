import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service.js";
import type {
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
  SpeciesObservation,
  SpeciesObservationPageData,
  StoredSpeciesObservationPage,
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
  location_privacy: ObservationLocationPrivacy;
  location_precision: ObservationLocationPrecision | null;
  source_url: string;
}

interface PersistedObservationIdRow {
  id: string;
  provider: string;
  external_id: string;
}

interface PersistedObservationPageRow {
  total_results: number;
  page: number;
  per_page: number;
  last_successful_sync_at: Date;
  observation_id: string | null;
  observed_on: string | null;
  observed_at: Date | null;
  longitude: number | null;
  latitude: number | null;
  positional_accuracy_meters: number | null;
  location_privacy: ObservationLocationPrivacy | null;
  location_precision: ObservationLocationPrecision | null;
  provider: string | null;
  external_id: string | null;
  source_url: string | null;
}

interface SyncIdRow {
  id: string;
  last_successful_sync_at: Date;
}

export interface ObservationPageKey {
  page: number;
  perPage: number;
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

    await this.database.withTransaction(async (client) => {
      await this.upsertManyWithClient(client, speciesId, observations);
    });
  }

  async findPage(
    speciesId: string,
    provider: string,
    pagination: ObservationPageKey,
  ): Promise<StoredSpeciesObservationPage | null> {
    const result = await this.database.query<PersistedObservationPageRow>(
      `
        SELECT
          sync.total_results,
          sync.page,
          sync.per_page,
          sync.last_successful_sync_at,
          observation.id::text AS observation_id,
          observation.observed_on::text,
          observation.observed_at,
          extensions.ST_X(observation.location) AS longitude,
          extensions.ST_Y(observation.location) AS latitude,
          observation.positional_accuracy_meters,
          observation.location_privacy,
          observation.location_precision,
          observation.provider,
          observation.external_id,
          observation.source_url
        FROM observation_page_syncs AS sync
        LEFT JOIN observation_page_sync_items AS item
          ON item.sync_id = sync.id
        LEFT JOIN observations AS observation
          ON observation.id = item.observation_id
        WHERE sync.species_id = $1
          AND sync.provider = $2
          AND sync.page = $3
          AND sync.per_page = $4
        ORDER BY item.position
      `,
      [speciesId, provider, pagination.page, pagination.perPage],
    );
    const metadata = result.rows[0];

    if (!metadata) {
      return null;
    }

    return {
      totalResults: metadata.total_results,
      page: metadata.page,
      perPage: metadata.per_page,
      lastSuccessfulSyncAt: metadata.last_successful_sync_at.toISOString(),
      results: result.rows.flatMap(toSpeciesObservation),
    };
  }

  async replacePage(
    speciesId: string,
    provider: string,
    page: SpeciesObservationPageData,
  ): Promise<StoredSpeciesObservationPage> {
    const lastSuccessfulSyncAt = await this.database.withTransaction(
      async (client) => {
        const observationIds = await this.upsertManyWithClient(
          client,
          speciesId,
          page.results,
        );
        const syncResult = await client.query<SyncIdRow>(
          `
            INSERT INTO observation_page_syncs (
              species_id,
              provider,
              page,
              per_page,
              total_results,
              last_successful_sync_at
            )
            VALUES ($1, $2, $3, $4, $5, clock_timestamp())
            ON CONFLICT (species_id, provider, page, per_page)
            DO UPDATE SET
              total_results = EXCLUDED.total_results,
              last_successful_sync_at = clock_timestamp()
            RETURNING id::text, last_successful_sync_at
          `,
          [speciesId, provider, page.page, page.perPage, page.totalResults],
        );
        const sync = syncResult.rows[0];

        if (!sync) {
          throw new Error("Observation page sync did not return an identifier");
        }

        await client.query(
          `
            DELETE FROM observation_page_sync_items
            WHERE sync_id = $1
          `,
          [sync.id],
        );

        if (observationIds.length > 0) {
          await client.query(
            `
              INSERT INTO observation_page_sync_items (
                sync_id,
                observation_id,
                position
              )
              SELECT
                $1::bigint,
                item.observation_id,
                item.position - 1
              FROM unnest($2::bigint[]) WITH ORDINALITY AS item(
                observation_id,
                position
              )
            `,
            [sync.id, observationIds],
          );
        }

        return sync.last_successful_sync_at.toISOString();
      },
    );

    return {
      ...page,
      lastSuccessfulSyncAt,
    };
  }

  private async upsertManyWithClient(
    client: PoolClient,
    speciesId: string,
    observations: SpeciesObservation[],
  ): Promise<string[]> {
    if (observations.length === 0) {
      return [];
    }

    const inputs = observations.map(toPersistedObservationInput);
    const result = await client.query<PersistedObservationIdRow>(
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
          location_privacy,
          location_precision,
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
          input.location_privacy,
          input.location_precision,
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
          location_privacy text,
          location_precision text,
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
          location_privacy = EXCLUDED.location_privacy,
          location_precision = EXCLUDED.location_precision,
          source_url = EXCLUDED.source_url
        RETURNING id::text, provider, external_id
      `,
      [speciesId, JSON.stringify(inputs)],
    );
    const idsBySource = new Map(
      result.rows.map((row) => [
        toSourceKey(row.provider, row.external_id),
        row.id,
      ]),
    );

    return observations.map((observation) => {
      const id = idsBySource.get(
        toSourceKey(observation.source.provider, observation.source.externalId),
      );

      if (!id) {
        throw new Error("Observation upsert did not return an identifier");
      }

      return id;
    });
  }
}

function toSpeciesObservation(
  row: PersistedObservationPageRow,
): SpeciesObservation[] {
  if (
    row.observation_id === null ||
    row.provider === null ||
    row.external_id === null ||
    row.source_url === null ||
    row.location_privacy === null
  ) {
    return [];
  }

  const hasLocation = row.longitude !== null && row.latitude !== null;

  if (hasLocation && row.location_precision === null) {
    throw new Error("Persisted observation location precision is missing");
  }

  return [
    {
      observedOn: row.observed_on,
      observedAt: row.observed_at?.toISOString() ?? null,
      location: hasLocation
        ? {
            longitude: row.longitude!,
            latitude: row.latitude!,
            accuracyMeters: row.positional_accuracy_meters,
            precision: row.location_precision!,
          }
        : null,
      locationPrivacy: row.location_privacy,
      source: {
        provider: row.provider,
        externalId: row.external_id,
        url: row.source_url,
      },
    },
  ];
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
    location_privacy: observation.locationPrivacy,
    location_precision: observation.location?.precision ?? null,
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

function toSourceKey(provider: string, externalId: string): string {
  return `${provider}\u0000${externalId}`;
}
