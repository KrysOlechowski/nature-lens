import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { DatabaseService } from "../src/database/database.service.js";
import { ObservationRepository } from "../src/species/observation.repository.js";
import type { SpeciesObservation } from "../src/species/species-observation.model.js";
import type { SpeciesProviderMappingResolution } from "../src/species/species-identity.model.js";
import type { NormalizedSpecies } from "../src/species/species-search-result.model.js";
import {
  SpeciesProviderMappingConflictError,
  SpeciesRepository,
} from "../src/species/species.repository.js";
import {
  startTestDatabase,
  type TestDatabase,
} from "./database-test-environment.js";

interface PersistedObservation {
  external_id: string;
  latitude: number;
  location_obscured: boolean | null;
  longitude: number;
  provider: string;
  scientific_name: string;
  srid: number;
}

function createSpecies(
  overrides: Partial<NormalizedSpecies> = {},
): NormalizedSpecies {
  return {
    scientificName: "Alces alces",
    commonName: "Moose",
    displayName: "Moose",
    taxonomy: {
      rank: "species",
    },
    source: {
      provider: "iNaturalist",
      externalId: "522194",
    },
    ...overrides,
  };
}

type ObservationOverrides = Omit<Partial<SpeciesObservation>, "source"> & {
  source?: Partial<SpeciesObservation["source"]>;
};

function createObservation(
  overrides: ObservationOverrides = {},
): SpeciesObservation {
  const observation: SpeciesObservation = {
    observedOn: "2026-10-03",
    observedAt: "2026-10-03T14:45:26.000Z",
    location: {
      latitude: 53.4029839302,
      longitude: 23.2064155596,
      accuracyMeters: 25_876,
      precision: "limited",
    },
    locationPrivacy: "obscured",
    deduplication: {
      key: "inaturalist:405566287",
      method: "provider-record-id",
    },
    source: {
      provider: "iNaturalist",
      externalId: "405566287",
      url: "https://www.inaturalist.org/observations/405566287",
      license: {
        code: "cc-by-nc",
        url: null,
      },
      dataset: null,
    },
  };

  const source = {
    ...observation.source,
    ...overrides.source,
  };

  return {
    ...observation,
    ...overrides,
    deduplication: overrides.deduplication ?? {
      key: `${source.provider === "iNaturalist" ? "inaturalist" : source.provider.toLowerCase()}:${source.externalId}`,
      method: "provider-record-id",
    },
    source,
  };
}

function toGroupedObservation(observation: SpeciesObservation) {
  return {
    observedOn: observation.observedOn,
    observedAt: observation.observedAt,
    location: observation.location,
    locationPrivacy: observation.locationPrivacy,
    sources: [observation.source],
  };
}

function createGBIFResolution(
  overrides: Partial<SpeciesProviderMappingResolution> = {},
): SpeciesProviderMappingResolution {
  return {
    provider: "GBIF",
    externalId: "2441184",
    resolutionMethod: "gbif-backbone-match-v2",
    resolutionContext: {
      checklistKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
      matchedUsageKey: "2441185",
      acceptedUsageKey: "2441184",
      synonym: true,
      matchType: "EXACT",
      confidence: 98,
    },
    ...overrides,
  };
}

function createTransactionDatabase(client: PoolClient): DatabaseService {
  return {
    query<ResultRow extends QueryResultRow>(
      text: string,
      values: unknown[] = [],
    ): Promise<QueryResult<ResultRow>> {
      return client.query<ResultRow>(text, values);
    },
    async withTransaction<Result>(
      operation: (transactionClient: PoolClient) => Promise<Result>,
    ): Promise<Result> {
      await client.query("SAVEPOINT species_repository_transaction");

      try {
        const result = await operation(client);
        await client.query("RELEASE SAVEPOINT species_repository_transaction");

        return result;
      } catch (error) {
        await client.query(
          "ROLLBACK TO SAVEPOINT species_repository_transaction",
        );
        await client.query("RELEASE SAVEPOINT species_repository_transaction");
        throw error;
      }
    },
  } as DatabaseService;
}

