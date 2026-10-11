import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { PlaceDto } from "./place.dto.js";
import { PlacesService } from "./places.service.js";

const placeSearchQuerySchema = z.string().trim().min(1);
const placeIdSchema = z.string().trim().min(1).max(200);
const INVALID_QUERY_MESSAGE = 'Query parameter "q" must be a non-empty string';
const INVALID_PLACE_ID_MESSAGE =
  'Path parameter "id" must be a non-empty string no longer than 200 characters';

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

  @Get(":id")
  async getPlace(@Param("id") id: unknown): Promise<PlaceDto> {
    const parsedId = placeIdSchema.safeParse(id);

    if (!parsedId.success) {
      throw new BadRequestException(INVALID_PLACE_ID_MESSAGE);
    }

    const place = await this.placesService.getPlace(parsedId.data);

    return new PlaceDto(place);
  }
}
