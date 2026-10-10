import type { MigrationBuilder } from "node-pg-migrate";

const deduplicationKeyIndex = "observations_species_deduplication_key_idx";
const deduplicationKeyConstraint = "observations_deduplication_key_check";
const deduplicationMethodConstraint = "observations_deduplication_method_check";
const gbifOccurrenceIdentityConstraint =
  "observations_gbif_occurrence_identity_check";

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns("observations", {
    deduplication_key: {
      type: "text",
    },
    deduplication_method: {
      type: "text",
    },
  });

  pgm.sql(`
    UPDATE observations
    SET
      deduplication_key = CASE provider
        WHEN 'iNaturalist' THEN 'inaturalist:' || external_id
        WHEN 'GBIF' THEN 'gbif:' || external_id
        ELSE provider || ':' || external_id
      END,
      deduplication_method = 'provider-record-id'
  `);

  pgm.alterColumn("observations", "deduplication_key", {
    notNull: true,
  });
  pgm.alterColumn("observations", "deduplication_method", {
    notNull: true,
  });
  pgm.addConstraint("observations", deduplicationKeyConstraint, {
    check: "btrim(deduplication_key) <> ''",
  });
  pgm.addConstraint("observations", deduplicationMethodConstraint, {
    check:
      "deduplication_method IN ('provider-record-id', 'gbif-occurrence-id')",
  });
  pgm.addConstraint("observations", gbifOccurrenceIdentityConstraint, {
    check: `
      deduplication_method <> 'gbif-occurrence-id'
      OR (
        provider = 'GBIF'
        AND dataset_external_id = '50c9509d-22c7-4a22-a47d-8c48425ef4a7'
        AND deduplication_key ~ '^inaturalist:[1-9][0-9]*$'
      )
    `,
  });
  pgm.createIndex("observations", ["species_id", "deduplication_key"], {
    name: deduplicationKeyIndex,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex("observations", ["species_id", "deduplication_key"], {
    name: deduplicationKeyIndex,
  });
  pgm.dropColumns("observations", [
    "deduplication_key",
    "deduplication_method",
  ]);
}
