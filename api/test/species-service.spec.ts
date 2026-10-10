import { Logger, NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GBIFObservationProvider } from "../src/gbif/gbif.tokens.js";
import type {
  INaturalistObservationProvider,
  INaturalistSpeciesSearchProvider,
} from "../src/inaturalist/inaturalist.tokens.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";
import type { ObservationRepository } from "../src/species/observation.repository.js";
import type { StoredSpeciesObservationPage } from "../src/species/species-observation.model.js";
import type { SpeciesIdentityResolver } from "../src/species/species-identity.resolver.js";
import type { SpeciesRepository } from "../src/species/species.repository.js";
import { SpeciesService } from "../src/species/species.service.js";

const synchronizedAt = "2026-10-09T11:30:00.000Z";
const normalizedObservation = {
  observedOn: "2026-10-03",
  observedAt: "2026-10-03T14:45:26.000Z",
  location: {
    latitude: 53.4029839302,
    longitude: 23.2064155596,
    accuracyMeters: 25_876,
    precision: "limited" as const,
  },
  locationPrivacy: "obscured" as const,
  deduplication: {
    key: "inaturalist:405566287",
    method: "provider-record-id" as const,
  },
  source: {
    provider: "iNaturalist",
    externalId: "405566287",
    url: "https://www.inaturalist.org/observations/405566287",
    license: {
      code: "cc-by-nc",
      url: null,
    },
    dataset: null,
  },
};

const groupedObservation = {
  observedOn: normalizedObservation.observedOn,
  observedAt: normalizedObservation.observedAt,
  location: normalizedObservation.location,
  locationPrivacy: normalizedObservation.locationPrivacy,
  sources: [normalizedObservation.source],
};

function createStoredPage(
  overrides: Partial<StoredSpeciesObservationPage> = {},
): StoredSpeciesObservationPage {
  return {
    totalResults: 1,
    page: 2,
    perPage: 20,
    results: [normalizedObservation],
    lastSuccessfulSyncAt: synchronizedAt,
    ...overrides,
  };
}

