# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run test:visual` — run visual regression tests against the mockup-sandbox
- `pnpm run test:visual:update` — regenerate baseline snapshots (run after intentional UI changes)
- `pnpm run test:visual:report` — generate `tests/visual-regression/visual-diff-report.html` from the last failed test run (before/after/diff thumbnails)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Visual regression tests (`pnpm run test:visual`) require the Component Preview Server workflow to be running (PORT=8081). Start it first or the tests will fail with connection errors.
- After intentional style changes, regenerate baselines with `pnpm run test:visual:update` and commit the updated snapshots in `tests/visual-regression/snapshots/`.
- When visual regression tests fail, `scripts/run-visual-tests.sh` automatically generates `tests/visual-regression/visual-diff-report.html` — a self-contained HTML file with embedded before/after/diff thumbnails for every changed component. Open it in a browser to review the changes without navigating the raw `test-results/` directory.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
