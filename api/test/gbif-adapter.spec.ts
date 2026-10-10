import { describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { GBIFAdapter } from "../src/gbif/gbif.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const externalHttpClient = new ExternalHttpClient(request, 5_000);
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new GBIFAdapter(externalHttpClient),
    getJson,
  };
}

describe("GBIFAdapter", () => {
  it("requests a paginated page of occurrences for a taxon in Poland", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      offset: 100,
      limit: 50,
      count: 2_307,
      results: [],
    });

    await expect(
      adapter.getObservations(2_441_184, { page: 3, perPage: 50 }),
    ).resolves.toEqual({
      totalResults: 2_307,
      page: 3,
      perPage: 50,
      results: [],
    });

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("GBIF");
    expect(request?.url.origin).toBe("https://api.gbif.org");
    expect(request?.url.pathname).toBe("/v1/occurrence/search");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      checklistKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
      country: "PL",
      limit: "50",
      offset: "100",
      taxonKey: "2441184",
    });
  });

  it("maps validated occurrences to small integration results", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      offset: 0,
      limit: 2,
      count: 2,
      results: [
        {
          key: 6_129_944_648,
          eventDate: "2026-01-19T14:21",
          decimalLatitude: 52.708039,
          decimalLongitude: 23.764744,
          coordinateUncertaintyInMeters: 26_004,
        },
        {
          key: 6_130_241_491,
        },
      ],
    });

    await expect(
      adapter.getObservations(2_441_184, { page: 1, perPage: 2 }),
    ).resolves.toEqual({
      totalResults: 2,
      page: 1,
      perPage: 2,
      results: [
        {
          externalId: 6_129_944_648,
          eventDate: "2026-01-19T14:21",
          coordinates: {
            latitude: 52.708039,
            longitude: 23.764744,
          },
          coordinateUncertaintyMeters: 26_004,
          sourceUrl: "https://www.gbif.org/occurrence/6129944648",
        },
        {
          externalId: 6_130_241_491,
          eventDate: null,
          coordinates: null,
          coordinateUncertaintyMeters: null,
          sourceUrl: "https://www.gbif.org/occurrence/6130241491",
        },
      ],
    });
  });

  it("matches a taxon in the same explicit GBIF Backbone used by occurrences", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      usage: {
        key: "2441185",
        canonicalName: "Bos bonasus",
        rank: "SPECIES",
      },
      acceptedUsage: {
        key: "2441184",
        canonicalName: "Bison bonasus",
        rank: "SPECIES",
      },
      diagnostics: {
        matchType: "EXACT",
        confidence: 98,
      },
      synonym: true,
    });

    await expect(
      adapter.matchTaxon({ scientificName: " Bos bonasus ", rank: "species" }),
    ).resolves.toEqual({
      usage: {
        externalId: 2_441_185,
        scientificName: "Bos bonasus",
        rank: "SPECIES",
      },
      acceptedUsage: {
        externalId: 2_441_184,
        scientificName: "Bison bonasus",
        rank: "SPECIES",
      },
      diagnostics: {
        matchType: "EXACT",
        confidence: 98,
      },
      synonym: true,
    });

    const request = getJson.mock.calls[0]?.[0];

    expect(request?.url.pathname).toBe("/v2/species/match");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      checklistKey: "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c",
      scientificName: "Bos bonasus",
      taxonRank: "species",
    });
  });

  it("maps a controlled GBIF no-match response", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      diagnostics: {
        matchType: "NONE",
        confidence: 100,
      },
      synonym: false,
    });

    await expect(
      adapter.matchTaxon({
        scientificName: "Definitelynotarealtaxonxyz",
        rank: "species",
      }),
    ).resolves.toEqual({
      diagnostics: {
        matchType: "NONE",
        confidence: 100,
      },
      synonym: false,
    });
  });

  it.each([
    ["scientific name", { scientificName: "", rank: "species" }],
    ["rank", { scientificName: "Bos bonasus", rank: " " }],
  ])(
    "rejects a taxon match without a valid %s",
    async (expectedField, request) => {
      const { adapter, getJson } = createAdapter();

      await expect(adapter.matchTaxon(request)).rejects.toThrowError(
        `GBIF taxon match requires a ${expectedField}`,
      );
      expect(getJson).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["taxon key", 0, { page: 1, perPage: 300 }],
    ["observation page", 2_441_184, { page: 0, perPage: 300 }],
    ["observations per page", 2_441_184, { page: 1, perPage: 0 }],
    ["observations per page", 2_441_184, { page: 1, perPage: 1.5 }],
  ])(
    "rejects an invalid %s without calling GBIF",
    async (_field, taxonKey, pagination) => {
      const { adapter, getJson } = createAdapter();

      await expect(
        adapter.getObservations(taxonKey, pagination),
      ).rejects.toBeInstanceOf(TypeError);
      expect(getJson).not.toHaveBeenCalled();
    },
  );

  it("rejects a page size above the GBIF limit", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(
      adapter.getObservations(2_441_184, { page: 1, perPage: 301 }),
    ).rejects.toThrowError(
      new TypeError("GBIF observations per page cannot exceed 300"),
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it("rejects pagination beyond the GBIF result window", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(
      adapter.getObservations(2_441_184, { page: 335, perPage: 300 }),
    ).rejects.toThrowError(
      new TypeError(
        "GBIF observation offset plus page size cannot exceed 100000",
      ),
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it("reports invalid occurrence data as a controlled integration error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      offset: 0,
      limit: 1,
      count: 1,
      results: [{ eventDate: "2026-01-19" }],
    });

    await expect(
      adapter.getObservations(2_441_184, { page: 1, perPage: 1 }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "invalid-response",
      provider: "GBIF",
    });
  });
});
