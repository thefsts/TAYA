---
name: FSTS add-on catalog
description: Add-on catalog schema, Convex module, seeding, and wizard integration added in this session.
---

## What was built

- `addOnCatalog` table + `siteAddOns` table in convex/schema.ts (billing-ready fields: billingProviderId, overriddenPriceUsd, trialEndsAt, etc.)
- `convex/addons.ts` — listCatalog, getSiteAddOns, getCatalogWithSiteStatus, enableAddOn, disableAddOn, startTrial, requestAddOn, updateOverride, seedCatalog
- `convex/seed.ts` — seedTestSite (no-auth, idempotent), for dev/CLI seeding
- Wizard Step 8 replaced with live ADDON_CATALOG card grid (selection persisted as addOnSelections: string[] in stepData)
- Launch mutation provisions selected add-ons as 14-day trials
- Catalog seeded: 6 items (Social Publisher Pro $49, AI Blog Writer $39, Smart SEO Pro $29, Website Health Pro $19, Accessibility Pro $19 [beta], Forms Pro $24)

## Seeded test site

- Business: Apex Fitness Studio
- siteId: qd71sbs6m0q215ehvdw9gbvkcn8brk1e
- Slug: apex-fitness-studio
- Domain: apex-fitness-studio.fstsclientsystem.com (temp)
- 3 services + 3 products + 2 add-on trials (Smart SEO Pro, Website Health Pro)
- Seed command: `npx convex run seed:seedTestSite '{}'`

**Why:** Provides a fully wired reference site without needing to run the wizard. Safe to re-run (idempotent).

**How to apply:** Run seed after any schema migration that wipes test data, or before an E2E test run.
