# TAYA Web Bridge — Install Runbook

Phase-1 · E8 deliverable
Branch: `fsts/phase1-editor-completion` · Base: main @ `9f86e0168b2601ef631afbffc6205d63831e2ba8`

This runbook is the operator-facing procedure for **onboarding an additional
external site** into TAYA and **installing / verifying the TAYA Web Bridge** on
it. It is written against the code that actually exists on this branch; every
claim below is anchored to a file.

---

## 0. Concepts (read once)

TAYA edits an **existing external website in place**. It is not a website
builder. Each site is one workspace with one `connectionMode`:

| Mode | Meaning | Publish allowed? |
|---|---|---|
| `TAYA_NATIVE` | Site is served by TAYA's own public content APIs (hosted on `*.fstsclientsystem.com`). | Yes — publishes directly. |
| `TAYA_CONNECTED` | External site with the **TAYA Web Bridge** installed + ownership verified. | Yes — publishing flows through the bridge. |
| `DISCOVERED_EXTERNAL` | Third-party site TAYA has crawled read-only. Drafting allowed. | **No** — server-blocked until ownership is verified. |

Source of truth: `convex/schema.ts` (`sites.connectionMode` comment block),
`convex/publishing.ts` (`publishAuthorityFor`), `convex/bridge.ts`.

The bridge is **universal** — no customer-specific code, no framework
dependency. Canonical constants live in `convex/lib/webBridgeContract.ts`
(`TAYA_BRIDGE_VERSION = 2`); the dashboard mirror is `lib/web-bridge/src/`
and `tests/convex-unit/src/web-bridge-contract.test.ts` fails CI if the two
ever drift (51 tests).

---

## 1. Add the site (multi-site onboarding)

Two supported paths. Both create ONE canonical site and seed default content.

### 1a. Client self-service (the normal path)

- Mutation: `selfServiceOnboarding.provisionSite`
  (`convex/selfServiceOnboarding.ts`).
- Inputs: `name`, `company`, `websiteUrl`, `websiteType?`.
- The email is **never** an input — identity is the Clerk subject resolved
  server-side (`users.provisionMeVerified`). A client cannot claim another
  person's invitation.
- Idempotent: re-running for a user who already has a role returns
  `outcome: "reused"` with the existing site — never a duplicate.
- Domain conflict: if the bare domain already belongs to another tenant's site,
  the mutation **safe-stops** and logs an admin warning rather than silently
  claiming/rewriting the other client's assignment.
- On success it binds the caller as `owner` in the same transaction and
  schedules a **read-only** discovery crawl
  (`internal.discovery.run`) fire-and-forget.

### 1b. SuperAdmin admin path

SuperAdmins do **not** use self-service (`provisionSite` throws for them).
They onboard through the admin tools:
`artifacts/fsts-dashboard/src/pages/app/admin/AdminSiteOnboarding.tsx`
(guided wizard: Business → Settings → Users → Billing → Launch) and the
shared provisioning lib `convex/lib/siteProvisioning.ts`
(`insertSiteWithSeedContent`).

### 1c. What gets seeded automatically

`insertSiteWithSeedContent` (shared by both paths) creates the site row plus
default seed content (homepage/footer/contact/SEO/etc.) so no page loads into a
broken empty state. See `docs/ONBOARDING.md` for the full seed list.

After creation the site is `DISCOVERED_EXTERNAL` (external domain) until the
bridge is verified.

---

## 2. Install the TAYA Web Bridge

### 2a. Generate the embed

The snippet is a **pure function** of `(convexHttpUrl, slug)` —
`generateBridgeSnippet({ convexHttpUrl, slug })` in
`lib/web-bridge/src/snippet.ts` (deterministic; no random IDs, no timestamps,
no customer-specific values). The standard embed is:

```html
<!-- TAYA Web Bridge v2 -->
<script src="https://<convex-deployment>.convex.site/api/bridge/content?slug=<site-slug>"></script>
```

…or paste the self-contained vanilla-JS snippet returned by
`generateBridgeSnippet`. It has no imports/bundler/framework requirements.

### 2b. Where to paste it

Paste the `<script>` **once**, site-wide — typically immediately before
`</body>` in the site's global template (footer include, theme layout, or the
CMS's "custom scripts / footer code" field). It must appear on **every page**
you want TAYA to drive.

### 2c. Mark editable elements (optional but recommended)

The bridge applies published values to elements carrying the contract
attributes (canonical constants in `convex/lib/webBridgeContract.ts`):

| Attribute | Meaning |
|---|---|
| `data-taya-edit` | The semantic content key (e.g. `home.hero.title`) |
| `data-taya-type` | `text` \| `image` \| `url` \| `list_item` \| `button` \| `link` \| `repeatable` |
| `data-taya-label` | Human label (optional) |
| `data-taya-page` | Owning page path (best-effort, optional) |
| `data-taya-repeatable` | Marks a repeatable section |
| `data-taya-zone` | Container for published §6 safe insertion-zone blocks |

Elements without markers are untouched. Discovery/annotation
(`convex/lib/editorAnnotate.ts`) stamps the honest-binding subset automatically
for the editor frame; the bridge attributes are what the **live** site reads.

### 2d. Bridge endpoints (hosted on Convex HTTP actions)

