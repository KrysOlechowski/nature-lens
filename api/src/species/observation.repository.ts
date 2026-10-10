import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service.js";
import type {
  GroupedSpeciesObservation,
  ObservationDeduplicationMethod,
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
  ObservationLicense,
  ObservationSource,
  SpeciesObservation,
  SpeciesObservationPageData,
  StoredSpeciesObservationPage,
} from "./species-observation.model.js";

interface PersistedObservationInput {
  provider: string;
  external_id: string;
  deduplication_key: string;
  deduplication_method: ObservationDeduplicationMethod;
  observed_on: string | null;
  observed_at: string | null;
  longitude: number | null;
  latitude: number | null;
  positional_accuracy_meters: number | null;
  location_obscured: boolean | null;
  location_privacy: ObservationLocationPrivacy;
  location_precision: ObservationLocationPrecision | null;
  source_url: string;
  license_code: string | null;
  license_url: string | null;
  dataset_external_id: string | null;
  dataset_title: string | null;
  dataset_url: string | null;
  publisher_external_id: string | null;
  publisher_name: string | null;
}

interface PersistedObservationIdRow {
  id: string;
  provider: string;
  external_id: string;
}

interface PersistedObservationRow {
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
  deduplication_key: string | null;
  deduplication_method: ObservationDeduplicationMethod | null;
  source_url: string | null;
  license_code: string | null;
  license_url: string | null;
  dataset_external_id: string | null;
  dataset_title: string | null;
  dataset_url: string | null;
  publisher_external_id: string | null;
  publisher_name: string | null;
}

interface PersistedGroupedObservationRow {
  observation_id: string;
  deduplication_key: string;
  observed_on: string | null;
  observed_at: Date | null;
  longitude: number;
  latitude: number;
  positional_accuracy_meters: number | null;
  location_privacy: ObservationLocationPrivacy;
  location_precision: ObservationLocationPrecision;
  source_provider: string;
  source_external_id: string;
  source_url: string;
  source_license_code: string | null;
  source_license_url: string | null;
  source_dataset_external_id: string | null;
  source_dataset_title: string | null;
  source_dataset_url: string | null;
  source_publisher_external_id: string | null;
  source_publisher_name: string | null;
}

interface PersistedObservationPageRow extends PersistedObservationRow {
  total_results: number;
  page: number;
  per_page: number;
  last_successful_sync_at: Date;
}

interface SyncIdRow {
  id: string;
  last_successful_sync_at: Date;
}

export interface ObservationPageKey {
  page: number;
  perPage: number;
}

export interface ObservationBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ObservationBoundingBoxResult {
  observations: GroupedSpeciesObservation[];
  truncated: boolean;
}

