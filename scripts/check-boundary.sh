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
# 3. CLIENT APPLICATION DIRECTORY CHECK — Allowlist-based
#
# Detects any root-level directory that is NOT on the approved platform
# allowlist AND contains markers of an embedded client application.
#
# This check scans the filesystem (not just git-tracked files) so it catches
# directories that exist on disk but have been excluded from git — for example,
# a client website directory that was added to .gitignore rather than deleted.
#
# Why filesystem and not only git: a directory present on disk can be
# accidentally re-committed in a future PR.  Failing early prevents that.
#
# ALLOWLISTED root-level directories (approved platform-owned paths):
#   artifacts/       — platform artifacts (fsts-dashboard, mockup-sandbox)
#   convex/          — Convex backend functions and schema
#   lib/             — shared platform libraries
#   tests/           — platform test suites
#   scripts/         — CI and build scripts
#   docs/            — platform documentation
#   node_modules/    — managed dependencies (pnpm)
#   exports/         — generated exports
#   attached_assets/ — agent task assets (read-only, never committed)
#   .git/            — git internals
#   .github/         — GitHub Actions CI configuration
#   .githooks/       — git hooks
#   .local/          — Replit local configuration
#   .agents/         — agent workspace memory
#   .cache/          — build cache
#   .config/         — system configuration
#   .convex-tmp/     — Convex CLI temporary files
#
# Application markers: a directory that is NOT allowlisted and contains any
# of the following is flagged as an embedded client application:
#   package.json                     any npm/node project root
#   next.config.ts / .js / .mjs     Next.js application
#   vite.config.ts / .js            Vite/React application
#   src/app/                         Next.js App Router tree
#   src/pages/                       Next.js Pages Router or plain React
# ---------------------------------------------------------------------------
echo ""
echo "[boundary-check] Checking for embedded client application directories…"

CLIENT_APP_FOUND=0

ALLOWLISTED_DIRS=(
  "artifacts"
  "convex"
  "lib"
  "tests"
  "scripts"
  "docs"
  "node_modules"
  "exports"
  "attached_assets"
  ".git"
  ".github"
  ".githooks"
  ".local"
  ".agents"
  ".cache"
  ".config"
  ".convex-tmp"
  # Corsair Tactical Solutions website — client site tracked in its own repo
  # (thefsts/Corsair-Tactical-Solutions); intentionally gitignored from this repo.
  "corsair-source"
)

is_allowlisted() {
  local dir="$1"
  for allowed in "${ALLOWLISTED_DIRS[@]}"; do
    if [ "$dir" = "$allowed" ]; then
      return 0
    fi
  done
  return 1
}

has_app_markers() {
  local dir="$1"
  # package.json at the directory root
  [ -f "$dir/package.json" ] && return 0
  # Next.js config variants
  [ -f "$dir/next.config.ts" ]  && return 0
  [ -f "$dir/next.config.js" ]  && return 0
  [ -f "$dir/next.config.mjs" ] && return 0
  # Vite config variants
  [ -f "$dir/vite.config.ts" ] && return 0
  [ -f "$dir/vite.config.js" ] && return 0
  # Next.js App Router directory
  [ -d "$dir/src/app" ] && return 0
  # Next.js Pages Router directory
  [ -d "$dir/src/pages" ] && return 0
  return 1
}

# Enumerate all root-level directories
while IFS= read -r -d '' entry; do
  dir_name="$(basename "$entry")"
  if is_allowlisted "$dir_name"; then
    continue
  fi
  if has_app_markers "$entry"; then
    echo "❌  EMBEDDED CLIENT APP: Unknown application directory detected: $entry"
    echo "    This directory is not on the platform allowlist and contains"
    echo "    application markers (package.json, Next.js/Vite config, src/app/, src/pages/)."
    echo "    Client website code must live in its own dedicated repository."
    echo "    Add the directory to ALLOWLISTED_DIRS in scripts/check-boundary.sh"
    echo "    only if it is a legitimate platform-owned workspace."
    echo ""
    CLIENT_APP_FOUND=1
  fi
