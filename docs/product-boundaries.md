# Product Boundaries: FSTS-WOS™ / Operon CRM™

> **Authoritative reference.** These boundaries are set by Full Stack Tech Solutions leadership and apply to all current and future development. When in doubt, consult this document before adding a feature to either product.

---

## 1. FSTS Website Operating System™ (FSTS-WOS™)

FSTS-WOS™ is the **client-facing dashboard** for managing a client's website and its direct digital operations. Every module listed below belongs here and nowhere else.

### 1.1 Permanent Module List

The following modules are permanently assigned to FSTS-WOS™. Any feature that falls within these categories belongs here, not in Operon CRM™. Trademarked names must be preserved exactly.

#### Site & Content Management

| Module | Description |
|--------|-------------|
| **Dashboard Home** | Overview widgets: site health, recent activity, quick-action shortcuts |
| **Site Settings** | Domain management, branding (logo, colors, fonts), DNS configuration, SSL certificate status |
| **Page Builder** | Drag-and-drop editor for website pages; layout management, section templates |
| **Blog & Content Manager** | Create, edit, schedule, and publish blog posts; category and tag management |
| **Landing Pages** | Campaign-specific or standalone landing page creation and management |
| **Navigation & Menus** | Site-wide header navigation, mega-menu configuration |
| **Footer Manager** | Footer layout, links, legal text, social icons |
| **Contact Information** | Business name, address, phone, email, hours of operation displayed site-wide |
| **Team Manager** | Staff/team member profiles displayed on the website |
| **Testimonials Manager** | Client testimonials curated and displayed on the website |
| **FAQ Manager** | Frequently-asked-questions content sections |
| **Policy Editors** | Privacy policy, terms of service, cookie policy, and other legal pages |
| **Downloads Manager** | Manage downloadable files (PDFs, brochures) available on the website |
| **Resource Library** | Curated library of downloadable or linked resources for site visitors |
| **Events Manager** | Display upcoming events on the website; event detail pages |
| **Smart Image Manager™** | Intelligent image optimization, alt-text management, responsive image delivery |
| **Responsive Live Preview Studio™** | Real-time preview of website changes across desktop, tablet, and mobile viewports |
| **Media Library** | Upload, organize, and serve images, documents, and other site assets |

#### Lead Capture & Forms

| Module | Description |
|--------|-------------|
| **Forms & Lead Capture** | Contact forms, quote request forms, inquiry forms — form builder, submission inbox, field configuration. Captured data is synced to Operon CRM™ via the Operon Connector™. |
| **Contact Form Inbox** | View, search, and export all form submission records within FSTS-WOS™ |

#### Courses, Memberships & Learning

| Module | Description |
|--------|-------------|
| **Courses Manager** | Create and organize course content, modules, and lessons displayed on the website. Enrollment, payments, and fulfillment sync to Operon CRM™ via the Connector. |
| **Membership & Client Portal™** | Member-gated pages, client portal access, and membership content display on the website |
| **LMS™** | Learning Management System — deliver and track lesson completion for enrolled learners on the website |

#### Payments & Commerce

| Module | Description |
|--------|-------------|
| **Website Checkout** | Single-product or cart checkout powered by the Payment & Connector Framework™ (see §1.2) |
| **Orders & Transactions** | View and manage website orders and payment transactions originating from the website checkout |
| **Payment & Connector Framework™** | Connect supported payment processors to the website checkout (see §1.2); provider-agnostic adapter layer used by both payment and review connectors |

#### SEO, Analytics & Intelligence

| Module | Description |
|--------|-------------|
| **SEO Manager** | On-page SEO metadata (title, description, Open Graph), sitemap generation, robots.txt, structured data |
| **Analytics & Tag Manager** | Google Analytics, Google Tag Manager, Facebook Pixel, and other tracking integrations; embedded analytics view |
| **Business Intelligence Dashboard™** | Website-focused KPIs — traffic, sessions, bounce rate, form conversions, page performance, revenue summaries (see §4) |
| **AI Dashboard Assistant™** | In-dashboard AI assistant scoped exclusively to site data and FSTS-WOS™ features (see §5) |

#### Reviews & Social Proof

| Module | Description |
|--------|-------------|
| **Website Reviews Module™** | Import and display external reviews (Google, Facebook, Yelp) on the client site — display only; not a reputation-management tool (see §6) |

#### Site Health & Operations

