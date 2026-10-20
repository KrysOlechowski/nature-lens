import "reflect-metadata";
import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../src/database/database.service.js";
import { INATURALIST_GBIF_DATASET_KEY } from "../src/gbif/gbif.constants.js";
import {
  GBIF_OBSERVATION_PROVIDER,
  GBIF_TAXON_MATCH_PROVIDER,
  type GBIFObservationProvider,
  type GBIFTaxonMatchProvider,
} from "../src/gbif/gbif.tokens.js";
import {
  INATURALIST_OBSERVATION_PROVIDER,
  INATURALIST_SPECIES_SEARCH_PROVIDER,
  type INaturalistObservationProvider,
  type INaturalistSpeciesSearchProvider,
} from "../src/inaturalist/inaturalist.tokens.js";
import { ObservationRepository } from "../src/species/observation.repository.js";
import { SpatialObservationsController } from "../src/species/spatial-observations.controller.js";
import { SpatialObservationsService } from "../src/species/spatial-observations.service.js";
import { SpeciesController } from "../src/species/species.controller.js";
import { SpeciesIdentityResolver } from "../src/species/species-identity.resolver.js";
import { SpeciesRepository } from "../src/species/species.repository.js";
import { SpeciesService } from "../src/species/species.service.js";
import {
  startTestDatabase,
  type TestDatabase,
} from "./database-test-environment.js";

const inaturalistSpeciesSearchProvider = {
  providerName: "iNaturalist",
  searchSpecies: vi.fn(async () => [
    {
      externalId: 522194,
      scientificName: "Alces alces",
      preferredCommonName: "Moose",
      rank: "species",
    },
  ]),
} satisfies INaturalistSpeciesSearchProvider;

const inaturalistObservationProvider = {
  providerName: "iNaturalist",
  getObservations: vi.fn(async () => ({
    totalResults: 1,
    page: 1,
    perPage: 50,
    results: [
      {
        externalId: 405566287,
        observedOn: "2026-10-03",
        timeObservedAt: "2026-10-03T14:45:26.000Z",
        coordinates: {
          latitude: 53.4029839302,
          longitude: 21.2064155596,
        },
        positionalAccuracyMeters: 15,
        publicPositionalAccuracyMeters: 15,
        geoprivacy: "open" as const,
        taxonGeoprivacy: null,
        obscured: false,
        sourceUrl: "https://www.inaturalist.org/observations/405566287",
        licenseCode: "cc-by-nc",
      },
    ],
  })),
} satisfies INaturalistObservationProvider;

const gbifTaxonMatchProvider = {
  providerName: "GBIF",
  matchTaxon: vi.fn(async () => ({
    usage: {
      externalId: 2441184,
      scientificName: "Alces alces",
      rank: "species",
    },
    synonym: false,
    diagnostics: {
      matchType: "EXACT" as const,
      confidence: 100,
    },
  })),
} satisfies GBIFTaxonMatchProvider;

const gbifObservationProvider = {
  providerName: "GBIF",
  getObservations: vi.fn(async () => ({
    totalResults: 1,
    page: 1,
    perPage: 50,
    results: [
      {
        externalId: 6000123456,
        eventDate: "2026-10-03T14:45:26.000Z",
        coordinates: {
          latitude: 53.4029839302,
          longitude: 21.2064155596,
        },
        coordinateUncertaintyMeters: 15,
        canonicalIdentity: {
          key: "inaturalist:405566287",
          provider: "inaturalist" as const,
          externalId: "405566287",
        },
        sourceUrl: "https://www.gbif.org/occurrence/6000123456",
        license: {
          code: null,
          url: "https://creativecommons.org/licenses/by-nc/4.0/",
        },
        dataset: {
          externalId: INATURALIST_GBIF_DATASET_KEY,
          title: "iNaturalist Research-grade Observations",
          publisherExternalId: "2a5627f5-fda1-4b6e-8998-17c810b9a7b2",
          publisherName: "iNaturalist",
        },
      },
    ],
  })),
} satisfies GBIFObservationProvider;

interface SearchResponseItem {
  id: string;
  scientificName: string;
  displayName: string;
  source: {
    provider: string;
    externalId: string;
  };
}

interface ObservationPageResponse {
  results: Array<{
    source: {
      provider: string;
      externalId: string;
    };
  }>;
  metadata: {
    servedFrom: string;
    freshness: string;
    providers: Array<{
      provider: string;
      status: string;
    }>;
  };
}

interface FeatureCollectionResponse {
  features: Array<{
    geometry: {
      coordinates: [number, number];
    };
    properties: {
      species?: {
        id: string;
        scientificName: string;
        displayName: string;
      };
      sources: Array<{
        provider: string;
        externalId: string;
      }>;
    };
  }>;
  metadata: {
    datasetScope: string;
    returnedObservationCount?: number;
    totalObservationCount?: number;
    truncated: boolean;
  };
  species?: {
    items: Array<{
      id: string;
      scientificName: string;
      displayName: string;
      observationCount: number;
    }>;
    returnedCount: number;
    totalCount: number;
    truncated: boolean;
  };
}

class ApiFlowTestModule {}

