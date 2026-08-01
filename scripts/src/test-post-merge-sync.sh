#!/bin/bash
# Integration tests for the GitHub mirror sync logic in scripts/post-merge.sh.
#
# Tests the diverged-branch (non-fast-forward) scenarios without touching real
# GitHub. Two scenarios are covered:
#
#   Test 1 — Non-conflicting diverge: GitHub has a commit not in Replit; the
#             script should fetch, rebase cleanly, and push successfully (exit 0).
#
#   Test 2 — Conflicting diverge: both sides edited the same file differently;
#             the script should abort the rebase and exit non-zero with clear
#             manual-resolution instructions, leaving the repo in a clean state.
#
# Run via:
#   pnpm --filter @workspace/scripts run test:post-merge-sync
# or directly:
#   bash scripts/src/test-post-merge-sync.sh

set -euo pipefail

# ── Locate the script under test ───────────────────────────────────────────────
SCRIPTS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POST_MERGE_SCRIPT="$SCRIPTS_ROOT/post-merge.sh"

if [ ! -f "$POST_MERGE_SCRIPT" ]; then
  echo "ERROR: Cannot find post-merge.sh at $POST_MERGE_SCRIPT" >&2
  exit 1
fi

# ── Output helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
FAILURES=()

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL + 1)); FAILURES+=("$1"); }

# ── Temp-dir cleanup ───────────────────────────────────────────────────────────
CLEANUP_DIRS=()
cleanup() {
  for d in "${CLEANUP_DIRS[@]:-}"; do
    rm -rf "$d" 2>/dev/null || true
  done
}
trap cleanup EXIT

# ── Setup helpers ──────────────────────────────────────────────────────────────

# setup_repos: initialises a fake bare remote + a Replit-style working repo.
# Prints the tmpdir path; both repos are populated with an initial commit.
setup_repos() {
  local tmpdir
  tmpdir="$(mktemp -d)"
  CLEANUP_DIRS+=("$tmpdir")

  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"

  # Bare repo acts as the GitHub mirror.
  git init --bare "$fake_remote" -b main >/dev/null 2>&1

  # Working repo acts as the Replit environment.
  git init "$working" -b main >/dev/null 2>&1
  git -C "$working" config user.name  "THEFSTS"
  git -C "$working" config user.email "amorebey@gmail.com"

  echo "initial" > "$working/README.md"
  git -C "$working" add README.md
  git -C "$working" commit -m "initial commit" >/dev/null 2>&1

  # Seed the fake remote with the initial state.
  git -C "$working" remote add github "$fake_remote"
  git -C "$working" push github main >/dev/null 2>&1

  echo "$tmpdir"
}

# create_git_stub: writes a thin git wrapper into bin_dir that redirects
# "git remote set-url github <any-url>" and "git remote add github <any-url>"
# to always point at fake_remote, while forwarding every other git call as-is.
# This lets post-merge.sh run against a local bare repo instead of GitHub.
create_git_stub() {
  local bin_dir="$1"
  local fake_remote="$2"
  local real_git
  real_git="$(command -v git)"

  cat > "$bin_dir/git" <<STUB
#!/bin/bash
args=("\$@")
if   [ "\${args[0]:-}" = "remote" ] && [ "\${args[1]:-}" = "set-url" ] && [ "\${args[2]:-}" = "github" ]; then
  exec "$real_git" remote set-url github "$fake_remote"
elif [ "\${args[0]:-}" = "remote" ] && [ "\${args[1]:-}" = "add"     ] && [ "\${args[2]:-}" = "github" ]; then
  exec "$real_git" remote add github "$fake_remote"
else
  exec "$real_git" "\$@"
fi
STUB
  chmod +x "$bin_dir/git"
}

# create_pnpm_stub: no-op wrapper so the pnpm install / db-push lines in
# post-merge.sh don't fail when run outside the project root.
create_pnpm_stub() {
  local bin_dir="$1"
  cat > "$bin_dir/pnpm" <<'STUB'
#!/bin/bash
exit 0
STUB
  chmod +x "$bin_dir/pnpm"
}

