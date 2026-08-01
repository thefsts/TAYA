# FSTS-WOS™ External Website Integration Contract

**Version:** 1.0  
**Status:** Authoritative  
**Phase:** 2E — Client-Neutral Integration Contracts

---

## Overview

This document defines the **only** supported mechanisms by which an external client
website may integrate with the FSTS-WOS™ platform. A client website must never
import internal dashboard components, private Convex implementation files, or any
module from the `artifacts/fsts-dashboard/` tree.

All integration is performed through:

1. The **HTTP Public API** (`convex/http.ts`)
2. The **Embed Widget** (`lib/embed-widget`)
3. **Public form submission** (via HTTP POST)

---

## 1. Site Identification

Every public API call requires a `slug` query parameter identifying the client site.

```
?slug=<site-slug>
```

The slug is assigned when the site is created in the FSTS-WOS™ dashboard. It must:
- Be unique across all sites on the platform
- Be a URL-safe lowercase string (e.g. `example-business`)
- Be kept confidential from untrusted third parties (it gates all public reads for
  that site)

---

## 2. Public HTTP Endpoints

Base URL: `https://<your-convex-deployment>.convex.cloud`

All endpoints below are publicly accessible (no authentication required) and
return JSON. All support CORS (`Access-Control-Allow-Origin: *`).

### Content Endpoints (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/homepage?slug=` | Homepage hero, sections, and CTA content |
| `GET /api/public/footer?slug=` | Footer links, contact summary, and legal text |
| `GET /api/public/contact?slug=` | Contact information (phone, email, address, hours) |
| `GET /api/public/seo?slug=` | SEO metadata (title, description, OG image) |
| `GET /api/public/site?slug=` | Site-level configuration and branding tokens |
| `GET /api/public/navigation?slug=` | Navigation menu items and structure |
| `GET /api/public/announcement?slug=` | Active site-wide announcement banner |
| `GET /api/public/cta?slug=` | Call-to-action block content |
| `GET /api/public/popup?slug=` | Modal/popup content and trigger config |
| `GET /api/public/policies?slug=` | Privacy policy and terms of service |

### Content Collection Endpoints (GET)

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/events?slug=` | Published events (sorted by start date) |
| `GET /api/public/courses?slug=` | Published courses |
| `GET /api/public/articles?slug=` | Published blog/article posts |
| `GET /api/public/articles/by-slug?slug=&articleSlug=` | Single article by slug |
| `GET /api/public/faqs?slug=` | FAQ items |
| `GET /api/public/testimonials?slug=` | Testimonials and reviews |
| `GET /api/public/media?slug=` | Media library items |
| `GET /api/public/team?slug=` | Team member profiles |
| `GET /api/public/downloads?slug=` | Downloadable resources |
| `GET /api/public/careers?slug=` | Job listings / careers |
| `GET /api/public/pricing?slug=` | Pricing plans and tiers |
| `GET /api/public/reviews?slug=` | Reviews (also used by the embed widget) |

### Single-Article Endpoint

```
GET /api/public/articles/by-slug?site=<site-slug>&article=<article-slug>
```

Returns a single published article. Uses `site` and `article` query params
(not `slug` and `articleSlug`).

### Response Format

All endpoints return `200 OK` with a JSON body on success, or `404` with
`{ "error": "Not found" }` when the site slug is unknown or content is unpublished.

---

## 3. Form Submission

### Public Form Submission

```
POST /api/public/submit
Content-Type: application/json

