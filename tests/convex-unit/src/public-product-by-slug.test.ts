/**
 * Public product detail endpoint — visibility and existence guards
 *
 * Tests the `getProductByProductSlug` internal query that backs
 * GET /api/public/products/by-slug?site=&product=
 *
 * Proves:
 *   1. A visible product is returned in full (HTTP → 200).
 *   2. A product with isVisible: false returns null (HTTP → 404).
 *   3. A non-existent product slug returns null (HTTP → 404).
 *
 * The HTTP handler in convex/http.ts does:
 *   const data = await ctx.runQuery(internal.public.getProductByProductSlug, ...)
 *   if (!data) return notFound("Product not found")
 *   return ok(data)
 * So null from the query is the contract that drives the 404 response.
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
    status: "active",
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: {},
  };
}

function visibleProductDoc(siteId: Id<"sites">, slug = "visible-product") {
  return {
    siteId,
    title: "Visible Product",
    slug,
    description: "This product is publicly visible",
    order: 0,
    isVisible: true,
  };
}

function hiddenProductDoc(siteId: Id<"sites">, slug = "hidden-product") {
  return {
    siteId,
    title: "Hidden Product",
    slug,
    description: "This product is not publicly visible",
    order: 1,
    isVisible: false,
  };
}

// ── fixtures ──────────────────────────────────────────────────────────────────

type Seeded = {
  siteId: Id<"sites">;
  visibleProductId: Id<"siteProducts">;
  hiddenProductId: Id<"siteProducts">;
};

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", siteDoc("Test Site", "test-site"));
    const visibleProductId = await ctx.db.insert("siteProducts", visibleProductDoc(siteId));
    const hiddenProductId = await ctx.db.insert("siteProducts", hiddenProductDoc(siteId));
    return { siteId, visibleProductId, hiddenProductId };
  });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("getProductByProductSlug — visible product", () => {
  it("returns the full product payload for a visible product (HTTP → 200)", async () => {
    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "test-site",
        productSlug: "visible-product",
      })
    );

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("visible-product");
    expect(result!.title).toBe("Visible Product");
    expect(result!.siteId).toBe(s.siteId);
    // Confirm the full public payload shape is present
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("order");
    expect(result).toHaveProperty("isFeatured");
  });
});

describe("getProductByProductSlug — hidden product", () => {
  it("returns null for a product with isVisible: false (HTTP → 404)", async () => {
    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "test-site",
        productSlug: "hidden-product",
      })
    );

    expect(result).toBeNull();
  });

  it("returns null even after a visible product is toggled to hidden", async () => {
    // Make the visible product hidden and confirm it disappears from the public query
    await t.run(async (ctx) => {
      await ctx.db.patch(s.visibleProductId, { isVisible: false });
    });

    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "test-site",
        productSlug: "visible-product",
      })
    );

    expect(result).toBeNull();
  });
});

describe("getProductByProductSlug — non-existent slug", () => {
  it("returns null for a slug that does not exist on the site (HTTP → 404)", async () => {
    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "test-site",
        productSlug: "does-not-exist",
      })
    );

    expect(result).toBeNull();
  });

  it("returns null for a valid product slug on a non-existent site (HTTP → 404)", async () => {
    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "no-such-site",
        productSlug: "visible-product",
      })
    );

    expect(result).toBeNull();
  });

  it("returns null when the product slug belongs to a different site", async () => {
    // Create a second site with its own product
    await t.run(async (ctx) => {
      const otherSite = await ctx.db.insert("sites", siteDoc("Other Site", "other-site"));
      await ctx.db.insert("siteProducts", visibleProductDoc(otherSite, "other-product"));
    });

    // Querying site A for a slug that only exists on site B must return null
    const result = await t.run((ctx) =>
      ctx.runQuery(internal.public.getProductByProductSlug, {
        siteSlug: "test-site",
        productSlug: "other-product",
      })
    );

    expect(result).toBeNull();
  });
});