| Method + Path | Auth | Returns |
|---|---|---|
| `GET /api/bridge/content?slug=` | public | `{version, bridgeVersion, domain, mode, publishedAt, pages, values}` — **published values only; drafts never appear** |
| `GET /api/bridge/draft?slug=&token=` | site verification token | `values` + `drafts` overlay (owner preview) |
| `POST /api/bridge/verify` | none | `{slug, matches, method, state, bridgeVersion}` (bridge_token ownership ping) |
| `POST /api/bridge/click` | none | `{ok, clicks}` click telemetry ingest |
| `GET /api/bridge/click?slug=&key=` | none | image-pixel fallback |

Unknown slug → HTTP 404. Missing params → 400. Routes:
`convex/http.ts` (bridge section); handlers: `convex/bridge.ts`.

---

## 3. Verify ownership (unlock publishing)

Publishing is **server-blocked** while `connectionMode = DISCOVERED_EXTERNAL`
(`convex/publishing.ts` → `PUBLISH_BLOCKED_MESSAGE`). The owner proves control
with ONE of five methods (`convex/ownershipVerification.ts`
`OWNERSHIP_METHODS`):

1. `dns_txt` — add a DNS TXT record with the minted token.
2. `html_meta_token` — add a `<meta>` tag with the token to the site `<head>`.
3. `bridge_token` — the bridge itself pings `/api/bridge/verify`; the token is
   the site's own verification token (shared secret).
4. `repo_connector` — **SuperAdmin-approved** (operator-trust, no network check).
5. `platform_api` — **SuperAdmin-approved** site-platform API authorization.

Self-serve methods (`dns_txt`, `html_meta_token`, `bridge_token`) are started
from the dashboard **Verification Panel**
(`artifacts/fsts-dashboard/src/pages/app/sites/VerificationPanel.tsx`) via
`ownershipVerification.beginVerification`, which mints the token and writes
`state = verification_pending`. The panel shows per-method instructions from
`verificationInstructions(method, token)`.

### Bridge-token verification flow (the bridge-native path)

1. Owner picks **Bridge token** in the Verification Panel; TAYA mints the token
   (`beginVerification`).
2. The installed bridge calls `POST /api/bridge/verify` with `{slug, token}`.
3. `bridge._verifyPing` compares against the stored `ownershipVerification.token`
   and returns `{matches, method, state, bridgeVersion}`.
4. On a match, `ownershipVerification._applyVerificationResult` (the single
   writer of the field) sets `state = verified` and promotes the site to
   `TAYA_CONNECTED`.
5. `publishContentMap` now promotes drafts to published values, which the bridge
   serves via `/api/bridge/content`.

### Draft preview

Append `?taya_preview=<verification-token>` to any site URL. The snippet then
fetches `/api/bridge/draft` and overlays drafts on published values
(event: `taya:preview-applied`). The token is the owner's own verification
token. **Draft isolation:** the public `/content` payload carries published
blocks/structural only — draft blocks/structural reach the DOM solely through
this token-gated pass.

---

## 4. Verify the install (operator checklist)

Run these after pasting the snippet:

- [ ] `GET https://<deployment>.convex.site/api/bridge/content?slug=<slug>`
      returns JSON with `bridgeVersion: 2` (not 404).
- [ ] Browser console on the live site shows a `taya:bridge-ready` event after
      load (`detail: {bridgeVersion, count}`).
- [ ] Clicking a marked element fires `taya:element-click`
      (`detail: {key, type, label, page}`).
- [ ] `POST /api/bridge/verify` with the minted token returns `matches: true`.
- [ ] After verification, the site's `connectionMode` reads `TAYA_CONNECTED`
      and the Verification Panel badge shows **Ownership verified**.
- [ ] With `?taya_preview=<token>`, draft edits appear and
      `taya:preview-applied` fires; without it, only published values appear.
- [ ] Publish a change and confirm the live page reflects it.

Automated parity guard: `tests/convex-unit/src/web-bridge-contract.test.ts`
(51 tests) — canonical ↔ dashboard mirror drift fails CI.

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/bridge/content` → 404 | wrong `slug`, or site not yet created | confirm slug from the site row; re-check the embed URL |
| No values applied, no `taya:bridge-ready` | snippet not on this page, or blocked by CSP | add snippet to the global template; allow `connect-src` to the Convex origin |
| Values applied but publish button blocked | site still `DISCOVERED_EXTERNAL` | complete ownership verification (§3) |
| Drafts never show in preview | missing/incorrect `?taya_preview=` token | use the site's current verification token |
| `verify` returns `matches: false` | token mismatch (regenerated) | re-read the token from the Verification Panel |
| CI: web-bridge contract fails | canonical and dashboard mirror drifted | reconcile `convex/lib/webBridgeContract.ts` ↔ `lib/web-bridge/src/` |

---

## 6. Anchor index

- `convex/lib/webBridgeContract.ts` — canonical bridge constants (`v2`).
- `lib/web-bridge/src/snippet.ts` — deterministic embed generator.
- `lib/web-bridge/README.md` — contract summary.
- `convex/http.ts` — `/api/bridge/*` routes.
- `convex/bridge.ts` — `_content`, `_draft`, `_verifyPing`, `_recordClick`.
- `convex/ownershipVerification.ts` — 5 methods, `beginVerification`, single writer.
- `convex/publishing.ts` — `publishAuthorityFor` gate.
- `convex/selfServiceOnboarding.ts` — `provisionSite` (multi-site, idempotent).
- `convex/lib/siteProvisioning.ts` — `insertSiteWithSeedContent`.
- `artifacts/fsts-dashboard/src/pages/app/sites/VerificationPanel.tsx` — owner UI.
- `tests/convex-unit/src/web-bridge-contract.test.ts` — parity guard (51 tests).