# run_post_merge: executes post-merge.sh inside the given working dir with
# stubbed PATH and a fake token. Captures combined output; sets LAST_OUTPUT
# and LAST_EXIT for assertions.
LAST_OUTPUT=""
LAST_EXIT=0
run_post_merge() {
  local working="$1"
  local bin_dir="$2"
  LAST_OUTPUT=$(
    cd "$working"
    GITHUB_PERSONAL_ACCESS_TOKEN="fake-token-for-test" \
    PATH="$bin_dir:$PATH" \
    bash "$POST_MERGE_SCRIPT" 2>&1
  ) && LAST_EXIT=0 || LAST_EXIT=$?
}

# ── Test 1: non-conflicting diverge → rebase → success ────────────────────────
test_diverged_rebase_succeeds() {
  echo -e "${BOLD}Test 1: Non-conflicting diverge — rebase succeeds and push goes through${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Simulate a GitHub-only commit (e.g. a hotfix committed directly on GitHub).
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  git -C "$gh_clone" config user.name  "THEFSTS"
  git -C "$gh_clone" config user.email "amorebey@gmail.com"
  echo "github-only hotfix" > "$gh_clone/hotfix.txt"
  git -C "$gh_clone" add hotfix.txt
  git -C "$gh_clone" commit -m "GitHub-only hotfix" >/dev/null 2>&1
  git -C "$gh_clone" push origin main >/dev/null 2>&1

  # Simulate a Replit commit that doesn't conflict with the hotfix.
  echo "replit feature" > "$working/feature.txt"
  git -C "$working" add feature.txt
  git -C "$working" commit -m "Replit: add feature" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 after successful rebase-and-push"
  else
    fail "Script should exit 0 but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the rebase path.
  if echo "$LAST_OUTPUT" | grep -q "rebased on top of diverged remote commits"; then
    pass "Output confirms the rebase path was taken"
  else
    fail "Output should mention 'rebased on top of diverged remote commits'"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: both commits must be reachable from the fake remote's main tip.
  git -C "$gh_clone" pull >/dev/null 2>&1
  local remote_log
  remote_log="$(git -C "$gh_clone" log --oneline)"
  if echo "$remote_log" | grep -q "Replit: add feature" && \
     echo "$remote_log" | grep -q "GitHub-only hotfix"; then
    pass "Both Replit and GitHub-only commits are present in remote after sync"
  else
    fail "Remote should contain both commits after rebase sync"
    echo "    --- remote log ---"
    echo "$remote_log" | sed 's/^/    /'
  fi

  # Assertion 4: the working repo must not be left in a dirty/rebase state.
  local status_out
  status_out="$(git -C "$working" status)"
  if echo "$status_out" | grep -qi "rebase in progress\|You are currently rebasing"; then
    fail "Working repo is left in an in-progress rebase state"
  else
    pass "Working repo is clean after successful sync"
  fi
}