function createGBIFObservationProvider(
  getObservations = vi.fn(),
): GBIFObservationProvider {
  return {
    providerName: "GBIF",
    getObservations,
  } as GBIFObservationProvider;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SpeciesService", () => {
  it("returns Nature Lens species models instead of provider results", async () => {
    const searchSpecies = vi.fn().mockResolvedValue([
      {
        externalId: 1696537,
        scientificName: "Bos bonasus",
        preferredCommonName: "Wisent",
        rank: "species",
      },
    ]);
    const speciesSearchProvider = {
      providerName: "iNaturalist",
      searchSpecies,
    } as INaturalistSpeciesSearchProvider;
    const upsert = vi.fn().mockResolvedValue("42");
    const speciesRepository = {
      upsert,
    } as Pick<SpeciesRepository, "upsert"> as SpeciesRepository;
    const observationRepository = {} as ObservationRepository;
    const equivalentMapping = {
      provider: "GBIF",
      externalId: "2441184",
      resolutionMethod: "gbif-backbone-match-v2",
      resolutionContext: {
        matchedUsageKey: "2441185",
      },
    };
    const resolve = vi.fn().mockResolvedValue(equivalentMapping);
    const service = new SpeciesService(
      speciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      speciesRepository,
      observationRepository,
      { resolve } as Pick<
        SpeciesIdentityResolver,
        "resolve"
      > as SpeciesIdentityResolver,
    );

    await expect(service.searchSpecies("bison")).resolves.toEqual([
      {
        commonName: "Wisent",
        displayName: "Wisent",
        id: "42",
        scientificName: "Bos bonasus",
        source: {
          externalId: "1696537",
          provider: "iNaturalist",
        },
        taxonomy: {
          rank: "species",
        },
      },
    ]);
    expect(searchSpecies).toHaveBeenCalledWith("bison");
    const normalizedSpecies = {
      commonName: "Wisent",
      displayName: "Wisent",
      scientificName: "Bos bonasus",
      source: {
        externalId: "1696537",
        provider: "iNaturalist",
      },
      taxonomy: {
        rank: "species",
      },
    };

    expect(resolve).toHaveBeenCalledWith(normalizedSpecies);
    expect(upsert).toHaveBeenCalledWith(normalizedSpecies, equivalentMapping);
  });

  it("keeps iNaturalist search available when GBIF identity resolution fails", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const providerSpecies = {
      externalId: 1696537,
      scientificName: "Bos bonasus",
      preferredCommonName: "Wisent",
      rank: "species",
    };
    const searchSpecies = vi.fn().mockResolvedValue([providerSpecies]);
    const resolve = vi.fn().mockRejectedValue(
      new ProviderError("GBIF timed out", {
        kind: "timeout",
        provider: "GBIF",
      }),
    );
    const upsert = vi.fn().mockResolvedValue("42");
    const service = new SpeciesService(
      {
        providerName: "iNaturalist",
        searchSpecies,
      } as INaturalistSpeciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { upsert } as Pick<SpeciesRepository, "upsert"> as SpeciesRepository,
      {} as ObservationRepository,
      { resolve } as Pick<
        SpeciesIdentityResolver,
        "resolve"
      > as SpeciesIdentityResolver,
    );

    await expect(service.searchSpecies("bison")).resolves.toHaveLength(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0]).toHaveLength(1);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      "GBIF taxon identity resolution failed (timeout); continuing without a provider mapping",
    );
  });

  it("returns a persisted species by its application identifier", async () => {
    const species = {
      id: "42",
      scientificName: "Bos bonasus",
      displayName: "Wisent",
      taxonomy: {
        rank: "species",
      },
    };
    const findById = vi.fn().mockResolvedValue(species);
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { findById } as Pick<SpeciesRepository, "findById"> as SpeciesRepository,
      {} as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(service.getSpecies("42")).resolves.toBe(species);
    expect(findById).toHaveBeenCalledWith("42");
  });

  it("rejects a missing persisted species with not found", async () => {
    const findById = vi.fn().mockResolvedValue(null);
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { findById } as Pick<SpeciesRepository, "findById"> as SpeciesRepository,
      {} as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(service.getSpecies("42")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("synchronizes, persists, and reads a missing observation page", async () => {
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [
        {
          externalId: 405566287,
          observedOn: "2026-10-03",
          timeObservedAt: "2026-10-03T16:45:26+02:00",
          coordinates: {
            latitude: 53.4029839302,
            longitude: 23.2064155596,
          },
          positionalAccuracyMeters: 4,
          publicPositionalAccuracyMeters: 25_876,
          geoprivacy: null,
          taxonGeoprivacy: "obscured",
          obscured: true,
          sourceUrl: "https://www.inaturalist.org/observations/405566287",
          licenseCode: "cc-by-nc",
        },
      ],
    });
    const findProviderExternalId = vi
      .fn()
      .mockResolvedValueOnce("1696537")
      .mockResolvedValueOnce(null);
    const findPage = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createStoredPage());
    const replacePage = vi.fn().mockResolvedValue(createStoredPage());
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {
        providerName: "iNaturalist",
        getObservations,
      } as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { findProviderExternalId } as Pick<
        SpeciesRepository,
        "findProviderExternalId"
      > as SpeciesRepository,
      { findPage, replacePage } as Pick<
        ObservationRepository,
        "findPage" | "replacePage"
      > as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(
      service.getObservations("42", { page: 2, perPage: 20 }),
    ).resolves.toEqual({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [normalizedObservation],
      metadata: {
        servedFrom: "provider-sync",
        freshness: "fresh",
        lastSuccessfulSyncAt: synchronizedAt,
      },
    });
    expect(getObservations).toHaveBeenCalledWith(1696537, {
      page: 2,
      perPage: 20,
    });
    expect(replacePage).toHaveBeenCalledWith("42", "iNaturalist", {
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [
        {
          ...normalizedObservation,
          observedAt: "2026-10-03T16:45:26+02:00",
        },
      ],
    });
    expect(findPage).toHaveBeenNthCalledWith(1, "42", "iNaturalist", {
      page: 2,
      perPage: 20,
    });
    expect(findPage).toHaveBeenNthCalledWith(2, "42", "iNaturalist", {
      page: 2,
      perPage: 20,
    });
  });

  it("synchronizes a mapped GBIF page alongside the primary iNaturalist page", async () => {
    const getINaturalistObservations = vi.fn().mockResolvedValue({
      totalResults: 1,
      page: 1,
      perPage: 20,
      results: [
        {
          externalId: 405566287,
          observedOn: "2026-10-03",
          timeObservedAt: "2026-10-03T16:45:26+02:00",
          coordinates: null,
          positionalAccuracyMeters: null,
          publicPositionalAccuracyMeters: null,
          geoprivacy: "private",
          taxonGeoprivacy: null,
          obscured: false,
          sourceUrl: "https://www.inaturalist.org/observations/405566287",
          licenseCode: "cc-by-nc",
        },
      ],
    });
    const getGBIFObservations = vi.fn().mockResolvedValue({
      totalResults: 1,
      page: 1,
      perPage: 20,
      results: [
        {
          externalId: 6_129_944_648,
          eventDate: "2026-10-03T14:45:26Z",
          coordinates: { latitude: 53.4, longitude: 23.2 },
          coordinateUncertaintyMeters: 10,
          canonicalIdentity: {
            key: "inaturalist:405566287",
            provider: "inaturalist",
            externalId: "405566287",
          },
          sourceUrl: "https://www.gbif.org/occurrence/6129944648",
          license: null,
          dataset: {
            externalId: "50c9509d-22c7-4a22-a47d-8c48425ef4a7",
            title: "iNaturalist Research-grade Observations",
            publisherExternalId: null,
            publisherName: "iNaturalist",
          },
        },
      ],
    });
    const storedPages = new Map<string, StoredSpeciesObservationPage>();
    const findProviderExternalId = vi
      .fn()
      .mockImplementation((_speciesId: string, provider: string) =>
        Promise.resolve(provider === "iNaturalist" ? "1696537" : "2441184"),
      );
    const findPage = vi
      .fn()
      .mockImplementation((_speciesId: string, provider: string) =>
        Promise.resolve(storedPages.get(provider) ?? null),
      );
    const replacePage = vi
      .fn()
      .mockImplementation(
        (
          _speciesId: string,
          provider: string,
          page: Omit<StoredSpeciesObservationPage, "lastSuccessfulSyncAt">,
        ) => {
          const storedPage = { ...page, lastSuccessfulSyncAt: synchronizedAt };

          storedPages.set(provider, storedPage);
          return Promise.resolve(storedPage);
        },
      );
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {
        providerName: "iNaturalist",
        getObservations: getINaturalistObservations,
      } as INaturalistObservationProvider,
      createGBIFObservationProvider(getGBIFObservations),
      { findProviderExternalId } as Pick<
        SpeciesRepository,
        "findProviderExternalId"
      > as SpeciesRepository,
      { findPage, replacePage } as Pick<
        ObservationRepository,
        "findPage" | "replacePage"
      > as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(
      service.getObservations("42", { page: 1, perPage: 20 }),
    ).resolves.toMatchObject({
      metadata: { servedFrom: "provider-sync", freshness: "fresh" },
    });
    expect(getINaturalistObservations).toHaveBeenCalledWith(1696537, {
      page: 1,
      perPage: 20,
    });
    expect(getGBIFObservations).toHaveBeenCalledWith(2441184, {
      page: 1,
      perPage: 20,
    });
    expect(replacePage).toHaveBeenCalledWith(
      "42",
      "GBIF",
      expect.objectContaining({
        results: [
          expect.objectContaining({
            deduplication: {
              key: "inaturalist:405566287",
              method: "gbif-occurrence-id",
            },
          }),
        ],
      }),
    );
  });

  it("serves a fresh exact page from PostgreSQL without calling the provider", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    const getObservations = vi.fn();
    const findPage = vi.fn().mockResolvedValue(createStoredPage());
    const replacePage = vi.fn();
    const service = createObservationService({
      getObservations,
      findPage,
      replacePage,
    });

    await expect(
      service.getObservations("42", { page: 2, perPage: 20 }),
    ).resolves.toMatchObject({
      metadata: {
        servedFrom: "local-database",
        freshness: "fresh",
        lastSuccessfulSyncAt: synchronizedAt,
      },
      results: [normalizedObservation],
    });
    expect(getObservations).not.toHaveBeenCalled();
    expect(replacePage).not.toHaveBeenCalled();
  });

  it("refreshes a page at the freshness boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T12:30:00.000Z"));
    const stalePage = createStoredPage();
    const refreshedPage = createStoredPage({
      lastSuccessfulSyncAt: "2026-10-09T12:30:00.000Z",
    });
    const getObservations = vi.fn().mockResolvedValue({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [],
    });
    const findPage = vi
      .fn()
      .mockResolvedValueOnce(stalePage)
      .mockResolvedValueOnce(refreshedPage);
    const replacePage = vi.fn().mockResolvedValue(refreshedPage);
    const service = createObservationService({
      getObservations,
      findPage,
      replacePage,
    });

    await expect(
      service.getObservations("42", { page: 2, perPage: 20 }),
    ).resolves.toMatchObject({
      metadata: {
        servedFrom: "provider-sync",
        freshness: "fresh",
      },
    });
    expect(getObservations).toHaveBeenCalledOnce();
    expect(replacePage).toHaveBeenCalledOnce();
  });

  it("returns a stale page when a provider refresh fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T13:00:00.000Z"));
    const providerError = new ProviderError("iNaturalist is unavailable", {
      kind: "unavailable",
      provider: "iNaturalist",
    });
    const getObservations = vi.fn().mockRejectedValue(providerError);
    const findPage = vi.fn().mockResolvedValue(createStoredPage());
    const replacePage = vi.fn();
    const service = createObservationService({
      getObservations,
      findPage,
      replacePage,
    });

    await expect(
      service.getObservations("42", { page: 2, perPage: 20 }),
    ).resolves.toMatchObject({
      metadata: {
        servedFrom: "local-database",
        freshness: "stale",
        lastSuccessfulSyncAt: synchronizedAt,
      },
    });
    expect(replacePage).not.toHaveBeenCalled();
  });

  it("propagates a provider failure when no persisted page exists", async () => {
    const providerError = new ProviderError("iNaturalist timed out", {
      kind: "timeout",
      provider: "iNaturalist",
    });
    const getObservations = vi.fn().mockRejectedValue(providerError);
    const findPage = vi.fn().mockResolvedValue(null);
    const replacePage = vi.fn();
    const service = createObservationService({
      getObservations,
      findPage,
      replacePage,
    });

    await expect(
      service.getObservations("42", { page: 1, perPage: 50 }),
    ).rejects.toBe(providerError);
    expect(replacePage).not.toHaveBeenCalled();
  });

  it("does not read or request observations when the species mapping is missing", async () => {
    const getObservations = vi.fn();
    const findProviderExternalId = vi.fn().mockResolvedValue(null);
    const findPage = vi.fn();
    const replacePage = vi.fn();
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {
        providerName: "iNaturalist",
        getObservations,
      } as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { findProviderExternalId } as Pick<
        SpeciesRepository,
        "findProviderExternalId"
      > as SpeciesRepository,
      { findPage, replacePage } as Pick<
        ObservationRepository,
        "findPage" | "replacePage"
      > as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(
      service.getObservations("404", { page: 1, perPage: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findPage).not.toHaveBeenCalled();
    expect(getObservations).not.toHaveBeenCalled();
    expect(replacePage).not.toHaveBeenCalled();
  });

  it("returns locally synchronized bounding-box observations as GeoJSON", async () => {
    const exists = vi.fn().mockResolvedValue(true);
    const findWithinBoundingBox = vi.fn().mockResolvedValue({
      observations: [groupedObservation],
      truncated: true,
    });
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { exists } as Pick<SpeciesRepository, "exists"> as SpeciesRepository,
      { findWithinBoundingBox } as Pick<
        ObservationRepository,
        "findWithinBoundingBox"
      > as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );
    const boundingBox = {
      west: 20,
      south: 51,
      east: 24,
      north: 54,
    };

    await expect(
      service.getObservationsWithinBoundingBox("42", boundingBox, 100),
    ).resolves.toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [23.2064155596, 53.4029839302],
          },
          properties: {
            observedOn: "2026-10-03",
            observedAt: "2026-10-03T14:45:26.000Z",
            accuracyMeters: 25_876,
            locationPrecision: "limited",
            locationPrivacy: "obscured",
            sources: [normalizedObservation.source],
          },
        },
      ],
      metadata: {
        datasetScope: "locally-synchronized",
        truncated: true,
      },
    });
    expect(exists).toHaveBeenCalledWith("42");
    expect(findWithinBoundingBox).toHaveBeenCalledWith("42", boundingBox, 100);
  });

  it("does not query a bounding box when the species is missing", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const findWithinBoundingBox = vi.fn();
    const service = new SpeciesService(
      {} as INaturalistSpeciesSearchProvider,
      {} as INaturalistObservationProvider,
      createGBIFObservationProvider(),
      { exists } as Pick<SpeciesRepository, "exists"> as SpeciesRepository,
      { findWithinBoundingBox } as Pick<
        ObservationRepository,
        "findWithinBoundingBox"
      > as ObservationRepository,
      {} as SpeciesIdentityResolver,
    );

    await expect(
      service.getObservationsWithinBoundingBox(
        "404",
        { west: 20, south: 51, east: 24, north: 54 },
        100,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findWithinBoundingBox).not.toHaveBeenCalled();
  });
});

function createObservationService({
  getObservations,
  findPage,
  replacePage,
}: {
  getObservations: ReturnType<typeof vi.fn>;
  findPage: ReturnType<typeof vi.fn>;
  replacePage: ReturnType<typeof vi.fn>;
}): SpeciesService {
  const findProviderExternalId = vi
    .fn()
    .mockResolvedValueOnce("1696537")
    .mockResolvedValueOnce(null);

  return new SpeciesService(
    {} as INaturalistSpeciesSearchProvider,
    {
      providerName: "iNaturalist",
      getObservations,
    } as INaturalistObservationProvider,
    createGBIFObservationProvider(),
    { findProviderExternalId } as Pick<
      SpeciesRepository,
      "findProviderExternalId"
    > as SpeciesRepository,
    { findPage, replacePage } as Pick<
      ObservationRepository,
      "findPage" | "replacePage"
    > as ObservationRepository,
    {} as SpeciesIdentityResolver,
  );
}
