import { z } from "zod";

export const MAX_SEARCH_QUERY_LENGTH = 100;
export const MAX_PAGINATION_RESULT_WINDOW = 100_000;
export const MAX_BOUNDING_BOX_LONGITUDE_SPAN = 20;
export const MAX_BOUNDING_BOX_LATITUDE_SPAN = 15;

export interface RequestBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SEARCH_QUERY_LENGTH);

export const positiveIntegerStringSchema = z
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

export const boundingBoxSchema = z
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
  .transform<RequestBoundingBox>(([west, south, east, north]) => ({
    west,
    south,
    east,
    north,
  }))
  .refine(({ west, east }) => west < east)
  .refine(({ south, north }) => south < north)
  .refine(({ west, east }) => east - west <= MAX_BOUNDING_BOX_LONGITUDE_SPAN)
  .refine(
    ({ south, north }) => north - south <= MAX_BOUNDING_BOX_LATITUDE_SPAN,
  );

export function isWithinPaginationResultWindow({
  page,
  perPage,
}: {
  page: number;
  perPage: number;
}): boolean {
  return (
    Number.isSafeInteger(page) &&
    Number.isSafeInteger(perPage) &&
    page > 0 &&
    perPage > 0 &&
    page <= Math.floor(MAX_PAGINATION_RESULT_WINDOW / perPage)
  );
}
