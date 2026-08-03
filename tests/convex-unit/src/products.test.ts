/**
 * Products / Offerings Manager — tenant-isolation and CRUD tests
 *
 * Uses the real Convex functions and schema against an in-memory backend
 * (convex-test). Proves:
 *
 *   1. An owner on Site A can create, read, update, reorder, and delete
 *      products on their own site.
 *   2. An owner on Site A CANNOT read or write products on Site B.
 *   3. The reorder mutation rejects a list that contains a product ID
 *      belonging to a different site (cross-site ID injection attack).
 *   4. Unauthenticated callers are rejected from all write surfaces.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── helpers ─────────────────────────────────────────────────────────────────

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

function userDoc(
  clerkUserId: string,
  roles: { siteId: Id<"sites">; role: string }[] = [],
  isSuperAdmin = false,
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

function productArgs(siteId: Id<"sites">, overrides: Partial<{
  title: string; slug: string; description: string;
}> = {}) {
  return {
    siteId,
    title: overrides.title ?? "Starter Package",
    slug: overrides.slug ?? "starter-package",
    description: overrides.description ?? "Entry level offering",
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────

type Seeded = {
  siteA: Id<"sites">;
  siteB: Id<"sites">;
  productB: Id<"siteProducts">;
};

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await t.run(async (ctx) => {
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "site-a"));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "site-b"));

    await ctx.db.insert("users", userDoc("owner_a", [{ siteId: siteA, role: "owner" }]));
    await ctx.db.insert("users", userDoc("owner_b", [{ siteId: siteB, role: "owner" }]));
    await ctx.db.insert("users", userDoc("superadmin", [], true));

    // A product in site B to use as a cross-site injection target
    const productB = await ctx.db.insert("siteProducts", {
      siteId: siteB,
      title: "Site B Product",
      slug: "site-b-product",
      description: "Belongs to Site B",
      order: 0,
      isVisible: true,
    });

    return { siteA, siteB, productB };
  });
});

// ── CRUD on own site ─────────────────────────────────────────────────────────

describe("Owner on Site A — own site CRUD", () => {
  const as = () => t.withIdentity({ subject: "owner_a" });

  it("can create a product and see it in the list", async () => {
    const created = await as().mutation(api.products.create, productArgs(s.siteA));
    expect(created.title).toBe("Starter Package");
    expect(created.siteId).toBe(s.siteA);

    const list = await as().query(api.products.list, { siteId: s.siteA });
    expect(list?.map((p: any) => p.slug)).toContain("starter-package");
  });

  it("can update a product", async () => {
    const created = await as().mutation(api.products.create, productArgs(s.siteA));
    const updated = await as().mutation(api.products.update, {
      siteId: s.siteA,
      productId: created._id,
      title: "Professional Package",
      isFeatured: true,
    });
    expect(updated.title).toBe("Professional Package");
    expect(updated.isFeatured).toBe(true);
  });

  it("can delete a product", async () => {
    const created = await as().mutation(api.products.create, productArgs(s.siteA));
    await as().mutation(api.products.remove, { siteId: s.siteA, productId: created._id });
    const list = await as().query(api.products.list, { siteId: s.siteA });
    expect(list?.map((p: any) => p._id)).not.toContain(created._id);
  });

  it("can reorder products on the same site", async () => {
    const p1 = await as().mutation(api.products.create, productArgs(s.siteA, { slug: "p1", title: "P1" }));
    const p2 = await as().mutation(api.products.create, productArgs(s.siteA, { slug: "p2", title: "P2" }));

    await expect(
      as().mutation(api.products.reorder, {
        siteId: s.siteA,
        orderedIds: [p2._id, p1._id],
      }),
    ).resolves.toMatchObject({ success: true });

    const list = await as().query(api.products.list, { siteId: s.siteA });
    const sorted = [...(list ?? [])].sort((a: any, b: any) => a.order - b.order);
    expect(sorted[0]._id).toBe(p2._id);
    expect(sorted[1]._id).toBe(p1._id);
  });
});

// ── Tenant isolation — reads ──────────────────────────────────────────────────

describe("Owner on Site A — cannot read Site B products", () => {
  const as = () => t.withIdentity({ subject: "owner_a" });

  it("list returns null for Site B", async () => {
    const list = await as().query(api.products.list, { siteId: s.siteB });
    expect(list).toBeNull();
  });
});

// ── Tenant isolation — writes ─────────────────────────────────────────────────

describe("Owner on Site A — cannot write Site B products", () => {
  const as = () => t.withIdentity({ subject: "owner_a" });

  it("CANNOT create a product in Site B", async () => {
    await expect(
      as().mutation(api.products.create, productArgs(s.siteB)),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT update a product that belongs to Site B", async () => {
    await expect(
      as().mutation(api.products.update, {
        siteId: s.siteB,
        productId: s.productB,
        title: "Hacked",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT delete a product from Site B", async () => {
    await expect(
      as().mutation(api.products.remove, { siteId: s.siteB, productId: s.productB }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ── Cross-site reorder injection ──────────────────────────────────────────────

describe("Reorder — cross-site ID injection is rejected", () => {
  it("rejects orderedIds containing a product from a different site", async () => {
    const asA = t.withIdentity({ subject: "owner_a" });
    const ownProduct = await asA.mutation(api.products.create, productArgs(s.siteA));

    // Attempt: include Site B's product ID in the Site A reorder list
    await expect(
      asA.mutation(api.products.reorder, {
        siteId: s.siteA,
        orderedIds: [ownProduct._id, s.productB],
      }),
    ).rejects.toThrow(/do not belong to this site/);
  });

  it("rejects a reorder list composed entirely of another site's products", async () => {
    const asA = t.withIdentity({ subject: "owner_a" });

    await expect(
      asA.mutation(api.products.reorder, {
        siteId: s.siteA,
        orderedIds: [s.productB],
      }),
    ).rejects.toThrow(/do not belong to this site/);
  });
});

// ── seedPlaceholders idempotency ──────────────────────────────────────────────

describe("seedPlaceholders — idempotency", () => {
  const as = () => t.withIdentity({ subject: "superadmin" });

  it("seeding once creates exactly 3 products", async () => {
    const { seeded } = await as().mutation(api.products.seedPlaceholders, {
      siteId: s.siteA,
    });
    expect(seeded).toBe(3);

    const list = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", s.siteA))
        .collect(),
    );
    expect(list).toHaveLength(3);
  });

  it("calling seedPlaceholders a second time leaves exactly 3 products, not 6", async () => {
    await as().mutation(api.products.seedPlaceholders, { siteId: s.siteA });
    const second = await as().mutation(api.products.seedPlaceholders, {
      siteId: s.siteA,
    });

    // Second call should be a no-op
    expect(second.seeded).toBe(0);

    const list = await t.run(async (ctx) =>
      ctx.db
        .query("siteProducts")
        .withIndex("by_site", (q) => q.eq("siteId", s.siteA))
        .collect(),
    );
    expect(list).toHaveLength(3);
  });
});

// ── Unauthenticated access ────────────────────────────────────────────────────

describe("Unauthenticated callers", () => {
  it("cannot create a product", async () => {
    await expect(
      t.mutation(api.products.create, productArgs(s.siteA)),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot update a product", async () => {
    // We need a valid product ID — create one as owner first
    const product = await t.withIdentity({ subject: "owner_a" }).mutation(
      api.products.create,
      productArgs(s.siteA),
    );
    await expect(
      t.mutation(api.products.update, { siteId: s.siteA, productId: product._id, title: "x" }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("cannot reorder products", async () => {
    await expect(
      t.mutation(api.products.reorder, { siteId: s.siteA, orderedIds: [] }),
    ).rejects.toThrow(/Not authenticated/);
  });
});
