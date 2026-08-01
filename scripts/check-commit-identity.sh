#!/usr/bin/env bash
# check-commit-identity.sh — Commit identity guard for FSTS-WOS™
#
# Fails (non-zero) when any commit in the outgoing range (origin/main..HEAD,
# or the range passed as $1) has an AUTHOR other than the approved identity:
#
#     THEFSTS <amorebey@gmail.com>
#
# Explicitly rejected authors: @users.noreply.replit.com, agent@replit.com,
# "Replit Agent", and any other name/email.
#
# Committer identity is checked and warned about but does NOT cause failure.
# Git committer metadata may be set by the Replit platform's merge/sync
# layer and is outside the control of task agents; what Vercel (and GitHub)
# match against is the author email, not the committer.
#
# Used by:
#   - .githooks/pre-push        (local pre-push guard; enable with
#                                `git config core.hooksPath .githooks`)
#   - scripts/check-boundary.sh (source-audit / CI entry point)
#
# Reference: docs/repo-governance.md ("Commit identity").

set -euo pipefail

APPROVED_NAME="THEFSTS"
APPROVED_EMAIL="amorebey@gmail.com"

RANGE="${1:-}"
if [[ -z "$RANGE" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    RANGE="origin/main..HEAD"
  else
    # No remote-tracking ref (fresh clone/CI): check the tip commit only.
    RANGE="HEAD~1..HEAD"
  fi
fi

violations=0
committer_warnings=0
while IFS='|' read -r hash an ae cn ce subject; do
  [[ -z "$hash" ]] && continue

  # ── Author check (hard failure) ───────────────────────────────────────────
  if [[ "$an" != "$APPROVED_NAME" || "$ae" != "$APPROVED_EMAIL" ]]; then
    echo "FAIL: commit $hash has unauthorized author:" >&2
    echo "      author:    $an <$ae>" >&2
    echo "      committer: $cn <$ce>" >&2
    echo "      subject:   $subject" >&2
    violations=$((violations + 1))
    continue
  fi

  # ── Committer check (warning only) ───────────────────────────────────────
  # The Replit platform's merge/sync layer may set GIT_COMMITTER_* to its own
  # service account; this does not affect Vercel or GitHub author matching.
  if [[ "$cn" != "$APPROVED_NAME" || "$ce" != "$APPROVED_EMAIL" ]]; then
    echo "WARN: commit $hash author is correct but committer differs (platform sync):" >&2
    echo "      author:    $an <$ae>" >&2
    echo "      committer: $cn <$ce>" >&2
    committer_warnings=$((committer_warnings + 1))
  fi
done < <(git log --format='%h|%an|%ae|%cn|%ce|%s' "$RANGE" 2>/dev/null)

if [[ "$violations" -gt 0 ]]; then
  echo "" >&2
  echo "Commit identity check FAILED ($violations violating commit(s) in $RANGE)." >&2
  echo "Every commit must be authored by: $APPROVED_NAME <$APPROVED_EMAIL>" >&2
  echo "Fix with: git rebase origin/main --exec 'git commit --amend --no-edit --reset-author'" >&2
  echo "          (with git config user.name/user.email set to the approved identity)" >&2
  exit 1
fi

if [[ "$committer_warnings" -gt 0 ]]; then
  echo "Commit identity check passed for $RANGE ($committer_warnings committer warning(s) — platform sync; author is $APPROVED_NAME <$APPROVED_EMAIL>)."
else
  echo "Commit identity check passed for $RANGE (all commits: $APPROVED_NAME <$APPROVED_EMAIL>)."
fi
