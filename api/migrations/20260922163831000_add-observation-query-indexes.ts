import type { MigrationBuilder } from "node-pg-migrate";

const providerExternalIdConstraint = "observations_provider_external_id_unique";
const speciesIdIndex = "observations_species_id_idx";
const locationIndex = "observations_location_gist_idx";

export function up(pgm: MigrationBuilder): void {
  pgm.addConstraint("observations", providerExternalIdConstraint, {
    unique: ["provider", "external_id"],
  });

  pgm.createIndex("observations", "species_id", {
    name: speciesIdIndex,
  });

  pgm.createIndex("observations", "location", {
    name: locationIndex,
    method: "gist",
  });
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropIndex("observations", "location", {
    name: locationIndex,
  });

  pgm.dropIndex("observations", "species_id", {
    name: speciesIdIndex,
  });

  pgm.dropConstraint("observations", providerExternalIdConstraint);
}
