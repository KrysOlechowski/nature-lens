import { describe, expect, it } from "vitest";
import type { GBIFObservationResult } from "../src/gbif/gbif.adapter.js";
import { mapGBIFObservation } from "../src/species/gbif-observation.mapper.js";

const baseObservation: GBIFObservationResult = {
  externalId: 6_129_944_648,
  eventDate: "2026-01-19T14:21:00+01:00",
  coordinates: {
    latitude: 52.708039,
    longitude: 23.764744,
  },
  coordinateUncertaintyMeters: 26_004,
  sourceUrl: "https://www.gbif.org/occurrence/6129944648",
};

describe("mapGBIFObservation", () => {
  it("normalizes a GBIF occurrence with public coordinates and provenance", () => {
    expect(mapGBIFObservation(baseObservation)).toEqual({
      observedOn: "2026-01-19",
      observedAt: "2026-01-19T14:21:00+01:00",
      location: {
        latitude: 52.708039,
        longitude: 23.764744,
        accuracyMeters: 26_004,
        precision: "approximate",
      },
      locationPrivacy: "unknown",
      source: {
        provider: "GBIF",
        externalId: "6129944648",
        url: "https://www.gbif.org/occurrence/6129944648",
      },
    });
  });

  it("preserves a date without inventing a time", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        eventDate: "2026-01-19",
      }),
    ).toMatchObject({
      observedOn: "2026-01-19",
      observedAt: null,
    });
  });

  it("does not invent a timezone for a provider datetime without an offset", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        eventDate: "2026-01-19T14:21",
      }),
    ).toMatchObject({
      observedOn: "2026-01-19",
      observedAt: null,
    });
  });

  it("does not collapse a date interval into a single observation date", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        eventDate: "2026-01-19/2026-01-20",
      }),
    ).toMatchObject({
      observedOn: null,
      observedAt: null,
    });
  });

  it("keeps missing public coordinates separate from privacy", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        coordinates: null,
        coordinateUncertaintyMeters: null,
      }),
    ).toMatchObject({
      location: null,
      locationPrivacy: "unknown",
    });
  });

  it("does not infer coordinate precision without positive uncertainty", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        coordinateUncertaintyMeters: 0,
      }),
    ).toMatchObject({
      location: {
        accuracyMeters: 0,
        precision: "unknown",
      },
    });
  });
});
