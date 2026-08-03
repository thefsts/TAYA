import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

// ── Policy Pages ─────────────────────────────────────────────────────────────

export const getPolicy = query({
  args: { siteId: v.id("sites"), policyType: v.string() },
  handler: async (ctx, { siteId, policyType }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db.query("policyPages").withIndex("by_site_type", (q) => q.eq("siteId", siteId).eq("policyType", policyType)).first();
  },
});

export const listPolicies = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return ctx.db.query("policyPages").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

export const upsertPolicy = mutation({
  args: {
    siteId: v.id("sites"),
    policyType: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { siteId, policyType, content }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.query("policyPages").withIndex("by_site_type", (q) => q.eq("siteId", siteId).eq("policyType", policyType)).first();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content, updatedAt });
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "policy_page", entityId: existing._id, page: "Policy Editor", details: policyType });
      return existing._id;
    } else {
      const id = await ctx.db.insert("policyPages", { siteId, policyType, content, updatedAt });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "policy_page", entityId: id, page: "Policy Editor", details: policyType });
      return id;
    }
  },
});

// ── Navigation Items ──────────────────────────────────────────────────────────

export const listNavItems = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.sort((a, b) => a.order - b.order).map((d) => ({ ...d, id: d._id }));
  },
});

export const createNavItem = mutation({
  args: { siteId: v.id("sites"), label: v.string(), href: v.string(), openInNewTab: v.optional(v.boolean()), isVisible: v.boolean() },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.LAYOUT_MANAGE);
    const count = (await ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("navigationItems", { siteId, ...fields, order: count });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "nav_item", entityId: id, page: "Navigation Manager", details: fields.label });
    return id;
  },
});

export const updateNavItem = mutation({
  args: { siteId: v.id("sites"), itemId: v.id("navigationItems"), label: v.optional(v.string()), href: v.optional(v.string()), openInNewTab: v.optional(v.boolean()), isVisible: v.optional(v.boolean()) },
  handler: async (ctx, { siteId, itemId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.LAYOUT_MANAGE);
    const existing = await ctx.db.get(itemId);
    if (!existing || existing.siteId !== siteId) throw new Error("Item not found");
    await ctx.db.patch(itemId, fields as any);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "nav_item", entityId: itemId, page: "Navigation Manager" });
    return itemId;
  },
});

export const removeNavItem = mutation({
  args: { siteId: v.id("sites"), itemId: v.id("navigationItems") },
  handler: async (ctx, { siteId, itemId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.LAYOUT_MANAGE);
    const existing = await ctx.db.get(itemId);
    if (!existing || existing.siteId !== siteId) throw new Error("Item not found");
    await ctx.db.delete(itemId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "nav_item", entityId: itemId, page: "Navigation Manager" });
  },
});

export const reorderNavItems = mutation({
  args: { siteId: v.id("sites"), orderedIds: v.array(v.id("navigationItems")) },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.LAYOUT_MANAGE);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc?.siteId === siteId) await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

// ── Announcement Banner ───────────────────────────────────────────────────────

export const getAnnouncement = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db.query("announcementBanner").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
  },
});

export const upsertAnnouncement = mutation({
  args: {
    siteId: v.id("sites"),
    text: v.string(),
    bgColor: v.string(),
    link: v.optional(v.string()),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.query("announcementBanner").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "announcement_banner", page: "Announcement Banner" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("announcementBanner", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "announcement_banner", page: "Announcement Banner" });
      return id;
    }
  },
});

// ── CTA Config ────────────────────────────────────────────────────────────────

export const getCta = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db.query("siteCtaConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
  },
});

export const upsertCta = mutation({
  args: {
    siteId: v.id("sites"),
    primaryLabel: v.string(),
    primaryUrl: v.string(),
    secondaryLabel: v.optional(v.string()),
    secondaryUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.query("siteCtaConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "cta_config", page: "CTA Manager" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("siteCtaConfig", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "cta_config", page: "CTA Manager" });
      return id;
    }
  },
});

// ── Downloadable Resources ────────────────────────────────────────────────────

export const listDownloads = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("downloadableResources").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.sort((a, b) => a.order - b.order).map((d) => ({ ...d, id: d._id }));
  },
});

export const createDownload = mutation({
  args: { siteId: v.id("sites"), title: v.string(), description: v.optional(v.string()), url: v.string(), format: v.optional(v.string()), sizeLabel: v.optional(v.string()), category: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("downloadableResources").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("downloadableResources", { siteId, ...fields, order: count });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "download", entityId: id, page: "Downloads Manager", details: fields.title });
    return id;
  },
});

