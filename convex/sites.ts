import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

// ── P4: slug + status helpers (ported from onboarding.ts wizard parity) ─────
// The Global Sites "Create Site" dialog previously stored whatever slug the
// caller typed (or nothing) with no normalization and no uniqueness check.
// Public lookups (publicBrandBySlug, getSiteBySlug, getNavigationBySlug, ...)
// resolve via by_slug .first(), so a duplicate or malformed slug would serve
// one tenant's site to another — or break lookups entirely. The wizard path
// (onboarding.launch) always slugifies and de-duplicates; this brings the
// dialog path to parity.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const SITE_STATUSES = ["active", "staging", "archived"] as const;

// Module key -> primary nav entry. Mirrors the wizard's NAV_PAGE_MAP so a
// site created from the dialog ships with the same visible menu the wizard
// would seed (home + about + contact always; other pages when the matching
// module is enabled). hrefs are the public website routes the seeded
// navigationItems are consumed against (public.getNavigationBySlug).
const MODULE_NAV_MAP: Record<string, { label: string; href: string }> = {
  homepage: { label: "Home", href: "/" },
  articles: { label: "Blog", href: "/blog" },
  contact: { label: "Contact", href: "/contact" },
  products: { label: "Products", href: "/products" },
  events: { label: "Events", href: "/events" },
  courses: { label: "Courses", href: "/courses" },
  media: { label: "Media", href: "/media" },
};

// P4 helper: resolve a slug that is guaranteed unique (by_slug is not a
// unique index, so uniqueness is enforced here before insert). Throws after
// 50 collisions so a pathological caller cannot loop forever.
async function resolveUniqueSlug(ctx: MutationCtx, base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!existing) return slug;
    attempt += 1;
    if (attempt > 50) {
      throw new Error(
        "Could not generate a unique slug — please choose a different site name.",
      );
    }
    slug = `${base}-${attempt + 1}`;
  }
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

/**
 * Returns the site list enriched with the latest health-scan score and
 * last-activity timestamp for each site.  Used by the Platform Admin home
 * (SitesList) so every site card can show a health indicator and "last
 * updated" without N+1 client-side queries.
 */
export const listWithHealth = query({
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
    let sites = user.isSuperAdmin
      ? all
      : user.isAgencyAdmin && user.agencyId
        ? all.filter((s) => String(s.agencyId) === String(user.agencyId))
        : all.filter((s) => user.roles.some((r: any) => r.siteId === s._id));

    // Enrich each site with its latest health scan + last activity
    const enriched = await Promise.all(
      sites.map(async (site) => {
        const [latestScan, lastActivity] = await Promise.all([
          ctx.db
            .query("websiteHealthScans")
            .withIndex("by_site_scannedAt", (q: any) => q.eq("siteId", site._id))
            .order("desc")
            .first(),
          ctx.db
            .query("activityLog")
            .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
            .order("desc")
            .first(),
        ]);
        return {
          ...toSiteResponse(site),
          healthScore: latestScan?.overallScore ?? null,
          lastScannedAt: latestScan ? new Date(latestScan.scannedAt).toISOString() : null,
          lastActivityAt: lastActivity ? new Date(lastActivity._creationTime).toISOString() : null,
        };
      }),
    );
    return enriched;
  },
});

/**
 * Cosmetic-only site brand context for the sign-in page (?site=slug).
 *
 * Public (unauthenticated) by design: returns ONLY the fields shown on the
 * branded login card — site name, logo, domain, and brand colors. Never
 * returns ids beyond the slug lookup, user data, or configuration. A missing
 * or unknown slug returns null so the login falls back to the standard TAYA
 * brand presentation.
 */
