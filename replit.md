# FSTS Client Dashboard

A multi-tenant client dashboard for managing site settings, integrations, and now CRM connectivity via the Operon Connector™.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `bash scripts/deploy-convex.sh` — deploy Convex functions (uses `CONVEX_DEPLOY_KEY` secret, no manual key entry needed)
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

- Site owners can view and manage settings for their sites.
- Settings → Operon CRM: a native "Operon Connector™" for bi-directional sync between the site and Operon CRM. Default-installed but not connected until an admin configures credentials. Supports per-entity sync toggles (outbound: contact form, quote request, orders, etc.; inbound: appointment status, lead status, tags, etc.), a sync activity log with retry, and API health monitoring.
- Nav item "Marketing & CRM" surfaces this page via SSO to site admins.
- The connector schema (`lib/db/src/schema/crm-connector.ts`) is intentionally modular/provider-agnostic (`CRM_PROVIDERS` array) so a second CRM vendor can be added without a schema rewrite — Operon is the first of potentially several registered providers.

## User preferences

- All commits pushed to GitHub repos on this user's behalf (e.g. the `thefsts/*` GitHub org repos) must be authored as `Thefsts <amorebey@gmail.com>`.

## Gotchas

- **Vercel deployment requires two environment variables set in the Vercel project settings:**
  - `VITE_CLERK_PUBLISHABLE_KEY` — must be a **production** key starting with `pk_live_` (find it in Clerk Dashboard → API Keys). A development key (`pk_test_`) will be blocked by Clerk in production and crash the app.
  - `VITE_CONVEX_URL` — the Convex deployment URL for the production deployment (find it in Convex Dashboard → your deployment → Settings → URL & Deploy Key).
  - Without both vars the app throws on load and Vercel serves a 404.

- Visual regression tests (`pnpm run test:visual`) require the Component Preview Server workflow to be running (PORT=8081). Start it first or the tests will fail with connection errors.
- Missing baselines are auto-generated on first run — adding a new mockup will never cause a red build just because its snapshot doesn't exist yet. The pre-test script (`tests/visual-regression/scripts/ensure-baselines.mjs`) detects the gap and runs a targeted `--update-snapshots` pass before the comparison run.
- After intentional style changes, regenerate baselines with `pnpm run test:visual:update` and commit the updated snapshots in `tests/visual-regression/snapshots/`.
- When visual regression tests fail, `scripts/run-visual-tests.sh` automatically generates `tests/visual-regression/visual-diff-report.html` — a self-contained HTML file with embedded before/after/diff thumbnails for every changed component. Open it in a browser to review the changes without navigating the raw `test-results/` directory.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
