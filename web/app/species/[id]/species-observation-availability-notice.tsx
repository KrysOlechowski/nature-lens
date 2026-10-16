import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ObservationSynchronization } from "../../species-observation-providers";

interface SpeciesObservationAvailabilityNoticeProps {
  synchronization: ObservationSynchronization;
}

export function SpeciesObservationAvailabilityNotice({
  synchronization,
}: SpeciesObservationAvailabilityNoticeProps) {
  if (synchronization.status === "unavailable") {
    return (
      <AvailabilityCard
        description="Available synchronized observations are still shown. Missing provider data does not mean that this species has not been observed."
        title="Some observation data could not be refreshed"
      />
    );
  }

  const hasUnavailableProvider = synchronization.providers.some(
    ({ status }) => status === "unavailable",
  );

  if (hasUnavailableProvider) {
    return (
      <AvailabilityCard
        description="Available observations are still shown. Missing provider data does not mean that this species has not been observed."
        title="Some observation data is temporarily unavailable"
      />
    );
  }

  const hasStaleProvider = synchronization.providers.some(
    ({ status }) => status === "stale",
  );

  if (hasStaleProvider) {
    return (
      <AvailabilityCard
        description="Available observations are still shown, but some come from an earlier successful synchronization because a provider could not be refreshed."
        title="Some observation data may be out of date"
      />
    );
  }

  return null;
}

function AvailabilityCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card
      className="mt-10 border-amber-200 bg-amber-50 ring-amber-200"
      role="status"
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-amber-900">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
