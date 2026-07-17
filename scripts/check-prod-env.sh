#!/usr/bin/env bash
# check-prod-env.sh — Production environment validation for FSTS-WOS™
#
# Fails (non-zero) if the Convex deployment targeted by CONVEX_DEPLOY_KEY has
# a conflicting/unsafe environment configuration:
#
#   1. CONVEX_TEST_MODE=true          → HARD FAIL (test backdoor on prod)
#   2. CONVEX_DEPLOYMENT_ENVIRONMENT  → must equal "production" so the runtime
#      guard in convex/lib/testMode.ts fails closed. Missing marker = FAIL.
#
# Never prints secret values — only the two non-secret flag variables above.
#
# Usage: bash scripts/check-prod-env.sh
# Runs automatically from scripts/deploy-convex.sh before every deploy.

set -euo pipefail

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set. Cannot validate the production environment." >&2
  exit 1
fi

CONVEX_TMPDIR="${CONVEX_TMPDIR:-/home/runner/workspace/.convex-tmp}"
mkdir -p "$CONVEX_TMPDIR"
export CONVEX_TMPDIR

get_env() {
  # `convex env get` exits non-zero when the variable is unset — normalize to "".
  CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" npx convex env get "$1" 2>/dev/null || true
}

test_mode="$(get_env CONVEX_TEST_MODE)"
deploy_env="$(get_env CONVEX_DEPLOYMENT_ENVIRONMENT)"

fail=0

if [[ "$test_mode" == "true" ]]; then
  echo "FAIL: CONVEX_TEST_MODE=true is set on the deployment targeted by CONVEX_DEPLOY_KEY." >&2
  echo "      This enables superadmin bootstrap backdoors and is forbidden in production." >&2
  echo "      Remove it: npx convex env remove CONVEX_TEST_MODE" >&2
  fail=1
fi

if [[ "$deploy_env" != "production" ]]; then
  echo "FAIL: CONVEX_DEPLOYMENT_ENVIRONMENT is not set to 'production' on this deployment." >&2
  echo "      The runtime test-mode guard requires this marker to fail closed." >&2
  echo "      Set it: npx convex env set CONVEX_DEPLOYMENT_ENVIRONMENT production" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Production environment validation FAILED." >&2
  exit 1
fi

echo "Production environment validation passed (CONVEX_TEST_MODE unset, environment marker present)."
