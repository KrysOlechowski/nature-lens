import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchSpecies } from "./species-search";

interface HomePageProps {
  searchParams: Promise<{
    q?: string | string[];
  }>;
}

function normalizeQuery(query: string | string[] | undefined): string {
  return typeof query === "string" ? query.trim() : "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = normalizeQuery((await searchParams).q);
  const searchResponse = query ? await searchSpecies(query) : undefined;

  return (
    <main className="min-h-svh px-6 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-800">
          Nature in Poland
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Search for a place, forest, or species.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
          Start with a species to explore biodiversity observations from across
          Poland. Search by an English common name or scientific name.
        </p>

        <form className="mt-10" method="get" role="search">
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="species-query"
          >
            Species name
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              className="h-11 bg-white px-3 text-base md:text-base"
              defaultValue={query}
              id="species-query"
              name="q"
              placeholder="e.g. European bison or Bison bonasus"
              type="search"
            />
            <Button
              className="h-11 bg-emerald-800 px-5 hover:bg-emerald-700"
              type="submit"
            >
              <Search aria-hidden="true" />
              Search species
            </Button>
          </div>
        </form>

        <section aria-live="polite" className="mt-10" aria-atomic="false">
          {!query ? (
            <Card>
              <CardHeader>
                <CardTitle>Discover biodiversity in Poland</CardTitle>
                <CardDescription>
                  Enter a species name to begin. Place and forest search will be
                  added in a later stage.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : searchResponse?.status === "unavailable" ? (
            <Card className="border-amber-200 bg-amber-50 ring-amber-200">
              <CardHeader>
                <CardTitle>Species search is temporarily unavailable</CardTitle>
                <CardDescription className="text-amber-800">
                  We could not retrieve results for “{query}”. Please try again.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : searchResponse?.results.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No species found</CardTitle>
                <CardDescription>
                  Try a different English common name or scientific name.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : searchResponse?.status === "success" ? (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Search results
                </h2>
                <p className="text-sm text-stone-600">
                  {searchResponse.results.length}{" "}
                  {searchResponse.results.length === 1 ? "result" : "results"}
                </p>
              </div>
              <ul className="mt-4 grid gap-3">
                {searchResponse.results.map((species) => (
                  <li key={species.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle>{species.displayName}</CardTitle>
                        <CardDescription>
                          {species.commonName
                            ? "Common and scientific names"
                            : "Scientific name"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2">
                          {species.commonName ? (
                            <div>
                              <dt className="text-stone-500">Common name</dt>
                              <dd className="mt-1 font-medium text-stone-800">
                                {species.commonName}
                              </dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="text-stone-500">Scientific name</dt>
                            <dd className="mt-1 font-medium text-stone-800 italic">
                              {species.scientificName}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Taxonomic rank</dt>
                            <dd className="mt-1 font-medium text-stone-800 capitalize">
                              {species.taxonomy.rank}
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
