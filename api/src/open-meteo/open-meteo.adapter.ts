import { Inject, Injectable } from "@nestjs/common";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import type { WeatherProvider } from "../weather/weather-provider.contract.js";
import type {
  CurrentWeather,
  WeatherCoordinates,
} from "../weather/weather.model.js";
import { OPEN_METEO_PROVIDER } from "./open-meteo.constants.js";
import { throwOpenMeteoProviderError } from "./open-meteo-error.mapper.js";
import { parseOpenMeteoCurrentWeatherResponse } from "./open-meteo-response.schema.js";
import { OPEN_METEO_FORECAST_URL } from "./open-meteo.tokens.js";

@Injectable()
export class OpenMeteoAdapter implements WeatherProvider {
  readonly providerName = OPEN_METEO_PROVIDER;

  constructor(
    private readonly externalHttpClient: ExternalHttpClient,
    @Inject(OPEN_METEO_FORECAST_URL) private readonly forecastUrl: string,
  ) {}

  async getCurrentWeather({
    latitude,
    longitude,
  }: WeatherCoordinates): Promise<CurrentWeather> {
    const url = new URL(this.forecastUrl);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,precipitation,wind_speed_10m",
    );
    url.searchParams.set("timeformat", "unixtime");
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("precipitation_unit", "mm");
    url.searchParams.set("wind_speed_unit", "kmh");

    try {
      const response = await this.externalHttpClient.getJson({
        provider: OPEN_METEO_PROVIDER,
        url,
      });
      const weather = parseOpenMeteoCurrentWeatherResponse(response);

      return {
        validAt: new Date(weather.current.time * 1_000).toISOString(),
        temperatureCelsius: weather.current.temperature_2m,
        precipitationMillimeters: weather.current.precipitation,
        windSpeedKilometersPerHour: weather.current.wind_speed_10m,
      };
    } catch (error) {
      throwOpenMeteoProviderError(error);
    }
  }
}
