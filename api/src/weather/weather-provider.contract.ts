import type { CurrentWeather, WeatherCoordinates } from "./weather.model.js";

export interface WeatherProvider {
  readonly providerName: string;

  getCurrentWeather(coordinates: WeatherCoordinates): Promise<CurrentWeather>;
}
