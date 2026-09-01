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

// Canonical siteSettings contract. Every field written by siteSettings.ts is
// represented here. Fields are optional because settings are saved in groups
// and legacy tenants may not have every group yet.
replaceTable('siteSettings', 'navigationItems', `  siteSettings: defineTable({
    siteId: v.id("sites"),
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    websiteType: v.optional(v.string()),
    timezone: v.optional(v.string()),
    locale: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    brandColorAccent: v.optional(v.string()),
    fontHeading: v.optional(v.string()),
    fontBody: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    businessHours: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
    seoGlobalTitle: v.optional(v.string()),
    seoGlobalDescription: v.optional(v.string()),
    seoOgImageUrl: v.optional(v.string()),
    analyticsGa4: v.optional(v.string()),
    analyticsGtm: v.optional(v.string()),
    analyticsPixel: v.optional(v.string()),
    cookieConsentEnabled: v.optional(v.boolean()),
    cookiePolicyUrl: v.optional(v.string()),
    privacyPolicyUrl: v.optional(v.string()),
    termsOfServiceUrl: v.optional(v.string()),
    notificationEmail: v.optional(v.string()),
    senderName: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
    googlePlaceId: v.optional(v.string()),
    showCancelledEvents: v.optional(v.boolean()),
    identityUpdatedAt: v.optional(v.number()),
    brandingUpdatedAt: v.optional(v.number()),
    contactUpdatedAt: v.optional(v.number()),
    seoUpdatedAt: v.optional(v.number()),
    integrationsUpdatedAt: v.optional(v.number()),
    legalUpdatedAt: v.optional(v.number()),
    eventsUpdatedAt: v.optional(v.number()),
  }).index("by_site", ["siteId"]),`);

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

echo "[1/5] Preparing migration-safe complete schema contract..."
patch_schema optional
echo "[2/5] Deploying migration-safe production schema..."
pnpm exec convex deploy --yes
echo "[3/5] Backfilling activityLog.createdAt..."
pnpm exec convex run migrations/activityLogCreatedAt:backfill
echo "[4/5] Restoring strict activityLog while retaining corrected contracts..."
cp "$BACKUP_FILE" "$SCHEMA_FILE"
patch_schema strict
rm -f "$BACKUP_FILE"
trap - EXIT
echo "[5/5] Deploying corrected strict production schema..."
pnpm exec convex deploy --yes
echo "SUCCESS: production migration completed."
echo "NOTE: convex/schema.ts now contains the corrected production contract and must be committed."
