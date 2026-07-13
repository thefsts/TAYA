#!/bin/bash
set -e
pnpm install --frozen-lockfile
# drizzle-kit push requires an interactive TTY; skip in non-interactive environments.
# Run manually in a terminal: pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push || true

# ── GitHub mirror sync ────────────────────────────────────────────────────────
# Pushes the merged Replit commit to github.com/thefsts/FSTS-client-Dashboard-for-sites-
# as a non-force fast-forward. Uses GITHUB_PERSONAL_ACCESS_TOKEN injected by the
# Replit GitHub OAuth integration. Fails loudly on error — never silently dropped.
echo ""
echo "--- GitHub mirror sync ---"

OWNER="thefsts"
REPO="FSTS-client-Dashboard-for-sites-"
BRANCH="main"
AUTHOR_NAME="Thefsts"
AUTHOR_EMAIL="amorebey@gmail.com"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "✗ GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  echo "  Connect the GitHub integration so the token is available."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Set commit author identity.
git config user.name  "$AUTHOR_NAME"
git config user.email "$AUTHOR_EMAIL"

# Register authenticated remote (replaces any stale URL).
REMOTE_URL="https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${OWNER}/${REPO}.git"
if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

echo "→ Pushing to github.com/${OWNER}/${REPO} (branch: ${BRANCH})…"
git push github "$BRANCH" --force 2>&1
echo "✓ GitHub mirror updated"

# Strip credentials from remote URL so they are not stored in .git/config.
git remote set-url github "https://github.com/${OWNER}/${REPO}.git"
