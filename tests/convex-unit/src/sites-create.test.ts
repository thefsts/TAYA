/**
 * P4 — sites.create (Global Sites "Create Site" dialog path) end-to-end tests.
 *
 * Runs the real `sites.create` Convex mutation against an in-memory backend
 * (convex-test). No network calls. This path previously had ZERO coverage —
 * only the onboarding wizard path (onboarding.launch) was tested.
 *
 * Assertions:
 *   ✓ Site record created with normalized, unique slug
 *   ✓ Empty slug falls back to slugified site name
 *   ✓ Raw slug (uppercase / spaces / punctuation) is normalized
 *   ✓ Duplicate slug de-duplicated with -2 suffix (by_slug is not unique index)
 *   ✓ navigationItems seeded (home/about/contact + module-gated entries)
 *   ✓ Navigation respects enabledModules (courses/events off for business type)
 *   ✓ crmConnections / homepageContent / footerContent / contactInfo /
 *     seoSettings all seeded
 *   ✓ Status defaults to "active"; invalid status falls back to "active";
 *     valid "staging" preserved
 *   ✓ Domain has protocol + trailing slash stripped; empty domain → undefined
 *   ✓ Non-superAdmin caller rejected with Forbidden
 *   ✓ Returns toSiteResponse shape (id field present)
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ─────────────────────────────────────────────────────────────────

function userDoc(
  clerkUserId: string,
  overrides: Partial<{
    isSuperAdmin: boolean;
    isActive: boolean;
    roles: { siteId: any; role: string }[];
  }> = {},
) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [],
    ...overrides,
  };
}

let t: ReturnType<typeof convexTest>;

beforeEach(async () => {
  t = convexTest(schema, modules);

  // Seed users BEFORE any mutation so provisionUser never bootstraps a
  // first-user superadmin mid-test.
  await t.run(async (ctx) => {
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("regular_user"));
  });
});

const asSuper = () => t.withIdentity({ subject: "superadmin" });
const asRegular = () => t.withIdentity({ subject: "regular_user" });

afterEach(async () => {
  // §4 wiring determinism: sites.create schedules a fire-and-forget
  // discovery crawl when an external domain is provided (only the
  // "strips protocol and trailing slash" test passes a domain). Without a
  // drain, that crawl would run between tests against the REAL network.
  // Stub a terminal 404 responder (the crawl records an explicit §14
  // failureReason — never a hang), yield one macrotask so the auto-fired
  // crawl starts, wait for it, then unstub.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const BASE_ARGS = {
  name: "Acme Dental",
  slug: "",
};

// ── Slug normalization ──────────────────────────────────────────────────────

describe("sites.create — slug normalization", () => {
  it("falls back to slugified site name when slug is empty", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    expect(result.slug).toBe("acme-dental");
    expect(result.id).toBeTruthy();
  });

  it("normalizes a raw slug with uppercase, spaces, and punctuation", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      slug: "  Acme & Dental!! Main Site ",
    });
    // non-[a-z0-9\s-] stripped, whitespace collapsed to dashes, trimmed
    expect(result.slug).toBe("acme-dental-main-site");
  });

  it("falls back to new-site when both slug and name are unusable", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      name: "!!!",
      slug: "???",
    });
    expect(result.slug).toBe("new-site");
  });

  it("de-duplicates a colliding slug with a -2 suffix", async () => {
    await asSuper().mutation(api.sites.create, {
      name: "Acme Dental",
      slug: "",
    });
    const second = await asSuper().mutation(api.sites.create, {
      name: "Acme Dental",
      slug: "",
    });
    expect(second.slug).toBe("acme-dental-2");
  });

  it("caps slug length at 60 chars", async () => {
    const longName = "a".repeat(120);
    const result = await asSuper().mutation(api.sites.create, {
      name: longName,
      slug: "",
    });
    expect(result.slug.length).toBeLessThanOrEqual(60);
  });
});

// ── Status + domain normalization ───────────────────────────────────────────

describe("sites.create — status and domain normalization", () => {
  it("defaults status to active when omitted", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    expect(result.status).toBe("active");
  });

  it("falls back to active for an unrecognized status", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      status: "live-ish",
    });
    expect(result.status).toBe("active");
  });

  it("preserves a valid staging status", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      status: "staging",
    });
    expect(result.status).toBe("staging");
  });

  it("strips protocol and trailing slash from the domain", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      domain: "https://acmedental.com/",
    });
    expect(result.domain).toBe("acmedental.com");
  });

  it("stores undefined domain when blank", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      domain: "   ",
    });
    expect(result.domain).toBeUndefined();
  });
});

// ── Seeded content ──────────────────────────────────────────────────────────

describe("sites.create — seeded tables", () => {
  it("seeds crmConnections, homepageContent, footerContent, contactInfo, seoSettings", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);

    const [crm, homepage, footer, contact, seo] = await t.run(async (ctx) => {
      const crm = await ctx.db
        .query("crmConnections")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .first();
      const homepage = await ctx.db
        .query("homepageContent")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .first();
      const footer = await ctx.db
        .query("footerContent")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .first();
      const contact = await ctx.db
        .query("contactInfo")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .first();
      const seo = await ctx.db
        .query("seoSettings")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .first();
      return [crm, homepage, footer, contact, seo] as const;
    });

    expect(crm).toMatchObject({ provider: "operon", status: "not_connected" });
    expect(homepage?.heroHeadline).toBe("Welcome to Acme Dental");
    expect(footer?.copyrightText).toContain("Acme Dental");
    expect(contact).toMatchObject({ email: "", phone: "", address: "" });
    expect(seo).toMatchObject({ title: "Acme Dental", pagePath: "/" });
  });

  it("seeds navigationItems — core pages always, module pages gated", async () => {
    // Mirror the exact payload the Global Sites dialog sends for
    // business_website (frontend DEFAULT_MODULES_BY_WEBSITE_TYPE):
    // courses/events/products OFF, everything else ON.
    const BUSINESS_MODULES = {
      homepage: true,
      courses: false,
      events: false,
      articles: true,
      products: false,
      media: true,
      contact: true,
      footer: true,
      seo: true,
      payments: true,
      email: true,
      crm: true,
    };
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      websiteType: "business_website",
      enabledModules: BUSINESS_MODULES,
    });

    const nav = await t.run(async (ctx) => {
      const items = await ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .collect();
      return items.sort((a: any, b: any) => a.order - b.order);
    });

    const labels = nav.map((n: any) => n.label);
    // Core pages always present
    expect(labels).toContain("Home");
    expect(labels).toContain("About");
    expect(labels).toContain("Contact");
    // Module-gated: articles+media ON → present
    expect(labels).toContain("Blog");
    expect(labels).toContain("Media");
    // courses/events/products OFF → absent
    expect(labels).not.toContain("Courses");
    expect(labels).not.toContain("Events");
    expect(labels).not.toContain("Products");

    // Every entry visible, ordered 0..n, correct hrefs
    for (let i = 0; i < nav.length; i++) {
      expect(nav[i].isVisible).toBe(true);
      expect(nav[i].order).toBe(i);
      expect(nav[i].openInNewTab).toBe(false);
    }
    const home = nav.find((n: any) => n.label === "Home");
    const about = nav.find((n: any) => n.label === "About");
    const contact = nav.find((n: any) => n.label === "Contact");
    expect(home?.href).toBe("/");
    expect(about?.href).toBe("/about");
    expect(contact?.href).toBe("/contact");
  });

  it("seeds Courses/Events nav when their modules are enabled", async () => {
    const result = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      websiteType: "training_academy",
    });

    const labels = await t.run(async (ctx) => {
      const items = await ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .collect();
      return items.map((n: any) => n.label);
    });

    expect(labels).toContain("Courses");
    expect(labels).toContain("Events");
  });
});

// ── Access control ──────────────────────────────────────────────────────────

describe("sites.create — access control", () => {
  it("rejects a non-superAdmin caller with Forbidden", async () => {
    await expect(
      asRegular().mutation(api.sites.create, BASE_ARGS),
    ).rejects.toThrow(/Forbidden/);
  });

  it("does not create any site rows for a rejected caller", async () => {
    await expect(
      asRegular().mutation(api.sites.create, BASE_ARGS),
    ).rejects.toThrow();
    const count = await t.run(async (ctx) => {
      const all = await ctx.db.query("sites").collect();
      return all.length;
    });
    expect(count).toBe(0);
  });
});

// ── Activity log ────────────────────────────────────────────────────────────

describe("sites.create — activity log", () => {
  it("logs the site creation on the Global Sites page", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const entry = await t.run(async (ctx) => {
      const items = await ctx.db
        .query("activityLog")
        .withIndex("by_site", (q) => q.eq("siteId", result.id))
        .collect();
      return items[0];
    });
    expect(entry).toMatchObject({
      action: "created",
      entityType: "site",
      page: "Global Sites",
    });
  });
});
