#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set." >&2
  exit 1
fi

case "$CONVEX_DEPLOY_KEY" in
  prod:uncommon-cobra-336\|*) ;;
  *)
    echo "ERROR: CONVEX_DEPLOY_KEY is not for TAYA production uncommon-cobra-336." >&2
    exit 1
    ;;
esac

SCHEMA_FILE="convex/schema.ts"
BACKUP_FILE="convex/schema.ts.createdAt-migration-backup"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "ERROR: $SCHEMA_FILE not found. Run from /workspaces/TAYA." >&2
  exit 1
fi

cp "$SCHEMA_FILE" "$BACKUP_FILE"
restore_schema() {
  if [ -f "$BACKUP_FILE" ]; then
    mv "$BACKUP_FILE" "$SCHEMA_FILE"
  fi
}
trap restore_schema EXIT

node <<'NODE'
const fs = require('fs');
const path = 'convex/schema.ts';
const source = fs.readFileSync(path, 'utf8');
const marker = `  activityLog: defineTable({`;
const start = source.indexOf(marker);
if (start < 0) throw new Error('activityLog table not found in schema.ts');
const end = source.indexOf(`  }).index("by_site", ["siteId"]),`, start);
if (end < 0) throw new Error('activityLog table end not found in schema.ts');
const block = source.slice(start, end);
if (!block.includes('createdAt: v.number(),')) {
  throw new Error('Expected required activityLog createdAt field was not found. Refusing to modify schema.');
}
const patchedBlock = block.replace('createdAt: v.number(),', 'createdAt: v.optional(v.number()),');
fs.writeFileSync(path, source.slice(0, start) + patchedBlock + source.slice(end));
NODE

echo "[1/4] Deploying migration-safe schema (activityLog.createdAt optional)..."
pnpm exec convex deploy --yes

echo "[2/4] Backfilling legacy activityLog.createdAt from _creationTime..."
pnpm exec convex run migrations/activityLogCreatedAt:backfill

echo "[3/4] Restoring strict schema (activityLog.createdAt required)..."
restore_schema
trap - EXIT

echo "[4/4] Deploying strict production schema..."
pnpm exec convex deploy --yes

echo "SUCCESS: activityLog.createdAt migration completed and strict schema restored."
