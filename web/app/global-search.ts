import { searchPlaces, type PlaceSearchResponse } from "./place-search";
import { searchSpecies, type SpeciesSearchResponse } from "./species-search";

export interface GlobalSearchResponse {
  places: PlaceSearchResponse;
  species: SpeciesSearchResponse;
}

export async function searchNature(
  query: string,
): Promise<GlobalSearchResponse> {
  const [species, places] = await Promise.all([
    searchSpecies(query),
    searchPlaces(query),
  ]);

  return { places, species };
}
