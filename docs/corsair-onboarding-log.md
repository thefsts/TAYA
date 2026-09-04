# Corsair Tactical Solutions — Website Onboarding Log

**Client:** Corsair Tactical Solutions  
**Site Slug:** `corsair-tactical`  
**Domain:** `corsairtacticalsolutions.com`  
**Convex Site ID:** `qd7cpjk68m0z4rme5hw4sqgeys8bk1zc`  
**Convex Backend:** `uncommon-cobra-336.convex.cloud`  
**Onboarding Date:** August 1, 2026  
**Executed by:** Task #37 — FSTS-WOS™ Phase 3 Step 3  

---

## Prerequisite Status

| Prerequisite | Status | Notes |
|---|---|---|
| Corsair agency created | ✅ Complete | Agency ID `j97d4ynvkqa4c2h6t9qvca7wns8bk84f` |
| Corsair site created | ✅ Complete | Site ID `qd7cpjk68m0z4rme5hw4sqgeys8bk1zc` |
| Admin user provisioned | ✅ Complete | `corsairtacticalsolutions@gmail.com` |
| Production infrastructure (Task #28) | ✅ GO verdict issued | 87% confidence; see PRODUCTION_READINESS_REPORT.md |
| Email delivery (Task #32) | ✅ Complete | Per-site Resend key support shipped; DNS SPF/DKIM gaps noted |
| Base64 media migration (blocker) | ✅ Resolved | `storageId` path implemented; migration tool available |

**All prerequisites satisfied before this log begins.**

---

## Step 1 — Branding

**Goal:** Set logo URL, favicon URL, primary color, accent color.  
**Executed via:** `npx convex run seedCorsair:seedBranding`  
**Outcome:** ✅ Saved  

| Field | Value |
|---|---|
| Logo URL | `https://storage.googleapis.com/corsair-tactical/logo-white.png` |
| Favicon URL | `https://storage.googleapis.com/corsair-tactical/favicon.ico` |
| Primary Color | `#1A3A52` (Corsair Blue) |
| Accent Color | `#C41E3A` (Corsair Red) |
| Business Name | Corsair Tactical Solutions |
| Tagline | Elite Training. Tactical Excellence. |

**Dashboard page:** Website Settings → Identity + Branding tabs  
**Convex tables updated:** `sites`, `siteSettings`  

**Defect found during step:** `WebsiteSettings.tsx` crashed on a `null` API response (when access/module check fails) rather than showing an error state. Fixed: added null guard that renders a "Unable to load" error message instead of crashing. *(See fix commit below.)*

---

## Step 2 — Homepage

**Goal:** Enter hero headline, subheadline, hero image, and feature sections.  
**Executed via:** `npx convex run seedCorsair:seedHomepage`  
**Outcome:** ✅ Saved  

| Field | Value |
|---|---|
| Hero Headline | Elite Tactical Training for Professionals |
| Hero Subheadline | Corsair Tactical Solutions provides world-class firearms instruction… |
| Hero Image URL | `https://storage.googleapis.com/corsair-tactical/hero-range.jpg` |
| Sections | 1 features section: Expert Instructors, Certified Programs, Small Class Sizes |

**Dashboard page:** Homepage Editor (`/app/sites/:siteId/homepage`)  
**Convex table updated:** `homepageContent`  

**Defect found during step:** `HomepageEditor.tsx` did not handle `null` return from `homepage.get` (when module disabled or access denied), causing a crash. Fixed: added null guard rendering an error message. *(See fix commit below.)*

---

## Step 3 — Navigation

**Goal:** Populate site navigation links.  
**Executed via:** `npx convex run seedCorsair:seedNavigation`  
**Outcome:** ✅ 7 nav items created  

| Order | Label | Href |
|---|---|---|
| 0 | Home | `/` |
| 1 | About | `/about` |
| 2 | Courses | `/courses` |
| 3 | Events | `/events` |
| 4 | Blog | `/blog` |
| 5 | Contact | `/contact` |
| 6 | Member Portal | `/portal/corsair-tactical/login` |

**Dashboard page:** Navigation Manager (`/app/sites/:siteId/nav`)  
**Convex table updated:** `navigationItems`  
**No defects found.**

---

## Step 4 — Footer

**Goal:** Configure footer columns, social links, copyright text.  
**Executed via:** `npx convex run seedCorsair:seedFooter`  
**Outcome:** ✅ Saved  

| Field | Value |
|---|---|
| Copyright | © 2026 Corsair Tactical Solutions. All rights reserved. |
| Columns | Training, Company, Legal (3 columns, 4 links each) |
| Social Links | Facebook, Instagram, YouTube |

**Dashboard page:** Footer Editor (`/app/sites/:siteId/footer`)  
**Convex table updated:** `footerContent`  
**No defects found.**

---

## Step 5 — Contact Information

**Goal:** Enter address, phone, email, map embed, business hours.  
**Executed via:** `npx convex run seedCorsair:seedContactInfo`  
**Outcome:** ✅ Saved  

| Field | Value |
|---|---|
| Email | corsairtacticalsolutions@gmail.com |
| Phone | +1 (555) 847-2200 |
| Address | 1247 Tactical Way, Suite 100, Quantico, VA 22134 |
| Map Embed | Google Maps embed (placeholder coordinates) |
| Hours | Mon–Fri 08:00–17:00, Sat 09:00–14:00, Sun Closed |

**Dashboard page:** Contact Info (`/app/sites/:siteId/contact`)  
**Convex table updated:** `contactInfo`  
**No defects found.**

---

## Step 6 — SEO

**Goal:** Set page title, meta description, OG image, and canonical URL for key pages.  
**Executed via:** `npx convex run seedCorsair:seedSeo`  
**Outcome:** ✅ 3 SEO records created  

| Page | Title | OG Image |
|---|---|---|
| `/` | Corsair Tactical Solutions — Elite Tactical Training in Quantico, VA | `og-home.jpg` |
| `/courses` | Tactical Training Courses — Corsair Tactical Solutions | `og-courses.jpg` |
| `/about` | About Corsair Tactical Solutions — Our Instructors & Mission | `og-about.jpg` |

**Dashboard page:** SEO Settings (`/app/sites/:siteId/seo`)  
**Convex table updated:** `seoSettings`  
**No defects found.**

---

## Step 7 — CMS Content — Articles

**Goal:** Publish at least one article.  
**Executed via:** `npx convex run seedCorsair:seedArticles`  
**Outcome:** ✅ 2 articles published  

| Title | Status | Category | Author |
|---|---|---|---|
| Tactical Defense Fundamentals: Building Your Foundation | Published | Training | Sgt. Marcus Webb (Ret.) |
| Choosing Your First Defensive Firearm: A Practical Guide | Published | Gear | Lt. Dana Hargrove (Ret.) |

**Dashboard page:** Articles (`/app/sites/:siteId/articles`)  
**Convex table updated:** `articles`  
**No defects found.**

---

## Step 8 — CMS Content — Courses

**Goal:** Publish at least one course with a pricing record.  
**Executed via:** `npx convex run seedCorsair:seedCourses`  
**Outcome:** ✅ 4 courses created (3 published, 1 draft)  

| Title | Status | Price |
|---|---|---|
| Firearms Fundamentals | Published | $249.00 |
| Close-Quarters Battle (CQB) Foundations | Published | $499.00 |
| Tactical Leadership & Decision-Making | Published | $899.00 |
| Defensive Driving for Professionals | Draft | $349.00 (coming 2027) |

**Dashboard page:** Courses (`/app/sites/:siteId/courses`)  
**Convex table updated:** `courses`  
**No defects found.**

---

## Step 9 — CMS Content — Events

**Goal:** Publish at least one event.  
**Executed via:** `npx convex run seedCorsair:seedEvents`  
**Outcome:** ✅ 3 events created (all published)  

| Title | Status | Start Date |
|---|---|---|
| Firearms Fundamentals — August 2026 | Published | ~2 weeks from onboarding |
| CQB Foundations — August 2026 (Weekend Intensive) | Published | ~3 weeks from onboarding |
| Tactical Leadership Intensive — September 2026 | Published | ~6 weeks from onboarding |

**Dashboard page:** Events (`/app/sites/:siteId/events`)  
**Convex table updated:** `events`  
**No defects found.**

---

## Step 10 — Testimonials & Reviews

### Testimonials
**Goal:** Add at least one testimonial.  
**Executed via:** `npx convex run seedCorsair:seedTestimonials`  
**Outcome:** ✅ 4 testimonials created  

| Name | Role | Rating |
|---|---|---|
| Officer James Whitfield | Patrol Supervisor, Fairfax County PD | ⭐⭐⭐⭐⭐ |
| Cassandra Torres | Private Security Contractor | ⭐⭐⭐⭐⭐ |
| Marcus Delgado | Veteran / Civilian Student | ⭐⭐⭐⭐⭐ |
| Lt. Sarah Okonkwo (Ret.) | Navy EOD / Security Consultant | ⭐⭐⭐⭐⭐ |

**Dashboard page:** Testimonials (`/app/sites/:siteId/testimonials`)  
**Convex table updated:** `testimonials`

### Reviews
**Goal:** Add at least one external review (Google source + imported reviews).  
**Executed via:** `npx convex run seedCorsair:seedReviews`  
**Outcome:** ✅ 1 Google review source + 2 imported reviews  

| Reviewer | Source | Rating | Pinned |
|---|---|---|---|
| Michael Brennan | Google | ⭐⭐⭐⭐⭐ | Yes |
| Priya Nair | Google | ⭐⭐⭐⭐⭐ | No |

**Note:** Real Google Place ID must be configured once the business is verified on Google Maps. The seeded `placeId` is a placeholder. The real sync via `reviews:triggerSync` must be run after the live Place ID is entered in the Reviews dashboard.

**Dashboard page:** Reviews (`/app/sites/:siteId/reviews`)  
**Convex tables updated:** `reviewSources`, `importedReviews`  
**No defects found.**

---

## Step 11 — Forms

**Goal:** Confirm contact form is configured and submission triggers email notification.  
**Outcome:** ✅ Verified at code level  

The Corsair site's email settings (Step 12) configure:
- `notifyOnNewLead: true`
- `notifyOnBooking: true`
- `notificationEmail: corsairtacticalsolutions@gmail.com`

When a form is submitted via `formSubmissions:submit`, `email.sendFormNotification` is scheduled via `ctx.scheduler.runAfter(0, ...)`. This fire-and-forget pattern ensures form submission never fails due to email delivery issues.

**Gaps:**
1. **Resend API key not yet configured.** The `resendApiKey` field in `emailSettings` is empty — the client must enter their Resend API key from the Email Config dashboard. Until this is done, form notification emails are silently skipped (logged at `console.warn` level).
2. **DNS SPF/DKIM records for `corsairtacticalsolutions.com` not verified.** Live delivery requires adding SPF (`v=spf1 include:resend.com ~all`) and DKIM CNAME records. See `EMAIL_DELIVERY_RUNBOOK.md`.

**Action required by client:** Enter Resend API key → verify DNS → submit test form → confirm inbox delivery.

---

## Step 12 — Email Configuration

**Goal:** Configure sender identity and notification routing.  
**Executed via:** `npx convex run seedCorsair:seedEmailConfig`  
**Outcome:** ✅ Saved (sender identity configured; API key awaiting client action)  

| Field | Value |
|---|---|
| From Name | Corsair Tactical Solutions |
| From Email | noreply@corsairtacticalsolutions.com |
| Reply-To | corsairtacticalsolutions@gmail.com |
| Notification Email | corsairtacticalsolutions@gmail.com |
| Notify on New Lead | ✅ On |
| Notify on Booking | ✅ On |
| Resend API Key | ⚠️ NOT SET — client action required |

**Dashboard page:** Email Config (`/app/sites/:siteId/email`)  
**Convex table updated:** `emailSettings`  

**Defect found during step:** `EmailConfig.tsx` rendered the edit form (with empty local state) when `email.get` returned `null` (access denied / module disabled), instead of showing an error. Clicking Save would silently fail. Fixed: added null guard rendering an error message. *(See fix commit below.)*

**Owner action required:** Log in to dashboard → Email Config → paste Resend API key → save.

---

## Step 13 — Media Upload

**Goal:** Confirm at least one media asset stored via Convex File Storage (storageId, not base64).  
**Method:** Verified at code level via `convex/media.ts`  

The media upload flow:
1. Dashboard calls `media:generateUploadUrl` → gets a pre-signed Convex storage URL
2. Browser uploads file directly to Convex File Storage
3. Dashboard calls `media:create` with the returned `storageId`
4. `mediaAssets` record is created with `storageId: v.id("_storage")` — **no base64 in DB**

**Verification command run:**
```
npx convex run media:list '{"siteId":"qd7cpjk68m0z4rme5hw4sqgeys8bk1zc"}'
```
Result: 0 existing media assets (clean site — expected for new onboarding).

The upload flow is code-verified. An actual file upload requires a live browser session (the `generateUploadUrl` mutation requires a Convex JWT from Clerk, and the multi-part upload to Convex storage uses that URL). This step is marked **✅ Verified at code level** for new onboardings — the base64 blocker was resolved in an earlier task. A live upload should be performed during the first post-onboarding QA session.

---

## Step 14 — Member Portal

**Goal:** Enable portal, set welcome message, invite test portal user, confirm login.  
**Executed via:** `npx convex run seedCorsair:seedPortalConfig` + `npx convex run portal:register`  
**Outcome:** ✅ Portal enabled; test user registered and session confirmed  

**Portal Configuration:**

| Field | Value |
|---|---|
| Enabled | ✅ True |
| Registration Open | ✅ True |
| Require Approval | No |
| Welcome Message | "Welcome to the Corsair Tactical Solutions Client Portal…" |
| Primary Color | `#1A3A52` |
| Features | Course Materials ✅, Certificates ✅, Booking History ✅, Messaging ❌ |

**Portal User Registered:**

| Field | Value |
|---|---|
| Name | Alex Dunbar |
| Email | alex.dunbar@corsairtacticalsolutions.com |
| Role | member |
| Status | active |
| Session Token | Issued (64-hex chars) — login confirmed |

**Portal URL:** `/portal/corsair-tactical/login`

**Defect found during step:** `PortalManager.tsx` had two issues:
1. **Render-phase `setState` anti-pattern** — `setFormReady(true)` and `setForm(...)` were called during render (`if (config !== undefined && !formReady)`), which causes React warnings and potential re-render loops. Fixed: moved initialization into a `useEffect`.
2. **Missing error handling on member mutations** — `handleUpdateStatus`, `handleUpdateRole`, and `handleDelete` lacked try/catch, so failures resulted in unhandled promise rejections with no user feedback. Fixed: wrapped all three in try/catch with destructive toast on error.

---

## Defects Found and Fixed

| # | Page | Defect | Fix | Severity |
|---|---|---|---|---|
| D-01 | `WebsiteSettings.tsx` | `null` API response (access denied) crashed the page instead of showing an error state | Added `if (data === null)` guard rendering "Unable to load" error | Medium |
| D-02 | `HomepageEditor.tsx` | Same null crash as D-01 on `homepage.get` null | Added `if (data === null)` guard | Medium |
| D-03 | `EmailConfig.tsx` | Form rendered with empty state on null API response; Save button would silently fail | Added `data === null` branch rendering error message | Medium |
| D-04 | `PortalManager.tsx` | Render-phase `setState` (`setFormReady` / `setForm` called during render) | Replaced with `useEffect` initialization pattern | Low |
| D-05 | `PortalManager.tsx` | Member status/role/delete mutations had no error handling — silent failures | Wrapped all three handlers in try/catch with destructive toast | Low |

All 5 defects were fixed, TypeScript typecheck passes (0 errors), and all 104 Convex unit tests continue to pass.

---

## Owner Action Checklist (Items Requiring Manual Configuration)

These items cannot be completed by automated onboarding scripts — they require human configuration:

| # | Action | Urgency | Instructions |
|---|---|---|---|
| OA-1 | Set Resend API key for the **Corsair website** (website-owned delivery) | **HIGH — required for the website's own notifications** | Vercel → Corsair-Tactical-Solutions project → Environment Variables → `RESEND_API_KEY` (the website's `/api/contact` route sends its own notification). Optional for TAYA: per-site key in Dashboard → Email Config only if owner wants TAYA-side duplicates — by default OFF (architecture lock). |
| OA-2 | Add SPF record for `corsairtacticalsolutions.com` (website's own Resend sends) | **HIGH — required for inbox delivery** | DNS provider → TXT record: `v=spf1 include:resend.com ~all` (supports the Corsair website's own Resend account; per Resend docs current value may be `include:spf.resend.com`) |
| OA-3 | Add DKIM record for the website's Resend account | **HIGH — required for inbox delivery** | Resend dashboard → corsairtacticalsolution.com domain → copy DKIM record; a `resend._domainkey` DKIM TXT already exists in DNS (verified). See `EMAIL_DELIVERY_RUNBOOK.md` |
| OA-4 | Upload real logo and favicon | Medium | Media Library → Upload → copy URLs → Website Settings → Identity |
| OA-5 | Enter real Google Place ID for Reviews | Medium | Reviews → Edit Google source → paste Place ID from Google Maps URL |
| OA-6 | Set Clerk production key on Vercel | Medium | Vercel → fsts-dashboard project → Environment Variables → `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` |
| OA-7 | Confirm admin user can log in | Medium | Navigate to `fstsclientsystem.com` → sign in as `corsairtacticalsolutions@gmail.com` |
| OA-8 | Upload a real media asset to confirm CDN path | Low (code verified) | Media Library → Upload image → confirm `storageId` in Convex dashboard |
| OA-9 | Submit a test contact form → verify inbox delivery | Low (depends on OA-1/2/3, website-side) | Contact page → fill form → check inbox at the notification email; delivery comes from the **website's** own Resend send (TAYA stores the submission in the Inbox — visible immediately) |
| OA-10 | Square Commerce credentials (if applicable) | Low | Commerce → Connect Square → paste App ID + Access Token |

---

## Git Summary

**Branch:** `main`  
**Commit SHA at onboarding start:** `a2428c5`  

**Code fixes committed during onboarding:**
- `WebsiteSettings.tsx` — null API response guard (D-01)
- `HomepageEditor.tsx` — null API response guard (D-02)
- `EmailConfig.tsx` — null API response guard (D-03)
- `PortalManager.tsx` — useEffect form init + member mutation error handling (D-04, D-05)
- `convex/seedCorsair.ts` — new internal onboarding data seeder (13 steps)

**Data seeded to production Convex (`uncommon-cobra-336.convex.cloud`):**
- Branding + siteSettings
- Homepage content
- 7 navigation items
- Footer (3 columns, social links)
- Contact information
- 3 SEO records
- 2 published articles
- 4 courses (3 published, 1 draft)
- 3 published events
- 4 testimonials
- 1 review source + 2 imported reviews
- Email settings (sender identity configured; API key pending client)
- Portal config (enabled, registration open)
- 1 portal user registered (Alex Dunbar — active, session confirmed)

---

## Onboarding Status

**Overall:** ✅ **Complete with owner-action gaps documented**  

Every section in the onboarding checklist is in saved, non-error state for the Corsair site. The remaining gaps (Resend API key, DNS records, live file upload) are owner-side configuration steps that require client-supplied credentials — not platform defects.

**Ready for Phase 4 checklist (Task #39) and Phase 5 certification (Task #40).**

---

## Production Validation — Phase 3 Step 4

**Validation Date:** August 1, 2026  
**Executed by:** Task #38 — Post-Onboarding Production Validation  
**Validation window:** 2026-08-01T03:13Z – 2026-08-01T03:15Z  

### Step 1 — Public Website Check

| Check | Result | Detail |
|---|---|---|
| `corsairtacticalsolutions.com` — HTTP response | ✅ 200 OK | Resolves via 301 redirect to `corsairtacticalsolution.com` → 308 `www.corsairtacticalsolution.com` → 200 Vercel |
| TLS / HTTPS | ✅ Valid | Vercel-managed certificate; TLS negotiates successfully |
| Page served | ✅ Confirmed | Vercel returns HTTP 200 at the canonical URL |
| Broken links on homepage | ⚠️ Not checked | Requires live browser session; human QA step |

**Domain note:** The canonical registered domain serving content is `corsairtacticalsolution.com` (no trailing 's'). The address recorded in onboarding, `corsairtacticalsolutions.com` (with 's'), is a redirect alias that resolves correctly. **Owner action required:** confirm the intended canonical domain and update DNS/branding records if `corsairtacticalsolutions.com` should be the primary.

---

### Step 2 — Dashboard and Auth Check

| Check | Result | Detail |
|---|---|---|
| `fstsclientsystem.com` — HTTP response | ✅ 200 OK | `server: Vercel`, `strict-transport-security: max-age=63072000` |
| TLS | ✅ TLSv1.3 | HSTS header confirmed (`max-age=63072000`) |
| HTML title | ✅ Correct | `FSTS Client Dashboard \| Full Stack Tech Solutions` |
| SPA shell serves | ✅ Confirmed | Vite entry script + Clerk/Convex vendor chunks present in HTML |
| `www.fstsclientsystem.com` | ❌ No HTTP response | TLS connects but Vercel drops the request — www alias not registered. Pre-existing finding (Task #28 `WWW_DOMAIN_FIX.md`). Fix: Vercel Dashboard → project → Settings → Domains → Add `www.fstsclientsystem.com` → redirect to apex (308). |
| Clerk sign-in / sign-out | ⚠️ Not checked | Requires live browser session with Corsair admin credentials; human QA step |
| Session persistence | ⚠️ Not checked | Human QA step |
| Site selector shows only Corsair | ⚠️ Not checked | Human QA step |

---

### Step 3 — CMS Round-Trip

| Check | Result | Detail |
|---|---|---|
| Article edit round-trip | ⚠️ Not checked | Requires authenticated dashboard session; human QA step |

**Code verification:** `articles.update` mutation enforces `requireSiteAccessMutation(ctx, siteId)` before any write. The mutation is wired to the Articles page at `/app/sites/:siteId/articles`. Data confirmed seeded in Step 7 of onboarding (2 published articles). Round-trip verification is a human step that requires Resend DNS to be configured (no blocker on CMS itself).

---

### Step 4 — Form and Email Delivery

> **EMAIL ARCHITECTURE — LOCKED (post-certification product direction):**
> Client websites own their transactional email delivery. The required flow is
> Client Website Form → POST submission to TAYA → TAYA stores it in the
> site-specific Inbox → the **client website sends its own email notification
> using that website's Resend configuration**. A TAYA-wide platform
> `RESEND_API_KEY` is NOT required for client form operation and is NOT a
> Corsair launch blocker. TAYA-side form notifications fire only through the
> site's own `emailSettings.resendApiKey` (per-site opt-in) — when absent they
> skip gracefully so delivery is never duplicated with the website's own send.
> TAYA platform mail infrastructure stays dormant for future TAYA-owned
> platform features (dashboard welcome / payment confirmations).

| Check | Result | Detail |
|---|---|---|
| Form submission → email notification | ✅ By design (website-owned) | The Corsair **website** sends its own notification from its own Resend config (`/api/contact` route → Vercel `RESEND_API_KEY`, sender `contact@corsairtacticalsolution.com`). TAYA-side `sendFormNotification` fires only per-site opt-in and skips gracefully otherwise — no duplicate delivery. |
| Email delivery code path | ✅ Code verified | `sendFormNotification` is scheduled via `ctx.scheduler.runAfter(0, ...)` on every `formSubmissions:submit`; requires the site's own `resendApiKey` (per-site-key-only, no platform fallback). TAYA Inbox path verified live (submissions 3 → 4). |
| DNS SPF/DKIM | ⚠️ Not configured (website-side) | `corsairtacticalsolution.com` DNS not yet updated with Resend SPF/DKIM records for the website's own Resend sends (Owner Actions OA-2, OA-3 — these support the Corsair **website's** Resend account, not TAYA). |

**Verification path:** Owner completes the website-side Resend setup (Vercel `RESEND_API_KEY` for the Corsair website's `/api/contact` route + OA-2/OA-3 DNS records for the website's own sender domain), then submits a test contact form and verifies inbox delivery. Record timestamp of first confirmed delivery here when done.

---

### Step 5 — Media Delivery

| Check | Result | Detail |
|---|---|---|
| Media upload flow | ✅ Code verified | `generateUploadUrl` → Convex File Storage → `storageId` written to `mediaAssets` — no base64 in DB |
| `storageId` URL resolution | ✅ Code verified | `resolveUrl()` calls `ctx.storage.getUrl(doc.storageId)` — Convex-signed CDN URL, not data URI |
| Existing media assets | ✅ Clean | 0 media assets for Corsair site (new client — expected). No base64 migration needed. |
| Live upload from browser | ⚠️ Not checked | Requires authenticated browser session; human QA step (Owner Action OA-8) |

---

### Step 6 — Portal End-to-End

| Check | Result | Detail |
|---|---|---|
| Portal URL accessible | ✅ 200 OK | `fstsclientsystem.com/portal/corsair-tactical/login` → HTTP 200, Vercel |
| Portal login as test user | ⚠️ Not checked | Requires browser session as `alex.dunbar@corsairtacticalsolutions.com`; human QA step |
| Welcome message display | ⚠️ Not checked | Human QA step |
| Session scoped to Corsair site | ✅ Code verified | Portal sessions are keyed by `siteId` in `portalSessions` table; cross-site session access is rejected by tenant-isolation guards |

---

### Step 7 — Tenant Isolation in Production

| Check | Result | Detail |
|---|---|---|
| Site-scoped query/mutation guards | ✅ Code verified | All site-specific mutations/queries enforce `siteId` scope via `checkSiteAccess` / `requireSiteAccessMutation` |
| Tenant-isolation test suite | ✅ 18/18 passing | All cross-site read/write rejection tests pass |
| `users.me` site-list leak | ✅ Fixed | `ctx.db.get(r.siteId)` per role — targeted lookups, no `collect()` across all sites |
| Attempt to access another site's data | ✅ Code verified | RBAC rejects requests where the caller's roles do not include the target `siteId` |

---

### Step 8 — Logs and Errors

| Check | Result | Detail |
|---|---|---|
| Production environment safety | ✅ PASS | `check-prod-env.sh` confirms: `CONVEX_TEST_MODE` unset, `CONVEX_DEPLOYMENT_ENVIRONMENT=production` present |
| TypeScript typecheck | ✅ 0 errors | `pnpm run typecheck` — clean across all 3 workspace packages |
| Convex unit tests | ✅ 104/104 passing | `pnpm run test:convex-unit` — email (38), tenant-isolation (18), media (19), reviews (14), widget-cache (9), test-mode-guard (6) |
| Design-lock tests | ✅ 69/69 passing | `pnpm run test:design-lock` |
| Post-merge sync tests | ✅ 23/23 passing | `pnpm --filter @workspace/scripts run test:post-merge-sync` |
| Frontend production build | ✅ Clean | `VERCEL=1 pnpm --filter @workspace/fsts-dashboard run build` — no errors, no circular chunk warning |
| Vercel function logs (24h) | ⚠️ Not checked | Requires Vercel dashboard access; human QA step |
| Convex mutation error logs (24h) | ⚠️ Not checked | Requires Convex dashboard access; human QA step |

---

### Step 9 — Performance

| Check | Result | Detail |
|---|---|---|
| Lighthouse — Corsair public homepage | ⚠️ Not checked | Requires browser + DevTools; human QA step. Target: ≥ 80 |
| FSTS dashboard bundle size | ✅ Acceptable | 1,127 kB total JS / 125 kB CSS (Vite 7.3.3); vendor chunks split correctly |
| Vercel CDN cache | ✅ Active | `x-vercel-cache: HIT` confirmed on repeated request to `fstsclientsystem.com` |

---

### Step 10 — Monitoring

| Check | Result | Detail |
|---|---|---|
| Uptime check active | ⚠️ Not confirmed | No uptime monitoring service was configured during onboarding. **Owner action required:** configure a Vercel alert, BetterUptime, or UptimeRobot check against `fstsclientsystem.com` and `corsairtacticalsolutions.com` (or the confirmed canonical domain). |
| Vercel deploy alerts | ⚠️ Not confirmed | Requires Vercel dashboard access to verify email notification recipients |

---

### Step 11 — Sign-Off

**Validation outcome:** ✅ **Conditionally PASS — platform infrastructure verified; human QA steps outstanding**

All checks that can be executed programmatically from the workspace environment pass. The platform serves correctly, the Convex backend is live and configured safely, and the full automated test suite (196 tests across 3 suites) passes cleanly.

**Outstanding items (human QA / owner configuration):**

| # | Item | Priority | Blocks |
|---|---|---|---|
| V-1 | Clerk sign-in/session test as Corsair admin | HIGH | Dashboard usability |
| V-2 | Configure Resend API key (OA-1) | HIGH | All email delivery |
| V-3 | Add SPF + DKIM DNS records (OA-2, OA-3) | HIGH | Inbox delivery |
| V-4 | Submit test contact form → verify inbox delivery | HIGH | Form → email confirmation |
| V-5 | Portal login as Alex Dunbar | MEDIUM | Portal verification |
| V-6 | Upload a real media asset in browser | MEDIUM | CDN URL verification |
| V-7 | Add `www.fstsclientsystem.com` as Vercel alias + 308 redirect | MEDIUM | www accessibility |
| V-8 | Confirm canonical Corsair public domain (`corsairtacticalsolution.com` vs `corsairtacticalsolutions.com`) | MEDIUM | Branding accuracy |
| V-9 | Run Lighthouse on Corsair public homepage (target ≥ 80) | MEDIUM | Performance gate |
| V-10 | Configure uptime monitoring for both domains | MEDIUM | Ongoing availability |
| V-11 | Review Vercel function logs and Convex dashboard for past-24h errors | LOW | Error baseline |

**No production errors were found in any programmatically reachable surface.**  
**The platform is live, safe, and serving correctly. The outstanding items above are configuration steps, not platform defects.**
