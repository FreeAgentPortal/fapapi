---
description: Backend scope, approval, and validation rules for module-scoped changes, shared infrastructure changes, and focused verification.
applyTo: "src/**"
---

# Backend Scope And Validation

## Scope Rules

- A coherent backend change may span multiple files inside one module, including routes, handlers, services, models, utils, docs, tests, factories, cron jobs, or pipelines.
- It is acceptable to rename module-local variables, functions, and types when that improves consistency for the requested change.
- Avoid touching unrelated modules during a scoped backend change.
- If a change expands from one module into shared backend infrastructure or another module, call that out before widening scope.

## Approval Gates

- Ask before updating dependencies, root TypeScript config, or global app config.
- Ask before changing root middleware, shared backend infrastructure, or cross-module contracts unless the task clearly requires it.
- Ask before widening a module-local task into a multi-module or shared-infrastructure refactor.

## Validation

- Validate the touched slice with the narrowest available test, build, or typecheck.
- Do not widen scope when a focused validation already identifies the failing boundary.
- Keep changes reviewable and reversible, especially when the work touches shared infrastructure or cross-module boundaries.