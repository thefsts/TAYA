/**
 * Role → Permission mapping
 *
 * Defines which named permissions each site role is granted.
 * SuperAdmins bypass this table entirely (they pass every check).
 *
 * Design-tier permissions (design.manage, layout.manage, code.manage,
 * integrations.manage, deployment.manage) are NOT listed for any client
 * role — they are superAdmin-only and enforced by SUPERADMIN_ONLY_PERMISSIONS.
 */

import { type Role } from "./roleCapabilities";
import { PERMISSIONS, type Permission } from "./permissions";

export type RolePermissionMap = Record<Role, readonly Permission[]>;

const CONTENT_ALL: readonly Permission[] = [
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.CONTENT_DELETE,
];

const CONTENT_VIEW_ONLY: readonly Permission[] = [
  PERMISSIONS.CONTENT_VIEW,
];

const MEDIA_ALL: readonly Permission[] = [
  PERMISSIONS.MEDIA_VIEW,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_DELETE,
];

const MEDIA_VIEW_ONLY: readonly Permission[] = [
  PERMISSIONS.MEDIA_VIEW,
];

const FLYERS_ALL: readonly Permission[] = [
  PERMISSIONS.FLYERS_CREATE,
  PERMISSIONS.FLYERS_UPDATE,
  PERMISSIONS.FLYERS_PUBLISH,
  PERMISSIONS.FLYERS_ARCHIVE,
];

export const ROLE_PERMISSIONS: RolePermissionMap = {
  /**
   * Owner — full control over all content, media, flyers, events, and courses.
   * Does NOT receive design-tier permissions (those remain superAdmin-only).
   */
  owner: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],

  /**
   * Manager — same as owner for content purposes.
   */
  manager: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],

  /**
   * Marketing — can create and update content and upload media,
   * but cannot permanently delete content or media.
   */
  marketing: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.MEDIA_UPLOAD,
    ...FLYERS_ALL,
  ],

  /**
   * Content Editor — full content and media CRUD, no scheduling.
   */
  content_editor: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
  ],

  /**
   * Course Manager — manages courses/classes and can view media.
   */
  course_manager: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.CLASSES_MANAGE,
  ],

  /**
   * Events Manager — manages events and can view media.
   */
  events_manager: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ],

  /**
   * Finance — read-only across content and media; no writes.
   */
  finance: [
    ...CONTENT_VIEW_ONLY,
    ...MEDIA_VIEW_ONLY,
  ],

  /**
   * Support — read-only across content and media; no writes.
   */
  support: [
    ...CONTENT_VIEW_ONLY,
    ...MEDIA_VIEW_ONLY,
  ],

  /**
   * Read Only — view everything, change nothing.
   */
  read_only: [
    ...CONTENT_VIEW_ONLY,
    ...MEDIA_VIEW_ONLY,
  ],
};

/**
 * Legacy role → permission mapping.
 *
 * These role strings existed before Phase 9 and are kept in WRITE_ROLES
 * in requireSiteAccess.ts for site-membership checks. They must also pass
 * requirePermission so existing user assignments are not silently broken.
 *
 * Mapping intent:
 *   client_admin / site_admin / admin → full owner-equivalent write access
 *   editor                           → content_editor-equivalent
 *   marketing_manager                → marketing-equivalent
 *   training_manager                 → course_manager-equivalent
 */
const LEGACY_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  client_admin: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],
  site_admin: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],
  admin: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],
  editor: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
  ],
  marketing_manager: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.MEDIA_UPLOAD,
    ...FLYERS_ALL,
  ],
  training_manager: [
    PERMISSIONS.CONTENT_VIEW,
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.CLASSES_MANAGE,
  ],
};

/**
 * Returns true if the given role has been granted the requested permission.
 * SuperAdmin bypass is handled in requirePermission — do not call this for
 * superAdmin users.
 *
 * Checks current Phase 9 roles first, then falls back to legacy role grants
 * so existing user assignments continue to work.
 */
export function roleHasPermission(role: string, permission: Permission): boolean {
  const granted: readonly Permission[] | undefined =
    ROLE_PERMISSIONS[role as Role] ?? LEGACY_ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return (granted as readonly string[]).includes(permission);
}
