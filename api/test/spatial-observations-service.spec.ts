import { describe, expect, it, vi } from "vitest";
import type { ObservationRepository } from "../src/species/observation.repository.js";
import { SpatialObservationsService } from "../src/species/spatial-observations.service.js";

describe("SpatialObservationsService", () => {
  it("keeps exact bbox totals separate from limited feature and species lists", async () => {
    const findAllSpeciesWithinBoundingBox = vi.fn().mockResolvedValue({
      observations: [
        {
          species: {
            id: "42",
            scientificName: "Bos bonasus",
            displayName: "European bison",
          },
          observedOn: "2026-10-03",
          observedAt: "2026-10-03T14:45:26.000Z",
          location: {
            longitude: 21.0122,
            latitude: 52.2297,
            accuracyMeters: 10,
            precision: "approximate",
          },
          locationPrivacy: "open",
          sources: [
            {
              provider: "iNaturalist",
              externalId: "405566287",
              url: "https://www.inaturalist.org/observations/405566287",
              license: null,
              dataset: null,
            },
          ],
        },
      ],
      species: [
        {
          id: "42",
          scientificName: "Bos bonasus",
          displayName: "European bison",
          observationCount: 7,
        },
      ],
      totalObservationCount: 12,
      totalSpeciesCount: 3,
    });
    const repository = {
      findAllSpeciesWithinBoundingBox,
    } as Pick<
      ObservationRepository,
      "findAllSpeciesWithinBoundingBox"
    > as ObservationRepository;
    const service = new SpatialObservationsService(repository);

    await expect(
      service.getWithinBoundingBox(
        { west: 20, south: 49, east: 22, north: 51 },
        1,
        1,
      ),
    ).resolves.toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [21.0122, 52.2297],
          },
          properties: {
            species: {
              id: "42",
              scientificName: "Bos bonasus",
              displayName: "European bison",
            },
            observedOn: "2026-10-03",
            observedAt: "2026-10-03T14:45:26.000Z",
            accuracyMeters: 10,
            locationPrecision: "approximate",
            locationPrivacy: "open",
            sources: [
              {
                provider: "iNaturalist",
                externalId: "405566287",
                url: "https://www.inaturalist.org/observations/405566287",
                license: null,
                dataset: null,
              },
            ],
          },
        },
      ],
      species: {
        items: [
          {
            id: "42",
            scientificName: "Bos bonasus",
            displayName: "European bison",
            observationCount: 7,
          },
        ],
        returnedCount: 1,
        totalCount: 3,
        truncated: true,
      },
      metadata: {
        datasetScope: "locally-synchronized",
        returnedObservationCount: 1,
        totalObservationCount: 12,
        truncated: true,
      },
    });
  });
});
