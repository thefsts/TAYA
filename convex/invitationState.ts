import { mutation } from "./_generated/server";
import { v } from "convex/values";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const mark = mutation({
  args: {
    email: v.string(),
    status: v.string(),
    clerkInvitationId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me?.isActive || !me?.isSuperAdmin) throw new Error("Forbidden: superadmin only");

    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error("Dashboard user not found for invitation status update");

    await ctx.db.patch(user._id, {
      inviteStatus: args.status,
      invitedAt: user.invitedAt ?? Date.now(),
      clerkInvitationId: args.clerkInvitationId,
      invitationLastError: args.error,
    });

    return { success: true };
  },
});
