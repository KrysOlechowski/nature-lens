import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OpenMeteoIntegrationError } from "../src/open-meteo/open-meteo-integration.error.js";
import { parseOpenMeteoCurrentWeatherResponse } from "../src/open-meteo/open-meteo-response.schema.js";

const validResponse = {
  latitude: 52.23,
  longitude: 21.02,
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

describe("parseOpenMeteoCurrentWeatherResponse", () => {
  it("validates only the current model conditions used by the application", () => {
    expect(parseOpenMeteoCurrentWeatherResponse(validResponse)).toEqual({
      current_units: validResponse.current_units,
      current: validResponse.current,
    });
  });

  it.each([
    [
      "an unexpected temperature unit",
      {
        ...validResponse,
        current_units: {
          ...validResponse.current_units,
          temperature_2m: "°F",
        },
      },
    ],
    [
      "a negative precipitation value",
      {
        ...validResponse,
        current: { ...validResponse.current, precipitation: -0.1 },
      },
    ],
    [
      "a missing current object",
      { current_units: validResponse.current_units },
    ],
  ])("reports %s as a controlled integration error", (_case, response) => {
    expect(() => parseOpenMeteoCurrentWeatherResponse(response)).toThrowError(
      expect.objectContaining<Partial<OpenMeteoIntegrationError>>({
        cause: expect.any(z.ZodError),
        kind: "invalid-response",
        message: "Open-Meteo returned an invalid current weather response",
        provider: "Open-Meteo",
      }),
    );
  });
});