# ── Test 2: conflicting diverge → force-push fallback → exits 0, Replit wins ───
# post-merge.sh was updated to fall back to force-push (exit 0) instead of
# exiting non-zero when a rebase conflict occurs.  Replit is the source of
# truth, so force-push is the correct resolution: local HEAD always wins.
test_conflicting_rebase_force_push_wins() {
  echo ""
  echo -e "${BOLD}Test 2: Conflicting diverge — force-push fallback succeeds, Replit commit wins${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Simulate a GitHub-only commit that edits the same file as the Replit commit.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  git -C "$gh_clone" config user.name  "THEFSTS"
  git -C "$gh_clone" config user.email "amorebey@gmail.com"
  echo "GitHub version — conflicts with Replit" > "$gh_clone/README.md"
  git -C "$gh_clone" add README.md
  git -C "$gh_clone" commit -m "GitHub: conflicting README edit" >/dev/null 2>&1
  git -C "$gh_clone" push origin main >/dev/null 2>&1

  # Replit also edits the same file with different content → guaranteed rebase conflict.
  echo "Replit version — conflicts with GitHub" > "$working/README.md"
  git -C "$working" add README.md
  git -C "$working" commit -m "Replit: conflicting README edit" >/dev/null 2>&1

  # Capture the remote tip SHA before the script runs — it must not change.
  local remote_tip_before
  remote_tip_before="$(git -C "$gh_clone" ls-remote origin HEAD | cut -f1)"

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0 (force-push path succeeds).
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 after force-push fallback on conflicting rebase"
  else
    fail "Script should exit 0 after force-push but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the force-push path.
  if echo "$LAST_OUTPUT" | grep -qiE "force-push|force-updated|force updated"; then
    pass "Output confirms the force-push path was taken"
  else
    fail "Output should mention force-push or force-updated"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: the remote must have the Replit commit (local HEAD wins).
  git -C "$gh_clone" fetch origin >/dev/null 2>&1
  git -C "$gh_clone" reset --hard origin/main >/dev/null 2>&1
  local remote_head
  remote_head="$(git -C "$gh_clone" log -1 --pretty=%s)"
  if [ "$remote_head" = "Replit: conflicting README edit" ]; then
    pass "Remote HEAD is the Replit commit — local history wins after force-push"
  else
    fail "Remote HEAD should be the Replit commit but is: $remote_head"
  fi

  # Assertion 4: working repo must not be left in a rebase-in-progress state.
  local status_out
  status_out="$(git -C "$working" status 2>&1)"
  if echo "$status_out" | grep -qi "rebase in progress\|You are currently rebasing"; then
    fail "Working repo is left in a rebase-in-progress state after abort"
  else
    pass "Working repo is clean after force-push (no lingering rebase state)"
  fi
}

# ── Test 3: wrong-identity commit in outgoing range → aborts before push ───────
# post-merge.sh amends the HEAD commit to fix its author, but if the outgoing
# range contains an EARLIER commit with a wrong author identity, the identity
# check must catch it and abort the push before any bytes reach GitHub.
test_wrong_identity_aborts_push() {
  echo ""
  echo -e "${BOLD}Test 3: Wrong-identity commit in outgoing range — push is aborted${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it must not change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Simulate the platform injecting a commit with a wrong author identity that
  # is NOT the tip (post-merge.sh only amends HEAD, so this one stays wrong).
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "platform: wrong-identity commit" >/dev/null 2>&1

  # Add a second commit (this will become HEAD; post-merge.sh will amend it to
  # the correct identity — but the earlier wrong-identity commit must still be
  # caught by the outgoing-range check).
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "another wrong-identity commit (will become HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit non-zero — identity check must abort the push.
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero when outgoing range contains a wrong-identity commit"
  else
    fail "Script should exit non-zero but exited 0 — wrong-identity commit was not caught"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the identity failure clearly.
  if echo "$LAST_OUTPUT" | grep -qiE "unauthori[sz]ed author|identity.*ABORTED|ABORTED.*identity|commit identity.*FAILED|FAILED.*commit identity"; then
    pass "Output clearly reports the identity violation"
  else
    fail "Output should mention the identity failure (unauthorised author / ABORTED)"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: the remote must NOT have been pushed — tip SHA unchanged.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" = "$remote_tip_after" ]; then
    pass "Remote history was not modified — wrong-identity commits were not pushed"
  else
    fail "Remote tip changed — wrong-identity commit reached GitHub despite identity failure"
    echo "    remote before: $remote_tip_before"
    echo "    remote after:  $remote_tip_after"
  fi
}