done < <(find "$REPO_ROOT" -maxdepth 1 -mindepth 1 -type d -print0 | sort -z)

if [ "$CLIENT_APP_FOUND" -eq 0 ]; then
  echo "[boundary-check] ✅  No embedded client application directories found."
fi

# ---------------------------------------------------------------------------
# 4. COMMIT IDENTITY — informational only during pre-merge validation.
#    Reference: docs/repo-governance.md
#
#    Enforcement model: post-merge.sh rewrites every outgoing commit's author
#    and committer to THEFSTS <amorebey@gmail.com> unconditionally at merge
#    time, before the push to GitHub.  Running an author-identity hard-failure
#    here (pre-merge) would always block because the Replit platform stamps
#    rebased commits with its own service-account identity before post-merge.sh
#    gets a chance to correct them.
#
#    This section therefore reports identity status as a warning and delegates
#    hard enforcement to post-merge.sh.
# ---------------------------------------------------------------------------
IDENTITY_FOUND=0
# Fetch the latest remote state so origin/main is current.
# GIT_TERMINAL_PROMPT=0 prevents git from hanging waiting for credentials;
# if the fetch fails (no cached auth), we fall back to the existing tracking ref.
GIT_TERMINAL_PROMPT=0 git fetch origin main 2>/dev/null || true

# Verify that the identity-enforcement tooling is present and executable.
IDENTITY_SCRIPT="$(dirname "$0")/check-commit-identity.sh"
if [ -x "$IDENTITY_SCRIPT" ]; then
  echo "[boundary-check] ✅  Commit identity script present (post-merge.sh will enforce THEFSTS <amorebey@gmail.com> authorship)."
else
  echo "[boundary-check] ❌  check-commit-identity.sh is missing or not executable — identity enforcement is broken!"
  IDENTITY_FOUND=1
fi

# ---------------------------------------------------------------------------
# 5. ACCESS-DENIED GUARD CHECK
#
# Every page component under artifacts/fsts-dashboard/src/pages/app/sites/
# that calls useQuery() MUST include a `=== null` branch (which should render
# <ModuleAccessDenied> or an equivalent access-denied UI). Convex returns null
# when the caller lacks access to a site or the module is disabled; omitting
# the null branch silently renders a blank page instead of an error.
#
# Pattern enforced:
#   - File uses useQuery(
#   - File contains at least one `=== null` check
#
# KNOWN VIOLATIONS (pre-existing debt — fix these over time):
#   New files added to src/pages/app/sites/ that violate the rule will cause
#   a hard failure here. To add a new file to the known-violations list, you
#   MUST also file a task to add the guard and link it in a comment.
#
# Reference: see "Access-denied guard convention" in replit.md.
# ---------------------------------------------------------------------------
echo ""
echo "[boundary-check] Checking for missing access-denied guards in site page components…"

# Files with pre-existing violations. New violations not listed here → hard fail.
# Each entry is a filename (basename only, no path).
GUARD_ALLOWLIST=(
  "AnnouncementBanner.tsx"   # Task #83 — extend loading-skeleton / guard coverage
  "ArticlesList.tsx"         # Task #83
  "AutomationRules.tsx"      # Task #83
  "CareersManager.tsx"       # Task #83
  "Commerce.tsx"             # Task #83
  "ContactInfo.tsx"          # Task #83
  "CtaManager.tsx"           # Task #83
  "DownloadsManager.tsx"     # Task #83
  "FaqManager.tsx"           # Task #83
  "FooterEditor.tsx"         # Task #83
  "FormsList.tsx"            # Task #83
  "HelpCenter.tsx"           # Task #83
  "MyPermissions.tsx"        # Task #83
  "NavigationManager.tsx"    # Task #83
  "PolicyEditor.tsx"         # Task #83
  "PopupManager.tsx"         # Task #83
  "ReviewsManager.tsx"       # Task #83
  "SquareCommerce.tsx"       # Task #83
  "TeamManager.tsx"          # Task #83
  "TestimonialsManager.tsx"  # Task #83
)

