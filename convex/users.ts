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

/**
 * List users assigned to a specific site.
 * Accessible by SuperAdmins and users with a manage-level role on the site
 * (client_admin, site_admin, owner, admin).
 */
export const listForSite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me?.isActive) return null;

    // SuperAdmin sees all users for this site
    // Site-level admins (owner, admin, site_admin, client_admin, manager) can view
    const mySiteRole = me.roles?.find((r: any) => String(r.siteId) === String(siteId));
    const canView = me.isSuperAdmin || !!mySiteRole;
    if (!canView) return null;

    const allUsers = await ctx.db.query("users").collect();
    const siteUsers = allUsers
      .filter((u) => u.isActive && u.roles?.some((r: any) => String(r.siteId) === String(siteId)))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        isSuperAdmin: u.isSuperAdmin,
        isActive: u.isActive,
        role: u.roles?.find((r: any) => String(r.siteId) === String(siteId))?.role ?? null,
        inviteStatus: u.inviteStatus ?? null,
        clerkUserId: u.clerkUserId,
      }));

    return siteUsers;
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

/**
 * Assign a client user to a site with upsert semantics (SuperAdmin only).
 *
 * Phase 1 of the Client CMS completion: the admin explicitly assigns a client
 * owner/admin to a website during or after onboarding. Unlike `create`, this
 * REUSES an existing dashboard user with the same email instead of failing:
 *   - existing user  → add (or update) the site role, no duplicate record,
 *                      no second Clerk invitation.
 *   - brand-new user → insert with `pending:<email>` clerkUserId, send the
 *                      dashboard welcome email (the Clerk invitation itself
 *                      is issued separately via clerkInvitations.invite so
 *                      the email flow stays a single place).
 *
 * Returns an explicit outcome so the UI can show precise status:
 *   { outcome: "reused" | "created" | "role_updated", userId, email, role }
 */
export async function upsertClientAssignment(
  ctx: any,
  args: {
    siteId: Id<"sites">;
    email: string;
    name?: string;
    role?: string;
    actorName: string;
    /** When false (onboarding launch path), the welcome email is skipped
     *  because the wizard sends the Clerk invitation immediately after. */
    sendWelcomeEmail?: boolean;
  },
): Promise<{ outcome: "reused" | "created" | "role_updated"; userId: any; email: string; role: string }> {
  const email = normalizeEmail(args.email);
  if (!email || !email.includes("@")) throw new Error("A valid email address is required");
  const role = args.role ?? "owner";
  const site = await ctx.db.get(args.siteId);
  if (!site) throw new Error("Website not found");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: { eq: (field: string, value: string) => any }) =>
      q.eq("email", email),
    )
    .first();

  if (existing) {
    if (existing.isSuperAdmin) {
      throw new Error(
        "This person is already a platform administrator. Superadmins cannot be assigned a site role — remove platform admin access first if they should manage a single website."
      );
    }
    const existingRoles: Array<{ siteId: any; role: string }> = (existing.roles as any[]) ?? [];
    const prior = existingRoles.find((r) => String(r.siteId) === String(args.siteId));
    const merged = [
      ...existingRoles.filter((r) => String(r.siteId) !== String(args.siteId)),
      { siteId: args.siteId, role },
    ];
    await ctx.db.patch(existing._id, { roles: merged } as any);
    await logActivity(ctx, {
      siteId: args.siteId,
      actorName: args.actorName,
      action: prior ? "changed role" : "assigned role",
      entityType: "user",
      entityId: String(existing._id),
      page: "users",
      previousValue: prior?.role,
      newValue: role,
      details: prior
        ? `Role for ${existing.name} on ${site.name} updated to ${role} (existing client reused)`
        : `Assigned role '${role}' to existing client ${existing.name} on ${site.name}`,
    });
    return {
      outcome: prior ? "role_updated" : "reused",
      userId: existing._id,
      email,
      role,
    };
  }

  const displayName = (args.name ?? "").trim() || email.split("@")[0];
  const userId = await ctx.db.insert("users", {
    clerkUserId: `pending:${email}`,
    name: displayName,
    email,
    isSuperAdmin: false,
    isActive: true,
    roles: [{ siteId: args.siteId, role }],
    inviteStatus: "pending",
    invitedAt: Date.now(),
  });

  await logActivity(ctx, {
    siteId: args.siteId,
    actorName: args.actorName,
    action: "assigned role",
    entityType: "user",
    entityId: String(userId),
    page: "users",
    newValue: role,
    details: `Assigned role '${role}' to new client ${displayName} on ${site.name}`,
  });

  // Welcome email only for brand-new users; reused clients already have
  // credentials or a pending invitation.
  if (args.sendWelcomeEmail !== false) {
    await ctx.scheduler.runAfter(0, internal.email.sendDashboardWelcome, {
      recipientEmail: email,
      recipientName: displayName,
    });
  }

  return { outcome: "created", userId, email, role };
}

