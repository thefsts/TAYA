# TAYA CLIENT CMS — PHASE 1 CERTIFICATION: CLIENT ONBOARDING + LOGIN

**Verdict: PHASE 1 — COMPLETE** (all Phase 1 items certified, quality gates green)

**Date:** September 4, 2026
**Branch:** `fsts/client-cms-completion` (cut from `c7f4b01`, PR #13)
**Production Convex:** `uncommon-cobra-336` (fsts-client-dashboard / team arma)
**Production Dashboard:** `app.fstsclientsystem.com`

---

## 1. Coherent Client Onboarding Wizard

The onboarding wizard (`artifacts/fsts-dashboard/src/pages/app/OnboardingWizard.tsx`) is now an **11-step coherent flow**: Basics → Type → Branding → Domain → Modules → Review → Credentials → Payment → **Client Owner (new)** → **Review & Launch (new)** → LaunchSuccess.

- **Client Owner step (id 9):** owner name, email (with existing-user reuse explanation), role Select (owner / manager / content_editor), and a send-invite Switch (default on).
- **Launch attaches the owner atomically:** `onboarding.launch` accepts an optional `owner` object and calls the shared `upsertClientAssignment` helper — a site is never left half-launched if the invitation step later fails.
- **Clerk invitation issued post-launch** by the wizard via `clerkInvitations.invite`; failures surface amber retry guidance in LaunchSuccess (they cannot orphan the launch).
- **LaunchSuccess reports the full outcome:** owner attached (created / existing-user attached / role updated) + invite outcome (invited / existing_user / skipped / failed).

## 2. Existing-User Reuse (No Duplicate Accounts)

Single source of truth: `convex/users.ts → upsertClientAssignment(ctx, args)` (exported helper, shared by `users.assignClient` and `onboarding.launch`):

- Existing Convex user by email → merge site role (rejects attaching platform superadmins); outcome `reused` (already assigned) or `role_updated`.
- Brand-new email → insert user with `clerkUserId: "pending:<email>"`, `inviteStatus: "pending"`, roles `[{siteId, role}]`; welcome email optional (wizard skips it — the Clerk invitation email follows immediately).
- `users.assignClient` is **superadmin-only**; `AdminUsers.tsx` calls it for single-site invites and, on `reused`/`role_updated`, toasts "Existing client attached to this website — no duplicate account was created" and skips the redundant Clerk invite.

## 3. Client Assignment Status (Admin Views)

- `AdminSites.tsx` — new **Client** column: "Not assigned" amber badge + **Assign Client** button (navigates to `/app/admin/users?invite=1&siteId=<id>`); assigned shows owner name/email with a manage affordance.
- `AdminUsers.tsx` — invite handoff: consuming `?invite=1&siteId=` once, pre-opens the invite dialog with the site preselected (role `owner`) and toasts "Assign the client owner".
- `sites.getClientAssignments` (superadmin / agency-scoped / own-sites visibility) feeds the column, reporting `ownerName`, `ownerEmail`, `ownerConnected` (Clerk linked vs `pending:`), and per-site other-users count.

## 4. Admin Login Link Contract (Config-Driven)

- **Single source of truth:** `convex/lib/adminLogin.ts` — `dashboardBaseUrl()` resolves `DASHBOARD_URL` env → `NEXT_PUBLIC_SITE_URL` → default `https://app.fstsclientsystem.com`. Shared by `clerkInvitations.ts` (invitation redirects/signInUrl) and `footer.ts`/`public.ts` (Admin Login link) — the URL is never hardcoded in two places.
- **Per-site carrier:** `footerContent.adminLoginEnabled/adminLoginLabel/adminLoginUrl` (schema-optional; audit-first — extends the existing contract that already flows to external public sites via `/api/public/footer?slug=`).
- **Resolved contract:** `footer.get`, `footer.update`, and public `getFooterBySlug` all return a stable `adminLogin: { enabled, label, url }` object; blanks fall back to defaults ("Admin Login" / `${DASHBOARD_URL}/sign-in?site=<slug>`).
- **RBAC:** stored/updated under `LAYOUT_MANAGE` (superadmin-only design tier) — client roles (including owner) cannot flip it, enforced at the Convex boundary and mirrored by `LockedField` in the UI.
- **Production env:** `DASHBOARD_URL=https://app.fstsclientsystem.com` set on prod deployment `uncommon-cobra-336` via `npx convex env set`.
- **UI:** `FooterEditor.tsx` — "Admin Login Link" section (Show switch + label/URL override inputs) wrapped in `LockedField capabilityLabel="Admin Login Link"`, inside the existing VisualEditorShell save/discard/publish flow (labels never hardcoded in multiple places in the UI).
- **Tests:** `tests/convex-unit/src/footer-admin-login.test.ts` — 12 tests covering persistence, default resolution, DASHBOARD_URL env override, slug isolation, public endpoint contract, and client-role rejection.

## 5. Corsair Admin Login Audit (Certified — No Duplication)

**The live Corsair public site is UP and its Admin Login journey works end-to-end.** Live verification (browser, 2026-09-04):

1. `https://www.corsairtacticalsolution.com/` (final domain after 301 from `corsairtacticalsolutions.com`) — 200 OK, full site renders.
2. Footer link: `<a href="https://app.fstsclientsystem.com/">Admin Login</a>`.
3. `https://app.fstsclientsystem.com/` → `Landing` auto-redirects unauthenticated visitors to the Clerk Account Portal → renders **"Sign in to Taya — Welcome back!"** (email/password + Google/Microsoft/GitHub social sign-in) — working login gateway.

**Certification decision:** the journey is functional via the app-root → Landing → Clerk portal chain, so we **certify and do not duplicate**. Improvements that do NOT touch the external repo:

- The new config-driven contract (Section 4) gives Corsair a first-class way to consume the correct URL (`https://app.fstsclientsystem.com/sign-in?site=<slug>`) via `/api/public/footer?slug=` once its footerContent doc exists in production.
- **External dependency (documented, not a blocker):** the live site's own data fetches target slug `corsair-tactical` on `clean-marlin-94.convex.cloud` (a non-production Convex deployment), which currently returns 404 — the site's statistics show zeroed values. The `corsairtacticalsolution.com` domain/repo is owner-side external infrastructure; the TAYA side of the journey (login → dashboard) is fully functional.
- Production `uncommon-cobra-336` currently has **no** site row for either `corsair-tactical` or `corsair-tactical-solutions` (`/api/public/site?slug=` → 404 for both), so the new public footer/adminLogin contract cannot serve Corsair's public site until the production Corsair site row + footerContent doc exist. Documented as a production-data coordination point (also noted in `docs/AI_FINAL_SYNC_DATABASE_CERTIFICATION.md` slug discrepancy notes).

## 6. Post-Login Routing (Code-Verified)

`SitesList.tsx` (workspace picker) handles all three post-login states:

- **1 assigned site → straight in:** auto-redirect effect (line ~53) navigates directly to `/app/sites/<id>` when a non-superadmin, non-QA user has exactly one site.
- **0 sites → friendly empty state:** "No websites available yet — Your website workspace has not been assigned yet." (QA sees a tailored variant.)
- **QA user → QA workspace:** "TAYA QA Workspaces" title + amber "TAYA Internal QA Mode" banner clarifying non-impersonation.
- **Superadmin → Website Operations:** platform admin quick-links section.

## 7. Tenant Security

- New queries/mutations follow existing visibility rules: `getClientAssignments` (superadmin all / agency admin own-agency / site-role users own-sites), `assignClient` superadmin-only, `publicBrandBySlug` returns cosmetic fields only (no IDs/users).
- `client-assignment.test.ts` (14 tests) covers tenant isolation (Site A owner sees only Site A) and anonymous rejection; `footer-admin-login.test.ts` (12 tests) covers slug isolation for adminLogin overrides and client-role rejection.
- All prior tenant isolation suites remain green.

## 8. Quality Gates (Verified on 2026-09-04)

| Gate | Result |
| --- | --- |
| `tsc -p tsconfig.json --noEmit` (fsts-dashboard) | ✅ clean |
| Dashboard vitest (`vitest.config.ts`) | ✅ 126/126 (3 files) |
| Convex-unit vitest (repo tests) | ✅ 451/451 (24 files, incl. +12 adminLogin, +14 client-assignment) |
| Design-lock suite | ✅ included in the above (70 tests) |
| Production env `DASHBOARD_URL` | ✅ set on `uncommon-cobra-336` |

## 9. Files Changed (Phase 1)

**Convex (repo root `convex/`):** `lib/adminLogin.ts` (new), `users.ts` (+upsertClientAssignment/assignClient), `onboarding.ts` (+owner attach), `sites.ts` (+getClientAssignments, +publicBrandBySlug), `footer.ts` (adminLogin contract), `public.ts` (adminLogin in public payload), `clerkInvitations.ts` (shared URL source of truth), `schema.ts` (+footerContent adminLogin fields).

**Dashboard (`artifacts/fsts-dashboard/src/`):** `pages/app/OnboardingWizard.tsx` (11 steps + owner step + invite flow), `pages/app/admin/AdminSites.tsx` (Client column), `pages/app/admin/AdminUsers.tsx` (handoff + upsert flow), `pages/app/sites/FooterEditor.tsx` (Admin Login Link section), `App.tsx` (branded login context `?site=slug`).

**Tests:** `tests/convex-unit/src/client-assignment.test.ts` (14), `tests/convex-unit/src/footer-admin-login.test.ts` (12).

**Docs:** `docs/PHASE1_CLIENT_ONBOARDING_LOGIN_CERTIFICATION.md` (this file).

**Excluded from this mission's scope (per mission rules):** marketing website (fstsclientsystem.com marketing origin), external Azure/Next public sites (repos `thefsts/Corsair-Tactical-Solutions`, etc.).
