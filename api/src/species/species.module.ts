import { Module } from "@nestjs/common";
import { INaturalistModule } from "../inaturalist/inaturalist.module.js";
import { SpeciesController } from "./species.controller.js";
import { SpeciesService } from "./species.service.js";

@Module({
  imports: [INaturalistModule],
  controllers: [SpeciesController],
  providers: [SpeciesService],
  exports: [SpeciesService],
})
export class SpeciesModule {}
