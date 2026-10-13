import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  boundingBoxSchema,
  positiveIntegerStringSchema,
} from "../request-protection/request-bounds.js";
import { EXPENSIVE_REQUEST_THROTTLE } from "../request-protection/request-protection.config.js";
import {
  MAX_BOUNDING_BOX_OBSERVATIONS,
  MAX_BOUNDING_BOX_SPECIES,
} from "./observation.repository.js";
import { SpatialObservationFeatureCollectionDto } from "./spatial-observation.dto.js";
import { SpatialObservationsService } from "./spatial-observations.service.js";

const spatialObservationsRequestSchema = z.object({
  boundingBox: boundingBoxSchema,
  limit: positiveIntegerStringSchema.refine(
    (value) => value <= MAX_BOUNDING_BOX_OBSERVATIONS,
  ),
  speciesLimit: positiveIntegerStringSchema.refine(
    (value) => value <= MAX_BOUNDING_BOX_SPECIES,
  ),
});
const INVALID_SPATIAL_OBSERVATIONS_REQUEST_MESSAGE =
  'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges, increasing non-antimeridian bounds, longitude span no greater than 20 degrees, and latitude span no greater than 15 degrees; "limit" must be a positive integer no greater than 1000; "speciesLimit" must be a positive integer no greater than 100';
const DEFAULT_SPATIAL_OBSERVATIONS_LIMIT = "1000";
const DEFAULT_SPATIAL_SPECIES_LIMIT = "25";

@Controller("observations")
export class SpatialObservationsController {
  constructor(
    private readonly spatialObservationsService: SpatialObservationsService,
  ) {}

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
  @Get()
  async getObservations(
    @Query("bbox") boundingBox: unknown,
    @Query("limit") limit?: unknown,
    @Query("speciesLimit") speciesLimit?: unknown,
  ): Promise<SpatialObservationFeatureCollectionDto> {
    const parsedRequest = spatialObservationsRequestSchema.safeParse({
      boundingBox,
      limit: limit ?? DEFAULT_SPATIAL_OBSERVATIONS_LIMIT,
      speciesLimit: speciesLimit ?? DEFAULT_SPATIAL_SPECIES_LIMIT,
    });

    if (!parsedRequest.success) {
      throw new BadRequestException(
        INVALID_SPATIAL_OBSERVATIONS_REQUEST_MESSAGE,
      );
    }

    const collection =
      await this.spatialObservationsService.getWithinBoundingBox(
        parsedRequest.data.boundingBox,
        parsedRequest.data.limit,
        parsedRequest.data.speciesLimit,
      );

    return new SpatialObservationFeatureCollectionDto(collection);
  }
}
