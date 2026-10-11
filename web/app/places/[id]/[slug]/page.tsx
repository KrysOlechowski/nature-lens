import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceMap } from "@/components/place-map";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { environment } from "../../../../env";
import { getPlace } from "../../../place-detail";

interface PlacePageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const response = await getPlace(id);

  if (response.status === "not-found") {
    notFound();
  }

  return (
    <main className="min-h-svh px-6 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-700 hover:underline"
          href="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to nature search
        </Link>

        {response.status === "unavailable" ? (
          <Card className="mt-8 border-amber-200 bg-amber-50 ring-amber-200">
            <CardHeader>
              <CardTitle>
                <h1>Place details are temporarily unavailable</h1>
              </CardTitle>
              <CardDescription className="text-amber-800">
                We could not retrieve this place. Please try again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <p className="mt-10 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-emerald-800">
              <MapPin aria-hidden="true" className="size-4" />
              {formatPlaceType(response.place.type)}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              {response.place.label}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
              Explore the natural context of this place in Poland.
            </p>

            <section aria-labelledby="place-map-heading" className="mt-10">
              <div className="mb-4">
                <h2
                  className="text-2xl font-semibold tracking-tight"
                  id="place-map-heading"
                >
                  Place map
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {response.place.bbox
                    ? "The map is fitted to the extent supplied for this place."
                    : "No reliable extent is available, so the map is centered on the representative point supplied for this place."}
                </p>
              </div>
              <PlaceMap
                bbox={response.place.bbox}
                center={response.place.center}
                label={response.place.label}
                mapStyleUrl={environment.NEXT_PUBLIC_MAP_STYLE_URL}
              />
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
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function formatPlaceType(type: string): string {
  return type.replaceAll("-", " ");
}
