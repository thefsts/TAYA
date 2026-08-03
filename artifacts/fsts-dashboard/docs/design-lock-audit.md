# Design Lock Audit Report

**Date:** 2026-08-03  
**Scope:** All routes in `App.tsx`, sidebar nav links in `SiteDashboard.tsx`, admin-panel backend guards, and code/script-injection fields.  
**Purpose:** Confirm every design-sensitive route is unreachable by client-role users before Corsair owner gains dashboard access.

---

## Summary

| Category | Count | Status |
|---|---|---|
| Client-accessible routes | 26 | ✅ Correct |
| Design-locked routes (superAdmin only) | 13 | ✅ All guarded |
| Admin-only routes (`/app/admin/*`) | 8 | ✅ All guarded |
| Script/HTML injection fields | 0 | ✅ None exposed to clients |
| Gaps found and fixed in this audit | 3 | ✅ Fixed |

---

## Route Classification

### `/app/admin/*` — Admin-Only Routes

All admin routes perform an early `if (!me || !me.isSuperAdmin) return <Redirect to="/app" />` at the component level. Verified by reading each file.

| Route | Component | Guard Method | Status |
|---|---|---|---|
| `/app/admin/users` | `AdminUsers` | `isSuperAdmin` redirect (line 106) | ✅ Admin-only |
| `/app/admin/sites` | `AdminSites` | `isSuperAdmin` redirect (line 72) | ✅ Admin-only |
| `/app/admin/access-control` | `AdminAccessControl` | `isSuperAdmin` redirect (line 123) | ✅ Admin-only |
| `/app/admin/design-lock` | `AdminDesignLock` | `isSuperAdmin` redirect (line 50) | ✅ Admin-only |
| `/app/admin/agencies` | `AdminAgencies` | `isSuperAdmin` redirect (line 77) | ✅ Admin-only |
| `/app/admin/platform-controls` | `AdminPlatformControls` | `isSuperAdmin` redirect (line 44) | ✅ Admin-only |
| `/app/admin/onboarding` | `AdminSiteOnboarding` | `isSuperAdmin` redirect (line 141) | ✅ Admin-only |
| `/app/admin/runbook` | `AdminPlatformRunbook` | `isSuperAdmin` redirect (line 752) | ✅ Admin-only |

### `/app/sites/:siteId/*` — Design-Locked Routes (superAdmin only)

These routes are wrapped with `withDesignLock` HOC in `App.tsx`, which renders `DesignLockGuard` as a route wrapper. `DesignLockGuard` queries `api.users.me`, checks `isSuperAdmin` via `userHasPermission(me.isSuperAdmin, PERMISSIONS.DESIGN_MANAGE)`, and redirects non-superAdmins to `/app`.

| Route | Component | Capability | Guard Method | Status |
|---|---|---|---|---|
| `/settings` | `WebsiteSettings` | `update_site_branding`, `manage_enabled_modules` | `withDesignLock` | ✅ Fixed (was unguarded) |
| `/footer` | `FooterEditor` | `edit_footer` | `withDesignLock` | ✅ Guarded |
| `/nav` | `NavigationManager` | `edit_navigation` | `withDesignLock` | ✅ Guarded |
| `/email` | `EmailConfig` | `configure_email` | `withDesignLock` | ✅ Guarded |
| `/crm` | `CrmConnectionConfig` | `configure_crm` | `withDesignLock` | ✅ Guarded |
| `/payments` | `PaymentsConfig` | `configure_square` | `withDesignLock` | ✅ Guarded |
| `/payment-providers` | `PaymentProviders` | `configure_square` et al. | `withDesignLock` | ✅ Fixed (was unguarded) |
| `/commerce` | `SquareCommerce` | `configure_square` | `withDesignLock` | ✅ Fixed (was using unguarded component) |
| `/health` | `HealthMonitor` | `view_health_monitor` | `withDesignLock` | ✅ Guarded |
| `/history` | `VersionHistory` | `view_version_history` | `withDesignLock` | ✅ Guarded |
| `/activity` | `ActivityLog` | `view_activity_log` | `withDesignLock` | ✅ Guarded |
| `/backups` | `BackupsList` | `manage_backups` | `withDesignLock` | ✅ Guarded |

