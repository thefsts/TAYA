# FSTS-WOS™ — Dashboard Feature Matrix
**Audit Date:** August 2026 | **Build:** TypeScript clean, 104 unit tests passing

Legend: ✅ Complete · ⚠️ Partial · 🔲 Missing · 🚫 CRM boundary (do not build here)

---

## Core Infrastructure
| Feature | Status | Notes |
|---|---|---|
| Multi-tenant schema | ✅ | 48 tables, siteId isolation on every table |
| Tenant-isolation guards | ✅ | checkSiteAccess / requireSiteAccessMutation on all mutations |
| Clerk authentication | ✅ | JWT, session, provisionUser |
| Role-based access control | ✅ | superAdmin, agencyAdmin, client_admin, editor, read_only, portal |
| Multi-site support | ✅ | users.roles is array of {siteId, role} |
| Agency management | ✅ | agencies table, agencyId on sites |
| Module enable/disable | ✅ | enabledModules per site, getEffectiveModules |
| Activity logging | ✅ | activityLog table, logActivity helper |
| Design Lock™ | ✅ | withDesignLock HOC, AdminDesignLock UI |
| TypeScript typecheck | ✅ | Clean across all workspace packages |
| Production build | ✅ | Vite build succeeds with PORT/BASE_PATH |

---

## Website Management
| Feature | Status | Notes |
|---|---|---|
| Website switcher | ✅ | SitesList, auto-redirect for single-site users |
| Website settings (name, slug, domain) | ✅ | WebsiteSettings.tsx |
| Website status (active/inactive) | ✅ | |
| Domain field | ✅ | Stored, not verified |
| Domain verification | 🔲 | No DNS check or SSL status display |
| Temporary preview URL | 🔲 | Not generated during onboarding |
| Staging vs production distinction | 🔲 | All sites are "production" only |
| Deployment status | 🔲 | No deployment integration |
| Website publish flow | 🔲 | No publish button / publish workflow |
| Live preview panel | ⚠️ | LivePreviewPanel component exists but limited |

---

## Onboarding Wizard
| Feature | Status | Notes |
|---|---|---|
| Admin site onboarding (7-step) | ⚠️ | AdminSiteOnboarding.tsx — sparse, admin-only, no resume |
| Full 10-step guided wizard | 🔲 | **Currently building** |
| Progress save / resume | 🔲 | No onboardingProgress table yet |
| Business information collection | 🔲 | |
| Website purpose selection | 🔲 | |
| Page structure selection | 🔲 | |
| Branding intake (colors, fonts) | ⚠️ | Partial in admin wizard |
| Template selection | 🔲 | |
| Content setup (own/AI/skip) | 🔲 | |
| Domain setup + DNS instructions | 🔲 | |
| Integration selection | 🔲 | |
| Add-on selection | 🔲 | Add-on system does not exist yet |
| Review & launch | ⚠️ | Exists in admin wizard only |
| Starter content seeding | ✅ | seedClient.ts (CLI only, not wizard-wired) |
| Default nav/footer/contact seeding | ✅ | sites.create seeds homepage/footer/contact/SEO |

---

## Content Management (CMS)
| Feature | Status | Notes |
|---|---|---|
| Homepage editor | ✅ | hero, sections |
| Articles / Blog manager | ✅ | full CRUD, SEO fields, scheduling |
| Events manager | ✅ | full CRUD, Square ticketing link |
| Courses manager | ✅ | full CRUD, Square item link |
| FAQ manager | ⚠️ | CRUD works, UX thin |
| Testimonials manager | ⚠️ | CRUD works, UX thin |
| Team manager | ✅ | |
| CTA manager | ⚠️ | CRUD works, UX thin |
| Announcement banner | ⚠️ | CRUD works, UX thin |
| Navigation manager | ✅ | reorder, CRUD |
| Footer editor | ⚠️ | CRUD works, UX thin |
| Policy pages | ⚠️ | CRUD works, UX thin |
| Popup/banner manager | ⚠️ | CRUD works, UX thin |
| Downloads manager | ⚠️ | CRUD works, UX thin |
| Careers manager | ⚠️ | CRUD works, UX thin |
| **Services manager** | 🔲 | No schema table, no page |
| **Products/Offerings manager** | 🔲 | No schema table, no page (Square handles e-commerce only) |
| Resource library | 🔲 | downloadsManager covers files; no library UI |
| Header manager | 🔲 | No dedicated header editor |
| Theme / branding editor | 🔲 | No theme page |
| Template marketplace | 🔲 | |
| Custom code editor | 🔲 | |

---

