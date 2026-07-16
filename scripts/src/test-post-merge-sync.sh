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
  git -C "$working" config user.name  "Thefsts"
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
  git -C "$gh_clone" config user.name  "Thefsts"
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

# ── Test 2: conflicting diverge → rebase aborted → non-zero with instructions ──
test_conflicting_rebase_exits_nonzero() {
  echo ""
  echo -e "${BOLD}Test 2: Conflicting diverge — rebase aborted, exits non-zero with instructions${RESET}"

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
  git -C "$gh_clone" config user.name  "Thefsts"
  git -C "$gh_clone" config user.email "amorebey@gmail.com"
  echo "GitHub version — conflicts with Replit" > "$gh_clone/README.md"
  git -C "$gh_clone" add README.md
  git -C "$gh_clone" commit -m "GitHub: conflicting README edit" >/dev/null 2>&1
  git -C "$gh_clone" push origin main >/dev/null 2>&1

  # Replit also edits the same file with different content → guaranteed conflict.
  echo "Replit version — conflicts with GitHub" > "$working/README.md"
  git -C "$working" add README.md
  git -C "$working" commit -m "Replit: conflicting README edit" >/dev/null 2>&1

  run_post_merge "$working" "$bin_dir"

  # Assertion 1: script must exit non-zero.
  if [ "$LAST_EXIT" -ne 0 ]; then
    pass "Script exits non-zero when rebase conflicts (exit $LAST_EXIT)"
  else
    fail "Script should exit non-zero on conflicting rebase but exited 0"
    return
  fi

  # Assertion 2: output must include explicit manual-resolution text.
  if echo "$LAST_OUTPUT" | grep -q "Manual resolution is required"; then
    pass "Output includes 'Manual resolution is required'"
  else
    fail "Output should include 'Manual resolution is required'"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 3: both Option A and Option B must be spelled out.
  if echo "$LAST_OUTPUT" | grep -q "Option A" && echo "$LAST_OUTPUT" | grep -q "Option B"; then
    pass "Output includes both Option A and Option B resolution paths"
  else
    fail "Output should include Option A and Option B"
    echo "    --- output ---"
    echo "$LAST_OUTPUT" | sed 's/^/    /'
  fi

  # Assertion 4: the rebase must have been aborted — working repo must be clean.
  local status_out
  status_out="$(git -C "$working" status 2>&1)"
  if echo "$status_out" | grep -qi "rebase in progress\|You are currently rebasing"; then
    fail "Working repo is left in an in-progress rebase state — history may be corrupted"
  else
    pass "Working repo is not left in an in-progress rebase state (rebase was aborted)"
  fi

  # Assertion 5: the HEAD of the working repo must still be the Replit commit,
  # confirming history was not silently discarded or corrupted.
  local head_msg
  head_msg="$(git -C "$working" log -1 --pretty=%s)"
  if [ "$head_msg" = "Replit: conflicting README edit" ]; then
    pass "Working repo HEAD is unchanged — Replit history not corrupted"
  else
    fail "Working repo HEAD changed unexpectedly to: $head_msg"
  fi
}

# ── Test runner ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}=== post-merge.sh GitHub sync integration tests ===${RESET}"
echo ""

test_diverged_rebase_succeeds
test_conflicting_rebase_exits_nonzero

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
