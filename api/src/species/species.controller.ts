import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { SpeciesObservationPageDto } from "./species-observation.dto.js";
import { SpeciesSearchResultDto } from "./species-search-result.dto.js";
import { SpeciesService } from "./species.service.js";

const speciesSearchQuerySchema = z.string().trim().min(1);
const INVALID_QUERY_MESSAGE = 'Query parameter "q" must be a non-empty string';
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
const INVALID_OBSERVATIONS_REQUEST_MESSAGE =
  'Path parameter "id" and query parameters "page" and "perPage" must be positive integers; "perPage" cannot exceed 200';
const DEFAULT_OBSERVATIONS_PAGE = "1";
const DEFAULT_OBSERVATIONS_PER_PAGE = "50";

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

  @Get(":id/observations")
  async getObservations(
    @Param("id") id: unknown,
    @Query("page") page: unknown,
    @Query("perPage") perPage: unknown,
  ): Promise<SpeciesObservationPageDto> {
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
