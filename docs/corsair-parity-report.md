# Corsair Repository Parity Report

**Date:** 2026-07-31  
**Phase:** 2A — Verify the Corsair Repository  
**Prepared for:** FSTS-WOS™ Production Readiness Sprint

---

## Summary

This report fulfils the Phase 2A requirement: a read-only comparison between the
`corsair-source/` directory (as it existed in the FSTS-WOS™ repository) and the
dedicated `thefsts/Corsair-Tactical-Solutions` repository.

**GitHub access result:** The dedicated Corsair repository requires authentication
(`thefsts/Corsair-Tactical-Solutions` is private). A blob-SHA comparison via the
GitHub API could not be performed from this workspace because no personal access
token is scoped to that repository. The comparison below is therefore based on the
240-file git diff recorded in commit `9bfb3af` ("chore(dashboard): stop tracking
Corsair website source"), which captured the complete `corsair-source/` tree at the
moment it was removed from the FSTS-WOS™ index.

**Removal status:** `corsair-source/` was removed from git tracking in commit
`9bfb3af` (2026-07-17). The directory is now listed in `.gitignore`. No Corsair
source files appear in `git ls-files`.

---

## Files Removed from FSTS-WOS™ (corsair-source/ tree)

The following categories were present in `corsair-source/` and have been removed
from the FSTS-WOS™ git index. All are Corsair website assets that belong exclusively
in `thefsts/Corsair-Tactical-Solutions`.

### Build & Configuration
| File | Notes |
|------|-------|
| `next.config.ts` | Next.js build configuration |
| `package.json` | Corsair website npm manifest |
| `package-lock.json` | npm lockfile (7 409-line) |
| `postcss.config.mjs` | CSS toolchain config |
| `eslint.config.mjs` | Corsair ESLint rules |
| `.gitignore` | Corsair-specific ignore rules |

### Documentation (Corsair-specific)
| File | Notes |
|------|-------|
| `AGENTS.md` | Corsair agent instructions |
| `CLAUDE.md` | Corsair Claude instructions |
| `LAUNCH.md` | Corsair launch checklist |
| `README.md` | Corsair project readme |
| `STRIPE_INTEGRATION.md` | Stripe payment integration guide |
| `docs/SQUARE_PRODUCTION_SETUP.md` | Square production setup guide |

### Internationalisation (i18n) — 10 locale files
`messages/ar.json`, `messages/de.json`, `messages/en.json`, `messages/es.json`,
`messages/fr.json`, `messages/ko.json`, `messages/pt.json`, `messages/tl.json`,
`messages/vi.json`, `messages/zh.json`

Each locale file contained ~2 000 lines of Corsair course, event, and marketing copy.

### Public / Static Assets
| File | Notes |
|------|-------|
| `public/corsair-logo-transparent.png` | Brand logo (transparent) |
| `public/corsair-logo.jpg` | Brand logo (JPEG) |
| `public/corsair-logo.png` | Brand logo (PNG) |
| `public/favicon.svg` | Site favicon |
| `public/og-default.jpg` | Open Graph default image |
| `public/steve-hopwood.jpg` | Instructor headshot |

### Application Source — Pages (Next.js App Router)
| Route | Notes |
|-------|-------|
| `src/app/[locale]/page.tsx` | Homepage (775 lines) |
| `src/app/[locale]/about/page.tsx` | About page (582 lines) |
| `src/app/[locale]/blog/page.tsx` | Blog listing |
| `src/app/[locale]/careers/page.tsx` | Careers page (265 lines) |
| `src/app/[locale]/contact/page.tsx` | Contact page (453 lines) |
| `src/app/[locale]/courses/page.tsx` | Course listing (499 lines) |
| `src/app/[locale]/downloads/page.tsx` | Downloads page (191 lines) |
| `src/app/[locale]/events/page.tsx` | Events listing |
| `src/app/[locale]/faq/page.tsx` | FAQ page (254 lines) |
| `src/app/[locale]/policies/page.tsx` | Policies page (190 lines) |
| `src/app/layout.tsx` | Root layout |
| `src/app/[locale]/layout.tsx` | Locale layout (155 lines) |
| `src/app/robots.ts` | robots.txt generator |
| `src/app/sitemap.ts` | sitemap.xml generator (77 lines) |
| `src/app/globals.css` | Global styles (483 lines) |
| `src/app/favicon.ico`, `icon.png`, `apple-icon.png` | App icons |

### Application Source — API Routes
| Route | Notes |
|-------|-------|
| `src/app/api/contact/route.ts` | Contact form submission (106 lines) |
| `src/app/api/event-register/route.ts` | Event registration (264 lines) |
| `src/app/api/seats/route.ts` | Seat availability check (104 lines) |
| `src/app/api/square/webhook/route.ts` | Square webhook handler (78 lines) |
| `src/app/api/waiver/route.ts` | Waiver submission (103 lines) |

### Application Source — UI Components (partial list)
`BookingForm.tsx` (871 lines), `EventBookingForm.tsx` (414 lines),
`Header.tsx` (777 lines), `Footer.tsx` (470 lines), `HeroCarousel.tsx` (1 086 lines),
`CourseCard.tsx`, `PricingCard.tsx`, `SeatCounter.tsx`, `PageHero.tsx` (375 lines),
and ~25 additional Corsair-specific UI components.

### Application Source — Data & Business Logic
| File | Notes |
|------|-------|
| `src/lib/courses.ts` | Corsair course catalog (slugs, prices, add-ons) |
| `src/lib/pricing.ts` | `resolveCoursePayment`, `validateEventCourseSlug` |
| `src/data/events.ts` | Corsair event definitions, `CorsairEvent` types |

### Utility Scripts (Corsair-specific)
`scripts/add-events-translations.py` (517 lines),
`scripts/add-page-metadata.py` (164 lines),
`scripts/check-square-catalog.mjs` (85 lines),
`scripts/sync-square-catalog.mjs` (62 lines),
`scripts/get-square-locations.mjs` (45 lines), and 5 additional migration scripts.

---

## Verification Status

| Checklist item | Status |
|----------------|--------|
| Application source removed from FSTS-WOS™ git index | ✅ Removed (commit `9bfb3af`) |
| `.gitignore` entry added for `corsair-source/` | ✅ Present |
| `git ls-files corsair-source/` returns empty | ✅ Confirmed |
| `scripts/check-corsair-guard.sh` passes | ✅ Clean |
| Blob-SHA comparison against `thefsts/Corsair-Tactical-Solutions` | ⚠️ Skipped — repo requires auth |
| Owner verification that dedicated repo is complete | ⚠️ Requires owner to confirm |

---

## Recommendation

Because the `thefsts/Corsair-Tactical-Solutions` repository is private and was not
accessible for blob-SHA comparison, the owner must confirm that all files listed above
are present in the dedicated repo before any Corsair onboarding work begins.

The FSTS-WOS™ platform is now free of Corsair source. No Corsair-specific files remain
in `git ls-files`. The `.gitignore` entry prevents future accidental commits.

---

## Files Found Only in corsair-source/ (not in FSTS-WOS™ platform)

All files listed in the section above were Corsair-exclusive and are absent from the
FSTS-WOS™ platform codebase. None of the Corsair website pages, components, API
routes, pricing logic, course data, event data, i18n files, or public assets are
needed by the FSTS-WOS™ platform. They belong exclusively in
`thefsts/Corsair-Tactical-Solutions`.

## Files Found Only in FSTS-WOS™ (not in corsair-source/)

All platform files (`convex/`, `artifacts/fsts-dashboard/`, `lib/`, `tests/`,
`scripts/check-boundary.sh`, `docs/product-boundaries.md`, etc.) are FSTS-WOS™
platform assets that were never part of the Corsair website repository.
