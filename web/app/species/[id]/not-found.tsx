import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SpeciesNotFound() {
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
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>
              <h1>Species not found</h1>
            </CardTitle>
            <CardDescription>
              This species does not exist in Nature Lens or is no longer
              available.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
