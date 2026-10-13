import { describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import { createExternalHttpPolicy } from "../src/external-http/external-http-policy.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { OpenMeteoAdapter } from "../src/open-meteo/open-meteo.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const currentResponse = {
  current_units: {
    time: "unixtime",
    interval: "seconds",
    temperature_2m: "°C",
    precipitation: "mm",
    wind_speed_10m: "km/h",
  },
  current: {
    time: 1_791_825_300,
    interval: 900,
    temperature_2m: 9.4,
    precipitation: 0,
    wind_speed_10m: 10.8,
  },
};

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const policy = createExternalHttpPolicy({
    timeoutMs: 5_000,
    maxAttempts: 2,
  });
  const externalHttpClient = new ExternalHttpClient(
    request,
    vi.fn().mockResolvedValue(undefined),
    () => 0.5,
  );
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new OpenMeteoAdapter(externalHttpClient, policy, FORECAST_URL),
    getJson,
    policy,
  };
}

describe("OpenMeteoAdapter", () => {
  it("requests explicit metric current-condition variables", async () => {
    const { adapter, getJson, policy } = createAdapter();
    getJson.mockResolvedValue(currentResponse);

    await adapter.getCurrentWeather({ latitude: 52.2297, longitude: 21.0122 });

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.policy).toBe(policy);

    expect(request?.provider).toBe("Open-Meteo");
    expect(request?.url.origin).toBe("https://api.open-meteo.com");
    expect(request?.url.pathname).toBe("/v1/forecast");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      current: "temperature_2m,precipitation,wind_speed_10m",
      latitude: "52.2297",
      longitude: "21.0122",
      precipitation_unit: "mm",
      temperature_unit: "celsius",
      timeformat: "unixtime",
      wind_speed_unit: "kmh",
    });
  });

  it("maps the model-valid time to an unambiguous UTC DTO value", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue(currentResponse);

    await expect(
      adapter.getCurrentWeather({ latitude: 52.2297, longitude: 21.0122 }),
    ).resolves.toEqual({
      validAt: "2026-10-12T17:15:00.000Z",
      temperatureCelsius: 9.4,
      precipitationMillimeters: 0,
      windSpeedKilometersPerHour: 10.8,
    });
  });

  it("maps an invalid provider contract to a controlled provider error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({ current: null });

    await expect(
      adapter.getCurrentWeather({ latitude: 52.2297, longitude: 21.0122 }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProviderError>>({
        kind: "invalid-response",
        provider: "Open-Meteo",
      }),
    );
  });
});
