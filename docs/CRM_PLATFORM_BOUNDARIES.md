# FSTS-WOS™ — CRM Platform Boundaries
**Last updated:** August 2026

This document defines what belongs in the FSTS Website Operating System™ and what belongs in Operon CRM. It is a binding constraint on all development work in this repository.

---

## FSTS-WOS™ Owns (Build Here)

| Domain | Examples |
|---|---|
| Website creation & provisioning | Onboarding wizard, site records, agency assignment |
| Website content management | Pages, blog, events, courses, team, FAQ, testimonials, navigation, footer |
| Website media | Media Library, Smart Image Manager™, image optimization |
| Website forms | Form builder, submission storage, notification emails |
| Website SEO | Title/meta/OG/canonical/sitemap/robots.txt/redirects |
| Website health & monitoring | Health scans, uptime, SSL, performance, accessibility |
| Website users & permissions | RBAC, portal members, role assignment |
| Website backups & version history | Snapshots, restore points, revision diffs |
| Website add-ons | Social Publisher (website content only), AI Blog Writer, Smart SEO Pro |
| Website settings | Domain, branding, integrations config |
| Website analytics display | Traffic summary, page views — **display only, no collection** |
| CRM handoff | Sending leads, form submissions, bookings INTO Operon via integration |

---

## Operon CRM Owns (Do NOT Build Here)

| Domain | Why It Belongs in Operon |
|---|---|
| Contact management | Leads, contacts, customer records |
| Lead pipelines | Sales stages, deal tracking |
| Sales pipelines | Quotes, estimates, proposals |
| Invoices & billing | Client invoicing, recurring billing for client customers |
| Email marketing | Campaigns, sequences, broadcast emails |
| SMS marketing | Text campaigns, drip sequences |
| Customer follow-up | Automated follow-up, appointment reminders |
| Reputation management | Review requests, response management |
| Full social media management | Social inboxes, campaign management, engagement analytics |
| Business workflow automation | Cross-system automation, complex multi-step triggers |
| Appointment follow-up | Post-booking sequences |
| Geofencing campaigns | Location-based advertising operations |

---

## Integration Points (Handoffs Are OK)

These are the approved ways FSTS-WOS™ communicates with Operon CRM:

| Trigger | Direction | Implementation |
|---|---|---|
| Form submission received | FSTS → Operon | Webhook to Operon CRM API (via automation rule or CRM connection) |
| Portal user registered | FSTS → Operon | Optional sync via CRM connection config |
| Booking completed (via website) | FSTS → Operon | Webhook trigger |
| New lead captured | FSTS → Operon | CRM handoff, not storage in FSTS |
| Operon contact data in FSTS UI | Operon → FSTS | Only for display of imported data (e.g. CRM sync log) |

---

## Current Boundary Status in Codebase

| File | Assessment |
|---|---|
| `CrmConnectionConfig.tsx` | ✅ Clean — integration config only, no CRM data management |
| `AutomationRules.tsx` | ✅ Clean — website-triggered rules that can fire webhooks to Operon |
| `FormSubmissions.tsx` | ✅ Clean — stores submission data in FSTS, hands off to CRM via webhook |
| `ReviewsManager.tsx` | ✅ Clean — displays imported/managed reviews, no review campaigns |
| `PortalManager.tsx` | ✅ Clean — manages site members, not CRM contacts |
| No sales/pipeline/invoice/campaign UI exists | ✅ Confirmed |

**Boundary is clean.** No Operon CRM functionality has been duplicated in this codebase.

---

## Decision Rule for Future Features

Before building any new feature, ask:

> "Does this feature manage website content, appearance, or settings?"
> → Build it in FSTS-WOS™.

> "Does this feature manage customer relationships, sales, or marketing campaigns?"
> → It belongs in Operon CRM. At most, add a handoff/integration point.
