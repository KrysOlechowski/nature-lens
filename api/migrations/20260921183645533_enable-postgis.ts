import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.createSchema("extensions", { ifNotExists: true });
  pgm.createExtension("postgis", { schema: "extensions" });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropExtension("postgis");
}
