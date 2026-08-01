# FSTS-WOS™ Email Delivery Runbook

**Last updated:** August 1, 2026  
**Relates to:** Task #32 — Confirm live email delivery reaches the right inbox before the first client goes live  
**Status:** Infrastructure verified; live E2E receipt pending owner configuration

---

## 1. Email Ownership Audit

All transactional email in `convex/email.ts` is classified below.

### `sendFormNotification` — Client-website-owned

| Attribute | Value |
|-----------|-------|
| **Trigger** | Visitor submits a contact/booking/event form on a client's public website |
| **Sender (`from`)** | Client's `emailSettings.fromEmail` (e.g. `hello@acmeplumbing.com`) |
| **Recipient** | Client's `emailSettings.notificationEmail` or `fromEmail` |
| **Ownership** | **Client-website-owned.** The content, sender, and recipient are all the client's. FSTS-WOS™ is the delivery conduit only. |
| **API key required** | Client's own `resendApiKey` in Email Config (preferred), or platform `RESEND_API_KEY` as fallback |

### `sendPortalWelcome` — Tenant-specific dashboard message

| Attribute | Value |
|-----------|-------|
| **Trigger** | New member completes registration on a client's Membership Portal™ |
| **Sender (`from`)** | Client's `emailSettings.fromEmail` |
| **Recipient** | The newly registered portal member |
| **Ownership** | **Tenant-specific dashboard message.** Initiated by FSTS-WOS™ portal machinery; uses client-branded sender identity. |
| **API key required** | Client's `resendApiKey` (preferred), or platform `RESEND_API_KEY` as fallback |

---

## 2. Architecture Verdict

> **FSTS-WOS™ does NOT require its own dedicated platform Resend account for the current email flows.**

Every message in `convex/email.ts` sends from a client-configured `fromEmail`. No email originates from an FSTS-WOS™ platform identity. Therefore:

- A platform-level `RESEND_API_KEY` is optional — it serves as a convenience fallback when a site has not yet configured its own key.
- Each client should configure their own `resendApiKey` in the Email Config module.
- Each client's sender domain must be verified in Resend (the Resend account that owns the key must have the domain added and verified).

### Recommended environment variable model

| Scope | Variable | Where set | Purpose |
|-------|----------|-----------|---------|
| Per-site (preferred) | `resendApiKey` in `emailSettings` | FSTS dashboard → Email Config | Routes all email for that site through the client's own Resend account |
| Platform fallback (optional) | `RESEND_API_KEY` | Convex dashboard → Environment Variables | Fallback for sites that have not yet configured their own key; also useful during initial onboarding before the client provides a key |

### Key resolution order in `email.send`

```
1. args.apiKey        ← passed from sendFormNotification / sendPortalWelcome
                        from site's emailSettings.resendApiKey
2. process.env.RESEND_API_KEY  ← Convex deployment environment variable
3. (neither set) → email skipped with console.warn — never throws
```

---

## 3. Current Infrastructure State (Verified August 1, 2026)

| Check | Result | Notes |
|-------|--------|-------|
| Platform `RESEND_API_KEY` in Convex prod (`uncommon-cobra-336`) | ❌ **NOT SET** | Confirmed via `npx convex env get RESEND_API_KEY` — returned "not found" |
| `fsts-platform.com` SPF record | ❌ **NOT SET** | No TXT record containing `spf.resend.com` |
| `resend._domainkey.fsts-platform.com` DKIM CNAME | ❌ **NOT SET** | CNAME lookup returned empty |
| `_resend.fsts-platform.com` verification TXT | ❌ **NOT SET** | |
| Convex `email.ts` code | ✅ Complete | 28 tests passing; per-site key support added |
| Per-site `resendApiKey` field in schema | ✅ Added | `emailSettings.resendApiKey` optional field |

> **Email is silently skipping on production today.** No emails are being delivered.

---

## 4. Setup Procedures

### Option A — Per-site key (recommended for each client)

This is the right long-term setup. Repeat for every client site.

