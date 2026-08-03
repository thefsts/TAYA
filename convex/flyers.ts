import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { getCurrentUser } from "./lib/getCurrentUser";
import { roleHasPermission } from "./lib/rolePermissions";

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Checks that the caller is authenticated, has site membership, and holds
 * at least one flyer permission. Returns true for superAdmins automatically.
 * Used by dashboard read queries to prevent non-managers from reading
 * draft/scheduled/archived flyer content.
 */
async function checkFlyerReadAccess(ctx: any, siteId: any): Promise<boolean> {
  if (!(await checkSiteAccess(ctx, siteId))) return false;
  const user = await getCurrentUser(ctx);
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const siteRoles: Array<{ siteId: string; role: string }> = (user.roles ?? []).filter(
    (r: any) => r.siteId === siteId,
  );
  return siteRoles.some((r) => roleHasPermission(r.role, PERMISSIONS.FLYERS_CREATE));
}

/** Dashboard list — returns all flyers for a site, optionally filtered by status. */
export const list = query({
  args: {
    siteId: v.id("sites"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, status }) => {
    if (!(await checkFlyerReadAccess(ctx, siteId))) return [];
    if (status) {
      return ctx.db
        .query("flyers")
        .withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", status as any))
        .order("desc")
        .collect();
    }
    return ctx.db
      .query("flyers")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .order("desc")
      .collect();
  },
});

/** Single flyer by ID — dashboard only. */
export const get = query({
  args: { siteId: v.id("sites"), flyerId: v.id("flyers") },
  handler: async (ctx, { siteId, flyerId }) => {
    if (!(await checkFlyerReadAccess(ctx, siteId))) return null;
    const doc = await ctx.db.get(flyerId);
    if (!doc || doc.siteId !== siteId) return null;
    return doc;
  },
});

/**
 * Public query — returns only published flyers whose date window is active.
 * Used by the website template to display flyers.
 */
export const listActive = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const now = Date.now();
    const published = await ctx.db
      .query("flyers")
      .withIndex("by_site_status", (q) =>
        q.eq("siteId", siteId).eq("status", "published"),
      )
      .collect();
    return published.filter((f) => {
      const afterStart = f.startDate == null || f.startDate <= now;
      const beforeExpiry = f.expirationDate == null || f.expirationDate >= now;
      return afterStart && beforeExpiry;
    });
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    buttonLabel: v.optional(v.string()),
    buttonDestination: v.optional(v.string()),
    startDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    associatedEntityType: v.optional(
      v.union(
        v.literal("class"),
        v.literal("event"),
        v.literal("service"),
        v.literal("general"),
      ),
    ),
    associatedEntityId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.FLYERS_CREATE);
    const id = await ctx.db.insert("flyers", {
      siteId,
      status: "draft",
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "flyer",
      entityId: id,
      page: "Flyers",
      newValue: doc,
    });
    return doc;
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    flyerId: v.id("flyers"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    buttonLabel: v.optional(v.string()),
    buttonDestination: v.optional(v.string()),
    startDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    associatedEntityType: v.optional(
      v.union(
        v.literal("class"),
        v.literal("event"),
        v.literal("service"),
        v.literal("general"),
      ),
    ),
    associatedEntityId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, flyerId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.FLYERS_UPDATE);
    const existing = await ctx.db.get(flyerId);
    if (!existing || existing.siteId !== siteId) throw new Error("Flyer not found");
    await ctx.db.patch(flyerId, fields as any);
    const doc = (await ctx.db.get(flyerId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "flyer",
      entityId: flyerId,
      page: "Flyers",
      previousValue: existing,
      newValue: doc,
    });
    return doc;
  },
});

export const publish = mutation({
  args: { siteId: v.id("sites"), flyerId: v.id("flyers") },
  handler: async (ctx, { siteId, flyerId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.FLYERS_PUBLISH);
    const existing = await ctx.db.get(flyerId);
    if (!existing || existing.siteId !== siteId) throw new Error("Flyer not found");
    await ctx.db.patch(flyerId, { status: "published", publishedAt: Date.now() });
    const doc = (await ctx.db.get(flyerId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "published",
      entityType: "flyer",
      entityId: flyerId,
      page: "Flyers",
    });
    return doc;
  },
});

export const schedule = mutation({
  args: { siteId: v.id("sites"), flyerId: v.id("flyers"), startDate: v.number() },
  handler: async (ctx, { siteId, flyerId, startDate }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.FLYERS_PUBLISH);
    const existing = await ctx.db.get(flyerId);
    if (!existing || existing.siteId !== siteId) throw new Error("Flyer not found");
    await ctx.db.patch(flyerId, { status: "scheduled", startDate });
    const doc = (await ctx.db.get(flyerId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "scheduled",
      entityType: "flyer",
      entityId: flyerId,
      page: "Flyers",
    });
    return doc;
  },
});

export const archive = mutation({
  args: {
    siteId: v.id("sites"),
    flyerId: v.id("flyers"),
    archivedReason: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, flyerId, archivedReason }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.FLYERS_ARCHIVE);
    const existing = await ctx.db.get(flyerId);
    if (!existing || existing.siteId !== siteId) throw new Error("Flyer not found");
    await ctx.db.patch(flyerId, {
      status: "archived",
      archivedAt: Date.now(),
      archivedReason: archivedReason ?? "manual",
    });
    const doc = (await ctx.db.get(flyerId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "archived",
      entityType: "flyer",
      entityId: flyerId,
      page: "Flyers",
    });
    return doc;
  },
});

/**
 * Internal — bulk-archive all published/scheduled flyers linked to a specific
 * entity (event or class/course) when that entity is cancelled or completed.
 * Called by events.ts and courses.ts after a status change.
 */
export const archiveByEntity = internalMutation({
  args: {
    siteId: v.id("sites"),
    associatedEntityType: v.string(),
    associatedEntityId: v.string(),
    archivedReason: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, associatedEntityType, associatedEntityId, archivedReason }) => {
    const candidates = await ctx.db
      .query("flyers")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) =>
        q.and(
          q.eq(q.field("associatedEntityType"), associatedEntityType),
          q.eq(q.field("associatedEntityId"), associatedEntityId),
        ),
      )
      .collect();

    const toArchive = candidates.filter(
      (f) => f.status === "published" || f.status === "scheduled",
    );

    for (const flyer of toArchive) {
      await ctx.db.patch(flyer._id, {
        status: "archived",
        archivedAt: Date.now(),
        archivedReason: archivedReason ?? "associated_entity_ended",
      });
    }
    return { archived: toArchive.length };
  },
});
