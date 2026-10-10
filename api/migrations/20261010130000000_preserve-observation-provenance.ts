import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns("observations", {
    license_code: {
      type: "text",
      check: "btrim(license_code) <> ''",
    },
    license_url: {
      type: "text",
      check: "btrim(license_url) <> ''",
    },
    dataset_external_id: {
      type: "text",
      check: "btrim(dataset_external_id) <> ''",
    },
    dataset_title: {
      type: "text",
      check: "btrim(dataset_title) <> ''",
    },
    dataset_url: {
      type: "text",
      check: "btrim(dataset_url) <> ''",
    },
    publisher_external_id: {
      type: "text",
      check: "btrim(publisher_external_id) <> ''",
    },
    publisher_name: {
      type: "text",
      check: "btrim(publisher_name) <> ''",
    },
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns("observations", [
    "license_code",
    "license_url",
    "dataset_external_id",
    "dataset_title",
    "dataset_url",
    "publisher_external_id",
    "publisher_name",
  ]);
}
