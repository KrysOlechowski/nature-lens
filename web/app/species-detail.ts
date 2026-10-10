import { z } from "zod";
import { environment } from "../env";

const speciesDetailSchema = z.object({
  id: z.string(),
  scientificName: z.string(),
  displayName: z.string(),
  taxonomy: z.object({
    rank: z.string().optional(),
  }),
});

export type SpeciesDetail = z.infer<typeof speciesDetailSchema>;

export type SpeciesDetailResponse =
  | {
      status: "success";
      species: SpeciesDetail;
    }
  | {
      status: "not-found";
    }
  | {
      status: "unavailable";
    };

export async function getSpecies(
  speciesId: string,
): Promise<SpeciesDetailResponse> {
  try {
    const url = new URL(
      `/api/species/${speciesId}`,
      environment.NEXT_PUBLIC_API_BASE_URL,
    );
    const response = await fetch(url, { cache: "no-store" });

    if (response.status === 404) {
      return { status: "not-found" };
    }

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const species = speciesDetailSchema.safeParse(await response.json());

    if (!species.success) {
      return { status: "unavailable" };
    }

    return { status: "success", species: species.data };
  } catch {
    return { status: "unavailable" };
  }
}
