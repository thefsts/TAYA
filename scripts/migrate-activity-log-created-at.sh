#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "ERROR: CONVEX_DEPLOY_KEY is not set." >&2
  exit 1
fi

case "$CONVEX_DEPLOY_KEY" in
  prod:uncommon-cobra-336\|*) ;;
  *) echo "ERROR: wrong production deploy key." >&2; exit 1 ;;
esac

SCHEMA_FILE="convex/schema.ts"
BACKUP_FILE="convex/schema.ts.taya-migration-backup"
cp "$SCHEMA_FILE" "$BACKUP_FILE"
restore_schema() { [ ! -f "$BACKUP_FILE" ] || mv "$BACKUP_FILE" "$SCHEMA_FILE"; }
trap restore_schema EXIT

patch_schema() {
  local activity_mode="$1"
  node - "$activity_mode" <<'NODE'
const fs = require('fs');
const mode = process.argv[2];
const path = 'convex/schema.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceTable(name, nextName, replacement) {
  const start = source.indexOf(`  ${name}: defineTable({`);
  const end = source.indexOf(`  ${nextName}: defineTable({`, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name}`);
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

{
  const start = source.indexOf('  activityLog: defineTable({');
  const end = source.indexOf('  }).index("by_site", ["siteId"]),', start);
  if (start < 0 || end < 0) throw new Error('activityLog not found');
  let block = source.slice(start, end);
  block = block.replace('createdAt: v.optional(v.number()),', 'createdAt: v.number(),');
  if (mode === 'optional') block = block.replace('createdAt: v.number(),', 'createdAt: v.optional(v.number()),');
  source = source.slice(0, start) + block + source.slice(end);
}

{
  const start = source.indexOf('  siteSettings: defineTable({');
  const end = source.indexOf('  }).index("by_site", ["siteId"]),', start);
  if (start < 0 || end < 0) throw new Error('siteSettings not found');
  let block = source.slice(start, end);
  if (!block.includes('websiteType:')) {
    block = block.replace(
      '    faviconUrl: v.optional(v.string()),',
      '    faviconUrl: v.optional(v.string()),\n    websiteType: v.optional(v.string()),'
    );
  }
  source = source.slice(0, start) + block + source.slice(end);
}

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

const sessionStart = source.indexOf('  portalSessions: defineTable({');
const schemaEnd = source.lastIndexOf('\n});');
if (sessionStart < 0 || schemaEnd < sessionStart) throw new Error('portalSessions not found');
const sessions = `  portalSessions: defineTable({
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
source = source.slice(0, sessionStart) + sessions + source.slice(schemaEnd);
fs.writeFileSync(path, source);
NODE
}

echo "[1/5] Preparing migration-safe schema..."
patch_schema optional
echo "[2/5] Deploying migration-safe production schema..."
pnpm exec convex deploy --yes
echo "[3/5] Backfilling activityLog.createdAt..."
pnpm exec convex run migrations/activityLogCreatedAt:backfill
echo "[4/5] Restoring strict activityLog schema..."
cp "$BACKUP_FILE" "$SCHEMA_FILE"
patch_schema strict
rm -f "$BACKUP_FILE"
trap - EXIT
echo "[5/5] Deploying corrected strict production schema..."
pnpm exec convex deploy --yes
echo "SUCCESS: production migration completed."
