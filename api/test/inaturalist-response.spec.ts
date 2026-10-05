import { describe, expect, it } from "vitest";
import { z } from "zod";
import { INaturalistIntegrationError } from "../src/inaturalist/inaturalist-integration.error.js";
import {
  parseINaturalistObservationsResponse,
  parseINaturalistTaxaResponse,
} from "../src/inaturalist/inaturalist-response.schema.js";

describe("parseINaturalistTaxaResponse", () => {
  it("validates the response wrapper and the taxon fields used by the application", () => {
    const response = {
      page: 1,
      per_page: 1,
      results: [
        {
          ancestor_ids: [1, 2, 40151],
          id: 1696537,
          name: "Bos bonasus",
          preferred_common_name: "Wisent",
          rank: "species",
        },
      ],
      total_results: 1,
    };

    expect(parseINaturalistTaxaResponse(response)).toEqual({
      results: [
        {
          id: 1696537,
          name: "Bos bonasus",
          preferred_common_name: "Wisent",
          rank: "species",
        },
      ],
    });
  });

  it("accepts an omitted preferred common name", () => {
    const response = {
      results: [
        {
          id: 1712933,
          name: "Colaspis deleta",
          rank: "species",
        },
      ],
    };

    expect(parseINaturalistTaxaResponse(response)).toEqual(response);
  });

  it.each([
    [
      "a taxon array without the results wrapper",
      [{ id: 1696537, name: "Bos bonasus", rank: "species" }],
    ],
    ["a response whose results are not an array", { results: {} }],
    [
      "a taxon without an identifier",
      { results: [{ name: "Bos bonasus", rank: "species" }] },
    ],
    [
      "a taxon without a scientific name",
      { results: [{ id: 1696537, rank: "species" }] },
    ],
    [
      "a taxon without a rank",
      { results: [{ id: 1696537, name: "Bos bonasus" }] },
    ],
    [
      "a null preferred common name",
      {
        results: [
          {
            id: 1696537,
            name: "Bos bonasus",
            preferred_common_name: null,
            rank: "species",
          },
        ],
      },
    ],
  ])(
    "reports %s as a controlled integration error",
    (_description, response) => {
      expect(() => parseINaturalistTaxaResponse(response)).toThrowError(
        expect.objectContaining<Partial<INaturalistIntegrationError>>({
          cause: expect.any(z.ZodError),
          kind: "invalid-response",
          message: "iNaturalist returned an invalid taxa response",
          provider: "iNaturalist",
        }),
      );
    },
  );
});

describe("parseINaturalistObservationsResponse", () => {
  it("validates pagination and the observation fields used by the application", () => {
    const response = {
      page: 2,
      per_page: 1,
      results: [
        {
          annotations: [{ controlled_attribute_id: 17 }],
          geojson: {
            coordinates: [23.2064155596, 53.4029839302],
            type: "Point",
          },
          geoprivacy: null,
          id: 405566287,
          obscured: true,
          observed_on: "2026-10-03",
          positional_accuracy: 94,
          public_positional_accuracy: 25_876,
          taxon_geoprivacy: "obscured",
          time_observed_at: "2026-10-03T16:45:26+02:00",
          uri: "https://www.inaturalist.org/observations/405566287",
        },
      ],
      total_results: 739,
    };

    expect(parseINaturalistObservationsResponse(response)).toEqual({
      page: 2,
      per_page: 1,
      results: [
        {
          geojson: {
            coordinates: [23.2064155596, 53.4029839302],
            type: "Point",
          },
          geoprivacy: null,
          id: 405566287,
          obscured: true,
          observed_on: "2026-10-03",
          positional_accuracy: 94,
          public_positional_accuracy: 25_876,
          taxon_geoprivacy: "obscured",
          time_observed_at: "2026-10-03T16:45:26+02:00",
          uri: "https://www.inaturalist.org/observations/405566287",
        },
      ],
      total_results: 739,
    });
  });

  it("accepts unavailable optional observation data as null", () => {
    const response = {
      page: 1,
      per_page: 200,
      results: [
        {
          geojson: null,
          geoprivacy: "private",
          id: 123,
          obscured: true,
          observed_on: null,
          positional_accuracy: null,
          public_positional_accuracy: null,
          taxon_geoprivacy: null,
          time_observed_at: null,
          uri: "https://www.inaturalist.org/observations/123",
        },
      ],
      total_results: 1,
    };

    expect(parseINaturalistObservationsResponse(response)).toEqual(response);
  });

  it.each([
    ["missing pagination metadata", { results: [] }],
    [
      "an invalid longitude",
      {
        page: 1,
        per_page: 1,
        results: [
          {
            geojson: { coordinates: [181, 52], type: "Point" },
            geoprivacy: null,
            id: 123,
            obscured: false,
            observed_on: "2026-10-03",
            positional_accuracy: null,
            public_positional_accuracy: null,
            taxon_geoprivacy: null,
            time_observed_at: null,
            uri: "https://www.inaturalist.org/observations/123",
          },
        ],
        total_results: 1,
      },
    ],
    [
      "an unsupported geometry",
      {
        page: 1,
        per_page: 1,
        results: [
          {
            geojson: { coordinates: [21, 52], type: "Polygon" },
            geoprivacy: null,
            id: 123,
            obscured: false,
            observed_on: "2026-10-03",
            positional_accuracy: null,
            public_positional_accuracy: null,
            taxon_geoprivacy: null,
            time_observed_at: null,
            uri: "https://www.inaturalist.org/observations/123",
          },
        ],
        total_results: 1,
      },
    ],
  ])(
    "reports %s as a controlled integration error",
    (_description, response) => {
      expect(() => parseINaturalistObservationsResponse(response)).toThrowError(
        expect.objectContaining<Partial<INaturalistIntegrationError>>({
          cause: expect.any(z.ZodError),
          kind: "invalid-response",
          message: "iNaturalist returned an invalid observations response",
          provider: "iNaturalist",
        }),
      );
    },
  );
});