# ── Test 4: multiple consecutive wrong-identity commits → ALL caught ───────────
# A regression in check-commit-identity.sh could cause it to stop after the
# first violation and miss subsequent ones.  This test injects 3 wrong-identity
# commits and confirms that all three violations are reported and the push is
# still aborted (full-range scan, not early-exit after first offender).
test_multiple_wrong_identity_all_caught() {
  echo ""
  echo -e "${BOLD}Test 4: Multiple consecutive wrong-identity commits — all violations caught${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it must not change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Inject 4 wrong-identity commits.  post-merge.sh amends HEAD to the correct
  # author identity before running the outgoing-range check, so the final commit
  # (commit #4) will be fixed automatically.  The remaining 3 non-HEAD commits
  # must ALL be reported as violations — confirming the scanner does not stop
  # after the first offender.
  local sha1 sha2 sha3
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #1" >/dev/null 2>&1
  sha1="$(git -C "$working" rev-parse --short HEAD)"

  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #2" >/dev/null 2>&1
  sha2="$(git -C "$working" rev-parse --short HEAD)"

  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #3" >/dev/null 2>&1
  sha3="$(git -C "$working" rev-parse --short HEAD)"

  # Commit #4 becomes HEAD; post-merge.sh amends it to the correct identity so
  # it won't appear as a violation — but commits #1-#3 must still all be caught.
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #4 (HEAD — amended by post-merge)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit non-zero — commits #1-#3 are still wrong-identity.
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero when outgoing range contains multiple wrong-identity commits"
  else
    fail "Script should exit non-zero but exited 0 — wrong-identity commits were not caught"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: violation count reported must be ≥ 3.
  # check-commit-identity.sh prints "N violating commit(s)" in the summary line.
  local reported_count
  reported_count="$(echo "$LAST_OUTPUT" | grep -oE '[0-9]+ violating commit' | grep -oE '^[0-9]+' || echo "0")"
  if [ "${reported_count:-0}" -ge 3 ]; then
    pass "Violation count reported is $reported_count (≥ 3) — full-range scan confirmed"
  else
    fail "Violation count should be ≥ 3 but got '${reported_count:-0}' — scanner may be stopping early"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: each of the 3 non-HEAD offending SHAs must appear in the output.
  local all_shas_found=1
  for sha in "$sha1" "$sha2" "$sha3"; do
    if echo "$LAST_OUTPUT" | grep -q "$sha"; then
      : # found
    else
      all_shas_found=0
      fail "Offending commit SHA $sha not found in output — violation may have been skipped"
    fi
  done
  if [ "$all_shas_found" -eq 1 ]; then
    pass "All 3 non-HEAD offending SHAs ($sha1, $sha2, $sha3) appear in output"
  fi

  # Assertion 4: the remote must NOT have been pushed — tip SHA unchanged.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" = "$remote_tip_after" ]; then
    pass "Remote history was not modified — all wrong-identity commits were blocked"
  else
    fail "Remote tip changed — wrong-identity commits reached GitHub despite identity failures"
    echo "    remote before: $remote_tip_before"
    echo "    remote after:  $remote_tip_after"
  fi
}

