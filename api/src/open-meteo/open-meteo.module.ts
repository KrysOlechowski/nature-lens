import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { WEATHER_PROVIDER } from "../weather/weather.tokens.js";
import { OpenMeteoAdapter } from "./open-meteo.adapter.js";
import { OPEN_METEO_FORECAST_URL } from "./open-meteo.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    OpenMeteoAdapter,
    {
      provide: WEATHER_PROVIDER,
      useExisting: OpenMeteoAdapter,
    },
    {
      provide: OPEN_METEO_FORECAST_URL,
      useValue: environment.OPEN_METEO_FORECAST_URL,
    },
  ],
  exports: [WEATHER_PROVIDER],
})
export class OpenMeteoModule {}
