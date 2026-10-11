import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  NOMINATIM_PLACE_LOOKUP_PROVIDER,
  NOMINATIM_PLACE_SEARCH_PROVIDER,
} from "../nominatim/nominatim.tokens.js";
import type { PlaceLookupProvider } from "./place-lookup-provider.contract.js";
import type { PlaceSearchProvider } from "./place-search-provider.contract.js";
import type { Place } from "./place.model.js";

@Injectable()
export class PlacesService {
  constructor(
    @Inject(NOMINATIM_PLACE_SEARCH_PROVIDER)
    private readonly placeSearchProvider: PlaceSearchProvider,
    @Inject(NOMINATIM_PLACE_LOOKUP_PROVIDER)
    private readonly placeLookupProvider: PlaceLookupProvider,
  ) {}

  searchPlaces(query: string): Promise<Place[]> {
    return this.placeSearchProvider.searchPlaces(query);
  }

  async getPlace(placeId: string): Promise<Place> {
    const place = await this.placeLookupProvider.findPlaceById(placeId);

    if (!place) {
      throw new NotFoundException("Place was not found");
    }

    return place;
  }
}
