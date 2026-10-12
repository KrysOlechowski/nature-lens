import { CloudRain, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";
import type { Place } from "@/app/place";
import { getPlaceWeather } from "@/app/place-weather";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlaceWeatherSectionProps {
  center: Place["center"];
}

const weatherNumberFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});
const validAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
  timeZoneName: "short",
});

export function PlaceWeatherLoading() {
  return (
    <section aria-labelledby="place-weather-heading" className="mt-10">
      <WeatherSectionHeading />
      <div
        aria-live="polite"
        className="flex h-44 w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-sm text-stone-600 shadow-sm"
        role="status"
      >
        Loading current weather…
      </div>
    </section>
  );
}

export async function PlaceWeatherSection({
  center,
}: PlaceWeatherSectionProps) {
  const response = await getPlaceWeather(center);

  return (
    <section aria-labelledby="place-weather-heading" className="mt-10">
      <WeatherSectionHeading />
      {response.status === "unavailable" ? (
        <Card
          className="border-amber-200 bg-amber-50 ring-amber-200"
          role="alert"
        >
          <CardHeader>
            <CardTitle>Weather is temporarily unavailable</CardTitle>
            <CardDescription className="text-amber-900">
              We could not retrieve current weather conditions. The remaining
              place data is still available below.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-3">
              <WeatherValue
                icon={<Thermometer aria-hidden="true" className="size-5" />}
                label="Temperature"
                value={`${formatWeatherNumber(response.weather.temperatureCelsius)} °C`}
              />
              <WeatherValue
                icon={<CloudRain aria-hidden="true" className="size-5" />}
                label="Precipitation"
                value={`${formatWeatherNumber(response.weather.precipitationMillimeters)} mm`}
              />
              <WeatherValue
                icon={<Wind aria-hidden="true" className="size-5" />}
                label="Wind speed"
                value={`${formatWeatherNumber(response.weather.windSpeedKilometersPerHour)} km/h`}
              />
            </dl>
            <p className="mt-6 text-xs leading-relaxed text-stone-500">
              Conditions valid at{" "}
              <time dateTime={response.weather.validAt}>
                {validAtFormat.format(new Date(response.weather.validAt))}
              </time>
              . Weather data by{" "}
              <a
                className="underline underline-offset-2 hover:text-stone-800"
                href="https://open-meteo.com/"
                rel="noreferrer"
                target="_blank"
              >
                Open-Meteo.com
              </a>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

interface WeatherValueProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function WeatherValue({ icon, label, value }: WeatherValueProps) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-stone-500">
        <span className="text-emerald-700">{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        {value}
      </dd>
    </div>
  );
}

function WeatherSectionHeading() {
  return (
    <>
      <h2
        className="text-2xl font-semibold tracking-tight"
        id="place-weather-heading"
      >
        Current weather
      </h2>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-stone-600">
        Current model conditions for the representative point of this place.
      </p>
    </>
  );
}

function formatWeatherNumber(value: number): string {
  return weatherNumberFormat.format(value);
}
