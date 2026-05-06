---
description: Backend architecture rules for the modular API, module ownership, shared backend infrastructure, and event-driven boundaries.
applyTo: "src/**"
---

# Backend Architecture

## Architecture

- This repository is a modular API designed so modules can be split into microservices later.
- Treat each module under `src/modules/*` as a future service boundary.
- Keep work inside the owning module when possible.
- Treat cross-module changes as explicit boundary work, not incidental refactors.

## Module Ownership

- Each module owns its routes, handlers, services, models, utils, docs, and any module-specific factories, cron jobs, or pipelines.
- Keep module concerns cohesive instead of spreading logic across unrelated modules.
- Promote logic out of a module only when it is clearly a shared backend concern.

## Shared Backend Infrastructure

- Reuse existing shared backend infrastructure before introducing new abstractions:
  - `src/lib/eventBus.ts`
  - `src/utils/baseCRUD.ts`
  - `src/utils/basePipeline.ts`
  - `src/middleware/*`
- Shared backend infrastructure belongs at the root only when it is already cross-module or clearly reusable across modules.
- Changes to shared backend infrastructure, root config, or middleware should be deliberate and called out.

## Module Boundaries

- Prefer event-driven communication for cross-module workflows when appropriate.
- Avoid direct cross-module coupling when an event or existing shared abstraction is the better boundary.
- Keep architecture placement explicit when a change crosses module boundaries.