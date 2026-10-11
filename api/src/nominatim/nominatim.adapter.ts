import { Inject, Injectable } from "@nestjs/common";
import { ExternalHttpClient } from "../external-http/external-http-client.service.js";
import type { PlaceSearchProvider } from "../places/place-search-provider.contract.js";
import type { Place, PlaceType } from "../places/place.model.js";
import {
  NOMINATIM_CACHE_MAX_ENTRIES,
  NOMINATIM_CACHE_TTL_MS,
  NOMINATIM_MIN_REQUEST_INTERVAL_MS,
  NOMINATIM_PROVIDER,
  NOMINATIM_RESULT_LIMIT,
} from "./nominatim.constants.js";
import { throwNominatimProviderError } from "./nominatim-error.mapper.js";
import {
  type NominatimPlaceResult,
  parseNominatimSearchResponse,
} from "./nominatim-response.schema.js";
import {
  NOMINATIM_SEARCH_URL,
  NOMINATIM_USER_AGENT,
} from "./nominatim.tokens.js";

interface CacheEntry {
  expiresAt: number;
  places: Place[];
}

@Injectable()
export class NominatimAdapter implements PlaceSearchProvider {
  readonly providerName = NOMINATIM_PROVIDER;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<Place[]>>();
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestStartedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly externalHttpClient: ExternalHttpClient,
    @Inject(NOMINATIM_SEARCH_URL) private readonly searchUrl: string,
    @Inject(NOMINATIM_USER_AGENT) private readonly userAgent: string,
  ) {}

  async searchPlaces(query: string): Promise<Place[]> {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      throw new TypeError(
        "OpenStreetMap Nominatim place search requires a query",
      );
    }

    const cacheKey = normalizedQuery.toLocaleLowerCase("en");
    const cachedPlaces = this.readCache(cacheKey);

    if (cachedPlaces) {
      return cachedPlaces;
    }

    const existingRequest = this.inFlight.get(cacheKey);

    if (existingRequest) {
      return existingRequest;
    }

    const request = this.scheduleRequest(() =>
      this.fetchPlaces(normalizedQuery),
    )
      .then((places) => {
        this.writeCache(cacheKey, places);
        return places;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, request);

    return request;
  }

  private async fetchPlaces(query: string): Promise<Place[]> {
    const url = new URL(this.searchUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "pl");
    url.searchParams.set("limit", String(NOMINATIM_RESULT_LIMIT));
    url.searchParams.set("accept-language", "en");

    try {
      const response = await this.externalHttpClient.getJson({
        provider: NOMINATIM_PROVIDER,
        url,
        userAgent: this.userAgent,
      });
      const results = parseNominatimSearchResponse(response);

      return results.flatMap((result) => {
        const place = mapPlace(result);
        return place ? [place] : [];
      });
    } catch (error) {
      throwNominatimProviderError(error);
    }
  }

  private scheduleRequest<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.requestQueue.then(async () => {
      const waitMs = Math.max(
        0,
        this.lastRequestStartedAt +
          NOMINATIM_MIN_REQUEST_INTERVAL_MS -
          Date.now(),
      );

      if (waitMs > 0) {
        await delay(waitMs);
      }

      this.lastRequestStartedAt = Date.now();
      return operation();
    });

    this.requestQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );

    return scheduled;
  }

  private readCache(key: string): Place[] | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.places;
  }

  private writeCache(key: string, places: Place[]): void {
    if (this.cache.size >= NOMINATIM_CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      expiresAt: Date.now() + NOMINATIM_CACHE_TTL_MS,
      places,
    });
  }
}

function mapPlace(result: NominatimPlaceResult): Place | null {
  if (result.osm_type === undefined || result.osm_id === undefined) {
    return null;
  }

  const [south, north, west, east] = result.boundingbox;

  return {
    id: `osm:${result.osm_type}:${result.osm_id}`,
    slug: createSlug(result.name ?? result.display_name.split(",")[0] ?? ""),
    label: result.display_name,
    type: mapPlaceType(result.category, result.type),
    center: {
      longitude: result.lon,
      latitude: result.lat,
    },
    bbox:
      result.osm_type === "node"
        ? null
        : {
            west,
            south,
            east,
            north,
          },
  };
}

function mapPlaceType(category: string, type: string): PlaceType {
  if (category === "place") {
    if (type === "city" || type === "town" || type === "village") {
      return type;
    }

    if (
      type === "state" ||
      type === "region" ||
      type === "county" ||
      type === "municipality"
    ) {
      return "administrative-area";
    }
  }

  if (category === "boundary" && type === "administrative") {
    return "administrative-area";
  }

  if (
    category === "natural" ||
    (category === "landuse" &&
      (type === "forest" || type === "meadow" || type === "grass")) ||
    (category === "boundary" &&
      (type === "protected_area" || type === "national_park")) ||
    (category === "leisure" && type === "nature_reserve")
  ) {
    return "natural-area";
  }

  return "other";
}

function createSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replaceAll("ł", "l")
    .replaceAll("Ł", "L")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "place";
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