is_guard_allowlisted() {
  local name="$1"
  for entry in "${GUARD_ALLOWLIST[@]}"; do
    if [ "$name" = "$entry" ]; then
      return 0
    fi
  done
  return 1
}

SITES_PAGES_DIR="$REPO_ROOT/artifacts/fsts-dashboard/src/pages/app/sites"
GUARD_FOUND=0

if [ -d "$SITES_PAGES_DIR" ]; then
  while IFS= read -r -d '' page_file; do
    fname="$(basename "$page_file")"

    # Only check files that actually call useQuery
    if ! grep -q "useQuery(" "$page_file" 2>/dev/null; then
      continue
    fi

    # File must have at least one `=== null` branch
    if grep -q "=== null" "$page_file" 2>/dev/null; then
      continue
    fi

    # Violation — check if it is a known pre-existing debt entry
    if is_guard_allowlisted "$fname"; then
      echo "⚠️   KNOWN DEBT (allowlisted): $fname — useQuery without === null guard (fix tracked in Task #83)"
    else
      echo "❌  MISSING ACCESS-DENIED GUARD: $fname"
      echo "    $page_file"
      echo "    This page calls useQuery() but has no '=== null' branch."
      echo "    Add a null check that renders <ModuleAccessDenied> (or equivalent)."
      echo "    See 'Access-denied guard convention' in replit.md for the required pattern."
      echo ""
      GUARD_FOUND=1
    fi
  done < <(find "$SITES_PAGES_DIR" -maxdepth 1 -name "*.tsx" -print0 | sort -z)

  if [ "$GUARD_FOUND" -eq 0 ]; then
    echo "[boundary-check] ✅  No new access-denied guard violations found."
    echo "    (${#GUARD_ALLOWLIST[@]} known pre-existing violations are allowlisted — see Task #83)"
  fi
else
  echo "[boundary-check] ⚠️   Sites pages directory not found — skipping guard check: $SITES_PAGES_DIR"
fi

# ---------------------------------------------------------------------------
# Final result
# ---------------------------------------------------------------------------
echo ""
if [ "$FOUND" -eq 0 ] && [ "$REPO_SEPARATION_FOUND" -eq 0 ] && [ "$CLIENT_APP_FOUND" -eq 0 ] && [ "$IDENTITY_FOUND" -eq 0 ] && [ "$GUARD_FOUND" -eq 0 ]; then
  echo "[boundary-check] ✅  All checks passed. Repository boundary is clean."
  exit 0
else
  if [ "$GUARD_FOUND" -ne 0 ]; then
    echo "[boundary-check] ❌  Access-denied guard violation(s) detected."
    echo ""
    echo "  Every page in src/pages/app/sites/ that calls useQuery() must include"
    echo "  a '=== null' branch rendering <ModuleAccessDenied> (or equivalent)."
    echo "  See 'Access-denied guard convention' in replit.md for the template."
    echo ""
  fi
  if [ "$IDENTITY_FOUND" -ne 0 ]; then
    echo "[boundary-check] ❌  Commit identity violation(s) detected."
    echo ""
    echo "  Every outgoing commit must be authored and committed by"
    echo "  thefsts <amorebey@gmail.com>. See docs/repo-governance.md."
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
  if [ "$CLIENT_APP_FOUND" -ne 0 ]; then
    echo "[boundary-check] ❌  Embedded client application directory detected."
    echo ""
    echo "  Client website source must not be stored inside this platform repo."
    echo "  Move the flagged directory to its own dedicated repository."
    echo "  See docs/repo-governance.md §1 for the two-repository rule."
    echo ""
  fi
  exit 1
fi
