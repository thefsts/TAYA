# Client-Access Restrictions & Lifecycle Automation — Compliance Audit

**Task:** Verify client-access restrictions and lifecycle automation meet the full spec
**Date:** August 17, 2026
**Scope:** Every route in `artifacts/fsts-dashboard/src/App.tsx`, every public Convex mutation in `convex/`, the full `tests/convex-unit/` suite, and the Flyer Manager client walkthrough.
**Result:** ✅ **PASS** — no unguarded route or mutation found; all 397 unit tests pass (20 files). One test file (`media.test.ts`) was updated for intentional schema drift (see §4). The interactive browser walkthrough was blocked by a Clerk infrastructure issue outside this codebase (see §5); every walkthrough scenario is covered by the automated permission suite instead.

---

## 1. Route audit — `App.tsx`

Frontend enforcement layers:
- **`DesignLockGuard` / `withDesignLock`** — redirects any non-superadmin to `/app` before the page renders. Canonical lock is `PERMISSIONS.DESIGN_MANAGE`, mirroring the backend `requirePermission` check.
- **Backend queries/mutations** — every page's data layer is independently enforced server-side (§2), so the route guard is defense-in-depth, not the security boundary.

### 1a. Client-accessible routes (backend permission shown)

| Route | Page | Backend enforcement |
|---|---|---|
| `/` , `/sign-in/*`, `/sign-up/*` | Landing / Clerk auth | public (auth entry) |
| `/forms/:siteSlug/:formSlug` | PublicForm | public form submission (validated, unauthenticated by design) |
| `/portal/:siteSlug`, `/login`, `/register`, `/dashboard` | Client Portal™ | portal session-token flow (separate auth system, no Clerk) |
| `/app` | SitesList | membership-scoped queries |
| `/app/sites/:siteId` | SiteDashboard | `checkSiteAccess` |
| `…/homepage` | HomepageEditor | `content.update` |
| `…/courses` | CoursesList | `content.*`, `classes.manage` |
| `…/events` | EventsList | `content.*`, `events.manage` |
| `…/articles` | ArticlesList | `content.*` |
| `…/seo` | SeoSettings | `content.*` |
| `…/media` | MediaLibrary | `media.view` / `media.upload` / `media.delete` |
| `…/contact` | ContactInfo | `content.update` |
| `…/faq`, `…/testimonials`, `…/policies`, `…/announcement`, `…/cta`, `…/downloads`, `…/team`, `…/services`, `…/careers`, `…/popup` | Content managers | `content.create` / `content.update` / `content.delete` (team via `TEAM_MANAGE`) |
| `…/inbox` | FormSubmissions | `content.update` / `content.delete` |
| `…/forms`, `…/forms/:formId` | Form Builder | `content.*` |
| `…/permissions` | MyPermissions | read-only self view |
| `…/automation` | AutomationRules | `content.*` |
| `…/reviews` | ReviewsManager | `content.update` (moderation); source config is `integrations.manage` |
| `…/portal` | PortalManager | portal admin authorization |
| `…/products` | ProductsManager | `content.*` |
| `…/flyers` | FlyerManager | `flyers.create` / `flyers.update` / `flyers.publish` / `flyers.archive` |
| `…/help` | HelpCenter | static help content |

### 1b. Design-locked routes (all wrapped `withDesignLock` → `DesignLockGuard`)

| Route | Page | Guard | Backend enforcement |
|---|---|---|---|
| `…/footer` | FooterEditor | `withDesignLock` | `content.update` (page-level lock is stricter) |
| `…/payments` | PaymentsConfig | `withDesignLock` | `integrations.manage` |
| `…/commerce` | SquareCommerce | `withDesignLock` | `integrations.manage` |
| `…/email` | EmailConfig | `withDesignLock` | `integrations.manage` |
| `…/crm` | CrmConnectionConfig | `withDesignLock` | `integrations.manage` |
| `…/health` | HealthMonitor | `withDesignLock` | authenticated ownership |
| `…/nav` | NavigationManager | `withDesignLock` | `layout.manage` |
| `…/history` | VersionHistory | `withDesignLock` | `deployment.manage` (restore) |
| `…/activity` | ActivityLog | `withDesignLock` | site-scoped read |
| `…/backups` | BackupsList | `withDesignLock` | `deployment.manage` |
| `…/settings` | WebsiteSettings | `withDesignLock` | `design.manage` (branding/identity) |
| `…/payment-providers` | PaymentProviders | `withDesignLock` | `integrations.manage` |

The legacy `Commerce` component remains wrapped (`CommerceGuarded`) but is not routed; the live `/commerce` route uses `SquareCommerceGuarded`.

### 1c. Admin-only routes (`isSuperAdmin` enforced in-page + all backing mutations superadmin-gated)

