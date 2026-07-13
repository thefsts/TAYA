import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";

function toAgencyResponse(agency: any) {
  return {
    ...agency,
    id: agency._id,
    createdAt: new Date(agency._creationTime).toISOString(),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user?.isActive || !user?.isSuperAdmin) return null;
    const agencies = await ctx.db.query("agencies").collect();
    return agencies.map(toAgencyResponse);
  },
});

export const get = query({
  args: { agencyId: v.id("agencies") },
  handler: async (ctx, { agencyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user?.isActive) return null;
    if (!user.isSuperAdmin && String(user.agencyId) !== String(agencyId)) return null;
    const agency = await ctx.db.get(agencyId);
    if (!agency) return null;
    return toAgencyResponse(agency);
  },
});

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db.query("agencies").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    supportEmail: v.string(),
    helpCenterUrl: v.optional(v.string()),
    featureFlags: v.optional(v.any()),
    billingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("agencies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("An agency with this slug already exists");

    const agencyId = await ctx.db.insert("agencies", {
      name: args.name,
      slug: args.slug,
      logoUrl: args.logoUrl,
      primaryColor: args.primaryColor ?? "#1d4ed8",
      accentColor: args.accentColor ?? "#0f172a",
      supportEmail: args.supportEmail,
      helpCenterUrl: args.helpCenterUrl,
      featureFlags: args.featureFlags ?? {},
      licensingStatus: "active",
      billingNotes: args.billingNotes,
      isActive: true,
    });

    const agency = await ctx.db.get(agencyId);
    return toAgencyResponse(agency!);
  },
});

export const update = mutation({
  args: {
    agencyId: v.id("agencies"),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    helpCenterUrl: v.optional(v.string()),
    featureFlags: v.optional(v.any()),
    licensingStatus: v.optional(v.string()),
    billingNotes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { agencyId, ...fields }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    const existing = await ctx.db.get(agencyId);
    if (!existing) throw new Error("Agency not found");
    await ctx.db.patch(agencyId, fields as any);
    const agency = await ctx.db.get(agencyId);
    return toAgencyResponse(agency!);
  },
});

export const assignSite = mutation({
  args: {
    siteId: v.id("sites"),
    agencyId: v.optional(v.id("agencies")),
  },
  handler: async (ctx, { siteId, agencyId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    await ctx.db.patch(siteId, { agencyId });
    return { success: true };
  },
});

export const assignAdmin = mutation({
  args: {
    userId: v.id("users"),
    agencyId: v.optional(v.id("agencies")),
    isAgencyAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, agencyId, isAgencyAdmin }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found");
    await ctx.db.patch(userId, { agencyId, isAgencyAdmin: isAgencyAdmin ?? false });
    return { success: true };
  },
});

export const updateFeatureFlags = mutation({
  args: {
    agencyId: v.id("agencies"),
    featureFlags: v.any(),
  },
  handler: async (ctx, { agencyId, featureFlags }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    await ctx.db.patch(agencyId, { featureFlags });
    return { success: true };
  },
});

export const remove = mutation({
  args: { agencyId: v.id("agencies") },
  handler: async (ctx, { agencyId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    await ctx.db.delete(agencyId);
    return { success: true };
  },
});

export const listSitesForAgency = query({
  args: { agencyId: v.id("agencies") },
  handler: async (ctx, { agencyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user?.isActive) return null;
    if (!user.isSuperAdmin && String(user.agencyId) !== String(agencyId)) return null;
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_agency", (q) => q.eq("agencyId", agencyId))
      .collect();
    return sites.map((s) => ({ ...s, id: s._id }));
  },
});
