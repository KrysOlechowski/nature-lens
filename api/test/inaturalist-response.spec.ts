import { describe, expect, it } from "vitest";
import { z } from "zod";
import { INaturalistIntegrationError } from "../src/inaturalist/inaturalist-integration.error.js";
import { parseINaturalistTaxaResponse } from "../src/inaturalist/inaturalist-response.schema.js";

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
