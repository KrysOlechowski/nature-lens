import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { PlacesModule } from "./places/places.module.js";
import { ProviderExceptionFilter } from "./provider-errors/provider-exception.filter.js";
import { SpeciesModule } from "./species/species.module.js";

@Module({
  imports: [DatabaseModule, PlacesModule, SpeciesModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProviderExceptionFilter,
    },
  ],
})
export class AppModule {}
