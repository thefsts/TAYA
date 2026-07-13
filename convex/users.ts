import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";

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

    for (const ra of args.roleAssignments ?? []) {
      await logActivity(ctx, {
        siteId: ra.siteId,
        actorName: me.name,
        action: "assigned role",
        entityType: "user",
        entityId: String(userId),
        page: "users",
        newValue: ra.role,
        details: `Assigned role '${ra.role}' to new user ${args.name}`,
      });
    }

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

    const existing = await ctx.db.get(userId);
    if (!existing) throw new Error("User not found");

    const patch: Record<string, unknown> = { ...fields };
    if (roleAssignments !== undefined) {
      patch.roles = roleAssignments;
    }
    await ctx.db.patch(userId, patch as any);

    if (roleAssignments !== undefined) {
      const oldRoles: Array<{ siteId: string; role: string }> = existing.roles ?? [];
      const newRoles = roleAssignments;

      const oldMap = new Map(oldRoles.map((r) => [String(r.siteId), r.role]));
      const newMap = new Map(newRoles.map((r) => [String(r.siteId), r.role]));

      const allSiteIds = new Set([...oldMap.keys(), ...newMap.keys()]);
      for (const siteId of allSiteIds) {
        const oldRole = oldMap.get(siteId);
        const newRole = newMap.get(siteId);
        if (oldRole === newRole) continue;

        const siteDoc = await ctx.db.get(siteId as Id<"sites">);
        if (!siteDoc) continue;

        await logActivity(ctx, {
          siteId: siteId as Id<"sites">,
          actorName: me.name,
          action: newRole ? (oldRole ? "changed role" : "assigned role") : "removed role",
          entityType: "user",
          entityId: String(userId),
          page: "users",
          previousValue: oldRole ?? "(none)",
          newValue: newRole ?? "(removed)",
          details: `Role for ${existing.name} on ${siteDoc.name}: ${oldRole ?? "none"} → ${newRole ?? "removed"}`,
        });
      }
    }

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

/**
 * Appends a single site-role assignment to an existing user without
 * replacing any other roles they already hold. Idempotent — if the user
 * already has a role on this site it is overwritten with the new value.
 * Super-admin only.
 */
export const addSiteRole = mutation({
  args: {
    userId: v.id("users"),
    siteId: v.id("sites"),
    role: v.string(),
  },
  handler: async (ctx, { userId, siteId, role }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const existingRoles: Array<{ siteId: any; role: string }> = (user.roles as any[]) ?? [];
    const filtered = existingRoles.filter((r) => String(r.siteId) !== String(siteId));
    await ctx.db.patch(userId, { roles: [...filtered, { siteId, role }] } as any);

    await logActivity(ctx, {
      siteId,
      actorName: me.name,
      action: "assigned role",
      entityType: "user",
      entityId: String(userId),
      page: "onboarding",
      newValue: role,
      details: `Assigned role '${role}' to ${user.name} during site onboarding`,
    });
    return { success: true };
  },
});
