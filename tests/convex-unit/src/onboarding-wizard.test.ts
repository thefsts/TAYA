/**
 * Onboarding Wizard — launch mutation end-to-end test.
 *
 * Runs the real `onboarding.launch` Convex mutation against an in-memory
 * backend (convex-test). No network calls. Verifies that a fully wired site
 * is created — not a broken shell.
 *
 * Assertions:
 *   ✓ Site record has correct slug, brand colors, websiteType
 *   ✓ homepageContent seeded with businessName hero headline
 *   ✓ navigationItems match selected pages (correct count, correct hrefs)
 *   ✓ contactInfo has phone/email/address from step data
 *   ✓ footerContent has copyright text containing businessName
 *   ✓ seoSettings title matches websiteName
 *   ✓ crmConnections record created (pending if Operon selected, not_connected otherwise)
 *   ✓ onboardingProgress record marked status=completed with siteId set
 *   ✓ Duplicate sessionKey returns existing session (idempotency)
 *   ✓ Non-superAdmin caller is rejected with Forbidden error
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ────────────────────────────────────────────────────────────────

function agencyBase() {
  return {
    primaryColor: "#000",
    accentColor: "#fff",
    supportEmail: "support@test.local",
    featureFlags: {},
    licensingStatus: "active",
    isActive: true,
  };
}

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

/** Representative wizard step data covering all seeded tables. */
const STEP_DATA = {
  businessName: "Acme Dojo",
  websiteName: "Acme Dojo — Official Site",
  industry: "training_academy",
  brandColorPrimary: "#4f46e5",
  brandColorSecondary: "#1e1b4b",
  pages: ["home", "about", "services", "contact"],
  integrations: ["operon_crm"],
  domainChoice: "later",
  email: "hello@acmedojo.com",
  phone: "555-123-4567",
  address: "123 Main St, Springfield",
  description: "Premier martial arts academy.",
};

const SESSION_KEY = "test-session-wizard-001";

let t: ReturnType<typeof convexTest>;

beforeEach(async () => {
  t = convexTest(schema, modules);

  // Seed users BEFORE any mutation so provisionUser never accidentally
  // bootstraps a first-user superadmin in the middle of a test.
  await t.run(async (ctx) => {
    const agency = await ctx.db.insert("agencies", {
      name: "Test Agency",
      slug: "test-agency",
      ...agencyBase(),
    });
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("regular_user"));
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("onboarding.launch — happy path", () => {
  it("creates a site record with correct slug, brand colors, and websiteType", async () => {
    const as = t.withIdentity({ subject: "superadmin" });

    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const result = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    expect(result.siteId).toBeTruthy();
    expect(result.slug).toBeTruthy();
    // slug is derived from websiteName — should contain "acme"
    expect(result.slug).toMatch(/acme/);

    const site = await t.run(async (ctx) => ctx.db.get(result.siteId));
    expect(site).not.toBeNull();
    expect(site!.brandColorPrimary).toBe(STEP_DATA.brandColorPrimary);
    expect(site!.brandColorSecondary).toBe(STEP_DATA.brandColorSecondary);
    expect(site!.websiteType).toBe(STEP_DATA.industry);
    expect(site!.slug).toBe(result.slug);
  });

  it("seeds homepageContent with businessName hero headline", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const homepage = await t.run(async (ctx) =>
      ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(homepage).not.toBeNull();
    expect(homepage!.heroHeadline).toContain(STEP_DATA.businessName);
  });

  it("seeds navigationItems matching selected pages — correct count and hrefs", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const navItems = await t.run(async (ctx) =>
      ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
    );

    // pages = ["home", "about", "services", "contact"] — all 4 map to nav entries
    expect(navItems).toHaveLength(4);
    const hrefs = navItems.map((n: any) => n.href);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/about");
    expect(hrefs).toContain("/services");
    expect(hrefs).toContain("/contact");
  });

  it("seeds contactInfo with phone/email/address from stepData", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const contact = await t.run(async (ctx) =>
      ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(contact).not.toBeNull();
    expect(contact!.phone).toBe(STEP_DATA.phone);
    expect(contact!.email).toBe(STEP_DATA.email);
    expect(contact!.address).toBe(STEP_DATA.address);
  });

  it("seeds footerContent with copyright text containing businessName", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const footer = await t.run(async (ctx) =>
      ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(footer).not.toBeNull();
    expect(footer!.copyrightText).toContain(STEP_DATA.businessName);
  });

  it("seeds seoSettings with title matching websiteName", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const seo = await t.run(async (ctx) =>
      ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(seo).not.toBeNull();
    expect(seo!.title).toBe(STEP_DATA.websiteName);
  });

  it("creates a crmConnections record with status=pending when operon_crm is selected", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA, // includes "operon_crm" in integrations
    });

    const crm = await t.run(async (ctx) =>
      ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(crm).not.toBeNull();
    expect(crm!.status).toBe("pending");
    expect(crm!.provider).toBe("operon");
  });

  it("creates a crmConnections record with status=not_connected when operon_crm is NOT selected", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: { ...STEP_DATA, integrations: [] },
    });

    const crm = await t.run(async (ctx) =>
      ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
    );
    expect(crm).not.toBeNull();
    expect(crm!.status).toBe("not_connected");
  });

  it("marks onboardingProgress as status=completed with siteId set", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    const { id: sessionId } = await as.mutation(api.onboarding.createSession, {
      sessionKey: SESSION_KEY,
    });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    const progress = await t.run(async (ctx) => ctx.db.get(sessionId));
    expect(progress).not.toBeNull();
    expect(progress!.status).toBe("completed");
    expect(progress!.siteId).toBe(siteId);
  });
});