**Step 1: Create a Resend account for the client**
- Go to [resend.com](https://resend.com) → sign up or log in
- Create an API key: Settings → API Keys → Create API Key
- Copy the key (shown once)

**Step 2: Add and verify the client's sender domain**
- In Resend: Domains → Add Domain → enter the client's domain (e.g. `acmeplumbing.com`)
- Resend will show DNS records to add; copy them to the client's DNS provider:
  - SPF TXT record on `acmeplumbing.com`
  - DKIM CNAME on `resend._domainkey.acmeplumbing.com`
  - (optional) DMARC TXT on `_dmarc.acmeplumbing.com`
- Wait for DNS propagation (5 min – 48 hours)
- Click Verify in Resend to confirm

**Step 3: Configure the site in FSTS dashboard**
- Log in as superadmin → select the client site
- Email Config → fill in `From Name`, `From Email` (must use the verified domain), `Notification Email`
- Paste the Resend API key into the `Resend API Key` field
- Save

**Step 4: Run the verification script**
```bash
bash scripts/verify-email-delivery.sh --domain acmeplumbing.com
```

**Step 5: Run the live E2E test** (see Section 6 below)

---

### Option B — Platform fallback key (temporary / onboarding convenience)

Use this only when a client hasn't yet provided their own Resend account, as a temporary measure during onboarding.

**Step 1: Create a platform Resend account**
- Go to [resend.com](https://resend.com) → create a platform account (e.g. `platform@fstsclientsystem.com`)
- Create an API key

**Step 2: Add and verify the platform sender domain**
- Add `fsts-platform.com` (or your chosen platform domain) to Resend
- Add DNS records (SPF, DKIM CNAME) at your domain registrar
- Verify in Resend dashboard

**Step 3: Set `RESEND_API_KEY` in Convex production**
```bash
# Using Convex CLI (requires CONVEX_DEPLOY_KEY in environment)
CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" npx convex env set RESEND_API_KEY re_your_api_key_here
```
Or: Convex dashboard → `uncommon-cobra-336` → Settings → Environment Variables → Add

**Step 4: Verify**
```bash
bash scripts/verify-email-delivery.sh --domain fsts-platform.com
```

> ⚠️  **Important:** Email sent from `fsts-platform.com` on behalf of a client looks generic and may reduce trust. Move each client to Option A before they go live with real customers.

---

## 5. Failure Modes & Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Convex log: `[email.send] No Resend API key available` | Neither `resendApiKey` nor `RESEND_API_KEY` is set | Configure per-site key (Option A) or platform key (Option B) |
| Convex log: `[email.send] Resend API error: 403` | API key invalid or domain not authorized in that Resend account | Verify key is correct; verify sender domain is added to the Resend account owning the key |
| Convex log: `[email.send] Resend API error: 422` | `fromEmail` domain not verified in Resend | Verify DNS records; re-verify in Resend dashboard |
| Convex log: `[email.sendFormNotification] No notification email configured` | `emailSettings` has no `notificationEmail` or `fromEmail` | Set both fields in Email Config |
| Email lands in spam | SPF/DKIM not configured, or DMARC policy mismatch | Complete DNS setup per Section 4; add DMARC record |
| `[email.sendPortalWelcome] No fromEmail configured` | Site has no Email Config record | Configure Email Config for the site |

---

## 6. Live E2E Test Procedure

Run this after completing either setup option above.

1. Log into the FSTS dashboard as superadmin
2. Select a site that has Email Config fully configured (fromEmail + notificationEmail)
3. Open the site's public URL in a new tab
4. Submit the contact form with a recognizable name (e.g. "FSTS Delivery Test") and a real email address
5. Wait up to 2 minutes
6. Check the `notificationEmail` inbox for the notification email
7. In Convex dashboard → Logs → search `[email.send]` — confirm a `success: true` entry appeared at the time of submission

**Record the result here:**

### E2E Test Results

| # | Date | Site | Submitted by | Result | Convex log timestamp | Confirmed by |
|---|------|------|-------------|--------|---------------------|-------------|
| — | *pending* | — | — | ⏳ Awaiting configuration | — | — |

> Once a confirmed delivery is recorded in this table, update `PRODUCTION_READINESS_REPORT.md` Item 13 from "Code complete / config pending" to "✅ Live delivery verified".

---

## 7. Verification Script

```bash
# Check infrastructure for the platform fallback domain
bash scripts/verify-email-delivery.sh

# Check infrastructure for a specific client domain
bash scripts/verify-email-delivery.sh --domain acmeplumbing.com
```

Output: pass/fail per check with exact remediation steps. Exit code 1 if any blocking check fails.
