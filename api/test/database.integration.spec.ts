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

function createObservation(
  overrides: Partial<SpeciesObservation> = {},
): SpeciesObservation {
  return {
    observedOn: "2026-10-03",
    observedAt: "2026-10-03T14:45:26.000Z",
    location: {
      latitude: 53.4029839302,
      longitude: 23.2064155596,
      accuracyMeters: 25_876,
      precision: "limited",
    },
    locationPrivacy: "obscured",
    source: {
      provider: "iNaturalist",
      externalId: "405566287",
      url: "https://www.inaturalist.org/observations/405566287",
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
          extensions.ST_SetSRID(extensions.ST_MakePoint($5, $6), 4326),
          $7,
          $8,
          $9,
          $10,
          $11
        )
      `,
      [
        speciesId,
        "integration-test",
        "observation-1",
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
      observations: [newestObservation],
      truncated: true,
    });
    await expect(
      observationRepository.findWithinBoundingBox(
        speciesId,
        boundingBox,
        1_000,
      ),
    ).resolves.toEqual({
      observations: [newestObservation, boundaryObservation],
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
    const mooseId = await repository.upsert(createSpecies());
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
      repository.upsert({
        ...bison,
        displayName: "Changed name",
        source: {
          provider: "iNaturalist",
          externalId: "522194",
        },
      }),
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
      [bisonId, "iNaturalist", "522194"],
    );

    expect(result.rows).toEqual([
      {
        bison_display_name: "Wisent",
        mapped_species_id: mooseId,
      },
    ]);
  });
});
