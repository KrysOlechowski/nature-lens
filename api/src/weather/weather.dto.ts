import type { CurrentWeather } from "./weather.model.js";

export class CurrentWeatherDto {
  readonly validAt: string;
  readonly temperatureCelsius: number;
  readonly precipitationMillimeters: number;
  readonly windSpeedKilometersPerHour: number;

  constructor(weather: CurrentWeather) {
    this.validAt = weather.validAt;
    this.temperatureCelsius = weather.temperatureCelsius;
    this.precipitationMillimeters = weather.precipitationMillimeters;
    this.windSpeedKilometersPerHour = weather.windSpeedKilometersPerHour;
  }
}
