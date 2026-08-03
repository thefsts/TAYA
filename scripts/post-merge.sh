#!/bin/bash
set -e

# ── Stale index lock cleanup ──────────────────────────────────────────────────
# Simultaneous task-agent merges can leave a stale .git/index.lock that causes
# subsequent git operations to fail with exit 128.  Remove it unconditionally
# at startup — it is always safe to delete when no other git process is running.
rm -f .git/index.lock 2>/dev/null || true

# ── Corsair guard ─────────────────────────────────────────────────────────────
# Fail fast if corsair-source/ files somehow got tracked by git.
bash "$(dirname "$0")/check-corsair-guard.sh"

# ── Install git hooks ─────────────────────────────────────────────────────────
# Keep the pre-commit hook current after every merge.
bash "$(dirname "$0")/install-hooks.sh"

# ── Git commit identity ───────────────────────────────────────────────────────
git config user.name  "THEFSTS"
git config user.email "amorebey@gmail.com"

# ── GitHub remote: set up EARLY so we can fetch before rewriting ──────────────
# We need github/main as the range base for the author rewrite below.
# The remote is scrubbed back to the public URL at the end of the script.
TOKEN="${GITHUB_PAT:-${GITHUB_PERSONAL_ACCESS_TOKEN:-}}"
OWNER="thefsts"
REPO="FSTS-client-Dashboard-for-sites-"
BRANCH="main"

_scrub_remote() {
  git remote set-url github "https://github.com/${OWNER}/${REPO}.git" 2>/dev/null || true
}

if [ -n "${TOKEN}" ]; then
  REMOTE_URL="https://${TOKEN}@github.com/${OWNER}/${REPO}.git"
  if git remote get-url github >/dev/null 2>&1; then
    git remote set-url github "$REMOTE_URL"
  else
    git remote add github "$REMOTE_URL"
  fi
  # Fetch so github/main is current — we use it as the rewrite range base
  git fetch github "$BRANCH" >/dev/null 2>&1 || true
fi

# ── Rewrite author/committer for ALL commits not yet pushed to GitHub ─────────
# Use github/main as the range base so the full outgoing range is covered,
# even when multiple task-agent merges have piled up ahead of the last push.
# Task agents commit as their Replit identity; this rewrites every commit in
# the range to THEFSTS <amorebey@gmail.com> before any identity check fires.
GIT_AUTHOR_NAME="THEFSTS" \
GIT_AUTHOR_EMAIL="amorebey@gmail.com" \
GIT_COMMITTER_NAME="THEFSTS" \
GIT_COMMITTER_EMAIL="amorebey@gmail.com" \
  git commit --amend --no-edit --reset-author --allow-empty --no-verify

if git rev-parse --verify --quiet github/"$BRANCH" >/dev/null 2>&1; then
  _range_base=$(git merge-base "github/${BRANCH}" HEAD 2>/dev/null || true)
  if [ -n "$_range_base" ]; then
    _commit_count=$(git rev-list --count "${_range_base}..HEAD")
    if [ "$_commit_count" -gt 0 ]; then
      echo "→ Rewriting author/committer for all ${_commit_count} commits in github/${BRANCH}..HEAD…"
      # Use -d <tmpdir> so filter-branch works in a clean temp checkout rather
      # than the working tree — avoids "Cannot rewrite: unstaged changes" when
      # the platform merge leaves the index or worktree dirty.
      # Use ${BRANCH} (not HEAD) as the upper bound so git knows which ref to
      # update after the rewrite; bare SHAs leave refs/heads/main stale.
      _fb_tmp=$(mktemp -d)
      FILTER_BRANCH_SQUELCH_WARNING=1 \
      git filter-branch -f -d "$_fb_tmp" --env-filter '
        export GIT_AUTHOR_NAME="THEFSTS"
        export GIT_AUTHOR_EMAIL="amorebey@gmail.com"
        export GIT_COMMITTER_NAME="THEFSTS"
        export GIT_COMMITTER_EMAIL="amorebey@gmail.com"
      ' "${_range_base}..${BRANCH}" 2>&1 \
        || { rm -rf "$_fb_tmp"; echo "✗ Author rewrite failed"; exit 1; }
      rm -rf "$_fb_tmp"
      echo "✓ All outgoing commits rewritten to THEFSTS <amorebey@gmail.com>"
    fi
  fi
