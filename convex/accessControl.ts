import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";
import {
  ROLE_CAPABILITIES,
  ROLES,
  DASHBOARD_MODULES,
  type Role,
  type DashboardModule,
  type PermissionLevel,
} from "./lib/roleCapabilities";
import { Id } from "./_generated/dataModel";

/**
 * Get the effective capability matrix for a site, merging defaults with
 * any site-level overrides stored in siteRoleOverrides.
 */
export const getSiteCapabilityMatrix = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me?.isActive || !me?.isSuperAdmin) return null;

    const overrides = await ctx.db
      .query("siteRoleOverrides")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const overrideMap: Record<string, Record<string, PermissionLevel>> = {};
    for (const o of overrides) {
      if (!overrideMap[o.role]) overrideMap[o.role] = {};
      overrideMap[o.role][o.module] = o.level as PermissionLevel;
    }

    const matrix: Record<string, Record<string, PermissionLevel>> = {};
    for (const role of ROLES) {
      matrix[role] = {} as Record<string, PermissionLevel>;
      const defaults = ROLE_CAPABILITIES[role];
      for (const mod of DASHBOARD_MODULES) {
        matrix[role][mod] =
          (overrideMap[role]?.[mod] as PermissionLevel | undefined) ??
          defaults[mod];
      }
    }

    return { matrix, overrides: overrideMap };
  },
});

/**
 * Get capability matrix for a non-superadmin user on their current site.
 * Used for the "My Permissions" view.
 */
export const getMyPermissions = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me?.isActive) return null;
    if (me.isSuperAdmin) {
      const full: Record<string, PermissionLevel> = {};
      for (const mod of DASHBOARD_MODULES) full[mod] = "manage";
      return { isSuperAdmin: true, role: null, permissions: full };
    }

    const siteRole = me.roles.find((r: any) => r.siteId === siteId);
    if (!siteRole) return null;

    const overrides = await ctx.db
      .query("siteRoleOverrides")
      .withIndex("by_site_role", (q) =>
        q.eq("siteId", siteId).eq("role", siteRole.role),
      )
      .collect();
    const overrideMap: Record<string, PermissionLevel> = {};
    for (const o of overrides) {
      overrideMap[o.module] = o.level as PermissionLevel;
    }

    const defaults = ROLE_CAPABILITIES[siteRole.role as Role];
    const permissions: Record<string, PermissionLevel> = {};
    for (const mod of DASHBOARD_MODULES) {
      permissions[mod] = (overrideMap[mod] ?? defaults?.[mod]) ?? "none";
    }

    return { isSuperAdmin: false, role: siteRole.role, permissions };
  },
});

/**
 * Set (upsert) a single module-level override for a role on a site.
 * Pass level = null to remove the override (revert to default).
 */
export const setRoleModuleOverride = mutation({
  args: {
    siteId: v.id("sites"),
    role: v.string(),
    module: v.string(),
    level: v.union(v.literal("none"), v.literal("view"), v.literal("edit"), v.literal("manage"), v.literal("__remove__")),
  },
  handler: async (ctx, { siteId, role, module, level }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden: superadmin only");

    const existing = await ctx.db
      .query("siteRoleOverrides")
      .withIndex("by_site_role", (q) => q.eq("siteId", siteId).eq("role", role))
      .collect()
      .then((rows) => rows.find((r) => r.module === module));

    if (level === "__remove__") {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { level });
    } else {
      await ctx.db.insert("siteRoleOverrides", { siteId, role, module, level });
    }
  },
});

/**
 * Reset all overrides for a site back to defaults.
 */
export const resetSiteOverrides = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const me = await provisionUser(ctx);
    if (!me.isSuperAdmin) throw new Error("Forbidden: superadmin only");
    const overrides = await ctx.db
      .query("siteRoleOverrides")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    await Promise.all(overrides.map((o) => ctx.db.delete(o._id)));
    return { removed: overrides.length };
  },
});
