import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GBIFIntegrationError } from "../src/gbif/gbif-integration.error.js";
import {
  parseGBIFOccurrencesResponse,
  parseGBIFTaxonMatchResponse,
} from "../src/gbif/gbif-response.schema.js";

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
          datasetTitle: "iNaturalist Research-grade Observations",
          license: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
          publishingOrgKey: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
          publisher: "iNaturalist",
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
          datasetKey: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
          datasetTitle: "iNaturalist Research-grade Observations",
          license: "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
          publishingOrgKey: "28eb1a3f-1c15-4a95-931a-4af90ecb574d",
          publisher: "iNaturalist",
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

describe("parseGBIFTaxonMatchResponse", () => {
  it("keeps only the matched usage, accepted usage, synonym, and diagnostics", () => {
    const response = {
      usage: {
        key: "2441185",
        name: "Bos bonasus Linnaeus, 1758",
        canonicalName: "Bos bonasus",
        rank: "SPECIES",
        status: "SYNONYM",
      },
      acceptedUsage: {
        key: "2441184",
        name: "Bison bonasus (Linnaeus, 1758)",
        canonicalName: "Bison bonasus",
        rank: "SPECIES",
      },
      classification: [{ key: "1", name: "Animalia", rank: "KINGDOM" }],
      diagnostics: {
        matchType: "EXACT",
        confidence: 98,
        timeTaken: 2,
      },
      synonym: true,
    };

    expect(parseGBIFTaxonMatchResponse(response)).toEqual({
      usage: {
        key: 2_441_185,
        canonicalName: "Bos bonasus",
        rank: "SPECIES",
      },
      acceptedUsage: {
        key: 2_441_184,
        canonicalName: "Bison bonasus",
        rank: "SPECIES",
      },
      diagnostics: {
        matchType: "EXACT",
        confidence: 98,
      },
      synonym: true,
    });
  });

  it("accepts a controlled no-match response without usages", () => {
    expect(
      parseGBIFTaxonMatchResponse({
        diagnostics: {
          matchType: "NONE",
          confidence: 100,
        },
        synonym: false,
      }),
    ).toEqual({
      diagnostics: {
        matchType: "NONE",
        confidence: 100,
      },
      synonym: false,
    });
  });

  it.each([
    [
      "a synonym without an accepted usage",
      {
        usage: {
          key: "2441185",
          canonicalName: "Bos bonasus",
          rank: "SPECIES",
        },
        diagnostics: { matchType: "EXACT", confidence: 98 },
        synonym: true,
      },
    ],
    [
      "a COL XR key in the legacy Backbone contract",
      {
        usage: {
          key: "MLPT",
          canonicalName: "Bos bonasus",
          rank: "SPECIES",
        },
        diagnostics: { matchType: "EXACT", confidence: 98 },
        synonym: false,
      },
    ],
    [
      "a non-NONE match without a usage",
      {
        diagnostics: { matchType: "FUZZY", confidence: 80 },
        synonym: false,
      },
    ],
  ])(
    "reports %s as a controlled integration error",
    (_description, response) => {
      expect(() => parseGBIFTaxonMatchResponse(response)).toThrowError(
        expect.objectContaining<Partial<GBIFIntegrationError>>({
          cause: expect.any(z.ZodError),
          kind: "invalid-response",
          message: "GBIF returned an invalid taxon match",
          provider: "GBIF",
        }),
      );
    },
  );
});
