import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalHttpClient } from "../src/external-http/external-http-client.service.js";
import { createExternalHttpPolicy } from "../src/external-http/external-http-policy.js";
import type { ExternalHttpFetch } from "../src/external-http/external-http.tokens.js";
import { NominatimAdapter } from "../src/nominatim/nominatim.adapter.js";
import { NOMINATIM_HTTP_MAX_ATTEMPTS } from "../src/nominatim/nominatim.constants.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup";
const USER_AGENT = "NatureLens/0.1";

function createAdapter() {
  const request = vi.fn<ExternalHttpFetch>();
  const policy = createExternalHttpPolicy({
    timeoutMs: 5_000,
    maxAttempts: NOMINATIM_HTTP_MAX_ATTEMPTS,
  });
  const externalHttpClient = new ExternalHttpClient(
    request,
    vi.fn().mockResolvedValue(undefined),
    () => 0.5,
  );
  const getJson = vi.spyOn(externalHttpClient, "getJson");

  return {
    adapter: new NominatimAdapter(
      externalHttpClient,
      policy,
      SEARCH_URL,
      LOOKUP_URL,
      USER_AGENT,
    ),
    getJson,
    policy,
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

function polishRelationLookupResult() {
  return {
    ...relationResult(),
    address: {
      country: "Poland",
      country_code: "pl",
    },
  };
}

describe("NominatimAdapter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches only Poland with the policy-compliant request settings", async () => {
    const { adapter, getJson, policy } = createAdapter();
    getJson.mockResolvedValue([]);

    await expect(
      adapter.searchPlaces("  Puszcza   Niepołomicka  "),
    ).resolves.toEqual([]);

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("OpenStreetMap Nominatim");
    expect(request?.policy).toBe(policy);
    expect(request?.policy.maxAttempts).toBe(1);
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

  it("looks up an OSM identity and verifies that the result belongs to Poland", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([polishRelationLookupResult()]);

    await expect(adapter.findPlaceById("osm:relation:61493")).resolves.toEqual(
      expect.objectContaining({
        id: "osm:relation:61493",
        type: "natural-area",
      }),
    );

    expect(getJson).toHaveBeenCalledOnce();
    const request = getJson.mock.calls[0]?.[0];

    expect(request?.provider).toBe("OpenStreetMap Nominatim");
    expect(request?.userAgent).toBe(USER_AGENT);
    expect(request?.url.pathname).toBe("/lookup");
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      "accept-language": "en",
      addressdetails: "1",
      format: "jsonv2",
      osm_ids: "R61493",
    });
  });

  it.each([
    ["another country", { country_code: "de" }],
    ["missing country evidence", { country: "Poland" }],
  ])("does not expose a lookup result with %s", async (_case, address) => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([
      {
        ...relationResult(),
        address,
      },
    ]);

    await expect(
      adapter.findPlaceById("osm:relation:61493"),
    ).resolves.toBeNull();
  });

  it("does not call Nominatim for an unsupported place ID", async () => {
    const { adapter, getJson } = createAdapter();

    await expect(
      adapter.findPlaceById("unsupported:place:61493"),
    ).resolves.toBeNull();
    expect(getJson).not.toHaveBeenCalled();
  });

  it("seeds the identity cache from search results", async () => {
    const { adapter, getJson } = createAdapter();
    getJson.mockResolvedValue([relationResult()]);

    const [place] = await adapter.searchPlaces("Puszcza Niepołomicka");

    await expect(adapter.findPlaceById("osm:relation:61493")).resolves.toEqual(
      place,
    );
    expect(getJson).toHaveBeenCalledOnce();
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

  it("spaces search and lookup requests through one aggregate limiter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T10:00:00.000Z"));
    const { adapter, getJson } = createAdapter();
    getJson
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([polishRelationLookupResult()]);

    await adapter.searchPlaces("first place");
    const secondRequest = adapter.findPlaceById("osm:relation:61493");

    await Promise.resolve();
    expect(getJson).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(999);
    expect(getJson).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    await expect(secondRequest).resolves.toEqual(
      expect.objectContaining({ id: "osm:relation:61493" }),
    );
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
