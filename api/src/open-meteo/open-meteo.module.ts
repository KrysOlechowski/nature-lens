import { Module } from "@nestjs/common";
import { environment } from "../config/environment.js";
import { ExternalHttpModule } from "../external-http/external-http.module.js";
import { createExternalHttpPolicy } from "../external-http/external-http-policy.js";
import { WEATHER_PROVIDER } from "../weather/weather.tokens.js";
import { OpenMeteoAdapter } from "./open-meteo.adapter.js";
import {
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_HTTP_POLICY,
} from "./open-meteo.tokens.js";

@Module({
  imports: [ExternalHttpModule],
  providers: [
    OpenMeteoAdapter,
    {
      provide: OPEN_METEO_HTTP_POLICY,
      useValue: createExternalHttpPolicy({
        timeoutMs: environment.OPEN_METEO_HTTP_TIMEOUT_MS,
        maxAttempts: 2,
      }),
    },
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
