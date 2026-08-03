---
name: post-merge filter-branch fix
description: Confirmed root causes and fixes for recurring identity-check failures in post-merge.sh — critical for future changes to this script.
---

# post-merge.sh filter-branch — confirmed root causes and fixes

## Root cause 1: Unstaged changes block filter-branch
git filter-branch refuses to run with `"Cannot rewrite branches: You have unstaged changes"` when the working tree is dirty. Simultaneous task-agent merges frequently leave the index or worktree dirty.

**Fix:** pass `-d $(mktemp -d)` to filter-branch. It then works in a clean temp checkout, bypassing the working tree entirely and ignoring dirty state.

**Why:** The `-d <dir>` flag makes filter-branch use a temporary directory as its working tree. No working tree interaction, no unstaged-changes error.

## Root cause 2: `..HEAD` as upper bound doesn't update the branch ref
When filter-branch receives `${base}..HEAD` as its range, git may resolve `HEAD` to a bare SHA (not a ref name). filter-branch then doesn't know which named ref to update after the rewrite, leaving `refs/heads/main` stale. The identity check running after (`github/main..HEAD`) then sees the pre-rewrite commits and fails.

**Fix:** use `${base}..${BRANCH}` (e.g. `${base}..main`) as the upper bound. filter-branch sees the explicit ref name `main`, rewrites the range, and updates `refs/heads/main` to the new tip. HEAD (symref to main) follows automatically.

## Root cause 3: Stale index.lock from simultaneous merges
Multiple task agents merging simultaneously can leave a stale `.git/index.lock`, causing `git commit --amend` (the first git operation in the script) to exit 128, killing the script before any rewrite or push.

**Fix:** `rm -f .git/index.lock 2>/dev/null || true` at the very top of the script, before any git operation.

## Root cause 4: Identity check range used HEAD, not the branch ref
`PUSH_RANGE="github/${BRANCH}..HEAD"` — if HEAD lagged behind `refs/heads/main` (e.g. after filter-branch in a detached context), the check saw pre-rewrite commits. Changed to `"github/${BRANCH}..${BRANCH}"` to always check the updated branch ref.

## How to apply
Any future edit to `scripts/post-merge.sh` that touches the filter-branch block must:
- Keep `-d "$(mktemp -d)"` on the filter-branch call
- Keep `${BRANCH}` (not `HEAD`) as the upper bound of the range
- Keep `rm -f .git/index.lock` at the top
- Keep `PUSH_RANGE="github/${BRANCH}..${BRANCH}"`
