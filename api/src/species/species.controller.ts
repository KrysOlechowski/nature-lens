import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import {
  MAX_BOUNDING_BOX_OBSERVATIONS,
  type ObservationBoundingBox,
} from "./observation.repository.js";
import { SpeciesDetailDto } from "./species-detail.dto.js";
import { SpeciesObservationGeoJsonDto } from "./species-observation-geojson.dto.js";
import { SpeciesObservationPageDto } from "./species-observation.dto.js";
import { SpeciesSearchResultDto } from "./species-search-result.dto.js";
import { SpeciesService } from "./species.service.js";

const speciesSearchQuerySchema = z.string().trim().min(1);
const INVALID_QUERY_MESSAGE = 'Query parameter "q" must be a non-empty string';
const INVALID_SPECIES_ID_MESSAGE =
  'Path parameter "id" must be a positive integer';
const positiveIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);
const maximumPostgreSqlBigInt = 9_223_372_036_854_775_807n;
const positiveBigIntStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine(
    (value) =>
      !/^[1-9]\d*$/.test(value) || BigInt(value) <= maximumPostgreSqlBigInt,
  );
const observationsRequestSchema = z.object({
  speciesId: positiveBigIntStringSchema,
  page: positiveIntegerStringSchema,
  perPage: positiveIntegerStringSchema.refine((value) => value <= 200),
});
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
  speciesId: positiveBigIntStringSchema,
  boundingBox: boundingBoxSchema,
  limit: positiveIntegerStringSchema.refine(
    (value) => value <= MAX_BOUNDING_BOX_OBSERVATIONS,
  ),
});
const INVALID_OBSERVATIONS_REQUEST_MESSAGE =
  'Path parameter "id" and query parameters "page" and "perPage" must be positive integers; "perPage" cannot exceed 200';
const INVALID_SPATIAL_OBSERVATIONS_REQUEST_MESSAGE =
  'Path parameter "id" must be a positive integer; "bbox" must contain west,south,east,north coordinates with valid ranges and increasing bounds; "limit" must be a positive integer no greater than 1000; spatial and pagination parameters cannot be combined';
const DEFAULT_OBSERVATIONS_PAGE = "1";
const DEFAULT_OBSERVATIONS_PER_PAGE = "50";
const DEFAULT_SPATIAL_OBSERVATIONS_LIMIT = "1000";

@Controller("species")
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get("search")
  async searchSpecies(
    @Query("q") query: unknown,
  ): Promise<SpeciesSearchResultDto[]> {
    const parsedQuery = speciesSearchQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException(INVALID_QUERY_MESSAGE);
    }

    const results = await this.speciesService.searchSpecies(parsedQuery.data);

    return results.map((result) => new SpeciesSearchResultDto(result));
  }

  @Get(":id")
  async getSpecies(@Param("id") id: unknown): Promise<SpeciesDetailDto> {
    const parsedId = positiveBigIntStringSchema.safeParse(id);

    if (!parsedId.success) {
      throw new BadRequestException(INVALID_SPECIES_ID_MESSAGE);
    }

    const species = await this.speciesService.getSpecies(parsedId.data);

    return new SpeciesDetailDto(species);
  }

  @Get(":id/observations")
  async getObservations(
    @Param("id") id: unknown,
    @Query("page") page: unknown,
    @Query("perPage") perPage: unknown,
    @Query("bbox") boundingBox?: unknown,
    @Query("limit") limit?: unknown,
  ): Promise<SpeciesObservationPageDto | SpeciesObservationGeoJsonDto> {
    const isSpatialRequest = boundingBox !== undefined || limit !== undefined;

    if (isSpatialRequest) {
      const parsedRequest = spatialObservationsRequestSchema.safeParse({
        speciesId: id,
        boundingBox,
        limit: limit ?? DEFAULT_SPATIAL_OBSERVATIONS_LIMIT,
      });

      if (
        !parsedRequest.success ||
        page !== undefined ||
        perPage !== undefined
      ) {
        throw new BadRequestException(
          INVALID_SPATIAL_OBSERVATIONS_REQUEST_MESSAGE,
        );
      }

      const { speciesId, boundingBox: parsedBoundingBox } = parsedRequest.data;
      const collection =
        await this.speciesService.getObservationsWithinBoundingBox(
          speciesId,
          parsedBoundingBox,
          parsedRequest.data.limit,
        );

      return new SpeciesObservationGeoJsonDto(collection);
    }

    const parsedRequest = observationsRequestSchema.safeParse({
      speciesId: id,
      page: page ?? DEFAULT_OBSERVATIONS_PAGE,
      perPage: perPage ?? DEFAULT_OBSERVATIONS_PER_PAGE,
    });

    if (!parsedRequest.success) {
      throw new BadRequestException(INVALID_OBSERVATIONS_REQUEST_MESSAGE);
    }

    const { speciesId, ...pagination } = parsedRequest.data;
    const observationPage = await this.speciesService.getObservations(
      speciesId,
      pagination,
    );

    return new SpeciesObservationPageDto(observationPage);
  }
}