describe("database persistence", () => {
  let client: PoolClient;
  let database: TestDatabase | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
  }, 120_000);

  beforeEach(async () => {
    if (!database) {
      throw new Error("Test database did not start");
    }

    client = await database.pool.connect();
    await client.query("BEGIN");
  });

  afterEach(async () => {
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("persists and reads a species observation", async () => {
    const speciesResult = await client.query<{ id: string }>(
      `
        INSERT INTO species (scientific_name, display_name, kingdom)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      ["Alces alces", "Moose", "Animalia"],
    );
    const speciesId = speciesResult.rows[0]?.id;

    expect(speciesId).toBeDefined();

    await client.query(
      `
        INSERT INTO observations (
          species_id,
          provider,
          external_id,
          deduplication_key,
          deduplication_method,
          observed_at,
          location,
          positional_accuracy_meters,
          location_obscured,
          location_privacy,
          location_precision,
          source_url
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          extensions.ST_SetSRID(extensions.ST_MakePoint($7, $8), 4326),
          $9,
          $10,
          $11,
          $12,
          $13
        )
      `,
      [
        speciesId,
        "integration-test",
        "observation-1",
        "integration-test:observation-1",
        "provider-record-id",
        "2026-09-22T10:00:00.000Z",
        21.0122,
        52.2297,
        25,
        true,
        "obscured",
        "limited",
        "https://example.com/observations/1",
      ],
    );

    const persistedResult = await client.query<PersistedObservation>(
      `
        SELECT
          species.scientific_name,
          observations.provider,
          observations.external_id,
          observations.location_obscured,
          extensions.ST_X(observations.location) AS longitude,
          extensions.ST_Y(observations.location) AS latitude,
          extensions.ST_SRID(observations.location) AS srid
        FROM observations
        INNER JOIN species ON species.id = observations.species_id
        WHERE observations.provider = $1
          AND observations.external_id = $2
      `,
      ["integration-test", "observation-1"],
    );

    expect(persistedResult.rows).toEqual([
      {
        external_id: "observation-1",
        latitude: 52.2297,
        location_obscured: true,
        longitude: 21.0122,
        provider: "integration-test",
        scientific_name: "Alces alces",
        srid: 4326,
      },
    ]);
  });

  it("idempotently upserts a species and its provider mapping", async () => {
    const repository = new SpeciesRepository(createTransactionDatabase(client));

    const firstId = await repository.upsert(createSpecies());
    const secondId = await repository.upsert(
      createSpecies({
        commonName: "Eurasian Elk",
        displayName: "Eurasian Elk",
      }),
    );

    expect(secondId).toBe(firstId);
    await expect(repository.exists(firstId)).resolves.toBe(true);
    await expect(repository.exists("9223372036854775807")).resolves.toBe(false);
    await expect(repository.findById(firstId)).resolves.toEqual({
      id: firstId,
      scientificName: "Alces alces",
      displayName: "Eurasian Elk",
      taxonomy: {
        rank: "species",
      },
    });
    await expect(
      repository.findById("9223372036854775807"),
    ).resolves.toBeNull();

    const result = await client.query<{
      display_name: string;
      mapping_count: string;
      species_count: string;
      taxon_rank: string;
    }>(
      `
        SELECT
          species.display_name,
          species.taxon_rank,
          (
            SELECT count(*)::text
            FROM species
            WHERE scientific_name = $1
          ) AS species_count,
          (
            SELECT count(*)::text
            FROM species_provider_mappings
            WHERE provider = $2
              AND external_id = $3
          ) AS mapping_count
        FROM species
        WHERE id = $4
      `,
      ["Alces alces", "iNaturalist", "522194", firstId],
    );

    expect(result.rows).toEqual([
      {
        display_name: "Eurasian Elk",
        mapping_count: "1",
        species_count: "1",
        taxon_rank: "species",
      },
    ]);
  });

  it("associates clear provider equivalents with one species identity", async () => {
    const repository = new SpeciesRepository(createTransactionDatabase(client));
    const resolution = createGBIFResolution();
    const speciesId = await repository.upsert(createSpecies(), resolution);

    const result = await client.query<{
      external_id: string;
      provider: string;
      resolution_context: Record<string, unknown>;
      resolution_method: string;
      species_id: string;
    }>(
      `
        SELECT
          species_id::text,
          provider,
          external_id,
          resolution_method,
          resolution_context
        FROM species_provider_mappings
        WHERE species_id = $1
        ORDER BY provider, external_id
      `,
      [speciesId],
    );

    expect(result.rows).toHaveLength(2);
    expect(
      result.rows.every((mapping) => mapping.species_id === speciesId),
    ).toBe(true);
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          species_id: speciesId,
          provider: "GBIF",
          external_id: "2441184",
          resolution_method: "gbif-backbone-match-v2",
          resolution_context: expect.objectContaining({
            checklistKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
            matchedUsageKey: "2441185",
            acceptedUsageKey: "2441184",
            synonym: true,
          }),
        }),
      ]),
    );
  });

  it("does not merge ambiguous taxa by scientific name alone", async () => {
    const repository = new SpeciesRepository(createTransactionDatabase(client));
    const firstId = await repository.upsert(createSpecies());
    const secondId = await repository.upsert(
      createSpecies({
        source: {
          provider: "other-provider",
          externalId: "ambiguous-1",
        },
      }),
    );

    expect(secondId).not.toBe(firstId);

    const result = await client.query<{ species_count: string }>(
      `
        SELECT count(*)::text AS species_count
        FROM species
        WHERE scientific_name = $1
      `,
      ["Alces alces"],
    );

    expect(result.rows[0]?.species_count).toBe("2");
  });

  it("atomically upserts an idempotent observation batch", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());
    const observations = [
      createObservation(),
      createObservation({
        observedOn: "2026-10-04",
        observedAt: null,
        location: null,
        locationPrivacy: "unknown",
        source: {
          provider: "iNaturalist",
          externalId: "405566288",
          url: "https://www.inaturalist.org/observations/405566288",
        },
      }),
    ];

    await observationRepository.upsertMany(speciesId, observations);
    await observationRepository.upsertMany(speciesId, [
      createObservation({
        location: {
          latitude: 52.2297,
          longitude: 21.0122,
          accuracyMeters: 10,
          precision: "approximate",
        },
        locationPrivacy: "open",
      }),
      observations[1]!,
    ]);

    const result = await client.query<{
      external_id: string;
      latitude: number | null;
      location_obscured: boolean | null;
      longitude: number | null;
      observation_count: string;
      observed_at: Date | null;
      observed_on: string | null;
      srid: number | null;
    }>(
      `
        SELECT
          external_id,
          observed_on::text,
          observed_at,
          location_obscured,
          extensions.ST_X(location) AS longitude,
          extensions.ST_Y(location) AS latitude,
          extensions.ST_SRID(location) AS srid,
          count(*) OVER ()::text AS observation_count
        FROM observations
        WHERE species_id = $1
        ORDER BY external_id
      `,
      [speciesId],
    );

    expect(result.rows).toEqual([
      {
        external_id: "405566287",
        latitude: 52.2297,
        location_obscured: false,
        longitude: 21.0122,
        observation_count: "2",
        observed_at: new Date("2026-10-03T14:45:26.000Z"),
        observed_on: "2026-10-03",
        srid: 4326,
      },
      {
        external_id: "405566288",
        latitude: null,
        location_obscured: null,
        longitude: null,
        observation_count: "2",
        observed_at: null,
        observed_on: "2026-10-04",
        srid: null,
      },
    ]);
  });

  it("backfills provenance and preserves it across partial observation upserts", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());
    const observationWithoutProvenance = createObservation({
      source: {
        license: null,
        dataset: null,
      },
    });

    await observationRepository.upsertMany(speciesId, [
      observationWithoutProvenance,
    ]);
    await observationRepository.upsertMany(speciesId, [
      createObservation({
        source: {
          license: null,
          dataset: {
            externalId: null,
            title: "iNaturalist Research-grade Observations",
            url: null,
            publisher: {
              externalId: null,
              name: "iNaturalist",
            },
          },
        },
      }),
    ]);
    await observationRepository.upsertMany(speciesId, [
      createObservation({
        source: {
          license: {
            code: null,
            url: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
          },
          dataset: {
            externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
            title: null,
            url: "https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7",
            publisher: {
              externalId: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
              name: null,
            },
          },
        },
      }),
    ]);
    await observationRepository.upsertMany(speciesId, [
      createObservation({
        source: {
          license: null,
          dataset: {
            externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
            title: null,
            url: null,
            publisher: {
              externalId: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
              name: null,
            },
          },
        },
      }),
    ]);

    const result = await client.query<{
      dataset_external_id: string | null;
      dataset_title: string | null;
      dataset_url: string | null;
      license_code: string | null;
      license_url: string | null;
      publisher_external_id: string | null;
      publisher_name: string | null;
    }>(
      `
        SELECT
          license_code,
          license_url,
          dataset_external_id,
          dataset_title,
          dataset_url,
          publisher_external_id,
          publisher_name
        FROM observations
        WHERE provider = $1
          AND external_id = $2
      `,
      ["iNaturalist", "405566287"],
    );

    expect(result.rows).toEqual([
      {
        license_code: null,
        license_url: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        dataset_external_id: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
        dataset_title: "iNaturalist Research-grade Observations",
        dataset_url:
          "https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7",
        publisher_external_id: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
        publisher_name: "iNaturalist",
      },
    ]);

    await observationRepository.upsertMany(speciesId, [
      createObservation({
        source: {
          license: null,
          dataset: {
            externalId: "ca2cf030-2a9e-49b4-945c-79b9f49f2571",
            title: null,
            url: "https://www.gbif.org/dataset/ca2cf030-2a9e-49b4-945c-79b9f49f2571",
            publisher: null,
          },
        },
      }),
    ]);

    const replacedDatasetResult = await client.query<{
      dataset_external_id: string | null;
      dataset_title: string | null;
      dataset_url: string | null;
      license_url: string | null;
      publisher_external_id: string | null;
      publisher_name: string | null;
    }>(
      `
        SELECT
          license_url,
          dataset_external_id,
          dataset_title,
          dataset_url,
          publisher_external_id,
          publisher_name
        FROM observations
        WHERE provider = $1
          AND external_id = $2
      `,
      ["iNaturalist", "405566287"],
    );

    expect(replacedDatasetResult.rows).toEqual([
      {
        license_url: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        dataset_external_id: "ca2cf030-2a9e-49b4-945c-79b9f49f2571",
        dataset_title: null,
        dataset_url:
          "https://www.gbif.org/dataset/ca2cf030-2a9e-49b4-945c-79b9f49f2571",
        publisher_external_id: null,
        publisher_name: null,
      },
    ]);
  });

  it("queries one species within a bounding box with a deterministic limit", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());
    const otherSpeciesId = await speciesRepository.upsert(
      createSpecies({
        scientificName: "Bison bonasus",
        commonName: "European bison",
        displayName: "European bison",
        source: {
          provider: "iNaturalist",
          externalId: "42420",
        },
      }),
    );
    const boundingBox = {
      west: 20,
      south: 51,
      east: 22,
      north: 53,
    };
    const olderObservation = createObservation({
      observedOn: "2026-09-30",
      observedAt: null,
      location: {
        latitude: 51.7592,
        longitude: 19.456,
        accuracyMeters: 15,
        precision: "approximate",
      },
      locationPrivacy: "open",
      source: {
        provider: "iNaturalist",
        externalId: "405566289",
        url: "https://www.inaturalist.org/observations/405566289",
      },
    });
    const newestObservation = createObservation({
      observedOn: "2026-10-05",
      observedAt: "2026-10-05T09:00:00.000Z",
      location: {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracyMeters: 10,
        precision: "approximate",
      },
      locationPrivacy: "open",
      source: {
        provider: "iNaturalist",
        externalId: "405566290",
        url: "https://www.inaturalist.org/observations/405566290",
      },
    });
    const boundaryObservation = createObservation({
      observedOn: "2026-10-04",
      observedAt: "2026-10-04T09:00:00.000Z",
      location: {
        latitude: 51,
        longitude: 20,
        accuracyMeters: null,
        precision: "unknown",
      },
      locationPrivacy: "unknown",
      source: {
        provider: "iNaturalist",
        externalId: "405566291",
        url: "https://www.inaturalist.org/observations/405566291",
      },
    });

    await observationRepository.upsertMany(speciesId, [
      olderObservation,
      newestObservation,
      boundaryObservation,
      createObservation({
        observedOn: "2026-10-06",
        location: null,
        locationPrivacy: "private",
        source: {
          provider: "iNaturalist",
          externalId: "405566292",
          url: "https://www.inaturalist.org/observations/405566292",
        },
      }),
    ]);
    await observationRepository.upsertMany(otherSpeciesId, [
      createObservation({
        observedOn: "2026-10-06",
        location: newestObservation.location,
        locationPrivacy: "open",
        source: {
          provider: "iNaturalist",
          externalId: "405566293",
          url: "https://www.inaturalist.org/observations/405566293",
        },
      }),
    ]);

    await expect(
      observationRepository.findWithinBoundingBox(speciesId, boundingBox, 1),
    ).resolves.toEqual({
      observations: [toGroupedObservation(newestObservation)],
      truncated: true,
    });
    await expect(
      observationRepository.findWithinBoundingBox(
        speciesId,
        boundingBox,
        1_000,
      ),
    ).resolves.toEqual({
      observations: [
        toGroupedObservation(newestObservation),
        toGroupedObservation(boundaryObservation),
      ],
      truncated: false,
    });
    await expect(
      observationRepository.findWithinBoundingBox(
        speciesId,
        boundingBox,
        1_001,
      ),
    ).rejects.toThrow(RangeError);
  });

  it("groups only shared canonical identities and filters the chosen representative", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());
    const nativeObservation = createObservation({
      observedOn: "2026-10-05",
      location: {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracyMeters: 500,
        precision: "limited",
      },
      locationPrivacy: "obscured",
      source: {
        provider: "iNaturalist",
        externalId: "405566300",
        url: "https://www.inaturalist.org/observations/405566300",
      },
    });
    const gbifMirror = createObservation({
      observedOn: "2026-10-05",
      location: {
        latitude: 52.25,
        longitude: 21.05,
        accuracyMeters: 10,
        precision: "approximate",
      },
      locationPrivacy: "unknown",
      deduplication: {
        key: "inaturalist:405566300",
        method: "gbif-occurrence-id",
      },
      source: {
        provider: "GBIF",
        externalId: "6129944700",
        url: "https://www.gbif.org/occurrence/6129944700",
        dataset: {
          externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          title: "iNaturalist Research-grade Observations",
          url: "https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          publisher: null,
        },
      },
    });
    const similarButUnlinkedGBIFObservation = createObservation({
      observedOn: "2026-10-05",
      location: nativeObservation.location,
      locationPrivacy: "unknown",
      source: {
        provider: "GBIF",
        externalId: "6129944701",
        url: "https://www.gbif.org/occurrence/6129944701",
      },
    });
    const privateNativeObservation = createObservation({
      observedOn: "2026-10-06",
      location: null,
      locationPrivacy: "private",
      source: {
        provider: "iNaturalist",
        externalId: "405566301",
        url: "https://www.inaturalist.org/observations/405566301",
      },
    });
    const publicGBIFMirror = createObservation({
      observedOn: "2026-10-06",
      location: {
        latitude: 52.3,
        longitude: 21.1,
        accuracyMeters: 10,
        precision: "approximate",
      },
      locationPrivacy: "unknown",
      deduplication: {
        key: "inaturalist:405566301",
        method: "gbif-occurrence-id",
      },
      source: {
        provider: "GBIF",
        externalId: "6129944702",
        url: "https://www.gbif.org/occurrence/6129944702",
        dataset: {
          externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          title: "iNaturalist Research-grade Observations",
          url: "https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          publisher: null,
        },
      },
    });

    await observationRepository.upsertMany(speciesId, [
      nativeObservation,
      gbifMirror,
      similarButUnlinkedGBIFObservation,
      privateNativeObservation,
      publicGBIFMirror,
    ]);

    const result = await observationRepository.findWithinBoundingBox(
      speciesId,
      { west: 20, south: 51, east: 22, north: 53 },
      10,
    );
    const groupedObservation = result.observations.find(
      (observation) => observation.sources.length === 2,
    );

    expect(result).toMatchObject({ truncated: false });
    expect(result.observations).toHaveLength(2);
    expect(groupedObservation).toEqual({
      observedOn: nativeObservation.observedOn,
      observedAt: nativeObservation.observedAt,
      location: nativeObservation.location,
      locationPrivacy: nativeObservation.locationPrivacy,
      sources: [nativeObservation.source, gbifMirror.source],
    });
    expect(
      result.observations.some((observation) =>
        observation.sources.some(
          (source) => source.externalId === "6129944702",
        ),
      ),
    ).toBe(false);

    await expect(
      observationRepository.findWithinBoundingBox(
        speciesId,
        { west: 20, south: 51, east: 22, north: 53 },
        1,
      ),
    ).resolves.toMatchObject({
      observations: expect.arrayContaining([expect.any(Object)]),
      truncated: true,
    });
  });

  it("persists and reads exact observation page snapshots in provider order", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());
    const privateObservation = createObservation({
      observedOn: null,
      observedAt: null,
      location: null,
      locationPrivacy: "private",
      source: {
        provider: "iNaturalist",
        externalId: "405566288",
        url: "https://www.inaturalist.org/observations/405566288",
      },
    });
    const openObservation = createObservation({
      location: {
        latitude: 52.2297,
        longitude: 21.0122,
        accuracyMeters: 10,
        precision: "approximate",
      },
      locationPrivacy: "open",
    });

    await observationRepository.replacePage(speciesId, "iNaturalist", {
      totalResults: 42,
      page: 2,
      perPage: 20,
      results: [privateObservation, openObservation],
    });

    const storedPage = await observationRepository.findPage(
      speciesId,
      "iNaturalist",
      { page: 2, perPage: 20 },
    );

    expect(storedPage).toEqual({
      totalResults: 42,
      page: 2,
      perPage: 20,
      lastSuccessfulSyncAt: expect.any(String),
      results: [privateObservation, openObservation],
    });
  });

  it("keeps empty pages and pagination variants as separate snapshots", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());

    await observationRepository.replacePage(speciesId, "iNaturalist", {
      totalResults: 0,
      page: 1,
      perPage: 20,
      results: [],
    });

    await expect(
      observationRepository.findPage(speciesId, "iNaturalist", {
        page: 1,
        perPage: 20,
      }),
    ).resolves.toMatchObject({
      totalResults: 0,
      page: 1,
      perPage: 20,
      results: [],
    });
    await expect(
      observationRepository.findPage(speciesId, "iNaturalist", {
        page: 1,
        perPage: 50,
      }),
    ).resolves.toBeNull();
    await expect(
      observationRepository.findPage(speciesId, "iNaturalist", {
        page: 2,
        perPage: 20,
      }),
    ).resolves.toBeNull();
  });

  it("rolls back observations and freshness when a page replacement fails", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());

    await observationRepository.replacePage(speciesId, "iNaturalist", {
      totalResults: 1,
      page: 1,
      perPage: 50,
      results: [createObservation()],
    });
    const originalPage = await observationRepository.findPage(
      speciesId,
      "iNaturalist",
      { page: 1, perPage: 50 },
    );

    await expect(
      observationRepository.replacePage(speciesId, "iNaturalist", {
        totalResults: 2,
        page: 1,
        perPage: 50,
        results: [
          createObservation({
            source: {
              provider: "iNaturalist",
              externalId: "",
              url: "https://www.inaturalist.org/observations/invalid",
            },
          }),
        ],
      }),
    ).rejects.toThrow();

    await expect(
      observationRepository.findPage(speciesId, "iNaturalist", {
        page: 1,
        perPage: 50,
      }),
    ).resolves.toEqual(originalPage);
  });

  it("rolls back the whole observation batch when one record is invalid", async () => {
    const transactionDatabase = createTransactionDatabase(client);
    const speciesRepository = new SpeciesRepository(transactionDatabase);
    const observationRepository = new ObservationRepository(
      transactionDatabase,
    );
    const speciesId = await speciesRepository.upsert(createSpecies());

    await expect(
      observationRepository.upsertMany(speciesId, [
        createObservation(),
        createObservation({
          source: {
            provider: "iNaturalist",
            externalId: "",
            url: "https://www.inaturalist.org/observations/invalid",
          },
        }),
      ]),
    ).rejects.toThrow();

    const result = await client.query<{ observation_count: string }>(
      `
        SELECT count(*)::text AS observation_count
        FROM observations
        WHERE species_id = $1
      `,
      [speciesId],
    );

    expect(result.rows[0]?.observation_count).toBe("0");
  });

  it("rolls back species changes when a provider mapping conflicts", async () => {
    const repository = new SpeciesRepository(createTransactionDatabase(client));
    const conflictingResolution = createGBIFResolution();
    const mooseId = await repository.upsert(
      createSpecies(),
      conflictingResolution,
    );
    const bison = createSpecies({
      scientificName: "Bos bonasus",
      commonName: "Wisent",
      displayName: "Wisent",
      source: {
        provider: "iNaturalist",
        externalId: "1696537",
      },
    });
    const bisonId = await repository.upsert(bison);

    await expect(
      repository.upsert(
        {
          ...bison,
          displayName: "Changed name",
        },
        conflictingResolution,
      ),
    ).rejects.toBeInstanceOf(SpeciesProviderMappingConflictError);

    const result = await client.query<{
      bison_display_name: string;
      mapped_species_id: string;
    }>(
      `
        SELECT
          species.display_name AS bison_display_name,
          mapping.species_id::text AS mapped_species_id
        FROM species
        CROSS JOIN species_provider_mappings AS mapping
        WHERE species.id = $1
          AND mapping.provider = $2
          AND mapping.external_id = $3
      `,
      [bisonId, "GBIF", "2441184"],
    );

    expect(result.rows).toEqual([
      {
        bison_display_name: "Wisent",
        mapped_species_id: mooseId,
      },
    ]);
  });
});