# ── Test 5: rebase/amend rewrites correct-identity commits → still caught ──────
# A developer who runs `git rebase` (or `git commit --amend`) while a wrong
# GIT_AUTHOR_* identity is active in their shell will silently replace every
# commit's author.  The identity guard must catch these rewritten commits just
# as firmly as directly-authored wrong-identity commits.
#
# Scenario:
#   1. Two commits are made with the approved identity.
#   2. `git rebase` re-applies them using --exec to stamp each with the wrong
#      author (simulating GIT_AUTHOR_* being set in the environment at rebase
#      time, e.g. by the platform or a misconfigured shell profile).
#   3. post-merge.sh must exit non-zero, report the offending SHA(s), and leave
#      the remote unchanged.
test_rebase_rewrite_wrong_identity_caught() {
  echo ""
  echo -e "${BOLD}Test 5: Rebase/amend rewrites commits with wrong identity — identity check still catches violations${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it must not change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Step 1: make two commits with the CORRECT approved identity.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity commit A" >/dev/null 2>&1

  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity commit B" >/dev/null 2>&1

  # Step 2: simulate a developer running `git rebase` while GIT_AUTHOR_* is set
  # to a wrong identity in their environment (e.g. injected by the platform, or
  # a misconfigured shell profile).  --exec amends every replayed commit with
  # the wrong author, just as `git commit --amend --reset-author` would do when
  # those env vars are present.
  # Note: the working repo uses "github" (not "origin") as its remote name, so
  # we rebase onto github/main — the same ref post-merge.sh operates against.
  #
  # We write the exec command to a helper script to avoid shell-quoting issues
  # with the author string when it is passed through git's --exec machinery.
  local rewrite_script="$tmpdir/rewrite-author.sh"
  cat > "$rewrite_script" <<'REWRITE_AUTHOR'
#!/bin/bash
git commit --amend --no-edit --allow-empty --author="Replit Agent <agent@replit.com>"
REWRITE_AUTHOR
  chmod +x "$rewrite_script"

  git -C "$working" rebase github/main \
    --exec "$rewrite_script" \
    >/dev/null 2>&1

  # After the rebase the two commits have been rewritten with the wrong author.
  # post-merge.sh will amend HEAD to fix its author, so capture the SHA of the
  # earlier (non-HEAD) commit — it must appear in the violation report.
  local sha_penultimate
  sha_penultimate="$(git -C "$working" rev-parse --short HEAD~1)"

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit non-zero — rewritten commits have wrong identity.
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero after rebase rewrites commits with wrong identity"
  else
    fail "Script should exit non-zero but exited 0 — rebase-rewritten wrong-identity commits not caught"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the identity failure clearly.
  if echo "$LAST_OUTPUT" | grep -qiE "unauthori[sz]ed author|identity.*ABORTED|ABORTED.*identity|commit identity.*FAILED|FAILED.*commit identity"; then
    pass "Output clearly reports the identity violation"
  else
    fail "Output should mention the identity failure (unauthorised author / FAILED)"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: the SHA of the non-HEAD rewritten commit must appear in the
  # output.  post-merge.sh amends HEAD to fix its author before the check, so
  # HEAD's SHA may not show up; the earlier rewritten commit must be caught.
  if echo "$LAST_OUTPUT" | grep -q "$sha_penultimate"; then
    pass "Offending commit SHA $sha_penultimate (rebase-rewritten) appears in output"
  else
    fail "Offending SHA $sha_penultimate not found in output — rebase-rewritten violation may have been missed"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 4: the remote must NOT have been pushed — tip SHA unchanged.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" = "$remote_tip_after" ]; then
    pass "Remote history was not modified — rebase-rewritten wrong-identity commits were blocked"
  else
    fail "Remote tip changed — rebase-rewritten wrong-identity commits reached GitHub despite identity failures"
    echo "    remote before: $remote_tip_before"
    echo "    remote after:  $remote_tip_after"
  fi
}