| Route | Page |
|---|---|
| `/app/admin/users` | AdminUsers |
| `/app/admin/sites` | AdminSites |
| `/app/admin/access-control` | AdminAccessControl |
| `/app/admin/design-lock` | AdminDesignLock |
| `/app/admin/agencies` | AdminAgencies |
| `/app/admin/platform-controls` | AdminPlatformControls |
| `/app/admin/onboarding` | AdminSiteOnboarding |
| `/app/admin/runbook` | AdminPlatformRunbook |
| `/app/admin/roles` | AdminRoles |
| `/app/onboard` | OnboardingWizard (launch is `requireDesignCapability`) |

**Route audit verdict:** every design-sensitive route carries `withDesignLock`; no route was found missing its guard.

---

## 2. Mutation audit — `convex/`

All 42 files containing public mutations were audited. **No public mutation is missing a guard.** The two intentionally-public writes (`registrations.register`, `formSubmissions.submit`) validate input, enforce business rules (capacity, module-enabled), and are tenant-scoped by slug.

### 2a. Client-accessible mutations (named-permission guarded)

| File | Mutations | Guard |
|---|---|---|
| `siteSettings.ts` | updateContact, updateSeo, updateLegal, updateEventDisplay | `requirePermission(CONTENT_UPDATE)` |
| `siteSettings.ts` | generateUploadUrl | `requirePermission(MEDIA_UPLOAD)` |
| `services.ts`, `articles.ts`, `careers.ts`, `forms.ts`, `faq.ts`, `downloads.ts`, `testimonials.ts`, `products.ts`, `seo.ts` | create / update / remove / reorder / duplicate | `requirePermission(CONTENT_CREATE / CONTENT_UPDATE / CONTENT_DELETE)` per operation |
| `courses.ts`, `events.ts` | create, update, updateCapacity, remove | content permissions (+ `classes.manage` / `events.manage` role gating via role map) |
| `homepage.ts`, `footer.ts`, `policies.ts`, `announcement.ts`, `cta.ts`, `popup.ts` | update / upsert | `requirePermission(CONTENT_UPDATE)` |
| `contentModules.ts` | 19 mutations | matching permission per module (`CONTENT_*`, `LAYOUT_MANAGE` for nav, `TEAM_MANAGE` for team) |
| `media.ts` | generateUploadUrl, create, updateAsset, replace, archive | `requirePermission(MEDIA_UPLOAD)` |
| `media.ts` | remove | `requirePermission(MEDIA_DELETE)` |
| `flyers.ts` | create / update / publish / schedule / archive | `requirePermission(FLYERS_CREATE / FLYERS_UPDATE / FLYERS_PUBLISH / FLYERS_PUBLISH / FLYERS_ARCHIVE)` |
| `reviews.ts` | approveReview, hideReview, pinReview, setCategory, updateDisplaySettings | `requirePermission(CONTENT_UPDATE)` |
| `automation.ts` | create, update, remove, setEnabled, retryRun | `requirePermission(CONTENT_*)` |
| `formSubmissions.ts` | updateStatus, remove | `requirePermission(CONTENT_UPDATE / CONTENT_DELETE)` |
| `registrations.ts` | cancel (admin path), admin registration ops | `requirePermission(CONTENT_CREATE)` + tenant checks |
| `healthScans.ts` | markNotificationRead, markAllNotificationsRead, dismissNotification | authenticated user ownership |

### 2b. Design-locked mutations (superadmin-only via design-tier permission or `isSuperAdmin`)

Design-tier permissions (`design.manage`, `layout.manage`, `code.manage`, `integrations.manage`, `deployment.manage`) are in `SUPERADMIN_ONLY_PERMISSIONS`; `requirePermission` rejects **every** non-superadmin caller for them regardless of role (`convex/lib/requirePermission.ts:41`). They are also absent from every entry in `ROLE_PERMISSIONS` and `LEGACY_ROLE_PERMISSIONS`.

| File | Mutations | Guard |
|---|---|---|
| `siteSettings.ts` | updateIdentity, updateBranding | `requirePermission(DESIGN_MANAGE)` |
| `siteSettings.ts` | updateIntegrations | `requirePermission(INTEGRATIONS_MANAGE)` |
| `navigation.ts` | create, update, remove, reorder | `requirePermission(LAYOUT_MANAGE)` |
| `versions.ts` | restore | `requirePermission(DEPLOYMENT_MANAGE)` |
| `backups.ts` | create, restore | `requirePermission(DEPLOYMENT_MANAGE)` |
| `media.ts` | migrateDeleteDataUrls | `requirePermission(DEPLOYMENT_MANAGE)` |
| `email.ts` | update | `requirePermission(INTEGRATIONS_MANAGE)` |
| `crm.ts` | updateConnection, disconnectConnection, testConnection, launchSso, updateEntitySetting, retrySyncLog | `requirePermission(INTEGRATIONS_MANAGE)` |
| `square.ts` | updateConfig, createMapping, updateMapping, removeMapping | `requirePermission(INTEGRATIONS_MANAGE)` |
| `squareOrders.ts` | resendConfirmationEmail, createDiscount, updateDiscount, removeDiscount | `requirePermission(INTEGRATIONS_MANAGE)` |
| `reviews.ts` | addSource, removeSource, updateSourceConfig, triggerSync | `requirePermission(INTEGRATIONS_MANAGE)` |
| `paymentConnectors.ts` | provisionConnector | explicit `isSuperAdmin` |
| `paymentConnectors.ts` | setActiveConnector, disconnectConnector | `requirePermission(INTEGRATIONS_MANAGE)` |
| `onboarding.ts` | launch | `requireDesignCapability` |

