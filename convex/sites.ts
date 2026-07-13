import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";

function toSiteResponse(site: any) {
  return {
    ...site,
    id: site._id,
    createdAt: new Date(site._creationTime).toISOString(),
    updatedAt: new Date(site._creationTime).toISOString(),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user || !user.isActive) return [];
    const all = await ctx.db.query("sites").collect();
    if (user.isSuperAdmin) return all.map(toSiteResponse);
    // Phase 10: agency admins see only their agency's sites
    if (user.isAgencyAdmin && user.agencyId) {
      return all
        .filter((s) => String(s.agencyId) === String(user.agencyId))
        .map(toSiteResponse);
    }
    const mySiteIds = new Set(user.roles.map((r) => r.siteId));
    return all.filter((s) => mySiteIds.has(s._id)).map(toSiteResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user || !user.isActive) return null;
    const site = await ctx.db.get(siteId);
    if (!site) return null;
    if (user.isSuperAdmin) return toSiteResponse(site);
    // Phase 10: agency admins can access sites belonging to their agency
    if (user.isAgencyAdmin && user.agencyId && String(site.agencyId) === String(user.agencyId)) {
      return toSiteResponse(site);
    }
    if (!user.roles.some((r: any) => r.siteId === siteId)) return null;
    return toSiteResponse(site);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    whiteLabelEnabled: v.optional(v.boolean()),
    poweredByFsts: v.optional(v.boolean()),
    websiteType: v.optional(v.string()),
    enabledModules: v.optional(v.any()),
    agencyId: v.optional(v.id("agencies")),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");

    const websiteType = args.websiteType ?? "business_website";
    const enabledModules = args.enabledModules ?? defaultModules(websiteType);

    const siteId = await ctx.db.insert("sites", {
      name: args.name,
      slug: args.slug,
      status: args.status ?? "active",
      domain: args.domain,
      logoUrl: args.logoUrl,
      faviconUrl: args.faviconUrl,
      brandColorPrimary: args.brandColorPrimary ?? "#1d4ed8",
      brandColorSecondary: args.brandColorSecondary ?? "#0f172a",
      whiteLabelEnabled: args.whiteLabelEnabled ?? false,
      poweredByFsts: args.poweredByFsts ?? true,
      websiteType,
      enabledModules,
      agencyId: args.agencyId,
    });

    await ctx.db.insert("crmConnections", {
      siteId,
      provider: "operon",
      status: "not_connected",
      authMethod: "api_key",
      ssoEnabled: false,
      apiHealth: "unknown",
    });

    await ctx.db.insert("homepageContent", {
      siteId,
      heroHeadline: `Welcome to ${args.name}`,
      heroSubheadline: "Edit this hero section from the Homepage editor.",
      sections: [],
    });

    await ctx.db.insert("footerContent", {
      siteId,
      columns: [],
      socialLinks: [],
      copyrightText: `© ${new Date().getFullYear()} ${args.name}. All rights reserved.`,
    });

    await ctx.db.insert("contactInfo", {
      siteId,
      email: "",
      phone: "",
      address: "",
      hours: [],
    });

    await ctx.db.insert("seoSettings", {
      siteId,
      pagePath: "/",
      title: args.name,
      description: `${args.name} — powered by Full Stack Tech Solutions.`,
    });

    if (!user.isSuperAdmin) {
      await ctx.db.patch(user._id, {
        roles: [...user.roles, { siteId, role: "client_admin" }],
      });
    }

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "site",
      page: "Site Onboarding",
    });

    const site = await ctx.db.get(siteId);
    return toSiteResponse(site!);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    whiteLabelEnabled: v.optional(v.boolean()),
    poweredByFsts: v.optional(v.boolean()),
    websiteType: v.optional(v.string()),
    enabledModules: v.optional(v.any()),
    agencyId: v.optional(v.id("agencies")),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    const patch: Record<string, unknown> = { ...fields };
    if (fields.websiteType && !fields.enabledModules) {
      patch.enabledModules = defaultModules(fields.websiteType);
    }
    await ctx.db.patch(siteId, patch as any);
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    return toSiteResponse(site);
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    await ctx.db.delete(siteId);
    return { success: true };
  },
});

export const markReviewsWidgetInlineUsed = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requireAuth(ctx);
    if (!user || !user.isActive) throw new Error("Forbidden");
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    if (
      !user.isSuperAdmin &&
      !(user.isAgencyAdmin && user.agencyId && String(site.agencyId) === String(user.agencyId)) &&
      !user.roles.some((r: any) => r.siteId === siteId)
    ) {
      throw new Error("Forbidden");
    }
    if (!site.reviewsWidgetInlineEverUsed) {
      await ctx.db.patch(siteId, { reviewsWidgetInlineEverUsed: true });
    }
    return { success: true };
  },
});