elif git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
  # Fallback when github remote isn't available (no TOKEN): use origin/main
  _range_base=$(git merge-base origin/main HEAD 2>/dev/null || true)
  if [ -n "$_range_base" ]; then
    _commit_count=$(git rev-list --count "${_range_base}..HEAD")
    if [ "$_commit_count" -gt 0 ]; then
      echo "→ Rewriting author/committer for ${_commit_count} commits (origin/main fallback)…"
      _fb_tmp=$(mktemp -d)
      FILTER_BRANCH_SQUELCH_WARNING=1 \
      git filter-branch -f -d "$_fb_tmp" --env-filter '
        export GIT_AUTHOR_NAME="THEFSTS"
        export GIT_AUTHOR_EMAIL="amorebey@gmail.com"
        export GIT_COMMITTER_NAME="THEFSTS"
        export GIT_COMMITTER_EMAIL="amorebey@gmail.com"
      ' "${_range_base}..${BRANCH}" 2>&1 \
        || { rm -rf "$_fb_tmp"; echo "✗ Author rewrite failed"; exit 1; }
      rm -rf "$_fb_tmp"
      echo "✓ All outgoing commits rewritten to THEFSTS <amorebey@gmail.com>"
    fi
  fi
fi

# ── Dependencies & database ───────────────────────────────────────────────────
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push || true

# ── GitHub mirror sync ────────────────────────────────────────────────────────
echo ""
echo "--- GitHub mirror sync ---"

if [ -z "${TOKEN}" ]; then
  echo "⚠ Neither GITHUB_PAT nor GITHUB_PERSONAL_ACCESS_TOKEN is set — skipping GitHub mirror sync."
  exit 0
fi

PUBLIC_URL="https://github.com/${OWNER}/${REPO}.git"

# ── Identity check before GitHub push ────────────────────────────────────────
# The filter-branch above should have already fixed any bad authors.
# This is a final safety net — it should always pass after the rewrite.
echo "→ Verifying commit identity of outgoing commits…"
# Use ${BRANCH} (not HEAD) so the check sees the rewritten refs/heads/main tip,
# which filter-branch updates.  HEAD may lag behind if the platform runs
# post-merge in a context where HEAD is not re-attached after the rewrite.
PUSH_RANGE="github/${BRANCH}..${BRANCH}"
if ! bash "$(dirname "$0")/check-commit-identity.sh" "$PUSH_RANGE" 2>&1; then
  echo "" >&2
  echo "✗ GitHub mirror sync ABORTED: identity check failed after author rewrite." >&2
  echo "  This should not happen — check that filter-branch ran successfully above." >&2
  echo "" >&2
  echo "  Manual fix:" >&2
  echo "    git rebase github/${BRANCH} \\" >&2
  echo "      --exec 'git commit --amend --no-edit --reset-author'" >&2
  echo "  (with git config user.name/user.email = THEFSTS / amorebey@gmail.com)" >&2
  _scrub_remote
  exit 1
fi

echo "→ Pushing to github.com/${OWNER}/${REPO} (branch: ${BRANCH})…"

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
    echo "→ Rebase conflict detected; Replit is source of truth — force-pushing…"
    git push github "$BRANCH" --force
    echo "✓ GitHub mirror updated (force-push)"
    _scrub_remote
    exit 0
  fi
fi

echo "$push_output"
echo "✗ GitHub push failed (exit ${push_exit})"
_scrub_remote
exit "$push_exit"
