import { MapPin, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchNature } from "./global-search";
import type { PlaceSearchResponse } from "./place-search";
import type {
  SpeciesSearchResponse,
  SpeciesSearchResult,
} from "./species-search";
import { productionSiteUrl } from "../env";

export const metadata: Metadata = productionSiteUrl
  ? { alternates: { canonical: productionSiteUrl } }
  : {};

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
  const searchResponse = query ? await searchNature(query) : undefined;

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
          Explore biodiversity observations by species, or search for a place in
          Poland to discover its natural context.
        </p>

        <form className="mt-10" method="get" role="search">
          <label
            className="text-sm font-medium text-stone-800"
            htmlFor="nature-query"
          >
            Species or place
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              className="h-11 bg-white px-3 text-base md:text-base"
              defaultValue={query}
              id="nature-query"
              name="q"
              placeholder="e.g. European bison or Białowieża"
              type="search"
            />
            <Button
              className="h-11 bg-emerald-800 px-5 hover:bg-emerald-700"
              type="submit"
            >
              <Search aria-hidden="true" />
              Search
            </Button>
          </div>
        </form>

        <section aria-live="polite" className="mt-10" aria-atomic="false">
          {!query ? (
            <Card>
              <CardHeader>
                <CardTitle>Discover biodiversity in Poland</CardTitle>
                <CardDescription>
                  Enter an English species name, scientific name, or place in
                  Poland to begin.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : searchResponse ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">
                Search results for “{query}”
              </h2>
              <div className="mt-6 grid gap-10">
                <SpeciesResults response={searchResponse.species} />
                <PlaceResults response={searchResponse.places} />
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SpeciesResults({ response }: { response: SpeciesSearchResponse }) {
  return (
    <section aria-labelledby="species-results-heading">
      <ResultGroupHeading
        count={response.status === "success" ? response.results.length : null}
        id="species-results-heading"
        title="Species"
      />
      {response.status === "unavailable" ? (
        <UnavailableResult
          description="Place results may still be available below. Please try the species search again later."
          title="Species search is temporarily unavailable"
        />
      ) : response.results.length === 0 ? (
        <EmptyResult description="Try a different English common name or scientific name." />
      ) : (
        <ul className="mt-4 grid gap-3">
          {response.results.map((species) => (
            <SpeciesResult key={species.id} species={species} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SpeciesResult({ species }: { species: SpeciesSearchResult }) {
  return (
    <li>
      <Link
        className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-emerald-700/40"
        href={`/species/${species.id}`}
      >
        <Card className="transition-colors hover:bg-emerald-50 hover:ring-emerald-700/30">
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
      </Link>
    </li>
  );
}

function PlaceResults({ response }: { response: PlaceSearchResponse }) {
  return (
    <section aria-labelledby="place-results-heading">
      <ResultGroupHeading
        count={response.status === "success" ? response.results.length : null}
        id="place-results-heading"
        title="Places"
      />
      {response.status === "unavailable" ? (
        <UnavailableResult
          description="Species results remain available above. Please try the place search again later."
          title="Place search is temporarily unavailable"
        />
      ) : response.results.length === 0 ? (
        <EmptyResult description="Try another city, village, forest, park, or region in Poland." />
      ) : (
        <>
          <ul className="mt-4 grid gap-3">
            {response.results.map((place) => (
              <li key={place.id}>
                <Link
                  className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-emerald-700/40"
                  href={`/places/${encodeURIComponent(place.id)}/${encodeURIComponent(place.slug)}`}
                >
                  <Card className="transition-colors hover:bg-emerald-50 hover:ring-emerald-700/30">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <MapPin
                          aria-hidden="true"
                          className="mt-0.5 size-5 shrink-0 text-emerald-800"
                        />
                        <div>
                          <CardTitle>{place.label}</CardTitle>
                          <CardDescription className="mt-1 capitalize">
                            {formatPlaceType(place.type)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">
            Place data ©{" "}
            <a
              className="underline underline-offset-2 hover:text-stone-800"
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer"
              target="_blank"
            >
              OpenStreetMap contributors
            </a>
            .
          </p>
        </>
      )}
    </section>
  );
}

function ResultGroupHeading({
  count,
  id,
  title,
}: {
  count: number | null;
  id: string;
  title: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h3 className="text-xl font-semibold tracking-tight" id={id}>
        {title}
      </h3>
      {count === null ? null : (
        <p className="text-sm text-stone-600">
          {count} {count === 1 ? "result" : "results"}
        </p>
      )}
    </div>
  );
}

function EmptyResult({ description }: { description: string }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>No results found</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function UnavailableResult({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card className="mt-4 border-amber-200 bg-amber-50 ring-amber-200">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-amber-800">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function formatPlaceType(type: string): string {
  return type.replaceAll("-", " ");
}
