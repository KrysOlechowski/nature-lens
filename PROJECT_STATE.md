# 📍 Project State

> **Project:** Nature Lens  
> **Status:** workspace initialized  
> **Current phase:** Phase 1 · Repository foundation  
> **Last completed step:** 01 · Initialize workspace  
> **Current step:** 02 · Bootstrap Next.js application  
> **Next step:** 03 · Bootstrap NestJS API

## What currently works

- Git repository initialized on `main`; no commits have been created.
- pnpm workspace recognizes the root package and the `web` and `api` packages.
- Root and application package manifests are private.
- pnpm is pinned to `12.4.1` through `packageManager`; the lockfile is generated.
- `.gitignore` excludes dependencies, build output, local environment files, logs, and `.DS_Store`, while allowing environment examples.

## Important current decisions

- Applications live directly in `web/` and `api/`, without an `apps/` directory.
- Plain pnpm workspaces are sufficient; no Nx or Turborepo is introduced.
- Application directories currently contain only package manifests. No root scripts are needed yet; development and quality-check scripts will be added with the applications and tooling they require.
- The target remains Next.js → Nature Lens API (NestJS modular monolith) → provider adapters and PostgreSQL/PostGIS on Supabase.
- The first vertical slice is species search and real observations from Poland on a map, initially using iNaturalist. External data must be runtime-validated and normalized, and provider coordinate restrictions must be preserved.

## Known limitations / blockers

- Next.js and NestJS applications have not been bootstrapped.
- No application dependencies, database, provider integrations, tests, CI, or deployment exist yet.
- In the environment used for verification, `pnpm` was not on PATH and the bundled Corepack failed signature verification. Checks used pnpm 12.4.1 downloaded through npm; Corepack and the global pnpm installation were not changed.
- No blocker remains for the workspace configuration. Make pnpm available locally or use the npm execution commands in README before the next step.

## Development commands

Run from the repository root with pnpm 12.4.1 available:

```bash
pnpm install
pnpm install --offline --frozen-lockfile
```

The offline command requires the package-manager metadata and binary to have been downloaded by an initial online install.

## Verification

- Initial `pnpm install`: passed; all three workspace projects recognized.
- `pnpm install --offline --frozen-lockfile`: passed.
- Workspace discovery verified; root, `api`, and `web` recognized.
- Ignore rules checked for local environment files, dependencies, build output, and OS files.
- Step 01 Definition of Done is satisfied. No application tests or build commands exist at this stage.

## Next implementation

Implement only **02 · Bootstrap Next.js application** after discussing and approving its approach. See its section in `IMPLEMENTATION_PLAN.md`.
