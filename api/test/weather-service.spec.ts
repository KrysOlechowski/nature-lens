import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeatherProvider } from "../src/weather/weather-provider.contract.js";
import type { CurrentWeather } from "../src/weather/weather.model.js";
import {
  WEATHER_CACHE_MAX_ENTRIES,
  WeatherService,
} from "../src/weather/weather.service.js";

const coordinates = { latitude: 52.2297, longitude: 21.0122 };
const weather: CurrentWeather = {
  validAt: "2026-10-12T15:55:00.000Z",
  temperatureCelsius: 9.4,
  precipitationMillimeters: 0,
  windSpeedKilometersPerHour: 10.8,
};

function createService(freshnessWindowMs = 300_000) {
  const provider: WeatherProvider = {
    providerName: "Test weather provider",
    getCurrentWeather: vi.fn().mockResolvedValue(weather),
  };

  return {
    provider,
    service: new WeatherService(provider, freshnessWindowMs),
  };
}

describe("WeatherService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates a cache miss through the provider-neutral contract", async () => {
    const { provider, service } = createService();

    await expect(service.getCurrentWeather(coordinates)).resolves.toEqual(
      weather,
    );
    expect(provider.getCurrentWeather).toHaveBeenCalledWith(coordinates);
  });

  it("serves repeated coordinates from the cache within the freshness window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T16:00:00.000Z"));
    const { provider, service } = createService(60_000);

    const first = await service.getCurrentWeather(coordinates);
    vi.advanceTimersByTime(59_999);
    const cached = await service.getCurrentWeather(coordinates);

    expect(cached).toBe(first);
    expect(provider.getCurrentWeather).toHaveBeenCalledOnce();
  });

  it("refreshes weather after the freshness window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T16:00:00.000Z"));
    const { provider, service } = createService(60_000);

    await service.getCurrentWeather(coordinates);
    vi.advanceTimersByTime(60_000);
    await service.getCurrentWeather(coordinates);

    expect(provider.getCurrentWeather).toHaveBeenCalledTimes(2);
  });

  it("does not hide a failed refresh behind expired weather", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T16:00:00.000Z"));
    const { provider, service } = createService(60_000);
    const providerFailure = new Error("Weather provider unavailable");

    await service.getCurrentWeather(coordinates);
    vi.mocked(provider.getCurrentWeather).mockRejectedValueOnce(
      providerFailure,
    );
    vi.advanceTimersByTime(60_000);

    await expect(service.getCurrentWeather(coordinates)).rejects.toBe(
      providerFailure,
    );
  });

  it("evicts the oldest entry when the bounded cache is full", async () => {
    const { provider, service } = createService();

    for (let index = 0; index < WEATHER_CACHE_MAX_ENTRIES; index += 1) {
      await service.getCurrentWeather({
        latitude: 50,
        longitude: index,
      });
    }

    await service.getCurrentWeather({ latitude: 51, longitude: 0 });
    await service.getCurrentWeather({ latitude: 50, longitude: 0 });

    expect(provider.getCurrentWeather).toHaveBeenCalledTimes(
      WEATHER_CACHE_MAX_ENTRIES + 2,
    );
  });
});
