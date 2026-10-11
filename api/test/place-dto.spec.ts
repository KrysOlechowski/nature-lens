import { describe, expect, it } from "vitest";
import { PlaceDto } from "../src/places/place.dto.js";

describe("PlaceDto", () => {
  it("maps a place with its provider-supplied bounding box", () => {
    const dto = new PlaceDto({
      id: "opaque-place-id",
      slug: "kampinos-national-park",
      label: "Kampinos National Park",
      type: "natural-area",
      center: {
        longitude: 20.594,
        latitude: 52.286,
      },
      bbox: {
        west: 20.285,
        south: 52.193,
        east: 20.88,
        north: 52.377,
      },
    });

    expect(dto).toEqual({
      id: "opaque-place-id",
      slug: "kampinos-national-park",
      label: "Kampinos National Park",
      type: "natural-area",
      center: {
        longitude: 20.594,
        latitude: 52.286,
      },
      bbox: {
        west: 20.285,
        south: 52.193,
        east: 20.88,
        north: 52.377,
      },
    });
  });

  it("preserves a missing bounding box as null", () => {
    const dto = new PlaceDto({
      id: "another-opaque-place-id",
      slug: "example-place",
      label: "Example Place",
      type: "other",
      center: {
        longitude: 19,
        latitude: 52,
      },
      bbox: null,
    });

    expect(dto.bbox).toBeNull();
  });
});
