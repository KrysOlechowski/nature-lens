"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SpeciesObservationsRetry() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const retry = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50 ring-amber-200" role="alert">
      <CardHeader>
        <CardTitle>Observations are temporarily unavailable</CardTitle>
        <CardDescription className="text-amber-900">
          Species details remain available, but the observation map could not be
          loaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={isPending} onClick={retry} type="button">
          <RefreshCw aria-hidden="true" />
          {isPending ? "Retrying…" : "Retry observations"}
        </Button>
      </CardContent>
    </Card>
  );
}