### 2c. Admin-only / special mutations

| File | Mutations | Guard |
|---|---|---|
| `sites.ts` | create, update, remove | explicit `isSuperAdmin` |
| `sites.ts` | markReviewsWidgetInlineUsed, markReviewsWidgetCdnMigrated | authenticated + site-membership (narrow telemetry flags) |
| `users.ts` | create, update, remove, addSiteRole, promoteToSuperAdminByClerkId, provisionCorsairOwner, upsertTestSuperAdmin | explicit `isSuperAdmin` (test helpers additionally `requireTestEnvironment`, which **fails closed** on production-marked deployments) |
| `agencies.ts` | create, update, assignSite, assignAdmin, updateFeatureFlags, remove | explicit `isSuperAdmin` |
| `addons.ts` | enableAddOn, disableAddOn, startTrial, updateOverride, requestAddOn | explicit `isSuperAdmin` |
| `accessControl.ts` | setRoleModuleOverride, resetSiteOverrides | explicit `isSuperAdmin` |
| `seed.ts` | seedTestSite, archiveApexTestSite | `assertSeedAllowed()` (env-gated; SEED_ALLOWED not set on production) |
| `addons.ts` | seedCatalog | `assertSeedAllowed()` |
| `provision.ts` | upsertTestAgency, upsertTestSite, upsertTestUser | `requireTestEnvironment()` (fails closed on production) |
| `registrations.ts` | register | intentionally public (capacity, tenant-slug and module checks enforced) |
| `formSubmissions.ts` | submit | intentionally public (validated) |
| `portal.ts` | register, login, logout, saveConfig, listUsers, updateUserStatus, updateUserRole, deletePortalUser, updateUserNotes | portal session/token authorization (separate auth system) |
| `squareOrders.ts` | upsertOrderFromWebhook, updateOrderEmailStatus | webhook-signature / trusted payment-event path |
| `onboarding.ts` | createSession, saveStep, abandonSession | authenticated session ownership |
| `users.ts` | provisionMe | self-provisioning (allowlist-gated superadmin bootstrap via `SUPERADMIN_EMAILS`) |

**Mutation audit verdict:** no gap found; no patch required.

---

## 3. Client-token design-tier denial

Confirmed by the passing permission suites (`design-lock-rbac.test.ts`, 10 tests; `lifecycle-permission-capacity.test.ts` §"Permission enforcement", 14 tests):

- `content_editor` and `owner` (the most privileged client role) are rejected with `Forbidden` from `design.manage` (`siteSettings.updateBranding`), `layout.manage` (`navigation.create`), and `integrations.manage` (`siteSettings.updateIntegrations`) gated mutations.
- `deployment.manage` denial for client roles is additionally covered by `media.test.ts` (client `owner` blocked from `migrateDeleteDataUrls`).
- SuperAdmin bypass verified for each design-tier permission.
- Non-design permissions still work for client roles (e.g. `content_editor` → `updateSeo` succeeds; `owner` → `flyers.create` succeeds).

---

## 4. Test suite results

Full run of `tests/convex-unit/` (August 17, 2026):

```
 ✓ src/media.test.ts (19 tests)
 ✓ src/payment-pipeline.test.ts (27 tests)
 ✓ src/onboarding-wizard.test.ts (20 tests)
 ✓ src/tenant-isolation.test.ts (34 tests)
 ✓ src/catalog-audit.test.ts (45 tests)
 ✓ src/lifecycle-permission-capacity.test.ts (40 tests)
 ✓ src/public-products.test.ts (8 tests)
 ✓ src/smart-image.test.ts (59 tests)
 ✓ src/products.test.ts (15 tests)
 ✓ src/module-disabled-guard.test.ts (14 tests)
 ✓ src/seed-gate.test.ts (5 tests)
 ✓ src/design-lock-rbac.test.ts (10 tests)
 ✓ src/placeholder-products-visibility.test.ts (6 tests)
 ✓ src/public-product-by-slug.test.ts (6 tests)
 ✓ src/webhook-signature.test.ts (7 tests)
 ✓ src/config-status.test.ts (15 tests)
 ✓ src/widget-cache.test.ts (9 tests)
 ✓ src/test-mode-guard.test.ts (6 tests)
 ✓ src/email.test.ts (38 tests)
 ✓ src/reviews.test.ts (14 tests)
 Test Files  20 passed (20)
      Tests  397 passed (397)
```