| Module | Description |
|--------|-------------|
| **Website Health Command Center™** | Uptime monitoring, broken link detection, page-speed scores, SSL status, and overall site health overview |
| **Notifications & Alerts** | Site-health alerts, form submission email alerts, connector sync failure alerts |
| **Version History** | Track and restore previous versions of page and content edits |
| **Activity Logs** | Audit log of all admin actions taken within the FSTS-WOS™ dashboard |
| **Backups** | Scheduled and on-demand website backups; one-click restore |

#### Admin, Security & Platform

| Module | Description |
|--------|-------------|
| **User & Role Management** | Site admin accounts, role assignments, permission sets, SSO configuration for staff |
| **Security & Access Logs** | Login history, IP allowlisting, two-factor authentication settings |
| **Compliance Center™** | GDPR/CCPA consent management, cookie consent banners, data-subject request handling |
| **Operon Connector™** | Sole sanctioned integration point between FSTS-WOS™ and Operon CRM™ (see §3) |
| **Integrations Hub** | Manage third-party website integrations (chat widgets, map embeds, etc.) — display/embed only; no CRM logic runs inside FSTS-WOS™ |
| **Automation Marketplace™** | Browse and install pre-built workflow automations scoped to FSTS-WOS™ operations (site events, form notifications, etc.). Marketing and CRM automations belong in Operon CRM™. |
| **Billing & Subscription** | Client's own FSTS-WOS™ platform subscription and billing management |
| **White-Label Agency Edition™** | Agency-tier configuration: custom branding of the dashboard, sub-account management for agency clients |

### 1.2 Website Payment Connectors (Payment & Connector Framework™)

These processors are supported within FSTS-WOS™ for website checkout only. They are **not** CRM billing or subscription tools.

- Square
- Stripe
- PayPal
- Authorize.net
- Clover
- Shopify Payments
- WooCommerce
- QuickBooks Payments
- Manual Invoice
- ACH / Bank Transfer

---

## 2. Operon CRM™

Operon CRM™ is a **separate product** that handles relationship management, marketing automation, and advanced business operations. The following feature areas belong exclusively in Operon CRM™ and must **never** be built inside FSTS-WOS™.

### 2.1 Features Explicitly Excluded from FSTS-WOS™

| Feature Area | Product Home | Why It Is Not in FSTS-WOS™ |
|---|---|---|
| **AI Content Studio™** | Operon CRM™ | Generates marketing copy, email campaigns, social posts — CRM/marketing concern |
| **Review & Reputation Manager™** | Operon CRM™ | Requesting, responding to, and campaigning for reviews — active reputation management |
| **Appointment & Booking Suite™** | Operon CRM™ | Full scheduling, calendar sync, reminders, rescheduling flows |
| **Lead Intelligence™** | Operon CRM™ | Lead scoring, enrichment, pipeline management, deal tracking |
| **Ecommerce Pro™** | Operon CRM™ | Full-featured online store with inventory, fulfillment, and order management beyond a simple checkout |

> **Rule of thumb:** If a feature *acts on* customers or leads (sending emails, scoring leads, managing reviews campaigns, managing appointments) it belongs in Operon CRM™. If a feature *displays or captures* data on the website (rendering reviews, accepting a contact form), it belongs in FSTS-WOS™.

---

## 3. Operon Connector™ — The Sole Integration Point

The Operon Connector™ is the **only sanctioned integration channel** between FSTS-WOS™ and Operon CRM™. No other direct API calls, shared databases, or embedded CRM UI should exist between the two products.

### 3.1 Connector Characteristics

- Default-installed in every FSTS-WOS™ dashboard, but **not active** until an admin configures credentials.
- Supports per-entity sync toggles (outbound and inbound independently).
- Includes a sync activity log with retry capability and API health monitoring.
- Schema (`lib/db/src/schema/crm-connector.ts`) is provider-agnostic (`CRM_PROVIDERS` array) — Operon is the first registered provider; additional CRM vendors may be added without a schema rewrite.

### 3.2 Canonical Data-Flow Examples

These are the four canonical outbound data flows established by leadership as the authoritative examples of FSTS-WOS™ → Operon CRM™ sync:

| # | FSTS-WOS™ Event (Trigger) | Operon CRM™ Result |
|---|---|---|
| 1 | **Website Form submitted** (contact, quote request, inquiry) | New contact and/or lead record created in Operon |
| 2 | **Course Registration completed** on the website | Course enrollment record and associated contact synced to Operon |
| 3 | **Membership Signup completed** on the website | Membership record and member contact synced to Operon |
| 4 | **Payment Completed** for a website checkout transaction | Order/payment record synced to Operon; contact linked to transaction |

