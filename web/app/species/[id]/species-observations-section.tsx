import { SpeciesMap } from "@/components/species-map";
import { SpeciesSeasonality } from "@/components/species-seasonality";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSpeciesObservations } from "../../species-observations";
import { SpeciesObservationAvailabilityNotice } from "./species-observation-availability-notice";
import { SpeciesObservationsRetry } from "./species-observations-retry";

interface SpeciesObservationsSectionProps {
  apiBaseUrl: string;
  mapStyleUrl: string;
  speciesId: string;
}

export function SpeciesObservationsLoading() {
  return (
    <>
      <section aria-labelledby="species-map-heading" className="mt-10">
        <ObservationSectionHeading />
        <div
          aria-live="polite"
          className="flex h-112 w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-sm text-stone-600 shadow-sm"
          role="status"
        >
          Loading observations…
        </div>
      </section>
      <section aria-labelledby="species-seasonality-heading" className="mt-10">
        <SeasonalitySectionHeading />
        <div
          aria-live="polite"
          className="flex h-72 w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-sm text-stone-600 shadow-sm"
          role="status"
        >
          Loading observation seasonality…
        </div>
      </section>
    </>
  );
}

export async function SpeciesObservationsSection({
  apiBaseUrl,
  mapStyleUrl,
  speciesId,
}: SpeciesObservationsSectionProps) {
  const { observations, seasonality, synchronization } =
    await getSpeciesObservations(speciesId);

  return (
    <>
      <SpeciesObservationAvailabilityNotice synchronization={synchronization} />

      <section aria-labelledby="species-map-heading" className="mt-10">
        <ObservationSectionHeading />
        {observations.status === "unavailable" ? (
          <SpeciesObservationsRetry />
        ) : (
          <SpeciesMap
            apiBaseUrl={apiBaseUrl}
            mapStyleUrl={mapStyleUrl}
            observations={observations.observations}
            speciesId={speciesId}
          />
        )}
      </section>

      <section aria-labelledby="species-seasonality-heading" className="mt-10">
        <SeasonalitySectionHeading />
        {seasonality.status === "unavailable" ? (
          <Card
            className="border-amber-200 bg-amber-50 ring-amber-200"
            role="alert"
          >
            <CardHeader>
              <CardTitle>Seasonality is temporarily unavailable</CardTitle>
              <CardDescription className="text-amber-900">
                We could not retrieve the observation distribution. Please try
                again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <SpeciesSeasonality seasonality={seasonality.seasonality} />
        )}
      </section>
    </>
  );
}

function ObservationSectionHeading() {
  return (
    <>
      <h2
        className="text-2xl font-semibold tracking-tight"
        id="species-map-heading"
      >
        Map of Poland
      </h2>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-stone-600">
        Explore the geographic context for observations of this species.
      </p>
    </>
  );
}

function SeasonalitySectionHeading() {
  return (
    <>
      <h2
        className="text-2xl font-semibold tracking-tight"
        id="species-seasonality-heading"
      >
        Observation seasonality
      </h2>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-stone-600">
        Explore when this species has been observed in the synchronized data.
      </p>
    </>
  );
}
