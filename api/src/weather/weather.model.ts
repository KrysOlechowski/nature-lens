export interface CurrentWeather {
  validAt: string;
  temperatureCelsius: number;
  precipitationMillimeters: number;
  windSpeedKilometersPerHour: number;
}

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}
