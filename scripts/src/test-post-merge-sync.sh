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

# ── Test 3: wrong-identity commits → rewritten to THEFSTS and pushed ──────────
# post-merge.sh rewrites ALL commits in the outgoing range to THEFSTS
# <amorebey@gmail.com> before pushing. Wrong-identity commits from the platform
# are silently corrected rather than rejected, guaranteeing every byte that
# reaches GitHub carries the approved identity regardless of what task agents
# committed locally.
test_wrong_identity_commits_rewritten_and_pushed() {
  echo ""
  echo -e "${BOLD}Test 3: Wrong-identity commits in outgoing range — rewritten to THEFSTS and pushed${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it MUST change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Two wrong-identity commits — simulating task-agent authorship.
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "platform: wrong-identity commit" >/dev/null 2>&1

  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "another wrong-identity commit (HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0 — rewrite succeeds and push goes through.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 — wrong-identity commits were rewritten and pushed"
  else
    fail "Script should exit 0 after rewriting and pushing, but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the rewrite step.
  if echo "$LAST_OUTPUT" | grep -qiE "Rewriting author|rewritten to THEFSTS|All outgoing commits rewritten"; then
    pass "Output confirms the identity rewrite step ran"
  else
    fail "Output should mention the identity rewrite step"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: remote tip MUST have changed — commits were pushed.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" != "$remote_tip_after" ]; then
    pass "Remote was updated — rewritten commits reached GitHub"
  else
    fail "Remote tip unchanged — commits were not pushed after rewrite"
  fi

  # Assertion 4: all commits on remote must carry the approved identity.
  local bad_authors
  bad_authors="$(git -C "$gh_clone" log --format="%ae" | grep -v "^amorebey@gmail\.com$" || true)"
  if [ -z "$bad_authors" ]; then
    pass "All commits on remote are authored by THEFSTS <amorebey@gmail.com>"
  else
    fail "Remote still contains non-THEFSTS commits after rewrite: $bad_authors"
  fi
}

# ── Test 4: multiple consecutive wrong-identity commits → all rewritten ────────
# post-merge.sh rewrites the full outgoing range in one filter-branch pass —
# it does not stop after fixing the first commit.  This test confirms that 4
# wrong-identity commits are ALL rewritten before the push, and that the push
# succeeds with every commit carrying the approved identity.
test_multiple_wrong_identity_all_rewritten() {
  echo ""
  echo -e "${BOLD}Test 4: Multiple consecutive wrong-identity commits — all rewritten to THEFSTS${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it MUST change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Inject 4 wrong-identity commits simulating task-agent authorship.
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #1" >/dev/null 2>&1
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #2" >/dev/null 2>&1
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #3" >/dev/null 2>&1
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --allow-empty -m "wrong-identity commit #4 (HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0 — all commits rewritten and pushed.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 — all 4 wrong-identity commits were rewritten and pushed"
  else
    fail "Script should exit 0 after rewriting all commits, but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the rewrite step.
  if echo "$LAST_OUTPUT" | grep -qiE "Rewriting author|rewritten to THEFSTS|All outgoing commits rewritten"; then
    pass "Output confirms the identity rewrite step ran"
  else
    fail "Output should mention the identity rewrite step"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: remote tip MUST have changed — commits were pushed.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" != "$remote_tip_after" ]; then
    pass "Remote was updated — all 4 rewritten commits reached GitHub"
  else
    fail "Remote tip unchanged — commits were not pushed after rewrite"
  fi

  # Assertion 4: every commit in the pushed range must have the approved identity.
  local bad_authors
  bad_authors="$(git -C "$gh_clone" log --format="%ae" | grep -v "^amorebey@gmail\.com$" || true)"
  if [ -z "$bad_authors" ]; then
    pass "All commits on remote are authored by THEFSTS <amorebey@gmail.com> — full-range rewrite confirmed"
  else
    fail "Remote still contains non-THEFSTS commits — rewrite may not have covered the full range: $bad_authors"
  fi
}

