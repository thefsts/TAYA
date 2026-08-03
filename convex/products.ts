import { query, mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";
import { provisionUser } from "./lib/getCurrentUser";
import { Id } from "./_generated/dataModel";

// ── Shared internal helper ───────────────────────────────────────────────────

/**
 * Inserts 3 placeholder products for a newly-created site.
 * Idempotent: returns 0 immediately if any siteProducts already exist for
 * the site, so it is safe to call multiple times without creating duplicates.
 *
 * @param opts.businessName  Optional client name used to personalise copy.
 * @param opts.tiers         Optional triple of tier labels; falls back to
 *                           ["Starter", "Professional", "Enterprise"].
 */
export async function insertPlaceholderProducts(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  opts: { businessName?: string; tiers?: [string, string, string] } = {},
): Promise<number> {
  // Idempotency guard — bail out if products already exist for this site.
  const existing = await ctx.db
    .query("siteProducts")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .first();
  if (existing) return 0;

  const bn = opts.businessName ? ` with ${opts.businessName}` : "";
  const [t0, t1, t2] = opts.tiers ?? ["Starter", "Professional", "Enterprise"];

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
  }

  const placeholders = [
    {
      title: `${t0} Package`,
      slug: slugify(`${t0}-package`) || "starter-package",
      shortDescription: `Everything you need to get started${bn}.`,
      description:
        `Our ${t0} Package is designed for individuals and small teams ready to hit the ground running${bn}. ` +
        `Includes core features, onboarding support, and 30 days of follow-up assistance.`,
      priceCents: 49900,
      priceLabel: "$499",
      isFeatured: false,
      ctaLabel: "Get Started",
    },
    {
      title: `${t1} Package`,
      slug: slugify(`${t1}-package`) || "professional-package",
      shortDescription: `For growing businesses that need more power${bn}.`,
      description:
        `The ${t1} Package unlocks advanced features, priority support, and expanded capacity ` +
        `so your team can move faster and deliver better results${bn}.`,
      priceCents: 149900,
      priceLabel: "$1,499",
      isFeatured: true,
      ctaLabel: "Get Started",
    },
    {
      title: `${t2} Package`,
      slug: slugify(`${t2}-package`) || "enterprise-package",
      shortDescription: `Custom solutions for large organisations${bn}.`,
      description:
        `The ${t2} Package is fully tailored to your organisation's scale and goals${bn}. ` +
        `Includes dedicated account management, custom integrations, and an SLA-backed support tier.`,
      priceCents: 299900,
      priceLabel: "From $2,999",
      isFeatured: false,
      ctaLabel: "Contact Us",
    },
  ];

  for (let i = 0; i < placeholders.length; i++) {
    const p = placeholders[i];
    await ctx.db.insert("siteProducts", {
      siteId,
      order: i,
      isVisible: false,
      category: "Packages",
      title: p.title,
      slug: p.slug,
      description: p.description,
      shortDescription: p.shortDescription,
      priceCents: p.priceCents,
      priceLabel: p.priceLabel,
      isFeatured: p.isFeatured,
      ctaLabel: p.ctaLabel,
    });
  }

  return placeholders.length;
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db
      .query("siteProducts")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
  },
});

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    shortDescription: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    // Enforce slug uniqueness within this site
    const slugConflict = await ctx.db
      .query("siteProducts")
      .withIndex("by_site_slug", (q) => q.eq("siteId", siteId).eq("slug", fields.slug))
      .first();
    if (slugConflict) {
      throw new Error(`A product with the slug "${fields.slug}" already exists on this site. Choose a different slug.`);
    }
    // Determine next order value
    const existing = await ctx.db
      .query("siteProducts")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    const order = existing.length;
    const id = await ctx.db.insert("siteProducts", {
      siteId,
      order,
      isVisible: fields.isVisible ?? true,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "product",
      entityId: id,
      page: "Products",
      newValue: doc,
    });
    await recordVersion(ctx, {
      siteId,
      actorName: user.name,
      entityType: "product",
      entityId: id,
      snapshot: doc,
    });
    return doc;
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    productId: v.id("siteProducts"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    priceLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, productId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(productId);
    if (!existing || existing.siteId !== siteId) throw new Error("Product not found");
    // Enforce slug uniqueness within this site (excluding the current product)
    if (fields.slug !== undefined) {
      const slugConflict = await ctx.db
        .query("siteProducts")
        .withIndex("by_site_slug", (q) => q.eq("siteId", siteId).eq("slug", fields.slug!))
        .first();
      if (slugConflict && slugConflict._id !== productId) {
        throw new Error(`A product with the slug "${fields.slug}" already exists on this site. Choose a different slug.`);
      }
    }
    await ctx.db.patch(productId, fields as any);
    const doc = (await ctx.db.get(productId))!;
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "product",
      entityId: productId,
      page: "Products",
      previousValue: existing,
      newValue: doc,
    });
    await recordVersion(ctx, {
      siteId,
      actorName: user.name,
      entityType: "product",
      entityId: productId,
      snapshot: doc,
    });
    return doc;
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), productId: v.id("siteProducts") },
  handler: async (ctx, { siteId, productId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(productId);
    if (!existing || existing.siteId !== siteId) throw new Error("Product not found");
    await ctx.db.delete(productId);
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "deleted",
      entityType: "product",
      entityId: productId,
      page: "Products",
      previousValue: existing,
    });
    return { success: true };
  },
});

/**
 * Seed 3 placeholder products for a newly-created site.
 * Called by the onboarding wizard and admin site-creation flow when the
 * Products module is enabled. Records are hidden (isVisible: false) so
 * they don't appear publicly until the client edits and publishes them.
 * Requires superAdmin.
 */
export const seedPlaceholders = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const user = await provisionUser(ctx);
    if (!user.isSuperAdmin) throw new Error("Forbidden: superAdmin required");

    const seeded = await insertPlaceholderProducts(ctx, siteId);

    if (seeded > 0) {
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "seeded",
        entityType: "product",
        page: "Onboarding",
        details: `${seeded} placeholder products created (hidden until published)`,
      });
    }

    return { seeded };
  },
});
export const reorder = mutation({
  args: {
    siteId: v.id("sites"),
    orderedIds: v.array(v.id("siteProducts")),
  },
  handler: async (ctx, { siteId, orderedIds }) => {
    await requireSiteAccessMutation(ctx, siteId);
    // Fetch and validate every product belongs to this site before patching
    const docs = await Promise.all(orderedIds.map((id) => ctx.db.get(id)));
    for (const doc of docs) {
      if (!doc || doc.siteId !== siteId) {
        throw new Error("One or more products do not belong to this site");
      }
    }
    await Promise.all(
      orderedIds.map((id, idx) => ctx.db.patch(id, { order: idx }))
    );
    return { success: true };
  },
});
