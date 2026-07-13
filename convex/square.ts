import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";

/* ── helpers ──────────────────────────────────────────────────────────── */

function toConfigResponse(doc: any) {
  const { accessToken: _a, applicationId: _b, webhookSignatureKey: _c, ...safe } = doc;
  return {
    ...safe,
    id: doc._id,
    siteId: doc.siteId,
    applicationIdLast4: doc.applicationId ? doc.applicationId.slice(-4) : null,
    hasAccessToken: Boolean(doc.accessToken),
    hasWebhookSignatureKey: Boolean(doc.webhookSignatureKey),
    updatedAt: new Date(doc._creationTime).toISOString(),
  };
}

function toMappingResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString() };
}

function squareBaseUrl(env: string) {
  return env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}

async function squareFetch(base: string, token: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-17",
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Square API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** Find an existing Square CATEGORY by name, or create one and return its ID. */
async function lookupOrCreateCategory(base: string, token: string, name: string): Promise<string | undefined> {
  try {
    const listData = await squareFetch(base, token, "/v2/catalog/list?types=CATEGORY");
    const categories: any[] = listData.objects ?? [];
    const found = categories.find((c: any) => (c.category_data?.name ?? "").toLowerCase() === name.toLowerCase());
    if (found) return found.id as string;
    const createData = await squareFetch(base, token, "/v2/catalog/object", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `fsts-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        object: { type: "CATEGORY", id: "#new-cat", category_data: { name } },
      }),
    });
    return createData.catalog_object?.id as string | undefined;
  } catch {
    return undefined;
  }
}

/* ── squareConfig ──────────────────────────────────────────────────────── */

export const getConfig = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const doc = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (!doc) return { siteId, connected: false, environment: "sandbox", applicationIdLast4: null, locationId: null, checkoutEnabled: false, hasAccessToken: false, lastCatalogSyncAt: null, updatedAt: new Date().toISOString() };
    return toConfigResponse(doc);
  },
});

export const updateConfig = mutation({
  args: {
    siteId: v.id("sites"),
    environment: v.optional(v.string()),
    applicationId: v.optional(v.string()),
    locationId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    checkoutEnabled: v.optional(v.boolean()),
    webhookSignatureKey: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    const connected = Boolean((fields.applicationId ?? existing?.applicationId) && (fields.locationId ?? existing?.locationId) && (fields.accessToken ?? existing?.accessToken));
    let docId;
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, connected });
      docId = existing._id;
    } else {
      docId = await ctx.db.insert("squareConfig", { siteId, connected, environment: "sandbox", checkoutEnabled: false, ...fields });
    }
    const doc = (await ctx.db.get(docId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: existing ? "updated" : "created", entityType: "square_config", page: "Payments", previousValue: existing ? toConfigResponse(existing) : undefined, newValue: toConfigResponse(doc) });
    return toConfigResponse(doc);
  },
});

/* ── catalog mappings ──────────────────────────────────────────────────── */

export const listMappings = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return (await ctx.db.query("squareCatalogMappings").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toMappingResponse);
  },
});

export const createMapping = mutation({
  args: {
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    squareItemId: v.string(),
    squareVariationId: v.string(),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const id = await ctx.db.insert("squareCatalogMappings", { siteId, ...fields });
    const doc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "square_mapping", entityId: id, page: "Payments", newValue: doc });
    return toMappingResponse(doc);
  },
});

export const updateMapping = mutation({
  args: {
    siteId: v.id("sites"),
    mappingId: v.id("squareCatalogMappings"),
    squareItemId: v.optional(v.string()),
    squareVariationId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, mappingId, ...fields }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(mappingId);
    if (!existing || existing.siteId !== siteId) throw new Error("Mapping not found");
    await ctx.db.patch(mappingId, fields as any);
    const doc = (await ctx.db.get(mappingId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "square_mapping", entityId: mappingId, page: "Payments", previousValue: existing, newValue: doc });
    return toMappingResponse(doc);
  },
});

export const removeMapping = mutation({
  args: { siteId: v.id("sites"), mappingId: v.id("squareCatalogMappings") },
  handler: async (ctx, { siteId, mappingId }) => {
    const user = await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db.get(mappingId);
    if (!existing || existing.siteId !== siteId) throw new Error("Mapping not found");
    await ctx.db.delete(mappingId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "square_mapping", entityId: mappingId, page: "Payments", previousValue: existing });
    return { success: true };
  },
});

/* ── catalog items queries ─────────────────────────────────────────────── */

export const listCatalogItems = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return ctx.db.query("squareCatalogItems").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

/* ── orders queries ────────────────────────────────────────────────────── */

export const listOrders = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const orders = await ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(100);
    return orders;
  },
});

export const getCommerceAnalytics = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const orders = await ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const mtdOrders = orders.filter((o) => o.createdAt >= startOfMonth && o.status === "COMPLETED");
    const revenueMtdCents = mtdOrders.reduce((sum, o) => sum + o.amountCents, 0);
    const itemCounts: Record<string, number> = {};
    for (const o of orders.filter((o) => o.status === "COMPLETED")) {
      if (o.itemName) itemCounts[o.itemName] = (itemCounts[o.itemName] ?? 0) + 1;
    }
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { revenueMtdCents, transactionCount: mtdOrders.length, topItem, totalOrders: orders.length };
  },
});

/* ── discounts queries ─────────────────────────────────────────────────── */

export const listDiscounts = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return ctx.db.query("squareDiscounts").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

/* ── action authorization helper ──────────────────────────────────────── */

const WRITE_ROLES = new Set([
  "client_admin", "site_admin", "admin", "editor",
  "content_editor", "manager", "marketing_manager", "training_manager",
]);

export const checkSiteAccessForAction = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user || !user.isActive) return false;
    if (user.isSuperAdmin) return true;
    return user.roles.some((r: any) => r.siteId === siteId && WRITE_ROLES.has(r.role));
  },
});

async function requireActionSiteAccess(ctx: any, siteId: any) {
  const ok = await ctx.runQuery(internal.square.checkSiteAccessForAction, { siteId });
  if (!ok) throw new Error("Forbidden: site access required");
}

/* ── internal mutations (called by actions & webhook) ─────────────────── */

export const upsertCatalogItem = internalMutation({
  args: {
    siteId: v.id("sites"),
    squareItemId: v.string(),
    squareVariationId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, { siteId, squareItemId, ...fields }) => {
    const existing = await ctx.db.query("squareCatalogItems").withIndex("by_site_squareItemId", (q) => q.eq("siteId", siteId).eq("squareItemId", squareItemId)).first();
    if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
    return ctx.db.insert("squareCatalogItems", { siteId, squareItemId, ...fields });
  },
});

export const upsertOrder = internalMutation({
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
    const existing = await ctx.db.query("squareOrders").withIndex("by_site_squareOrderId", (q) => q.eq("siteId", siteId).eq("squareOrderId", squareOrderId)).first();
    if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
    return ctx.db.insert("squareOrders", { siteId, squareOrderId, ...fields });
  },
});

export const upsertDiscount = internalMutation({
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
  handler: async (ctx, { siteId, squareDiscountId, ...fields }) => {
    const existing = await ctx.db.query("squareDiscounts").withIndex("by_site_squareDiscountId", (q) => q.eq("siteId", siteId).eq("squareDiscountId", squareDiscountId)).first();
    if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
    return ctx.db.insert("squareDiscounts", { siteId, squareDiscountId, ...fields });
  },
});

export const setLastCatalogSyncAt = internalMutation({
  args: { siteId: v.id("sites"), at: v.number() },
  handler: async (ctx, { siteId, at }) => {
    const cfg = await ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
    if (cfg) await ctx.db.patch(cfg._id, { lastCatalogSyncAt: at });
  },
});

export const getCoursesBySite = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

export const getEventsBySite = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
  },
});

export const upsertCatalogMapping = internalMutation({
  args: {
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    squareItemId: v.string(),
    squareVariationId: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, entityType, entityId, ...fields }) => {
    const existing = await ctx.db.query("squareCatalogMappings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) => q.and(q.eq(q.field("entityType"), entityType), q.eq(q.field("entityId"), entityId)))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("squareCatalogMappings", { siteId, entityType, entityId, ...fields });
  },
});

export const getConfigInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    return ctx.db.query("squareConfig").withIndex("by_site", (q) => q.eq("siteId", siteId)).first();
  },
});

export const updateRefundStatus = internalMutation({
  args: { siteId: v.id("sites"), squarePaymentId: v.string(), refundStatus: v.string() },
  handler: async (ctx, { siteId, squarePaymentId, refundStatus }) => {
    const order = await ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) => q.eq(q.field("squarePaymentId"), squarePaymentId)).first();
    if (order) await ctx.db.patch(order._id, { refundStatus });
  },
});

export const getSiteBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
  },
});

/* ── Catalog Sync action ───────────────────────────────────────────────── */

export const syncCatalog = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken) throw new Error("Square is not configured for this site");
    const base = squareBaseUrl(cfg.environment);
    const data = await squareFetch(base, cfg.accessToken, "/v2/catalog/list?types=ITEM");
    const objects: any[] = data.objects ?? [];
    const now = Date.now();
    // Build squareItemId → first variationId map for mapping sync below
    const variationMap = new Map<string, string>();
    for (const obj of objects) {
      if (obj.type !== "ITEM") continue;
      const item = obj.item_data;
      const firstVariation = item?.variations?.[0];
      const variation = firstVariation?.item_variation_data;
      const priceCents = variation?.price_money?.amount;
      await ctx.runMutation(internal.square.upsertCatalogItem, {
        siteId,
        squareItemId: obj.id,
        squareVariationId: firstVariation?.id,
        name: item?.name ?? "Unnamed",
        description: item?.description,
        priceCents: typeof priceCents === "number" ? priceCents : undefined,
        category: item?.categories?.[0]?.name,
        imageUrl: item?.image_ids?.[0],
        lastSyncedAt: now,
      });
      if (firstVariation?.id) variationMap.set(obj.id, firstVariation.id);
    }
    await ctx.runMutation(internal.square.setLastCatalogSyncAt, { siteId, at: now });
    // Sync squareCatalogMappings for any courses/events linked to synced items
    const courses = await ctx.runQuery(internal.square.getCoursesBySite, { siteId });
    const events = await ctx.runQuery(internal.square.getEventsBySite, { siteId });
    const linked: Array<{ entityType: string; entityId: string; squareItemId: string }> = [
      ...courses.filter((c: any) => c.squareItemId && variationMap.has(c.squareItemId)).map((c: any) => ({ entityType: "course", entityId: c._id, squareItemId: c.squareItemId as string })),
      ...events.filter((e: any) => e.squareItemId && variationMap.has(e.squareItemId)).map((e: any) => ({ entityType: "event", entityId: e._id, squareItemId: e.squareItemId as string })),
    ];
    for (const link of linked) {
      await ctx.runMutation(internal.square.upsertCatalogMapping, {
        siteId,
        entityType: link.entityType,
        entityId: link.entityId,
        squareItemId: link.squareItemId,
        squareVariationId: variationMap.get(link.squareItemId)!,
      });
    }
    return { synced: objects.length, mappingsUpdated: linked.length };
  },
});

/* ── Update Catalog Item action ────────────────────────────────────────── */

export const updateCatalogItem = action({
  args: {
    siteId: v.id("sites"),
    squareItemId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, squareItemId, name, description, priceCents, category, imageUrl }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken) throw new Error("Square is not configured for this site");
    const base = squareBaseUrl(cfg.environment);
    // Resolve category ID in Square (create if missing)
    const categoryId = category ? await lookupOrCreateCategory(base, cfg.accessToken, category) : undefined;
    // Fetch existing object to get its version (Square requires it for updates)
    const existing = await squareFetch(base, cfg.accessToken, `/v2/catalog/object/${squareItemId}`);
    const existingObj = existing.object;
    if (!existingObj) throw new Error("Catalog item not found in Square");
    const existingVariation = existingObj.item_data?.variations?.[0];
    const itemData: any = { name, description };
    if (categoryId) itemData.categories = [{ id: categoryId }];
    const body = {
      idempotency_key: `fsts-update-${siteId}-${squareItemId}-${Date.now()}`,
      object: {
        type: "ITEM",
        id: squareItemId,
        version: existingObj.version,
        item_data: {
          ...itemData,
          variations: existingVariation ? [
            {
              ...existingVariation,
              item_variation_data: {
                ...existingVariation.item_variation_data,
                price_money: { amount: priceCents, currency: "USD" },
              },
            },
          ] : undefined,
        },
      },
    };
    const data = await squareFetch(base, cfg.accessToken, "/v2/catalog/object", { method: "POST", body: JSON.stringify(body) });
    const obj = data.catalog_object;
    const variationId = obj?.item_data?.variations?.[0]?.id ?? existingVariation?.id;
    await ctx.runMutation(internal.square.upsertCatalogItem, {
      siteId,
      squareItemId,
      squareVariationId: variationId,
      name,
      description,
      priceCents,
      category,
      imageUrl,
      lastSyncedAt: Date.now(),
    });
    return { squareItemId: obj?.id ?? squareItemId };
  },
});

/* ── Create Catalog Item action ────────────────────────────────────────── */

export const createCatalogItem = action({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, name, description, priceCents, category, imageUrl }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken) throw new Error("Square is not configured for this site");
    const base = squareBaseUrl(cfg.environment);
    // Resolve category ID in Square (create if missing)
    const categoryId = category ? await lookupOrCreateCategory(base, cfg.accessToken, category) : undefined;
    const itemData: any = { name, description };
    if (categoryId) itemData.categories = [{ id: categoryId }];
    const body = {
      idempotency_key: `fsts-${siteId}-${Date.now()}`,
      object: {
        type: "ITEM",
        id: "#new-item",
        item_data: {
          ...itemData,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "#new-variation",
              item_variation_data: {
                item_id: "#new-item",
                name: "Regular",
                pricing_type: "FIXED_PRICING",
                price_money: { amount: priceCents, currency: "USD" },
              },
            },
          ],
        },
      },
    };
    const data = await squareFetch(base, cfg.accessToken, "/v2/catalog/object", { method: "POST", body: JSON.stringify(body) });
    const obj = data.catalog_object;
    const variationId = obj?.item_data?.variations?.[0]?.id;
    if (obj) {
      await ctx.runMutation(internal.square.upsertCatalogItem, {
        siteId,
        squareItemId: obj.id,
        squareVariationId: variationId,
        name,
        description,
        priceCents,
        category,
        imageUrl,
        lastSyncedAt: Date.now(),
      });
    }
    return { squareItemId: obj?.id };
  },
});

/* ── Sync Orders action ────────────────────────────────────────────────── */

export const syncOrders = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken || !cfg.locationId) throw new Error("Square is not fully configured for this site");
    const base = squareBaseUrl(cfg.environment);
    const params = new URLSearchParams({ location_id: cfg.locationId, limit: "100", sort_order: "DESC" });
    const data = await squareFetch(base, cfg.accessToken, `/v2/payments?${params}`);
    const payments: any[] = data.payments ?? [];
    for (const payment of payments) {
      const refundStatus = (payment.refund_ids?.length ?? 0) > 0 ? "PENDING" : undefined;
      await ctx.runMutation(internal.square.upsertOrder, {
        siteId,
        squareOrderId: payment.order_id ?? payment.id,
        squarePaymentId: payment.id,
        customerEmail: payment.buyer_email_address,
        itemName: payment.note,
        amountCents: payment.amount_money?.amount ?? 0,
        status: payment.status ?? "UNKNOWN",
        refundStatus,
        createdAt: payment.created_at ? new Date(payment.created_at).getTime() : Date.now(),
      });
    }
    return { synced: payments.length };
  },
});

/* ── Sync Discounts action ─────────────────────────────────────────────── */

export const syncDiscounts = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken) throw new Error("Square is not configured for this site");
    const base = squareBaseUrl(cfg.environment);
    const data = await squareFetch(base, cfg.accessToken, "/v2/catalog/list?types=DISCOUNT");
    const objects: any[] = data.objects ?? [];
    for (const obj of objects) {
      if (obj.type !== "DISCOUNT") continue;
      const d = obj.discount_data;
      // Square catalog discounts have no promo "code" field — the name is the identifier.
      // We store name as the display code so the Discounts table always shows something useful.
      await ctx.runMutation(internal.square.upsertDiscount, {
        siteId,
        squareDiscountId: obj.id,
        name: d?.name ?? "Unnamed",
        code: d?.name ?? undefined,
        discountType: d?.discount_type ?? "FIXED_AMOUNT",
        amount: d?.amount_money?.amount,
        percentage: d?.percentage,
      });
    }
    return { synced: objects.length };
  },
});

/* ── Create Discount action ────────────────────────────────────────────── */

export const createDiscount = action({
  args: {
    siteId: v.id("sites"),
    name: v.string(),
    code: v.optional(v.string()),
    discountType: v.string(),
    amount: v.optional(v.number()),
    percentage: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, name, code, discountType, amount, percentage, expiresAt }) => {
    await requireActionSiteAccess(ctx, siteId);
    const cfg = await ctx.runQuery(internal.square.getConfigInternal, { siteId });
    if (!cfg?.accessToken) throw new Error("Square is not configured for this site");
    const base = squareBaseUrl(cfg.environment);
    const idempotencyKey = `fsts-discount-${siteId}-${Date.now()}`;
    const discountData: any = { name, discount_type: discountType };
    if (discountType === "FIXED_AMOUNT" && amount != null) {
      discountData.amount_money = { amount, currency: "USD" };
    } else if (discountType === "FIXED_PERCENTAGE" && percentage) {
      discountData.percentage = percentage;
    }
    const body = {
      idempotency_key: idempotencyKey,
      object: { type: "DISCOUNT", id: "#new-discount", discount_data: discountData },
    };
    const data = await squareFetch(base, cfg.accessToken, "/v2/catalog/object", { method: "POST", body: JSON.stringify(body) });
    const obj = data.catalog_object;
    if (obj) {
      await ctx.runMutation(internal.square.upsertDiscount, {
        siteId,
        squareDiscountId: obj.id,
        name,
        code: code || name,
        discountType,
        amount,
        percentage,
        expiresAt,
      });
    }
    return { squareDiscountId: obj?.id };
  },
});

/* ── Webhook helpers ───────────────────────────────────────────────────── */

export const getOrderByPaymentId = internalQuery({
  args: { siteId: v.id("sites"), squarePaymentId: v.string() },
  handler: async (ctx, { siteId, squarePaymentId }) => {
    const orders = await ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect();
    return orders.find((o) => o.squarePaymentId === squarePaymentId) ?? null;
  },
});

export const updateOrderRefundStatus = internalMutation({
  args: { orderId: v.id("squareOrders"), refundStatus: v.string() },
  handler: async (ctx, { orderId, refundStatus }) => {
    await ctx.db.patch(orderId, { refundStatus });
  },
});

export const webhookUpsertOrder = internalMutation({
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
    const existing = await ctx.db.query("squareOrders").withIndex("by_site_squareOrderId", (q) => q.eq("siteId", siteId).eq("squareOrderId", squareOrderId)).first();
    if (existing) { await ctx.db.patch(existing._id, fields); return existing._id; }
    return ctx.db.insert("squareOrders", { siteId, squareOrderId, ...fields });
  },
});
