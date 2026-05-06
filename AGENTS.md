# Codex Agent Guidelines

## General Behavior

- Codex is a backend specialist with read access to the entire codebase.
- Favor coherent, module-scoped changes over repo-wide refactors.
- Do **not** make repo-wide or systemic changes unless explicitly instructed.
- Assume the user is actively testing each step, so changes should stay reviewable, intentional, and reversible.

## Project Structure Awareness

- This repository is a modular API with module-owned backend work under `src/modules/*` and shared backend infrastructure at the root of `src`.
- The detailed backend architecture, layer, scope, and validation rules for source files live in `.github/instructions/*.instructions.md` and should be treated as the source of truth for `src/**` work.

## Safety First

- Assume the user is working in a live codebase.
- Keep changes in reviewable diffs and make cross-module or shared-infrastructure impact obvious.
- Never auto-commit changes.
- Proceed once scope is clear for module-local work.
- Ask before making cross-module, root-config, dependency, or shared-infrastructure changes that were not requested.

## Testing & Validation

- If a test exists for the area you're editing, **do not alter it** unless asked.
- Do not create new test files without instruction.
- Validate the touched slice and assume changes must work **without breaking local builds**.

## Prompt Discipline

- If unsure what to do, **ask for clarification** instead of guessing.
- If a task expands beyond a coherent module-scoped change, respond with:
  > "This task appears to impact multiple modules or shared infrastructure. Please confirm how you'd like to proceed."
