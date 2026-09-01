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
[ -f "$SCHEMA_FILE" ] || { echo "ERROR: $SCHEMA_FILE not found." >&2; exit 1; }
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
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name} before ${nextName}`);
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

// Preserve the full production schema while adding the four Clerk invitation
// metadata fields introduced after the last complete schema snapshot.
{
  const start = source.indexOf('  users: defineTable({');
  const end = source.indexOf('  homepageContent: defineTable({', start);
  if (start < 0 || end < 0) throw new Error('users not found');
  let block = source.slice(start, end);
  if (!block.includes('inviteStatus:')) {
    block = block.replace(
      '    // Phase 10 — Agency Edition™',
      '    // Clerk invitation metadata. No invitation secret is persisted in Convex.\n    inviteStatus: v.optional(v.string()),\n    invitedAt: v.optional(v.number()),\n    clerkInvitationId: v.optional(v.string()),\n    invitationLastError: v.optional(v.string()),\n    // Phase 10 — Agency Edition™'
    );
  }
  source = source.slice(0, start) + block + source.slice(end);
}

// Keep both historical heroStorageId and the current derivative fields so
// existing media records and the current media pipeline validate together.
{
  const start = source.indexOf('  mediaAssets: defineTable({');
  const end = source.indexOf('  squareConfig: defineTable({', start);
  if (start < 0 || end < 0) throw new Error('mediaAssets not found');
  let block = source.slice(start, end);
  if (!block.includes('large2xStorageId:')) {
    block = block.replace(
      '    heroStorageId: v.optional(v.id("_storage")),',
      '    heroStorageId: v.optional(v.id("_storage")),\n    large2xStorageId: v.optional(v.id("_storage")),\n    derivativesGeneratedAt: v.optional(v.number()),\n    processingStatus: v.optional(v.string()),\n    processingError: v.optional(v.string()),'
    );
  }
  source = source.slice(0, start) + block + source.slice(end);
}

// Legacy activity rows predate createdAt. Make it optional for the first deploy,
// backfill from Convex _creationTime, then require it in the final schema.
{
  const start = source.indexOf('  activityLog: defineTable({');
  const end = source.indexOf('  }).index("by_site", ["siteId"]),', start);
  if (start < 0 || end < 0) throw new Error('activityLog not found');
  let block = source.slice(start, end);
  if (!block.includes('createdAt:')) {
    block = block.replace(
      '    details: v.optional(v.string()),',
      '    details: v.optional(v.string()),\n    createdAt: v.number(),'
    );
  }
  block = block.replace('createdAt: v.optional(v.number()),', 'createdAt: v.number(),');
  if (mode === 'optional') block = block.replace('createdAt: v.number(),', 'createdAt: v.optional(v.number()),');
  source = source.slice(0, start) + block + source.slice(end);
}

// Canonical Website Settings contract. All fields are optional because settings
// are saved in independent groups and legacy tenants may not have every group.
replaceTable('siteSettings', 'siteRoleOverrides', `  siteSettings: defineTable({
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

// Portal compatibility: preserve fields written by the active portal code while
// accepting legacy rows created by earlier portal implementations.
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
    notes: v.optional(v.string()),
    profileData: v.optional(v.any()),
    failedLoginCount: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_email", ["siteId", "email"])
    .index("by_email", ["email"]),`);

replaceTable('portalSessions', 'onboardingProgress', `  portalSessions: defineTable({
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
    .index("by_token_hash", ["tokenHash"]),`);

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
