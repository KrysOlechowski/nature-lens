import type { INaturalistObservationResult } from "../inaturalist/inaturalist.adapter.js";
import type {
  ObservationLocationPrecision,
  ObservationLocationPrivacy,
  SpeciesObservation,
} from "./species-observation.model.js";

export function mapINaturalistObservation(
  observation: INaturalistObservationResult,
): SpeciesObservation {
  const locationPrivacy = resolveLocationPrivacy(observation);
  const accuracyMeters = resolvePublicAccuracy(observation, locationPrivacy);

  return {
    observedOn: observation.observedOn,
    observedAt: observation.timeObservedAt,
    location: observation.coordinates
      ? {
          ...observation.coordinates,
          accuracyMeters,
          precision: resolveLocationPrecision(locationPrivacy, accuracyMeters),
        }
      : null,
    locationPrivacy,
    source: {
      provider: "iNaturalist",
      externalId: String(observation.externalId),
      url: observation.sourceUrl,
    },
  };
}

function resolveLocationPrivacy(
  observation: INaturalistObservationResult,
): ObservationLocationPrivacy {
  const privacySignals = [observation.geoprivacy, observation.taxonGeoprivacy];

  if (privacySignals.includes("private")) {
    return "private";
  }

  if (observation.obscured || privacySignals.includes("obscured")) {
    return "obscured";
  }

  return "open";
}

function resolvePublicAccuracy(
  observation: INaturalistObservationResult,
  locationPrivacy: ObservationLocationPrivacy,
): number | null {
  if (locationPrivacy === "obscured" || locationPrivacy === "private") {
    return observation.publicPositionalAccuracyMeters;
  }

  return (
    observation.publicPositionalAccuracyMeters ??
    observation.positionalAccuracyMeters
  );
}

function resolveLocationPrecision(
  locationPrivacy: ObservationLocationPrivacy,
  accuracyMeters: number | null,
): ObservationLocationPrecision {
  if (locationPrivacy === "obscured" || locationPrivacy === "private") {
    return "limited";
  }

  if (accuracyMeters !== null && accuracyMeters > 0) {
    return "approximate";
  }

  return "unknown";
}
