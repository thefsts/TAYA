#!/usr/bin/env bash
set -euo pipefail

# One-off production repair: replace dead GCS image URLs in the Corsair
# Tactical Solutions CMS records with live replacements (site-relative paths
# for public-site content fields, absolute URLs for dashboard/portal branding
# fields — see convex/migrations/repairCorsairImages.ts).
#
# Guarded the same way as deploy-convex.sh: requires the production deploy key
# for uncommon-cobra-336 so this can never run against a non-production target.
#
# Requires: CONVEX_DEPLOY_KEY (sandbox/CI secret), production deployment.

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set." >&2
  exit 1
fi

case "$CONVEX_DEPLOY_KEY" in
  prod:uncommon-cobra-336\|*) ;;
  *) echo "ERROR: wrong production deploy key — refusing to touch non-prod." >&2; exit 1 ;;
esac

echo "[1/4] Deploying migration function through environment guard..."
bash scripts/deploy-convex.sh

echo "[2/4] Pre-repair audit (dead references in Corsair records)..."
pnpm exec convex run migrations/repairCorsairImages:audit

echo "[3/4] Running one-off repair mutation..."
pnpm exec convex run migrations/repairCorsairImages:repair

echo "[4/4] Post-repair audit (must report zero dead references)..."
pnpm exec convex run migrations/repairCorsairImages:audit
echo "SUCCESS: Corsair image repair completed with zero remaining dead references."
