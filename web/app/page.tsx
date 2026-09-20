export default function HomePage() {
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
      </div>
    </main>
  );
}
