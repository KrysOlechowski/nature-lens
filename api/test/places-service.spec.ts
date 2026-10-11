import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PlaceLookupProvider } from "../src/places/place-lookup-provider.contract.js";
import type { PlaceSearchProvider } from "../src/places/place-search-provider.contract.js";
import { PlacesService } from "../src/places/places.service.js";

const place = {
  id: "osm:node:1686293227",
  slug: "bialowieza",
  label: "Białowieża, Poland",
  type: "village" as const,
  center: {
    longitude: 23.8555,
    latitude: 52.7018,
  },
  bbox: null,
};

function createProviders() {
  const searchProvider: PlaceSearchProvider = {
    providerName: "Test place search provider",
    searchPlaces: vi.fn(),
  };
  const lookupProvider: PlaceLookupProvider = {
    providerName: "Test place lookup provider",
    findPlaceById: vi.fn(),
  };

  return { lookupProvider, searchProvider };
}

describe("PlacesService", () => {
  it("delegates place search through the provider-neutral contract", async () => {
    const { lookupProvider, searchProvider } = createProviders();
    vi.mocked(searchProvider.searchPlaces).mockResolvedValue([place]);
    const service = new PlacesService(searchProvider, lookupProvider);

    await expect(service.searchPlaces("Białowieża")).resolves.toEqual([place]);
    expect(searchProvider.searchPlaces).toHaveBeenCalledWith("Białowieża");
  });

  it("retrieves a place through the provider-neutral lookup contract", async () => {
    const { lookupProvider, searchProvider } = createProviders();
    vi.mocked(lookupProvider.findPlaceById).mockResolvedValue(place);
    const service = new PlacesService(searchProvider, lookupProvider);

    await expect(service.getPlace(place.id)).resolves.toEqual(place);
    expect(lookupProvider.findPlaceById).toHaveBeenCalledWith(place.id);
  });

  it("reports a missing provider place as not found", async () => {
    const { lookupProvider, searchProvider } = createProviders();
    vi.mocked(lookupProvider.findPlaceById).mockResolvedValue(null);
    const service = new PlacesService(searchProvider, lookupProvider);

    await expect(service.getPlace("unsupported:place:1")).rejects.toThrowError(
      new NotFoundException("Place was not found"),
    );
  });
});
