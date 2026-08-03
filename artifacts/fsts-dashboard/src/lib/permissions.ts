/**
 * RBAC Permission Constants — frontend mirror
 *
 * Mirrors convex/lib/permissions.ts so the UI and backend share the same
 * permission vocabulary. Import from here in React components; import from
 * convex/lib/permissions.ts in Convex functions.
 *
 * Do NOT diverge these two files. If you add a constant here, add it there too.
 */

export const PERMISSIONS = {
  // ── Content ──────────────────────────────────────────────────────────────
  CONTENT_VIEW:   "content.view",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",

  // ── Media ─────────────────────────────────────────────────────────────────
  MEDIA_VIEW:   "media.view",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",

  // ── Flyers (reserved) ─────────────────────────────────────────────────────
  FLYERS_CREATE:  "flyers.create",
  FLYERS_UPDATE:  "flyers.update",
  FLYERS_PUBLISH: "flyers.publish",
  FLYERS_ARCHIVE: "flyers.archive",

  // ── Scheduling ────────────────────────────────────────────────────────────
  EVENTS_MANAGE:  "events.manage",
  CLASSES_MANAGE: "classes.manage",

  // ── Design tier (superAdmin-only) ─────────────────────────────────────────
  DESIGN_MANAGE:       "design.manage",
  LAYOUT_MANAGE:       "layout.manage",
  CODE_MANAGE:         "code.manage",
  INTEGRATIONS_MANAGE: "integrations.manage",
  DEPLOYMENT_MANAGE:   "deployment.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Permissions that only superAdmins receive. Used to drive UI lock indicators. */
export const SUPERADMIN_ONLY_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.DESIGN_MANAGE,
  PERMISSIONS.LAYOUT_MANAGE,
  PERMISSIONS.CODE_MANAGE,
  PERMISSIONS.INTEGRATIONS_MANAGE,
  PERMISSIONS.DEPLOYMENT_MANAGE,
]);

/**
 * Returns true if the current user (identified by isSuperAdmin flag) has
 * the given permission. Client roles never receive design-tier permissions.
 *
 * For more granular UI guards that also consult the role matrix, use the
 * roleCapabilities helpers or the Convex `requirePermission` server check.
 */
export function userHasPermission(isSuperAdmin: boolean, permission: Permission): boolean {
  if (isSuperAdmin) return true;
  return !SUPERADMIN_ONLY_PERMISSIONS.has(permission);
}
