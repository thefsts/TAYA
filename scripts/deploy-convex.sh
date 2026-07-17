#!/usr/bin/env bash
set -euo pipefail

# Deploy Convex functions unattended.
# Requires CONVEX_DEPLOY_KEY to be set as a Replit secret.
# CONVEX_TMPDIR is pinned to a workspace-local path to avoid cross-filesystem
# mkdtemp failures that occur when /tmp is on a different mount.

if [[ -z "${CONVEX_DEPLOY_KEY:-}" ]]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set. Add it as a Replit secret." >&2
  exit 1
fi

CONVEX_TMPDIR="${CONVEX_TMPDIR:-/home/runner/workspace/.convex-tmp}"
mkdir -p "$CONVEX_TMPDIR"

# Production safety: refuse to deploy if the target deployment has an unsafe
# environment configuration (e.g. CONVEX_TEST_MODE=true). Fails closed.
bash "$(dirname "$0")/check-prod-env.sh"

CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
CONVEX_TMPDIR="$CONVEX_TMPDIR" \
npx convex deploy --yes "$@"
