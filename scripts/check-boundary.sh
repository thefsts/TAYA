#!/usr/bin/env bash
# check-boundary.sh — Product boundary enforcement for FSTS-WOS™
#
# Two enforcement layers:
#
#   1. CRM TERM SCAN — Scans source files for terms that signal Operon CRM™
#      features being built inside the FSTS-WOS™ codebase.
#      Reference: docs/product-boundaries.md §2.1
#
#   2. REPOSITORY SEPARATION CHECK — Errors if any Corsair website artifacts
#      are staged for commit into this Dashboard repo. The Corsair website
#      belongs exclusively in thefsts/Corsair-Tactical-Solutions.
#      Reference: docs/repo-governance.md §1
#
# Exits non-zero if any match is found.
#
# ALLOWLISTED paths (excluded from scan):
#   - docs/                     — product boundary documentation (defines the terms)
#   - .github/                  — PR templates and CI config
#   - scripts/check-boundary.sh — this script
#   - **/crm-connector.*        — Operon Connector™ schema/config (legitimate CRM reference)
#   - node_modules/, dist/, .git/
#   - *.md                      — Markdown docs may discuss boundary rules
#   - *.test.ts, *.spec.ts      — test files may reference prohibited terms to verify rejection

set -euo pipefail

# ---------------------------------------------------------------------------
# Prohibited terms — derived from docs/product-boundaries.md §2.1
# Matched case-insensitively. Phrases are scoped tightly to avoid false
# positives on in-scope FSTS-WOS™ features.
# ---------------------------------------------------------------------------
PROHIBITED_TERMS=(
  # Lead Intelligence™
  "lead scor"
  "lead enrichment"
  "pipeline management"
  "deal tracking"
  "deal pipeline"

  # Review & Reputation Manager™
  "reputation manag"
  "review campaign"
  "respond to review"
  "reputation benchmark"

  # AI Content Studio™
  "ai content studio"
  "marketing automation"
  "email campaign"
  "social post generator"

  # Appointment & Booking Suite™
  "appointment booking suite"
  "booking reminder"

  # Ecommerce Pro™
  "ecommerce pro"
)

# ---------------------------------------------------------------------------
# Source paths to scan (relative to repo root).
# ALL paths listed here are REQUIRED — the script exits with an error if any
# are missing. This prevents silent coverage gaps when the repo layout changes.
# To add a new path, ensure it exists; to remove one, delete the entry here.
# ---------------------------------------------------------------------------
SCAN_PATHS=(
  "artifacts/fsts-dashboard/src"   # dashboard UI
  "convex"                         # backend API (Convex functions)
  "lib"                            # shared libraries
)

# ---------------------------------------------------------------------------
# Build rg arguments once: type filters + exclusion globs
# ---------------------------------------------------------------------------
build_rg_args() {
  # Include only source-code file extensions
  local include_exts=("ts" "tsx" "js" "jsx" "mjs" "cjs")
  for ext in "${include_exts[@]}"; do
    echo "--type-add"
    echo "src:*.${ext}"
  done
  echo "--type" ; echo "src"

  # Exclude allowlisted paths
  local excludes=(
    "!**/node_modules/**"
    "!**/dist/**"
    "!**/.git/**"
    "!**/*.md"
    "!**/*.test.ts"
    "!**/*.spec.ts"
    "!**/*.test.tsx"
    "!**/*.spec.tsx"
    "!**/crm-connector.*"
    "!**/crm-connector/**"
    "!scripts/check-boundary.sh"
  )
  for pat in "${excludes[@]}"; do
    echo "--glob"
    echo "$pat"
  done
}

# ---------------------------------------------------------------------------
# Main scan
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Verify every configured scan path exists.
# Missing paths indicate a repo layout change that needs the config updated —
# failing hard prevents silent coverage gaps.
MISSING=0
for p in "${SCAN_PATHS[@]}"; do
  if [ ! -d "$p" ]; then
    echo "[boundary-check] ERROR: configured scan path does not exist: $p" >&2
    echo "  Update SCAN_PATHS in scripts/check-boundary.sh to reflect the current repo layout." >&2
    MISSING=1
  fi
done
if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo "[boundary-check] Scanning FSTS-WOS™ source files for out-of-scope CRM terms…"
echo "[boundary-check] Paths: ${SCAN_PATHS[*]}"
echo ""

