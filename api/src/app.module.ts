import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { SpeciesModule } from "./species/species.module.js";

@Module({
  imports: [DatabaseModule, SpeciesModule],
  controllers: [HealthController],
})
export class AppModule {}
