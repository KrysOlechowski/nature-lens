import { describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { INaturalistAdapter } from "../src/inaturalist/inaturalist.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const externalHttpClient = new ExternalHttpClient(request, 5_000);
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new INaturalistAdapter(externalHttpClient),
    getJson,
  };
}

describe("INaturalistAdapter", () => {
  it("searches active species using the application request limits", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({ results: [] });

    await expect(adapter.searchSpecies("  European bison  ")).resolves.toEqual(
      [],
    );

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("iNaturalist");
    expect(request?.url.origin).toBe("https://api.inaturalist.org");
    expect(request?.url.pathname).toBe("/v1/taxa");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      is_active: "true",
      locale: "en",
      per_page: "10",
      q: "European bison",
      rank: "species",
    });
  });

  it("maps validated provider taxa to small integration results", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      page: 1,
      per_page: 10,
      results: [
        {
          ancestor_ids: [1, 2, 40151],
          id: 1696537,
          name: "Bos bonasus",
          preferred_common_name: "Wisent",
          rank: "species",
        },
        {
          id: 1712933,
          name: "Colaspis deleta",
          rank: "species",
        },
      ],
      total_results: 2,
    });

    await expect(adapter.searchSpecies("bison")).resolves.toEqual([
      {
        externalId: 1696537,
        preferredCommonName: "Wisent",
        rank: "species",
        scientificName: "Bos bonasus",
      },
      {
        externalId: 1712933,
        rank: "species",
        scientificName: "Colaspis deleta",
      },
    ]);
  });

  it("rejects a blank query without calling iNaturalist", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(adapter.searchSpecies("   ")).rejects.toThrowError(
      new TypeError("iNaturalist species search requires a query"),
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it("reports invalid provider data as a controlled integration error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      results: [{ id: 1696537, rank: "species" }],
    });

    await expect(adapter.searchSpecies("bison")).rejects.toMatchObject<
      Partial<ProviderError>
    >({
      kind: "invalid-response",
      provider: "iNaturalist",
    });
  });

  it("requests a paginated page of observations for a taxon in Poland", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      page: 3,
      per_page: 50,
      results: [],
      total_results: 739,
    });

    await expect(
      adapter.getObservations(1696537, { page: 3, perPage: 50 }),
    ).resolves.toEqual({
      page: 3,
      perPage: 50,
      results: [],
      totalResults: 739,
    });

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("iNaturalist");
    expect(request?.url.origin).toBe("https://api.inaturalist.org");
    expect(request?.url.pathname).toBe("/v1/observations");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      page: "3",
      per_page: "50",
      place_id: "7800",
      taxon_id: "1696537",
    });
  });

  it("maps validated observations to small integration results", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      page: 1,
      per_page: 2,
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
          license_code: "cc-by-nc",
        },
        {
          geojson: null,
          geoprivacy: "private",
          id: 405566288,
          obscured: true,
          observed_on: "2026-10-04",
          positional_accuracy: null,
          public_positional_accuracy: null,
          taxon_geoprivacy: null,
          time_observed_at: null,
          uri: "https://www.inaturalist.org/observations/405566288",
          license_code: null,
        },
      ],
      total_results: 2,
    });

    await expect(
      adapter.getObservations(1696537, { page: 1, perPage: 2 }),
    ).resolves.toEqual({
      page: 1,
      perPage: 2,
      results: [
        {
          coordinates: {
            latitude: 53.4029839302,
            longitude: 23.2064155596,
          },
          externalId: 405566287,
          geoprivacy: null,
          obscured: true,
          observedOn: "2026-10-03",
          positionalAccuracyMeters: 94,
          publicPositionalAccuracyMeters: 25_876,
          sourceUrl: "https://www.inaturalist.org/observations/405566287",
          licenseCode: "cc-by-nc",
          taxonGeoprivacy: "obscured",
          timeObservedAt: "2026-10-03T16:45:26+02:00",
        },
        {
          coordinates: null,
          externalId: 405566288,
          geoprivacy: "private",
          obscured: true,
          observedOn: "2026-10-04",
          positionalAccuracyMeters: null,
          publicPositionalAccuracyMeters: null,
          sourceUrl: "https://www.inaturalist.org/observations/405566288",
          licenseCode: null,
          taxonGeoprivacy: null,
          timeObservedAt: null,
        },
      ],
      totalResults: 2,
    });
  });

  it.each([
    ["taxon ID", 0, { page: 1, perPage: 200 }],
    ["observation page", 1696537, { page: 0, perPage: 200 }],
    ["observations per page", 1696537, { page: 1, perPage: 0 }],
    ["observations per page", 1696537, { page: 1, perPage: 1.5 }],
  ])(
    "rejects an invalid %s without calling iNaturalist",
    async (_field, taxonId, pagination) => {
      const { adapter, getJson } = createAdapter();

      await expect(
        adapter.getObservations(taxonId, pagination),
      ).rejects.toBeInstanceOf(TypeError);
      expect(getJson).not.toHaveBeenCalled();
    },
  );

  it("rejects a page size above the iNaturalist limit", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(
      adapter.getObservations(1696537, { page: 1, perPage: 201 }),
    ).rejects.toThrowError(
      new TypeError("iNaturalist observations per page cannot exceed 200"),
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it("reports invalid observation data as a controlled integration error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue({
      page: 1,
      per_page: 1,
      results: [{ id: 405566287 }],
      total_results: 1,
    });

    await expect(
      adapter.getObservations(1696537, { page: 1, perPage: 1 }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "invalid-response",
      provider: "iNaturalist",
    });
  });
});
