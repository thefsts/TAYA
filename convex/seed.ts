/**
 * FSTS-WOS™ — Development seed helpers
 *
 * These mutations insert test data directly without auth so they can be run
 * via `npx convex run seed:seedTestSite` from the CLI. They are idempotent
 * and safe to re-run. They must never be called from client UI code.
 *
 * Remove or gate with SEED_ALLOWED=false before a true public launch.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export const seedTestSite = mutation({
  args: {
    businessName: v.optional(v.string()),
    forceReseed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const biz = (args.businessName ?? "Apex Fitness Studio").trim();
    const slug = slugify(biz) || "apex-fitness-studio";

    // Idempotency check
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing && !args.forceReseed) {
      return { skipped: true, siteId: existing._id, slug, message: `Site '${slug}' already exists. Pass forceReseed:true to overwrite.` };
    }

    const siteId = existing?._id ?? await ctx.db.insert("sites", {
      name: biz,
      slug,
      status: "active",
      domain: `${slug}.fstsclientsystem.com`,
      brandColorPrimary: "#dc2626",
      brandColorSecondary: "#1e1e1e",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "fitness_wellness",
      enabledModules: {
        homepage: true,
        courses: false,
        events: true,
        articles: false,
        products: true,
        media: true,
        contact: true,
        footer: true,
        seo: true,
        payments: false,
        email: true,
        crm: true,
      },
    });

    const now = Date.now();

    // Homepage
    const existingHomepage = await ctx.db.query("homepageContent").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingHomepage) {
      await ctx.db.insert("homepageContent", {
        siteId,
        heroHeadline: `Transform Your Body at ${biz}`,
        heroSubheadline: "Premium personal training and group fitness classes in downtown Tampa. Your goals start here.",
        sections: [],
      });
    }

    // Footer
    const existingFooter = await ctx.db.query("footerContent").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingFooter) {
      await ctx.db.insert("footerContent", {
        siteId,
        columns: [],
        socialLinks: [],
        copyrightText: `© ${new Date().getFullYear()} ${biz}. All rights reserved.`,
      });
    }

    // Contact info
    const existingContact = await ctx.db.query("contactInfo").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingContact) {
      await ctx.db.insert("contactInfo", {
        siteId,
        email: "hello@apexfitnesstampa.com",
        phone: "(813) 555-0190",
        address: "1201 N Franklin St, Tampa, FL 33602",
        hours: [
          { day: "Mon–Fri", open: "5:00 AM", close: "9:00 PM" },
          { day: "Sat–Sun", open: "7:00 AM", close: "5:00 PM" },
        ],
      });
    }

    // SEO
    const existingSeo = await ctx.db.query("seoSettings").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingSeo) {
      await ctx.db.insert("seoSettings", {
        siteId,
        pagePath: "/",
        title: `${biz} — Tampa Personal Training & Fitness`,
        description: "Premium personal training and group fitness classes in downtown Tampa, FL. Book your first session today.",
      });
    }

    // Navigation
    const existingNav = await ctx.db.query("navigationItems").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingNav) {
      const navItems = [
        { label: "Home", href: "/" },
        { label: "Services", href: "/services" },
        { label: "Products", href: "/products" },
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ];
      for (let i = 0; i < navItems.length; i++) {
        await ctx.db.insert("navigationItems", {
          siteId,
          label: navItems[i].label,
          href: navItems[i].href,
          isVisible: true,
          order: i,
          openInNewTab: false,
        });
      }
    }

    // Email settings
    const existingEmail = await ctx.db.query("emailSettings").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingEmail) {
      await ctx.db.insert("emailSettings", {
        siteId,
        fromName: biz,
        fromEmail: "hello@apexfitnesstampa.com",
        replyToEmail: "hello@apexfitnesstampa.com",
        notificationEmail: "hello@apexfitnesstampa.com",
        notifyOnNewLead: true,
        notifyOnBooking: true,
      });
    }

    // Services
    const existingServices = await ctx.db.query("siteServices").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingServices) {
      const services = [
        {
          title: "Personal Training",
          slug: "personal-training",
          description: "One-on-one sessions with a certified trainer tailored to your specific fitness goals, schedule, and current fitness level.",
          shortDescription: "Dedicated 1-on-1 coaching sessions tailored to your goals.",
          price: "$120/session",
          duration: "60 min",
          category: "Training",
          ctaLabel: "Book a Session",
          ctaUrl: "/contact",
        },
        {
          title: "Group Fitness Classes",
          slug: "group-fitness-classes",
          description: "High-energy group classes including HIIT, spin, yoga, and strength circuits. Train harder with the energy of a group.",
          shortDescription: "High-energy classes for every fitness level.",
          price: "$25/class",
          duration: "45 min",
          category: "Group",
          ctaLabel: "View Schedule",
          ctaUrl: "/contact",
        },
        {
          title: "Nutrition Coaching",
          slug: "nutrition-coaching",
          description: "Custom nutrition planning aligned with your fitness goals. Includes weekly check-ins, meal plans, and accountability.",
          shortDescription: "Custom meal plans and weekly check-ins.",
          price: "$200/month",
          duration: "Ongoing",
          category: "Nutrition",
          ctaLabel: "Get Started",
          ctaUrl: "/contact",
        },
      ];
      for (let i = 0; i < services.length; i++) {
        await ctx.db.insert("siteServices", {
          siteId,
          order: i,
          isVisible: true,
          ...services[i],
        });
      }
    }

    // Products (visible — real test data)
    const existingProducts = await ctx.db.query("siteProducts").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingProducts) {
      const products = [
        {
          title: "Personal Training Package",
          slug: "personal-training-package",
          description: "10-session personal training bundle with your choice of trainer. Sessions never expire. Includes initial fitness assessment.",
          shortDescription: "10 sessions with a certified personal trainer.",
          priceCents: 109900,
          priceLabel: "$1,099",
          category: "Packages",
          isFeatured: true,
          ctaLabel: "Buy Now",
          ctaUrl: "/contact",
          isVisible: true,
        },
        {
          title: "Group Class Monthly Pass",
          slug: "group-class-monthly-pass",
          description: "Unlimited group fitness classes for 30 days. Access to all class types including HIIT, spin, yoga, and strength.",
          shortDescription: "Unlimited classes for 30 days.",
          priceCents: 12900,
          priceLabel: "$129/mo",
          category: "Memberships",
          isFeatured: false,
          ctaLabel: "Join Now",
          ctaUrl: "/contact",
          isVisible: true,
        },
        {
          title: "Elite Coaching Program",
          slug: "elite-coaching-program",
          description: "3-month total transformation program: 3x/week personal training, nutrition coaching, body composition scans, and weekly progress reviews.",
          shortDescription: "Full 3-month transformation — training + nutrition.",
          priceCents: 299900,
          priceLabel: "From $2,999",
          category: "Programs",
          isFeatured: false,
          ctaLabel: "Contact Us",
          ctaUrl: "/contact",
          isVisible: true,
        },
      ];
      for (let i = 0; i < products.length; i++) {
        await ctx.db.insert("siteProducts", {
          siteId,
          order: i,
          ...products[i],
        });
      }
    }

    // CRM connection
    const existingCrm = await ctx.db.query("crmConnections").withIndex("by_site", (q: any) => q.eq("siteId", siteId)).first();
    if (!existingCrm) {
      await ctx.db.insert("crmConnections", {
        siteId,
        provider: "operon",
        status: "pending",
        authMethod: "api_key",
        ssoEnabled: false,
        apiHealth: "unknown",
      });
    }

    // Add-on trials: Smart SEO Pro + Website Health Pro
    const catalog = await ctx.db.query("addOnCatalog").collect();
    const trialSlugs = ["smart-seo-pro", "website-health-pro"];
    for (const adSlug of trialSlugs) {
      const addOn = catalog.find((c) => c.slug === adSlug);
      if (!addOn) continue;
      const existingAddon = await ctx.db
        .query("siteAddOns")
        .withIndex("by_site_addon", (q) => q.eq("siteId", siteId).eq("addOnId", addOn._id))
        .first();
      if (!existingAddon) {
        await ctx.db.insert("siteAddOns", {
          siteId,
          addOnId: addOn._id,
          status: "trial",
          enabledAt: now,
          trialEndsAt: now + 14 * 24 * 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
          notes: "Seeded by test data script",
        });
      }
    }

    return {
      skipped: false,
      siteId,
      slug,
      message: `✓ Seeded '${biz}' (${slug}) with homepage, footer, nav, contact, 3 services, 3 products, 2 add-on trials.`,
    };
  },
});

// ─── Archive the Apex Fitness Studio test site ────────────────────────────────
// Run once: npx convex run seed:archiveApexTestSite '{}'
// Marks the dummy test site as "archived" so it no longer appears in the
// dashboard. The Corsair site is now the first real client; the dummy site is
// no longer needed as the default example.
export const archiveApexTestSite = mutation({
  args: {},
  handler: async (ctx) => {
    const APEX_SLUG = "apex-fitness-studio";
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", APEX_SLUG))
      .first();

    if (!site) {
      return { ok: false, message: "Apex Fitness Studio site not found — nothing to archive." };
    }

    await ctx.db.patch(site._id, { status: "archived" } as Partial<typeof site>);
    return { ok: true, siteId: site._id, message: `✓ Site '${APEX_SLUG}' (${site._id}) marked as archived.` };
  },
});
