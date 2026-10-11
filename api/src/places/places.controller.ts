import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { PlaceDto } from "./place.dto.js";
import { PlacesService } from "./places.service.js";

const placeSearchQuerySchema = z.string().trim().min(1);
const INVALID_QUERY_MESSAGE = 'Query parameter "q" must be a non-empty string';

@Controller("places")
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get("search")
  async searchPlaces(@Query("q") query: unknown): Promise<PlaceDto[]> {
    const parsedQuery = placeSearchQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException(INVALID_QUERY_MESSAGE);
    }

    const places = await this.placesService.searchPlaces(parsedQuery.data);

    return places.map((place) => new PlaceDto(place));
  }
}