export const publicBrandBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site) return null;
    return {
      name: site.name,
      domain: site.domain ?? null,
      logoUrl: site.logoUrl ?? null,
      brandColorPrimary: site.brandColorPrimary ?? null,
      whiteLabelEnabled: site.whiteLabelEnabled === true,
    };
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

    // ── P4: slug + status + domain normalization ──────────────────────────
    // Slug: normalize what the caller sent; fall back to the site name when
    // empty. Guaranteed unique (see resolveUniqueSlug) — the dialog path used
    // to accept raw/duplicate slugs because by_slug is not a unique index.
    const baseSlug = slugify(args.slug) || slugify(args.name) || "new-site";
    const slug = await resolveUniqueSlug(ctx, baseSlug);

    // Status: whitelist the three legal lifecycle states. Unknown values
    // ("" or typos) previously fell through to the store verbatim.
    const status = (SITE_STATUSES as readonly string[]).includes(args.status ?? "")
      ? args.status!
      : "active";

    // Domain: strip protocol/trailing slash exactly like the wizard does.
    const domain = args.domain?.trim()
      ? args.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
      : undefined;

    const siteId = await ctx.db.insert("sites", {
      name: args.name,
      slug,
      status,
      domain,
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

    // ── P4: seed the public website menu from enabled modules ────────────
    // A site created from the dialog previously shipped with ZERO nav items,
    // so the client's public website rendered an empty menu. The wizard path
    // seeds nav from its page selections (onboarding.launch); this seeds the
    // equivalent entries from the dialog's enabled modules so both paths
    // produce an identical, usable starting menu.
    const navKeys = ["homepage", "about", "contact", "articles", "products", "events", "courses", "media"];
    let order = 0;
    for (const key of navKeys) {
      // about/contact are core pages every site ships with; the rest require
      // the matching module to be enabled.
      const moduleEnabled =
        key === "about" || key === "contact" ? true : enabledModules[key] === true;
      const entry =
        key === "about"
          ? { label: "About", href: "/about" }
          : MODULE_NAV_MAP[key];
      if (moduleEnabled && entry) {
        await ctx.db.insert("navigationItems", {
          siteId,
          label: entry.label,
          href: entry.href,
          isVisible: true,
          order: order++,
          openInNewTab: false,
        });
      }
    }

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "site",
      page: "Global Sites",
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

// ─── Site delete: full data-footprint cleanup (P4 follow-up) ────────────────
//
// Every table below stores per-site rows keyed by siteId. sites.remove
// previously deleted ONLY the sites doc, so every one of these rows was left
// dangling as an orphan: public queries keyed by siteId still "found" data
// for a site that no longer existed, and deleting test sites in production
// left permanent residue (20 orphaned navigationItems were found in prod).
// Deleting a site now removes its complete data footprint so slugs and ids
// can be safely reused.
//
// Deliberate exceptions:
//   • users — platform-level identities. NEVER deleted here; their per-site
//     roles are stripped instead (users.roles is the membership join record).
//   • registrations — no standalone by_site index; swept via its
//     by_site_entity prefix index instead.
//   • activityLog — swept too: activityLog.list requires a LIVE siteId, so
//     rows for a deleted site can never be read by anyone. Keeping them is
//     pure dead weight (the exact orphan class found in production).
//   • agencies / sites / addOnCatalog — global tables, not site-scoped.
export const SITE_SCOPED_TABLES = [
  // Content
  "articles",
  "courses",
  "events",
  "faqs",
  "testimonials",
  "teamMembers",
  "jobPostings",
  "siteServices",
  "siteProducts",
  "downloadableResources",
  "pricingTiers",
  "flyers",
  "forms",
  "formSubmissions",
  "mediaAssets",
  // Page / layout / config (seeded by sites.create + onboarding.launch)
  "homepageContent",
  "footerContent",
  "contactInfo",
  "seoSettings",
  "navigationItems",
  "announcementBanner",
  "siteCtaConfig",
  "popupConfig",
  "siteSettings",
  "siteRoleOverrides",
  "contentVersions",
  "policyPages",
  // Bookings (siteId-prefixed by_site_entity index — no standalone by_site)
  "registrations",
  // Integrations / sync / commerce
  "crmConnections",
  "crmEntitySyncSettings",
  "crmSyncLogs",
  "crmInboundRecords",
  "emailSettings",
  "paymentConnectors",
  "paymentEvents",
  "squareConfig",
  "squareCatalogItems",
  "squareOrders",
  "squareDiscounts",
  "squareCatalogMappings",
  "reviewSources",
  "importedReviews",
  "reviewDisplaySettings",
  // Automation
  "automationRules",
  "automationRunLog",
  // Client portal
  "portalConfigs",
  "portalUsers",
  "portalSessions",
  // Health / monitoring / ops / audit trail
  "siteHealthLogs",
  "websiteHealthScans",
  "healthNotifications",
  "backups",
  "activityLog",
  // Add-ons + onboarding
  "siteAddOns",
  "onboardingProgress",
] as const;

// Convex file-storage blobs owned by a mediaAssets row (mirrors media.ts).
const MEDIA_STORAGE_FIELDS = [
  "storageId",
  "thumbStorageId",
  "smallStorageId",
  "mediumStorageId",
  "largeStorageId",
  "heroStorageId",
] as const;

/** Collect every row of a site-scoped table that belongs to `siteId`. */
async function siteRows(ctx: MutationCtx, table: string, siteId: Id<"sites">) {
  const index = table === "registrations" ? "by_site_entity" : "by_site";
  return await (ctx.db as any)
    .query(table)
    .withIndex(index, (q: any) => q.eq("siteId", siteId))
    .collect();
}

/** Release every storage blob referenced by a mediaAssets row. */
async function deleteMediaBlobs(ctx: MutationCtx, row: any) {
  for (const field of MEDIA_STORAGE_FIELDS) {
    const storageId = row[field];
    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // Blob already gone — the doc delete below is what matters.
      }
    }
  }
}