export const markReviewsWidgetCdnMigrated = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await requireAuth(ctx);
    if (!user || !user.isActive) throw new Error("Forbidden");
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    if (
      !user.isSuperAdmin &&
      !(user.isAgencyAdmin && user.agencyId && String(site.agencyId) === String(user.agencyId)) &&
      !user.roles.some((r: any) => r.siteId === siteId)
    ) {
      throw new Error("Forbidden");
    }
    await ctx.db.patch(siteId, { reviewsWidgetCdnMigrated: true });
    return { success: true };
  },
});

export const getDashboardSummary = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user || !user.isActive) return null;
    if (!user.isSuperAdmin && !user.roles.some((r: any) => r.siteId === siteId)) return null;

    const [site, courses, events, articles, media, backups, squareConfig, contactInfo, emailSettings, recentActivity] =
      await Promise.all([
        ctx.db.get(siteId),
        ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("backups").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(1),
        ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("activityLog").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(10),
      ]);

    if (!site) return null;

    return {
      siteId,
      courseCount: courses.length,
      eventCount: events.length,
      articleCount: articles.length,
      mediaCount: media.length,
      lastBackupAt: backups[0] ? new Date(backups[0]._creationTime).toISOString() : null,
      squareConnected: squareConfig?.connected ?? false,
      emailConfigured: !!(emailSettings?.fromEmail),
      formsConfigured: !!(contactInfo?.email),
      websiteOnline: null as boolean | null,
      sslActive: null as boolean | null,
      responseTimeMs: null as number | null,
      recentActivity: recentActivity.map((a) => ({
        ...a,
        id: a._id,
        createdAt: new Date(a._creationTime).toISOString(),
      })),
    };
  },
});

/**
 * Returns the effective module map for a site, merging site-level enabledModules
 * with agency-level feature flags. A module is enabled only if BOTH the site has
 * it enabled AND the agency (if any) has the corresponding feature flag enabled.
 *
 * Agency flag → module key mapping:
 *   crm             → crm
 *   ecommerce       → payments, commerce
 *   forms           → forms (sidebar-only)
 *   media           → media
 *   backups         → backups (sidebar-only)
 *   version_history → history (sidebar-only)
 */
export const getEffectiveModules = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user || !user.isActive) return null;

    const site = await ctx.db.get(siteId);
    if (!site) return null;

    // Enforce same access control as sites.get
    if (!user.isSuperAdmin) {
      if (user.isAgencyAdmin && user.agencyId) {
        if (String(site.agencyId) !== String(user.agencyId)) return null;
      } else if (!user.roles.some((r: any) => r.siteId === siteId)) {
        return null;
      }
    }

    const siteModules: Record<string, boolean> = (site.enabledModules as Record<string, boolean>) ?? {};

    if (!site.agencyId) return siteModules;

    const agency = await ctx.db.get(site.agencyId);
    if (!agency) return siteModules;

    const agencyFlags: Record<string, boolean> = (agency.featureFlags as Record<string, boolean>) ?? {};
    const agencyModules: Record<string, boolean> = (agencyFlags._modules as unknown as Record<string, boolean>) ?? {};

    // Agency-level feature flag enforcement
    const FLAG_TO_MODULES: Record<string, string[]> = {
      crm: ["crm"],
      ecommerce: ["payments", "commerce"],
      forms: ["forms"],
      media: ["media"],
      backups: ["backups"],
      version_history: ["history"],
    };

    const effective = { ...siteModules };

    // If agency disables a feature flag entirely, disable all corresponding modules
    for (const [flag, modules] of Object.entries(FLAG_TO_MODULES)) {
      if (agencyFlags[flag] === false) {
        for (const mod of modules) {
          effective[mod] = false;
        }
      }
    }

    // Also apply agency _modules overrides if present
    for (const [key, value] of Object.entries(agencyModules)) {
      if (value === false) {
        effective[key] = false;
      }
    }

    return effective;
  },
});

function defaultModules(websiteType: string): Record<string, boolean> {
  const ALL_ON = {
    homepage: true, courses: true, events: true, articles: true,
    media: true, contact: true, footer: true, seo: true,
    payments: true, email: true, crm: true, reviews: true,
  };
  const OFF: Record<string, string[]> = {
    business_website: ["courses", "events"],
    ecommerce: ["courses", "events"],
    church: ["courses"],
    property_management: ["courses", "events"],
    medical: ["courses", "events"],
    legal: ["courses", "events"],
    restaurant: ["courses", "articles"],
    professional_services: ["courses", "events"],
    construction: ["courses", "events"],
    real_estate: ["courses", "events"],
    manufacturing: ["courses", "events"],
  };
  const mods = { ...ALL_ON };
  for (const key of (OFF[websiteType] ?? [])) {
    (mods as any)[key] = false;
  }
  return mods;
}
