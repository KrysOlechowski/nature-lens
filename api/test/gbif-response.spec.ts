import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GBIFIntegrationError } from "../src/gbif/gbif-integration.error.js";
import { parseGBIFOccurrencesResponse } from "../src/gbif/gbif-response.schema.js";

describe("parseGBIFOccurrencesResponse", () => {
  it("validates pagination and the occurrence fields used by the application", () => {
    const response = {
      offset: 300,
      limit: 1,
      count: 2_307,
      endOfRecords: false,
      results: [
        {
          key: 6_129_944_648,
          eventDate: "2026-01-19T14:21",
          decimalLatitude: 52.708039,
          decimalLongitude: 23.764744,
          coordinateUncertaintyInMeters: 26_004,
          datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          occurrenceID: "https://www.inaturalist.org/observations/335927335",
        },
      ],
      facets: [],
    };

    expect(parseGBIFOccurrencesResponse(response)).toEqual({
      offset: 300,
      limit: 1,
      count: 2_307,
      results: [
        {
          key: 6_129_944_648,
          eventDate: "2026-01-19T14:21",
          decimalLatitude: 52.708039,
          decimalLongitude: 23.764744,
          coordinateUncertaintyInMeters: 26_004,
        },
      ],
    });
  });

  it("accepts unavailable optional occurrence data", () => {
    const response = {
      offset: 0,
      limit: 300,
      count: 1,
      results: [{ key: 123 }],
    };

    expect(parseGBIFOccurrencesResponse(response)).toEqual(response);
  });

  it.each([
    ["missing pagination metadata", { results: [] }],
    [
      "an occurrence without a GBIF key",
      { offset: 0, limit: 1, count: 1, results: [{}] },
    ],
    [
      "an unsafe GBIF key",
      {
        offset: 0,
        limit: 1,
        count: 1,
        results: [{ key: Number.MAX_SAFE_INTEGER + 1 }],
      },
    ],
    [
      "a latitude without a longitude",
      {
        offset: 0,
        limit: 1,
        count: 1,
        results: [{ key: 123, decimalLatitude: 52 }],
      },
    ],
    [
      "an invalid longitude",
      {
        offset: 0,
        limit: 1,
        count: 1,
        results: [{ key: 123, decimalLatitude: 52, decimalLongitude: 181 }],
      },
    ],
    [
      "negative coordinate uncertainty",
      {
        offset: 0,
        limit: 1,
        count: 1,
        results: [{ key: 123, coordinateUncertaintyInMeters: -1 }],
      },
    ],
  ])(
    "reports %s as a controlled integration error",
    (_description, response) => {
      expect(() => parseGBIFOccurrencesResponse(response)).toThrowError(
        expect.objectContaining<Partial<GBIFIntegrationError>>({
          cause: expect.any(z.ZodError),
          kind: "invalid-response",
          message: "GBIF returned an invalid occurrences response",
          provider: "GBIF",
        }),
      );
    },
  );
});
