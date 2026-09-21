import { getApiConnection } from "./api-health";

export default async function HomePage() {
  const apiConnection = await getApiConnection();
  const isApiConnected = apiConnection.status === "connected";

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl border-t-4 border-emerald-800 pt-8 sm:pt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-800">
          Nature in Poland
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-7xl">
          Nature Lens
        </h1>
        <p className="mt-6 max-w-xl text-xl leading-relaxed text-stone-600">
          Explore Poland’s biodiversity through species observations and data
          about places across the country.
        </p>
        <p className="mt-10 border-t border-stone-200 pt-6 text-sm leading-relaxed text-stone-600">
          This project is under development. Species search and an observation
          map will be added in future stages.
        </p>
        <section
          className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm"
          aria-label="Development status"
        >
          <span className="font-medium text-stone-700">Nature Lens API</span>
          <span
            className={`inline-flex items-center gap-2 font-medium ${
              isApiConnected ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                isApiConnected ? "bg-emerald-600" : "bg-amber-600"
              }`}
              aria-hidden="true"
            />
            {isApiConnected
              ? `Connected · contract v${apiConnection.health.version}`
              : "Unavailable"}
          </span>
        </section>
      </div>
    </main>
  );
}
