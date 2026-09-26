import { describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { INaturalistAdapter } from "../src/inaturalist/inaturalist.adapter.js";
import { INaturalistIntegrationError } from "../src/inaturalist/inaturalist-integration.error.js";

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
      Partial<INaturalistIntegrationError>
    >({
      kind: "invalid-response",
      message: "iNaturalist returned an invalid taxa response",
      provider: "iNaturalist",
    });
  });
});
