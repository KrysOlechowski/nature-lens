import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service.js";
import type { SpeciesDetail } from "./species-detail.model.js";
import type { SpeciesProviderMappingResolution } from "./species-identity.model.js";
import type { NormalizedSpecies } from "./species-search-result.model.js";

interface SpeciesIdRow {
  id: string;
}

interface SpeciesMappingRow {
  species_id: string;
}

interface ProviderExternalIdRow {
  external_id: string;
}

interface SpeciesExistsRow {
  exists: boolean;
}

interface SpeciesDetailRow {
  id: string;
  scientific_name: string;
  display_name: string | null;
  taxon_rank: string | null;
}

export class SpeciesProviderMappingConflictError extends Error {
  constructor() {
    super("Provider species identifier is already mapped to another species");
    this.name = "SpeciesProviderMappingConflictError";
  }
}

@Injectable()
export class SpeciesRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsert(
    species: NormalizedSpecies,
    equivalentMapping?: SpeciesProviderMappingResolution,
  ): Promise<string> {
    const sourceMapping: SpeciesProviderMappingResolution = {
      provider: species.source.provider,
      externalId: species.source.externalId,
      resolutionMethod: "provider-record",
      resolutionContext: {
        scientificName: species.scientificName,
        taxonRank: species.taxonomy.rank,
      },
    };
    const mappings = equivalentMapping
      ? [sourceMapping, equivalentMapping]
      : [sourceMapping];

    return this.database.withTransaction(async (client) => {
      await this.lockProviderMappings(client, mappings);

      const sourceSpeciesId = await this.findMappedSpeciesId(
        client,
        sourceMapping,
      );
      const equivalentSpeciesId = equivalentMapping
        ? await this.findMappedSpeciesId(client, equivalentMapping)
        : null;

      if (
        sourceSpeciesId &&
        equivalentSpeciesId &&
        sourceSpeciesId !== equivalentSpeciesId
      ) {
        throw new SpeciesProviderMappingConflictError();
      }

      let speciesId = sourceSpeciesId ?? equivalentSpeciesId;

      if (!speciesId) {
        speciesId = await this.insertSpecies(client, species);
      } else if (sourceSpeciesId) {
        await this.updateSpecies(client, speciesId, species);
      }

      if (!speciesId) {
        throw new Error("Species upsert did not return an identifier");
      }

      for (const mapping of mappings) {
        await this.ensureProviderMapping(client, speciesId, mapping);
      }

      return speciesId;
    });
  }

  private async lockProviderMappings(
    client: PoolClient,
    mappings: SpeciesProviderMappingResolution[],
  ): Promise<void> {
    const lockKeys = [
      ...new Set(
        mappings.map(
          (mapping) =>
            `${mapping.provider.length}:${mapping.provider}:${mapping.externalId}`,
        ),
      ),
    ].sort();

    for (const lockKey of lockKeys) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [lockKey],
      );
    }
  }

  private async findMappedSpeciesId(
    client: PoolClient,
    mapping: SpeciesProviderMappingResolution,
  ): Promise<string | null> {
    const result = await client.query<SpeciesMappingRow>(
      `
        SELECT species_id::text
        FROM species_provider_mappings
        WHERE provider = $1
          AND external_id = $2
      `,
      [mapping.provider, mapping.externalId],
    );

    return result.rows[0]?.species_id ?? null;
  }

  private async insertSpecies(
    client: PoolClient,
    species: NormalizedSpecies,
  ): Promise<string> {
    const result = await client.query<SpeciesIdRow>(
      `
        INSERT INTO species (
          scientific_name,
          display_name,
          taxon_rank
        )
        VALUES ($1, $2, $3)
        RETURNING id::text AS id
      `,
      [species.scientificName, species.displayName, species.taxonomy.rank],
    );
    const speciesId = result.rows[0]?.id;

    if (!speciesId) {
      throw new Error("Species insert did not return an identifier");
    }

    return speciesId;
  }

  private async updateSpecies(
    client: PoolClient,
    speciesId: string,
    species: NormalizedSpecies,
  ): Promise<void> {
    await client.query(
      `
        UPDATE species
        SET scientific_name = $2,
            display_name = $3,
            taxon_rank = $4,
            updated_at = current_timestamp
        WHERE id = $1
      `,
      [
        speciesId,
        species.scientificName,
        species.displayName,
        species.taxonomy.rank,
      ],
    );
  }

  private async ensureProviderMapping(
    client: PoolClient,
    speciesId: string,
    mapping: SpeciesProviderMappingResolution,
  ): Promise<void> {
    const mappedSpeciesId = await this.findMappedSpeciesId(client, mapping);

    if (mappedSpeciesId) {
      if (mappedSpeciesId !== speciesId) {
        throw new SpeciesProviderMappingConflictError();
      }

      return;
    }

    await client.query(
      `
        INSERT INTO species_provider_mappings (
          species_id,
          provider,
          external_id,
          resolution_method,
          resolution_context
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        speciesId,
        mapping.provider,
        mapping.externalId,
        mapping.resolutionMethod,
        JSON.stringify(mapping.resolutionContext),
      ],
    );
  }

  async findProviderExternalId(
    speciesId: string,
    provider: string,
  ): Promise<string | null> {
    const result = await this.database.query<ProviderExternalIdRow>(
      `
        SELECT external_id
        FROM species_provider_mappings
        WHERE species_id = $1
          AND provider = $2
      `,
      [speciesId, provider],
    );

    return result.rows[0]?.external_id ?? null;
  }

  async findById(speciesId: string): Promise<SpeciesDetail | null> {
    const result = await this.database.query<SpeciesDetailRow>(
      `
        SELECT
          id::text AS id,
          scientific_name,
          display_name,
          taxon_rank
        FROM species
        WHERE id = $1
      `,
      [speciesId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      scientificName: row.scientific_name,
      displayName: row.display_name ?? row.scientific_name,
      taxonomy: {
        ...(row.taxon_rank === null ? {} : { rank: row.taxon_rank }),
      },
    };
  }

  async exists(speciesId: string): Promise<boolean> {
    const result = await this.database.query<SpeciesExistsRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM species
          WHERE id = $1
        ) AS exists
      `,
      [speciesId],
    );

    return result.rows[0]?.exists ?? false;
  }
}
