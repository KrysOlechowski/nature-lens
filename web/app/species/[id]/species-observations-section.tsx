import { SpeciesMap } from "@/components/species-map";
import { getSpeciesObservations } from "../../species-observations";
import { SpeciesObservationsRetry } from "./species-observations-retry";

interface SpeciesObservationsSectionProps {
  apiBaseUrl: string;
  mapStyleUrl: string;
  speciesId: string;
}

export function SpeciesObservationsLoading() {
  return (
    <div
      aria-live="polite"
      className="flex h-112 w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-sm text-stone-600 shadow-sm"
      role="status"
    >
      Loading observations…
    </div>
  );
}

export async function SpeciesObservationsSection({
  apiBaseUrl,
  mapStyleUrl,
  speciesId,
}: SpeciesObservationsSectionProps) {
  const response = await getSpeciesObservations(speciesId);

  if (response.status === "unavailable") {
    return <SpeciesObservationsRetry />;
  }

  return (
    <SpeciesMap
      apiBaseUrl={apiBaseUrl}
      mapStyleUrl={mapStyleUrl}
      observations={response.observations}
      speciesId={speciesId}
    />
  );
}
