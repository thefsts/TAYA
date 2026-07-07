import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { CurrentUser, provisionUser } from "./getCurrentUser";

/**
 * Roles that are permitted to perform write mutations on a site.
 *
 * "client_admin" is the primary role assigned on site creation. Additional
 * editor-type roles (content_editor, manager, etc.) are included so that
 * specialized staff accounts can be granted write access without requiring
 * a full admin role. Purely read-only roles (viewer, read_only) are NOT
 * included here and will be rejected by requireSiteAccessMutation.
 *
 * Superadmins bypass this check entirely.
 */
const WRITE_ROLES = new Set([
  "client_admin",
  "site_admin",
  "admin",
  "editor",
  "content_editor",
  "manager",
  "marketing_manager",
  "training_manager",
]);

export async function checkSiteAccess(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">
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

export async function requireSiteAccessMutation(
  ctx: MutationCtx,
  siteId: Id<"sites">
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);
  if (!user.isActive) throw new Error("Account is deactivated");
  if (user.isSuperAdmin) return user;
  const hasWriteAccess = user.roles.some(
    (r: any) => r.siteId === siteId && WRITE_ROLES.has(r.role)
  );
  if (!hasWriteAccess) throw new Error("Forbidden: write access required");
  return user;
}
