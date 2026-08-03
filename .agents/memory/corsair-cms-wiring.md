---
name: Corsair CMS wiring
description: How the Corsair website reads live CMS data from the FSTS Convex deployment.
---

## URL shape
Convex HTTP actions (those in `convex/http.ts`) are served from `*.convex.site`, NOT `*.convex.cloud`.
- Correct base: `https://uncommon-cobra-336.convex.site`
- `*.convex.cloud` is for the WebSocket SDK (VITE_CONVEX_URL); using it for HTTP fetch silently 404s.
- `cms.ts` had the wrong domain (`clean-marlin-94.convex.cloud`) — fixed to `uncommon-cobra-336.convex.site`.

**Why:** `cms.ts` was written before the deployment was pinned. The URL difference is easy to miss because both domains resolve; only the HTTP routes fail silently.

**How to apply:** Whenever adding a new fetch helper in the Corsair website, always use `.convex.site` for HTTP actions. Set `CONVEX_URL` env var in Vercel to point there.

## Site slug
`corsair-tactical` — used as the `?slug=` param for all public API calls.

## Courses page pattern (server wrapper + client component)
The courses page (`src/app/[locale]/courses/page.tsx`) is a Next.js Server Component wrapper that:
1. Calls `getCmsCourses()` (revalidate: 60 s)
2. Builds `cmsPriceOverrides: Record<slug, priceCents>`
3. Renders `<CoursesClientPage cmsPriceOverrides={...} />`

`CoursesClientPage.tsx` (the `'use client'` interactive component) uses the overrides in `displayCatalogPrice(slug, overrides)`, falling back to static `pricing.ts` when no CMS match exists.

**Why:** The courses page was a pure client component — a server wrapper that passes serialisable overrides is the minimal change that avoids a full refactor while satisfying the "prices come from API" requirement.

## Services endpoint
`/api/public/services?slug=<site-slug>` → added in `convex/http.ts` + `convex/public.ts:getServicesBySlug`.
Schema uses `price` (string), not `priceCents` (number) — unlike products/courses.

## Security-services page
Fetches `getCmsServices()` in the server component; renders a conditional CMS services grid (only shown when `cmsServices.length > 0`). Corsair already had 3 seeded services in `siteServices` table.
