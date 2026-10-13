import { describe, expect, it } from "vitest";
import {
  boundingBoxSchema,
  isWithinPaginationResultWindow,
  positiveIntegerStringSchema,
  searchQuerySchema,
} from "../src/request-protection/request-bounds.js";

describe("request bounds", () => {
  it("accepts a trimmed 100-character query and rejects 101 characters", () => {
    expect(searchQuerySchema.safeParse(` ${"a".repeat(100)} `).success).toBe(
      true,
    );
    expect(searchQuerySchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("accepts the maximum pagination window and rejects a larger one", () => {
    expect(isWithinPaginationResultWindow({ page: 500, perPage: 200 })).toBe(
      true,
    );
    expect(isWithinPaginationResultWindow({ page: 501, perPage: 200 })).toBe(
      false,
    );
  });

  it("rejects unsafe integers before pagination calculations", () => {
    expect(
      positiveIntegerStringSchema.safeParse("9007199254740992").success,
    ).toBe(false);
    expect(
      isWithinPaginationResultWindow({
        page: Number.MAX_SAFE_INTEGER,
        perPage: Number.MAX_SAFE_INTEGER,
      }),
    ).toBe(false);
  });

  it("accepts the whole-Poland bounding box", () => {
    expect(boundingBoxSchema.safeParse("14.12,49,24.15,54.84")).toMatchObject({
      success: true,
      data: { west: 14.12, south: 49, east: 24.15, north: 54.84 },
    });
  });

  it.each([
    ["reversed longitude", "22,49,20,51"],
    ["reversed latitude", "20,51,22,49"],
    ["antimeridian crossing", "170,49,-170,51"],
    ["excessive longitude span", "0,49,21,51"],
    ["excessive latitude span", "20,0,22,16"],
  ])("rejects a bounding box with %s", (_case, boundingBox) => {
    expect(boundingBoxSchema.safeParse(boundingBox).success).toBe(false);
  });
});
