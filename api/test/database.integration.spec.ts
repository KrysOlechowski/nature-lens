import type { PoolClient } from "pg";
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

function createTransactionDatabase(client: PoolClient): DatabaseService {
  return {
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
          $9
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