# ── Test 6: amended first (boundary) commit in range → identity guard fires ────
# The range spec `origin/main..HEAD` is exclusive of origin/main and inclusive
# of every commit on top of it, including the first one.  An off-by-one (e.g.
# accidentally using `HEAD~1..HEAD`, or iterating from HEAD backwards and
# stopping one commit early) would silently exclude the boundary commit.
#
# Scenario:
#   1. One correct-identity commit is made directly on top of origin/main
#      (the boundary commit — first and oldest in the outgoing range).
#   2. That commit is amended with a wrong author — simulating a developer who
#      runs `git commit --amend` while a bad GIT_AUTHOR_* is active.
#   3. A second correct-identity commit is then added on top, becoming HEAD.
#      post-merge.sh will amend HEAD (correct already) but the boundary commit
#      beneath it still has wrong identity.
#   4. post-merge.sh must exit non-zero, report the boundary commit's SHA, and
#      leave the remote unchanged.
#
# This is distinct from Tests 3–5: the violating commit is the OLDEST outgoing
# commit (the range boundary), not a middle or head commit.
test_amended_first_commit_caught() {
  echo ""
  echo -e "${BOLD}Test 6: Amended first (boundary) commit in range — identity guard still fires${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it must not change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Step 1: make one correct-identity commit directly on top of origin/main.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity: boundary commit" >/dev/null 2>&1

  # Step 2: amend that boundary commit with a wrong author — simulating a
  # developer who runs `git commit --amend` while a wrong identity is active.
  # This produces the wrong-identity boundary commit under test.
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --amend --no-edit --allow-empty \
    --author="Replit Agent <agent@replit.com>" >/dev/null 2>&1

  # Capture the SHA of this boundary commit so we can assert it appears in the
  # violation report.
  local sha_boundary
  sha_boundary="$(git -C "$working" rev-parse --short HEAD)"

  # Step 3: add a second commit with the correct identity on top.  This becomes
  # HEAD; post-merge.sh will amend it (no-op because author is already correct).
  # The boundary commit underneath still has wrong identity and must be caught.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity: second commit (HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit non-zero — boundary commit has wrong identity.
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero when the first (boundary) commit in the range is wrong-identity"
  else
    fail "Script should exit non-zero but exited 0 — boundary commit wrong-identity not caught"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the identity failure clearly.
  if echo "$LAST_OUTPUT" | grep -qiE "unauthori[sz]ed author|identity.*ABORTED|ABORTED.*identity|commit identity.*FAILED|FAILED.*commit identity"; then
    pass "Output clearly reports the identity violation"
  else
    fail "Output should mention the identity failure (unauthorised author / FAILED)"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: the boundary commit's SHA must appear in the output so the
  # developer can identify the bad commit.
  if echo "$LAST_OUTPUT" | grep -q "$sha_boundary"; then
    pass "Boundary commit SHA $sha_boundary appears in output"
  else
    fail "Boundary commit SHA $sha_boundary not found in output — range check may have excluded the boundary"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 4: the remote must NOT have been pushed — tip SHA unchanged.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" = "$remote_tip_after" ]; then
    pass "Remote history was not modified — wrong-identity boundary commit was blocked"
  else
    fail "Remote tip changed — wrong-identity boundary commit reached GitHub despite identity failure"
    echo "    remote before: $remote_tip_before"
    echo "    remote after:  $remote_tip_after"
  fi
}

