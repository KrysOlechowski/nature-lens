import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { INaturalistModule } from "../inaturalist/inaturalist.module.js";
import { ObservationRepository } from "./observation.repository.js";
import { SpeciesController } from "./species.controller.js";
import { SpeciesRepository } from "./species.repository.js";
import { SpeciesService } from "./species.service.js";

@Module({
  imports: [DatabaseModule, INaturalistModule],
  controllers: [SpeciesController],
  providers: [ObservationRepository, SpeciesRepository, SpeciesService],
  exports: [SpeciesService],
})
export class SpeciesModule {}
