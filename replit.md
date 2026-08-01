# FSTS Client Dashboard

A multi-tenant client dashboard for managing site settings, integrations, and now CRM connectivity via the Operon Connector™.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `bash scripts/deploy-convex.sh` — deploy Convex functions (uses `CONVEX_DEPLOY_KEY` secret, no manual key entry needed)
- `pnpm run test:pricing` — run Defensive Shooting pricing regression tests (20 tests: catalog entry, resolveCoursePayment totals, Square create-order mock)
- `pnpm run test:design-lock` — run Design Lock™ guard integration tests (69 tests: backend auth, source audit, UI component audit)
- `pnpm run test:visual` — run visual regression tests against the mockup-sandbox
- `pnpm run test:visual:update` — regenerate baseline snapshots (run after intentional UI changes)
- `pnpm run test:visual:report` — generate `tests/visual-regression/visual-diff-report.html` from the last failed test run (before/after/diff thumbnails)
- `pnpm run test:e2e` — run Playwright E2E tests (requires the fsts-dashboard workflow to be running + `CLERK_SECRET_KEY` and `CONVEX_DEPLOY_KEY` env vars)
- `pnpm run test:e2e:report` — open the last E2E test HTML report
- `pnpm run test:corsair-e2e` — run Corsair website Playwright tests (auto-starts Next.js dev server; no auth required; covers booking panel pricing assertions)
- `pnpm run test:corsair-e2e:report` — open the last Corsair E2E test HTML report
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

- **Product boundary — FSTS-WOS™ vs. Operon CRM™:** This dashboard is FSTS Website Operating System™ (FSTS-WOS™). Features that act on customers or leads (marketing automation, reputation management, appointment management, lead intelligence, advanced ecommerce) belong in the separate Operon CRM™ product. FSTS-WOS™ is connected to Operon CRM™ exclusively through the Operon Connector™. See `docs/product-boundaries.md` for the full, authoritative boundary specification.
- _Populate as you build — additional non-obvious choices a reader couldn't infer from the code._

## Product

This repository implements **FSTS Website Operating System™ (FSTS-WOS™)** — one of two flagship products from Full Stack Tech Solutions.

**FSTS-WOS™** is the client-facing dashboard for managing a client's website and its direct digital operations: site settings, pages & content, forms, SEO, payment connectors, and website analytics.

**Operon CRM™** is a separate product covering relationship management, marketing automation, and advanced business operations (AI Content Studio™, Review & Reputation Manager™, Appointment & Booking Suite™, Lead Intelligence™, Ecommerce Pro™). These features must not be built into FSTS-WOS™.

**Operon Connector™** is the sole sanctioned integration point between the two products, providing bi-directional data sync. It is default-installed in every FSTS-WOS™ dashboard but inactive until an admin configures credentials. Supports per-entity sync toggles (outbound: contact form, quote request, orders, etc.; inbound: appointment status, lead status, tags, etc.), a sync activity log with retry, and API health monitoring. The connector schema (`lib/db/src/schema/crm-connector.ts`) is provider-agnostic (`CRM_PROVIDERS` array) so additional CRM vendors can be added without a schema rewrite — Operon is the first registered provider.

**Website Reviews Module™** is a display-only feature inside FSTS-WOS™ that imports and renders external reviews (Google, Facebook, Yelp) on client websites. It is explicitly not a reputation-management tool — requesting, responding to, or campaigning for reviews belongs in Operon CRM™ (Review & Reputation Manager™).

- Nav item "Marketing & CRM" surfaces the Operon Connector™ configuration page via SSO to site admins.
- See `docs/product-boundaries.md` for the full boundary specification including module lists, payment connectors, data-flow examples, Business Intelligence Dashboard™ scope, AI Dashboard Assistant™ hard limits, and the Website Reviews Module™ extension pattern.

## User preferences

- All commits pushed to GitHub repos on this user's behalf (e.g. the `thefsts/*` GitHub org repos) must be authored as `thefsts <amorebey@gmail.com>` (lowercase, exactly matching the GitHub username). Never use any other name or email — Vercel blocks deployments if the commit author email doesn't match a GitHub account.

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
