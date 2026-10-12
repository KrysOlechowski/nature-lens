import { Injectable } from "@nestjs/common";
import {
  ObservationRepository,
  type ObservationBoundingBox,
} from "./observation.repository.js";
import type {
  SpatialObservation,
  SpatialObservationFeature,
  SpatialObservationFeatureCollection,
} from "./spatial-observation.model.js";

@Injectable()
export class SpatialObservationsService {
  constructor(private readonly observationRepository: ObservationRepository) {}

  async getWithinBoundingBox(
    boundingBox: ObservationBoundingBox,
    observationLimit: number,
    speciesLimit: number,
  ): Promise<SpatialObservationFeatureCollection> {
    const result =
      await this.observationRepository.findAllSpeciesWithinBoundingBox(
        boundingBox,
        observationLimit,
        speciesLimit,
      );

    return {
      type: "FeatureCollection",
      features: result.observations.map(toSpatialObservationFeature),
      species: {
        items: result.species,
        returnedCount: result.species.length,
        totalCount: result.totalSpeciesCount,
        truncated: result.species.length < result.totalSpeciesCount,
      },
      metadata: {
        datasetScope: "locally-synchronized",
        returnedObservationCount: result.observations.length,
        totalObservationCount: result.totalObservationCount,
        truncated: result.observations.length < result.totalObservationCount,
      },
    };
  }
}

function toSpatialObservationFeature(
  observation: SpatialObservation,
): SpatialObservationFeature {
  if (!observation.location) {
    throw new Error("Spatial observation query returned a missing location");
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [
        observation.location.longitude,
        observation.location.latitude,
      ],
    },
    properties: {
      species: observation.species,
      observedOn: observation.observedOn,
      observedAt: observation.observedAt,
      accuracyMeters: observation.location.accuracyMeters,
      locationPrecision: observation.location.precision,
      locationPrivacy: observation.locationPrivacy,
      sources: observation.sources,
    },
  };
}
