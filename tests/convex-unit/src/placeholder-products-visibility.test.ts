/**
 * Placeholder product visibility — public-query isolation test.
 *
 * Proves that products seeded with isVisible:false are completely invisible
 * to the public-facing getProductsBySlug query, regardless of how they were
 * created (seedPlaceholders mutation or onboarding.launch wizard).
 *
 * This test is intentionally designed to fail loudly if the `.filter(d =>
 * d.isVisible)` guard is ever removed from convex/public.ts.
 *
 * Assertions:
 *   ✓ seedPlaceholders inserts 3 products all with isVisible:false
 *   ✓ getProductsBySlug returns [] for a site that has only hidden placeholders
 *   ✓ getProductsBySlug returns visible products once one is published
 *   ✓ onboarding.launch with "products" page seeds hidden placeholders ([] publicly)
 *   ✓ A site with NO products also returns [] (baseline sanity)
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── helpers ──────────────────────────────────────────────────────────────────

function siteDoc(name: string, slug: string) {
  return {
    name,
    slug,
    status: "active" as const,
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: {},
  };
}

function userDoc(
  clerkUserId: string,
  isSuperAdmin = false,
  roles: { siteId: Id<"sites">; role: string }[] = [],
) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin,
    isActive: true,
    roles,
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

beforeEach(async () => {
  t = convexTest(schema, modules);
});

// ── seedPlaceholders path ─────────────────────────────────────────────────────

describe("seedPlaceholders — placeholders are hidden from the public query", () => {
  it("returns an empty array for a site that has only hidden placeholder products", async () => {
    const siteId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("sites", siteDoc("Acme Co", "acme-co"));
      await ctx.db.insert("users", userDoc("superadmin", true));
      return id;
    });

    const as = t.withIdentity({ subject: "superadmin" });
    const result = await as.mutation(api.products.seedPlaceholders, { siteId });
    expect(result.seeded).toBe(3);

    const publicProducts = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "acme-co" }),
    );

    expect(publicProducts).toHaveLength(0);
  });

  it("confirms all 3 seeded records are stored with isVisible:false", async () => {
    const siteId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("sites", siteDoc("Beta Corp", "beta-corp"));
      await ctx.db.insert("users", userDoc("superadmin", true));
      return id;
    });

    await t.withIdentity({ subject: "superadmin" }).mutation(
      api.products.seedPlaceholders,
      { siteId },
    );

    const storedProducts = await t.run((ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    expect(storedProducts).toHaveLength(3);
    for (const p of storedProducts) {
      expect(p.isVisible).toBe(false);
    }
  });

  it("returns a product once it is published (isVisible flipped to true)", async () => {
    const siteId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("sites", siteDoc("Gamma Ltd", "gamma-ltd"));
      await ctx.db.insert("users", userDoc("superadmin", true));
      await ctx.db.insert("users", userDoc("owner_gamma", false, [{ siteId: id, role: "owner" }]));
      return id;
    });

    await t.withIdentity({ subject: "superadmin" }).mutation(
      api.products.seedPlaceholders,
      { siteId },
    );

    // Confirm hidden before publishing
    const before = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "gamma-ltd" }),
    );
    expect(before).toHaveLength(0);

    // Publish one placeholder by setting isVisible:true
    const [placeholder] = await t.run((ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );

    await t.withIdentity({ subject: "owner_gamma" }).mutation(api.products.update, {
      siteId,
      productId: placeholder._id,
      isVisible: true,
    });

    // Now the public query must return exactly that one product
    const after = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "gamma-ltd" }),
    );
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(placeholder._id);
  });
});

// ── onboarding.launch path ────────────────────────────────────────────────────

describe("onboarding.launch with products page — wizard-seeded placeholders are hidden", () => {
  const SESSION_KEY = "test-session-products-visibility";

  const STEP_DATA = {
    businessName: "Delta Dojo",
    websiteName: "Delta Dojo — Official Site",
    industry: "training_academy",
    brandColorPrimary: "#4f46e5",
    brandColorSecondary: "#1e1b4b",
    pages: ["home", "contact", "products"],
    integrations: [],
    domainChoice: "later",
    email: "hello@deltadojo.com",
    phone: "555-000-0001",
    address: "1 Training Lane",
    description: "Premier martial arts academy.",
  };

  beforeEach(async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("agencies", {
        name: "Test Agency",
        slug: "test-agency",
        primaryColor: "#000",
        accentColor: "#fff",
        supportEmail: "support@test.local",
        featureFlags: {},
        licensingStatus: "active",
        isActive: true,
      });
      await ctx.db.insert("users", userDoc("superadmin", true));
    });
  });

  it("returns an empty array for a freshly launched site that included products in its page set", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: SESSION_KEY });
    const { siteId, slug } = await as.mutation(api.onboarding.launch, {
      sessionKey: SESSION_KEY,
      stepData: STEP_DATA,
    });

    // Verify products were actually seeded (they should be in the DB)
    const storedProducts = await t.run((ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect(),
    );
    expect(storedProducts.length).toBeGreaterThan(0);
    for (const p of storedProducts) {
      expect(p.isVisible).toBe(false);
    }

    // The public-facing query must return nothing
    const publicProducts = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug }),
    );
    expect(publicProducts).toHaveLength(0);
  });
});

// ── baseline sanity ───────────────────────────────────────────────────────────

describe("getProductsBySlug — baseline: site with no products returns empty array", () => {
  it("returns [] for a site that has no products at all", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("sites", siteDoc("Empty Site", "empty-site"));
    });

    const publicProducts = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "empty-site" }),
    );
    expect(publicProducts).toHaveLength(0);
  });

  it("returns [] for an unknown site slug", async () => {
    const publicProducts = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "does-not-exist" }),
    );
    expect(publicProducts).toHaveLength(0);
  });
});
