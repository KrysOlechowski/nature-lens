import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { environment } from "../../../env";
import { getSpecies } from "../../species-detail";
import {
  SpeciesObservationsLoading,
  SpeciesObservationsSection,
} from "./species-observations-section";

interface SpeciesPageProps {
  params: Promise<{
    id: string;
  }>;
}

const maximumPostgreSqlBigInt = BigInt("9223372036854775807");

function isValidSpeciesId(speciesId: string): boolean {
  return (
    /^[1-9]\d*$/.test(speciesId) && BigInt(speciesId) <= maximumPostgreSqlBigInt
  );
}

export default async function SpeciesPage({ params }: SpeciesPageProps) {
  const { id } = await params;

  if (!isValidSpeciesId(id)) {
    notFound();
  }

  const response = await getSpecies(id);

  if (response.status === "not-found") {
    notFound();
  }

  return (
    <main className="min-h-svh px-6 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-700 hover:underline"
          href="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to species search
        </Link>

        {response.status === "unavailable" ? (
          <Card className="mt-8 border-amber-200 bg-amber-50 ring-amber-200">
            <CardHeader>
              <CardTitle>
                <h1>Species details are temporarily unavailable</h1>
              </CardTitle>
              <CardDescription className="text-amber-800">
                We could not retrieve this species. Please try again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <p className="mt-10 text-sm font-medium uppercase tracking-widest text-emerald-800">
              Species
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              {response.species.displayName}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
              Explore this species and its recorded observations in Poland.
            </p>

            <Card className="mt-10">
              <CardHeader>
                <CardTitle>Species details</CardTitle>
                <CardDescription>
                  Application-owned information stored by Nature Lens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-stone-500">Scientific name</dt>
                    <dd className="mt-1 font-medium text-stone-800 italic">
                      {response.species.scientificName}
                    </dd>
                  </div>
                  {response.species.taxonomy.rank ? (
                    <div>
                      <dt className="text-stone-500">Taxonomic rank</dt>
                      <dd className="mt-1 font-medium text-stone-800 capitalize">
                        {response.species.taxonomy.rank}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            <section aria-labelledby="species-map-heading" className="mt-10">
              <h2
                className="text-2xl font-semibold tracking-tight"
                id="species-map-heading"
              >
                Map of Poland
              </h2>
              <p className="mt-2 mb-5 text-sm leading-relaxed text-stone-600">
                Explore the geographic context for observations of this species.
              </p>
              <Suspense fallback={<SpeciesObservationsLoading />}>
                <SpeciesObservationsSection
                  apiBaseUrl={environment.NEXT_PUBLIC_API_BASE_URL}
                  mapStyleUrl={environment.NEXT_PUBLIC_MAP_STYLE_URL}
                  speciesId={id}
                />
              </Suspense>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
