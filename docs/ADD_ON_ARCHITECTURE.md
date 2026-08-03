# FSTS-WOS™ — Add-on Architecture Design
**Status:** Design complete — implementation follows after onboarding wizard

---

## Overview

The add-on system lets FSTS monetize premium website features through a modular marketplace. Each add-on can be installed per website (or per account for account-level features), activated, configured, and billed independently.

**Do not build until:** Website onboarding wizard and core CMS pages are complete.

---

## Planned Schema Tables

### `addons` (catalogue — managed by FSTS staff)
```
id, name, slug, description, category, monthlyPriceCents, annualPriceCents,
trialDays, minPlanTier, isActive, isPerSite, usageLimits (JSON), 
configSchema (JSON)
```

### `siteAddons` (installation records per site)
```
siteId, addonSlug, status (installed|active|suspended|cancelled),
activatedAt, expiresAt, trialEndsAt, billingInterval,
config (JSON), usageThisPeriod (JSON), grantedByAdmin, grantedNote
```

### `addonUsageLogs` (metered usage)
```
siteId, addonSlug, metric, amount, recordedAt
```

### `plans` (subscription tiers — replaces unused pricingTiers table)
```
name, slug, monthlyPriceCents, annualPriceCents, includedAddons (JSON),
websiteLimit, storageGb, aiCreditsPerMonth, isActive
```

### `siteSubscriptions`
```
siteId, planSlug, status, billingInterval, currentPeriodStart, currentPeriodEnd,
cancelAtPeriodEnd, paymentProvider, externalSubscriptionId
```

---

## Priority Add-ons to Build First

| Add-on | Slug | Billing | Depends On |
|---|---|---|---|
| Social Publisher Pro | `social-publisher` | Monthly | Add-on system |
| AI Blog Writer | `ai-blog-writer` | Credits | Add-on system + OpenAI |
| AI Website Content | `ai-content` | Credits | Add-on system + OpenAI |
| Smart SEO Pro | `smart-seo` | Monthly | Add-on system |
| Website Health Pro | `health-pro` | Monthly | Add-on system |
| Accessibility Pro | `accessibility-pro` | Monthly | Add-on system |
| Forms Pro | `forms-pro` | Monthly | Add-on system |
| Member Portal Pro | `portal-pro` | Monthly | Add-on system |
| Backup & Restore Pro | `backup-pro` | Monthly | Add-on system |
| Version History Pro | `version-history-pro` | Monthly | Add-on system |
| AI Translation | `ai-translation` | Credits | Add-on system + AI |
| Popup & Banner Builder | `popup-builder` | Monthly | Add-on system |

---

## Add-on Lifecycle

```
Not Installed → Installed (trial) → Active (paid) → Suspended → Cancelled
                                  ↘ Expired trial → Upgrade prompt
```

---

## Feature Flag Integration

- `agency.featureFlags` — account-level overrides (already in schema)
- `site.enabledModules` — module-level on/off (already in schema)
- `siteAddons` record — add-on access gate
- UI check: `useAddonAccess(siteId, addonSlug)` hook → `{hasAccess, isTrialing, upgradeUrl}`

---

## Marketplace UI Structure

```
/app/sites/:siteId/addons                → Marketplace (browse all)
/app/sites/:siteId/addons/installed      → Installed add-ons
/app/sites/:siteId/addons/:slug          → Add-on detail / config
/app/sites/:siteId/addons/usage          → Usage dashboard
/app/sites/:siteId/addons/plans          → Plan comparison + upgrade
```

---

## Revenue Model

| Type | How |
|---|---|
| Plan tiers | Monthly/annual subscription per account |
| Add-on subscriptions | Monthly/annual per website per add-on |
| AI credits | Pay-per-use or monthly credit bundle |
| Storage overage | Per-GB beyond plan limit |
| Templates | One-time purchase from marketplace |
| Trial conversion | 14-day free trials → paid |

---

## Implementation Order

1. Schema tables (addons, siteAddons, plans, siteSubscriptions, addonUsageLogs)
2. Convex functions (catalogue queries, install/activate/cancel mutations)
3. `useAddonAccess` hook (gate UI behind add-on status)
4. Marketplace UI + Installed add-ons UI
5. Plans page with upgrade prompts
6. Wire Social Publisher Pro as first live add-on
7. Billing integration (Stripe recommended for SaaS billing)
