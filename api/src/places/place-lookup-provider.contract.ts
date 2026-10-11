import type { Place } from "./place.model.js";

export interface PlaceLookupProvider {
  readonly providerName: string;
  findPlaceById(placeId: string): Promise<Place | null>;
}
