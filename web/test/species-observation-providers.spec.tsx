import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  observationProviderStatusSchema,
  parseObservationSynchronization,
  type ObservationProviderStatus,
} from "../app/species-observation-providers";
import { SpeciesObservationAvailabilityNotice } from "../app/species/[id]/species-observation-availability-notice";

describe("observation provider availability", () => {
  it.each(["available", "stale", "unavailable"] as const)(
    "validates the %s provider status",
    (status) => {
      expect(
        observationProviderStatusSchema.parse({
          provider: "gbif",
          status,
        }),
      ).toEqual({ provider: "gbif", status });
    },
  );

  it("rejects duplicate and unknown provider metadata", () => {
    expect(
      parseObservationSynchronization({
        metadata: {
          providers: [
            { provider: "gbif", status: "available" },
            { provider: "gbif", status: "stale" },
          ],
        },
      }),
    ).toEqual({ status: "unavailable" });
    expect(
      parseObservationSynchronization({
        metadata: {
          providers: [{ provider: "unknown", status: "available" }],
        },
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("does not render a warning when all provider data is available", () => {
    expect(
      renderNotice([{ provider: "inaturalist", status: "available" }]),
    ).toBe("");
  });

  it("renders a non-blocking partial-failure warning for unavailable data", () => {
    const markup = renderNotice([
      { provider: "inaturalist", status: "available" },
      { provider: "gbif", status: "unavailable" },
    ]);

    expect(markup).toContain(
      "Some observation data is temporarily unavailable",
    );
    expect(markup).toContain("Available observations are still shown");
    expect(markup).toContain(
      "does not mean that this species has not been observed",
    );
  });

  it("renders a distinct warning when stale provider data remains usable", () => {
    const markup = renderNotice([
      { provider: "inaturalist", status: "available" },
      { provider: "gbif", status: "stale" },
    ]);

    expect(markup).toContain("Some observation data may be out of date");
    expect(markup).toContain("earlier successful synchronization");
  });

  it("keeps a refresh failure separate from locally available observations", () => {
    const markup = renderToStaticMarkup(
      <SpeciesObservationAvailabilityNotice
        synchronization={{ status: "unavailable" }}
      />,
    );

    expect(markup).toContain("Some observation data could not be refreshed");
    expect(markup).toContain(
      "Available synchronized observations are still shown",
    );
  });
});

function renderNotice(providers: ObservationProviderStatus[]): string {
  return renderToStaticMarkup(
    <SpeciesObservationAvailabilityNotice
      synchronization={{ status: "success", providers }}
    />,
  );
}
