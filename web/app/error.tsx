"use client";

import { Button } from "@/components/ui/button";

interface ApplicationErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ApplicationError({ reset }: ApplicationErrorProps) {
  return (
    <main className="min-h-svh px-6 py-12 sm:py-20">
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-900">
          We could not load this page. Please try again.
        </p>
        <Button
          className="mt-6 bg-emerald-800 px-4 text-white hover:bg-emerald-700"
          onClick={reset}
          type="button"
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
