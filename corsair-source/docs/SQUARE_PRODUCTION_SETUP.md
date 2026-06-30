# Square Production Setup Guide

This guide explains how to take **Corsair Tactical Solutions** from Square
**Sandbox** to **live production payments**. Follow it only after the full
sandbox test checklist passes (see [Go-Live Checklist](#7-go-live-checklist)).

> **Never paste real credentials into source code, this document, the README,
> chat, or any committed file.** All Square values live in the Vercel
> Environment Variables UI only. This guide uses placeholders.

---

## 1. Required Vercel Production environment variables

Set every variable below in your Vercel project, scoped to the **Production**
environment.

| Variable | Scope | Example / Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Frontend (public) | `sq0idp-...` (production app ID) |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Frontend (public) | production location ID |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT` | Frontend (public) | `production` |
| `SQUARE_ACCESS_TOKEN` | **Secret** (server only) | production access token |
| `SQUARE_LOCATION_ID` | **Secret** (server only) | production location ID |
| `SQUARE_ENVIRONMENT` | **Secret** (server only) | `production` |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **Secret** (server only) | production webhook signature key |

Notes:

- `NEXT_PUBLIC_SQUARE_LOCATION_ID` and `SQUARE_LOCATION_ID` are the **same
  location ID value** — one is exposed to the browser, one is read server-side.
- `NEXT_PUBLIC_SQUARE_ENVIRONMENT` controls which Square Web Payments SDK script
  the browser loads. `SQUARE_ENVIRONMENT` controls which Square REST host the
  server calls (`connect.squareup.com` for production vs.
  `connect.squareupsandbox.com` for sandbox). **Both must be set to
  `production` together** — a mismatch will cause card tokens to be rejected.
- Existing admin/catalog tooling variables (`SQUARE_ADMIN_TOKEN`,
  `CONFIRM_SQUARE_SYNC`, `NEXT_PUBLIC_SITE_URL`) are documented in
  `.env.example` and are unchanged by the production switch.

---

## 2. Frontend-safe values (public)

These are embedded in the browser bundle by design. They are **not secrets** —
they are safe to expose, but should still be configured via env vars, never
hardcoded:

- `NEXT_PUBLIC_SQUARE_APPLICATION_ID`
- `NEXT_PUBLIC_SQUARE_LOCATION_ID`
- `NEXT_PUBLIC_SQUARE_ENVIRONMENT`

---

## 3. Secret / server-only values

These must **never** reach the browser, the repo, or logs. They are read only
inside API routes and server scripts:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_ENVIRONMENT`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

If any secret is ever exposed (committed, pasted, or logged), **rotate it
immediately** in the Square Developer Dashboard and update Vercel.

---

## 4. Vercel: step-by-step

1. Open your project in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings → Environment Variables**.
3. For each variable in [Section 1](#1-required-vercel-production-environment-variables):
   - Click **Add New**.
   - Enter the **Key** (exact name from the table) and the **Value**.
   - Under **Environments**, select **Production** only (keep Preview/Development
     on sandbox values so previews never hit live payments).
   - Click **Save**.
4. Double-check that `NEXT_PUBLIC_SQUARE_ENVIRONMENT` **and** `SQUARE_ENVIRONMENT`
   are both `production`.
5. **Redeploy production** so the new variables take effect:
   - Go to **Deployments**, open the latest production deployment, and choose
     **Redeploy** (or push a new commit to the production branch).
   - Environment variable changes do **not** apply to existing deployments until
     a redeploy.

---

## 5. Square Dashboard: verify & configure

In the [Square Developer Dashboard](https://developer.squareup.com), make sure
you are viewing **Production** credentials (not Sandbox):

1. **Application ID** — Applications → your app → **Production** tab → confirm the
   Application ID matches `NEXT_PUBLIC_SQUARE_APPLICATION_ID`.
2. **Access Token** — same **Production** tab → confirm the production access
   token is the one set as `SQUARE_ACCESS_TOKEN` in Vercel.
3. **Location ID** — [Square Dashboard](https://squareup.com/dashboard) →
   **Account & Settings → Business → Locations** (or Developer Dashboard →
   Locations) → confirm the production location ID matches both
   `SQUARE_LOCATION_ID` and `NEXT_PUBLIC_SQUARE_LOCATION_ID`.
4. **Webhook endpoint** — Developer Dashboard → your app → **Webhooks →
   Subscriptions** → add/verify a **production** subscription:
   - **Notification URL:**
     `https://corsairtacticalsolutions.com/api/square/webhook`
   - **Events:** subscribe to the events the app handles —
     `payment.created`, `payment.updated`, `order.created`, `order.updated`,
     `refund.created`, `refund.updated`.
   - Copy the subscription's **Signature Key** into Vercel as
     `SQUARE_WEBHOOK_SIGNATURE_KEY` (Production scope), then redeploy.
   - Use the dashboard's **Send Test Event** to confirm the endpoint returns
     `200` and the signature verifies.

---

## 6. Sandbox test checklist (must pass before go-live)

Keep `*_ENVIRONMENT` on `sandbox` and verify each item end-to-end:

- [ ] Course/service pricing displays correctly
- [ ] Square checkout (card form) loads and accepts input
- [ ] Successful sandbox payment completes
- [ ] Failed sandbox payment is handled gracefully (declined card)
- [ ] Square webhook signature verification passes
- [ ] Booking/registration storage records the order
- [ ] Waiver connection works
- [ ] Customer confirmation email is sent
- [ ] Instructor/admin notification email is sent
- [ ] Confirmation page shows the correct order + itemized total
- [ ] Refund / cancellation process works

---

## 7. Go-live checklist

Only flip to production after **every** item below is checked:

1. [ ] Sandbox test checklist (Section 6) fully passes
2. [ ] Catalog / prices verified against the live Square catalog
3. [ ] Webhook events verified (test event returns `200`, signature verifies)
4. [ ] Confirmation page verified
5. [ ] Confirmation + admin emails verified
6. [ ] No secrets present anywhere in the repo (search history too)
7. [ ] **Only then** set `NEXT_PUBLIC_SQUARE_ENVIRONMENT=production` **and**
       `SQUARE_ENVIRONMENT=production` in Vercel (Production scope) and redeploy
8. [ ] Run one small **real-card** transaction end-to-end, then refund it, to
       confirm live processing and the live webhook

---

## 8. Rollback (revert to sandbox)

If anything goes wrong after go-live:

1. In Vercel → **Settings → Environment Variables** (Production scope), set:
   - `NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox`
   - `SQUARE_ENVIRONMENT=sandbox`
   - Restore the sandbox `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`,
     `NEXT_PUBLIC_SQUARE_APPLICATION_ID`, `NEXT_PUBLIC_SQUARE_LOCATION_ID`, and
     `SQUARE_WEBHOOK_SIGNATURE_KEY`.
2. **Redeploy production** so the rollback takes effect.
3. If needed, **disable the production webhook subscription** in the Square
   Developer Dashboard (Webhooks → Subscriptions → disable) to stop live events.
4. Confirm the site is back on sandbox (a sandbox test card should work again).

---

## Quick reference

- Webhook URL: `https://corsairtacticalsolutions.com/api/square/webhook`
- Square version used by the server: `2024-11-20`
- Sandbox host: `https://connect.squareupsandbox.com`
- Production host: `https://connect.squareup.com`
- Variable names and descriptions: see `.env.example` in the repo root.
