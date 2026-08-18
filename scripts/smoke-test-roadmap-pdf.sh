#!/usr/bin/env bash
# smoke-test-roadmap-pdf.sh
#
# Confirms the roadmap PDF generator works end-to-end when a new category is
# added to roadmap-data.json.
#
# Steps:
#   1. Back up roadmap-data.json
#   2. Inject a throwaway category
#   3. Run generate-roadmap-pdf.mjs
#   4. Verify the output PDF is > 10 KB (not empty / corrupt)
#   5. Restore roadmap-data.json and clean up the PDF
#
# Exits non-zero on any failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_FILE="$SCRIPT_DIR/roadmap-data.json"
BACKUP_FILE="$SCRIPT_DIR/roadmap-data.json.smoke-backup"
OUT_PDF="$(cd "$SCRIPT_DIR/.." && pwd)/artifacts/fsts-dashboard/public/fsts-dashboard-roadmap.pdf"
MIN_PDF_BYTES=10240  # 10 KB

CHROMIUM="/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium"
PDF_BACKUP_FILE="${OUT_PDF}.smoke-backup"

# ── Pre-flight: Chromium must exist ──────────────────────────────────────────
if [ ! -f "$CHROMIUM" ]; then
  echo "[smoke-roadmap-pdf] ⚠  Chromium not found at expected path — skipping smoke test."
  echo "  Path: $CHROMIUM"
  echo "  Update CHROMIUM in scripts/generate-roadmap-pdf.mjs and this script when the"
  echo "  Nix store path changes."
  exit 0
fi

# ── Cleanup trap ─────────────────────────────────────────────────────────────
cleanup() {
  # Restore roadmap-data.json
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$DATA_FILE"
    rm -f "$BACKUP_FILE"
    echo "[smoke-roadmap-pdf] ✓ roadmap-data.json restored."
  fi
  # Restore the real PDF (so the smoke-test PDF doesn't linger until post-merge)
  if [ -f "$PDF_BACKUP_FILE" ]; then
    cp "$PDF_BACKUP_FILE" "$OUT_PDF"
    rm -f "$PDF_BACKUP_FILE"
    echo "[smoke-roadmap-pdf] ✓ fsts-dashboard-roadmap.pdf restored."
  elif [ -f "$OUT_PDF" ]; then
    # No pre-existing PDF — remove the smoke-test artefact entirely
    rm -f "$OUT_PDF"
    echo "[smoke-roadmap-pdf] ✓ Smoke-test PDF removed (no prior PDF to restore)."
  fi
}
trap cleanup EXIT

# ── Step 1: Back up the data file and current PDF ────────────────────────────
echo "[smoke-roadmap-pdf] Backing up roadmap-data.json…"
cp "$DATA_FILE" "$BACKUP_FILE"

# Back up the existing PDF (if any) so the cleanup trap can restore it exactly.
if [ -f "$OUT_PDF" ]; then
  cp "$OUT_PDF" "$PDF_BACKUP_FILE"
fi

# ── Step 2: Inject a throwaway smoke-test category ───────────────────────────
# Use node to parse + mutate the JSON safely so we don't break existing content.
echo "[smoke-roadmap-pdf] Injecting throwaway smoke-test category…"
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const scriptDir = process.argv[1]
  ? dirname(process.argv[1])
  // __dirname equivalent for stdin-mode: cwd
  : process.cwd();

const DATA_FILE = resolve(process.cwd(), "scripts/roadmap-data.json");
const data = JSON.parse(readFileSync(DATA_FILE, "utf8"));

const smokeCategory = {
  id: "__smoke_test__",
  title: "Smoke Test Category (auto-removed)",
  color: "#334155",
  lightColor: "#f1f5f9",
  borderColor: "#cbd5e1",
  items: [
    {
      id: 99901,
      wave: 1,
      priority: "P2",
      tags: ["Smoke", "Test"],
      what: "Temporary smoke-test item — auto-removed after PDF generation check",
      why: "Verifies that adding a new category to roadmap-data.json produces a valid PDF.",
    },
  ],
};

data.categories.push(smokeCategory);
writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("[smoke-roadmap-pdf] Throwaway category injected.");
EOF

# ── Step 3: Run the PDF generator ────────────────────────────────────────────
echo "[smoke-roadmap-pdf] Running generate-roadmap-pdf.mjs…"
if ! node "$SCRIPT_DIR/generate-roadmap-pdf.mjs"; then
  echo "[smoke-roadmap-pdf] ❌  PDF generator exited with an error." >&2
  exit 1
fi

# ── Step 4: Verify output PDF size ───────────────────────────────────────────
if [ ! -f "$OUT_PDF" ]; then
  echo "[smoke-roadmap-pdf] ❌  Output PDF not found at: $OUT_PDF" >&2
  exit 1
fi

PDF_BYTES=$(wc -c < "$OUT_PDF")
PDF_KB=$(( PDF_BYTES / 1024 ))

if [ "$PDF_BYTES" -lt "$MIN_PDF_BYTES" ]; then
  echo "[smoke-roadmap-pdf] ❌  PDF is only ${PDF_KB} KB — expected > 10 KB." >&2
  echo "  This usually means Chromium produced an empty or corrupt file." >&2
  exit 1
fi

echo "[smoke-roadmap-pdf] ✅  PDF OK — ${PDF_KB} KB (minimum 10 KB)."

# cleanup trap runs here: restores roadmap-data.json and removes the backup.
# The generated PDF is intentionally left in place so the file is always fresh.
