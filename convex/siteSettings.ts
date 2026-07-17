import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { recordVersion } from "./lib/recordVersion";

function toResponse(doc: any) {
  return { ...doc, id: doc._id };
}

const EMPTY: Record<string, unknown> = {
  businessName: null,
  tagline: null,
  logoUrl: null,
  faviconUrl: null,
  websiteType: null,
  timezone: "America/New_York",
  brandColorPrimary: "#1d4ed8",
  brandColorSecondary: "#0f172a",
  brandColorAccent: "#7c3aed",
  fontHeading: "system",
  fontBody: "system",
  phone: null,
  email: null,
  address: null,
  businessHours: null,
  socialLinks: null,
  seoGlobalTitle: null,
  seoGlobalDescription: null,
  seoOgImageUrl: null,
  analyticsGa4: null,
  analyticsGtm: null,
  analyticsPixel: null,
  cookieConsentEnabled: false,
  cookiePolicyUrl: null,
  privacyPolicyUrl: null,
  termsOfServiceUrl: null,
  identityUpdatedAt: null,
  brandingUpdatedAt: null,
  contactUpdatedAt: null,
  seoUpdatedAt: null,
  integrationsUpdatedAt: null,
  legalUpdatedAt: null,
};

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (!doc) return { ...EMPTY, siteId };
    return toResponse(doc);
  },
});

export const updateIdentity = mutation({
  args: {
    siteId: v.id("sites"),
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    websiteType: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const patch = { ...fields, identityUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_identity", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_identity", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const updateBranding = mutation({
  args: {
    siteId: v.id("sites"),
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    brandColorAccent: v.optional(v.string()),
    fontHeading: v.optional(v.string()),
    fontBody: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const patch = { ...fields, brandingUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_branding", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_branding", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const updateContact = mutation({
  args: {
    siteId: v.id("sites"),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    businessHours: v.optional(v.any()),
    socialLinks: v.optional(v.any()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    // Merge incoming socialLinks with the stored record so that:
    // - platforms absent from the payload are preserved
    // - platforms present with an empty string keep their stored value
    let mergedSocialLinks = fields.socialLinks;
    if (fields.socialLinks !== undefined && existing?.socialLinks && typeof existing.socialLinks === "object") {
      const stored = existing.socialLinks as Record<string, string>;
      const incoming = fields.socialLinks as Record<string, string>;
      const merged: Record<string, string> = { ...stored };
      for (const key of Object.keys(incoming)) {
        const val = incoming[key];
        if (val && val.trim() !== "") {
          merged[key] = val;
        }
      }
      mergedSocialLinks = merged;
    }

    const patch = { ...fields, socialLinks: mergedSocialLinks, contactUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_contact", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_contact", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const updateSeo = mutation({
  args: {
    siteId: v.id("sites"),
    seoGlobalTitle: v.optional(v.string()),
    seoGlobalDescription: v.optional(v.string()),
    seoOgImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const patch = { ...fields, seoUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_seo", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_seo", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const updateIntegrations = mutation({
  args: {
    siteId: v.id("sites"),
    analyticsGa4: v.optional(v.string()),
    analyticsGtm: v.optional(v.string()),
    analyticsPixel: v.optional(v.string()),
    cookieConsentEnabled: v.optional(v.boolean()),
    cookiePolicyUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const patch = { ...fields, integrationsUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_integrations", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_integrations", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const updateLegal = mutation({
  args: {
    siteId: v.id("sites"),
    privacyPolicyUrl: v.optional(v.string()),
    termsOfServiceUrl: v.optional(v.string()),
    cookiePolicyUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const patch = { ...fields, legalUpdatedAt: Date.now() };
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("siteSettings", { siteId, ...patch });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "site_settings_legal", page: "Website Settings", previousValue: existing, newValue: doc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "site_settings_legal", entityId: docId, snapshot: doc });
    return toResponse(doc);
  },
});

export const generateUploadUrl = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    // SECURITY: uploads must be requested by a user with write access to the site.
    await requireSiteAccessMutation(ctx, siteId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    // SECURITY: only authenticated, active dashboard users may resolve storage URLs.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user || !user.isActive) throw new Error("Forbidden");
    return await ctx.storage.getUrl(storageId);
  },
});
