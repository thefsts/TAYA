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
BACKUP_FILE="convex/schema.ts.taya-migration-backup"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "ERROR: $SCHEMA_FILE not found. Run from /workspaces/TAYA." >&2
  exit 1
fi

cp "$SCHEMA_FILE" "$BACKUP_FILE"

cleanup_on_failure() {
  if [ -f "$BACKUP_FILE" ]; then
    mv "$BACKUP_FILE" "$SCHEMA_FILE"
  fi
}
trap cleanup_on_failure EXIT

patch_schema() {
  local activity_mode="$1"
  node - "$activity_mode" <<'NODE'
const fs = require('fs');
const mode = process.argv[2];
const path = 'convex/schema.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceTable(name, nextName, replacement) {
  const startMarker = `  ${name}: defineTable({`;
  const nextMarker = `  ${nextName}: defineTable({`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(nextMarker, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name} schema block`);
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

// Keep activityLog strict in final schema, optional only during the backfill deploy.
{
  const marker = `  activityLog: defineTable({`;
  const start = source.indexOf(marker);
  const end = source.indexOf(`  }).index("by_site", ["siteId"]),`, start);
  if (start < 0 || end < 0) throw new Error('activityLog table not found');
  let block = source.slice(start, end);
  block = block.replace('createdAt: v.optional(v.number()),', 'createdAt: v.number(),');
  if (mode === 'optional') {
    block = block.replace('createdAt: v.number(),', 'createdAt: v.optional(v.number()),');
  }
  source = source.slice(0, start) + block + source.slice(end);
}

// The active portal implementation uses the legacy/full portal account model.
// Keep both legacy and newer compatibility fields optional where appropriate so
// existing production rows remain valid while the live portal code continues to
// use firstName/lastName/status/passwordSalt safely.
replaceTable('portalUsers', 'portalSessions', `  portalUsers: defineTable({
    siteId: v.id("sites"),
    email: v.string(),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    passwordHash: v.string(),
    passwordSalt: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    failedLoginCount: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_email", ["siteId", "email"]),`);

// Active portal code currently issues opaque random session tokens and queries
// them by token. Accept the newer tokenHash field too so a later hash migration
// can be performed without another destructive schema cutover.
const sessionStart = source.indexOf('  portalSessions: defineTable({');
if (sessionStart < 0) throw new Error('portalSessions table not found');
const schemaEnd = source.lastIndexOf('\n});');
if (schemaEnd < sessionStart) throw new Error('schema end not found after portalSessions');
const portalSessionBlock = `  portalSessions: defineTable({
    siteId: v.id("sites"),
    portalUserId: v.id("portalUsers"),
    token: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    expiresAt: v.number(),
    lastActiveAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_user", ["portalUserId"])
    .index("by_token", ["token"])
    .index("by_token_hash", ["tokenHash"]),`;
source = source.slice(0, sessionStart) + portalSessionBlock + source.slice(schemaEnd);

fs.writeFileSync(path, source);
NODE
}

echo "[1/5] Preparing migration-safe activity + portal schema..."
patch_schema optional

echo "[2/5] Deploying migration-safe production schema..."
pnpm exec convex deploy --yes

echo "[3/5] Backfilling legacy activityLog.createdAt from _creationTime..."
pnpm exec convex run migrations/activityLogCreatedAt:backfill

echo "[4/5] Restoring strict activityLog.createdAt while retaining portal compatibility..."
cp "$BACKUP_FILE" "$SCHEMA_FILE"
patch_schema strict
rm -f "$BACKUP_FILE"
trap - EXIT

echo "[5/5] Deploying corrected strict production schema..."
pnpm exec convex deploy --yes

echo "SUCCESS: activityLog backfill completed; strict activity schema restored; portal schema aligned with active portal code."
echo "NOTE: convex/schema.ts now contains the corrected portal compatibility schema and should be committed to main."
