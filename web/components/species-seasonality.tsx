import type { SpeciesObservationSeasonality } from "@/app/species-observation-seasonality";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SpeciesSeasonalityProps {
  seasonality: SpeciesObservationSeasonality;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function SpeciesSeasonality({ seasonality }: SpeciesSeasonalityProps) {
  const datedCount = seasonality.months.reduce(
    (total, month) => total + month.count,
    0,
  );
  const largestMonthlyCount = Math.max(
    1,
    ...seasonality.months.map((month) => month.count),
  );
  const largestYearlyCount = Math.max(
    1,
    ...seasonality.years.map((year) => year.count),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recorded observations by month</CardTitle>
        <CardDescription>
          Calendar distribution across all years currently stored by Nature
          Lens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {datedCount === 0 ? (
          <p className="text-sm leading-relaxed text-stone-600">
            No locally synchronized observations have a provider-supplied
            calendar date yet.
          </p>
        ) : (
          <ol className="space-y-2" aria-label="Observation counts by month">
            {seasonality.months.map(({ month, count }) => {
              const monthName = monthNames[month - 1];

              return (
                <li
                  aria-label={`${monthName}: ${formatObservationCount(count)}`}
                  className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm"
                  key={month}
                >
                  <span className="text-stone-600">{monthName}</span>
                  <span
                    aria-hidden="true"
                    className="h-3 overflow-hidden rounded-full bg-stone-100"
                  >
                    <span
                      className="block h-full rounded-full bg-emerald-700"
                      style={{
                        width: `${(count / largestMonthlyCount) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {count}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {seasonality.years.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-stone-800">
              Recorded observations by year
            </h3>
            <ol
              aria-label="Observation counts by year"
              className="mt-3 space-y-2"
            >
              {seasonality.years.map(({ year, count }) => (
                <li
                  aria-label={`${year}: ${formatObservationCount(count)}`}
                  className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-sm"
                  key={year}
                >
                  <span className="text-stone-600">{year}</span>
                  <span
                    aria-hidden="true"
                    className="h-2 overflow-hidden rounded-full bg-stone-100"
                  >
                    <span
                      className="block h-full rounded-full bg-emerald-600"
                      style={{
                        width: `${(count / largestYearlyCount) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {count}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-stone-200 pt-5 text-sm leading-relaxed text-stone-600">
          <p>
            {formatObservationCount(seasonality.undatedCount)} excluded from the
            calendar charts because no provider-supplied observation date was
            available.
          </p>
          <p>
            Counts represent deduplicated observations already synchronized to
            Nature Lens, including records without public coordinates. They are
            not complete provider coverage, and uneven observation effort can
            shape the pattern. Observations are evidence, not proof of
            continuous species presence.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatObservationCount(count: number): string {
  return `${count} ${count === 1 ? "observation" : "observations"}`;
}
