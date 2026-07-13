import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { CurrentUser, provisionUser } from "./getCurrentUser";
import {
  ROLE_CAPABILITIES,
  type Role,
  type DashboardModule,
  type PermissionLevel,
  PERMISSION_LEVELS,
} from "./roleCapabilities";

/**
 * All roles that can perform write mutations on a site by default.
 * Legacy roles kept for backward compat; new Phase 9 roles derived from
 * the capability matrix (any role with at least one edit/manage module).
 */
const WRITE_ROLES = new Set([
  // Legacy roles
  "client_admin",
  "site_admin",
  "admin",
  "editor",
  "content_editor",
  "manager",
  "marketing_manager",
  "training_manager",
  // Phase 9 roles with write capabilities
  "owner",
  "marketing",
  "course_manager",
  "events_manager",
  "finance",
  "support",
]);

function permissionAtLeast(a: PermissionLevel, b: PermissionLevel): boolean {
  return PERMISSION_LEVELS.indexOf(a) >= PERMISSION_LEVELS.indexOf(b);
}

/**
 * Look up effective permission level for a user role on a module,
 * accounting for any site-level overrides.
 */
async function effectiveLevel(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  role: string,
  module: DashboardModule,
): Promise<PermissionLevel> {
  const overrideRows = await ctx.db
    .query("siteRoleOverrides")
    .withIndex("by_site_role", (q) => q.eq("siteId", siteId).eq("role", role))
    .collect();
  const override = overrideRows.find((r) => r.module === module);
  if (override) return override.level as PermissionLevel;
  const caps = ROLE_CAPABILITIES[role as Role];
  if (!caps) return "none";
  return caps[module] ?? "none";
}

export async function checkSiteAccess(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user || !user.isActive) return false;
  if (user.isSuperAdmin) return true;
  return user.roles.some((r: any) => r.siteId === siteId);
}

/**
 * Check if the authenticated user has at least `requiredLevel` access to
 * a specific module on a site. Superadmins always pass.
 */
export async function checkModuleAccess(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  module: DashboardModule,
  requiredLevel: PermissionLevel = "view",
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user || !user.isActive) return false;
  if (user.isSuperAdmin) return true;
  const siteRoles = user.roles.filter((r: any) => r.siteId === siteId);
  if (siteRoles.length === 0) return false;
  for (const r of siteRoles) {
    const level = await effectiveLevel(ctx, siteId, r.role, module);
    if (permissionAtLeast(level, requiredLevel)) return true;
  }
  return false;
}

export async function requireSiteAccessMutation(
  ctx: MutationCtx,
  siteId: Id<"sites">,
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);
  if (!user.isActive) throw new Error("Account is deactivated");
  if (user.isSuperAdmin) return user;
  const hasWriteAccess = user.roles.some(
    (r: any) => r.siteId === siteId && WRITE_ROLES.has(r.role),
  );
  if (!hasWriteAccess) throw new Error("Forbidden: write access required");
  return user;
}

/**
 * Require at least `requiredLevel` on a module. Throws if not permitted.
 */
export async function requireModuleAccess(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  module: DashboardModule,
  requiredLevel: PermissionLevel = "edit",
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);
  if (!user.isActive) throw new Error("Account is deactivated");
  if (user.isSuperAdmin) return user;
  const siteRoles = user.roles.filter((r: any) => r.siteId === siteId);
  if (siteRoles.length === 0) throw new Error("Forbidden: no site access");
  for (const r of siteRoles) {
    const level = await effectiveLevel(ctx, siteId, r.role, module);
    if (permissionAtLeast(level, requiredLevel)) return user;
  }
  throw new Error(`Forbidden: ${requiredLevel} access required for ${module}`);
}
