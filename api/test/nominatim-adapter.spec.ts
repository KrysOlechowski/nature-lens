import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { NominatimAdapter } from "../src/nominatim/nominatim.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "NatureLens/0.1";

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const externalHttpClient = new ExternalHttpClient(request, 5_000);
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new NominatimAdapter(externalHttpClient, SEARCH_URL, USER_AGENT),
    getJson,
  };
}

function relationResult() {
  return {
    boundingbox: ["49.9922443", "50.0828961", "20.2068085", "20.4553447"],
    category: "landuse",
    display_name:
      "Puszcza Niepołomicka, Wieliczka County, Lesser Poland Voivodeship, 30-207, Poland",
    lat: "50.0375577",
    lon: "20.3379565",
    name: "Puszcza Niepołomicka",
    osm_id: 61493,
    osm_type: "relation",
    type: "forest",
  };
}

describe("NominatimAdapter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches only Poland with the policy-compliant request settings", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([]);

    await expect(
      adapter.searchPlaces("  Puszcza   Niepołomicka  "),
    ).resolves.toEqual([]);

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("OpenStreetMap Nominatim");
    expect(request?.userAgent).toBe(USER_AGENT);
    expect(request?.url.origin).toBe("https://nominatim.openstreetmap.org");
    expect(request?.url.pathname).toBe("/search");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      "accept-language": "en",
      countrycodes: "pl",
      format: "jsonv2",
      limit: "5",
      q: "Puszcza Niepołomicka",
    });
  });

  it("maps a natural area without making classification part of its identity", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([relationResult()]);

    await expect(adapter.searchPlaces("Puszcza Niepołomicka")).resolves.toEqual(
      [
        {
          bbox: {
            east: 20.4553447,
            north: 50.0828961,
            south: 49.9922443,
            west: 20.2068085,
          },
          center: {
            latitude: 50.0375577,
            longitude: 20.3379565,
          },
          id: "osm:relation:61493",
          label:
            "Puszcza Niepołomicka, Wieliczka County, Lesser Poland Voivodeship, 30-207, Poland",
          slug: "puszcza-niepolomicka",
          type: "natural-area",
        },
      ],
    );
  });

  it("does not expose a provider-guessed bounding box for an OSM node", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([
      {
        boundingbox: ["50.031", "50.071", "20.181", "20.221"],
        category: "place",
        display_name: "Niepołomice, Lesser Poland Voivodeship, Poland",
        lat: "50.051",
        lon: "20.201",
        name: "Niepołomice",
        osm_id: 314159,
        osm_type: "node",
        type: "town",
      },
    ]);

    await expect(adapter.searchPlaces("Niepołomice")).resolves.toEqual([
      expect.objectContaining({
        bbox: null,
        id: "osm:node:314159",
        type: "town",
      }),
    ]);
  });

  it("omits results without a stable OSM object identity", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([
      {
        boundingbox: ["50", "50", "20", "20"],
        category: "place",
        display_name: "Example postcode, Poland",
        lat: "50",
        lon: "20",
        place_id: 987654,
        type: "postcode",
      },
    ]);

    await expect(adapter.searchPlaces("example postcode")).resolves.toEqual([]);
  });

  it("serves normalized repeated queries from cache before rate limiting", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([relationResult()]);

    const firstResult = await adapter.searchPlaces("Puszcza Niepołomicka");
    const cachedResult = await adapter.searchPlaces(
      "  puszcza   niepołomicka ",
    );

    expect(cachedResult).toEqual(firstResult);
    expect(getJson).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent requests for the same normalized query", async () => {
    const { adapter, getJson } = createAdapter();
    let resolveResponse: ((value: unknown) => void) | undefined;
    getJson.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const firstRequest = adapter.searchPlaces("Niepołomice");
    const secondRequest = adapter.searchPlaces("  niepołomice  ");

    await vi.waitFor(() => expect(getJson).toHaveBeenCalledOnce());
    resolveResponse?.([]);

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      [],
      [],
    ]);
    expect(getJson).toHaveBeenCalledOnce();
  });

  it("spaces aggregate provider requests by at least one second", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T10:00:00.000Z"));
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([]);

    await adapter.searchPlaces("first place");
    const secondRequest = adapter.searchPlaces("second place");

    await Promise.resolve();
    expect(getJson).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(999);
    expect(getJson).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    await expect(secondRequest).resolves.toEqual([]);
    expect(getJson).toHaveBeenCalledTimes(2);
  });

  it("rejects a blank query without calling the provider", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(adapter.searchPlaces("   ")).rejects.toThrowError(
      new TypeError("OpenStreetMap Nominatim place search requires a query"),
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it("reports invalid provider data as a controlled provider error", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([{ display_name: "Incomplete place" }]);

    await expect(adapter.searchPlaces("invalid place")).rejects.toMatchObject<
      Partial<ProviderError>
    >({
      kind: "invalid-response",
      provider: "OpenStreetMap Nominatim",
    });
  });
});
