import type { MutationCtx } from "../_generated/server";

/**
 * Shared site-provisioning helpers (single source of truth).
 *
 * Previously the superadmin "Create Site" dialog (sites.create) and the
 * onboarding wizard (onboarding.launch) each carried their own copies of the
 * slug / module / navigation conventions. The client self-service
 * onboarding path (selfServiceOnboarding.ts) must ship the SAME conventions
 * or a self-provisioned site would diverge from an admin-provisioned one.
 *
 * This module extracts the P4-hardened conventions from sites.ts so every
 * provisioning path (superadmin dialog, wizard, client self-service) uses
 * ONE implementation. No behavior change for the existing two paths.
 *
 * Spec: §1 (one-transaction onboarding), §3 (idempotency — one canonical
 * site), §23 (websites are DATA not CODE — no per-customer code paths).
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export const SITE_STATUSES = ["active", "staging", "archived"] as const;

// Module key -> primary nav entry. Mirrors the wizard's NAV_PAGE_MAP so any
// site created from any path ships with the same visible menu (home + about
// + contact always; other pages when the matching module is enabled).
export const MODULE_NAV_MAP: Record<string, { label: string; href: string }> = {
  homepage: { label: "Home", href: "/" },
  articles: { label: "Blog", href: "/blog" },
  contact: { label: "Contact", href: "/contact" },
  products: { label: "Products", href: "/products" },
  events: { label: "Events", href: "/events" },
  courses: { label: "Courses", href: "/courses" },
  media: { label: "Media", href: "/media" },
};

/**
 * Resolve a slug guaranteed unique (by_slug is not a unique index, so
 * uniqueness is enforced here before insert). Throws after 50 collisions.
 */
export async function resolveUniqueSlug(
  ctx: MutationCtx,
  base: string,
): Promise<string> {
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

export function defaultModules(websiteType: string): Record<string, boolean> {
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

/**
 * Normalize a client-supplied website URL into a bare domain:
 * strip protocol, path, query, hash and trailing slashes.
 * "https://www.acme.com/pricing?x=1" -> "www.acme.com"
 */
export function normalizeDomain(rawUrl: string): string {
  return rawUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .trim();
}

/**
 * Derive the site slug from a bare domain:
 * "www.acme.com" -> "acme-com" (dots are not slug characters).
 * Ensures slugify's conventions (lowercase, hyphens, ≤60 chars) and never
 * returns an empty string (falls back to "new-site").
 */
export function slugFromDomain(domain: string): string {
  // Dots become hyphens so "acmedental.com" → "acmedental-com".
  // Passing the raw domain to slugify alone would strip the dots and
  // produce the unreadable "acmedentalcom".
  const slug = slugify(domain.replace(/\./g, "-"));
  return slug || "new-site";
}

/**
 * Phase 2 (§6) connection mode at provisioning time:
 *  - No domain (or a TAYA-hosted subdomain) → TAYA_NATIVE: the site's
 *    content lives in TAYA's own builder — full edit + publish.
 *  - An external domain → undefined until the discovery crawl completes and
 *    sets DISCOVERED_EXTERNAL (§16 — draft-only until a bridge connects it).
 * The crawl, not this helper, is the authority for external domains.
 */
export function connectionModeForDomain(domain: string | undefined): "TAYA_NATIVE" | undefined {
  if (!domain) return "TAYA_NATIVE";
  const bare = domain.trim().toLowerCase();
  return bare.endsWith(".fstsclientsystem.com") ? "TAYA_NATIVE" : undefined;
}

/**
 * Seed the full content footprint of a freshly created site — the exact
 * tables sites.create seeds, extracted so ALL provisioning paths produce an
 * identical starting site. Returns the created site id.
 */
export async function insertSiteWithSeedContent(
  ctx: MutationCtx,
  params: {
    name: string;
    slug: string;
    status: string;
    domain?: string;
    logoUrl?: string;
    faviconUrl?: string;
    brandColorPrimary?: string;
    brandColorSecondary?: string;
    whiteLabelEnabled?: boolean;
    poweredByFsts?: boolean;
    websiteType: string;
    enabledModules: Record<string, boolean>;
    agencyId?: any;
  },
): Promise<{ siteId: any }> {
  const siteId = await ctx.db.insert("sites", {
    name: params.name,
    slug: params.slug,
    status: params.status,
    domain: params.domain,
    logoUrl: params.logoUrl,
    faviconUrl: params.faviconUrl,
    brandColorPrimary: params.brandColorPrimary ?? "#1d4ed8",
    brandColorSecondary: params.brandColorSecondary ?? "#0f172a",
    whiteLabelEnabled: params.whiteLabelEnabled ?? false,
    poweredByFsts: params.poweredByFsts ?? true,
    websiteType: params.websiteType,
    enabledModules: params.enabledModules,
    // Spec §6: record the connection mode at provisioning time. No domain or
    // a TAYA-hosted subdomain => TAYA_NATIVE; an external domain stays unset
    // until the discovery crawl confirms it as DISCOVERED_EXTERNAL.
    connectionMode: connectionModeForDomain(params.domain),
    agencyId: params.agencyId,
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
    heroHeadline: `Welcome to ${params.name}`,
    heroSubheadline: "Edit this hero section from the Homepage editor.",
    sections: [],
  });

  await ctx.db.insert("footerContent", {
    siteId,
    columns: [],
    socialLinks: [],
    copyrightText: `© ${new Date().getFullYear()} ${params.name}. All rights reserved.`,
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
    title: params.name,
    description: `${params.name} — powered by Full Stack Tech Solutions.`,
  });

  // Seed the public website menu from enabled modules — same nav seeding
  // sites.create performs (about/contact core; the rest module-gated).
  const navKeys = ["homepage", "about", "contact", "articles", "products", "events", "courses", "media"];
  let order = 0;
  for (const key of navKeys) {
    const moduleEnabled =
      key === "about" || key === "contact" ? true : params.enabledModules[key] === true;
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

  return { siteId };
}
