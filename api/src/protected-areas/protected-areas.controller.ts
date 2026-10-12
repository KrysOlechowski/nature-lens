import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { ProtectedAreaFeatureCollectionDto } from "./protected-area.dto.js";
import type { ProtectedAreaBoundingBox } from "./protected-area.model.js";
import { ProtectedAreasService } from "./protected-areas.service.js";

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
  .transform<ProtectedAreaBoundingBox>(([west, south, east, north]) => ({
    west,
    south,
    east,
    north,
  }))
  .refine(({ west, east }) => west < east)
  .refine(({ south, north }) => south < north);
const INVALID_BOUNDING_BOX_MESSAGE =
  'Query parameter "bbox" must contain west,south,east,north coordinates with valid ranges and increasing bounds';

@Controller("protected-areas")
export class ProtectedAreasController {
  constructor(private readonly protectedAreasService: ProtectedAreasService) {}

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