/**
 * Delete a site's complete data footprint: every row in every site-scoped
 * table, the media storage blobs those rows reference, and the per-site
 * roles on platform users. Convex mutations are atomic — if any step fails
 * the whole deletion rolls back.
 */
async function deleteSiteData(ctx: MutationCtx, siteId: Id<"sites">) {
  for (const table of SITE_SCOPED_TABLES) {
    const rows = await siteRows(ctx, table, siteId);
    for (const row of rows) {
      if (table === "mediaAssets") {
        await deleteMediaBlobs(ctx, row);
      }
      await ctx.db.delete(row._id);
    }
  }

  // users are platform identities — never deleted — but ghost site roles
  // (the membership join record) must go with the site.
  const users = await ctx.db.query("users").collect();
  for (const u of users) {
    if (u.roles.some((r: any) => r.siteId === siteId)) {
      await ctx.db.patch(u._id, {
        roles: u.roles.filter((r: any) => r.siteId !== siteId),
      } as any);
    }
  }
}

export const remove = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");

    await deleteSiteData(ctx, siteId);
    await ctx.db.delete(siteId);
    return { success: true };
  },
});

/**
 * One-time production maintenance mutation: sweep every site-scoped row whose
 * siteId points at a site that no longer exists — orphans left behind by the
 * OLD sites.remove that deleted only the sites doc (20 orphaned
 * navigationItems were found in production this way). SuperAdmin only.
 * Never touches rows that belong to a live site. Returns per-table deleted
 * counts (+ stripped ghost user roles) so the cleanup is fully evidenced.
 */
export const purgeOrphanedSiteData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");

    const liveSites = await ctx.db.query("sites").collect();
    const liveIds = new Set(liveSites.map((s: any) => String(s._id)));

    const deleted: Record<string, number> = {};
    for (const table of SITE_SCOPED_TABLES) {
      const rows = await (ctx.db as any).query(table).collect();
      let count = 0;
      for (const row of rows) {
        if (!row.siteId || liveIds.has(String(row.siteId))) continue;
        if (table === "mediaAssets") {
          await deleteMediaBlobs(ctx, row);
        }
        await ctx.db.delete(row._id);
        count++;
      }
      if (count > 0) deleted[table] = count;
    }

    // Strip ghost site roles (roles pointing at deleted sites) from users.
    let rolesStripped = 0;
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (u.roles.some((r: any) => !liveIds.has(String(r.siteId)))) {
        await ctx.db.patch(u._id, {
          roles: u.roles.filter((r: any) => liveIds.has(String(r.siteId))),
        } as any);
        rolesStripped++;
      }
    }

    return { liveSites: liveIds.size, deleted, rolesStripped };
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

/**
 * Client assignment status for every site the caller can administer
 * (superadmin: all sites; agency admin: agency sites; site-scoped
 * manage-capable users: their sites).
 *
 * Powers the "Client: Assigned / Not Assigned" status column in the Platform
 * Admin sites view and the review step of the onboarding wizard. Returns the
 * client owner (role "owner") plus a count of other assigned users.
 */
