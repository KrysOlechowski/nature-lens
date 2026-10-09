import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { INaturalistAdapter } from "../src/inaturalist/inaturalist.adapter.js";
import type { ObservationRepository } from "../src/species/observation.repository.js";
import type { SpeciesRepository } from "../src/species/species.repository.js";
import { SpeciesService } from "../src/species/species.service.js";

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

  it("returns normalized observation models instead of provider results", async () => {
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
    const iNaturalistAdapter = {
      getObservations,
    } as Pick<INaturalistAdapter, "getObservations"> as INaturalistAdapter;
    const findProviderExternalId = vi.fn().mockResolvedValue("1696537");
    const speciesRepository = {
      findProviderExternalId,
    } as Pick<SpeciesRepository, "findProviderExternalId"> as SpeciesRepository;
    const upsertMany = vi.fn().mockResolvedValue(undefined);
    const observationRepository = {
      upsertMany,
    } as Pick<ObservationRepository, "upsertMany"> as ObservationRepository;
    const service = new SpeciesService(
      iNaturalistAdapter,
      speciesRepository,
      observationRepository,
    );

    await expect(
      service.getObservations("42", { page: 2, perPage: 20 }),
    ).resolves.toEqual({
      totalResults: 1,
      page: 2,
      perPage: 20,
      results: [
        {
          observedOn: "2026-10-03",
          observedAt: "2026-10-03T16:45:26+02:00",
          location: {
            latitude: 53.4029839302,
            longitude: 23.2064155596,
            accuracyMeters: 25_876,
            precision: "limited",
          },
          locationPrivacy: "obscured",
          source: {
            provider: "iNaturalist",
            externalId: "405566287",
            url: "https://www.inaturalist.org/observations/405566287",
          },
        },
      ],
    });
    expect(getObservations).toHaveBeenCalledWith(1696537, {
      page: 2,
      perPage: 20,
    });
    expect(findProviderExternalId).toHaveBeenCalledWith("42", "iNaturalist");
    expect(upsertMany).toHaveBeenCalledWith("42", [
      {
        observedOn: "2026-10-03",
        observedAt: "2026-10-03T16:45:26+02:00",
        location: {
          latitude: 53.4029839302,
          longitude: 23.2064155596,
          accuracyMeters: 25_876,
          precision: "limited",
        },
        locationPrivacy: "obscured",
        source: {
          provider: "iNaturalist",
          externalId: "405566287",
          url: "https://www.inaturalist.org/observations/405566287",
        },
      },
    ]);
  });

  it("does not request observations when the species mapping is missing", async () => {
    const getObservations = vi.fn();
    const iNaturalistAdapter = {
      getObservations,
    } as Pick<INaturalistAdapter, "getObservations"> as INaturalistAdapter;
    const findProviderExternalId = vi.fn().mockResolvedValue(null);
    const speciesRepository = {
      findProviderExternalId,
    } as Pick<SpeciesRepository, "findProviderExternalId"> as SpeciesRepository;
    const upsertMany = vi.fn();
    const observationRepository = {
      upsertMany,
    } as Pick<ObservationRepository, "upsertMany"> as ObservationRepository;
    const service = new SpeciesService(
      iNaturalistAdapter,
      speciesRepository,
      observationRepository,
    );

    await expect(
      service.getObservations("404", { page: 1, perPage: 50 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getObservations).not.toHaveBeenCalled();
    expect(upsertMany).not.toHaveBeenCalled();
  });
});
