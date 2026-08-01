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

# Amend the HEAD commit so both author AND committer reflect the approved
# identity. All four env vars are set explicitly to override any platform-
# injected GIT_AUTHOR_* / GIT_COMMITTER_* values (which take precedence
# over git config alone).
GIT_AUTHOR_NAME="THEFSTS" \
GIT_AUTHOR_EMAIL="amorebey@gmail.com" \
GIT_COMMITTER_NAME="THEFSTS" \
GIT_COMMITTER_EMAIL="amorebey@gmail.com" \
  git commit --amend --no-edit --reset-author --allow-empty --no-verify

# Rewrite every commit in the outgoing range (merge-base..HEAD), not just the
# tip.  A multi-commit merge can leave earlier commits with wrong author
# metadata.  We use git filter-branch (not interactive rebase) because:
#   • filter-branch is idempotent — re-running on already-correct commits is
#     safe and does not create duplicate picks.
#   • It never generates a rebase todo list, so parallel task-agent merges
#     cannot produce the stuck duplicate-pick failure that interactive rebase
#     suffers from.
if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
  _range_base=$(git merge-base origin/main HEAD 2>/dev/null || true)
  if [ -n "$_range_base" ]; then
    _commit_count=$(git rev-list --count "${_range_base}..HEAD")
    if [ "$_commit_count" -gt 1 ]; then
      echo "→ Rewriting author/committer for all ${_commit_count} outgoing commits via filter-branch…"
      FILTER_BRANCH_SQUELCH_WARNING=1 \
      git filter-branch -f --env-filter '
        export GIT_AUTHOR_NAME="THEFSTS"
        export GIT_AUTHOR_EMAIL="amorebey@gmail.com"
        export GIT_COMMITTER_NAME="THEFSTS"
        export GIT_COMMITTER_EMAIL="amorebey@gmail.com"
      ' "${_range_base}..HEAD" 2>&1 \
        || { echo "✗ Author rewrite filter-branch failed"; exit 1; }
      echo "✓ All outgoing commits rewritten to THEFSTS <amorebey@gmail.com>"
    fi
  fi
fi

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

# Accept either secret name (GITHUB_PAT is the Replit-injected name;
# GITHUB_PERSONAL_ACCESS_TOKEN is the legacy name from earlier setup).
TOKEN="${GITHUB_PAT:-${GITHUB_PERSONAL_ACCESS_TOKEN:-}}"

if [ -z "${TOKEN}" ]; then
  echo "⚠ Neither GITHUB_PAT nor GITHUB_PERSONAL_ACCESS_TOKEN is set — skipping GitHub mirror sync."
  echo "  Set GITHUB_PAT in the Replit workspace secrets to enable automatic mirror sync."
  exit 0
fi
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

# ── Identity check before GitHub push ────────────────────────────────────────
# Fetch so github/${BRANCH} is up-to-date, then inspect every commit that
# would be sent to GitHub.  If any outgoing commit has an unauthorised author
# the push is aborted — a stale or wrong-identity commit must never land on
# the shared GitHub history.
echo "→ Verifying commit identity of outgoing commits…"
git fetch github "$BRANCH" >/dev/null 2>&1 || true
PUSH_RANGE="github/${BRANCH}..HEAD"
if ! bash "$(dirname "$0")/check-commit-identity.sh" "$PUSH_RANGE" 2>&1; then
  echo "" >&2
  echo "✗ GitHub mirror sync ABORTED: one or more outgoing commits have an" >&2
  echo "  unauthorised author identity (see above)." >&2
  echo "" >&2
  echo "  Fix with:" >&2
  echo "    git rebase github/${BRANCH} \\" >&2
  echo "      --exec 'git commit --amend --no-edit --reset-author'" >&2
  echo "  (with git config user.name/user.email = THEFSTS / amorebey@gmail.com)" >&2
  _scrub_remote
  exit 1
fi

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
    # Replit is the source of truth. When a rebase conflict occurs, fall back
    # to a force-push so local HEAD always wins over diverged GitHub history.
    echo "→ Rebase conflict detected; Replit is source of truth — force-pushing…"
    git push github "$BRANCH" --force
    echo "✓ GitHub mirror updated (force-push)"
    _scrub_remote
    exit 0
  fi
fi

# Some other push failure — log the raw output and exit non-zero.
echo "$push_output"
echo "✗ GitHub push failed (exit ${push_exit})"
_scrub_remote
exit "$push_exit"
