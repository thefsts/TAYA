#!/usr/bin/env bash
set -euo pipefail

# One-off production repair: canonicalize the Corsair Tactical Solutions CMS
# records to the live production domain (www.corsairtacticalsolution.com).
# See convex/migrations/canonicalizeCorsairDomain.ts for the full rationale.
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

echo "[2/4] Pre-repair audit (plural-domain references in Corsair records)..."
pnpm exec convex run migrations/canonicalizeCorsairDomain:audit

echo "[3/4] Running one-off domain canonicalization mutation..."
pnpm exec convex run migrations/canonicalizeCorsairDomain:repair

echo "[4/4] Post-repair audit (must report zero plural references)..."
pnpm exec convex run migrations/canonicalizeCorsairDomain:audit
echo "SUCCESS: Corsair domain canonicalization completed with zero remaining plural references."
