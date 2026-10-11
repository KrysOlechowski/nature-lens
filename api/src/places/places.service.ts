import { Inject, Injectable } from "@nestjs/common";
import { NOMINATIM_PLACE_SEARCH_PROVIDER } from "../nominatim/nominatim.tokens.js";
import type { PlaceSearchProvider } from "./place-search-provider.contract.js";
import type { Place } from "./place.model.js";

@Injectable()
export class PlacesService {
  constructor(
    @Inject(NOMINATIM_PLACE_SEARCH_PROVIDER)
    private readonly placeSearchProvider: PlaceSearchProvider,
  ) {}

  searchPlaces(query: string): Promise<Place[]> {
    return this.placeSearchProvider.searchPlaces(query);
  }
}
