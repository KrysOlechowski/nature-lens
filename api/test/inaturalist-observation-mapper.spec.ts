import { describe, expect, it } from "vitest";
import type { INaturalistObservationResult } from "../src/inaturalist/inaturalist.adapter.js";
import { mapINaturalistObservation } from "../src/species/inaturalist-observation.mapper.js";

const baseObservation: INaturalistObservationResult = {
  externalId: 405566287,
  observedOn: "2026-10-03",
  timeObservedAt: "2026-10-03T16:45:26+02:00",
  coordinates: {
    latitude: 53.4029839302,
    longitude: 23.2064155596,
  },
  positionalAccuracyMeters: 12,
  publicPositionalAccuracyMeters: null,
  geoprivacy: null,
  taxonGeoprivacy: null,
  obscured: false,
  sourceUrl: "https://www.inaturalist.org/observations/405566287",
  licenseCode: "cc-by-nc",
};

describe("mapINaturalistObservation", () => {
  it("normalizes an open observation with its reported accuracy and provenance", () => {
    expect(mapINaturalistObservation(baseObservation)).toEqual({
      observedOn: "2026-10-03",
      observedAt: "2026-10-03T16:45:26+02:00",
      location: {
        latitude: 53.4029839302,
        longitude: 23.2064155596,
        accuracyMeters: 12,
        precision: "approximate",
      },
      locationPrivacy: "open",
      deduplication: {
        key: "inaturalist:405566287",
        method: "provider-record-id",
      },
      source: {
        provider: "iNaturalist",
        externalId: "405566287",
        url: "https://www.inaturalist.org/observations/405566287",
        license: {
          code: "cc-by-nc",
          url: null,
        },
        dataset: null,
      },
    });
  });

  it("keeps an unavailable observation license explicit", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        licenseCode: null,
      }),
    ).toMatchObject({
      source: {
        license: null,
      },
    });
  });

  it("uses only public accuracy for a deliberately limited location", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        positionalAccuracyMeters: 4,
        publicPositionalAccuracyMeters: 25_876,
        taxonGeoprivacy: "obscured",
        obscured: true,
      }),
    ).toMatchObject({
      location: {
        accuracyMeters: 25_876,
        precision: "limited",
      },
      locationPrivacy: "obscured",
    });
  });

  it("does not expose provider accuracy when a limited location has no public accuracy", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        positionalAccuracyMeters: 4,
        publicPositionalAccuracyMeters: null,
        geoprivacy: "obscured",
        obscured: true,
      }),
    ).toMatchObject({
      location: {
        accuracyMeters: null,
        precision: "limited",
      },
      locationPrivacy: "obscured",
    });
  });

  it("keeps a private observation without public coordinates private", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        coordinates: null,
        geoprivacy: "private",
        obscured: true,
      }),
    ).toMatchObject({
      location: null,
      locationPrivacy: "private",
    });
  });

  it("does not infer obscurity from missing coordinates", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        coordinates: null,
        positionalAccuracyMeters: null,
      }),
    ).toMatchObject({
      location: null,
      locationPrivacy: "open",
    });
  });

  it("preserves a date-only observation without inventing an observation time", () => {
    expect(
      mapINaturalistObservation({
        ...baseObservation,
        timeObservedAt: null,
      }),
    ).toMatchObject({
      observedOn: "2026-10-03",
      observedAt: null,
    });
  });
});
