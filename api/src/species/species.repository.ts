import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
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

export class SpeciesProviderMappingConflictError extends Error {
  constructor() {
    super("Provider species identifier is already mapped to another species");
    this.name = "SpeciesProviderMappingConflictError";
  }
}

@Injectable()
export class SpeciesRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsert(species: NormalizedSpecies): Promise<string> {
    return this.database.withTransaction(async (client) => {
      // Scientific-name matching is deliberately limited to the current
      // single-provider flow. It is not cross-provider identity resolution.
      const speciesResult = await client.query<SpeciesIdRow>(
        `
          INSERT INTO species (
            scientific_name,
            display_name,
            taxon_rank
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (scientific_name)
          DO UPDATE SET
            display_name = EXCLUDED.display_name,
            taxon_rank = EXCLUDED.taxon_rank,
            updated_at = current_timestamp
          RETURNING id::text AS id
        `,
        [species.scientificName, species.displayName, species.taxonomy.rank],
      );
      const speciesId = speciesResult.rows[0]?.id;

      if (!speciesId) {
        throw new Error("Species upsert did not return an identifier");
      }

      await client.query(
        `
          INSERT INTO species_provider_mappings (
            species_id,
            provider,
            external_id
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (provider, external_id) DO NOTHING
        `,
        [speciesId, species.source.provider, species.source.externalId],
      );

      const mappingResult = await client.query<SpeciesMappingRow>(
        `
          SELECT species_id::text
          FROM species_provider_mappings
          WHERE provider = $1
            AND external_id = $2
        `,
        [species.source.provider, species.source.externalId],
      );

      if (mappingResult.rows[0]?.species_id !== speciesId) {
        throw new SpeciesProviderMappingConflictError();
      }

      return speciesId;
    });
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
