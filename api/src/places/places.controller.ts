import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { searchQuerySchema } from "../request-protection/request-bounds.js";
import { EXPENSIVE_REQUEST_THROTTLE } from "../request-protection/request-protection.config.js";
import { PlaceDto } from "./place.dto.js";
import { PlacesService } from "./places.service.js";

const placeIdSchema = z.string().trim().min(1).max(200);
const INVALID_QUERY_MESSAGE =
  'Query parameter "q" must be a non-empty string no longer than 100 characters';
const INVALID_PLACE_ID_MESSAGE =
  'Path parameter "id" must be a non-empty string no longer than 200 characters';

@Controller("places")
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
  @Get("search")
  async searchPlaces(@Query("q") query: unknown): Promise<PlaceDto[]> {
    const parsedQuery = searchQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException(INVALID_QUERY_MESSAGE);
    }

    const places = await this.placesService.searchPlaces(parsedQuery.data);

    return places.map((place) => new PlaceDto(place));
  }

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
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
