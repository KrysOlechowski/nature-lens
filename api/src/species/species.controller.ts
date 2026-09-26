import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { SpeciesSearchResultDto } from "./species-search-result.dto.js";
import { SpeciesService } from "./species.service.js";

const speciesSearchQuerySchema = z.string().trim().min(1);
const INVALID_QUERY_MESSAGE = 'Query parameter "q" must be a non-empty string';

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
}
