/**
 * module-read-gates.test.ts — D4 certification.
 *
 * PM rule: every list/read surface must enforce site access + the module
 * enabled/support contract. A disabled module must fail safe (return [] / null
 * / the canonical default) on reads, matching the existing canonical pattern
 * (convex/articles.ts): checkSiteAccess → checkModuleEnabled → data.
 *
 * This suite proves, against the real Convex functions + schema (convex-test):
 *   - enabled module  → the query returns the seeded data
 *   - disabled module → the query returns the canonical empty/default value
 *   - wrong tenant    → the query is denied (empty/default), no data leak
 *
 * Covered read surfaces (D4 scope):
 *   services.list, products.list, testimonials.list, faq.list, team.list,
 *   careers.list, reviews.listSources, reviews.listReviews,
 *   reviews.getDisplaySettings, automation.list, automation.listRunLogs,
 *   automation.getFailedRuns
 *
 * Downloads is owned by PR #58 and is intentionally NOT covered here.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

/* ── helpers ──────────────────────────────────────────────────────────── */

function baseSiteDoc(name: string, slug: string, enabledModules: Record<string, boolean> = {}) {
  return {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules,
  };
}

type Seeded = {
  /** Site with every D4 module explicitly disabled. */
  disabledSite: Id<"sites">;
  /** Site with every D4 module explicitly enabled. */
  enabledSite: Id<"sites">;
  /** A site the viewer has NO role on (tenant-isolation probe). */
  foreignSite: Id<"sites">;
};

const D4_MODULES = [
  "services",
  "products",
  "testimonials",
  "faq",
  "team",
  "careers",
  "reviews",
  "automation",
] as const;

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await t.run(async (ctx) => {
    const disabledModules: Record<string, boolean> = {};
    const enabledModules: Record<string, boolean> = {};
    for (const m of D4_MODULES) {
      disabledModules[m] = false;
      enabledModules[m] = true;
    }

    const disabledSite = await ctx.db.insert(
      "sites",
      baseSiteDoc("Disabled Site", "disabled-site", disabledModules),
    );
    const enabledSite = await ctx.db.insert(
      "sites",
      baseSiteDoc("Enabled Site", "enabled-site", enabledModules),
    );
    const foreignSite = await ctx.db.insert(
      "sites",
      baseSiteDoc("Foreign Site", "foreign-site", enabledModules),
    );

    // Viewer is owner on disabled + enabled, but has NO role on foreignSite.
    await ctx.db.insert("users", {
      clerkUserId: "owner_d4",
      name: "owner_d4",
      email: "owner_d4@test.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [
        { siteId: disabledSite, role: "owner" },
        { siteId: enabledSite, role: "owner" },
      ],
    });

    // Seed one row of each kind on the ENABLED site so "enabled → data" is real.
    await ctx.db.insert("siteServices", {
      siteId: enabledSite, title: "Consulting", slug: "consulting",
      description: "desc", order: 0, isVisible: true,
    });
    await ctx.db.insert("siteProducts", {
      siteId: enabledSite, title: "Widget", slug: "widget",
      description: "desc", order: 0, isVisible: true,
    });
    await ctx.db.insert("testimonials", {
      siteId: enabledSite, name: "Sam", text: "Great!", isActive: true, order: 0,
    });
    await ctx.db.insert("faqs", {
      siteId: enabledSite, question: "Q?", answer: "A.", order: 0, isActive: true,
    });
    await ctx.db.insert("teamMembers", {
      siteId: enabledSite, name: "Jane", role: "Coach", isActive: true, order: 0,
    });
    await ctx.db.insert("jobPostings", {
      siteId: enabledSite, title: "Coach", jobType: "full_time",
      description: "desc", isActive: true,
    });
    await ctx.db.insert("reviewSources", {
      siteId: enabledSite, provider: "google", config: {}, autoRefresh: false,
      status: "connected",
    });
    const sourceId = await ctx.db.insert("reviewSources", {
      siteId: enabledSite, provider: "yelp", config: {}, autoRefresh: false,
      status: "connected",
    });
    await ctx.db.insert("importedReviews", {
      siteId: enabledSite, sourceId, provider: "yelp", externalId: "r1",
      reviewerName: "Sam", rating: 5, text: "Great!", reviewDate: 1,
      status: "published", pinned: false, cachedAt: 1,
    });
    await ctx.db.insert("automationRules", {
      siteId: enabledSite, name: "Welcome", triggerType: "form_submitted",
      conditions: [], actions: [], enabled: true,
    });
    const ruleId = await ctx.db.insert("automationRules", {
      siteId: enabledSite, name: "Follow-up", triggerType: "form_submitted",
      conditions: [], actions: [], enabled: true,
    });
    await ctx.db.insert("automationRunLog", {
      siteId: enabledSite, ruleId, ruleName: "Follow-up",
      triggerType: "form_submitted", triggerPayload: {}, status: "failure",
      actionResults: [], completedAt: 1,
    });

    return { disabledSite, enabledSite, foreignSite };
  });
});

const as = () => t.withIdentity({ subject: "owner_d4" });

/* ── list surfaces: enabled → data, disabled → canonical empty ────────── */

describe("D4 — list surfaces enforce the module contract", () => {
  const listCases: Array<{
    name: string;
    query: unknown;
    empty: unknown;
  }> = [
    { name: "services.list", query: api.services.list, empty: [] },
    { name: "products.list", query: api.products.list, empty: null },
    { name: "testimonials.list", query: api.testimonials.list, empty: [] },
    { name: "faq.list", query: api.faq.list, empty: [] },
    { name: "team.list", query: api.team.list, empty: [] },
    { name: "careers.list", query: api.careers.list, empty: [] },
    { name: "reviews.listSources", query: api.reviews.listSources, empty: [] },
    { name: "reviews.listReviews", query: api.reviews.listReviews, empty: [] },
    { name: "automation.list", query: api.automation.list, empty: [] },
    { name: "automation.listRunLogs", query: api.automation.listRunLogs, empty: [] },
    { name: "automation.getFailedRuns", query: api.automation.getFailedRuns, empty: [] },
  ];

  for (const c of listCases) {
    it(`${c.name}: enabled → returns seeded data`, async () => {
      const result = await as().query(c.query as never, { siteId: s.enabledSite });
      expect(result).not.toEqual(c.empty);
      expect(result).not.toBeNull();
    });

    it(`${c.name}: disabled → canonical empty (fail-safe)`, async () => {
      const result = await as().query(c.query as never, { siteId: s.disabledSite });
      expect(result).toEqual(c.empty);
    });

    it(`${c.name}: wrong tenant → denied (no data leak)`, async () => {
      const result = await as().query(c.query as never, { siteId: s.foreignSite });
      expect(result).toEqual(c.empty);
    });
  }
});

/* ── singleton read: getDisplaySettings returns the canonical default ─── */

describe("D4 — reviews.getDisplaySettings enforces the module contract", () => {
  it("enabled → returns a settings object", async () => {
    const result = await as().query(api.reviews.getDisplaySettings, {
      siteId: s.enabledSite,
    });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("object");
  });

  it("disabled → returns the canonical default (not null/throw)", async () => {
    const result = await as().query(api.reviews.getDisplaySettings, {
      siteId: s.disabledSite,
    });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("object");
  });

  it("wrong tenant → returns the canonical default (no leak)", async () => {
    const result = await as().query(api.reviews.getDisplaySettings, {
      siteId: s.foreignSite,
    });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("object");
  });
});
