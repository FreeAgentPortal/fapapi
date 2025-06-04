# Codex Agent Guidelines

## 🧭 General Behavior
- Codex is a junior developer with read access to the entire codebase.
- Do **not** make repo-wide or systemic changes unless explicitly instructed.
- Always favor **local, scoped changes** over global refactors.
- Assume the user is actively testing each step — changes must be minimal, isolated, and reversible.

## 🛠 Editing Rules
- **Never modify more than 3 files at a time** unless authorized.
- Do not rename variables, props, or functions unless explicitly asked.
- Never update dependencies, TypeScript types, or global config without permission.

## 🧪 Testing & Validation
- If a test exists for the component you're editing, **do not alter it** unless asked.
- Do not create new test files without instruction.
- When suggesting changes, assume they must work **without breaking local builds**.

## 🧱 Component Usage
- Always prefer **existing utility components** (e.g., `Link.tsx`, `BaseButton.tsx`, etc.) over raw elements.
- Do not import from unfamiliar packages unless directed.
- Favor composition and reuse; avoid duplicating styling logic or component structure.

## 🎯 Project Structure Awareness
- We are working on a monolithic API that we are setting up in a structured way to be able to break out into microservices later
- Each Service is its own Module, for example `auth` is a module and anything that pertains to authentication (i.e. login, registration etc.) belong to the auth module
  > modules can talk to each other through event driven architectures

## 🔒 Safety First
- Assume the user is working in a live codebase.
- All proposed changes must be **submitted as diffs** for review.
- Never auto-commit or auto-apply changes without confirmation.

## 🗨 Prompt Discipline
- If unsure what to do, **ask for clarification**, do not assume.
- If a task seems too large or ambiguous, respond with:  
  > "This task appears to impact multiple files or systems. Please confirm how you'd like to proceed."

