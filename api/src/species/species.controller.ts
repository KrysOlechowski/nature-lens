import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  boundingBoxSchema,
  isWithinPaginationResultWindow,
  positiveIntegerStringSchema,
  searchQuerySchema,
} from "../request-protection/request-bounds.js";
import { EXPENSIVE_REQUEST_THROTTLE } from "../request-protection/request-protection.config.js";
import { MAX_BOUNDING_BOX_OBSERVATIONS } from "./observation.repository.js";
import { SpeciesDetailDto } from "./species-detail.dto.js";
import { SpeciesObservationGeoJsonDto } from "./species-observation-geojson.dto.js";
import { SpeciesObservationSeasonalityDto } from "./species-observation-seasonality.dto.js";
import { SpeciesObservationPageDto } from "./species-observation.dto.js";
import { SpeciesSearchResultDto } from "./species-search-result.dto.js";
import { SpeciesService } from "./species.service.js";

const INVALID_QUERY_MESSAGE =
  'Query parameter "q" must be a non-empty string no longer than 100 characters';
const INVALID_SPECIES_ID_MESSAGE =
  'Path parameter "id" must be a positive integer';
const maximumPostgreSqlBigInt = 9_223_372_036_854_775_807n;
const positiveBigIntStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine(
    (value) =>
      !/^[1-9]\d*$/.test(value) || BigInt(value) <= maximumPostgreSqlBigInt,
  );
const observationsRequestSchema = z
  .object({
    speciesId: positiveBigIntStringSchema,
    page: positiveIntegerStringSchema,
    perPage: positiveIntegerStringSchema.refine((value) => value <= 200),
  })
  .refine(isWithinPaginationResultWindow);
const spatialObservationsRequestSchema = z.object({
  speciesId: positiveBigIntStringSchema,
  boundingBox: boundingBoxSchema,
  limit: positiveIntegerStringSchema.refine(
    (value) => value <= MAX_BOUNDING_BOX_OBSERVATIONS,
  ),
});
const INVALID_OBSERVATIONS_REQUEST_MESSAGE =
  'Path parameter "id" and query parameters "page" and "perPage" must be positive integers; "perPage" cannot exceed 200; the requested page window cannot exceed 100000 records';
const INVALID_SPATIAL_OBSERVATIONS_REQUEST_MESSAGE =
  'Path parameter "id" must be a positive integer; "bbox" must contain west,south,east,north coordinates with valid ranges, increasing non-antimeridian bounds, longitude span no greater than 20 degrees, and latitude span no greater than 15 degrees; "limit" must be a positive integer no greater than 1000; spatial and pagination parameters cannot be combined';
const DEFAULT_OBSERVATIONS_PAGE = "1";
const DEFAULT_OBSERVATIONS_PER_PAGE = "50";
const DEFAULT_SPATIAL_OBSERVATIONS_LIMIT = "1000";

@Controller("species")
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
  @Get("search")
  async searchSpecies(
    @Query("q") query: unknown,
  ): Promise<SpeciesSearchResultDto[]> {
    const parsedQuery = searchQuerySchema.safeParse(query);

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

  @Get(":id/observation-seasonality")
  async getObservationSeasonality(
    @Param("id") id: unknown,
  ): Promise<SpeciesObservationSeasonalityDto> {
    const parsedId = positiveBigIntStringSchema.safeParse(id);

    if (!parsedId.success) {
      throw new BadRequestException(INVALID_SPECIES_ID_MESSAGE);
    }

    const seasonality = await this.speciesService.getObservationSeasonality(
      parsedId.data,
    );

    return new SpeciesObservationSeasonalityDto(seasonality);
  }

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
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
