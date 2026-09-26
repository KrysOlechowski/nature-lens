import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { INaturalistModule } from "./inaturalist/inaturalist.module.js";

@Module({
  imports: [DatabaseModule, INaturalistModule],
  controllers: [HealthController],
})
export class AppModule {}
