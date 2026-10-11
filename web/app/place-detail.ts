import { environment } from "../env";
import { placeSchema, type Place } from "./place";

export type PlaceDetailResponse =
  | {
      status: "success";
      place: Place;
    }
  | {
      status: "not-found";
    }
  | {
      status: "unavailable";
    };

export async function getPlace(placeId: string): Promise<PlaceDetailResponse> {
  try {
    const url = new URL(
      `/api/places/${encodeURIComponent(placeId)}`,
      environment.NEXT_PUBLIC_API_BASE_URL,
    );
    const response = await fetch(url, { cache: "no-store" });

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const place = placeSchema.safeParse(await response.json());

    if (!place.success) {
      return { status: "unavailable" };
    }

    return { status: "success", place: place.data };
  } catch {
    return { status: "unavailable" };
  }
}