{
  "slug": "<site-slug>",
  "formId": "<form-id>",
  "fields": { "<field-key>": "<value>", ... }
}
```

- No authentication required — this endpoint is intentionally public to support
  anonymous visitor form submissions.
- Rate limiting and abuse protection are applied at the platform level.
- Returns `200` with `{ "ok": true }` on success.
- Returns `400` with `{ "error": "<message>" }` for validation failures.

### Form Builder API

```
GET /api/public/form?slug=&formId=
```

Returns the form schema (field definitions, validation rules, labels) so a client
website can render a form dynamically without hardcoding field names.

```
POST /api/public/form/submit
```

Submits a response to a form defined in the Form Builder module.

---

## 4. Media Delivery

```
GET /api/public/media?slug=
```

Returns an array of media items. Each item includes:
- `url` — a signed or public CDN URL for the asset
- `alt` — accessible alt text
- `mimeType` — MIME type of the asset
- `category` — optional category tag

Media URLs are resolved by the platform and may be time-limited signed URLs.
Client websites must not cache these URLs indefinitely; re-fetch the endpoint
to obtain fresh URLs.

---

## 5. Checkout / Payment Initiation

Payment is initiated through the Square integration. The client website must not
directly call Square APIs. Instead:

1. **Fetch the course or event record** via `/api/public/courses` or `/api/public/events`
   to obtain the `courseSlug` and available `pricingOptions`.
2. **POST to the Square create-order route** on the platform to initiate a checkout
   session. The platform validates the pricing option, calculates the total, and
   returns a Square payment link.

The exact payment route path is documented in the Square integration setup guide
(`docs/SQUARE_PRODUCTION_SETUP.md` in the Corsair repository).

---

## 6. Reviews Embed Widget

The `lib/embed-widget` package generates a self-contained JavaScript snippet that
can be pasted into any HTML page.

```ts
import { generateEmbedSnippet } from "@fsts/embed-widget";

const snippet = generateEmbedSnippet(
  "https://<your-convex-deployment>.convex.cloud",
  "<site-slug>",
  {
    layout: "grid",      // "grid" | "list" | "masonry" | "carousel" | "slider"
    minRating: 4,        // filter reviews below this star rating
    maxPerPage: 12,      // maximum reviews to display
    showProviderBadge: true,  // show Google/Facebook/Yelp source badge
    featuredOnly: false, // only show reviews marked as featured
    categoryFilter: "",  // optional category tag filter
  }
);
```

The snippet fetches from `/api/public/reviews?slug=` and renders entirely
client-side with no external dependencies.

---

## 7. Agency Branding

```
GET /api/agency/branding?slug=
```

Returns white-label branding tokens (colours, logo URL, agency name) for sites
managed under an agency account. Only available when the site belongs to an agency.

---

## 8. Authentication Boundary

All endpoints listed above are **public** — they require no authentication token.

A client website must never:
- Call private Convex functions directly
- Import from `convex/_generated/` in its own codebase
- Use the dashboard's Clerk session token to access platform-internal routes
- Import React components from `artifacts/fsts-dashboard/src/`
- Read from the Convex database directly using `useQuery` with internal actions

The boundary between the client website and the platform is the HTTP API defined
in this document.

---

## 9. Client Environment Variables

A client website that integrates with FSTS-WOS™ requires the following environment
variables:

| Variable | Description |
|----------|-------------|
| `FSTS_CONVEX_URL` | Base URL of the Convex deployment (e.g. `https://...convex.cloud`) |
| `FSTS_SITE_SLUG` | The site slug assigned in the FSTS-WOS™ dashboard |

No Convex deploy key, Clerk publishable key, or any other platform credential is
required or should be shared with a client website.

---

## 10. Validation Errors

All endpoints that accept input return errors in this format:

```json
{
  "error": "<human-readable message>",
  "code": "<SCREAMING_SNAKE_CASE_CODE>"
}
```

Common error codes:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NOT_FOUND` | 404 | Site slug unknown or content unpublished |
| `SLUG_REQUIRED` | 400 | `?slug=` parameter was omitted |
| `UNKNOWN_COURSE_SLUG` | 400 | `courseSlug` does not exist in the catalog |
| `COURSE_NOT_PAYABLE` | 400 | Course is contact-only; online payment not supported |
| `VALIDATION_ERROR` | 400 | Form field validation failed |

---

## 11. Officially Supported Shared Packages

The only package from this monorepo that a client website may install as a
dependency is:

| Package | Purpose |
|---------|---------|
| `lib/embed-widget` | Reviews embed snippet generator |

No other package from this monorepo (`convex/`, `artifacts/fsts-dashboard/`,
`lib/` internals) is a supported external dependency.

---

## 12. What Is Not a Supported Contract

The following are internal implementation details and must not be relied upon
by external client websites:

- Internal Convex query names (`internal.*`, `api.*` outside the HTTP layer)
- Database table and field names
- Dashboard React component APIs
- Clerk user session structure
- Any URL or file path inside `artifacts/fsts-dashboard/`
- The structure of the Convex schema (`convex/schema.ts`)

---

*This document is maintained as part of the FSTS-WOS™ platform repository.*  
*Last updated: 2026-07-31*
