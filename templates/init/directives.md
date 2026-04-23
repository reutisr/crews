# Project Directives

These rules are injected into every agent on every run. Keep them concise and actionable.

---

## Security

<!-- Add your project's security rules here. Examples:
- Always validate user input before using it in queries
- Never expose internal error details in API responses
- Scope all database queries to the authenticated user/tenant
-->

## Code Style

<!-- Add your project's code style rules here. Examples:
- Use guard clauses: validate and throw early, keep the happy path flat
- File names: kebab-case
- No backwards-compatibility shims for removed code — delete it
- No docstrings or comments on code that isn't changed
-->

## Architecture

<!-- Add your project's architectural constraints here. Examples:
- All models live in packages/models/ — never redefine them in services
- Services communicate via events, not direct calls
- Use soft deletes (deletedAt) — never hard-delete records
-->

## Testing

<!-- Add your project's testing rules here. Examples:
- Use Mocha + Chai expect style (never should)
- No .only in tests — it breaks CI
- Unit tests in test/unit/, integration tests in test/integration/
-->

## What NOT to Do

- Do not add feature flags unless explicitly asked
- Do not refactor code outside the task scope
- Do not add defensive error handling for impossible scenarios
- Do not create helpers or abstractions for one-time use