describe("onboarding.launch — privacy/terms pages excluded from nav", () => {
  it("does NOT insert nav items for privacy_policy or terms pages", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: {
        ...STEP_DATA,
        pages: ["home", "about", "privacy_policy", "terms"],
      },
    });

    const navItems = await t.run(async (ctx) =>
      ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
    );
    // Only "home" and "about" get nav entries; privacy/terms go to footer only
    expect(navItems).toHaveLength(2);
    const hrefs = navItems.map((n: any) => n.href);
    expect(hrefs).not.toContain("/privacy");
    expect(hrefs).not.toContain("/terms");
  });

  it("seeds policyPages placeholder records for privacy_policy and terms when selected", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: {
        ...STEP_DATA,
        pages: ["home", "privacy_policy", "terms"],
      },
    });

    const policyPages = await t.run(async (ctx) =>
      ctx.db.query("policyPages").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
    );
    expect(policyPages).toHaveLength(2);
    const types = policyPages.map((p: any) => p.policyType);
    expect(types).toContain("privacy");
    expect(types).toContain("terms");
  });
});

describe("onboarding.createSession — idempotency", () => {
  it("returns the existing session when the same sessionKey is used twice", async () => {
    const as = t.withIdentity({ subject: "superadmin" });

    const first = await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const second = await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });

    expect(second.id).toBe(first.id);
    expect(second.sessionKey).toBe(first.sessionKey);
  });
});

describe("onboarding.launch — access control", () => {
  it("rejects a non-superAdmin caller with Forbidden error", async () => {
    const superAs = t.withIdentity({ subject: "superadmin" });
    await superAs.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });

    // regular_user is not a superAdmin
    const regularAs = t.withIdentity({ subject: "regular_user" });
    await expect(
      regularAs.mutation(api.onboarding.launch, {
        sessionKey: SESSION_KEY,
        stepData: STEP_DATA,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("rejects an anonymous caller with authentication error", async () => {
    const superAs = t.withIdentity({ subject: "superadmin" });
    await superAs.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });

    await expect(
      t.mutation(api.onboarding.launch, {
        sessionKey: SESSION_KEY,
        stepData: STEP_DATA,
      }),
    ).rejects.toThrow();
  });

  it("rejects launch on an already-completed session", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    await as.mutation(api.onboarding.launch, { sessionKey: SESSION_KEY, stepData: STEP_DATA });

    // Second launch on same session must fail
    await expect(
      as.mutation(api.onboarding.launch, { sessionKey: SESSION_KEY, stepData: STEP_DATA }),
    ).rejects.toThrow(/already completed/);
  });
});

describe("onboarding.launch — placeholder products personalisation", () => {
  it("seeds product descriptions containing the businessName when products page is selected", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: {
        ...STEP_DATA,
        pages: [...STEP_DATA.pages, "products"],
      },
    });

    const products = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    expect(products.length).toBeGreaterThan(0);

    // At least one product description must contain the businessName
    const hasBusinessName = products.some(
      (p: any) =>
        p.description.includes(STEP_DATA.businessName) ||
        p.shortDescription?.includes(STEP_DATA.businessName),
    );
    expect(hasBusinessName).toBe(true);
  });

  it("uses custom tier labels from priceRange in product titles", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: {
        ...STEP_DATA,
        pages: [...STEP_DATA.pages, "products"],
        priceRange: ["Basic", "Pro", "Elite"],
      },
    });

    const products = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    const titles = products.map((p: any) => p.title);
    expect(titles).toContain("Basic Package");
    expect(titles).toContain("Pro Package");
    expect(titles).toContain("Elite Package");
  });

  it("falls back to generic labels for missing priceRange entries (partial tier array)", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: {
        ...STEP_DATA,
        pages: [...STEP_DATA.pages, "products"],
        priceRange: ["Gold"], // only one label supplied
      },
    });

    const products = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    // Sort by insertion order so index 0 is the first product
    const sorted = [...products].sort((a: any, b: any) => a.order - b.order);
    const titles = sorted.map((p: any) => p.title);

    // First entry uses the supplied label
    expect(titles[0]).toBe("Gold Package");
    // Remaining two fall back to generic defaults
    expect(titles[1]).toBe("Professional Package");
    expect(titles[2]).toBe("Enterprise Package");
  });

  it("does NOT seed products when products page is not selected", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA, // pages does NOT include "products"
    });

    const products = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    expect(products).toHaveLength(0);
  });
});

describe("onboarding.launch — slug collision handling", () => {
  it("generates a unique slug when a site with that slug already exists", async () => {
    const as = t.withIdentity({ subject: "superadmin" });

    // Pre-insert a site that will collide on the base slug
    await t.run(async (ctx) => {
      await ctx.db.insert("sites", {
        name: "Acme Dojo — Official Site",
        slug: "acme-dojo-official-site",
        status: "active",
        brandColorPrimary: "#000",
        brandColorSecondary: "#fff",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
      });
    });

    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const result = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    // The slug must differ from the colliding one
    expect(result.slug).not.toBe("acme-dojo-official-site");

    // Both sites must exist and have different slugs
    const sites = await t.run(async (ctx) =>
      ctx.db.query("sites").collect(),
    );
    const slugs = sites.map((s: any) => s.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(sites.length);
  });
});
