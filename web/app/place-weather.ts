import { z } from "zod";
import { environment } from "../env";
import type { Place } from "./place";

export const currentWeatherSchema = z.object({
  validAt: z.iso
    .datetime({ offset: true })
    .refine((value) => value.endsWith("Z"), "Weather validAt must use UTC"),
  temperatureCelsius: z.number().finite(),
  precipitationMillimeters: z.number().finite().nonnegative(),
  windSpeedKilometersPerHour: z.number().finite().nonnegative(),
});

export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

export type PlaceWeatherResponse =
  | {
      status: "success";
      weather: CurrentWeather;
    }
  | {
      status: "unavailable";
    };

export async function getPlaceWeather(
  center: Place["center"],
): Promise<PlaceWeatherResponse> {
  try {
    const url = new URL(
      "/api/weather/current",
      environment.NEXT_PUBLIC_API_BASE_URL,
    );

    url.searchParams.set("latitude", String(center.latitude));
    url.searchParams.set("longitude", String(center.longitude));

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const weather = currentWeatherSchema.safeParse(await response.json());

    if (!weather.success) {
      return { status: "unavailable" };
    }

    return { status: "success", weather: weather.data };
  } catch {
    return { status: "unavailable" };
  }
}