describe("critical API flow", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: TestDatabase | undefined;

  beforeAll(async () => {
    database = await startTestDatabase();
    const databaseService = createDatabaseService(database);

    Module({
      controllers: [SpeciesController, SpatialObservationsController],
      providers: [
        SpeciesService,
        SpatialObservationsService,
        SpeciesIdentityResolver,
        SpeciesRepository,
        ObservationRepository,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: INATURALIST_SPECIES_SEARCH_PROVIDER,
          useValue: inaturalistSpeciesSearchProvider,
        },
        {
          provide: INATURALIST_OBSERVATION_PROVIDER,
          useValue: inaturalistObservationProvider,
        },
        {
          provide: GBIF_TAXON_MATCH_PROVIDER,
          useValue: gbifTaxonMatchProvider,
        },
        {
          provide: GBIF_OBSERVATION_PROVIDER,
          useValue: gbifObservationProvider,
        },
      ],
    })(ApiFlowTestModule);

    app = await NestFactory.create(ApiFlowTestModule, { logger: false });
    app.setGlobalPrefix("api");
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await database?.stop();
  });

  it("searches, synchronizes, and spatially reads observations through the real schema", async () => {
    const searchResponse = await fetch(
      `${baseUrl}/api/species/search?q=${encodeURIComponent("moose")}`,
    );
    const searchResults = (await searchResponse.json()) as SearchResponseItem[];

    expect(searchResponse.status).toBe(200);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({
      scientificName: "Alces alces",
      displayName: "Moose",
      source: {
        provider: "iNaturalist",
        externalId: "522194",
      },
    });
    const speciesId = searchResults[0]?.id;
    expect(speciesId).toMatch(/^[1-9]\d*$/);
    expect(inaturalistSpeciesSearchProvider.searchSpecies).toHaveBeenCalledWith(
      "moose",
    );
    expect(gbifTaxonMatchProvider.matchTaxon).toHaveBeenCalledWith({
      scientificName: "Alces alces",
      rank: "species",
    });

    if (!speciesId) {
      throw new Error("Species search did not return an application ID");
    }

    const synchronizationResponse = await fetch(
      `${baseUrl}/api/species/${speciesId}/observations?page=1&perPage=50`,
    );
    const synchronizedPage =
      (await synchronizationResponse.json()) as ObservationPageResponse;

    expect(synchronizationResponse.status).toBe(200);
    expect(synchronizedPage.results).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({
          provider: "iNaturalist",
          externalId: "405566287",
        }),
      }),
    ]);
    expect(synchronizedPage.metadata).toMatchObject({
      servedFrom: "provider-sync",
      freshness: "fresh",
      providers: [
        { provider: "inaturalist", status: "available" },
        { provider: "gbif", status: "available" },
      ],
    });
    expect(inaturalistObservationProvider.getObservations).toHaveBeenCalledWith(
      522194,
      { page: 1, perPage: 50 },
    );
    expect(gbifObservationProvider.getObservations).toHaveBeenCalledWith(
      2441184,
      { page: 1, perPage: 50 },
    );

    const speciesBoundingBoxResponse = await fetch(
      `${baseUrl}/api/species/${speciesId}/observations?bbox=20,52,22,54&limit=10`,
    );
    const speciesCollection =
      (await speciesBoundingBoxResponse.json()) as FeatureCollectionResponse;

    expect(speciesBoundingBoxResponse.status).toBe(200);
    expect(speciesCollection.metadata).toEqual({
      datasetScope: "locally-synchronized",
      truncated: false,
    });
    expect(speciesCollection.features).toHaveLength(1);
    expect(speciesCollection.features[0]).toMatchObject({
      geometry: {
        coordinates: [21.2064155596, 53.4029839302],
      },
      properties: {
        sources: [
          { provider: "iNaturalist", externalId: "405566287" },
          { provider: "GBIF", externalId: "6000123456" },
        ],
      },
    });

    const allSpeciesBoundingBoxResponse = await fetch(
      `${baseUrl}/api/observations?bbox=20,52,22,54&limit=10&speciesLimit=10`,
    );
    const allSpeciesCollection =
      (await allSpeciesBoundingBoxResponse.json()) as FeatureCollectionResponse;

    expect(allSpeciesBoundingBoxResponse.status).toBe(200);
    expect(allSpeciesCollection.metadata).toEqual({
      datasetScope: "locally-synchronized",
      returnedObservationCount: 1,
      totalObservationCount: 1,
      truncated: false,
    });
    expect(allSpeciesCollection.species).toEqual({
      items: [
        {
          id: speciesId,
          scientificName: "Alces alces",
          displayName: "Moose",
          observationCount: 1,
        },
      ],
      returnedCount: 1,
      totalCount: 1,
      truncated: false,
    });
    expect(allSpeciesCollection.features).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({
          species: {
            id: speciesId,
            scientificName: "Alces alces",
            displayName: "Moose",
          },
          sources: [
            expect.objectContaining({
              provider: "iNaturalist",
              externalId: "405566287",
            }),
            expect.objectContaining({
              provider: "GBIF",
              externalId: "6000123456",
            }),
          ],
        }),
      }),
    ]);
  }, 20_000);
});

function createDatabaseService(database: TestDatabase): DatabaseService {
  return {
    query<ResultRow extends QueryResultRow>(
      text: string,
      values: unknown[] = [],
    ): Promise<QueryResult<ResultRow>> {
      return database.pool.query<ResultRow>(text, values);
    },
    async withTransaction<Result>(
      operation: (client: PoolClient) => Promise<Result>,
    ): Promise<Result> {
      const client = await database.pool.connect();

      try {
        await client.query("BEGIN");
        const result = await operation(client);
        await client.query("COMMIT");

        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  } as DatabaseService;
}
