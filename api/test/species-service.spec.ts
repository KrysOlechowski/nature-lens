import { NotFoundException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { INaturalistAdapter } from "../src/inaturalist/inaturalist.adapter.js";
import { ProviderError } from "../src/provider-errors/provider.error.js";
import type { ObservationRepository } from "../src/species/observation.repository.js";
import type { StoredSpeciesObservationPage } from "../src/species/species-observation.model.js";
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
  source: {
    provider: "iNaturalist",
    externalId: "405566287",
    url: "https://www.inaturalist.org/observations/405566287",
  },
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

afterEach(() => {
  vi.useRealTimers();
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
    const iNaturalistAdapter = {
      searchSpecies,
    } as Pick<INaturalistAdapter, "searchSpecies"> as INaturalistAdapter;
    const upsert = vi.fn().mockResolvedValue("42");
    const speciesRepository = {
      upsert,
    } as Pick<SpeciesRepository, "upsert"> as SpeciesRepository;
    const observationRepository = {} as ObservationRepository;
    const service = new SpeciesService(
      iNaturalistAdapter,
      speciesRepository,
      observationRepository,
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
    expect(upsert).toHaveBeenCalledWith({
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
    });
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
        },
      ],
    });
    const findProviderExternalId = vi.fn().mockResolvedValue("1696537");
    const findPage = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createStoredPage());
    const replacePage = vi.fn().mockResolvedValue(createStoredPage());
    const service = new SpeciesService(
      { getObservations } as Pick<
        INaturalistAdapter,
        "getObservations"
      > as INaturalistAdapter,
      { findProviderExternalId } as Pick<
        SpeciesRepository,
        "findProviderExternalId"
      > as SpeciesRepository,
      { findPage, replacePage } as Pick<
        ObservationRepository,
        "findPage" | "replacePage"
      > as ObservationRepository,
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
      { getObservations } as Pick<
        INaturalistAdapter,
        "getObservations"
      > as INaturalistAdapter,
      { findProviderExternalId } as Pick<
        SpeciesRepository,
        "findProviderExternalId"
      > as SpeciesRepository,
      { findPage, replacePage } as Pick<
        ObservationRepository,
        "findPage" | "replacePage"
      > as ObservationRepository,
    );

    await expect(
      service.getObservations("404", { page: 1, perPage: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findPage).not.toHaveBeenCalled();
    expect(getObservations).not.toHaveBeenCalled();
    expect(replacePage).not.toHaveBeenCalled();
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
  const findProviderExternalId = vi.fn().mockResolvedValue("1696537");

  return new SpeciesService(
    { getObservations } as Pick<
      INaturalistAdapter,
      "getObservations"
    > as INaturalistAdapter,
    { findProviderExternalId } as Pick<
      SpeciesRepository,
      "findProviderExternalId"
    > as SpeciesRepository,
    { findPage, replacePage } as Pick<
      ObservationRepository,
      "findPage" | "replacePage"
    > as ObservationRepository,
  );
}
