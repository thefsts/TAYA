# FSTS-WOS™ Website Onboarding Checklist

**Version:** 1.0 — Derived from Corsair Tactical Solutions (Website #1, August 2026)  
**Audience:** FSTS team members executing a new client website onboarding  
**Purpose:** Step-by-step SOP to take a new client website from zero to live. Every section is drawn from real steps, real defects, and real resolutions during the Corsair onboarding. Follow each section in order; do not skip sections unless explicitly noted.

> **Legend:**  
> `[ ]` — Action item to complete and check off  
> ✅ **Done when…** — Unambiguous pass criterion for the section  
> ⚠️ **Owner action** — Step that requires the client to supply credentials or take action outside this dashboard

---

## Prerequisites (Complete Before Starting)

Before beginning any onboarding step, verify all of the following are in place:

| Prerequisite | How to verify |
|---|---|
| Platform production readiness approved | `PRODUCTION_READINESS_REPORT.md` has a GO or GO-WITH-CONDITIONS verdict |
| Convex backend reachable | `VITE_CONVEX_URL` Replit secret is set; dashboard loads at `fstsclientsystem.com` |
| Clerk auth working | Dashboard sign-in succeeds with superadmin account |
| GitHub PAT present | `GITHUB_PAT` Replit secret is set (required for post-merge sync) |
| Client email address confirmed | Obtain the client's admin email before creating any records |

✅ **Done when…** every row above is confirmed before touching Step 1.

---

## Section 1 — Domain Setup

**Purpose:** Establish the client's custom domain and configure it as a Vercel alias pointing to the FSTS platform.

- [ ] 1. Confirm the client owns the domain (registrar login or DNS access required).
- [ ] 2. Identify the client's DNS provider (Cloudflare, GoDaddy, Route53, etc.).
- [ ] 3. In Vercel Dashboard → project `fsts-client-dashboard-for-sites-api-server` → Settings → Domains:
  - [ ] a. Add the apex domain (e.g. `corsairtacticalsolutions.com`).
  - [ ] b. Add the `www` subdomain (e.g. `www.corsairtacticalsolutions.com`) and configure a 308 redirect to the apex.
- [ ] 4. Provide the client with the DNS records Vercel requires (A record or CNAME for apex; CNAME for `www`).
- [ ] 5. Wait for DNS propagation (typically 5–30 minutes; up to 48 hours worst case).

✅ **Done when…** `curl -sI https://<client-domain>` returns `HTTP/2 200` with `server: Vercel` in the response headers, **and** `curl -sI https://www.<client-domain>` returns a 308 redirect to the apex.

> **Note (from Corsair onboarding):** The `www` subdomain is a separate Vercel domain alias — it does not redirect automatically. If omitted, TLS negotiates but Vercel drops the HTTP connection silently. Always add both apex and `www`. See Appendix A-01.

---

## Section 2 — DNS Verification

**Purpose:** Confirm all required DNS records are resolving correctly before proceeding with any email or media configuration.

- [ ] 1. Run: `dig +short A <client-domain>` — confirm it resolves to Vercel IP ranges (`76.76.21.*`).
- [ ] 2. Run: `dig +short CNAME www.<client-domain>` — confirm it points to Vercel's CNAME target.
- [ ] 3. Email delivery is website-owned (Section 14): the client website sends its own transactional email via its own Resend configuration (hosting env `RESEND_API_KEY` + DNS). Identify where to add:
  - [ ] a. SPF TXT record: `v=spf1 include:resend.com ~all`
  - [ ] b. DKIM CNAME records (values from Resend dashboard after domain is added there)
- [ ] 4. Document the DNS provider name and the client's point of contact for DNS changes — you will need this for the email section.

✅ **Done when…** apex A record resolves to a Vercel IP and `www` CNAME resolves to Vercel's target. DNS verification for email records is deferred to Section 14 but the provider contact is documented now.

---

## Section 3 — SSL Verification

**Purpose:** Confirm TLS is fully operational before any production traffic or credentials flow through the domain.

- [ ] 1. Run: `curl -sI https://<client-domain> | grep -E 'HTTP|server|hsts'`
  - Expect: `HTTP/2 200`, `server: vercel`, `strict-transport-security: max-age=63072000`
- [ ] 2. Verify TLS version: `curl -sI --tlsv1.2 https://<client-domain>` should succeed; `--tlsv1.0` should fail or downgrade gracefully.
- [ ] 3. Verify `www` redirect: `curl -sI https://www.<client-domain>` should return `308` with `location: https://<client-domain>/`.
- [ ] 4. Check certificate expiry: `echo | openssl s_client -connect <client-domain>:443 2>/dev/null | openssl x509 -noout -dates`

✅ **Done when…** apex returns `HTTP/2 200` with HSTS header, `www` returns a 308 redirect, and the certificate is valid for at least 30 days.

---

## Section 4 — Tenant Creation (Agency + Site)

**Purpose:** Create the agency and site records in Convex that all subsequent content will be scoped to.

- [ ] 1. **Create agency** (if not already exists for this client group):
  - Dashboard → Admin → Agencies → New Agency
  - Fields: Name, slug, plan tier, feature flags
  - Record the Agency ID from the Convex dashboard (format: `j97d4ynvkqa4c2h6...`)
- [ ] 2. **Create site** scoped to the agency:
  - Dashboard → Admin → Sites → New Site
  - Fields: Name, slug (e.g. `corsair-tactical`), domain, agencyId
  - Record the Site ID from the Convex dashboard (format: `qd7cpjk68m0z4rme5hw4sqgeys8bk1zc`)
- [ ] 3. Verify both records appear in `convex/agencies` and `convex/sites` tables via the Convex dashboard.
- [ ] 4. Note the `siteSlug` — it will be used as the portal URL prefix: `/portal/<siteSlug>/login`.

✅ **Done when…** Agency ID and Site ID are recorded, the site appears in the Agencies admin panel, and the site's slug resolves to the correct tenant in any subsequent Convex call.

---

## Section 5 — User Creation and Role Assignment

**Purpose:** Provision the client's admin user account so they can log in and manage their own site.

- [ ] 1. **Create dashboard admin user** for the client:
  - Dashboard → Admin → Users → New User
  - Fields: name, email (client's primary email), role, agencyId, siteId
  - Assign role: `OWNER` or `AGENCY_ADMIN` as appropriate for this client
- [ ] 2. Send the client an invitation or temporary credentials so they can complete Clerk sign-up.
- [ ] 3. **Verify superadmin bootstrap is correct:** The first-ever Clerk signup on the platform becomes superadmin. Subsequent signups are regular users. For new deployments, confirm only the FSTS superadmin email has superadmin rights.
- [ ] 4. Confirm the client's user record is visible in Dashboard → Admin → Users and has the correct role and site association.

✅ **Done when…** The client's user record exists in Convex with correct role, agency, and site assignment, and the client can sign in to `fstsclientsystem.com` and see their site in the dashboard.

> **Security note:** Do not assign `isSuperAdmin: true` to client accounts. That flag is FSTS-internal only. Client accounts should hold site-scoped roles (`OWNER`, `EDITOR`, etc.).

---

## Section 6 — Authentication Verification

**Purpose:** Confirm the client's admin user can authenticate against the production Clerk instance and access their site dashboard.

- [ ] 1. **Verify Clerk configuration:**
  - [ ] a. Confirm `VITE_CLERK_PUBLISHABLE_KEY` is set to a `pk_live_` key in the Vercel environment variables (not a `pk_test_` key — the platform has a guard that shows an error page if a test key is detected in production mode).
  - [ ] b. Confirm the client's domain is in Clerk's Authorized Origins list.
  - [ ] c. Confirm JWT template for Convex is configured in the Clerk dashboard (issuer must match `convex/auth.config.ts`).
- [ ] 2. Log in as the client's admin user and confirm:
  - [ ] a. Sign-in succeeds without errors.
  - [ ] b. The site dashboard loads at `/app/sites/<siteId>/`.
  - [ ] c. The user only sees their own site (not other clients' sites).
- [ ] 3. Sign out and confirm session is cleared.

✅ **Done when…** The client admin can sign in, sees exactly their site's dashboard (no other sites), and signs out cleanly.

---

## Section 7 — Branding

**Purpose:** Set the client's visual identity: logo, favicon, primary color, accent color, business name, and tagline.

**Dashboard page:** Website Settings → Identity + Branding tabs (`/app/sites/:siteId/settings`)  
**Convex tables:** `sites`, `siteSettings`

- [ ] 1. Upload logo image to Media Library first (get a `storageId`-backed URL — do not use a raw base64 string).
- [ ] 2. Upload favicon image to Media Library.
- [ ] 3. Navigate to Website Settings → Identity:
  - [ ] a. Business Name
  - [ ] b. Tagline
  - [ ] c. Logo URL (from Media Library)
  - [ ] d. Favicon URL (from Media Library)
- [ ] 4. Navigate to Website Settings → Branding:
  - [ ] a. Primary Color (hex, e.g. `#1A3A52`)
  - [ ] b. Accent Color (hex, e.g. `#C41E3A`)
- [ ] 5. Save and verify no errors appear. If an error message appears saying "Unable to load", the site's module access check is failing — verify the siteId and user's role are correctly scoped.

✅ **Done when…** Website Settings loads without error, all branding fields are saved, and the client's logo and colors are visible on the settings page.

> **Defect note (D-01, fixed):** `WebsiteSettings.tsx` crashed on a null API response (access denied or module disabled) instead of showing an error. This is fixed — it now renders "Unable to load" instead of crashing. If you see a blank crash, check that the user's role includes access to this module.

---

## Section 8 — Homepage

**Purpose:** Populate the hero section, subheadline, hero image, and feature sections of the client's homepage.

**Dashboard page:** Homepage Editor (`/app/sites/:siteId/homepage`)  
**Convex table:** `homepageContent`

- [ ] 1. Navigate to Homepage Editor.
- [ ] 2. Set Hero Headline (short, punchy — matches client's primary value proposition).
- [ ] 3. Set Hero Subheadline (1–2 sentences expanding on the headline).
- [ ] 4. Set Hero Image URL (upload to Media Library first and use the `storageId`-backed URL).
- [ ] 5. Add at least one features section with 3 feature items (icon, title, description).
- [ ] 6. Set CTA button text and link.
- [ ] 7. Save and confirm the page shows no errors.

✅ **Done when…** Homepage Editor loads without error, all fields are saved (not empty), and the preview reflects the client's headline and hero image.

> **Defect note (D-02, fixed):** `HomepageEditor.tsx` crashed when `homepage.get` returned null. Now shows an error message. If you see a blank crash, verify the site ID and module access.

---

## Section 9 — Navigation

**Purpose:** Build the site's navigation menu with links to all primary pages.

**Dashboard page:** Navigation Manager (`/app/sites/:siteId/nav`)  
**Convex table:** `navigationItems`

- [ ] 1. Add navigation items in display order. Minimum recommended items:
  - Home → `/`
  - About → `/about`
  - Courses (or Services) → `/courses`
  - Events → `/events`
  - Blog → `/blog`
  - Contact → `/contact`
  - Member Portal → `/portal/<siteSlug>/login`
- [ ] 2. Confirm drag-and-drop reorder works as expected.
- [ ] 3. Verify the Member Portal link uses the correct `siteSlug` (matches the slug set in Section 4).

✅ **Done when…** All nav items are saved, appear in the correct order, and the Member Portal link resolves to the correct portal URL.

---

## Section 10 — CMS Content

**Purpose:** Seed the content management system with at least one record in each content type so the client's site is not empty at launch.

### 10a — Articles (Blog)

**Dashboard page:** Articles (`/app/sites/:siteId/articles`)  
**Convex table:** `articles`

- [ ] 1. Create at least 2 published articles (1 is acceptable minimum; 2+ recommended for credibility).
- [ ] 2. Each article needs: title, body (markdown), category, author, featured image URL, status = Published.
- [ ] 3. Confirm articles appear in the articles list with status = Published.

✅ **Done when…** ≥1 published article exists in the site's article list.

### 10b — Courses

**Dashboard page:** Courses (`/app/sites/:siteId/courses`)  
**Convex table:** `courses`

- [ ] 1. Create at least 1 published course with a price record.
- [ ] 2. Fields: title, description, price, currency, status, featured image.
- [ ] 3. If the client uses Square for payments, link the course to a Square catalog item (optional at launch).
- [ ] 4. Additional courses can remain in Draft status if content isn't ready.

✅ **Done when…** ≥1 course with Published status and a non-zero price exists in the course list.

### 10c — Events

**Dashboard page:** Events (`/app/sites/:siteId/events`)  
**Convex table:** `events`

- [ ] 1. Create at least 1 published event with a future start date.
- [ ] 2. Fields: title, description, start date/time, end date/time, capacity, location, status.
- [ ] 3. Aim for 2–3 events to populate the events calendar meaningfully.

✅ **Done when…** ≥1 event with Published status and a future start date exists in the events list.

### 10d — Testimonials

**Dashboard page:** Testimonials (`/app/sites/:siteId/testimonials`)  
**Convex table:** `testimonials`

- [ ] 1. Add at least 3–4 testimonials (name, role/title, quote, rating).
- [ ] 2. Obtain real quotes from the client — do not use placeholder text at launch.

✅ **Done when…** ≥3 testimonials exist and all have real names, roles, and quotes.

### 10e — Reviews

**Dashboard page:** Reviews (`/app/sites/:siteId/reviews`)  
**Convex tables:** `reviewSources`, `importedReviews`

- [ ] 1. Add a review source (Google, Yelp, etc.) with the client's real Place ID (from Google Maps URL, format: `ChIJ...`).
- [ ] 2. Import 1–2 seed reviews manually while the sync is being set up.
- [ ] 3. After the client's Google Business is verified and the Place ID is confirmed, trigger a live sync: `npx convex run reviews:triggerSync`.
- [ ] 4. **Do not use a placeholder Place ID at launch** — sync will fail silently until the real ID is entered.

✅ **Done when…** ≥1 review source exists with a real Place ID and ≥1 review is visible in the reviews list.

---

## Section 11 — Media Uploads and Storage Verification

**Purpose:** Confirm the Convex File Storage upload path is functional and no base64 images exist in the site's media assets.

**Dashboard page:** Media Library (`/app/sites/:siteId/media`)

- [ ] 1. Upload at least one image via the Media Library UI:
  - [ ] a. Click Upload → select an image file.
  - [ ] b. The Smart Image Manager™ will convert to WebP client-side before upload.
  - [ ] c. Dashboard calls `media:generateUploadUrl` → uploads directly to Convex File Storage → calls `media:create` with the returned `storageId`.
- [ ] 2. Verify the uploaded image appears in the media grid with a valid CDN URL (not a `data:` base64 string).
- [ ] 3. Run a quick check for legacy base64 assets:
  ```
  npx convex run media:list '{"siteId":"<siteId>"}'
  ```
  Confirm no records have a `url` field starting with `data:`. If any exist, run `migrateDeleteDataUrls` to purge them.
- [ ] 4. Confirm delete works: delete the test image and verify it disappears from the grid and from Convex storage.

✅ **Done when…** ≥1 image uploaded via the UI has a `storageId`-backed URL (not base64), the image is visible in the media grid, and no `data:` URLs exist for this site in Convex.

> **Architecture note:** The upload flow is: browser → `generateUploadUrl` (Convex pre-signed URL) → direct multipart upload to Convex File Storage → `media:create` with `storageId`. The base64 path was a legacy blocker resolved before this onboarding SOP was written. Never use the URL-tab path for production assets unless the asset is hosted on a reliable external CDN.

---

## Section 12 — Forms and Email Notification

**Purpose:** Confirm the contact form and booking form are configured, submissions route to the inbox, and email notifications are scheduled on submission.

**Dashboard page:** Forms (`/app/sites/:siteId/forms`) + Inbox (`/app/sites/:siteId/inbox`)

- [ ] 1. Navigate to Forms. Verify the default contact form exists for the site.
- [ ] 2. Confirm email notification flags in Email Config (sender identity only — Section 14a; TAYA-side keys are optional under website-owned delivery):
  - `notifyOnNewLead: true`
  - `notifyOnBooking: true`
  - `notificationEmail: <client admin email>`
- [ ] 3. Submit a test form submission (use the public form URL: `/forms/<siteSlug>/contact` or equivalent).
- [ ] 4. Confirm the submission appears in the Inbox at Dashboard → Inbox.
- [ ] 5. Confirm an email notification was scheduled (check Convex logs for `email.sendFormNotification` being invoked).
- [ ] 6. Confirm actual inbox delivery by submitting a real form on the **client website** and checking the notification email inbox — the website's own Resend configuration sends the notification (website-owned delivery; Section 14).

✅ **Done when…** A test submission appears in the Inbox, `sendFormNotification` is logged as scheduled in Convex, and the email arrives in the notification inbox (sent by the website's own Resend configuration — website-owned delivery).

> **Note (email architecture — locked, website-owned delivery):** Form submission uses a fire-and-forget scheduler pattern: `ctx.scheduler.runAfter(0, internal.email.sendFormNotification, ...)`. A form submission will never fail due to email delivery issues. TAYA is not the mail sender for client website forms: the client website sends its own notification using its own Resend configuration after storing the submission in the TAYA Inbox. On the TAYA side, `sendFormNotification` fires only when a per-site `emailSettings.resendApiKey` exists and otherwise skips gracefully — an absent key is a healthy by-design state, not an outage.

---

## Section 13 — SEO

**Purpose:** Set page-level SEO metadata (title, description, OG image, canonical URL) for the homepage and key landing pages.

**Dashboard page:** SEO Settings (`/app/sites/:siteId/seo`)  
**Convex table:** `seoSettings`

- [ ] 1. Add an SEO record for `/` (homepage):
  - Title: `<Business Name> — <Primary Value Prop> in <Location>` (max 60 chars)
  - Meta description: 1–2 sentences, 120–160 chars
  - OG image: upload to Media Library; paste URL (1200×630px recommended)
  - Canonical URL: `https://<client-domain>/`
- [ ] 2. Add an SEO record for `/courses` (or primary service page).
- [ ] 3. Add an SEO record for `/about`.
- [ ] 4. Confirm all records are saved and appear in the SEO list.

✅ **Done when…** ≥3 SEO records exist (homepage + 2 key pages), all have non-empty titles and descriptions, and OG images are uploaded to Convex storage (not external URLs).

---

## Section 14 — Email Configuration

**Purpose:** Configure the site's sender identity, and — optionally — connect a per-site Resend key for TAYA-side sends. Under the locked website-owned email architecture, the client website's own Resend configuration (its hosting env `RESEND_API_KEY` + DNS) delivers form notifications; TAYA stores submissions in the site Inbox and is not the mail sender.

**Dashboard page:** Email Config (`/app/sites/:siteId/email`)  
**Convex table:** `emailSettings`

### 14a — Sender Identity (FSTS team action)

- [ ] 1. Navigate to Dashboard → Email Config.
- [ ] 2. Set sender identity fields:
  - From Name: `<Business Name>`
  - From Email: `noreply@<client-domain>`
  - Reply-To: `<client admin email>`
  - Notification Email: `<client admin email>`
  - Notify on New Lead: On
  - Notify on Booking: On
- [ ] 3. Save and confirm no errors. If the form renders empty and Save does nothing, this is the null-guard defect (D-03, now fixed) — upgrade to latest platform version.

### 14b — Resend API Key (⚠️ Owner action — optional per-site opt-in)

> **Website-owned delivery (locked):** The client website sends its own form notifications via its own Resend configuration (its hosting env `RESEND_API_KEY` — set in the website's hosting project, e.g. Vercel → Settings → Environment Variables). A TAYA-side per-site key is **optional** and only enables TAYA-side sends (portal welcome, form-builder notifications). Absence of a TAYA-side key is a healthy by-design state — not a launch blocker.

- [ ] 4. ⚠️ **Client must (website side — required for the website's own notifications):** Create a free Resend account at `resend.com`, obtain an API key, and set it as `RESEND_API_KEY` in the website hosting project's environment variables.
- [ ] 5. **Optional TAYA-side opt-in:** Log in to Dashboard → Email Config → paste the Resend API key → Save (enables TAYA-side portal welcome / form-builder notifications).
- [ ] 6. Verify any TAYA-side key is saved by checking Convex `emailSettings` for this site.

### 14c — DNS Records for Email Delivery (⚠️ Owner action)

- [ ] 7. ⚠️ **Client must:** In their DNS provider, add:
  - SPF TXT record on `@`: `v=spf1 include:resend.com ~all`
  - DKIM CNAME records (3 records — exact values from Resend Dashboard → Domains → `<client-domain>`)
- [ ] 8. Wait for DNS propagation (15–60 min).
- [ ] 9. Verify DNS records are live:
  ```
  dig +short TXT <client-domain>      # should include "v=spf1 include:resend.com"
  dig +short CNAME resend._domainkey.<client-domain>   # should return Resend's CNAME target
  ```
- [ ] 10. In Resend Dashboard → Domains, confirm the domain status changes to "Verified".
- [ ] 11. Run an end-to-end email test on the **client website**: submit its contact form → verify the notification email arrives in the client's inbox (sent by the website's own Resend configuration — website-owned delivery).

✅ **Done when…** Sender identity is saved, the **website's** Resend key is set in its hosting environment, DNS records are verified in the Resend dashboard, and a test form submission on the client website produces a real email in the notification inbox (website-owned delivery).

> **See also:** `EMAIL_DELIVERY_RUNBOOK.md` for exact DKIM CNAME values and troubleshooting steps.

---

## Section 15 — Payments (Square or Documented Skip)

**Purpose:** Connect the client's Square account for course and event payments, or document a skip if the client does not use Square.

**Dashboard page:** Commerce (`/app/sites/:siteId/commerce`) + Payment Providers (`/app/sites/:siteId/payment-providers`)

### If the client uses Square:

- [ ] 1. Navigate to Payment Providers → Square.
- [ ] 2. ⚠️ **Client must:** Provide their Square App ID and Square Access Token from their Square Developer dashboard.
- [ ] 3. Enter credentials in Payment Providers → Square → connect.
- [ ] 4. Navigate to Commerce → Sync Catalog to pull the client's Square catalog items.
- [ ] 5. Link courses/events to Square catalog items as appropriate.
- [ ] 6. Test a sample order (sandbox mode) to confirm payment flow.

### If the client does not use Square:

- [ ] 1. Document that Square is not applicable for this client (note in the onboarding record).
- [ ] 2. Leave payment provider unconfigured. The Commerce module will show as not connected — this is expected.

### Stripe:

- Stripe is not available at this time. It is marked "Coming Soon" in the UI and has no backend implementation. Do not attempt to configure it.

✅ **Done when…** Either Square is connected and a catalog sync succeeds, **or** the decision to skip Square is documented with a reason.

---

## Section 16 — QA Round-Trips

**Purpose:** End-to-end verification that the three core user flows work correctly in production.

### 16a — Form Round-Trip

- [ ] 1. Visit the public contact form URL: `https://<client-domain>/contact` (or `/forms/<siteSlug>/contact`).
- [ ] 2. Fill in all required fields with test data.
- [ ] 3. Submit the form.
- [ ] 4. Verify submission appears in Dashboard → Inbox within 30 seconds.
- [ ] 5. (After email is configured) Verify the notification email arrives in the client's inbox.
- [ ] 6. Mark the submission as read in the Inbox.

✅ **Done when…** Form submitted → appears in Inbox → notification email received → marked read. All 3 steps complete.

### 16b — CMS Round-Trip

- [ ] 1. In Dashboard → Articles, create a new test article (title: "QA Test Article — Delete Me", status: Published).
- [ ] 2. Verify the article appears at the top of the articles list with Published status.
- [ ] 3. Edit the article — change the title to "QA Test Article — Edited".
- [ ] 4. Verify the edit saved correctly.
- [ ] 5. Delete the test article.
- [ ] 6. Verify the article no longer appears in the list.

✅ **Done when…** Create → Read → Update → Delete cycle completes without error for at least one content type.

### 16c — Portal Login Round-Trip

- [ ] 1. Register a test portal user:
  ```
  npx convex run portal:register '{"siteId":"<siteId>","email":"qa-test@<client-domain>","password":"<testpass>","name":"QA Test User"}'
  ```
- [ ] 2. Navigate to `https://<client-domain>/portal/<siteSlug>/login`.
- [ ] 3. Log in with the test credentials.
- [ ] 4. Verify the portal dashboard loads and shows the correct site branding.
- [ ] 5. Log out.
- [ ] 6. Verify 5 rapid failed login attempts trigger a lockout message with countdown timer.
- [ ] 7. Delete the test portal user from Dashboard → Portal Manager.

✅ **Done when…** Portal login succeeds with valid credentials, logout works, and 5 failed attempts produce a lockout countdown — not a crash.

---

## Section 17 — Go Live

**Purpose:** Final pre-launch checklist to confirm the site is fully configured and the Vercel deployment is serving the latest code.

- [ ] 1. **Dashboard review — confirm all sections are non-empty:**
  - [ ] Website Settings: branding saved, no null crashes
  - [ ] Homepage Editor: hero headline and image set
  - [ ] Navigation: ≥5 nav items
  - [ ] Articles: ≥1 published
  - [ ] Courses: ≥1 published with price
  - [ ] Events: ≥1 with future date
  - [ ] Testimonials: ≥3
  - [ ] SEO: ≥3 records
  - [ ] Email Config: sender identity saved
  - [ ] Contact Info: address, phone, email set
  - [ ] Portal: enabled, welcome message set
- [ ] 2. **Verify Vercel deployment:**
  - [ ] a. Confirm latest commit on `main` branch is deployed: check Vercel Dashboard → Deployments → confirm HEAD SHA matches `git rev-parse HEAD`.
  - [ ] b. Confirm `VITE_CLERK_PUBLISHABLE_KEY` is set to a `pk_live_` key in Vercel environment variables.
  - [ ] c. Confirm `VITE_CONVEX_URL` is set to the production Convex URL in Vercel environment variables.
- [ ] 3. **Verify Convex production environment:**
  - [ ] a. `CONVEX_DEPLOYMENT_ENVIRONMENT=production` is set (prevents test mode running on prod).
  - [ ] b. `CONVEX_TEST_MODE` is **absent** from the Convex production environment.
  - [ ] c. `RESEND_API_KEY` on the platform is **optional** (dormant infrastructure — see Section 14b; website-owned delivery is the norm). Do not treat its absence as a launch blocker.
- [ ] 4. **Final smoke test:** Visit `https://<client-domain>` → confirm the page loads, branding is correct, and navigation works.
- [ ] 5. **Client handoff:** Send the client their dashboard URL, admin login, and the Owner Action Checklist (see Section 17a below).

### 17a — Owner Action Checklist (Items Requiring Client Action)

Document these in the client handoff email. The platform is live but these remain outstanding:

| # | Action | Urgency |
|---|---|---|
| OA-1 | Set the website's `RESEND_API_KEY` in its hosting project (website-owned delivery); a TAYA Email Config key is optional opt-in | HIGH — the website's own notifications do not send without it (TAYA-side key optional) |
| OA-2 | Add SPF DNS record: `v=spf1 include:resend.com ~all` | HIGH — required for inbox delivery |
| OA-3 | Add DKIM CNAME records (from Resend dashboard) | HIGH — required for inbox delivery |
| OA-4 | Upload real logo and favicon (replace placeholder URLs) | Medium |
| OA-5 | Enter real Google Place ID for Reviews | Medium |
| OA-6 | Confirm admin user can log in to production dashboard | Medium |
| OA-7 | Upload a real media asset to confirm CDN path in production | Low |
| OA-8 | Submit test contact form → verify inbox delivery | Low (after OA-1/2/3) |
| OA-9 | Square Commerce credentials (if applicable) | Low |

✅ **Done when…** All 5 dashboard sections listed in step 1 are non-empty, the Vercel deployment SHA matches the latest commit, the Clerk live key is confirmed on Vercel, and the client has received their handoff email with the Owner Action Checklist.

---

## Section 18 — Post-Launch Verification

**Purpose:** Confirm the site is stable in production 24–48 hours after go-live, and establish monitoring baselines.

- [ ] 1. **Uptime check (T+24h):**
  - Run: `curl -sI https://<client-domain>` — confirm `HTTP/2 200`.
  - Run: `curl -sI https://www.<client-domain>` — confirm `308` redirect.
- [ ] 2. **Convex health crons are running:**
  - Dashboard → Health Command Center — confirm last health scan is within the last 25 hours.
  - Convex Dashboard → Crons — confirm `hourly-health-checks` and `daily-health-scans` have recent run timestamps.
- [ ] 3. **Background jobs:**
  - Confirm `daily-site-backups` ran since go-live (scheduled 03:00 UTC).
  - Confirm `daily-review-sync` ran (scheduled 02:00 UTC) if a review source is configured.
- [ ] 4. **Error monitoring:**
  - Check Convex function logs for any uncaught errors or repeated failures since launch.
  - Check Vercel function logs for any 5xx errors.
- [ ] 5. **Email delivery confirmation (if OA-1/2/3 complete):**
  - Submit a real contact form from the live site.
  - Confirm email arrives in the notification inbox within 2 minutes.
- [ ] 6. **Portal welcome email:**
  - Register a new test portal user from the live portal URL.
  - Confirm the welcome email arrives in the test inbox.
  - Delete the test user.
- [ ] 7. **Client check-in:** Contact the client at T+48h to confirm:
  - They can log in to the dashboard.
  - They have completed OA-1 through OA-3 (email delivery).
  - No unexpected issues have surfaced.

✅ **Done when…** All uptime checks pass, no uncaught errors in Convex/Vercel logs, at least one email round-trip confirmed, and client check-in completed.

---

## Appendix — Known Issues and Workarounds

These defects were discovered during the Corsair Tactical Solutions (Website #1) onboarding and are fixed in the current platform version. They are documented here so future onboarders recognize the symptoms if a regression occurs.

### A-01 — `www` subdomain not serving (Vercel domain alias omission)

**Symptom:** `curl -sI https://www.<client-domain>` establishes TLS but receives zero HTTP bytes (connection closes after handshake).  
**Root cause:** The `www` hostname is not registered as a Vercel domain alias. Vercel accepts the TLS connection at the CDN layer but drops the HTTP connection because no project claims the hostname.  
**Fix:** Vercel Dashboard → project → Settings → Domains → Add `www.<client-domain>` → redirect to apex (308). No DNS change needed — the CNAME already points at Vercel.  
**Prevention:** Section 1 of this checklist explicitly requires adding both apex and `www` as aliases before confirming DNS.

---

### A-02 — D-01: `WebsiteSettings.tsx` crashes on null API response

**Symptom:** Website Settings page crashes with a blank white screen or React error boundary instead of showing an error message.  
**Root cause:** `WebsiteSettings.tsx` did not handle the `null` return from the API (which occurs when module access is denied or the module is disabled). It attempted to render the form with `null` data.  
**Fix applied:** Added `if (data === null)` guard rendering an "Unable to load" error message before attempting to render form fields.  
**If you see this on a new install:** Confirm the user's role includes access to the Website Settings module for this site. If access is correct, upgrade to the latest platform version.

---

### A-03 — D-02: `HomepageEditor.tsx` crashes on null API response

**Symptom:** Homepage Editor shows a blank crash instead of an error message when `homepage.get` returns `null`.  
**Root cause:** Same pattern as A-02 — missing null guard.  
**Fix applied:** Same null guard pattern added to `HomepageEditor.tsx`.

---

### A-04 — D-03: `EmailConfig.tsx` renders empty form on null API response; Save silently fails

**Symptom:** Email Config page loads an empty form. Clicking Save appears to do nothing (no error, no success toast). Configuration is not persisted.  
**Root cause:** `EmailConfig.tsx` rendered the edit form with empty local state when `email.get` returned `null` (access denied). Clicking Save submitted empty values to Convex, which rejected them silently.  
**Fix applied:** Added `data === null` branch rendering an error message before showing the edit form. The edit form is only rendered when real data is present.

---

### A-05 — D-04/D-05: `PortalManager.tsx` render-phase setState and silent mutation failures

**Symptom (D-04):** React warning "Cannot update a component while rendering a different component" appears in the browser console. Portal Manager may flicker or enter a re-render loop.  
**Root cause:** `setFormReady(true)` and `setForm(...)` were called during the render phase inside a conditional (`if (config !== undefined && !formReady)`), which violates React's rules.  
**Fix applied:** Moved form initialization into a `useEffect` hook.

**Symptom (D-05):** Member status/role/delete actions appear to do nothing. No error is shown to the admin.  
**Root cause:** `handleUpdateStatus`, `handleUpdateRole`, and `handleDelete` lacked `try/catch`. Convex mutation failures resulted in unhandled promise rejections with no user-visible feedback.  
**Fix applied:** All three handlers wrapped in `try/catch` with a destructive toast on error.

---

### A-06 — Google Reviews Place ID must be real before triggering sync

**Symptom:** Review sync (`reviews:triggerSync`) returns no results or errors silently.  
**Root cause:** A placeholder Place ID was seeded during onboarding. Google's Places API rejects unrecognized Place IDs.  
**Fix:** Enter the client's real Google Place ID (from the Google Maps URL: `?place_id=ChIJ...`) in the Reviews dashboard before triggering any live sync.  
**Prevention:** Section 10e of this checklist explicitly requires confirming the Place ID is real before marking Reviews complete.

---

### A-07 — No email arrives at the notification address (website-owned delivery)

**Symptom:** Form submissions appear in the Inbox but no email arrives at the notification address. No error is surfaced to the user.  
**Root cause (website-owned architecture — locked):** The client website's form pipeline stores the submission in the TAYA Inbox, then the **website's own** Resend configuration sends the notification. If the website hosting environment lacks `RESEND_API_KEY` (or its DNS is unverified in Resend), the website's send silently fails or is skipped. On the TAYA side, `email.sendFormNotification` fires only with a per-site `emailSettings.resendApiKey` and otherwise returns `{ skipped: true }` gracefully — by design, not an outage.  
**Fix:** Set `RESEND_API_KEY` in the **website's hosting project** (e.g. Vercel → Settings → Environment Variables) and complete Resend domain verification for the website's sender domain. A TAYA-side per-site key (Dashboard → Email Config) is an optional opt-in for TAYA-side sends only.  
**Prevention:** Section 14b of this checklist documents the website-side key as the required owner action and the TAYA-side key as optional.

---

*End of WEBSITE_ONBOARDING_CHECKLIST.md*  
*Derived from: `docs/corsair-onboarding-log.md` (Corsair Tactical Solutions, August 1, 2026)*  
*Cross-referenced with: `artifacts/fsts-dashboard/PRODUCTION_READINESS_REPORT.md`*
