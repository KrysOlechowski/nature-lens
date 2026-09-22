import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.createTable(
    "observations",
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
      external_id: {
        type: "text",
        notNull: true,
        check: "btrim(external_id) <> ''",
      },
      observed_at: {
        type: "timestamp with time zone",
        notNull: true,
      },
      location: {
        type: "extensions.geometry(Point, 4326)",
        notNull: true,
        check:
          "NOT extensions.st_isempty(location) AND extensions.st_x(location) BETWEEN -180 AND 180 AND extensions.st_y(location) BETWEEN -90 AND 90",
      },
      positional_accuracy_meters: {
        type: "double precision",
        check:
          "positional_accuracy_meters >= 0 AND positional_accuracy_meters < 'Infinity'::double precision",
      },
      location_obscured: {
        type: "boolean",
      },
      source_url: {
        type: "text",
        notNull: true,
        check: "btrim(source_url) <> ''",
      },
    },
    {
      comment:
        "Normalized biodiversity observations with WGS84 point locations and provider provenance",
    },
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable("observations");
}
