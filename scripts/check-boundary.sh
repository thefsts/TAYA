#!/usr/bin/env bash
# check-boundary.sh — Product boundary enforcement for FSTS-WOS™
#
# Scans source files for terms that signal Operon CRM™ features being built
# inside the FSTS-WOS™ codebase. Exits non-zero if any match is found.
#
# Reference: docs/product-boundaries.md §2.1
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
  exit 0
else
  echo "[boundary-check] ❌  Product boundary violation(s) detected."
  echo ""
  echo "  The matched terms belong in Operon CRM™, not FSTS-WOS™."
  echo "  See docs/product-boundaries.md §2.1 for the full exclusion list."
  echo "  To mark a file as boundary-safe, add it to the exclusion list in"
  echo "  scripts/check-boundary.sh with a comment explaining why it is safe."
  echo ""
  exit 1
fi
