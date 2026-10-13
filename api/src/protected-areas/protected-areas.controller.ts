import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { boundingBoxSchema } from "../request-protection/request-bounds.js";
import { EXPENSIVE_REQUEST_THROTTLE } from "../request-protection/request-protection.config.js";
import { ProtectedAreaFeatureCollectionDto } from "./protected-area.dto.js";
import { ProtectedAreasService } from "./protected-areas.service.js";

const INVALID_BOUNDING_BOX_MESSAGE =
  'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges, increasing non-antimeridian bounds, longitude span no greater than 20 degrees, and latitude span no greater than 15 degrees';

@Controller("protected-areas")
export class ProtectedAreasController {
  constructor(private readonly protectedAreasService: ProtectedAreasService) {}

  @Throttle(EXPENSIVE_REQUEST_THROTTLE)
  @Get()
  async getProtectedAreas(
    @Query("bbox") boundingBox: unknown,
  ): Promise<ProtectedAreaFeatureCollectionDto> {
    const parsedBoundingBox = boundingBoxSchema.safeParse(boundingBox);

    if (!parsedBoundingBox.success) {
      throw new BadRequestException(INVALID_BOUNDING_BOX_MESSAGE);
    }

    const collection = await this.protectedAreasService.getWithinBoundingBox(
      parsedBoundingBox.data,
    );

    return new ProtectedAreaFeatureCollectionDto(collection);
  }
}
