import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";

function toUserResponse(user: any, sitesMap: Map<string, string>) {
  return {
    ...user,
    id: user._id,
    createdAt: new Date(user._creationTime).toISOString(),
    roleAssignments: user.roles.map((r: any) => ({
      siteId: r.siteId,
      siteName: sitesMap.get(r.siteId) ?? "Unknown site",
      role: r.role,
    })),
  };
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return null;
    const sites = await ctx.db.query("sites").collect();
    const sitesMap = new Map(sites.map((s) => [s._id as string, s.name]));
    return toUserResponse(user, sitesMap);
  },
});

export const provisionMe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await provisionUser(ctx);
    const sites = await ctx.db.query("sites").collect();
    const sitesMap = new Map(sites.map((s) => [s._id as string, s.name]));
    return toUserResponse(user, sitesMap);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me?.isActive || !me?.isSuperAdmin) return null;
    const users = await ctx.db.query("users").collect();
    const sites = await ctx.db.query("sites").collect();
    const sitesMap = new Map(sites.map((s) => [s._id as string, s.name]));
    return users.map((u) => toUserResponse(u, sitesMap));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    isSuperAdmin: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    roleAssignments: v.optional(
      v.array(v.object({ siteId: v.id("sites"), role: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden");
    const userId = await ctx.db.insert("users", {
      clerkUserId: `pending:${args.email}`,
      name: args.name,
      email: args.email,
      isSuperAdmin: args.isSuperAdmin ?? false,
      isActive: args.isActive ?? true,
      roles: args.roleAssignments ?? [],
    });
    const user = (await ctx.db.get(userId))!;
    const sites = await ctx.db.query("sites").collect();
    const sitesMap = new Map(sites.map((s) => [s._id as string, s.name]));
    return toUserResponse(user, sitesMap);
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    isSuperAdmin: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    roleAssignments: v.optional(
      v.array(v.object({ siteId: v.id("sites"), role: v.string() })),
    ),
  },
  handler: async (ctx, { userId, roleAssignments, ...fields }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden");
    const patch: Record<string, unknown> = { ...fields };
    if (roleAssignments !== undefined) {
      patch.roles = roleAssignments;
    }
    await ctx.db.patch(userId, patch as any);
    const user = (await ctx.db.get(userId))!;
    const sites = await ctx.db.query("sites").collect();
    const sitesMap = new Map(sites.map((s) => [s._id as string, s.name]));
    return toUserResponse(user, sitesMap);
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden");
    await ctx.db.delete(userId);
    return { success: true };
  },
});
