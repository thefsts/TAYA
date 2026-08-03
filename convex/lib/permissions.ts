/**
 * RBAC Permission Constants — FSTS Client Dashboard
 *
 * Named permission strings used by requirePermission() on the backend
 * and mirrored in src/lib/permissions.ts on the frontend.
 *
 * Groups:
 *  content.*       — create/read/update/delete standard site content
 *  media.*         — upload and remove media assets
 *  flyers.*        — flyer lifecycle (reserved for Flyer Manager task)
 *  events.manage   — full event CRUD
 *  classes.manage  — full course/class CRUD
 *  design.*        — superAdmin-only: brand, layout, code, integrations, deployment
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

/** The set of permissions that are exclusively granted to superAdmins. */
export const SUPERADMIN_ONLY_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.DESIGN_MANAGE,
  PERMISSIONS.LAYOUT_MANAGE,
  PERMISSIONS.CODE_MANAGE,
  PERMISSIONS.INTEGRATIONS_MANAGE,
  PERMISSIONS.DEPLOYMENT_MANAGE,
]);
