/**
 * FSTS-WOS™ — Add-on Catalog & Site Add-on Management
 *
 * Manages the master add-on catalog and per-site activation records.
 * SuperAdmin controls activation; clients can request and view status.
 *
 * Billing fields are present and schema-ready but not wired to a provider yet.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, provisionUser } from "./lib/getCurrentUser";

/**
 * PRODUCTION SAFETY GATE
 * seedCatalog is a dev/ops utility that must never run against the production
 * deployment unless explicitly unlocked.  Set SEED_ALLOWED=true as a Convex
 * environment variable to enable it, and unset it before going to production.
 */
function assertSeedAllowed() {
  if (process.env.SEED_ALLOWED !== "true") {
    throw new Error(
      "Seed mutations are disabled on this deployment. " +
        "Set the SEED_ALLOWED=true Convex environment variable to enable them. " +
        "This variable must NOT be set on the production deployment."
    );
  }
}

// ── Catalog seed data ──────────────────────────────────────────────────────

const CATALOG_SEED = [
  {
    slug: "social-publisher-pro",
    name: "Social Publisher Pro",
    description: "Schedule and publish content across Facebook, Instagram, LinkedIn, and X directly from the dashboard.",
    category: "marketing",
    iconName: "Share2",
    pricingTier: "professional",
    monthlyPriceUsd: 49,
    annualPriceUsd: 470,
    isActive: true,
    isBeta: false,
    features: [
      "Multi-platform scheduling (FB, IG, LinkedIn, X)",
      "Visual content calendar",
      "Performance analytics per post",
      "AI caption suggestions",
    ],
    eligiblePlans: ["starter", "professional", "enterprise"],
    trialDays: 14,
    sortOrder: 1,
  },
  {
    slug: "ai-blog-writer",
    name: "AI Blog Writer",
    description: "Generate, edit, and publish SEO-optimised blog posts using AI trained on your brand voice.",
    category: "content",
    iconName: "PenLine",
    pricingTier: "professional",
    monthlyPriceUsd: 39,
    annualPriceUsd: 370,
    isActive: true,
    isBeta: false,
    features: [
      "AI-generated drafts from a topic prompt",
      "Brand-voice calibration",
      "Built-in keyword optimisation",
      "One-click publish to your blog",
    ],
    eligiblePlans: ["professional", "enterprise"],
    trialDays: 14,
    sortOrder: 2,
  },
  {
    slug: "smart-seo-pro",
    name: "Smart SEO Pro",
    description: "Automated technical SEO audits, on-page recommendations, and schema markup generation.",
    category: "seo",
    iconName: "SearchCode",
    pricingTier: "starter",
    monthlyPriceUsd: 29,
    annualPriceUsd: 278,
    isActive: true,
    isBeta: false,
    features: [
      "Automated weekly SEO audits",
      "Page-by-page score with fix list",
      "Schema markup generator (JSON-LD)",
      "Sitemap & robots.txt management",
    ],
    eligiblePlans: ["starter", "professional", "enterprise"],
    trialDays: 14,
    sortOrder: 3,
  },
  {
    slug: "website-health-pro",
    name: "Website Health Pro",
    description: "Uptime monitoring, broken-link detection, Core Web Vitals tracking, and instant alerts.",
    category: "health",
    iconName: "Activity",
    pricingTier: "starter",
    monthlyPriceUsd: 19,
    annualPriceUsd: 182,
    isActive: true,
    isBeta: false,
    features: [
      "Real-time uptime monitoring",
      "Broken-link scanner",
      "Core Web Vitals dashboard",
      "Email + SMS alerts",
    ],
    eligiblePlans: ["starter", "professional", "enterprise"],
    trialDays: 14,
    sortOrder: 4,
  },
  {
    slug: "accessibility-pro",
    name: "Accessibility Pro",
    description: "Automated WCAG 2.1 AA compliance scanning, remediation guidance, and accessibility widget.",
    category: "accessibility",
    iconName: "ShieldCheck",
    pricingTier: "starter",
    monthlyPriceUsd: 19,
    annualPriceUsd: 182,
    isActive: true,
    isBeta: true,
    features: [
      "WCAG 2.1 AA automated scan",
      "Prioritised fix list with code hints",
      "Accessibility widget for visitors",
      "Compliance certificate PDF",
    ],
    eligiblePlans: ["professional", "enterprise"],
    trialDays: 14,
    sortOrder: 5,
  },
  {
    slug: "forms-pro",
    name: "Forms Pro",
    description: "Multi-step forms, conditional logic, file uploads, e-signatures, and Zapier integration.",
    category: "forms",
    iconName: "ClipboardList",
    pricingTier: "starter",
    monthlyPriceUsd: 24,
    annualPriceUsd: 230,
    isActive: true,
    isBeta: false,
    features: [
      "Drag-and-drop multi-step forms",
      "Conditional field logic",
      "File upload & e-signature fields",
      "Zapier / webhook output",
    ],
    eligiblePlans: ["starter", "professional", "enterprise"],
    trialDays: 14,
    sortOrder: 6,
  },
];

