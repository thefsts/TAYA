#!/usr/bin/env bash
# check-prod-config.sh — Production configuration guard for FSTS-WOS™
#
# Reads environment variables from the current shell, emits one JSON-line per
# variable, and exits non-zero when any Required variable is absent.
#
# Output format (JSON Lines — one JSON object per line):
#   {
#     "variable":       "<NAME>",
#     "classification": "Required" | "Required (per-site)" | "Recommended" | "Optional",
#     "status":         "present" | "missing",
#     "feature":        "<human-readable feature protected>",
#     "failureMode":    "<what silently breaks when absent>",
#     "ownerAction":    "<exactly what to do to fix it>"
#   }
#
# Usage:
#   bash scripts/check-prod-config.sh
#   bash scripts/check-prod-config.sh 2>/dev/null | jq 'select(.status == "missing")'
#
# Add to Vercel deploy hooks (vercel.json):
#   { "buildCommand": "bash scripts/check-prod-config.sh && <your build command>" }
#
# See docs/PRODUCTION_STARTUP_GUARD.md for the full variable catalogue and
# deployment verification procedure.

set -uo pipefail

FAIL=0

# emit_line VAR CLASSIFICATION FEATURE FAILURE_MODE OWNER_ACTION
emit_line() {
  local var="$1"
  local classification="$2"
  local feature="$3"
  local failure_mode="$4"
  local owner_action="$5"
  local value="${!var:-}"

  if [[ -n "$value" ]]; then
    local status="present"
  else
    local status="missing"
  fi

  # Print the JSON line (compact, no trailing comma — valid JSON Lines)
  printf '{"variable":"%s","classification":"%s","status":"%s","feature":"%s","failureMode":"%s","ownerAction":"%s"}\n' \
    "$var" \
    "$classification" \
    "$status" \
    "$feature" \
    "$failure_mode" \
    "$owner_action"

  # Only Required (not per-site) variables block the deploy
  if [[ "$status" == "missing" && "$classification" == "Required" ]]; then
    FAIL=1
  fi
}

# ── Required — deployment will be unsafe or non-functional without these ─────

emit_line \
  "CONVEX_DEPLOY_KEY" \
  "Required" \
  "Convex deployment" \
  "npx convex deploy cannot authenticate; deployment is impossible" \
  "Set CONVEX_DEPLOY_KEY to the deploy key from your Convex dashboard → Settings → Deploy Key"

emit_line \
  "CONVEX_DEPLOYMENT_ENVIRONMENT" \
  "Required" \
  "Sandbox/production gate" \
  "isTestMode() fails open; CONVEX_TEST_MODE backdoor remains accessible on production" \
  "Run: npx convex env set CONVEX_DEPLOYMENT_ENVIRONMENT production"

emit_line \
  "CLERK_SECRET_KEY" \
  "Required" \
  "Clerk authentication (server-side)" \
  "Server-side Clerk calls fail; user management and webhook verification break" \
  "Set CLERK_SECRET_KEY to your Clerk production secret key (sk_live_...)"

emit_line \
  "VITE_CLERK_PUBLISHABLE_KEY" \
  "Required" \
  "Clerk authentication (client-side)" \
  "Dashboard fails to initialise Clerk; all users see a blank auth screen" \
  "Set VITE_CLERK_PUBLISHABLE_KEY to your Clerk publishable key (pk_live_...)"

emit_line \
  "VITE_CONVEX_URL" \
  "Required" \
  "Convex backend connectivity" \
  "Dashboard cannot connect to Convex; all data loading fails silently" \
  "Set VITE_CONVEX_URL to your Convex deployment URL (https://<name>.convex.cloud)"

# ── Required (per-site) — silent degradation per affected site ───────────────

emit_line \
  "RESEND_API_KEY" \
  "Required (per-site)" \
  "Transactional email delivery" \
  "Welcome emails and form-submission notifications are silently skipped with no visible error" \
  "Run: npx convex env set RESEND_API_KEY <key> (obtain from resend.com → API Keys)"

emit_line \
  "SQUARE_WEBHOOK_SIGNATURE_KEY" \
  "Required (per-site)" \
  "Square webhook signature verification" \
  "Webhooks accept any payload without verifying the Square signature; spoofed payment events pass unchallenged" \
  "Set the webhook signature key per-site in Dashboard → Payment Providers → Square → Webhook Key"

# ── Recommended — features degrade gracefully but operators should be aware ──

emit_line \
  "AI_INTEGRATIONS_OPENAI_API_KEY" \
  "Recommended" \
  "AI Dashboard Assistant" \
  "AI chat assistant is silently unavailable; no error shown to users" \
  "Set AI_INTEGRATIONS_OPENAI_API_KEY in the Convex production environment"

emit_line \
  "AI_INTEGRATIONS_OPENAI_BASE_URL" \
  "Recommended" \
  "AI Dashboard Assistant (endpoint routing)" \
  "AI requests may hit the wrong endpoint or fail silently" \
  "Set AI_INTEGRATIONS_OPENAI_BASE_URL to the Replit AI Integrations proxy base URL"

emit_line \
  "SESSION_SECRET" \
  "Recommended" \
  "Session signing (if used by auth middleware)" \
  "Sessions may be unsigned or use an insecure default, making them forgeable" \
  "Set SESSION_SECRET to a securely generated random string (32+ chars)"

# ── Optional — capability-gated; absence has no production impact ─────────────

emit_line \
  "CLERK_JWT_ISSUER_DOMAIN" \
  "Optional" \
  "Convex Clerk JWT issuer configuration" \
  "Convex auth.config.ts falls back to undefined; JWT validation may fail on cold start" \
  "Set CLERK_JWT_ISSUER_DOMAIN to your Clerk domain (e.g. fair-marten-42.clerk.accounts.dev)"

# ── Summary ──────────────────────────────────────────────────────────────────

if [[ "$FAIL" -ne 0 ]]; then
  echo '{"summary":"FAILED","message":"One or more Required variables are missing. Deployment blocked."}' >&2
  exit 1
fi

echo '{"summary":"PASSED","message":"All Required variables are present. Deployment is safe to proceed."}'