> Inbound flows (Operon CRM™ → FSTS-WOS™, e.g. appointment status, lead status) are also supported by the Connector via per-entity inbound toggles, but the four examples above are the canonical outbound reference cases.

---

## 4. Business Intelligence Dashboard™ — Scope

The Business Intelligence Dashboard™ lives inside FSTS-WOS™ and is **scoped to website-focused KPIs only.**

**Allowed metrics:**
- Website traffic (sessions, pageviews, bounce rate, avg. session duration)
- Form submission volume and conversion rates
- Page-level performance (top pages, exit pages)
- Payment connector revenue summaries (transactions originated on the website)
- Uptime and site-health indicators

**Not allowed in this dashboard:**
- CRM pipeline value or deal counts (Operon CRM™ territory)
- Marketing campaign performance (Operon CRM™ territory)
- Review campaign metrics (Operon CRM™ — Review & Reputation Manager™)
- Appointment or booking analytics (Operon CRM™ — Appointment & Booking Suite™)

---

## 5. AI Dashboard Assistant™ — Scope and Hard Limits

The AI Dashboard Assistant™ is an in-dashboard assistant available within FSTS-WOS™.

**Allowed:**
- Answering questions about the client's own website data (traffic, forms, settings)
- Suggesting SEO improvements based on site content
- Explaining dashboard features and guiding configuration
- Summarizing Business Intelligence Dashboard™ KPIs

**Hard limits — the Assistant must never:**
- Generate marketing copy or email campaigns (AI Content Studio™ in Operon CRM™)
- Manage or respond to reviews on behalf of the client (Operon CRM™)
- Score, enrich, or manage leads (Lead Intelligence™ in Operon CRM™)
- Access or display data from Operon CRM™ directly — all CRM data must flow through the Operon Connector™

---

## 6. Website Reviews Module™

The Website Reviews Module™ is a **display-only** exception inside FSTS-WOS™. It allows client websites to import and render external review content to build social proof. It is **not** a reputation-management tool.

### 6.1 What It May Do

- Pull published reviews from supported connectors (Google Business Profile, Facebook, Yelp).
- Display reviews on the client's website using configurable widgets.
- Filter displayed reviews by rating threshold, date range, or source.
- Cache review data locally to reduce API round-trips.
- Allow the site admin to choose which reviews appear (curate display, not manage reputation).

### 6.2 What It Must Not Do

- Send review request emails or SMS to customers (Operon CRM™ — Review & Reputation Manager™).
- Allow the site owner to respond to reviews from within FSTS-WOS™ (Operon CRM™).
- Run review campaign automation or scheduling (Operon CRM™).
- Aggregate review analytics for reputation benchmarking (Operon CRM™).
- Access platform APIs with write permissions — all connector tokens must be read-only.

### 6.3 Supported Connectors

| Provider | Data Pulled |
|---|---|
| Google Business Profile | Star rating, review text, reviewer name, date |
| Facebook | Star rating, review/recommendation text, reviewer name, date |
| Yelp | Star rating, review text (excerpt per Yelp ToS), reviewer name, date |

### 6.4 Extension Pattern

New review providers are added through the **Payment & Connector Framework™** using the same provider-agnostic pattern as CRM connectors. Each provider implements a standard adapter interface; the module does not need to know the provider-specific API details at the widget layer.

### 6.5 Implementation Reference

| Layer | Location |
|---|---|
| Convex schema | `convex/schema.ts` — `reviewSources`, `importedReviews`, `reviewDisplaySettings` tables |
| Convex backend | `convex/reviews.ts` — queries, mutations, internal sync action |
| Public endpoint | `convex/http.ts` — `GET /api/public/reviews?slug=` |
| Scheduled sync | `convex/crons.ts` — `daily-review-sync` at 02:00 UTC |
| Dashboard UI | `artifacts/fsts-dashboard/src/pages/app/sites/ReviewsManager.tsx` |
| Route | `/app/sites/:siteId/reviews` (gated on `enabledModules.reviews`) |

---

## 7. Future Architecture Notes

- **A second CRM vendor** (e.g., HubSpot, Salesforce) may be added to the Operon Connector™ by registering a new entry in `CRM_PROVIDERS`. The schema and UI framework are designed for this from the start.
- **A second review platform** (e.g., Trustpilot, BBB) is added by implementing the review adapter interface — no widget changes required.
- **These boundaries are permanent.** Leadership has determined that reputation management, marketing automation, lead intelligence, and advanced ecommerce tooling belong in Operon CRM™ as a distinct, separately licensed product. Building these features into FSTS-WOS™ — even as "lightweight" versions — is explicitly out of scope and requires a leadership decision to revisit.