FOUND=0

# Read rg args into an array (newline-separated from the helper function)
mapfile -t RG_ARGS < <(build_rg_args)

for TERM in "${PROHIBITED_TERMS[@]}"; do
  MATCHES=$(
    rg \
      --ignore-case \
      --line-number \
      --with-filename \
      "${RG_ARGS[@]}" \
      -- "$TERM" \
      "${SCAN_PATHS[@]}" 2>/dev/null || true
  )

  if [ -n "$MATCHES" ]; then
    echo "❌  PROHIBITED TERM: \"$TERM\""
    echo "$MATCHES" | sed 's/^/   /'
    echo ""
    FOUND=1
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo "[boundary-check] ✅  No out-of-scope CRM terms found. Product boundary is clean."
else
  echo "[boundary-check] ❌  Product boundary violation(s) detected."
  echo ""
  echo "  The matched terms belong in Operon CRM™, not FSTS-WOS™."
  echo "  See docs/product-boundaries.md §2.1 for the full exclusion list."
  echo "  To mark a file as boundary-safe, add it to the exclusion list in"
  echo "  scripts/check-boundary.sh with a comment explaining why it is safe."
  echo ""
fi

# ---------------------------------------------------------------------------
# REPOSITORY SEPARATION CHECK
#
# Detects Corsair website artifacts committed into this Dashboard repo.
# The Corsair website belongs in thefsts/Corsair-Tactical-Solutions, not here.
# See docs/repo-governance.md §1.
#
# Scans ALL tracked files in the git index (committed + staged) so this check
# is effective both locally (pre-commit) and in CI (post-push, no staged files).
#
# Patterns that signal a Corsair file is present in this repo:
#
#   1. Next.js app/ page trees — any artifacts/*/app/ path that is NOT inside
#      artifacts/fsts-dashboard/. The fsts-dashboard is a plain React/Vite app;
#      any app/ directory under a different artifact slug is Next.js (Corsair).
#      POSIX-compatible match: grep ^artifacts/.*/app/ then exclude fsts-dashboard.
#
#   2. Corsair i18n JSON files — course translation files at the repo-root
#      messages/ directory (messages/en.json, messages/es.json, etc.).
#      The Dashboard has no top-level messages/ directory; any file there is
#      Corsair website content.
#
#   3. Corsair public image assets — static images in a top-level public/
#      directory. The Dashboard is a Vite app; a repo-root public/ with images
#      is the Corsair website's static asset folder.
# ---------------------------------------------------------------------------
echo ""
echo "[boundary-check] Checking for Corsair website artifacts in this repository…"

REPO_SEPARATION_FOUND=0

