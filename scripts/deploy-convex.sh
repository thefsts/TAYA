#!/usr/bin/env bash
set -euo pipefail

# Deploy TAYA Convex functions to the deployment selected by CONVEX_DEPLOY_KEY.
#
# Required shell/CI secret:
#   CONVEX_DEPLOY_KEY   — Convex production deploy key. Set this in the current
#                         terminal session, GitHub Actions secret, or other
#                         approved CI environment. Never commit the key.
#
# Required Convex environment variables (set in the Convex dashboard or CLI):
#   CONVEX_DEPLOYMENT_ENVIRONMENT=production
#   CLERK_JWT_ISSUER_DOMAIN=https://clerk.app.fstsclientsystem.com
#
# Optional Convex environment variables include RESEND_API_KEY for email.

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set." >&2
  echo "Set the Convex production deploy key in this terminal or approved CI secret store, then retry." >&2
  exit 1
fi

# Use a portable temporary directory. This works in GitHub Codespaces, local
# development, and CI without depending on a Replit-specific filesystem path.
CONVEX_TMPDIR="${CONVEX_TMPDIR:-${TMPDIR:-/tmp}/taya-convex}"
mkdir -p "$CONVEX_TMPDIR"
export CONVEX_TMPDIR

# Production safety: refuse to deploy if the target deployment has an unsafe
# environment configuration (e.g. CONVEX_TEST_MODE=true). Fails closed.
bash "$(dirname "$0")/check-prod-env.sh"

CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
CONVEX_TMPDIR="$CONVEX_TMPDIR" \
npx convex deploy --yes "$@"
