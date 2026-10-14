import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { LoggingModule } from "./logging/logging.module.js";
import { PlacesModule } from "./places/places.module.js";
import { ProtectedAreasModule } from "./protected-areas/protected-areas.module.js";
import { ProviderExceptionFilter } from "./provider-errors/provider-exception.filter.js";
import { RequestProtectionModule } from "./request-protection/request-protection.module.js";
import { SpeciesModule } from "./species/species.module.js";
import { WeatherModule } from "./weather/weather.module.js";

@Module({
  imports: [
    DatabaseModule,
    LoggingModule,
    PlacesModule,
    ProtectedAreasModule,
    RequestProtectionModule,
    SpeciesModule,
    WeatherModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProviderExceptionFilter,
    },
  ],
})
export class AppModule {}
