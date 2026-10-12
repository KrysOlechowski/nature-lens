import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import {
  MAX_BOUNDING_BOX_OBSERVATIONS,
  MAX_BOUNDING_BOX_SPECIES,
  type ObservationBoundingBox,
} from "./observation.repository.js";
import { SpatialObservationFeatureCollectionDto } from "./spatial-observation.dto.js";
import { SpatialObservationsService } from "./spatial-observations.service.js";

const positiveIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);
const coordinateStringSchema = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .refine(Number.isFinite);
const longitudeStringSchema = coordinateStringSchema.refine(
  (value) => value >= -180 && value <= 180,
);
const latitudeStringSchema = coordinateStringSchema.refine(
  (value) => value >= -90 && value <= 90,
);
const boundingBoxSchema = z
  .string()
  .transform((value) => value.split(","))
  .pipe(
    z.tuple([
      longitudeStringSchema,
      latitudeStringSchema,
      longitudeStringSchema,
      latitudeStringSchema,
    ]),
  )
  .transform<ObservationBoundingBox>(([west, south, east, north]) => ({
    west,
    south,
    east,
    north,
  }))
  .refine(({ west, east }) => west < east)
  .refine(({ south, north }) => south < north);
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
  'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges and increasing bounds; "limit" must be a positive integer no greater than 1000; "speciesLimit" must be a positive integer no greater than 100';
const DEFAULT_SPATIAL_OBSERVATIONS_LIMIT = "1000";
const DEFAULT_SPATIAL_SPECIES_LIMIT = "25";

@Controller("observations")
export class SpatialObservationsController {
  constructor(
    private readonly spatialObservationsService: SpatialObservationsService,
  ) {}

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