# Only run when inside a git repo.
if git rev-parse --git-dir >/dev/null 2>&1; then
  # Scan ALL tracked files (committed + staged).
  # git ls-files covers the full index, so this works both locally and in CI
  # where there are no staged files but violations may already be committed.
  ALL_FILES=$(git ls-files 2>/dev/null || true)

  if [ -n "$ALL_FILES" ]; then
    # --- Pattern 1: Next.js app/ page trees outside artifacts/fsts-dashboard/ ---
    # Step 1: match any artifacts/<slug>/app/ path.
    # Step 2: exclude the fsts-dashboard artifact (its source has no app/ dir,
    #         but we exclude it explicitly to be safe against future changes).
    # NOTE: grep -E does NOT support lookaheads in GNU/BSD; use two-pipe approach.
    NEXTJS_FOUND=$(
      echo "$ALL_FILES" \
        | grep -E '^artifacts/[^/]+/app/' \
        | grep -v '^artifacts/fsts-dashboard/' \
      || true
    )
    if [ -n "$NEXTJS_FOUND" ]; then
      echo "❌  CORSAIR ARTIFACT: Next.js page tree found outside artifacts/fsts-dashboard/"
      echo "    These files belong in thefsts/Corsair-Tactical-Solutions:"
      echo "$NEXTJS_FOUND" | sed 's/^/      /'
      echo ""
      REPO_SEPARATION_FOUND=1
    fi

    # --- Pattern 2: Corsair i18n JSON files (repo-root messages/*.json) ---
    # The Dashboard has no top-level messages/ directory; any .json file there
    # is a Corsair website locale translation file.
    I18N_FOUND=$(echo "$ALL_FILES" | grep -E '^messages/[^/]+\.json$' || true)
    if [ -n "$I18N_FOUND" ]; then
      echo "❌  CORSAIR ARTIFACT: Corsair i18n translation files at repo root:"
      echo "    These files belong in thefsts/Corsair-Tactical-Solutions:"
      echo "$I18N_FOUND" | sed 's/^/      /'
      echo ""
      REPO_SEPARATION_FOUND=1
    fi

    # --- Pattern 3: Corsair public image assets (repo-root public/) ---
    # The Dashboard is served from artifacts/fsts-dashboard/; a repo-root
    # public/ directory containing images is the Corsair site's static folder.
    PUBLIC_IMAGES_FOUND=$(
      echo "$ALL_FILES" | grep -E '^public/.*\.(jpg|jpeg|png|webp|gif|svg)$' || true
    )
    if [ -n "$PUBLIC_IMAGES_FOUND" ]; then
      echo "❌  CORSAIR ARTIFACT: Corsair public image assets at repo root:"
      echo "    These files belong in thefsts/Corsair-Tactical-Solutions:"
      echo "$PUBLIC_IMAGES_FOUND" | sed 's/^/      /'
      echo ""
      REPO_SEPARATION_FOUND=1
    fi

    if [ "$REPO_SEPARATION_FOUND" -eq 0 ]; then
      echo "[boundary-check] ✅  No Corsair artifacts found in this repository."
    fi
  else
    echo "[boundary-check] No tracked files found — skipping repo separation check."
  fi
else
  echo "[boundary-check] Not inside a git repository — skipping repo separation check."
fi

# ---------------------------------------------------------------------------
# 3. COMMIT IDENTITY CHECK — every commit reachable from origin/main must be
#    authored and committed by THEFSTS <amorebey@gmail.com>.
#    Reference: docs/repo-governance.md
#
#    Implementation note: this script fetches origin/main before checking so
#    the ref always reflects the actual remote state.  The check validates the
#    full published history (origin/main, not just the local outgoing range)
#    because the workspace git-sync layer (main-repl) can inject commits into
#    the local branch that are not being actively pushed by this session.
# ---------------------------------------------------------------------------
IDENTITY_FOUND=0
# Fetch the latest remote state so origin/main is current.
# GIT_TERMINAL_PROMPT=0 prevents git from hanging waiting for credentials;
# if the fetch fails (no cached auth), we fall back to the existing tracking ref.
GIT_TERMINAL_PROMPT=0 git fetch origin main 2>/dev/null || true
# Audit every commit reachable from origin/main (the full published history).
if git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
  if ! bash "$(dirname "$0")/check-commit-identity.sh" "origin/main"; then
    IDENTITY_FOUND=1
  fi
else
  # No remote-tracking ref available — fall back to outgoing range.
  if ! bash "$(dirname "$0")/check-commit-identity.sh"; then
    IDENTITY_FOUND=1
  fi
fi

# ---------------------------------------------------------------------------
# Final result
# ---------------------------------------------------------------------------
echo ""
if [ "$FOUND" -eq 0 ] && [ "$REPO_SEPARATION_FOUND" -eq 0 ] && [ "$IDENTITY_FOUND" -eq 0 ]; then
  echo "[boundary-check] ✅  All checks passed. Repository boundary is clean."
  exit 0
else
  if [ "$IDENTITY_FOUND" -ne 0 ]; then
    echo "[boundary-check] ❌  Commit identity violation(s) detected."
    echo ""
    echo "  Every outgoing commit must be authored and committed by"
    echo "  THEFSTS <amorebey@gmail.com>. See docs/repo-governance.md."
    echo ""
  fi
  if [ "$REPO_SEPARATION_FOUND" -ne 0 ]; then
    echo "[boundary-check] ❌  Repository separation violation(s) detected."
    echo ""
    echo "  Corsair website files must not be committed to this Dashboard repo."
    echo "  Move the flagged files to thefsts/Corsair-Tactical-Solutions."
    echo "  See docs/repo-governance.md for the two-repository rule."
    echo ""
  fi
  exit 1
fi
