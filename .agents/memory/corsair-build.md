---
name: Corsair build verification
description: Recurring build breaks, Vercel access patterns, and the July 31 deployment recovery findings
---

## Recurring local build break patterns
- CSS import path errors
- framer-motion `ease` tuples need `as [n,n,n,n]`
- `useInView` margin needs `as UseInViewOptions['margin']` (not `as any`)
- Missing `ScrollReveal` imports in new pages
- Unescaped apostrophes in JSX (`'` → `&apos;`)
- `<a href>` to internal routes must be `<Link>` (next/link)
- Date.now() called during render (SSG) — must be hoisted outside render

## Next.js 16 proxy convention
`src/middleware.ts` is deprecated — rename to `src/proxy.ts`. Both are supported but middleware.ts shows a deprecation warning. Having BOTH files simultaneously throws a hard build error. The proxy file can use a default export.

**Why:** Next.js 16.2.4 renamed the middleware file convention to "proxy". AGENTS.md in the Corsair repo explicitly says to heed deprecation notices.

## Vercel access
- `VERCEL_TOKEN` and `VERCEL_FULL_TOKEN` are both SAML-locked → 403/invalidToken on direct API calls
- Vercel CLI cannot be installed in the Replit environment (blocked by security firewall)
- The Replit Vercel connector (`conn_vercel_01KW8B3K8AP14WE30EDZ87885P`) can be used via `connectors.proxy` but requires re-authorization (returns "No vercel connection found" if not connected)
- GitHub commit statuses are the only available signal: `GET /repos/thefsts/corsair-tactical-solutions/commits/<sha>/statuses`

## July 31 deployment failure: root cause
`d0b2c52` (first failing commit) introduced imports from files that were missing on GitHub at build time:
- `src/data/events.ts` — missing `homepageEventsPreview` export and several type fields
- `src/lib/promo-registry.ts` — missing locally (existed on GitHub)
- `src/lib/promo.ts` — stale locally
- `src/app/[locale]/events/EventsPageClient.tsx` — existed locally but was absent from GitHub
- `src/app/api/square/promo-status/route.ts` — imported wrong function name (`buildRegistry` vs `buildPromoRegistry`)
- `vitest.config.ts` / `*.test.ts` files — referenced by tsconfig, caused tsc errors
- All 9 non-English locale JSON files — missing `realtorSafety` namespace (SSG MISSING_MESSAGE crash at page ~481/642)

**How to apply:** When local build passes but Vercel fails, check for files that exist locally but not on GitHub (and vice versa) before assuming a code bug.

## Vercel fast-failure pattern (9–13 seconds)
All recovery commits failed on Vercel in 9–13 seconds — too fast for npm ci + next build. Root cause unknown (can't access logs). Possible causes: build concurrency limits, cancelled deployments from rapid consecutive pushes, or cached failure state. The production domain continues to serve from the last successful deployment.

**How to apply:** If Vercel consistently fails in <15 seconds, it's likely a platform/project-level issue, not a code issue. Check Vercel dashboard manually.
