import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.addColumn("observations", {
    observed_on: {
      type: "date",
    },
  });
  pgm.alterColumn("observations", "observed_at", {
    notNull: false,
  });
  pgm.alterColumn("observations", "location", {
    notNull: false,
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.alterColumn("observations", "location", {
    notNull: true,
  });
  pgm.alterColumn("observations", "observed_at", {
    notNull: true,
  });
  pgm.dropColumn("observations", "observed_on");
}
