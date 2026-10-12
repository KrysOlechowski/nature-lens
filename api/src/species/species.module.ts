import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { GBIFModule } from "../gbif/gbif.module.js";
import { INaturalistModule } from "../inaturalist/inaturalist.module.js";
import { ObservationRepository } from "./observation.repository.js";
import { SpeciesController } from "./species.controller.js";
import { SpeciesIdentityResolver } from "./species-identity.resolver.js";
import { SpeciesRepository } from "./species.repository.js";
import { SpeciesService } from "./species.service.js";
import { SpatialObservationsController } from "./spatial-observations.controller.js";
import { SpatialObservationsService } from "./spatial-observations.service.js";

@Module({
  imports: [DatabaseModule, GBIFModule, INaturalistModule],
  controllers: [SpeciesController, SpatialObservationsController],
  providers: [
    ObservationRepository,
    SpeciesIdentityResolver,
    SpeciesRepository,
    SpeciesService,
    SpatialObservationsService,
  ],
  exports: [SpeciesService],
})
export class SpeciesModule {}