## Media
| Feature | Status | Notes |
|---|---|---|
| Media Library | ✅ | full CRUD, upload, search, filters |
| Smart Image Manager™ (crop, focal point) | ✅ | Tasks 47–48 merged |
| Image derivatives (thumbnail/small/med/large/hero) | ✅ | mediaDerivatives.ts |
| Alt text management | ✅ | altText field on mediaAssets |
| Broken image detection + badge | ✅ | |
| Usage tracking | ✅ | Task 49 merged |
| File search and filters | ✅ | Task 49 merged |
| Duplicate detection | 🔲 | |
| Folder / collection organization | 🔲 | |
| Upload limits by subscription tier | 🔲 | No subscription system |
| Auto alt-text generation (AI) | 🔲 | Task #81 proposed |

---

## Forms
| Feature | Status | Notes |
|---|---|---|
| Form builder | ⚠️ | FormBuilder.tsx exists, basic field types |
| Contact / registration forms | ✅ | |
| Form submissions inbox | ✅ | FormSubmissions.tsx |
| Email notifications on submit | ✅ | via email.ts |
| Spam protection | 🔲 | No CAPTCHA |
| Multi-step forms | 🔲 | |
| Conditional logic | 🔲 | |
| File uploads in forms | 🔲 | |
| Webhook support | 🔲 | |
| CRM handoff | ✅ | Operon CRM connection config |

---

## SEO
| Feature | Status | Notes |
|---|---|---|
| Page title + meta description | ✅ | |
| Open Graph settings | ✅ | |
| Canonical URL | ✅ | |
| Sitemap management UI | 🔲 | |
| Robots.txt management | 🔲 | |
| Redirect manager | 🔲 | |
| Broken-link detection | 🔲 | |
| SEO scoring | 🔲 | |
| Schema / structured data | 🔲 | |
| Advanced SEO (Smart SEO Pro) | 🔲 | Add-on — after add-on system |

---

## Website Health
| Feature | Status | Notes |
|---|---|---|
| Health Monitor | ✅ | websiteHealthScans, trend arrows |
| Health notifications | ✅ | healthNotifications table |
| Uptime / SSL / performance checks | ⚠️ | scan data stored, UI partial |
| Accessibility checks | 🔲 | |
| Core Web Vitals | 🔲 | |

---

## Users & Permissions
| Feature | Status | Notes |
|---|---|---|
| RBAC (superAdmin/agencyAdmin/client_admin/editor/read_only) | ✅ | |
| Portal user management | ✅ | portalUsers, PortalManager.tsx |
| User invite / add role | ✅ | AdminUsers.tsx, addSiteRole |
| Account lockout (brute-force protection) | ✅ | Task #10 merged |
| Admin unlock locked account | 🔲 | Task #11 proposed |
| Per-page permission enforcement | ⚠️ | withDesignLock on some; not all pages |

---

## Integrations
| Feature | Status | Notes |
|---|---|---|
| Operon CRM handoff | ✅ | CrmConnectionConfig.tsx — connection config only, no CRM duplication |
| Square Payments | ✅ | full catalog sync, orders, checkout |
| Email (Resend) | ✅ | per-site Resend key, EmailConfig.tsx |
| Google Analytics | 🔲 | Not connected |
| Social publishing | 🔲 | Social Publisher Pro — after add-on system |
| Calendly / booking | 🔲 | |

---

## Revenue / Add-on System
| Feature | Status | Notes |
|---|---|---|
| Add-on schema (addons, subscriptions, plans) | 🔲 | pricingTiers table exists but unused |
| Marketplace UI | 🔲 | |
| Installed add-ons UI | 🔲 | |
| Feature flags by plan | 🔲 | featureFlags on agencies, not per-site |
| Usage metering | 🔲 | |
| Billing integration | 🔲 | |
| Social Publisher Pro | 🔲 | After add-on system |
| AI Blog Writer | 🔲 | After add-on system |
| Smart SEO Pro | 🔲 | After add-on system |

---

## Platform / Admin
| Feature | Status | Notes |
|---|---|---|
| Admin user management | ✅ | AdminUsers.tsx |
| Admin agency management | ✅ | AdminAgencies.tsx |
| Admin site list | ✅ | AdminSites.tsx |
| Admin access control | ✅ | AdminAccessControl.tsx |
| Admin platform controls | ✅ | AdminPlatformControls.tsx |
| Admin runbook | ✅ | AdminPlatformRunbook.tsx |
| Platform governance docs | ✅ | docs/repo-governance.md |

---

## Mobile / Responsive
| Feature | Status | Notes |
|---|---|---|
| Mobile-responsive dashboard | ⚠️ | Most pages responsive; not systematically verified |
| Sidebar collapses on mobile | ✅ | use-mobile hook wired |
| Form inputs mobile-friendly | ⚠️ | Not fully audited |

---

## Overall Completion Estimate
| Category | Complete |
|---|---|
| Core infrastructure | ~90% |
| CMS pages (existing) | ~75% |
| CMS pages (missing: Services, Products) | 0% |
| Onboarding wizard | 15% |
| Media | ~85% |
| Forms | ~40% |
| SEO | ~30% |
| Health monitoring | ~50% |
| Revenue / add-ons | 0% |
| **Overall platform** | **~55%** |
