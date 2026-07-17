# Corsair Vercel Build Fix — July 2026

## Summary

Seven consecutive Vercel deployments of `thefsts/Corsair-Tactical-Solutions` failed
due to a TypeScript strict-mode error introduced during CMS wiring work. Two
additional regressions (missing Oswald font; stale `corsair-source/` copies) were
found during the sync investigation and also fixed.

Note: the originating task description said "5 failing deployments" — the actual
confirmed count is 7 (every commit from `4bf1bc3c` through `eb3b8ed6`).

---

## Failing Deployments (all confirmed via GitHub Commit Status API)

> Vercel API is SAML-locked and inaccessible from outside the org SSO session.
> Build status was determined via
> `GET /repos/thefsts/Corsair-Tactical-Solutions/commits/{sha}/status`
> which Vercel populates automatically. All 7 returned `state: "failure"`.

| # | Commit | Message |
|---|--------|---------|
| 1 | `4bf1bc3c` | feat: wire all public CMS content types to Convex backend |
| 2 | `81ace87c` | fix: complete all CMS content type connections — all 5 blocking gaps resolved |
| 3 | `95d4c957` | fix: resolve all 3 remaining CMS wiring gaps (API contract, field names, footer) |
| 4 | `0a4432ee` | fix: address all code-review blockers — CMS-first everywhere |
| 5 | `62d8ed05` | fix: CTA wiring, policy fallback removal, blog metadata guard |
| 6 | `36e351bd` | feat: wire approved reviews display to homepage |
| 7 | `eb3b8ed6` | chore: remove stale corsair-source/ subdirectory from repo root |

All 7 fix attempts (commits 2–7) failed because they each targeted different symptoms
(testimonials, footer, field names, metadata, reviews) without addressing the
underlying TypeScript type error described below.

---

## Root Cause

**TypeScript strict-mode error — property access on undeclared interface fields.**

`src/app/[locale]/courses/[slug]/page.tsx` (lines 305–356) accessed three properties
that were never declared in the `Course` interface in `src/lib/courses.ts`:

```typescript
// Each of the 7 failing builds produced TS2339 errors on these lines:
course.externalCourse    // TS2339: Property 'externalCourse' does not exist on type 'Course'
course.externalUrl       // TS2339: Property 'externalUrl' does not exist on type 'Course'
course.externalCheckout  // TS2339: Property 'externalCheckout' does not exist on type 'Course'
```

TypeScript `strict` mode (enabled in `tsconfig.json`) rejects any property access not
declared in the type, regardless of whether the property is used conditionally. The
build fails at the type-check phase before any runtime code is emitted.

The `externalCourse` / `externalUrl` / `externalCheckout` properties were rendered in
the course detail page for the "Online LTC Assessment" external redirect feature, but
the corresponding interface fields were never added when the feature was first coded.

---

## Fix (GitHub repo)

**Commit `982eba53`** — "Update Instagram URL + redirect Online LTC Assessment externally"

Added the three missing optional fields to the `Course` interface in `src/lib/courses.ts`:

```typescript
externalCourse?:   boolean;
externalUrl?:      string;
externalCheckout?: boolean;
```

This satisfied TypeScript and allowed the build to succeed.

**First passing deployment after the fix:**
Commit `2605e851` ("chore: use npm ci for reproducible production installs") — `Vercel:success`

---

## Additional Fix 1: Oswald Font Regression (pushed to GitHub root)

`src/app/[locale]/layout.tsx` in the GitHub root had lost the Oswald `next/font`
import during a cleanup commit. `src/app/globals.css` uses `var(--font-oswald)` for
`--font-headline`:

```css
/* globals.css */
--font-headline: var(--font-oswald), 'Oswald', ui-sans-serif, system-ui, ...;
```

With `--font-oswald` undefined (never set by a `next/font` loader), CSS custom
property resolution marks `--font-headline` as invalid at computed-value time, causing
all `h1`/`h2`/`h3` elements to fall back to the browser's default `serif` font. The
Vercel build passed (no TypeScript error) so the regression was silently live across
5+ deployments.

**Fix applied:** Pushed the correct `layout.tsx` from `corsair-source/` (which retains
the full Inter + Oswald `next/font` config including `oswald.variable` on `<body>`)
to the GitHub root via blob→tree→commit→PATCH API.

**Commit `35c62816`** — "fix: restore Oswald font loading in root layout"
**Vercel status:** `success` ✅
**Deployment URL:** `https://vercel.com/fullstacksolutions/corsair-tactical-solutions/CsEP9FWDtsK2wRU`

---

## corsair-source/ Sync State

`corsair-source/` is a local dev mirror inside this Replit workspace. It has not been
present in the GitHub repo since commit `7f424895`. All files were verified against
current GitHub `main` (ref `35c62816`).

### Files already in sync (no change needed)

| File | GitHub | corsair-source | Notes |
|------|--------|----------------|-------|
| `src/lib/courses.ts` | 1475 lines | 1475 lines | externalCourse fields present in both |
| `src/app/[locale]/courses/[slug]/page.tsx` | 431 | 431 | identical |
| `src/app/[locale]/courses/page.tsx` | 499 | 499 | identical |
| `src/app/[locale]/page.tsx` | 920 | 919 | trailing newline only |
| `src/lib/schema.ts` | 258 | 258 | identical |
| `src/components/Header.tsx` | 768 | 767 | trailing newline only |
| `src/app/[locale]/layout.tsx` | 155 | 155 | identical after Oswald fix |

### Files updated in corsair-source/ this session

| File | GitHub | Before | After |
|------|--------|--------|-------|
| `src/components/BlogClient.tsx` | 763 lines | 712 lines | 763 lines |
| `src/styles/animations.css` | 212 lines | 202 lines | 212 lines |

**BlogClient.tsx:** GitHub root had a more complete version — `LEARNING_AREAS`
constant, motion-animated card grid layout, improved featured article block with
card wrapper and overlaid category badge, `motion.button` for category filters.
corsair-source/ was behind production; updated to match.

**animations.css:** GitHub root had additional `.btn-red-glow::after` lightSweep
shimmer animation and improved `.btn-red-glow:hover` box-shadow. corsair-source/
was behind production; updated to match.

**Build verified:** `npm run build` in `corsair-source/` passes after sync
(646 static routes, 0 TypeScript errors).

---

## Full Deployment Timeline

| Commit | Status | Description |
|--------|--------|-------------|
| `4bf1bc3c` | ❌ failure | First commit accessing undeclared externalCourse fields |
| `81ace87c` | ❌ failure | CMS fix attempt — TS2339 persists |
| `95d4c957` | ❌ failure | CMS gap fix — TS2339 persists |
| `0a4432ee` | ❌ failure | Code-review blockers fix — TS2339 persists |
| `62d8ed05` | ❌ failure | CTA/metadata fix — TS2339 persists |
| `36e351bd` | ❌ failure | Reviews wiring — TS2339 persists |
| `eb3b8ed6` | ❌ failure | corsair-source/ removal — TS2339 persists |
| `982eba53` | ✅ success | **Root fix:** externalCourse/Url/Checkout added to Course interface |
| `d9e23bb0` | ✅ success | de-template blog/homepage |
| `74d9065d` | ✅ success | de-template article page |
| `7f424895` | ✅ success | corsair-source/ removal |
| `2605e851` | ✅ success | npm ci for reproducible installs |
| `35c62816` | ✅ success | **Oswald font regression fix** (this session) |
