import { Module } from "@nestjs/common";
import { INaturalistModule } from "../inaturalist/inaturalist.module.js";
import { SpeciesService } from "./species.service.js";

@Module({
  imports: [INaturalistModule],
  providers: [SpeciesService],
  exports: [SpeciesService],
})
export class SpeciesModule {}
