import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { provisionUser } from "./lib/getCurrentUser";
import { isTestMode, requireTestEnvironment } from "./lib/testMode";
import { logActivity } from "./lib/logActivity";
import { internal } from "./_generated/api";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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
    const siteEntries = await Promise.all(
      user.roles.map((r: { siteId: Id<"sites">; role: string }) => ctx.db.get(r.siteId)),
    );
    const sitesMap = new Map(
      siteEntries
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id as string, s.name]),
    );
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

    if (args.isSuperAdmin && (args.roleAssignments ?? []).length > 0) {
      throw new Error(
        "Cannot combine isSuperAdmin: true with site role assignments. " +
        "Superadmins have platform-wide access — site roles are redundant and indicate a misconfiguration."
      );
    }

    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) throw new Error("A valid email address is required");

    // Prevent duplicate pending/client records. The by_email index is deliberately
    // checked before insert so retrying an invitation cannot create a second user.
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingByEmail) {
      throw new Error("A dashboard user with this email already exists");
    }

    const userId = await ctx.db.insert("users", {
      clerkUserId: `pending:${email}`,
      name: args.name.trim(),
      email,
      isSuperAdmin: args.isSuperAdmin ?? false,
      isActive: args.isActive ?? true,
      roles: args.roleAssignments ?? [],
      inviteStatus: "pending",
      invitedAt: Date.now(),
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

    await ctx.scheduler.runAfter(0, internal.email.sendDashboardWelcome, {
      recipientEmail: email,
      recipientName: args.name.trim(),
    });

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

    const effectiveIsSuperAdmin = fields.isSuperAdmin ?? existing.isSuperAdmin;
    const effectiveRoles = roleAssignments ?? (existing.roles as any[]);
    if (effectiveIsSuperAdmin && effectiveRoles.length > 0) {
      throw new Error(
        "Cannot combine isSuperAdmin: true with site role assignments. " +
        "Remove all site roles before granting superadmin, or leave isSuperAdmin false."
      );
    }

    const patch: Record<string, unknown> = { ...fields };
    if (fields.email !== undefined) {
      const normalized = normalizeEmail(fields.email);
      if (!normalized || !normalized.includes("@")) throw new Error("A valid email address is required");
      const duplicate = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .first();
      if (duplicate && duplicate._id !== userId) {
        throw new Error("A dashboard user with this email already exists");
      }
      patch.email = normalized;
      if (existing.clerkUserId.startsWith("pending:")) patch.clerkUserId = `pending:${normalized}`;
    }
    if (fields.name !== undefined) patch.name = fields.name.trim();
    if (roleAssignments !== undefined) patch.roles = roleAssignments;
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
    if (user.isSuperAdmin) {
      throw new Error("Cannot combine isSuperAdmin: true with site role assignments. Remove superadmin status before assigning a site role.");
    }
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

export const findSuperAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").filter((q) => q.eq(q.field("isSuperAdmin"), true)).first();
  },
});

export const updateInvitationState = internalMutation({
  args: {
    userId: v.id("users"),
    inviteStatus: v.string(),
    clerkInvitationId: v.optional(v.string()),
    invitationLastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(args.userId, {
      inviteStatus: args.inviteStatus,
      clerkInvitationId: args.clerkInvitationId,
      invitationLastError: args.invitationLastError,
    });
    return { success: true };
  },
});

/**
 * Promote an existing user to superadmin by Clerk ID.
 * SECURITY: only an existing superadmin may promote — except in approved test
 * environments (convex/lib/testMode.ts), where the test harness bootstraps.
 * Fails closed on production-marked deployments. Restored from 834c931^ after
 * it was removed without updating the convex-unit test suite.
 */
export const promoteToSuperAdminByClerkId = mutation({
  args: { targetClerkUserId: v.string() },
  handler: async (ctx, { targetClerkUserId }) => {
    if (!isTestMode()) {
      const me = await provisionUser(ctx);
      if (!me.isSuperAdmin) throw new Error("Forbidden: superadmin only");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) =>
        q.eq("clerkUserId", targetClerkUserId)
      )
      .first();
    if (!user) throw new Error(`User with clerkUserId ${targetClerkUserId} not found`);
    await ctx.db.patch(user._id, { isSuperAdmin: true, isActive: true });
    return user._id;
  },
});

// Test-only exports retained below in the repository's test environment.
export { isTestMode, requireTestEnvironment };

/**
 * Test-only superadmin bootstrap.
 * SECURITY: fails closed on production deployments via requireTestEnvironment.
 * The convex-unit test suite uses this to provision an authenticated superadmin
 * identity; it was removed in 834c931 without updating the tests, breaking 40+
 * tenant-isolation / RBAC tests. Restored here gated behind CONVEX_TEST_MODE.
 */
export const upsertTestSuperAdmin = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    requireTestEnvironment("upsertTestSuperAdmin");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    if (existing.length > 0) {
      for (const user of existing) {
        await ctx.db.patch(user._id, { isSuperAdmin: true, isActive: true });
      }
      return existing[0]._id;
    }
    return await ctx.db.insert("users", {
      clerkUserId: `pending:${email}`,
      name,
      email,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
  },
});