export const updateDownload = mutation({
  args: { siteId: v.id("sites"), downloadId: v.id("downloadableResources"), title: v.optional(v.string()), description: v.optional(v.string()), url: v.optional(v.string()), format: v.optional(v.string()), sizeLabel: v.optional(v.string()), category: v.optional(v.string()), isActive: v.optional(v.boolean()) },
  handler: async (ctx, { siteId, downloadId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(downloadId);
    if (!existing || existing.siteId !== siteId) throw new Error("Resource not found");
    await ctx.db.patch(downloadId, fields as any);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "download", entityId: downloadId, page: "Downloads Manager" });
    return downloadId;
  },
});

export const removeDownload = mutation({
  args: { siteId: v.id("sites"), downloadId: v.id("downloadableResources") },
  handler: async (ctx, { siteId, downloadId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(downloadId);
    if (!existing || existing.siteId !== siteId) throw new Error("Resource not found");
    await ctx.db.delete(downloadId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "download", entityId: downloadId, page: "Downloads Manager" });
  },
});

export const reorderDownloads = mutation({
  args: { siteId: v.id("sites"), orderedIds: v.array(v.id("downloadableResources")) },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc?.siteId === siteId) await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

// ── Team Members ──────────────────────────────────────────────────────────────

export const listTeamMembers = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("teamMembers").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.sort((a, b) => a.order - b.order).map((d) => ({ ...d, id: d._id }));
  },
});

export const createTeamMember = mutation({
  args: { siteId: v.id("sites"), name: v.string(), role: v.optional(v.string()), bio: v.optional(v.string()), photoUrl: v.optional(v.string()), credentials: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const count = (await ctx.db.query("teamMembers").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).length;
    const id = await ctx.db.insert("teamMembers", { siteId, ...fields, order: count });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "team_member", entityId: id, page: "Team Manager", details: fields.name });
    return id;
  },
});

export const updateTeamMember = mutation({
  args: { siteId: v.id("sites"), memberId: v.id("teamMembers"), name: v.optional(v.string()), role: v.optional(v.string()), bio: v.optional(v.string()), photoUrl: v.optional(v.string()), credentials: v.optional(v.string()), isActive: v.optional(v.boolean()) },
  handler: async (ctx, { siteId, memberId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(memberId);
    if (!existing || existing.siteId !== siteId) throw new Error("Member not found");
    await ctx.db.patch(memberId, fields as any);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "team_member", entityId: memberId, page: "Team Manager" });
    return memberId;
  },
});

export const removeTeamMember = mutation({
  args: { siteId: v.id("sites"), memberId: v.id("teamMembers") },
  handler: async (ctx, { siteId, memberId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(memberId);
    if (!existing || existing.siteId !== siteId) throw new Error("Member not found");
    await ctx.db.delete(memberId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "team_member", entityId: memberId, page: "Team Manager" });
  },
});

export const reorderTeamMembers = mutation({
  args: { siteId: v.id("sites"), orderedIds: v.array(v.id("teamMembers")) },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = await ctx.db.get(orderedIds[i]);
      if (doc?.siteId === siteId) await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

// ── Job Postings ──────────────────────────────────────────────────────────────

export const listJobs = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("jobPostings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.map((d) => ({ ...d, id: d._id }));
  },
});

export const createJob = mutation({
  args: { siteId: v.id("sites"), title: v.string(), jobType: v.string(), location: v.optional(v.string()), description: v.string(), applyUrl: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);
    const id = await ctx.db.insert("jobPostings", { siteId, ...fields });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "job_posting", entityId: id, page: "Careers Manager", details: fields.title });
    return id;
  },
});

export const updateJob = mutation({
  args: { siteId: v.id("sites"), jobId: v.id("jobPostings"), title: v.optional(v.string()), jobType: v.optional(v.string()), location: v.optional(v.string()), description: v.optional(v.string()), applyUrl: v.optional(v.string()), isActive: v.optional(v.boolean()) },
  handler: async (ctx, { siteId, jobId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.get(jobId);
    if (!existing || existing.siteId !== siteId) throw new Error("Job not found");
    await ctx.db.patch(jobId, fields as any);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "job_posting", entityId: jobId, page: "Careers Manager" });
    return jobId;
  },
});

export const removeJob = mutation({
  args: { siteId: v.id("sites"), jobId: v.id("jobPostings") },
  handler: async (ctx, { siteId, jobId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const existing = await ctx.db.get(jobId);
    if (!existing || existing.siteId !== siteId) throw new Error("Job not found");
    await ctx.db.delete(jobId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "job_posting", entityId: jobId, page: "Careers Manager" });
  },
});

// ── Popup Config ──────────────────────────────────────────────────────────────

export const getPopup = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db.query("popupConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
  },
});

export const upsertPopup = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    body: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    triggerType: v.string(),
    delaySecs: v.optional(v.number()),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const existing = await ctx.db.query("popupConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "popup_config", page: "Popup Manager" });
      return existing._id;
    } else {
      const id = await ctx.db.insert("popupConfig", { siteId, ...fields });
      await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "popup_config", page: "Popup Manager" });
      return id;
    }
  },
});
