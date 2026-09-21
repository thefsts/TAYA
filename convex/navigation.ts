import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("navigationItems")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.sort((a, b) => a.order - b.order).map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    label: v.string(),
    href: v.string(),
    isVisible: v.optional(v.boolean()),
    openInNewTab: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, isVisible, openInNewTab, ...fields }) => {
    // Chat D (client website management completion): menu labels, link
    // destinations, visibility, and new-tab behavior are CONTENT — a client
    // managing their own website can build and edit their navigation menu
    // (same tier as footer content). Structural design of the site itself
    // stays design-tier; this table stores only menu entries.
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("navigationItems", {
      siteId,
      order: count,
      isVisible: isVisible ?? true,
      openInNewTab: openInNewTab ?? false,
      ...fields,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "nav item", page: "Navigation Manager", details: fields.label });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    navItemId: v.id("navigationItems"),
    label: v.optional(v.string()),
    href: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    openInNewTab: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, navItemId, ...fields }) => {
    // Chat D: nav item content (label/href/visibility/order) is CONTENT_UPDATE.
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(navItemId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(navItemId, fields);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "nav item", page: "Navigation Manager", details: existing.label });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), navItemId: v.id("navigationItems") },
  handler: async (ctx, { siteId, navItemId }) => {
    // Chat D: removing a menu entry is CONTENT_DELETE.
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(navItemId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(navItemId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "nav item", page: "Navigation Manager", details: existing.label });
  },
});

export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("navigationItems")),
  },
  handler: async (ctx, { siteId, orderedIds }) => {
    // Chat D: menu ordering is CONTENT_UPDATE.
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc && doc.siteId === siteId) {
        await ctx.db.patch(orderedIds[i], { order: i });
      }
    }
  },
});
