import { describe, expect, it, vi } from "vitest";
import type { PlaceSearchProvider } from "../src/places/place-search-provider.contract.js";
import { PlacesService } from "../src/places/places.service.js";

describe("PlacesService", () => {
  it("delegates place search through the provider-neutral contract", async () => {
    const places = [
      {
        id: "osm:node:1686293227",
        slug: "bialowieza",
        label: "Białowieża, Poland",
        type: "village" as const,
        center: {
          longitude: 23.8555,
          latitude: 52.7018,
        },
        bbox: null,
      },
    ];
    const provider: PlaceSearchProvider = {
      providerName: "Test place provider",
      searchPlaces: vi.fn().mockResolvedValue(places),
    };
    const service = new PlacesService(provider);

    await expect(service.searchPlaces("Białowieża")).resolves.toEqual(places);
    expect(provider.searchPlaces).toHaveBeenCalledWith("Białowieża");
  });
});