// ── Queries ────────────────────────────────────────────────────────────────

/** All active add-ons. Available to any authenticated user. */
export const listCatalog = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("addOnCatalog")
      .collect();
    return items
      .filter((a) => a.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

/** Add-on assignments for a site, joined with catalog data. */
export const getSiteAddOns = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const site = await ctx.db.get(args.siteId);
    if (!site) return [];
    // For now only superAdmins can list site add-ons.
    // Client-facing access will be added in a future phase.
    if (!user.isSuperAdmin) return [];
    const assignments = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();
    const catalog = await ctx.db.query("addOnCatalog").collect();
    const catalogMap = new Map(catalog.map((c) => [c._id.toString(), c]));
    return assignments.map((a) => ({
      ...a,
      addOn: catalogMap.get(a.addOnId.toString()) ?? null,
    }));
  },
});

/** Full catalog enriched with this site's status for each entry. */
export const getCatalogWithSiteStatus = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");
    const catalog = await ctx.db
      .query("addOnCatalog")
      .collect();
    const assignments = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();
    const assignmentMap = new Map(
      assignments.map((a) => [a.addOnId.toString(), a])
    );
    return catalog
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        ...c,
        assignment: assignmentMap.get(c._id.toString()) ?? null,
      }));
  },
});

// ── SuperAdmin mutations ───────────────────────────────────────────────────

export const enableAddOn = mutation({
  args: {
    siteId: v.id("sites"),
    addOnId: v.id("addOnCatalog"),
    overriddenPriceUsd: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");
    const now = Date.now();
    const existing = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site_addon", (q) =>
        q.eq("siteId", args.siteId).eq("addOnId", args.addOnId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "enabled",
        enabledAt: now,
        enabledByUserId: user._id,
        overriddenPriceUsd: args.overriddenPriceUsd,
        notes: args.notes,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("siteAddOns", {
      siteId: args.siteId,
      addOnId: args.addOnId,
      status: "enabled",
      enabledAt: now,
      enabledByUserId: user._id,
      overriddenPriceUsd: args.overriddenPriceUsd,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const disableAddOn = mutation({
  args: {
    siteId: v.id("sites"),
    addOnId: v.id("addOnCatalog"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");
    const now = Date.now();
    const existing = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site_addon", (q) =>
        q.eq("siteId", args.siteId).eq("addOnId", args.addOnId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "disabled",
        notes: args.notes,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("siteAddOns", {
      siteId: args.siteId,
      addOnId: args.addOnId,
      status: "disabled",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const startTrial = mutation({
  args: {
    siteId: v.id("sites"),
    addOnId: v.id("addOnCatalog"),
    trialDays: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");
    const now = Date.now();
    const addOn = await ctx.db.get(args.addOnId);
    if (!addOn) throw new Error("Add-on not found");
    const days = args.trialDays ?? addOn.trialDays ?? 14;
    const trialEndsAt = now + days * 24 * 60 * 60 * 1000;
    const existing = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site_addon", (q) =>
        q.eq("siteId", args.siteId).eq("addOnId", args.addOnId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "trial",
        enabledAt: now,
        trialEndsAt,
        enabledByUserId: user._id,
        notes: args.notes,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("siteAddOns", {
      siteId: args.siteId,
      addOnId: args.addOnId,
      status: "trial",
      enabledAt: now,
      trialEndsAt,
      enabledByUserId: user._id,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateOverride = mutation({
  args: {
    siteAddOnId: v.id("siteAddOns"),
    overriddenPriceUsd: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");
    await ctx.db.patch(args.siteAddOnId, {
      overriddenPriceUsd: args.overriddenPriceUsd,
      notes: args.notes,
      updatedAt: Date.now(),
    });
  },
});

/** Client-facing: request an add-on (creates a pending record). */
export const requestAddOn = mutation({
  args: {
    siteId: v.id("sites"),
    addOnId: v.id("addOnCatalog"),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("siteAddOns")
      .withIndex("by_site_addon", (q) =>
        q.eq("siteId", args.siteId).eq("addOnId", args.addOnId)
      )
      .first();
    if (existing) return existing._id; // already has an assignment
    return ctx.db.insert("siteAddOns", {
      siteId: args.siteId,
      addOnId: args.addOnId,
      status: "pending",
      enabledByUserId: user._id,
      notes: `Requested by ${user.name} (${user.email})`,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Idempotent catalog seed — safe to run multiple times.
 * No dashboard auth required because this only inserts known static pricing
 * data and the check-by-slug prevents duplicate rows.  The SEED_ALLOWED gate
 * prevents it from running against the production deployment.  Call via:
 *   npx convex env set SEED_ALLOWED true   # dev deployment only
 *   npx convex run addons:seedCatalog
 */
export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    assertSeedAllowed();
    let created = 0;
    let skipped = 0;
    for (const item of CATALOG_SEED) {
      const existing = await ctx.db
        .query("addOnCatalog")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .first();
      if (existing) {
        skipped += 1;
        continue;
      }
      await ctx.db.insert("addOnCatalog", item);
      created += 1;
    }
    return { created, skipped };
  },
});
