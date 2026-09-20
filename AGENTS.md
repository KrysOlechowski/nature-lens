# 🤖 AGENTS.md

This file defines how coding agents should work inside the **Nature Lens** repository.

The goal is not to maximize implementation speed. The goal is to build the project incrementally, keep changes understandable, and preserve deliberate engineering decisions.

---

## 🌲 Project context

**Nature Lens** is a Poland-focused application that aggregates real biodiversity, forestry, environmental, weather, and geospatial data from public APIs and open-data sources.

The two main product flows are:

1. **Species → where and when was it observed in Poland?**
2. **Place → what nature data and observations are available here?**

The project is also intended as a practical learning environment for senior frontend and frontend-leaning full-stack engineering.

### Main stack

- Next.js 16
- React
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- MapLibre
- Node.js
- NestJS
- PostgreSQL
- PostGIS
- Supabase

### Architectural direction

- The backend starts as a **modular monolith**.
- The frontend primarily communicates with the **Nature Lens API**, not directly with external providers.
- External providers are isolated behind **adapters**.
- External responses are validated at runtime before entering application logic.
- Provider-specific data is normalized into internal Nature Lens models.
- PostgreSQL/PostGIS is used where persistence and spatial querying create real product value.
- Architecture should evolve from actual product pressure rather than speculative complexity.
- New infrastructure, abstractions, and dependencies require a concrete reason.

---

## 📚 Documentation responsibilities

The repository documentation has intentionally separate roles.

### `README.md`

Use it to understand:

- what the project is,
- the main product direction,
- the technology stack,
- repository usage and setup.

Do not treat the README as the complete architectural specification.

### `ARCHITECTURE.md`

Use it when the current task involves:

- architecture,
- module boundaries,
- data flow,
- persistence,
- external integrations,
- provider adapters,
- PostGIS,
- caching,
- synchronization,
- resilience,
- significant technical decisions.

Do not read the entire file automatically for every small task if it is unrelated.

### `PROJECT_STATE.md`

This is the concise source of truth for **where the implementation currently stands**.

Read it at the start of every implementation task.

It should contain:

- last completed step,
- current step,
- next step,
- what currently works,
- important current decisions,
- known limitations or blockers,
- relevant development commands.

### `IMPLEMENTATION_PLAN.md`

This is the source of truth for **what should be built next**.

At the start of every implementation task:

1. read `PROJECT_STATE.md`,
2. identify the `Current step`,
3. search `IMPLEMENTATION_PLAN.md` for that exact step heading,
4. read only that step's section, stopping at the next step or phase heading,
5. work only from that step unless the user explicitly changes the scope.

Do **not** read the entire `IMPLEMENTATION_PLAN.md` by default. Use targeted search (`rg`, `grep`, editor search, or equivalent) to locate the current step and load only the relevant section.

The user should not need to paste the step manually into the conversation.

Do not silently implement later steps.

---

## 🧭 Working model

The project is built through small implementation steps.

The default rule is:

> **One implementation-plan step = one logical Git commit.**

A step should leave the repository in a coherent state.

If a step turns out to be too large, incorrectly scoped, or dependent on an unexpected architectural decision, stop and discuss it with the user instead of forcing everything into one commit.

---

## 🔍 Before implementation

For every implementation task:

1. Read `PROJECT_STATE.md`.
2. Search for the exact `Current step` heading in `IMPLEMENTATION_PLAN.md` and read only that section.
3. Read only the additional documentation relevant to the task.
4. Inspect only the repository areas needed to understand the change.
5. Check the current Git state when relevant.
6. Before writing code, briefly explain:
   - what needs to change,
   - why it needs to change,
   - the proposed approach,
   - meaningful alternatives or trade-offs, if any.

### Context discipline

Gather the **minimum repository context required for the current task**.

Do not scan or read the entire repository by default.

Expand context only when necessary because of:

- unclear dependencies,
- shared abstractions,
- architectural impact,
- unexpected test failures,
- behavior that cannot be understood from the local area.

---

## ✋ Approval gate

Do **not** begin implementation until the user explicitly approves the proposed approach.

Discussion and investigation may happen before approval.

Code changes should not.

---

## 🛠️ During implementation

Work only on the current step.

Do not:

- implement future roadmap items,
- perform unrelated refactors,
- introduce speculative abstractions,
- add infrastructure "for later",
- replace established architectural decisions without discussion,
- hide unexpected complexity by silently expanding the task.

Prefer the smallest implementation that correctly solves the current problem.

### Keep boundaries explicit

In particular:

- controllers should stay thin,
- provider-specific contracts should stay at integration boundaries,
- external data should be runtime-validated,
- application logic should use internal models,
- frontend code should not depend on raw provider payloads,
- spatial logic should live where it can be tested and queried effectively.

---

## 🧪 Verification

After implementation, run checks appropriate to the scope of the change.

Examples:

- unit tests,
- integration tests,
- E2E tests,
- lint,
- TypeScript typecheck,
- application build,
- database migration verification.

