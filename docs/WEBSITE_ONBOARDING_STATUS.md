# FSTS-WOS™ — Website Onboarding Status
**Last updated:** August 2026

---

## What Already Exists (Do Not Duplicate)

### `pages/app/admin/AdminSiteOnboarding.tsx`
A 7-step admin-only wizard:
1. **Site Details** — name, slug, status, domain
2. **Website Settings** — type, colors, logo, favicon, white-label
3. **Agency** — assign to agency
4. **Modules** — enable/disable feature modules
5. **Payment** — provision Square/Stripe/PayPal connector
6. **Users** — assign initial roles by email
7. **Review + Create** — calls `api.sites.create`, `api.siteSettings.updateIdentity`, `api.users.addSiteRole`, `api.paymentConnectors.provisionConnector`

**Gaps vs the 10-step directive:**
- No progress save/resume (all state in React, lost on refresh)
- No business information step (hours, timezone, service area, description)
- No website purpose selection
- No page structure selection
- No template selection
- No content setup (AI / own / skip)
- No domain step with DNS instructions
- No integrations step
- No add-on step
- Admin-only, no client self-service path

### `convex/sites.create` mutation
Creates: site record, crmConnections (not_connected), homepageContent (placeholder), footerContent (empty), contactInfo (empty), seoSettings (basic).
Requires: `isSuperAdmin`. Returns site response.

### `convex/seedClient.ts`
Parameterized seeder (`internalMutation` / `internalAction` — CLI-only, not browser-callable).
Seeds: branding, homepage, navigation, footer, contact, SEO, FAQs, testimonials, team, events, courses, articles, policies.
Usage: `npx convex run seedClient:seedClientSite '{...}'`

### `convex/provision.ts`
Test-environment-only provisioning helpers. Locked behind `requireTestEnvironment()`. Do not use for production onboarding.

---

## What the 10-Step Wizard Adds

### New schema table: `onboardingProgress`
Saves wizard state after each step so users can exit and resume.
Fields: sessionKey, createdBy, agencyId, siteId, currentStep, stepData (JSON), status.

### New Convex module: `convex/onboarding.ts`
Production mutations (not test-mode locked):
- `createSession` — new wizard session
- `saveStep` — persist step data
- `getSession` — resume from saved state
- `listMySessions` — find in-progress sessions
- `launch` — atomically create site + seed all starter content

### New component: `pages/app/OnboardingWizard.tsx`
Full 10-step wizard accessible to superAdmins from the Sites List.

---

## Step-by-Step Specification

| Step | Name | Key Fields | Seeded on Launch |
|---|---|---|---|
| 1 | Business Information | businessName, websiteName, industry, description, phone, email, address, timezone | sites, contactInfo |
| 2 | Website Purpose | purposes[] (multi-select) | stored in stepData |
| 3 | Website Structure | pages[] (multi-select) | navigationItems |
| 4 | Branding | brandColorPrimary, brandColorSecondary, fontHeading, fontBody, designStyle | sites.brandColor*, settings |
| 5 | Template | templateId | stored in stepData |
| 6 | Content Setup | contentSetup (own/ai/skip) | homepageContent placeholder |
| 7 | Domain | domainChoice, customDomain | sites.domain |
| 8 | Integrations | integrations[] | crmConnections if Operon selected |
| 9 | Add-ons | (placeholder — system not built yet) | — |
| 10 | Review & Launch | readiness summary | triggers launch mutation |

---

## Build Order

1. ✅ Document existing code (this file)
2. 🔄 Add `onboardingProgress` table to schema
3. 🔄 Create `convex/onboarding.ts`
4. 🔄 Build `OnboardingWizard.tsx`
5. 🔄 Wire route `/app/onboard` in `App.tsx`
6. 🔄 Update "Add Site" button in `SitesList.tsx`
7. ⬜ Services Manager (CMS gap)
8. ⬜ Products/Offerings Manager (CMS gap)
9. ⬜ Add-on architecture
10. ⬜ Social Publisher Pro
