import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PlacesController } from "../src/places/places.controller.js";
import type { PlacesService } from "../src/places/places.service.js";

describe("PlacesController", () => {
  it("returns normalized place search response DTOs", async () => {
    const searchPlaces = vi.fn().mockResolvedValue([
      {
        id: "osm:relation:61493",
        slug: "puszcza-niepolomicka",
        label: "Puszcza Niepołomicka, Poland",
        type: "natural-area",
        center: {
          longitude: 20.3907,
          latitude: 50.0378,
        },
        bbox: {
          west: 20.214,
          south: 49.957,
          east: 20.574,
          north: 50.118,
        },
      },
    ]);
    const placesService = {
      searchPlaces,
    } as Pick<PlacesService, "searchPlaces"> as PlacesService;
    const controller = new PlacesController(placesService);

    await expect(
      controller.searchPlaces("  Puszcza Niepołomicka  "),
    ).resolves.toEqual([
      {
        id: "osm:relation:61493",
        slug: "puszcza-niepolomicka",
        label: "Puszcza Niepołomicka, Poland",
        type: "natural-area",
        center: {
          longitude: 20.3907,
          latitude: 50.0378,
        },
        bbox: {
          west: 20.214,
          south: 49.957,
          east: 20.574,
          north: 50.118,
        },
      },
    ]);
    expect(searchPlaces).toHaveBeenCalledWith("Puszcza Niepołomicka");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["repeated", ["Kraków", "Warsaw"]],
  ])("rejects a %s query with a bad request", async (_case, query) => {
    const searchPlaces = vi.fn();
    const placesService = {
      searchPlaces,
    } as Pick<PlacesService, "searchPlaces"> as PlacesService;
    const controller = new PlacesController(placesService);

    const request = controller.searchPlaces(query);

    await expect(request).rejects.toBeInstanceOf(BadRequestException);
    await expect(request).rejects.toMatchObject({
      response: {
        error: "Bad Request",
        message: 'Query parameter "q" must be a non-empty string',
        statusCode: 400,
      },
      status: 400,
    });
    expect(searchPlaces).not.toHaveBeenCalled();
  });
});
