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
});