> **Note on `/commerce` bug:** `CommerceGuarded = withDesignLock(Commerce)` was defined in App.tsx but the route was accidentally wired to the unguarded `SquareCommerce` component. A new `SquareCommerceGuarded` was created and the route corrected.

### `/app/sites/:siteId/*` — Client-Accessible Routes

| Route | Component | Capability | Status |
|---|---|---|---|
| `/app/sites/:siteId` | `SiteDashboard` | Dashboard overview | ✅ Client-accessible |
| `/homepage` | `HomepageEditor` | `edit_homepage` | ✅ Client-accessible |
| `/courses` | `CoursesList` | `manage_courses` | ✅ Client-accessible |
| `/events` | `EventsList` | `manage_events` | ✅ Client-accessible |
| `/articles` | `ArticlesList` | `manage_articles` | ✅ Client-accessible |
| `/seo` | `SeoSettings` | `configure_seo` | ✅ Client-accessible |
| `/media` | `MediaLibrary` | `manage_media` | ✅ Client-accessible |
| `/contact` | `ContactInfo` | `edit_contact_info` | ✅ Client-accessible |
| `/faq` | `FaqManager` | `manage_faq` | ✅ Client-accessible |
| `/testimonials` | `TestimonialsManager` | `manage_testimonials` | ✅ Client-accessible |
| `/inbox` | `FormSubmissions` | `view_inbox` | ✅ Client-accessible |
| `/policies` | `PolicyEditor` | `edit_policies` | ✅ Client-accessible |
| `/announcement` | `AnnouncementBanner` | `edit_announcement` | ✅ Client-accessible |
| `/cta` | `CtaManager` | `manage_cta` | ✅ Client-accessible |
| `/downloads` | `DownloadsManager` | `manage_downloads` | ✅ Client-accessible |
| `/team` | `TeamManager` | `manage_team` | ✅ Client-accessible |
| `/services` | `ServicesManager` | Content module | ✅ Client-accessible |
| `/careers` | `CareersManager` | `manage_careers` | ✅ Client-accessible |
| `/popup` | `PopupManager` | `configure_popup` | ✅ Client-accessible |
| `/help` | `HelpCenter` | Help documentation | ✅ Client-accessible |
| `/forms` | `FormsList` | `manage_forms` | ✅ Client-accessible |
| `/forms/:formId` | `FormBuilder` | `manage_forms` | ✅ Client-accessible |
| `/permissions` | `MyPermissions` | Self-view only | ✅ Client-accessible |
| `/automation` | `AutomationRules` | Automation config | ✅ Client-accessible |
| `/reviews` | `ReviewsManager` | Reviews module | ✅ Client-accessible |
| `/products` | `ProductsManager` | Products module | ✅ Client-accessible |
| `/portal` | `PortalManager` | Portal config | ✅ Client-accessible |

### Portal Routes (no Clerk auth)

| Route | Notes | Status |
|---|---|---|
| `/portal/:siteSlug/login` | Public — intentional | ✅ Correct |
| `/portal/:siteSlug/register` | Public — intentional | ✅ Correct |
| `/portal/:siteSlug/dashboard` | Portal session auth — intentional | ✅ Correct |

---

## Sidebar Navigation Audit (`SiteDashboard.tsx`)

`NavItem` accepts an `isDesignLocked` prop. When `isDesignLocked && !isSuperAdmin`, the item renders as a disabled tooltip (non-clickable, cursor-not-allowed). This prevents clients from discovering locked routes via nav even if they know the URL path.

