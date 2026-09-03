#!/bin/bash
# Tests that install-hooks.sh correctly installs the pre-commit hook and that
# the hook rejects staged corsair-source/ files.
#
# Usage: bash scripts/test-hook-guard.sh
# Added to root package.json as "test:hook-guard".

set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "=== Hook guard tests ==="
echo ""

# ---------------------------------------------------------------------------
# Part 1: install-hooks.sh installs the hook into .git/hooks/
# ---------------------------------------------------------------------------
echo "Part 1: install-hooks.sh"

TMPDIR_INSTALL="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_INSTALL"' EXIT

# Create a bare-minimum git repo so install-hooks.sh has somewhere to write
git -C "$TMPDIR_INSTALL" init -q

# Run install-hooks.sh with GIT_DIR overridden to our temp repo
HOOK_DEST="$TMPDIR_INSTALL/.git/hooks/pre-commit"

# install-hooks.sh resolves git dir relative to SCRIPT_DIR, so we copy the
# relevant scripts into the temp tree and run from there.
TMPDIR_SCRIPTS="$TMPDIR_INSTALL/scripts"
mkdir -p "$TMPDIR_SCRIPTS/hooks"
cp "$SCRIPT_DIR/install-hooks.sh" "$TMPDIR_SCRIPTS/install-hooks.sh"
cp "$SCRIPT_DIR/hooks/pre-commit"  "$TMPDIR_SCRIPTS/hooks/pre-commit"

bash "$TMPDIR_SCRIPTS/install-hooks.sh" > /dev/null 2>&1

if [ -f "$HOOK_DEST" ]; then
  pass "pre-commit hook is present after install-hooks.sh"
else
  fail "pre-commit hook NOT found after install-hooks.sh"
fi

if [ -x "$HOOK_DEST" ]; then
  pass "pre-commit hook is executable"
else
  fail "pre-commit hook is NOT executable"
fi

# ---------------------------------------------------------------------------
# Part 2: the hook exits non-zero when corsair-source/ files are staged
# ---------------------------------------------------------------------------
echo ""
echo "Part 2: hook rejects staged corsair-source/ files"

TMPDIR_REPO="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_INSTALL" "$TMPDIR_REPO"' EXIT

git -C "$TMPDIR_REPO" init -q
git -C "$TMPDIR_REPO" config user.email "test@example.com"
git -C "$TMPDIR_REPO" config user.name "Test"

# Install the hook
HOOK_DEST2="$TMPDIR_REPO/.git/hooks/pre-commit"
cp "$SCRIPT_DIR/hooks/pre-commit" "$HOOK_DEST2"
chmod +x "$HOOK_DEST2"

# Stage a file under corsair-source/
mkdir -p "$TMPDIR_REPO/corsair-source/some-dir"
echo "should not be committed" > "$TMPDIR_REPO/corsair-source/some-dir/file.txt"
git -C "$TMPDIR_REPO" add corsair-source/ 2>/dev/null

# The hook should refuse the commit
if git -C "$TMPDIR_REPO" commit -m "test" > /dev/null 2>&1; then
  fail "hook allowed a corsair-source/ commit (should have been rejected)"
else
  pass "hook rejected commit containing corsair-source/ files (exit non-zero)"
fi

# ---------------------------------------------------------------------------
# Part 3: the hook passes when no corsair-source/ files are staged
# ---------------------------------------------------------------------------
echo ""
echo "Part 3: hook allows commits with no corsair-source/ files"

TMPDIR_CLEAN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_INSTALL" "$TMPDIR_REPO" "$TMPDIR_CLEAN"' EXIT

git -C "$TMPDIR_CLEAN" init -q
git -C "$TMPDIR_CLEAN" config user.email "test@example.com"
git -C "$TMPDIR_CLEAN" config user.name "Test"

HOOK_DEST3="$TMPDIR_CLEAN/.git/hooks/pre-commit"
cp "$SCRIPT_DIR/hooks/pre-commit" "$HOOK_DEST3"
chmod +x "$HOOK_DEST3"

echo "safe content" > "$TMPDIR_CLEAN/safe-file.txt"
git -C "$TMPDIR_CLEAN" add safe-file.txt 2>/dev/null

# Simulate the real platform environment where GIT_AUTHOR_* / GIT_COMMITTER_*
# env vars are injected before every commit. The hook reads these via
# `git var GIT_AUTHOR_IDENT` to verify the approved identity.
if env GIT_AUTHOR_NAME='thefsts' GIT_AUTHOR_EMAIL='amorebey@gmail.com' \
       GIT_COMMITTER_NAME='thefsts' GIT_COMMITTER_EMAIL='amorebey@gmail.com' \
       git -C "$TMPDIR_CLEAN" commit -m "safe commit" > /dev/null 2>&1; then
  pass "hook allowed a clean commit (no corsair-source/ files staged)"
else
  fail "hook incorrectly rejected a clean commit"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
