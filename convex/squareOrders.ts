import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

// ── Square Orders ─────────────────────────────────────────────────────────────

export const listOrders = query({
  args: { siteId: v.id("sites"), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, limit = 50 }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const orders = await ctx.db
      .query("squareOrders")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(limit);
    return orders.map((o) => ({ ...o, id: o._id }));
  },
});

export const getOrdersAnalytics = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const mtdStart = startOfMonth.getTime();

    const allOrders = await ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
    const mtdOrders = completedOrders.filter((o) => o.createdAt >= mtdStart);

    const revenueMtdCents = mtdOrders.reduce((sum, o) => sum + o.amountCents, 0);

    const itemCounts: Record<string, number> = {};
    for (const o of completedOrders) {
      if (o.itemName) itemCounts[o.itemName] = (itemCounts[o.itemName] ?? 0) + 1;
    }
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      revenueMtdCents,
      transactionCountMtd: mtdOrders.length,
      totalOrders: completedOrders.length,
      topItem,
    };
  },
});

export const upsertOrderFromWebhook = internalMutation({
  args: {
    siteId: v.id("sites"),
    squareOrderId: v.string(),
    squarePaymentId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
    status: v.string(),
    refundStatus: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, { siteId, squareOrderId, ...fields }) => {
    const existing = await ctx.db
      .query("squareOrders")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) => q.eq(q.field("squareOrderId"), squareOrderId))
      .first();

    let orderId;
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      orderId = existing._id;
    } else {
      orderId = await ctx.db.insert("squareOrders", { siteId, squareOrderId, ...fields });
    }

    // Auto-trigger CRM payment_notification sync when order is completed.
    // Routes through syncToCrm which enforces connection check + entity toggle.
    if (fields.status === "COMPLETED") {
      await ctx.scheduler.runAfter(0, internal.crm.syncToCrm, {
        siteId,
        provider: "operon",
        entityType: "payment_notification",
        direction: "outbound",
        entityRef: orderId.toString(),
        payload: {
          square_order_id: squareOrderId,
          customer_name: fields.customerName,
          customer_email: fields.customerEmail,
          item_name: fields.itemName,
          amount_cents: fields.amountCents,
          status: fields.status,
        },
      });
    }

    return orderId;
  },
});

// ── Square Catalog Items ──────────────────────────────────────────────────────

export const listCatalogItems = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("squareCatalogItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.map((i) => ({ ...i, id: i._id }));
  },
});

export const upsertCatalogItem = internalMutation({
  args: {
    siteId: v.id("sites"),
    squareItemId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    squareVariationId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, { siteId, squareItemId, ...fields }) => {
    const existing = await ctx.db
      .query("squareCatalogItems")
      .withIndex("by_site_squareItemId", (q) => q.eq("siteId", siteId).eq("squareItemId", squareItemId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields as any);
      return existing._id;
    }
    return ctx.db.insert("squareCatalogItems", { siteId, squareItemId, ...fields });
  },
});

export const updateLastCatalogSync = internalMutation({
  args: { siteId: v.id("sites"), lastSyncedAt: v.number() },
  handler: async (ctx, { siteId, lastSyncedAt }) => {
    const config = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (config) await ctx.db.patch(config._id, { lastCatalogSyncAt: lastSyncedAt });
  },
});

// ── Square Catalog Sync Action ────────────────────────────────────────────────

export const syncCatalog = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }): Promise<{ synced: number; error?: string }> => {
    const config = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!config?.accessToken) return { synced: 0, error: "Square not configured" };

    const baseUrl = config.environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";

    try {
      const res = await fetch(`${baseUrl}/v2/catalog/list?types=ITEM`, {
        headers: { Authorization: `Bearer ${config.accessToken}`, "Square-Version": "2024-11-20" },
      });
      if (!res.ok) return { synced: 0, error: `Square API error: ${res.status}` };
      const data = await res.json() as any;
      const objects = (data.objects ?? []) as any[];
      const lastSyncedAt = Date.now();

      for (const obj of objects) {
        const variation = obj.item_data?.variations?.[0];
        const priceMoney = variation?.item_variation_data?.price_money;
        await ctx.runMutation(internal.squareOrders.upsertCatalogItem, {
          siteId,
          squareItemId: obj.id,
          name: obj.item_data?.name ?? obj.id,
          description: obj.item_data?.description,
          category: obj.type,
          priceCents: priceMoney?.amount ?? undefined,
          squareVariationId: variation?.id,
          imageUrl: undefined,
          lastSyncedAt,
        });
      }

      await ctx.runMutation(internal.squareOrders.updateLastCatalogSync, { siteId, lastSyncedAt });
      return { synced: objects.length };
    } catch (err: any) {
      return { synced: 0, error: err.message ?? "Unknown error" };
    }
  },
});

// ── Square Discounts ──────────────────────────────────────────────────────────

export const listDiscounts = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const items = await ctx.db.query("squareDiscounts").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return items.map((d) => ({ ...d, id: d._id }));
  },
});

export const createDiscount = mutation({
  args: {
    siteId: v.id("sites"),
    squareDiscountId: v.string(),
    name: v.string(),
    code: v.optional(v.string()),
    discountType: v.string(),
    amount: v.optional(v.number()),
    percentage: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("squareDiscounts", { siteId, ...fields });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "square_discount", entityId: id, page: "Commerce", details: fields.name });
    return id;
  },
});

export const updateDiscount = mutation({
  args: { siteId: v.id("sites"), discountId: v.id("squareDiscounts"), name: v.optional(v.string()), code: v.optional(v.string()), expiresAt: v.optional(v.number()) },
  handler: async (ctx, { siteId, discountId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(discountId);
    if (!existing || existing.siteId !== siteId) throw new Error("Discount not found");
    await ctx.db.patch(discountId, fields as any);
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "square_discount", entityId: discountId, page: "Commerce" });
    return discountId;
  },
});

export const removeDiscount = mutation({
  args: { siteId: v.id("sites"), discountId: v.id("squareDiscounts") },
  handler: async (ctx, { siteId, discountId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(discountId);
    if (!existing || existing.siteId !== siteId) throw new Error("Discount not found");
    await ctx.db.delete(discountId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "square_discount", entityId: discountId, page: "Commerce" });
  },
});
