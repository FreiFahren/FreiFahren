# AGENTS.md

Guidance for AI agents (and humans) contributing to FreiFahren.

## Testing

Prefer **integration tests** over unit tests. Drive behavior through the public API surface so tests cover routing, validation, and persistence together.

- **No manual DB inserts in tests.** To set up state, send a request to the API (e.g. `POST /reports`) instead of writing to the database directly. This keeps tests realistic and avoids coupling them to schema details.
- **Mock time, don't backdate rows.** When a test needs "old" data, use `setSystemTime` from `bun:test` to move the clock, send the request, then move the clock forward — instead of inserting rows with old timestamps.
- **Use `appRequestWithRedirect`** (from `packages/hono-backend/tests/test-utils.ts`) instead of `app.request` directly. It follows the version redirect so tests automatically exercise the latest API version without hard-coding `/v0/...` paths.
- **Don't assert on exact error message strings.** Assert on status codes and structured error fields (codes, types). Exact wording is presentational and will churn.

## Migrations

When generating a Drizzle migration, give it a **descriptive name** that reflects the change (e.g. `add_reports_direction_index`), not the auto-generated codename (`tearful_slayback`). Rename the generated SQL file and update `drizzle/meta` accordingly.

## Commits and PR titles

Use Conventional Commit prefixes for both commit messages and PR titles:

- `feat:` — new user-facing functionality
- `fix:` — bug fix
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — tooling, dependencies, build, CI
- `docs:` — documentation only
- `test:` — adding or adjusting tests

Example: `fix: return 404 instead of 500 when station id is unknown`

## Hono backend conventions

- **Throw `AppError` at service boundaries**, not raw `Error` or ad-hoc `c.json({ error: ... })`. `AppError` (see `packages/hono-backend/src/common/errors.ts`) carries a `statusCode` and an `internalCode`, and the central error handler strips descriptions in production so internal details don't leak. Domain-specific errors should be converted to `AppError` before they reach the response.
- **Use the Pino logger from context** (`c.get('logger')`) instead of `console.log`. It's wired up in `packages/hono-backend/src/common/logger.ts` with daily rotation and pretty-printing in dev. Log structured objects (`logger.info({ reportId }, 'report created')`), not interpolated strings, so the JSON output stays queryable.

## City-agnostic code

The codebase should not assume Berlin. Keep city-specific data (station lists, line colors, network names, timezone, language) in **config files** under `packages/hono-backend/src/db/seed/config.ts` and similar locations — never hard-coded in business logic. Config files are the only sanctioned escape hatch for city-specific values.