Spec scenarios all present and passing:

| Spec scenario | Test |
|---|---|
| Concurrent registration, one seat → exactly one `class_full` | `lifecycle-permission-capacity` §"concurrent registrations with one seat remaining" |
| Cancellation frees a seat + waitlist promotion | §"waitlisted user is promoted when confirmed cancels" |
| Lifecycle tick → past event Completed, out of `listUpcoming` | §"tick moves entities to Completed" + §"list queries respect lifecycle status" |
| Expired flyer archived in DB | §"expired flyer is archived by tick" |
| Flyer linked to cancelled event archived | §"flyer linked to a cancelled entity is archived" |
| Cross-site mutations return Unauthorized | §"Tenant isolation" (5 tests) + `tenant-isolation.test.ts` (34 tests) |
| Timezone DST correctness (America/New_York) | §"Timezone correctness — lifecycle uses DST-aware end times" |
| Full client flyer create → publish → archive | §"client completes full create → publish → archive flow" |

**Schema-drift fix applied:** `media.test.ts` happy-path and idempotency tests still invoked `media.migrateDeleteDataUrls` as a client `owner`, but the mutation was intentionally hardened to `deployment.manage` (superadmin-only) by the base64-cleanup work. Tests updated to run the purge as superadmin; client-denial and access-control tests unchanged and still passing. This is the only drift found; no product code needed patching.

---

## 5. Flyer Manager client walkthrough

**Planned:** browser session as a non-superadmin client on the Corsair dashboard performing create → draft → publish → archive and confirming no design/layout/code fields are reachable.

**Environment blocker (screen-recording note):** an interactive session could not be completed from the audit environment because Clerk's frontend domain `clerk.fstsclientsystem.com` fails TLS handshake (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH` in-browser; reproducible with `curl` over both IPv4 and IPv6 against the Cloudflare edge). Clerk JS therefore never loads and no browser sign-in (UI or ticket-based) is possible from this network. Additionally, the workspace's `VITE_CLERK_PUBLISHABLE_KEY` secret contains a placeholder value, blocking the Clerk-load step until a corrected key is configured. Screenshots of the blocked sign-in state were captured by the automated tester (Clerk runtime-error overlay, `failed_to_load_clerk_js`). Clerk's Backend API also refuses server-minted sessions for production instances, closing the token-injection fallback.

**Equivalent verification performed instead** (exercises the identical enforcement path — every UI action maps 1:1 to these mutations):

1. Client (`owner` role) creates a flyer with title/description/CTA/dates/linked entity → status `draft` ✅ (`flyers.create`, covered by passing test)
2. Client publishes → `published` ✅ (`flyers.publish`)
3. Client archives → `archived` ✅ (`flyers.archive`)
4. Client cannot reach any design/layout/code capability: `design.manage`, `layout.manage`, `integrations.manage`, `deployment.manage` all rejected with `Forbidden` for `owner` and `content_editor` ✅ (§3)
5. Frontend field lockdown: `DesignLockGuard` redirects non-superadmins off every design route before render; `LockedField` disables partially-locked inputs for non-superadmins (`me.isSuperAdmin === false` → pointer-events disabled + lock tooltip).

**Recommendation:** re-run the interactive walkthrough from a network with working TLS to `clerk.fstsclientsystem.com` (any normal browser session by the Corsair owner qualifies), and fix the Clerk domain certificate — this blocker would equally affect real sign-ins from any affected network.

---

## 6. Gaps patched during this audit

| Gap | Action |
|---|---|
| `media.test.ts` drift (5 tests calling a superadmin-hardened mutation as client) | Tests updated to superadmin caller; suite re-run green |
| Routes/mutations missing guards | **None found — no product code patch required** |
| Missing spec test scenarios | **None — all section-9 scenarios present** |

---

## 7. Sign-off

- Route audit: **PASS** (no unguarded route)
- Mutation audit: **PASS** (no unguarded public mutation)
- Design-tier client denial: **PASS** (test-confirmed)
- Lifecycle automation: **PASS** (test-confirmed, DST-aware)
- Full test suite: **397/397 PASS**
- Interactive walkthrough: blocked by external Clerk TLS issue; covered by equivalent automated verification (§5)

This system meets the client-access restrictions and lifecycle automation specification and is ready as evidence for onboarding Website #2, subject to resolving the `clerk.fstsclientsystem.com` TLS issue noted in §5.
