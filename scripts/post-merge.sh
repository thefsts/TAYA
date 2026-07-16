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
# as a fast-forward. If the mirror is ahead (e.g. a hotfix committed directly on
# GitHub), fetches the diverged tip, rebases the Replit tree on top, and retries.
# Uses GITHUB_PERSONAL_ACCESS_TOKEN injected by the Replit GitHub OAuth integration.
# Fails loudly on error — never silently dropped.
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

_strip_credentials() {
  git remote set-url github "https://github.com/${OWNER}/${REPO}.git"
}

echo "→ Pushing to github.com/${OWNER}/${REPO} (branch: ${BRANCH})…"

# Attempt fast-forward push. Capture output and exit code without triggering set -e.
PUSH_OUTPUT=$(git push github "$BRANCH" 2>&1) && PUSH_EXIT=0 || PUSH_EXIT=$?

if [ "$PUSH_EXIT" -eq 0 ]; then
  echo "✓ GitHub mirror updated"
  _strip_credentials
  exit 0
fi

# ── Non-fast-forward handling ─────────────────────────────────────────────────
# GitHub rejects with "[rejected] ... non-fast-forward" or "Updates were rejected"
# when the mirror has commits not present in the Replit tree.
if echo "$PUSH_OUTPUT" | grep -qE "\[rejected\]|Updates were rejected|fetch first"; then
  echo ""
  echo "⚠ Non-fast-forward rejection: the GitHub mirror has commits not in the Replit tree."
  echo "  (This typically means a hotfix or manual commit was made directly on GitHub.)"
  echo "  Fetching remote and attempting rebase…"
  echo ""

  git fetch github "$BRANCH" 2>&1

  REBASE_OUTPUT=$(git rebase "github/${BRANCH}" 2>&1) && REBASE_EXIT=0 || REBASE_EXIT=$?

  if [ "$REBASE_EXIT" -eq 0 ]; then
    echo "$REBASE_OUTPUT"
    echo "  Rebase succeeded. Retrying push…"
    RETRY_OUTPUT=$(git push github "$BRANCH" 2>&1) && RETRY_EXIT=0 || RETRY_EXIT=$?

    if [ "$RETRY_EXIT" -eq 0 ]; then
      echo "✓ GitHub mirror updated (rebased on top of diverged remote commits)"
      _strip_credentials
      exit 0
    else
      echo "✗ Retry push failed after rebase:"
      echo "$RETRY_OUTPUT"
      _strip_credentials
      exit 1
    fi
  else
    # Rebase conflicted — abort and give clear instructions.
    git rebase --abort 2>/dev/null || true

    echo "✗ Rebase failed — the GitHub-only commits conflict with Replit changes."
    echo ""
    echo "  Manual resolution is required. Choose one of:"
    echo ""
    echo "  Option A — Preserve the GitHub commits (merge them into Replit):"
    echo "    1. In a local terminal, clone the GitHub repo:"
    echo "       git clone https://github.com/${OWNER}/${REPO}.git && cd ${REPO}"
    echo "    2. Resolve conflicts between the GitHub branch and the Replit commits."
    echo "    3. Push the resolved result back to GitHub."
    echo ""
    echo "  Option B — Discard the GitHub-only commits (Replit is source of truth):"
    echo "    Run the following in a terminal with your token set:"
    echo "       git remote add github https://\$GITHUB_PERSONAL_ACCESS_TOKEN@github.com/${OWNER}/${REPO}.git"
    echo "       git push github ${BRANCH} --force-with-lease"
    echo "       git remote set-url github https://github.com/${OWNER}/${REPO}.git"
    echo ""
    echo "  After resolving, re-trigger the post-merge sync by making a new Replit commit."
    _strip_credentials
    exit 1
  fi
fi

# ── Other push error ──────────────────────────────────────────────────────────
echo "✗ Push failed:"
echo "$PUSH_OUTPUT"
_strip_credentials
exit 1