# ── Test 7: force-push moves github/main backward → stale ref would miss the
#            wrong-identity commit; live fetch must still catch it ───────────
#
# The bypass scenario this guards against:
#   1. A wrong-identity commit W is made on the working repo and pushed to the
#      fake remote so github/main points at W.
#   2. The remote is then force-reset back to the initial commit A (simulating
#      a history rewrite / force-push that removes W from remote history).
#   3. A correct-identity commit C is added on top of W in the working repo.
#
# If post-merge.sh used a STALE github/main (still pointing at W), the range
# would be W..HEAD = {C only} — the wrong-identity commit W would be silently
# skipped and could reach GitHub on the next push.
#
# post-merge.sh must fetch github/main before computing the range. After the
# fetch, github/main = A (the reset tip), so the range becomes A..HEAD = {W, C}
# — W is in-range and the identity guard fires.
#
# This test confirms the guard catches W even after the remote has been force-
# pushed to a state that no longer includes W, proving the range calculation
# relies on the post-fetch boundary and not a stale ref.
test_force_push_moves_boundary_wrong_identity_still_caught() {
  echo ""
  echo -e "${BOLD}Test 7: Force-push moves github/main backward — stale-ref bypass is not possible${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the initial remote tip (commit A) — the remote will be reset here
  # after W is pushed, so this is also the "reset" tip we will restore.
  local initial_tip
  initial_tip="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # ── Step 1: commit a wrong-identity commit W on the working repo ──────────
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit W (will be orphaned by remote rewrite)" \
    >/dev/null 2>&1
  local sha_W
  sha_W="$(git -C "$working" rev-parse --short HEAD)"

  # ── Step 2: push W to the fake remote so github/main now points at W ──────
  # This simulates the state where W was already on GitHub before the history
  # rewrite. (The git stub lets us push to the fake bare repo directly.)
  PATH="$bin_dir:$PATH" git -C "$working" push github main >/dev/null 2>&1

  # ── Step 3: force-reset the remote back to the initial commit A ───────────
  # This simulates someone running `git push --force` on GitHub to rewrite the
  # remote history, removing W from the remote's ancestry.
  # We update the bare repo's ref directly (equivalent to a force-push).
  git -C "$fake_remote" update-ref refs/heads/main "$initial_tip" >/dev/null 2>&1

  # Sanity-check: remote must now be back at A, not at W.
  local remote_tip_now
  remote_tip_now="$(git -C "$fake_remote" rev-parse HEAD 2>/dev/null || \
                    git -C "$fake_remote" rev-parse refs/heads/main)"
  if [ "$remote_tip_now" = "$initial_tip" ]; then
    : # expected
  else
    fail "Setup error: remote was not successfully reset to initial_tip ($initial_tip), got $remote_tip_now"
    return
  fi

  # ── Step 4: add a correct-identity commit C on top of W in the working repo ─
  # C becomes HEAD; post-merge.sh will amend it (no-op — author already OK).
  # The wrong-identity commit W is now BENEATH HEAD.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity commit C (HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # ── Assertion 1: script must exit non-zero — W is in the live range ────────
  # With a stale github/main (= W), the range would be W..HEAD = {C} and W
  # would be missed (exit 0). With the fetched github/main (= A), the range is
  # A..HEAD = {W, C} and W is caught (exit non-zero).
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero — wrong-identity commit W caught against the post-fetch range boundary"
  else
    fail "Script exited 0 — wrong-identity commit W was NOT caught (stale-ref bypass may be in effect)"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # ── Assertion 2: output must mention the identity failure clearly ──────────
  if echo "$LAST_OUTPUT" | grep -qiE "unauthori[sz]ed author|identity.*ABORTED|ABORTED.*identity|commit identity.*FAILED|FAILED.*commit identity"; then
    pass "Output clearly reports the identity violation"
  else
    fail "Output should mention the identity failure (unauthorised author / ABORTED)"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # ── Assertion 3: W's short SHA must appear in the output ──────────────────
  # This confirms the guard found W specifically, not just any other commit.
  if echo "$LAST_OUTPUT" | grep -q "$sha_W"; then
    pass "Wrong-identity commit SHA $sha_W (commit W) appears in the violation report"
  else
    fail "Commit W SHA $sha_W not found in output — guard may not have reached W in the range"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # ── Assertion 4: remote must still be at initial_tip — nothing was pushed ──
  local remote_tip_after
  remote_tip_after="$(git -C "$fake_remote" rev-parse refs/heads/main)"
  if [ "$remote_tip_after" = "$initial_tip" ]; then
    pass "Remote remains at the pre-rewrite tip — wrong-identity commit W was never pushed"
  else
    fail "Remote tip changed — wrong-identity commit W (or later commits) reached the remote despite the identity failure"
    echo "    remote expected: $initial_tip"
    echo "    remote got:      $remote_tip_after"
  fi
}

# ── Test runner ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}=== post-merge.sh GitHub sync integration tests ===${RESET}"
echo ""

test_diverged_rebase_succeeds
test_conflicting_rebase_force_push_wins
test_wrong_identity_aborts_push
test_multiple_wrong_identity_all_caught
test_rebase_rewrite_wrong_identity_caught
test_amended_first_commit_caught
test_force_push_moves_boundary_wrong_identity_still_caught

echo ""
echo -e "${BOLD}=== Results: $PASS passed, $FAIL failed ===${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}✗${RESET} $f"
  done
  exit 1
fi

echo ""
echo "All tests passed."
exit 0
