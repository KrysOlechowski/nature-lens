import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    "species_provider_mappings",
    {
      species_id: {
        type: "bigint",
        notNull: true,
        references: "species",
        onDelete: "CASCADE",
      },
      provider: {
        type: "text",
        notNull: true,
        check: "btrim(provider) <> ''",
      },
      external_id: {
        type: "text",
        notNull: true,
        check: "btrim(external_id) <> ''",
      },
    },
    {
      comment:
        "Provider-specific identifiers for application-owned species; scientific-name matching remains a single-provider simplification, not cross-provider identity resolution",
      constraints: {
        primaryKey: ["provider", "external_id"],
      },
    },
  );

  pgm.createIndex("species_provider_mappings", "species_id");
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable("species_provider_mappings");
}
