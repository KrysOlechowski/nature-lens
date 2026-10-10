import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint("species", "species_scientific_name_key");

  pgm.addColumns("species_provider_mappings", {
    resolution_method: {
      type: "text",
      notNull: true,
      default: "provider-record",
      check: "btrim(resolution_method) <> ''",
    },
    resolution_context: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns("species_provider_mappings", [
    "resolution_method",
    "resolution_context",
  ]);
  pgm.addConstraint("species", "species_scientific_name_key", {
    unique: ["scientific_name"],
  });
}
