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
  canonicalIdentity: null,
  sourceUrl: "https://www.gbif.org/occurrence/6129944648",
  license: {
    code: null,
    url: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
  },
  dataset: {
    externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
    title: "iNaturalist Research-grade Observations",
    publisherExternalId: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
    publisherName: "iNaturalist",
  },
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
      deduplication: {
        key: "gbif:6129944648",
        method: "provider-record-id",
      },
      source: {
        provider: "GBIF",
        externalId: "6129944648",
        url: "https://www.gbif.org/occurrence/6129944648",
        license: {
          code: null,
          url: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        },
        dataset: {
          externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          title: "iNaturalist Research-grade Observations",
          url: "https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          publisher: {
            externalId: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
            name: "iNaturalist",
          },
        },
      },
    });
  });

  it("uses a canonical iNaturalist identity supplied by the GBIF boundary", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        canonicalIdentity: {
          key: "inaturalist:335927335",
          provider: "inaturalist",
          externalId: "335927335",
        },
      }).deduplication,
    ).toEqual({
      key: "inaturalist:335927335",
      method: "gbif-occurrence-id",
    });
  });

  it("does not invent unavailable license or dataset metadata", () => {
    expect(
      mapGBIFObservation({
        ...baseObservation,
        license: null,
        dataset: null,
      }),
    ).toMatchObject({
      source: {
        license: null,
        dataset: null,
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