export const MAX_BOUNDING_BOX_OBSERVATIONS = 1_000;

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
          observation.deduplication_key,
          observation.deduplication_method,
          observation.source_url,
          observation.license_code,
          observation.license_url,
          observation.dataset_external_id,
          observation.dataset_title,
          observation.dataset_url,
          observation.publisher_external_id,
          observation.publisher_name
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

  async findWithinBoundingBox(
    speciesId: string,
    boundingBox: ObservationBoundingBox,
    limit: number,
  ): Promise<ObservationBoundingBoxResult> {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_BOUNDING_BOX_OBSERVATIONS
    ) {
      throw new RangeError(
        `Bounding-box observation limit must be an integer between 1 and ${MAX_BOUNDING_BOX_OBSERVATIONS}`,
      );
    }

    const result = await this.database.query<PersistedGroupedObservationRow>(
      `
        WITH bounds AS (
          SELECT extensions.ST_MakeEnvelope($2, $3, $4, $5, 4326) AS geometry
        ),
        ranked_observations AS (
          SELECT
            observation.*,
            row_number() OVER (
              PARTITION BY observation.species_id, observation.deduplication_key
              ORDER BY
                CASE WHEN observation.provider = 'iNaturalist' THEN 0 ELSE 1 END,
                observation.id
            ) AS representative_rank
          FROM observations AS observation
          WHERE observation.species_id = $1
        ),
        bounded_groups AS (
          SELECT representative.*
          FROM ranked_observations AS representative
          CROSS JOIN bounds
          WHERE representative.representative_rank = 1
            AND representative.location IS NOT NULL
            AND representative.location OPERATOR(extensions.&&) bounds.geometry
            AND extensions.ST_Intersects(
              representative.location,
              bounds.geometry
            )
          ORDER BY
            COALESCE(
              representative.observed_on,
              representative.observed_at::date
            ) DESC NULLS LAST,
            representative.observed_at DESC NULLS LAST,
            representative.id DESC
          LIMIT $6
        )
        SELECT
          representative.id::text AS observation_id,
          representative.deduplication_key,
          representative.observed_on::text,
          representative.observed_at,
          extensions.ST_X(representative.location) AS longitude,
          extensions.ST_Y(representative.location) AS latitude,
          representative.positional_accuracy_meters,
          representative.location_privacy,
          representative.location_precision,
          source.provider AS source_provider,
          source.external_id AS source_external_id,
          source.source_url,
          source.license_code AS source_license_code,
          source.license_url AS source_license_url,
          source.dataset_external_id AS source_dataset_external_id,
          source.dataset_title AS source_dataset_title,
          source.dataset_url AS source_dataset_url,
          source.publisher_external_id AS source_publisher_external_id,
          source.publisher_name AS source_publisher_name
        FROM bounded_groups AS representative
        INNER JOIN observations AS source
          ON source.species_id = representative.species_id
          AND source.deduplication_key = representative.deduplication_key
        ORDER BY
          COALESCE(
            representative.observed_on,
            representative.observed_at::date
          ) DESC NULLS LAST,
          representative.observed_at DESC NULLS LAST,
          representative.id DESC,
          CASE WHEN source.provider = 'iNaturalist' THEN 0 ELSE 1 END,
          source.id
      `,
      [
        speciesId,
        boundingBox.west,
        boundingBox.south,
        boundingBox.east,
        boundingBox.north,
        limit + 1,
      ],
    );

    const observations = toGroupedSpeciesObservations(result.rows);

    return {
      observations: observations.slice(0, limit),
      truncated: observations.length > limit,
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
          deduplication_key,
          deduplication_method,
          observed_on,
          observed_at,
          location,
          positional_accuracy_meters,
          location_obscured,
          location_privacy,
          location_precision,
          source_url,
          license_code,
          license_url,
          dataset_external_id,
          dataset_title,
          dataset_url,
          publisher_external_id,
          publisher_name
        )
        SELECT
          $1::bigint,
          input.provider,
          input.external_id,
          input.deduplication_key,
          input.deduplication_method,
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
          input.source_url,
          input.license_code,
          input.license_url,
          input.dataset_external_id,
          input.dataset_title,
          input.dataset_url,
          input.publisher_external_id,
          input.publisher_name
        FROM jsonb_to_recordset($2::jsonb) AS input (
          provider text,
          external_id text,
          deduplication_key text,
          deduplication_method text,
          observed_on date,
          observed_at timestamp with time zone,
          longitude double precision,
          latitude double precision,
          positional_accuracy_meters double precision,
          location_obscured boolean,
          location_privacy text,
          location_precision text,
          source_url text,
          license_code text,
          license_url text,
          dataset_external_id text,
          dataset_title text,
          dataset_url text,
          publisher_external_id text,
          publisher_name text
        )
        ON CONFLICT (provider, external_id)
        DO UPDATE SET
          species_id = EXCLUDED.species_id,
          deduplication_key = EXCLUDED.deduplication_key,
          deduplication_method = EXCLUDED.deduplication_method,
          observed_on = EXCLUDED.observed_on,
          observed_at = EXCLUDED.observed_at,
          location = EXCLUDED.location,
          positional_accuracy_meters = EXCLUDED.positional_accuracy_meters,
          location_obscured = EXCLUDED.location_obscured,
          location_privacy = EXCLUDED.location_privacy,
          location_precision = EXCLUDED.location_precision,
          source_url = EXCLUDED.source_url,
          license_code = COALESCE(
            EXCLUDED.license_code,
            observations.license_code
          ),
          license_url = COALESCE(
            EXCLUDED.license_url,
            observations.license_url
          ),
          dataset_external_id = COALESCE(
            EXCLUDED.dataset_external_id,
            observations.dataset_external_id
          ),
          dataset_title = CASE
            WHEN EXCLUDED.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS DISTINCT FROM EXCLUDED.dataset_external_id
              THEN EXCLUDED.dataset_title
            ELSE COALESCE(EXCLUDED.dataset_title, observations.dataset_title)
          END,
          dataset_url = CASE
            WHEN EXCLUDED.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS DISTINCT FROM EXCLUDED.dataset_external_id
              THEN EXCLUDED.dataset_url
            ELSE COALESCE(EXCLUDED.dataset_url, observations.dataset_url)
          END,
          publisher_external_id = CASE
            WHEN EXCLUDED.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS DISTINCT FROM EXCLUDED.dataset_external_id
              THEN EXCLUDED.publisher_external_id
            ELSE COALESCE(
              EXCLUDED.publisher_external_id,
              observations.publisher_external_id
            )
          END,
          publisher_name = CASE
            WHEN EXCLUDED.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS NOT NULL
              AND observations.dataset_external_id IS DISTINCT FROM EXCLUDED.dataset_external_id
              THEN EXCLUDED.publisher_name
            ELSE COALESCE(EXCLUDED.publisher_name, observations.publisher_name)
          END
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
  row: PersistedObservationRow,
): SpeciesObservation[] {
  if (
    row.observation_id === null ||
    row.provider === null ||
    row.external_id === null ||
    row.deduplication_key === null ||
    row.deduplication_method === null ||
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
      deduplication: {
        key: row.deduplication_key,
        method: row.deduplication_method,
      },
      source: {
        provider: row.provider,
        externalId: row.external_id,
        url: row.source_url,
        license: toObservationLicense(row.license_code, row.license_url),
        dataset:
          row.dataset_external_id !== null ||
          row.dataset_title !== null ||
          row.dataset_url !== null ||
          row.publisher_external_id !== null ||
          row.publisher_name !== null
            ? {
                externalId: row.dataset_external_id,
                title: row.dataset_title,
                url: row.dataset_url,
                publisher:
                  row.publisher_external_id !== null ||
                  row.publisher_name !== null
                    ? {
                        externalId: row.publisher_external_id,
                        name: row.publisher_name,
                      }
                    : null,
              }
            : null,
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
    deduplication_key: observation.deduplication.key,
    deduplication_method: observation.deduplication.method,
    observed_on: observation.observedOn,
    observed_at: observation.observedAt,
    longitude: observation.location?.longitude ?? null,
    latitude: observation.location?.latitude ?? null,
    positional_accuracy_meters: observation.location?.accuracyMeters ?? null,
    location_obscured: toLocationObscured(observation.locationPrivacy),
    location_privacy: observation.locationPrivacy,
    location_precision: observation.location?.precision ?? null,
    source_url: observation.source.url,
    license_code: observation.source.license?.code ?? null,
    license_url: observation.source.license?.url ?? null,
    dataset_external_id: observation.source.dataset?.externalId ?? null,
    dataset_title: observation.source.dataset?.title ?? null,
    dataset_url: observation.source.dataset?.url ?? null,
    publisher_external_id:
      observation.source.dataset?.publisher?.externalId ?? null,
    publisher_name: observation.source.dataset?.publisher?.name ?? null,
  };
}

function toGroupedSpeciesObservations(
  rows: PersistedGroupedObservationRow[],
): GroupedSpeciesObservation[] {
  const observations = new Map<string, GroupedSpeciesObservation>();

  for (const row of rows) {
    const existing = observations.get(row.deduplication_key);
    const source = toObservationSource({
      provider: row.source_provider,
      externalId: row.source_external_id,
      url: row.source_url,
      licenseCode: row.source_license_code,
      licenseUrl: row.source_license_url,
      datasetExternalId: row.source_dataset_external_id,
      datasetTitle: row.source_dataset_title,
      datasetUrl: row.source_dataset_url,
      publisherExternalId: row.source_publisher_external_id,
      publisherName: row.source_publisher_name,
    });

    if (existing) {
      existing.sources.push(source);
      continue;
    }

    observations.set(row.deduplication_key, {
      observedOn: row.observed_on,
      observedAt: row.observed_at?.toISOString() ?? null,
      location: {
        longitude: row.longitude,
        latitude: row.latitude,
        accuracyMeters: row.positional_accuracy_meters,
        precision: row.location_precision,
      },
      locationPrivacy: row.location_privacy,
      sources: [source],
    });
  }

  return [...observations.values()];
}

interface ObservationSourceFields {
  provider: string;
  externalId: string;
  url: string;
  licenseCode: string | null;
  licenseUrl: string | null;
  datasetExternalId: string | null;
  datasetTitle: string | null;
  datasetUrl: string | null;
  publisherExternalId: string | null;
  publisherName: string | null;
}

function toObservationSource(
  fields: ObservationSourceFields,
): ObservationSource {
  return {
    provider: fields.provider,
    externalId: fields.externalId,
    url: fields.url,
    license: toObservationLicense(fields.licenseCode, fields.licenseUrl),
    dataset:
      fields.datasetExternalId !== null ||
      fields.datasetTitle !== null ||
      fields.datasetUrl !== null ||
      fields.publisherExternalId !== null ||
      fields.publisherName !== null
        ? {
            externalId: fields.datasetExternalId,
            title: fields.datasetTitle,
            url: fields.datasetUrl,
            publisher:
              fields.publisherExternalId !== null ||
              fields.publisherName !== null
                ? {
                    externalId: fields.publisherExternalId,
                    name: fields.publisherName,
                  }
                : null,
          }
        : null,
  };
}

function toObservationLicense(
  code: string | null,
  url: string | null,
): ObservationLicense | null {
  if (code !== null) {
    return { code, url };
  }

  return url === null ? null : { code: null, url };
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
