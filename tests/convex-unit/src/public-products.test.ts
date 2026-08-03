/**
 * Public products endpoint — visibility filter regression tests
 *
 * Uses the real Convex functions and schema against an in-memory backend
 * (convex-test). Proves:
 *
 *   1. A product with isVisible=false is never returned by getProductsBySlug.
 *   2. Only products belonging to the requested site slug are returned
 *      (tenant isolation on the public endpoint).
 *   3. Featured products have isFeatured=true in the response; non-featured
 *      products have isFeatured=false.
 *   4. Unknown slugs return an empty array (no crash, no leakage).
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { internal } from "../../../convex/_generated/api";
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

function productDoc(
  siteId: Id<"sites">,
  overrides: Partial<{
    title: string;
    slug: string;
    description: string;
    isVisible: boolean;
    isFeatured: boolean;
    order: number;
  }> = {},
) {
  return {
    siteId,
    title: overrides.title ?? "Test Product",
    slug: overrides.slug ?? "test-product",
    description: overrides.description ?? "A test product",
    order: overrides.order ?? 0,
    isVisible: overrides.isVisible ?? true,
    ...(overrides.isFeatured !== undefined ? { isFeatured: overrides.isFeatured } : {}),
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

type Seeded = {
  siteA: Id<"sites">;
  siteB: Id<"sites">;
  visibleProductId: Id<"siteProducts">;
  hiddenProductId: Id<"siteProducts">;
  featuredProductId: Id<"siteProducts">;
};

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await t.run(async (ctx) => {
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "site-a"));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "site-b"));

    const visibleProductId = await ctx.db.insert(
      "siteProducts",
      productDoc(siteA, {
        title: "Visible Product",
        slug: "visible-product",
        isVisible: true,
        isFeatured: false,
        order: 1,
      }),
    );

    const hiddenProductId = await ctx.db.insert(
      "siteProducts",
      productDoc(siteA, {
        title: "Hidden Product",
        slug: "hidden-product",
        isVisible: false,
        isFeatured: false,
        order: 2,
      }),
    );

    const featuredProductId = await ctx.db.insert(
      "siteProducts",
      productDoc(siteA, {
        title: "Featured Product",
        slug: "featured-product",
        isVisible: true,
        isFeatured: true,
        order: 3,
      }),
    );

    // A product on Site B — must never appear in Site A results
    await ctx.db.insert(
      "siteProducts",
      productDoc(siteB, {
        title: "Site B Product",
        slug: "site-b-product",
        isVisible: true,
        order: 0,
      }),
    );

    return { siteA, siteB, visibleProductId, hiddenProductId, featuredProductId };
  });
});

// ── visibility filter ─────────────────────────────────────────────────────────

describe("getProductsBySlug — visibility filter", () => {
  it("excludes products with isVisible=false from the response", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    const slugs = results.map((p: any) => p.slug);
    expect(slugs).not.toContain("hidden-product");
  });

  it("includes products with isVisible=true in the response", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    const slugs = results.map((p: any) => p.slug);
    expect(slugs).toContain("visible-product");
  });

  it("returns only visible products when both visible and hidden exist", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    // Two visible products seeded for site-a (visible-product and featured-product)
    expect(results).toHaveLength(2);
    for (const p of results) {
      expect((p as any).isVisible).toBeUndefined(); // field is not forwarded in the public shape
      expect(["visible-product", "featured-product"]).toContain((p as any).slug);
    }
  });
});

// ── featured flag ─────────────────────────────────────────────────────────────

describe("getProductsBySlug — featured flag", () => {
  it("marks featured products with isFeatured=true", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    const featured = results.find((p: any) => p.slug === "featured-product");
    expect(featured).toBeDefined();
    expect(featured!.isFeatured).toBe(true);
  });

  it("marks non-featured products with isFeatured=false", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    const nonFeatured = results.find((p: any) => p.slug === "visible-product");
    expect(nonFeatured).toBeDefined();
    expect(nonFeatured!.isFeatured).toBe(false);
  });
});

// ── tenant isolation ──────────────────────────────────────────────────────────

describe("getProductsBySlug — tenant isolation", () => {
  it("does not return Site B products when querying Site A slug", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-a" }),
    );

    const slugs = results.map((p: any) => p.slug);
    expect(slugs).not.toContain("site-b-product");
  });

  it("does not return Site A products when querying Site B slug", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "site-b" }),
    );

    const slugs = results.map((p: any) => p.slug);
    expect(slugs).not.toContain("visible-product");
    expect(slugs).not.toContain("featured-product");
    expect(slugs).not.toContain("hidden-product");
  });
});

// ── unknown slug ──────────────────────────────────────────────────────────────

describe("getProductsBySlug — unknown slug", () => {
  it("returns an empty array for a slug that does not exist", async () => {
    const results = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductsBySlug, { slug: "no-such-site" }),
    );

    expect(results).toEqual([]);
  });
});
