import { Inject, Injectable } from "@nestjs/common";
import type { WeatherProvider } from "./weather-provider.contract.js";
import type { CurrentWeather, WeatherCoordinates } from "./weather.model.js";
import {
  WEATHER_FRESHNESS_WINDOW_MS,
  WEATHER_PROVIDER,
} from "./weather.tokens.js";

interface WeatherCacheEntry {
  expiresAt: number;
  weather: CurrentWeather;
}

export const WEATHER_CACHE_MAX_ENTRIES = 100;

@Injectable()
export class WeatherService {
  private readonly cache = new Map<string, WeatherCacheEntry>();
  private readonly inFlight = new Map<string, Promise<CurrentWeather>>();

  constructor(
    @Inject(WEATHER_PROVIDER)
    private readonly weatherProvider: WeatherProvider,
    @Inject(WEATHER_FRESHNESS_WINDOW_MS)
    private readonly freshnessWindowMs: number,
  ) {}

  async getCurrentWeather(
    coordinates: WeatherCoordinates,
  ): Promise<CurrentWeather> {
    const cacheKey = createCacheKey(coordinates);
    const cachedWeather = this.readCache(cacheKey);

    if (cachedWeather) {
      return cachedWeather;
    }

    const inFlightRequest = this.inFlight.get(cacheKey);

    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.weatherProvider
      .getCurrentWeather(coordinates)
      .then((weather) => {
        this.writeCache(cacheKey, weather);
        return weather;
      })
      .finally(() => {
        if (this.inFlight.get(cacheKey) === request) {
          this.inFlight.delete(cacheKey);
        }
      });

    this.inFlight.set(cacheKey, request);

    return request;
  }

  private readCache(key: string): CurrentWeather | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.weather;
  }

  private writeCache(key: string, weather: CurrentWeather): void {
    if (!this.cache.has(key) && this.cache.size >= WEATHER_CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.delete(key);
    this.cache.set(key, {
      expiresAt: Date.now() + this.freshnessWindowMs,
      weather,
    });
  }
}

function createCacheKey({ latitude, longitude }: WeatherCoordinates): string {
  return `${latitude},${longitude}`;
}