/**
 * Assign a client user to a site with upsert semantics (SuperAdmin only).
 *
 * Phase 1 of the Client CMS completion: the admin explicitly assigns a client
 * owner/admin to a website during or after onboarding. Unlike `create`, this
 * REUSES an existing dashboard user with the same email instead of failing:
 *   - existing user  -> add (or update) the site role, no duplicate record,
 *                      no second Clerk invitation.
 *   - brand-new user -> insert with `pending:<email>` clerkUserId, send the
 *                      dashboard welcome email (the Clerk invitation itself
 *                      is issued separately via clerkInvitations.invite so
 *                      the email flow stays in one place).
 */
export const assignClient = mutation({
  args: {
    siteId: v.id("sites"),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden");
    return await upsertClientAssignment(ctx, {
      siteId: args.siteId,
      email: args.email,
      name: args.name,
      role: args.role,
      actorName: me.name,
    });
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

/**
 * Update a user's role on a specific site (SuperAdmin only).
 * Only modifies the role for this site; preserves other site assignments.
 */
export const updateSiteRole = mutation({
  args: {
    userId: v.id("users"),
    siteId: v.id("sites"),
    role: v.string(),
  },
  handler: async (ctx, { userId, siteId, role }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden: superadmin only");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.isSuperAdmin) {
      throw new Error("Cannot assign site roles to a superadmin. Remove superadmin status first.");
    }
    const existingRoles: Array<{ siteId: any; role: string }> = (user.roles as any[]) ?? [];
    const filtered = existingRoles.filter((r) => String(r.siteId) !== String(siteId));
    await ctx.db.patch(userId, { roles: [...filtered, { siteId, role }] } as any);
    const siteDoc = await ctx.db.get(siteId);
    await logActivity(ctx, {
      siteId,
      actorName: me.name,
      action: "changed role",
      entityType: "user",
      entityId: String(userId),
      page: "Site Users",
      newValue: role,
      details: `Role for ${user.name} on ${siteDoc?.name ?? "site"} changed to ${role}`,
    });
    return { success: true };
  },
});

/**
 * Remove a user's role on a specific site (SuperAdmin only).
 * Removes only this site assignment; preserves other site assignments.
 */
export const removeSiteRole = mutation({
  args: {
    userId: v.id("users"),
    siteId: v.id("sites"),
  },
  handler: async (ctx, { userId, siteId }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden: superadmin only");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    const existingRoles: Array<{ siteId: any; role: string }> = (user.roles as any[]) ?? [];
    const filtered = existingRoles.filter((r) => String(r.siteId) !== String(siteId));
    await ctx.db.patch(userId, { roles: filtered } as any);
    const siteDoc = await ctx.db.get(siteId);
    await logActivity(ctx, {
      siteId,
      actorName: me.name,
      action: "removed role",
      entityType: "user",
      entityId: String(userId),
      page: "Site Users",
      newValue: "(removed)",
      details: `Removed ${user.name} from ${siteDoc?.name ?? "site"}`,
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
