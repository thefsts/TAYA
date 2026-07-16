#!/bin/bash
set -e

# ── Git commit identity ───────────────────────────────────────────────────────
# Enforced unconditionally on every merge so all commits carry the correct
# author regardless of the local git config state.
git config user.name  "Thefsts"
git config user.email "amorebey@gmail.com"

pnpm install --frozen-lockfile
# drizzle-kit push requires an interactive TTY; skip in non-interactive environments.
# Run manually in a terminal: pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push || true

# ── GitHub mirror sync ────────────────────────────────────────────────────────
# Pushes the merged Replit commit to github.com/thefsts/FSTS-client-Dashboard-for-sites-
# as a fast-forward. Handles non-fast-forward rejections by fetching and rebasing.
# Uses GITHUB_PERSONAL_ACCESS_TOKEN injected by the Replit GitHub OAuth integration.
# On failure, sync-github.ts sends a Slack alert (if SLACK_WEBHOOK_URL is set)
# and opens a GitHub issue so the team is notified immediately.
# To re-trigger manually: pnpm --filter @workspace/scripts run sync-github
echo ""
echo "--- GitHub mirror sync ---"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "✗ GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  echo "  Connect the GitHub integration so the token is available."
  exit 1
fi

pnpm --filter @workspace/scripts run sync-github
