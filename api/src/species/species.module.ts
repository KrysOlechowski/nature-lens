import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { INaturalistModule } from "../inaturalist/inaturalist.module.js";
import { SpeciesController } from "./species.controller.js";
import { SpeciesRepository } from "./species.repository.js";
import { SpeciesService } from "./species.service.js";

@Module({
  imports: [DatabaseModule, INaturalistModule],
  controllers: [SpeciesController],
  providers: [SpeciesRepository, SpeciesService],
  exports: [SpeciesService],
})
export class SpeciesModule {}
