import { type Role } from "./roleCapabilities";
import { PERMISSIONS, type Permission } from "./permissions";

export type RolePermissionMap = Record<Role, readonly Permission[]>;

const CONTENT_ALL: readonly Permission[] = [
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.CONTENT_DELETE,
];
const CONTENT_VIEW_ONLY: readonly Permission[] = [PERMISSIONS.CONTENT_VIEW];
const MEDIA_ALL: readonly Permission[] = [
  PERMISSIONS.MEDIA_VIEW,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_DELETE,
];
const MEDIA_VIEW_ONLY: readonly Permission[] = [PERMISSIONS.MEDIA_VIEW];
const FLYERS_ALL: readonly Permission[] = [
  PERMISSIONS.FLYERS_CREATE,
  PERMISSIONS.FLYERS_UPDATE,
  PERMISSIONS.FLYERS_PUBLISH,
  PERMISSIONS.FLYERS_ARCHIVE,
];

export const ROLE_PERMISSIONS: RolePermissionMap = {
  owner: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.CLASSES_MANAGE],
  manager: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.CLASSES_MANAGE],
  marketing: [
    PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.MEDIA_VIEW, PERMISSIONS.MEDIA_UPLOAD, ...FLYERS_ALL,
  ],
  content_editor: [...CONTENT_ALL, ...MEDIA_ALL],
  course_manager: [PERMISSIONS.CONTENT_VIEW, PERMISSIONS.MEDIA_VIEW, PERMISSIONS.CLASSES_MANAGE],
  events_manager: [PERMISSIONS.CONTENT_VIEW, PERMISSIONS.MEDIA_VIEW, PERMISSIONS.EVENTS_MANAGE],
  finance: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
  support: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
  read_only: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
};

/**
 * Non-client operational roles and legacy role strings.
 * internal_qa is intentionally owner-equivalent for client-facing workflow
 * testing while remaining a distinct role in the user/audit record. It does
 * not receive any SUPERADMIN_ONLY permission and therefore cannot bypass the
 * Global Design Lock or platform administration boundaries.
 */
const LEGACY_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  internal_qa: [
    ...CONTENT_ALL,
    ...MEDIA_ALL,
    ...FLYERS_ALL,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.CLASSES_MANAGE,
  ],
  client_admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.CLASSES_MANAGE],
  site_admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.CLASSES_MANAGE],
  admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.CLASSES_MANAGE],
  editor: [...CONTENT_ALL, ...MEDIA_ALL],
  marketing_manager: [
    PERMISSIONS.CONTENT_VIEW, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.MEDIA_VIEW, PERMISSIONS.MEDIA_UPLOAD, ...FLYERS_ALL,
  ],
  training_manager: [PERMISSIONS.CONTENT_VIEW, PERMISSIONS.MEDIA_VIEW, PERMISSIONS.CLASSES_MANAGE],
};

export function roleHasPermission(role: string, permission: Permission): boolean {
  const granted: readonly Permission[] | undefined =
    ROLE_PERMISSIONS[role as Role] ?? LEGACY_ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return (granted as readonly string[]).includes(permission);
}
