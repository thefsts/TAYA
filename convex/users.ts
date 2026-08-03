import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { provisionUser } from "./lib/getCurrentUser";
import { isTestMode, requireTestEnvironment } from "./lib/testMode";
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
    // Only fetch the sites this user actually has roles on — avoids leaking
    // the full site list to non-superadmin callers.
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

    // SECURITY: a superadmin has platform-wide access and must never also hold
    // site-specific role assignments — that combination is always a mistake.
    // If the caller accidentally passes both, reject early so the provisioning
    // flow cannot accidentally turn a client user into a superadmin (or vice versa).
    if (args.isSuperAdmin && (args.roleAssignments ?? []).length > 0) {
      throw new Error(
        "Cannot combine isSuperAdmin: true with site role assignments. " +
        "Superadmins have platform-wide access — site roles are redundant and indicate a misconfiguration."
      );
    }

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

    // SECURITY: block any update that would leave the user as both superadmin
    // and the holder of site-specific roles — that combination is always wrong.
    const effectiveIsSuperAdmin = fields.isSuperAdmin ?? existing.isSuperAdmin;
    const effectiveRoles = roleAssignments ?? (existing.roles as any[]);
    if (effectiveIsSuperAdmin && effectiveRoles.length > 0) {
      throw new Error(
        "Cannot combine isSuperAdmin: true with site role assignments. " +
        "Remove all site roles before granting superadmin, or leave isSuperAdmin false."
      );
    }

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

export const findSuperAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isSuperAdmin"), true))
      .first();
  },
});

export const listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      id: u._id,
      email: u.email,
      name: u.name,
      isSuperAdmin: u.isSuperAdmin,
      isActive: u.isActive,
      clerkUserId: u.clerkUserId,
    }));
  },
});

export const promoteToSuperAdminByClerkId = mutation({
  args: { targetClerkUserId: v.string() },
  handler: async (ctx, { targetClerkUserId }) => {
    // SECURITY: only an existing superadmin may promote — except in approved
    // test environments (see convex/lib/testMode.ts), where the e2e harness
    // bootstraps. The guard fails closed on production-marked deployments.
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

/**
 * One-time internal provisioning: create (or verify) the Corsair Tactical
 * Solutions owner user with site-scoped "owner" role.
 *
 * Run via:
 *   CONVEX_DEPLOY_KEY=... npx convex run users:provisionCorsairOwner --prod
 *
 * SECURITY: isSuperAdmin is hard-coded false — this function can never elevate
 * a client user to platform-wide superadmin regardless of arguments.
 * Idempotent — safe to re-run; will only patch the role if it is missing.
 */
export const provisionCorsairOwner = internalMutation({
  args: {},
  handler: async (ctx) => {
    const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc" as Id<"sites">;
    const OWNER_EMAIL     = "corsairtacticalsolutions@gmail.com";
    const OWNER_NAME      = "Corsair Tactical Solutions";
    const OWNER_ROLE      = "owner";

    // Verify the site exists
    const site = await ctx.db.get(CORSAIR_SITE_ID);
    if (!site) throw new Error(`Site ${CORSAIR_SITE_ID} not found — run the Corsair seed first`);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", OWNER_EMAIL))
      .first();

    if (existing) {
      const alreadyHasRole = (existing.roles as any[]).some(
        (r: any) => String(r.siteId) === CORSAIR_SITE_ID,
      );
      if (alreadyHasRole) {
        return { action: "noop", userId: existing._id, message: "Owner role already present" };
      }
      // Append the owner role without touching other roles
      const roles = [...(existing.roles as any[]), { siteId: CORSAIR_SITE_ID, role: OWNER_ROLE }];
      await ctx.db.patch(existing._id, { roles } as any);
      return { action: "patched", userId: existing._id, message: "Owner role added to existing user" };
    }

    // Create pending user — isSuperAdmin is explicitly false (enforced here, not caller-controlled)
    const userId = await ctx.db.insert("users", {
      clerkUserId: `pending:${OWNER_EMAIL}`,
      name:         OWNER_NAME,
      email:        OWNER_EMAIL,
      isSuperAdmin: false,
      isActive:     true,
      roles:        [{ siteId: CORSAIR_SITE_ID, role: OWNER_ROLE }],
    });

    return { action: "created", userId, message: `Pending user created with ${OWNER_ROLE} role on ${CORSAIR_SITE_ID}` };
  },
});

export const upsertTestSuperAdmin = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    // SECURITY: test-only bootstrap. Never available outside test deployments;
    // fails closed on production-marked deployments (convex/lib/testMode.ts).
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
