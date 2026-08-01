/**
 * Test-environment provisioning helpers — FSTS-WOS™
 *
 * These mutations are ONLY available when CONVEX_TEST_MODE=true and the
 * deployment is NOT marked as production (CONVEX_DEPLOYMENT_ENVIRONMENT ≠ "production").
 * They bypass the Clerk JWT / provisionUser() requirement so that CI and
 * one-time setup scripts can seed the database without a browser session.
 *
 * Security model: identical to users:upsertTestSuperAdmin — fails closed
 * on production deployments via requireTestEnvironment().
 *
 * Usage: called from scripts/provision-corsair.mjs (Task #36 onboarding)
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireTestEnvironment } from "./lib/testMode";

/* ── helpers ──────────────────────────────────────────────────────────── */

function defaultModules(websiteType: string) {
  const base = {
    homepage: true,
    courses: false,
    events: false,
    articles: false,
    media: true,
    contact: true,
    footer: true,
    seo: true,
    payments: false,
    email: false,
    crm: false,
  };
  if (websiteType === "training_academy") {
    return { ...base, courses: true, events: true, articles: true, payments: true, email: true, crm: true };
  }
  return base;
}

/* ── Agency ───────────────────────────────────────────────────────────── */

/**
 * Create or update an Agency record without requiring Clerk auth.
 * Test-only. Idempotent on slug.
 */
export const upsertTestAgency = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    supportEmail: v.string(),
    billingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireTestEnvironment("provision.upsertTestAgency");

    const existing = await ctx.db
      .query("agencies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        primaryColor: args.primaryColor ?? existing.primaryColor,
        accentColor: args.accentColor ?? existing.accentColor,
        supportEmail: args.supportEmail,
        billingNotes: args.billingNotes ?? existing.billingNotes,
        isActive: true,
        licensingStatus: "active",
      });
      return existing._id;
    }

    return await ctx.db.insert("agencies", {
      name: args.name,
      slug: args.slug,
      primaryColor: args.primaryColor ?? "#1d4ed8",
      accentColor: args.accentColor ?? "#0f172a",
      supportEmail: args.supportEmail,
      featureFlags: {},
      licensingStatus: "active",
      billingNotes: args.billingNotes,
      isActive: true,
    });
  },
});

/* ── Site ─────────────────────────────────────────────────────────────── */

/**
 * Create or update a Site record without requiring Clerk auth.
 * Test-only. Idempotent on slug.
 * Also seeds homepageContent, footerContent, contactInfo, crmConnections, seoSettings.
 */
export const upsertTestSite = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    domain: v.optional(v.string()),
    status: v.optional(v.string()),
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    websiteType: v.optional(v.string()),
    enabledModules: v.optional(v.any()),
    agencyId: v.optional(v.id("agencies")),
  },
  handler: async (ctx, args) => {
    requireTestEnvironment("provision.upsertTestSite");

    const websiteType = args.websiteType ?? "business_website";
    const enabledModules = args.enabledModules ?? defaultModules(websiteType);

    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    let siteId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        domain: args.domain ?? existing.domain,
        status: args.status ?? existing.status,
        brandColorPrimary: args.brandColorPrimary ?? existing.brandColorPrimary,
        brandColorSecondary: args.brandColorSecondary ?? existing.brandColorSecondary,
        websiteType,
        enabledModules,
        agencyId: args.agencyId ?? existing.agencyId,
      });
      siteId = existing._id;
    } else {
      siteId = await ctx.db.insert("sites", {
        name: args.name,
        slug: args.slug,
        status: args.status ?? "active",
        domain: args.domain,
        brandColorPrimary: args.brandColorPrimary ?? "#1d4ed8",
        brandColorSecondary: args.brandColorSecondary ?? "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType,
        enabledModules,
        agencyId: args.agencyId,
      });

      // Seed sub-tables (same as sites:create)
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
    }

    return siteId;
  },
});

/* ── User role assignment ─────────────────────────────────────────────── */

/**
 * Create or update a pending user with site-role assignments.
 * Test-only. Complements upsertTestSuperAdmin for non-superadmin users.
 */
export const upsertTestUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    isSuperAdmin: v.optional(v.boolean()),
    agencyId: v.optional(v.id("agencies")),
    isAgencyAdmin: v.optional(v.boolean()),
    roleAssignments: v.optional(
      v.array(v.object({ siteId: v.id("sites"), role: v.string() })),
    ),
  },
  handler: async (ctx, args) => {
    requireTestEnvironment("provision.upsertTestUser");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        isSuperAdmin: args.isSuperAdmin ?? existing.isSuperAdmin,
        isActive: true,
        roles: args.roleAssignments ?? existing.roles,
        agencyId: args.agencyId ?? existing.agencyId,
        isAgencyAdmin: args.isAgencyAdmin ?? existing.isAgencyAdmin,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkUserId: `pending:${args.email}`,
      name: args.name,
      email: args.email,
      isSuperAdmin: args.isSuperAdmin ?? false,
      isActive: true,
      roles: args.roleAssignments ?? [],
      agencyId: args.agencyId,
      isAgencyAdmin: args.isAgencyAdmin ?? false,
    });
  },
});

/* ── Read-back query ──────────────────────────────────────────────────── */

/**
 * Read back provisioning state for verification.
 * Test-only.
 */
export const verifyProvisioning = query({
  args: { agencySlug: v.string(), siteSlug: v.string(), adminEmail: v.string() },
  handler: async (ctx, { agencySlug, siteSlug, adminEmail }) => {
    requireTestEnvironment("provision.verifyProvisioning");

    const agency = await ctx.db
      .query("agencies")
      .withIndex("by_slug", (q) => q.eq("slug", agencySlug))
      .first();

    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", siteSlug))
      .first();

    const admin = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .first();

    return {
      agency: agency
        ? { id: agency._id, name: agency.name, slug: agency.slug, isActive: agency.isActive }
        : null,
      site: site
        ? { id: site._id, name: site.name, slug: site.slug, domain: site.domain, status: site.status }
        : null,
      admin: admin
        ? { id: admin._id, email: admin.email, roles: admin.roles, isAgencyAdmin: admin.isAgencyAdmin }
        : null,
    };
  },
});