# ── Test 5: rebase-rewritten wrong-identity commits → fixed by filter-branch ───
# A `git rebase` run while a wrong GIT_AUTHOR_* identity is active will silently
# stamp every replayed commit with the wrong author.  post-merge.sh's
# filter-branch pass covers the full outgoing range and fixes these too.
test_rebase_rewrite_wrong_identity_fixed() {
  echo ""
  echo -e "${BOLD}Test 5: Rebase-rewritten wrong-identity commits — fixed and pushed by post-merge${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it MUST change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Step 1: two commits with the correct identity.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity commit A" >/dev/null 2>&1

  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity commit B" >/dev/null 2>&1

  # Step 2: rebase re-stamps both commits with the wrong author, simulating
  # GIT_AUTHOR_* being set in the environment at rebase time.
  local rewrite_script="$tmpdir/rewrite-author.sh"
  cat > "$rewrite_script" <<'REWRITE_AUTHOR'
#!/bin/bash
git commit --amend --no-edit --allow-empty --author="Replit Agent <agent@replit.com>"
REWRITE_AUTHOR
  chmod +x "$rewrite_script"

  git -C "$working" rebase github/main \
    --exec "$rewrite_script" \
    >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0 — filter-branch fixed all commits.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 — rebase-rewritten commits were fixed and pushed"
  else
    fail "Script should exit 0 after fixing rebase-rewritten commits, but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the rewrite step.
  if echo "$LAST_OUTPUT" | grep -qiE "Rewriting author|rewritten to THEFSTS|All outgoing commits rewritten"; then
    pass "Output confirms the identity rewrite step ran"
  else
    fail "Output should mention the identity rewrite step"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: remote tip MUST have changed — commits were pushed.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" != "$remote_tip_after" ]; then
    pass "Remote was updated — fixed commits reached GitHub"
  else
    fail "Remote tip unchanged — commits were not pushed after rewrite"
  fi

  # Assertion 4: all commits on remote must carry the approved identity.
  local bad_authors
  bad_authors="$(git -C "$gh_clone" log --format="%ae" | grep -v "^amorebey@gmail\.com$" || true)"
  if [ -z "$bad_authors" ]; then
    pass "All commits on remote are authored by THEFSTS <amorebey@gmail.com>"
  else
    fail "Remote still contains non-THEFSTS commits after rewrite: $bad_authors"
  fi
}

