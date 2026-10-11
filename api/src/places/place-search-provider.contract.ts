import type { Place } from "./place.model.js";

export interface PlaceSearchProvider {
  readonly providerName: string;
  searchPlaces(query: string): Promise<Place[]>;
}
