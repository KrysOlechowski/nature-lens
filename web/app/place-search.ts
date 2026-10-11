import { placeSearchResponseSchema, type Place } from "./place";
import { environment } from "../env";

export type PlaceSearchResponse =
  | {
      status: "success";
      results: Place[];
    }
  | {
      status: "unavailable";
    };

export async function searchPlaces(
  query: string,
): Promise<PlaceSearchResponse> {
  try {
    const url = new URL(
      "/api/places/search",
      environment.NEXT_PUBLIC_API_BASE_URL,
    );
    url.searchParams.set("q", query);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const results = placeSearchResponseSchema.safeParse(await response.json());

    if (!results.success) {
      return { status: "unavailable" };
    }

    return { status: "success", results: results.data };
  } catch {
    return { status: "unavailable" };
  }
}
