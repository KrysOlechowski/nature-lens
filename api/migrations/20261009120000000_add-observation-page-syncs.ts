import type { MigrationBuilder } from "node-pg-migrate";

const syncPageUniqueConstraint =
  "observation_page_syncs_species_provider_page_size_unique";
const syncItemObservationUniqueConstraint =
  "observation_page_sync_items_sync_observation_unique";
const locationPrivacyConstraint = "observations_location_privacy_check";
const locationPrecisionConstraint = "observations_location_precision_check";
const locationPrecisionPresenceConstraint =
  "observations_location_precision_presence_check";

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns("observations", {
    location_privacy: {
      type: "text",
    },
    location_precision: {
      type: "text",
    },
  });

  pgm.sql(`
    UPDATE observations
    SET
      location_privacy = CASE location_obscured
        WHEN true THEN 'obscured'
        WHEN false THEN 'open'
        ELSE 'unknown'
      END,
      location_precision = CASE
        WHEN location IS NULL THEN NULL
        WHEN location_obscured = true THEN 'limited'
        WHEN positional_accuracy_meters > 0 THEN 'approximate'
        ELSE 'unknown'
      END
  `);

  pgm.alterColumn("observations", "location_privacy", {
    notNull: true,
  });
  pgm.addConstraint("observations", locationPrivacyConstraint, {
    check: "location_privacy IN ('open', 'obscured', 'private', 'unknown')",
  });
  pgm.addConstraint("observations", locationPrecisionConstraint, {
    check:
      "location_precision IS NULL OR location_precision IN ('approximate', 'limited', 'unknown')",
  });
  pgm.addConstraint("observations", locationPrecisionPresenceConstraint, {
    check:
      "(location IS NULL AND location_precision IS NULL) OR (location IS NOT NULL AND location_precision IS NOT NULL)",
  });

  pgm.createTable(
    "observation_page_syncs",
    {
      id: {
        type: "bigint",
        primaryKey: true,
        sequenceGenerated: { precedence: "ALWAYS" },
      },
      species_id: {
        type: "bigint",
        notNull: true,
        references: "species",
        onDelete: "RESTRICT",
      },
      provider: {
        type: "text",
        notNull: true,
        check: "btrim(provider) <> ''",
      },
      page: {
        type: "integer",
        notNull: true,
        check: "page > 0",
      },
      per_page: {
        type: "integer",
        notNull: true,
        check: "per_page BETWEEN 1 AND 200",
      },
      total_results: {
        type: "integer",
        notNull: true,
        check: "total_results >= 0",
      },
      last_successful_sync_at: {
        type: "timestamp with time zone",
        notNull: true,
      },
    },
    {
      comment:
        "Successful provider synchronization metadata for exact observation pages",
    },
  );
  pgm.addConstraint("observation_page_syncs", syncPageUniqueConstraint, {
    unique: ["species_id", "provider", "page", "per_page"],
  });

  pgm.createTable("observation_page_sync_items", {
    sync_id: {
      type: "bigint",
      notNull: true,
      references: "observation_page_syncs",
      onDelete: "CASCADE",
    },
    observation_id: {
      type: "bigint",
      notNull: true,
      references: "observations",
      onDelete: "RESTRICT",
    },
    position: {
      type: "integer",
      notNull: true,
      check: "position >= 0",
    },
  });
  pgm.addConstraint(
    "observation_page_sync_items",
    "observation_page_sync_items_pkey",
    {
      primaryKey: ["sync_id", "position"],
    },
  );
  pgm.addConstraint(
    "observation_page_sync_items",
    syncItemObservationUniqueConstraint,
    {
      unique: ["sync_id", "observation_id"],
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable("observation_page_sync_items");
  pgm.dropTable("observation_page_syncs");
  pgm.dropColumns("observations", ["location_privacy", "location_precision"]);
}
