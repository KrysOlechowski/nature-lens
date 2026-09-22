import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    "species",
    {
      id: {
        type: "bigint",
        primaryKey: true,
        sequenceGenerated: { precedence: "ALWAYS" },
      },
      scientific_name: {
        type: "text",
        notNull: true,
        unique: true,
        check: "btrim(scientific_name) <> ''",
      },
      display_name: {
        type: "text",
        check: "btrim(display_name) <> ''",
      },
      kingdom: {
        type: "text",
        check: "btrim(kingdom) <> ''",
      },
      phylum: {
        type: "text",
        check: "btrim(phylum) <> ''",
      },
      class: {
        type: "text",
        check: "btrim(class) <> ''",
      },
      order: {
        type: "text",
        check: "btrim(\"order\") <> ''",
      },
      family: {
        type: "text",
        check: "btrim(family) <> ''",
      },
      genus: {
        type: "text",
        check: "btrim(genus) <> ''",
      },
      taxon_rank: {
        type: "text",
        check: "btrim(taxon_rank) <> ''",
      },
      created_at: {
        type: "timestamp with time zone",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
      updated_at: {
        type: "timestamp with time zone",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      comment: "Application-owned species independent of external providers",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable("species");
}
