import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { WeatherController } from "../src/weather/weather.controller.js";
import type { WeatherService } from "../src/weather/weather.service.js";

describe("WeatherController", () => {
  it("returns a provider-neutral current weather DTO", async () => {
    const weather = {
      validAt: "2026-10-12T15:55:00.000Z",
      temperatureCelsius: 9.4,
      precipitationMillimeters: 0,
      windSpeedKilometersPerHour: 10.8,
    };
    const getCurrentWeather = vi.fn().mockResolvedValue(weather);
    const weatherService = {
      getCurrentWeather,
    } as Pick<WeatherService, "getCurrentWeather"> as WeatherService;
    const controller = new WeatherController(weatherService);

    await expect(
      controller.getCurrentWeather(" 52.2297 ", " 21.0122 "),
    ).resolves.toEqual(weather);
    expect(getCurrentWeather).toHaveBeenCalledWith({
      latitude: 52.2297,
      longitude: 21.0122,
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["repeated", ["52", "53"]],
    ["not numeric", "north"],
    ["outside WGS84", "91"],
  ])("rejects a %s latitude with a bad request", async (_case, latitude) => {
    const getCurrentWeather = vi.fn();
    const weatherService = {
      getCurrentWeather,
    } as Pick<WeatherService, "getCurrentWeather"> as WeatherService;
    const controller = new WeatherController(weatherService);

    const request = controller.getCurrentWeather(latitude, "21.0122");

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message:
          'Query parameter "latitude" must be a number between -90 and 90',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getCurrentWeather).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["repeated", ["20", "21"]],
    ["not numeric", "east"],
    ["outside WGS84", "181"],
  ])("rejects a %s longitude with a bad request", async (_case, longitude) => {
    const getCurrentWeather = vi.fn();
    const weatherService = {
      getCurrentWeather,
    } as Pick<WeatherService, "getCurrentWeather"> as WeatherService;
    const controller = new WeatherController(weatherService);

    const request = controller.getCurrentWeather("52.2297", longitude);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message:
          'Query parameter "longitude" must be a number between -180 and 180',
        statusCode: 400,
      },
      status: 400,
    });
    expect(getCurrentWeather).not.toHaveBeenCalled();
  });
});
