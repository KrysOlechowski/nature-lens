import { z } from "zod";
import type { GBIFObservationResult } from "../gbif/gbif.adapter.js";
import type {
  ObservationLocationPrecision,
  SpeciesObservation,
} from "./species-observation.model.js";

const dateSchema = z.iso.date();
const datePrefixPattern = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const dateTimeWithOffsetPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function mapGBIFObservation(
  observation: GBIFObservationResult,
): SpeciesObservation {
  return {
    observedOn: resolveObservedOn(observation.eventDate),
    observedAt: resolveObservedAt(observation.eventDate),
    location: observation.coordinates
      ? {
          ...observation.coordinates,
          accuracyMeters: observation.coordinateUncertaintyMeters,
          precision: resolveLocationPrecision(
            observation.coordinateUncertaintyMeters,
          ),
        }
      : null,
    locationPrivacy: "unknown",
    source: {
      provider: "GBIF",
      externalId: String(observation.externalId),
      url: observation.sourceUrl,
    },
  };
}

function resolveObservedOn(eventDate: string | null): string | null {
  if (!eventDate || eventDate.includes("/")) {
    return null;
  }

  const date = datePrefixPattern.exec(eventDate)?.[1];

  return date && dateSchema.safeParse(date).success ? date : null;
}

function resolveObservedAt(eventDate: string | null): string | null {
  if (
    !eventDate ||
    !dateTimeWithOffsetPattern.test(eventDate) ||
    Number.isNaN(Date.parse(eventDate))
  ) {
    return null;
  }

  return eventDate;
}

function resolveLocationPrecision(
  accuracyMeters: number | null,
): ObservationLocationPrecision {
  if (accuracyMeters !== null && accuracyMeters > 0) {
    return "approximate";
  }

  return "unknown";
}
