#!/bin/bash
set -e

# ── Corsair guard ─────────────────────────────────────────────────────────────
# Fail fast if corsair-source/ files somehow got tracked by git.
bash "$(dirname "$0")/check-corsair-guard.sh"

# ── Install git hooks ─────────────────────────────────────────────────────────
# Keep the pre-commit hook current after every merge.
bash "$(dirname "$0")/install-hooks.sh"

# ── Git commit identity ───────────────────────────────────────────────────────
# Enforced unconditionally on every merge so all commits carry the correct
# author regardless of the local git config state.
git config user.name  "THEFSTS"
git config user.email "amorebey@gmail.com"

pnpm install --frozen-lockfile
# drizzle-kit push requires an interactive TTY; skip in non-interactive environments.
# Run manually in a terminal: pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push || true

# ── GitHub mirror sync ────────────────────────────────────────────────────────
# Pushes the merged Replit commit to github.com/thefsts/FSTS-client-Dashboard-for-sites-
# Handles non-fast-forward rejections by fetching and rebasing.
# If the rebase conflicts, aborts cleanly and exits non-zero with instructions.
# Uses GITHUB_PERSONAL_ACCESS_TOKEN injected by the Replit GitHub OAuth integration.
echo ""
echo "--- GitHub mirror sync ---"

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "⚠ GITHUB_PERSONAL_ACCESS_TOKEN is not set — skipping GitHub mirror sync."
  echo "  The agent can push via its GitHub integration instead, or reconnect"
  echo "  the GitHub integration so the token is available for this script."
  exit 0
fi

TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN}"
OWNER="thefsts"
REPO="FSTS-client-Dashboard-for-sites-"
BRANCH="main"
REMOTE_URL="https://${TOKEN}@github.com/${OWNER}/${REPO}.git"
PUBLIC_URL="https://github.com/${OWNER}/${REPO}.git"

# Set up or update the github remote (the url is scrubbed back to public at the end)
if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

_scrub_remote() {
  git remote set-url github "$PUBLIC_URL" 2>/dev/null || true
}

echo "→ Pushing to github.com/${OWNER}/${REPO} (branch: ${BRANCH})…"

# Try fast-forward push first; capture combined stdout+stderr
push_output=$(git push github "$BRANCH" 2>&1) && push_exit=0 || push_exit=$?

if [ "$push_exit" -eq 0 ]; then
  echo "✓ GitHub mirror updated"
  _scrub_remote
  exit 0
fi

# Non-fast-forward rejection: fetch and attempt a rebase
if echo "$push_output" | grep -qE "\[rejected\]|non-fast-forward|fetch first"; then
  echo "→ Non-fast-forward push rejected; fetching remote and rebasing…"
  git fetch github "$BRANCH"

  if git rebase "github/${BRANCH}"; then
    echo "→ rebased on top of diverged remote commits"
    git push github "$BRANCH"
    echo "✓ GitHub mirror updated"
    _scrub_remote
    exit 0
  else
    git rebase --abort || true
    echo ""
    echo "✗ Rebase conflict detected. Manual resolution is required."
    echo ""
    echo "  Option A: Resolve conflicts manually:"
    echo "    1. cd to the repo root"
    echo "    2. git fetch github main && git rebase github/main"
    echo "    3. Resolve each conflict, then: git rebase --continue"
    echo "    4. git push github main"
    echo ""
    echo "  Option B: Force-push (overwrites GitHub history — use with caution):"
    echo "    git push github main --force"
    _scrub_remote
    exit 1
  fi
fi

# Some other push failure — log the raw output and exit non-zero.
echo "$push_output"
echo "✗ GitHub push failed (exit ${push_exit})"
_scrub_remote
exit "$push_exit"
