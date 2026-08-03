/**
 * FSTS-WOS™ — Website Onboarding Wizard
 *
 * Manages the 10-step guided onboarding flow for adding a new website.
 * Progress is saved after every step so users can exit and resume.
 *
 * Security: all mutations require superAdmin. Clients cannot self-provision
 * through this API; FSTS staff complete onboarding on their behalf.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";
import { insertPlaceholderProducts } from "./products";

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function defaultModulesForType(
  websiteType: string,
  pages?: string[]
): Record<string, boolean> {
  const base: Record<string, boolean> = {
    homepage: true,
    courses: false,
    events: false,
    articles: false,
    products: false,
    media: true,
    contact: true,
    footer: true,
    seo: true,
    payments: false,
    email: false,
    crm: false,
  };
  const type = websiteType ?? "business_website";
  if (type === "training_academy" || type === "membership") {
    Object.assign(base, { courses: true, events: true, articles: true, email: true });
  } else if (type === "ecommerce") {
    Object.assign(base, { payments: true, email: true, products: true });
  } else if (type === "church") {
    Object.assign(base, { events: true, articles: true });
  }
  // Override with explicit page selections from the wizard
  if (pages) {
    if (pages.includes("products")) base.products = true;
    if (pages.includes("events")) base.events = true;
    if (pages.includes("blog")) base.articles = true;
  }
  return base;
}

// Pages that get primary navigation entries (privacy/terms go in footer only)
const NAV_PAGE_MAP: Record<string, { label: string; href: string }> = {
  home: { label: "Home", href: "/" },
  about: { label: "About", href: "/about" },
  services: { label: "Services", href: "/services" },
  products: { label: "Products", href: "/products" },
  blog: { label: "Blog", href: "/blog" },
  events: { label: "Events", href: "/events" },
  faq: { label: "FAQ", href: "/faq" },
  testimonials: { label: "Testimonials", href: "/testimonials" },
  team: { label: "Team", href: "/team" },
  contact: { label: "Contact", href: "/contact" },
  portfolio: { label: "Portfolio", href: "/portfolio" },
  resources: { label: "Resources", href: "/resources" },
  booking: { label: "Booking", href: "/booking" },
  membership: { label: "Membership", href: "/membership" },
};

// ── Session management ─────────────────────────────────────────────────────

export const createSession = mutation({
  args: {
    sessionKey: v.string(),
    agencyId: v.optional(v.id("agencies")),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");

    // Reuse existing in-progress session for this key
    const existing = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (existing) return { sessionKey: existing.sessionKey, id: existing._id };

    const id = await ctx.db.insert("onboardingProgress", {
      sessionKey: args.sessionKey,
      createdBy: user.clerkUserId,
      agencyId: args.agencyId,
      siteId: undefined,
      currentStep: 0,
      stepData: {},
      status: "in_progress",
    });
    return { sessionKey: args.sessionKey, id };
  },
});

export const saveStep = mutation({
  args: {
    sessionKey: v.string(),
    step: v.number(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden");

    const session = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!session) throw new Error("Session not found");
    if (session.createdBy !== user.clerkUserId) throw new Error("Forbidden");

    await ctx.db.patch(session._id, {
      currentStep: Math.max(session.currentStep, args.step + 1),
      stepData: { ...session.stepData, ...args.data },
    });
    return { ok: true };
  },
});

export const getSession = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const session = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    return session ?? null;
  },
});

export const listMySessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const clerkUserId = identity.subject;
    return await ctx.db
      .query("onboardingProgress")
      .withIndex("by_creator", (q) => q.eq("createdBy", clerkUserId))
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .order("desc")
      .take(10);
  },
});

export const abandonSession = mutation({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    const session = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!session) return;
    if (session.createdBy !== user.clerkUserId && !user.isSuperAdmin)
      throw new Error("Forbidden");
    await ctx.db.patch(session._id, { status: "abandoned" });
  },
});

// ── Launch (create site + seed all starter content) ────────────────────────

export const launch = mutation({
  args: {
    sessionKey: v.string(),
    stepData: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");

    const session = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!session) throw new Error("Session not found");
    if (session.status === "completed") throw new Error("Session already completed");

    const d = { ...session.stepData, ...args.stepData } as Record<string, any>;

    const businessName = (d.businessName ?? "New Website").trim();
    const websiteName = (d.websiteName ?? businessName).trim();
    const industry = d.industry ?? "business_website";
    const brandColorPrimary = d.brandColorPrimary ?? "#1d4ed8";
    const brandColorSecondary = d.brandColorSecondary ?? "#0f172a";
    const pages: string[] = d.pages ?? ["home", "about", "contact"];
    const integrations: string[] = d.integrations ?? [];
    const domainChoice = d.domainChoice ?? "later";
    const customDomain = d.customDomain ?? undefined;
    const agencyId = session.agencyId;

    // ── Generate unique slug ────────────────────────────────────────────
    const baseSlug = slugify(websiteName) || slugify(businessName) || "new-site";
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const existing = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existing) break;
      attempt += 1;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    // ── Determine domain ────────────────────────────────────────────────
    let domain: string | undefined;
    if (domainChoice === "existing" && customDomain) {
      domain = customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    } else if (domainChoice === "temp") {
      domain = `${slug}.fstsclientsystem.com`;
    }

    // ── Create site record ──────────────────────────────────────────────
    const siteId = await ctx.db.insert("sites", {
      name: websiteName,
      slug,
      status: "active",
      domain,
      brandColorPrimary,
      brandColorSecondary,
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: industry,
      enabledModules: defaultModulesForType(industry, pages),
      agencyId,
    });

    // ── Seed homepage content ───────────────────────────────────────────
    await ctx.db.insert("homepageContent", {
      siteId,
      heroHeadline: `Welcome to ${businessName}`,
      heroSubheadline: d.description
        ? d.description.slice(0, 120)
        : `${businessName} — ${websiteName}`,
      sections: [],
    });

    // ── Seed footer ─────────────────────────────────────────────────────
    await ctx.db.insert("footerContent", {
      siteId,
      columns: [],
      socialLinks: [],
      copyrightText: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
    });

    // ── Seed contact info ───────────────────────────────────────────────
    await ctx.db.insert("contactInfo", {
      siteId,
      email: d.email ?? "",
      phone: d.phone ?? "",
      address: d.address ?? "",
      hours: [],
    });

    // ── Seed SEO settings ───────────────────────────────────────────────
    await ctx.db.insert("seoSettings", {
      siteId,
      pagePath: "/",
      title: websiteName,
      description: d.description
        ? d.description.slice(0, 160)
        : `${websiteName} — powered by Full Stack Tech Solutions.`,
    });

    // ── Seed navigation from page selections ───────────────────────────
    const navPages = pages.filter(
      (p) => p !== "privacy_policy" && p !== "terms" && NAV_PAGE_MAP[p]
    );
    for (let i = 0; i < navPages.length; i++) {
      const navEntry = NAV_PAGE_MAP[navPages[i]];
      if (!navEntry) continue;
      await ctx.db.insert("navigationItems", {
        siteId,
        label: navEntry.label,
        href: navEntry.href,
        isVisible: true,
        order: i,
        openInNewTab: false,
      });
    }

    // ── Seed email settings if business email provided ─────────────────
    if (d.email) {
      await ctx.db.insert("emailSettings", {
        siteId,
        fromName: businessName,
        fromEmail: d.email,
        replyToEmail: d.email,
        notificationEmail: d.email,
        notifyOnNewLead: true,
        notifyOnBooking: true,
      });
    }

    // ── Seed policy page placeholders if selected ─────────────────────
    const policyPageTypes = pages.filter((p) =>
      ["privacy_policy", "terms"].includes(p)
    );
    for (const pageType of policyPageTypes) {
      const isPrivacy = pageType === "privacy_policy";
      await ctx.db.insert("policyPages", {
        siteId,
        policyType: isPrivacy ? "privacy" : "terms",
        content:
          `This ${isPrivacy ? "Privacy Policy" : "Terms & Conditions"} is a placeholder. ` +
          `Please update this content with your actual policy before going live.`,
        updatedAt: Date.now(),
      });
    }

    // ── Seed placeholder products if the Products page was selected ───
    if (pages.includes("products")) {
      // priceRange is an optional array of tier name strings that a future wizard
      // step may supply (e.g. ["Basic", "Pro", "Elite"]). Fall back to generic
      // names when the field is absent or has fewer than three entries.
      const rawTiers: string[] = Array.isArray(d.priceRange)
        ? (d.priceRange as unknown[]).filter(
            (t): t is string => typeof t === "string" && t.trim().length > 0
          )
        : [];
      const tierLabel = (idx: number, fallback: string): string =>
        rawTiers[idx]?.trim() || fallback;

      const tiers: [string, string, string] = [
        tierLabel(0, "Starter"),
        tierLabel(1, "Professional"),
        tierLabel(2, "Enterprise"),
      ];

      await insertPlaceholderProducts(ctx, siteId, { businessName, tiers });
    }

    // ── Provision selected add-ons as trials ─────────────────────────
    const addOnSelections: string[] = Array.isArray(d.addOnSelections)
      ? (d.addOnSelections as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    if (addOnSelections.length > 0) {
      const catalog = await ctx.db.query("addOnCatalog").collect();
      const now = Date.now();
      for (const slug of addOnSelections) {
        const addOn = catalog.find((c) => c.slug === slug);
        if (!addOn) continue; // catalog not seeded yet — skip gracefully
        const existing = await ctx.db
          .query("siteAddOns")
          .withIndex("by_site_addon", (q) =>
            q.eq("siteId", siteId).eq("addOnId", addOn._id)
          )
          .first();
        if (!existing) {
          const trialDays = addOn.trialDays ?? 14;
          await ctx.db.insert("siteAddOns", {
            siteId,
            addOnId: addOn._id,
            status: "trial",
            enabledAt: now,
            trialEndsAt: now + trialDays * 24 * 60 * 60 * 1000,
            enabledByUserId: user._id,
            notes: "Activated via onboarding wizard",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // ── CRM connection record ─────────────────────────────────────────
    await ctx.db.insert("crmConnections", {
      siteId,
      provider: "operon",
      status: integrations.includes("operon_crm") ? "pending" : "not_connected",
      authMethod: "api_key",
      ssoEnabled: false,
      apiHealth: "unknown",
    });

    // ── Log activity ──────────────────────────────────────────────────
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "site",
      page: "Onboarding Wizard",
      details: `Industry: ${industry} | Pages: ${navPages.length} | Integrations: ${integrations.join(", ") || "none"}`,
    });

    // ── Mark session complete ─────────────────────────────────────────
    await ctx.db.patch(session._id, {
      status: "completed",
      siteId,
      stepData: d,
    });

    return { siteId, slug, domain };
  },
});