export const getClientAssignments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!me || !me.isActive) return [];

    const allSites = await ctx.db.query("sites").collect();
    let visible: typeof allSites;
    if (me.isSuperAdmin) {
      visible = allSites;
    } else if (me.isAgencyAdmin && me.agencyId) {
      visible = allSites.filter((s) => String(s.agencyId) === String(me.agencyId));
    } else {
      const mySiteIds = new Set((me.roles ?? []).map((r: any) => String(r.siteId)));
      visible = allSites.filter((s) => mySiteIds.has(String(s._id)));
    }

    const users = await ctx.db.query("users").collect();
    const bySite = new Map<string, { ownerName: string; ownerEmail: string; ownerConnected: boolean; otherUsers: number }>();
    for (const u of users) {
      for (const r of (u.roles ?? []) as Array<{ siteId: string; role: string }>) {
        const entry = bySite.get(String(r.siteId));
        if (r.role === "owner") {
          bySite.set(String(r.siteId), {
            ownerName: u.name,
            ownerEmail: u.email,
            ownerConnected: !u.clerkUserId?.startsWith("pending:"),
            otherUsers: entry?.otherUsers ?? 0,
          });
        } else if (entry) {
          entry.otherUsers += 1;
        }
      }
    }

    return visible.map((s) => ({
      siteId: s._id,
      siteName: s.name,
      owner: bySite.get(String(s._id)) ?? null,
    }));
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

    const now = Date.now();

    const [site, courses, events, articles, media, services, teamMembers, backups, squareConfig, contactInfo, emailSettings, recentActivity, recentSubmissions, seoSettings, recentMedia] =
      await Promise.all([
        ctx.db.get(siteId),
        ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("siteServices").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("teamMembers").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("backups").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(1),
        ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("emailSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
        ctx.db.query("activityLog").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(10),
        ctx.db.query("formSubmissions").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(5),
        ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
        ctx.db.query("mediaAssets").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(6),
      ]);

    if (!site) return null;

    // Compute article status counts
    const publishedArticles = articles.filter((a) => a.status === "published").length;
    const draftArticles = articles.filter((a) => a.status === "draft").length;

    // Compute upcoming events (startAt >= now, sorted ascending)
    const upcomingEvents = events
      .filter((e) => e.startAt >= now && e.status !== "archived")
      .sort((a, b) => a.startAt - b.startAt)
      .slice(0, 5)
      .map((e) => ({
        id: e._id,
        title: e.title,
        startAt: new Date(e.startAt).toISOString(),
        location: e.location ?? null,
      }));

    // Compute upcoming courses (startDateTime >= now if present)
    const upcomingCourses = courses
      .filter((c) => c.startDateTime && c.startDateTime >= now && c.status !== "archived")
      .sort((a, b) => (a.startDateTime ?? 0) - (b.startDateTime ?? 0))
      .slice(0, 5)
      .map((c) => ({
        id: c._id,
        title: c.title,
        startDateTime: c.startDateTime ? new Date(c.startDateTime).toISOString() : null,
      }));

    // Count unread form submissions
    const allSubmissions = await ctx.db
      .query("formSubmissions")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    const unreadCount = allSubmissions.filter((s) => !s.readAt).length;

    // SEO pages with at least a title set
    const seoPagesConfigured = seoSettings.filter((s) => s.title).length;

    // Recent media (latest 6)
    const recentMediaItems = recentMedia.map((m) => ({
      id: m._id,
      fileName: m.fileName,
      url: m.url ?? null,
      thumbnailUrl: m.thumbnailUrl ?? null,
      altText: m.altText ?? null,
      createdAt: new Date(m._creationTime).toISOString(),
    }));

    return {
      siteId,
      courseCount: courses.length,
      eventCount: events.length,
      articleCount: articles.length,
      serviceCount: services.length,
      teamCount: teamMembers.length,
      publishedArticles,
      draftArticles,
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
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s._id,
        formType: s.formType,
        submitterName: s.submitterName ?? null,
        submitterEmail: s.submitterEmail ?? null,
        status: s.status,
        submittedAt: new Date(s.submittedAt).toISOString(),
        readAt: s.readAt ? new Date(s.readAt).toISOString() : null,
      })),
      unreadSubmissionCount: unreadCount,
      upcomingEvents,
      upcomingCourses,
      seoPagesConfigured,
      recentMedia: recentMediaItems,
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
