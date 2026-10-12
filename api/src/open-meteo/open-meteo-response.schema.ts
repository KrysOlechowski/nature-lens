import { z } from "zod";
import { OpenMeteoIntegrationError } from "./open-meteo-integration.error.js";

const maximumUnixTimestampSeconds = 253_402_300_799;

const openMeteoCurrentWeatherResponseSchema = z.object({
  current_units: z.object({
    time: z.literal("unixtime"),
    interval: z.literal("seconds"),
    temperature_2m: z.literal("°C"),
    precipitation: z.literal("mm"),
    wind_speed_10m: z.literal("km/h"),
  }),
  current: z.object({
    time: z.number().int().nonnegative().max(maximumUnixTimestampSeconds),
    interval: z.number().int().positive(),
    temperature_2m: z.number().finite(),
    precipitation: z.number().finite().nonnegative(),
    wind_speed_10m: z.number().finite().nonnegative(),
  }),
});

export type OpenMeteoCurrentWeatherResponse = z.infer<
  typeof openMeteoCurrentWeatherResponseSchema
>;

export function parseOpenMeteoCurrentWeatherResponse(
  response: unknown,
): OpenMeteoCurrentWeatherResponse {
  const result = openMeteoCurrentWeatherResponseSchema.safeParse(response);

  if (!result.success) {
    throw new OpenMeteoIntegrationError(
      "Open-Meteo returned an invalid current weather response",
      { cause: result.error },
    );
  }

  return result.data;
}
