---
description: Backend layer rules for routes, handlers, services, models, utilities, and maintainable module structure.
applyTo: "src/**"
---

# Backend Layer Patterns

## Layer Responsibilities

- Routes stay thin and handle request wiring.
- Handlers orchestrate workflows and request-specific coordination.
- Services contain core business logic.
- Models define persistence concerns.
- Module utilities stay module-local unless the reuse is clearly cross-module.

## Structure Rules

- Do not move business logic into routes or cross-module glue code.
- Keep routes lean and focused on delegation.
- Keep handlers focused on orchestration rather than persistence details.
- Keep services focused on business rules rather than HTTP wiring.
- Keep models, routes, docs, and utilities in their existing module boundaries unless the task clearly requires otherwise.

## File Shape

- Do not create giant all-in-one module files when the work should be split across handlers, services, models, routes, utilities, or docs.
- Prefer extending existing module patterns over introducing one-off abstractions.
- Keep new code aligned with the surrounding module structure before creating new folder conventions.