| Nav Item | `isDesignLocked` set | Matches route guard |
|---|---|---|
| Navigation | ✅ | ✅ |
| Footer | ✅ | ✅ |
| Square Payments | ✅ | ✅ |
| Commerce | ✅ | ✅ |
| Email Config | ✅ | ✅ |
| Marketing & CRM | ✅ | ✅ |
| Health Monitor | ✅ | ✅ |
| Version History | ✅ | ✅ |
| Activity Log | ✅ | ✅ |
| Backups | ✅ | ✅ |
| Website Settings | ✅ | ✅ Fixed (was missing) |
| Payment Providers | ✅ | ✅ Fixed (was missing) |

---

## Code / Script Injection Field Audit

A full-text search was performed across all `src/pages/app/sites/*` components for `dangerouslySetInnerHTML`, `contentEditable`, and inputs/textareas named `html`, `script`, `css`, `code`, `customCode`, `customHtml`, or `inject`.

| Finding | Location | Risk | Disposition |
|---|---|---|---|
| `dangerouslySetInnerHTML` | `AdminUsers.tsx` (preview pane) | Low — superAdmin-only page | No change needed |
| `dangerouslySetInnerHTML` | `components/ui/chart.tsx` (CSS injection) | Internal only — not user-controlled | No change needed |
| User-facing textareas | `FaqManager`, `SeoSettings`, `FooterEditor`, `FormsList` | Plaintext content only — no HTML eval | No change needed |

**No client-accessible raw HTML / script-injection fields were found.** All user-facing textareas accept plaintext content only and do not render their content via `innerHTML` or `dangerouslySetInnerHTML`.

---

## `DesignLockGuard` / `withDesignLock` Component Audit

- **`DesignLockGuard`** (`src/components/DesignLockGuard.tsx`) — queries `api.users.me` and checks `userHasPermission(me.isSuperAdmin, PERMISSIONS.DESIGN_MANAGE)`. Redirects non-superAdmins to `/app` with no flash of the protected content (`return null` while loading or locked).
- **`withDesignLock`** HOC (`App.tsx`) — wraps a page component in `<DesignLockGuard>`, applied at the route definition level so the guard fires before any page-level data fetching.
- **`LockedField`** — used within partially-locked pages (`FooterEditor`, `NavigationManager`, `EmailConfig`, `CrmConnectionConfig`, `PaymentsConfig`) to disable individual design-token fields while still rendering the page for superAdmins.

---

## Gaps Found and Fixed

| Gap | Fix Applied |
|---|---|
| `/commerce` route used unguarded `SquareCommerce` instead of `CommerceGuarded` | Added `SquareCommerceGuarded = withDesignLock(SquareCommerce)`; route now uses `SquareCommerceGuarded` |
| `/settings` (WebsiteSettings) had no guard despite controlling brand colors, fonts, and module toggles | Added `WebsiteSettingsGuarded = withDesignLock(WebsiteSettings)`; route updated |
| `/payment-providers` (PaymentProviders) had no guard despite storing third-party payment API secrets | Added `PaymentProvidersGuarded = withDesignLock(PaymentProviders)`; route updated |
| Sidebar `Website Settings` nav item missing `isDesignLocked` | Added `isDesignLocked` prop to `NavItem` in `SiteDashboard.tsx` |
| Sidebar `Payment Providers` nav item missing `isDesignLocked` | Added `isDesignLocked` prop to `NavItem` in `SiteDashboard.tsx` |
| `DESIGN_LOCKED_PATHS` set in `capabilities.ts` missing `settings` and `payment-providers` | Added both path segments to the set |

---

## Verification Method Summary

| Guard type | How verified |
|---|---|
| `withDesignLock` route wrap | Direct read of `App.tsx` route table; confirmed guarded component used |
| `DesignLockGuard` component logic | Read `src/components/DesignLockGuard.tsx`; confirms redirect on non-superAdmin |
| Admin route `isSuperAdmin` redirect | Grep + read of each `src/pages/app/admin/*.tsx`; all have early redirect |
| Sidebar nav lock | Read `SiteDashboard.tsx` `NavItem` usage; `isDesignLocked` confirmed on all design routes |
| Script injection | Full-text grep of `src/pages/app/sites/*` for `dangerouslySetInnerHTML`, `contentEditable`, `customCode`, `customHtml` |