# ── Test 6: amended boundary commit → filter-branch covers the full range ──────
# The rewrite range `github/main..HEAD` is inclusive of every commit from the
# oldest outgoing commit (the range boundary) through HEAD.  An off-by-one
# (e.g. `HEAD~1..HEAD`) would leave the boundary commit un-rewritten.  This
# test confirms the boundary commit is fixed alongside all others.
test_amended_first_commit_rewritten() {
  echo ""
  echo -e "${BOLD}Test 6: Amended first (boundary) commit in range — rewritten alongside HEAD${RESET}"

  local tmpdir
  tmpdir="$(setup_repos)"
  local fake_remote="$tmpdir/fake-remote.git"
  local working="$tmpdir/working"
  local bin_dir="$tmpdir/bin"
  mkdir -p "$bin_dir"
  create_git_stub "$bin_dir" "$fake_remote"
  create_pnpm_stub "$bin_dir"

  # Capture the remote tip SHA before the script runs — it MUST change.
  local remote_tip_before
  remote_tip_before="$(git -C "$working" ls-remote github HEAD | cut -f1)"

  # Step 1: one correct-identity commit (the boundary).
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity: boundary commit" >/dev/null 2>&1

  # Step 2: amend the boundary commit with the wrong author.
  git -C "$working" \
    -c user.name="Replit Agent" \
    -c user.email="agent@replit.com" \
    commit --amend --no-edit --allow-empty \
    --author="Replit Agent <agent@replit.com>" >/dev/null 2>&1

  # Step 3: a correct-identity HEAD commit on top.
  git -C "$working" \
    -c user.name="THEFSTS" \
    -c user.email="amorebey@gmail.com" \
    commit --allow-empty -m "correct-identity: second commit (HEAD)" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit 0 — boundary commit rewritten along with HEAD.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 — boundary commit was rewritten and pushed"
  else
    fail "Script should exit 0 after rewriting boundary commit, but exited $LAST_EXIT"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # Assertion 2: output must mention the rewrite step.
  if echo "$LAST_OUTPUT" | grep -qiE "Rewriting author|rewritten to THEFSTS|All outgoing commits rewritten"; then
    pass "Output confirms the identity rewrite step ran"
  else
    fail "Output should mention the identity rewrite step"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: remote tip MUST have changed — commits were pushed.
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_before" != "$remote_tip_after" ]; then
    pass "Remote was updated — boundary commit and HEAD both pushed"
  else
    fail "Remote tip unchanged — commits were not pushed after rewrite"
  fi

  # Assertion 4: all commits on remote (including the rewritten boundary) have
  # the approved identity — confirming the range is not off-by-one.
  local bad_authors
  bad_authors="$(git -C "$gh_clone" log --format="%ae" | grep -v "^amorebey@gmail\.com$" || true)"
  if [ -z "$bad_authors" ]; then
    pass "All commits on remote are authored by THEFSTS <amorebey@gmail.com> — boundary included"
  else
    fail "Remote contains non-THEFSTS commits — boundary may not have been rewritten: $bad_authors"
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
test_force_push_boundary_recalculated_commits_rewritten() {
  echo ""
  echo -e "${BOLD}Test 7: Force-push moves github/main backward — range recalculated after fetch, all commits rewritten${RESET}"

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

  # ── Assertion 1: script must exit 0 — W + C are both rewritten and pushed ───
  # With a stale github/main (= W), the range would be W..HEAD = {C only}.
  # With the fetched github/main (= A), the range is A..HEAD = {W, C} — both
  # commits are rewritten, so W reaches GitHub with the approved identity.
  if [ "$LAST_EXIT" -eq 0 ]; then
    pass "Script exits 0 — W and C were rewritten against the post-fetch range boundary and pushed"
  else
    fail "Script exited non-zero — expected exit 0 after rewriting full range"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
    return
  fi

  # ── Assertion 2: output must mention the rewrite step ─────────────────────
  if echo "$LAST_OUTPUT" | grep -qiE "Rewriting author|rewritten to THEFSTS|All outgoing commits rewritten"; then
    pass "Output confirms the identity rewrite step ran"
  else
    fail "Output should mention the identity rewrite step"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # ── Assertion 3: remote tip must have CHANGED — commits were pushed ────────
  local gh_clone="$tmpdir/gh-clone"
  git clone "$fake_remote" "$gh_clone" >/dev/null 2>&1
  local remote_tip_after
  remote_tip_after="$(git -C "$gh_clone" log -1 --format='%H')"
  if [ "$remote_tip_after" != "$initial_tip" ]; then
    pass "Remote was updated — rewritten commits (including W) reached GitHub"
  else
    fail "Remote tip unchanged — commits were not pushed after rewrite"
  fi

  # ── Assertion 4: all commits on remote carry the approved identity ─────────
  # This proves the fetch-first boundary expansion worked: W is in the range
  # and was rewritten, not silently skipped due to a stale ref.
  local bad_authors
  bad_authors="$(git -C "$gh_clone" log --format="%ae" | grep -v "^amorebey@gmail\.com$" || true)"
  if [ -z "$bad_authors" ]; then
    pass "All commits on remote are authored by THEFSTS <amorebey@gmail.com> — W was rewritten via post-fetch range"
  else
    fail "Remote still contains non-THEFSTS commits — range may have used a stale ref: $bad_authors"
  fi
}

# ── Test runner ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}=== post-merge.sh GitHub sync integration tests ===${RESET}"
echo ""

test_diverged_rebase_succeeds
test_conflicting_rebase_force_push_wins
test_wrong_identity_commits_rewritten_and_pushed
test_multiple_wrong_identity_all_rewritten
test_rebase_rewrite_wrong_identity_fixed
test_amended_first_commit_rewritten
test_force_push_boundary_recalculated_commits_rewritten

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
