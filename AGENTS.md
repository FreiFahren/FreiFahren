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

## Backend conventions

- **Throw `AppError` at service boundaries**, not raw `Error` or ad-hoc `c.json({ error: ... })`. `AppError` (see `packages/hono-backend/src/common/errors.ts`) carries a `statusCode` and an `internalCode`, and the central error handler strips descriptions in production so internal details don't leak. Domain-specific errors should be converted to `AppError` before they reach the response.
- **Use the Pino logger from context** (`c.get('logger')`) instead of `console.log`. It's wired up in `packages/hono-backend/src/common/logger.ts` with daily rotation and pretty-printing in dev. Log structured objects (`logger.info({ reportId }, 'report created')`), not interpolated strings, so the JSON output stays queryable.

## City-agnostic code

The codebase should not assume Berlin. Keep city-specific data (station lists, line colors, network names, timezone, language) in **config files** under `packages/hono-backend/src/db/seed/config.ts` and similar locations — never hard-coded in business logic. Config files are the only sanctioned escape hatch for city-specific values.

## Frontend conventions

- **kebab-case for filenames.** Components, hooks, routes, utilities — all kebab-case (`report-card.tsx`, `use-reports.ts`, `format-timestamp.ts`). The default export inside still uses PascalCase for components and camelCase for hooks/utils; only the filename changes.
- **Optimization priorities, in order:**
    1. **Performance — bundle size first.** Every dependency is weighed against its bytes-over-the-wire cost. Prefer tree-shakeable libraries, subset-specific imports, and native browser APIs over polyfilled packages. Audit with `bun run build` before merging anything that adds a dependency.
    2. **Maintainability.** Clear, predictable code beats clever code. Lean on shadcn/ui primitives + Tailwind utilities rather than building bespoke design systems. Co-locate route logic in TanStack Router file routes; co-locate data fetching in TanStack Query hooks.
- **No `useMemo` or `useCallback`.** React Compiler is enabled and emits equivalent memoization automatically. Hand-written `useMemo`/`useCallback` are noise — they don't compose with the compiler's analysis and just add maintenance cost. Same for `React.memo` on plain components. Exceptions only for cases where the compiler explicitly bails out (the ESLint rule will flag these).
- **Prefer file-based route references over string paths.** When navigating with `<Link>` or `useNavigate`, import the target route and use `Route.to` (e.g. `import { Route as ReportsRoute } from '@/routes/_map/reports/index'` then `to={ReportsRoute.to}`) instead of a hard-coded `to="/reports"`. This keeps navigation type-safe and refactor-proof when routes move or rename.
