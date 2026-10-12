import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { OpenMeteoModule } from "../open-meteo/open-meteo.module.js";
import { WeatherController } from "./weather.controller.js";
import { WeatherService } from "./weather.service.js";
import { WEATHER_FRESHNESS_WINDOW_MS } from "./weather.tokens.js";

@Module({
  imports: [OpenMeteoModule],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    {
      provide: WEATHER_FRESHNESS_WINDOW_MS,
      useValue: environment.WEATHER_FRESHNESS_WINDOW_SECONDS * 1_000,
    },
  ],
})
export class WeatherModule {}