Do not run expensive or unrelated checks merely by habit if they provide no useful confidence for the current change.

If a relevant check cannot be run, state why.

---

## 📍 Updating `PROJECT_STATE.md`

After a step is successfully implemented and verified, update `PROJECT_STATE.md` as part of the **same logical change**.

Keep it short.

It is a rolling snapshot of the project, **not a changelog**.

Update only what changed:

- last completed step,
- next planned step,
- currently working capabilities,
- important decisions introduced by the step,
- known limitations or blockers,
- development commands if they changed.

Remove stale information when necessary.

Do not duplicate the full implementation plan inside `PROJECT_STATE.md`.

---

## 🧾 End-of-task summary

Before considering a step complete, provide a concise summary containing:

### What changed

List the meaningful implementation changes.

### Why

Explain the reason for the solution.

### Important decisions

Mention technical choices worth remembering.

### Verification

State which tests/checks were run and their result.

### Definition of Done

Explicitly state whether the current step's Definition of Done is satisfied.

### Follow-up

Mention unresolved issues only if they genuinely block or affect the next step.

---

## 🧠 Learning-first behavior

This project is intentionally educational.

When a technical decision is meaningful, explain it clearly enough that the user can later describe:

- the problem,
- the available options,
- the selected solution,
- why it was selected,
- its trade-offs.

Do not turn every trivial implementation detail into a lecture.

Focus explanations on decisions that matter.

---

## 🌐 Project language

Use **English** for all newly written or edited project content:

- user-facing UI copy, labels, placeholders, and accessibility text,
- validation, error, and status messages,
- page titles, descriptions, and other metadata,
- code comments and repository documentation.

Keep HTML language declarations consistent with the content (`lang="en"` for the current application).

The application remains focused on Poland. Preserve proper names, scientific names, and original provider data rather than translating them automatically.

Use the user's preferred language in conversation; the English requirement applies to project content.

---

## 🏗️ Architecture guardrails

Unless the product creates a real need, do not introduce:

- microservices,
- Redis,
- message queues,
- event-driven architecture,
- Kubernetes,
- GraphQL,
- a generic repository abstraction over everything,
- elaborate domain-driven-design layers,
- complex authentication,
- a custom GIS platform,
- all external providers at once.

These are not forbidden.

They require a concrete problem that justifies their complexity.

---

## 🔌 External providers

Expected providers may eventually include:

- iNaturalist
- GBIF
- BDL
- GDOŚ
- OpenStreetMap
- Open-Meteo
- IMGW

Do not integrate a provider merely because it appears on this list.

Each integration should correspond to a real product requirement.

Provider adapters should isolate:

- endpoint details,
- request parameters,
- provider-specific errors,
- runtime response validation,
- provider response shapes.

Application services should work with internal application types.

---

## 🗺️ Geospatial rules

GIS is a tool for the product, not the product itself.

Use only the concepts required by current features.

Typical relevant concepts include:

- GeoJSON,
- Point,
- LineString,
- Polygon,
- SRID 4326,
- bounding boxes,
- spatial indexes,
- clustering,
- spatial filtering,
- point-in-polygon,
- PostGIS.

Do not introduce advanced GIS infrastructure before a real requirement exists.

---

## 🛡️ Nature-data safety

Nature Lens uses real biodiversity observations.

Always preserve restrictions imposed by source providers.

If coordinates are:

- obscured,
- reduced in precision,
- hidden,
- marked as sensitive,

do not attempt to reconstruct the original location.

Treat occurrence records as **observations**, not guarantees of species presence.

Preferred wording:

> This species has been observed in this area.

Avoid claims equivalent to:

> This species definitely occurs here.

Do not introduce mushroom-edibility or other safety-critical identification decisions.

---

## 🔐 Secrets and configuration

Never commit:

- `.env` files containing secrets,
- API keys,
- database credentials,
- provider credentials,
- private tokens.

Use environment variables and committed example configuration where appropriate.

Public frontend variables must be clearly distinguished from server-only secrets.

---

## 🌿 Git discipline

Do not create a Git commit unless the user explicitly asks for it.

Before a commit is requested:

- keep the change scoped to the current step,
- verify the relevant checks,
- ensure `PROJECT_STATE.md` reflects the resulting state,
- summarize the diff.

The intended commit message from the implementation plan should normally be used unless the actual scope changed enough to justify a different message.

---

## 🚨 Stop and discuss instead of guessing

Stop implementation and ask the user before continuing when:

- the current step conflicts with the existing architecture,
- a supposedly small step requires a significant new dependency,
- the implementation plan appears technically incorrect,
- a migration risks destructive data loss,
- the task unexpectedly spans multiple architectural areas,
- a provider behaves differently from the assumptions in the plan,
- the Definition of Done cannot reasonably be achieved within the current step.

The correct response to unexpected complexity is **discussion**, not silent scope expansion.

---

<div align="center">

## 🌲 Guiding rule

**Understand the current problem.  
Make the smallest coherent change.  
Verify it.  
Update the project state.  
Then move to the next step.**

</div>
