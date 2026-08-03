/**
 * requirePermission — granular RBAC enforcement for Convex mutations
 *
 * Drop-in companion to requireSiteAccessMutation. Call at the top of any
 * mutation that needs a named permission rather than just "write access".
 *
 * SuperAdmins bypass every permission check.
 * Design-tier permissions (design.manage, layout.manage, code.manage,
 * integrations.manage, deployment.manage) are never granted to client roles,
 * so non-superAdmin callers always receive an Unauthorized error for those.
 */

import { ConvexError } from "convex/values";
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { provisionUser, type CurrentUser } from "./getCurrentUser";
import { type Permission, SUPERADMIN_ONLY_PERMISSIONS } from "./permissions";
import { roleHasPermission } from "./rolePermissions";

/**
 * Assert that the authenticated caller holds `permission` on `siteId`.
 *
 * @returns The provisioned CurrentUser on success.
 * @throws  ConvexError("Unauthorized") if the caller lacks the permission.
 *
 * Usage:
 *   const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
 */
export async function requirePermission(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  permission: Permission,
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);

  // SuperAdmins bypass all permission checks.
  if (user.isSuperAdmin) return user;

  // Design-tier permissions are superAdmin-only — reject immediately with a
  // clear message so the caller knows this isn't a misconfigured role.
  if (SUPERADMIN_ONLY_PERMISSIONS.has(permission)) {
    throw new ConvexError(
      `Forbidden: '${permission}' is restricted to FSTS administrators and cannot be performed by client users.`,
    );
  }

  // Look up this user's roles for the requested site.
  const siteRoles: Array<{ siteId: string; role: string }> =
    (user.roles ?? []).filter((r: any) => r.siteId === siteId);

  if (siteRoles.length === 0) {
    throw new ConvexError("Forbidden: you do not have access to this site.");
  }

  // Grant if any assigned role covers the permission.
  for (const { role } of siteRoles) {
    if (roleHasPermission(role, permission)) return user;
  }

  throw new ConvexError(
    `Forbidden: your role does not grant '${permission}' on this site.`,
  );
}
