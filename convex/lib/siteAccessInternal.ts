import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal query used by Convex actions (which have no ctx.db access) to
 * verify a user has access to a given site before performing mutations.
 *
 * Usage inside an action:
 *   const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
 *     clerkUserId: identity.subject,
 *     siteId,
 *   });
 *   if (!hasAccess) throw new Error("Forbidden: site access required");
 */
export const check = internalQuery({
  args: {
    clerkUserId: v.string(),
    siteId: v.id("sites"),
  },
  handler: async (ctx, { clerkUserId, siteId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user || !user.isActive) return false;
    if (user.isSuperAdmin) return true;
    return user.roles.some((r: any) => r.siteId === siteId);
  },
});
