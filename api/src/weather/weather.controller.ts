import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { CurrentWeatherDto } from "./weather.dto.js";
import { WeatherService } from "./weather.service.js";

const latitudeSchema = coordinateSchema(-90, 90);
const longitudeSchema = coordinateSchema(-180, 180);
const INVALID_LATITUDE_MESSAGE =
  'Query parameter "latitude" must be a number between -90 and 90';
const INVALID_LONGITUDE_MESSAGE =
  'Query parameter "longitude" must be a number between -180 and 180';

@Controller("weather")
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get("current")
  async getCurrentWeather(
    @Query("latitude") latitude: unknown,
    @Query("longitude") longitude: unknown,
  ): Promise<CurrentWeatherDto> {
    const parsedLatitude = latitudeSchema.safeParse(latitude);

    if (!parsedLatitude.success) {
      throw new BadRequestException(INVALID_LATITUDE_MESSAGE);
    }

    const parsedLongitude = longitudeSchema.safeParse(longitude);

    if (!parsedLongitude.success) {
      throw new BadRequestException(INVALID_LONGITUDE_MESSAGE);
    }

    const weather = await this.weatherService.getCurrentWeather({
      latitude: parsedLatitude.data,
      longitude: parsedLongitude.data,
    });

    return new CurrentWeatherDto(weather);
  }
}

function coordinateSchema(minimum: number, maximum: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform(Number)
    .pipe(z.number().finite().min(minimum).max(maximum));
}
