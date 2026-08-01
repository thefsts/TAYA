#!/usr/bin/env bash
# verify-email-delivery.sh — Pre-launch email delivery verification for FSTS-WOS™
#
# Checks every infrastructure condition required for transactional email to
# reach inboxes.  Run this before onboarding the first client, and again
# whenever a new client's sender domain is added to Resend.
#
# Usage:
#   bash scripts/verify-email-delivery.sh [--domain <sender-domain>]
#
# Options:
#   --domain <domain>   Sender domain to verify DNS records for.
#                       Defaults to "fsts-platform.com" (the platform fallback
#                       sender). Pass the client's domain (e.g. acme.com) when
#                       checking a per-site configuration.
#
# Exit codes:
#   0  All checks passed (or all failures are non-blocking and noted)
#   1  One or more blocking checks failed — do not go live until resolved
#
# Required env:
#   CONVEX_DEPLOY_KEY   — Convex production deploy key (Replit secret)

set -euo pipefail

DOMAIN="${2:-fsts-platform.com}"
PASS=0
WARN=0
FAIL=0

# Parse --domain flag
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

CONVEX_TMPDIR="${CONVEX_TMPDIR:-/home/runner/workspace/.convex-tmp}"
mkdir -p "$CONVEX_TMPDIR"

ok()   { echo "  ✅ $*"; ((PASS++)) || true; }
warn() { echo "  ⚠️  $*"; ((WARN++)) || true; }
fail() { echo "  ❌ $*"; ((FAIL++)) || true; }
sep()  { echo ""; echo "────────────────────────────────────────────────"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  FSTS-WOS™ Email Delivery Verification           ║"
echo "╚══════════════════════════════════════════════════╝"
echo "  Sender domain: $DOMAIN"
echo "  Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# ─── 1. Platform RESEND_API_KEY in Convex production ─────────────────────────
sep
echo "CHECK 1 — Platform RESEND_API_KEY in Convex production"

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  warn "CONVEX_DEPLOY_KEY not set — skipping Convex env check (run from Replit with the secret available)"
else
  KEY_RESULT=$(CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" CONVEX_TMPDIR="$CONVEX_TMPDIR" \
    npx convex env get RESEND_API_KEY 2>/dev/null || true)

  if echo "$KEY_RESULT" | grep -qi "not found"; then
    fail "RESEND_API_KEY is NOT set in Convex production (deployment: $(echo "$KEY_RESULT" | grep -o 'on .* deployment [^ ]*' || echo 'unknown'))"
    echo "       Action: Set it in the Convex dashboard → Settings → Environment Variables"
    echo "       OR configure a per-site resendApiKey via the Email Config module for each client."
    echo "       Without either, all emails are silently skipped."
  else
    ok "RESEND_API_KEY is set in Convex production (platform fallback key present)"
  fi
fi

# ─── 2. Sender domain DNS — SPF record ───────────────────────────────────────
sep
echo "CHECK 2 — SPF record for $DOMAIN"

SPF_RECORDS=$(dig TXT "$DOMAIN" +short 2>/dev/null || true)
if echo "$SPF_RECORDS" | grep -qi "resend.com"; then
  ok "SPF record includes Resend: $(echo "$SPF_RECORDS" | grep -i resend | head -1)"
elif echo "$SPF_RECORDS" | grep -qi "v=spf1"; then
  warn "SPF record exists but does not include resend.com — emails may land in spam"
  echo "       Current: $(echo "$SPF_RECORDS" | grep -i 'v=spf1' | head -1)"
  echo "       Expected: add 'include:spf.resend.com' inside your existing SPF record"
else
  fail "No SPF record found for $DOMAIN"
  echo "       Action: Add a TXT record:  v=spf1 include:spf.resend.com ~all"
fi

# ─── 3. Sender domain DNS — DKIM CNAME ───────────────────────────────────────
sep
echo "CHECK 3 — DKIM CNAME for $DOMAIN (resend._domainkey.$DOMAIN)"

DKIM=$(dig CNAME "resend._domainkey.$DOMAIN" +short 2>/dev/null || true)
if [[ -n "$DKIM" ]]; then
  ok "DKIM CNAME present: $DKIM"
else
  fail "DKIM CNAME not found at resend._domainkey.$DOMAIN"
  echo "       Action: In Resend dashboard → Domains → $DOMAIN → copy the DKIM CNAME"
  echo "               and add it to your DNS provider."
fi

# ─── 4. Sender domain DNS — Resend domain verification TXT ───────────────────
sep
echo "CHECK 4 — Resend domain verification TXT (_resend.$DOMAIN)"

VERIFY_TXT=$(dig TXT "_resend.$DOMAIN" +short 2>/dev/null || true)
if [[ -n "$VERIFY_TXT" ]]; then
  ok "Resend verification TXT present"
else
  warn "_resend.$DOMAIN TXT record not found"
  echo "       Some Resend domain setups use this record; others only require DKIM."
  echo "       Check your Resend dashboard → Domains → $DOMAIN for required records."
fi

# ─── 5. DMARC record ─────────────────────────────────────────────────────────
sep
echo "CHECK 5 — DMARC record for $DOMAIN"

DMARC=$(dig TXT "_dmarc.$DOMAIN" +short 2>/dev/null || true)
if [[ -n "$DMARC" ]]; then
  ok "DMARC record present: $DMARC"
else
  warn "No DMARC record found — not required but recommended for deliverability"
  echo "       Suggested: v=DMARC1; p=none; rua=mailto:dmarc@$DOMAIN"
fi

# ─── 6. Live E2E test instructions ───────────────────────────────────────────
sep
echo "CHECK 6 — Live end-to-end delivery test (manual step required)"
echo ""
echo "  Automated checks above verify infrastructure.  A confirmed inbox receipt"
echo "  is required before marking email delivery as production-verified."
echo ""
echo "  Procedure:"
echo "  1. Log into the FSTS dashboard as a superadmin."
echo "  2. Open a site that has Email Config set (fromEmail + notificationEmail)."
echo "  3. Submit a contact form on that site's public URL."
echo "  4. Wait up to 2 minutes and check the notificationEmail inbox."
echo "  5. In Convex dashboard → Logs → search '[email.send]' to confirm delivery."
echo "  6. If delivery fails, check Convex logs for the specific Resend error code."
echo ""
echo "  When confirmed: record the timestamp, log entry, and a screenshot in"
echo "  artifacts/fsts-dashboard/EMAIL_DELIVERY_RUNBOOK.md under 'E2E Test Results'."
warn "Live E2E receipt not yet confirmed — complete the manual step above"

# ─── Summary ─────────────────────────────────────────────────────────────────
sep
echo ""
echo "  SUMMARY"
echo "  ──────────────────────────────────────"
echo "  Passed:   $PASS"
echo "  Warnings: $WARN  (non-blocking; address before scale)"
echo "  Failed:   $FAIL  (blocking — resolve before going live)"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo "  ❌ RESULT: NOT READY — $FAIL blocking issue(s) must be resolved."
  echo ""
  echo "  See EMAIL_DELIVERY_RUNBOOK.md for step-by-step setup instructions."
  exit 1
else
  echo "  ✅ RESULT: Infrastructure checks passed."
  echo ""
  echo "  Complete the manual live E2E test (Check 6) to fully verify delivery."
fi
