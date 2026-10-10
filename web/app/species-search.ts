import { z } from "zod";
import { environment } from "../env";

const speciesSearchResultSchema = z.object({
  id: z.string(),
  scientificName: z.string(),
  commonName: z.string().optional(),
  displayName: z.string(),
  taxonomy: z.object({
    rank: z.string(),
  }),
  source: z.object({
    provider: z.string(),
    externalId: z.string(),
  }),
});

const speciesSearchResponseSchema = z.array(speciesSearchResultSchema);

export type SpeciesSearchResult = z.infer<typeof speciesSearchResultSchema>;

type SpeciesSearchResponse =
  | {
      status: "success";
      results: SpeciesSearchResult[];
    }
  | {
      status: "unavailable";
    };

export async function searchSpecies(
  query: string,
): Promise<SpeciesSearchResponse> {
  try {
    const url = new URL(
      "/api/species/search",
      environment.NEXT_PUBLIC_API_BASE_URL,
    );
    url.searchParams.set("q", query);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const results = speciesSearchResponseSchema.safeParse(
      await response.json(),
    );

    if (!results.success) {
      return { status: "unavailable" };
    }

    return { status: "success", results: results.data };
  } catch {
    return { status: "unavailable" };
  }
}
