import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("jobPostings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.map(toResponse);
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    jobType: v.string(),
    location: v.optional(v.string()),
    description: v.string(),
    applyUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, isActive, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("jobPostings", {
      siteId,
      isActive: isActive ?? true,
      ...fields,
    });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "job posting", page: "Careers Manager", details: fields.title });
    const doc = (await ctx.db.get(id))!;
    return toResponse(doc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    jobId: v.id("jobPostings"),
    title: v.optional(v.string()),
    jobType: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    applyUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, jobId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(jobId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.patch(jobId, fields);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "job posting", page: "Careers Manager", details: existing.title });
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), jobId: v.id("jobPostings") },
  handler: async (ctx, { siteId, jobId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(jobId);
    if (!existing || existing.siteId !== siteId) throw new Error("Not found");
    await ctx.db.delete(jobId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "job posting", page: "Careers Manager", details: existing.title });
  },
});
