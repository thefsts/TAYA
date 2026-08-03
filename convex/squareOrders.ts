import { query, mutation, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";

// ── Square Orders ─────────────────────────────────────────────────────────────

export const listOrders = query({
  args: { siteId: v.id("sites"), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, limit = 50 }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "commerce")) return [];
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
    if (!await checkModuleEnabled(ctx, siteId, "commerce")) return null;
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

// ── Idempotency dedup query ───────────────────────────────────────────────────

/** Look up a squareOrder by [siteId, squareEventId] for O(1) dedup. */
export const getByEventId = internalQuery({
  args: { siteId: v.id("sites"), squareEventId: v.string() },
  handler: async (ctx, { siteId, squareEventId }) => {
    return ctx.db
      .query("squareOrders")
      .withIndex("by_squareEventId", (q) => q.eq("siteId", siteId).eq("squareEventId", squareEventId))
      .first();
  },
});

// ── Atomic order upsert (webhook entry point) ─────────────────────────────────

/**
 * Atomically writes the order record and triggers completion side effects.
 *
 * IDEMPOTENCY: The squareEventId dedup check runs FIRST, inside this mutation,
 * so the duplicate-event claim is a serialised atomic transaction — no race
 * window exists with a concurrent delivery for the same event_id.
 * Returns { orderId, duplicate: true } immediately; callers must short-circuit.
 *
 * COMPLETION TRIGGER: CRM sync and email scheduling fire whenever the order
 * STATUS transitions INTO "COMPLETED" (wasCompleted=false → isCompleted=true).
 * This covers both:
 *   a) New order arriving already COMPLETED (e.g. payment.completed webhook).
 *   b) Existing order updated from a non-final state → COMPLETED
 *      (e.g. payment.created with PENDING, then payment.updated with COMPLETED).
 * Repeated COMPLETED updates on an already-COMPLETED order are idempotent —
 * side effects do not fire again, preserving email delivery state.
 *
 * SQUAREEVENTID: Never overwritten on existing orders — the order retains the
 * event ID of the first webhook that wrote it.
 */
export const upsertOrderFromWebhook = internalMutation({
  args: {
    siteId: v.id("sites"),
    squareOrderId: v.string(),
    squarePaymentId: v.optional(v.string()),
    squareEventId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
    status: v.string(),
    refundStatus: v.optional(v.string()),
    createdAt: v.number(),
    webhookReceivedAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, squareOrderId, squareEventId, webhookReceivedAt, ...fields }) => {
    const now = Date.now();

    // ── Step 1: Atomic dedup by squareEventId ──────────────────────────────
    // Serialised by Convex — cannot race with concurrent delivery of same event.
    if (squareEventId) {
      const byEvent = await ctx.db
        .query("squareOrders")
        .withIndex("by_squareEventId", (q) => q.eq("siteId", siteId).eq("squareEventId", squareEventId))
        .first();
      if (byEvent?.webhookProcessedAt) {
        return { orderId: byEvent._id, duplicate: true as const };
      }
    }

    // ── Step 2: Upsert by squareOrderId ────────────────────────────────────
    const existing = await ctx.db
      .query("squareOrders")
      .withIndex("by_site_squareOrderId", (q) => q.eq("siteId", siteId).eq("squareOrderId", squareOrderId))
      .first();

    // Track whether the order was already COMPLETED before this webhook so we
    // know whether this webhook is a status transition INTO COMPLETED.
    const wasCompleted = existing?.status === "COMPLETED";
    const isNowCompleted = fields.status === "COMPLETED";
    const transitioningToCompleted = isNowCompleted && !wasCompleted;

    let orderId;

    if (existing) {
      // Patch payment fields. Never overwrite squareEventId (preserve the
      // event ID of the first webhook). Never reset email delivery state —
      // delivery may already be in flight or completed.
      const emailStateInit = transitioningToCompleted
        ? {
            // Initialise delivery state only when first transitioning to COMPLETED
            customerEmailStatus: "pending",
            businessEmailStatus: "pending",
            emailAttemptCount: 0,
          }
        : {};

      await ctx.db.patch(existing._id, {
        ...fields,
        ...emailStateInit,
        webhookReceivedAt: webhookReceivedAt ?? existing.webhookReceivedAt,
        webhookProcessedAt: now,
      });
      orderId = existing._id;
    } else {
      // New order — initialise email state only when COMPLETED.
      const emailStateInit = isNowCompleted
        ? { customerEmailStatus: "pending", businessEmailStatus: "pending", emailAttemptCount: 0 }
        : {};

      orderId = await ctx.db.insert("squareOrders", {
        siteId,
        squareOrderId,
        squareEventId,
        webhookReceivedAt: webhookReceivedAt ?? now,
        webhookProcessedAt: now,
        ...emailStateInit,
        ...fields,
      });
    }

    // ── Step 3: Completion side effects ────────────────────────────────────
    // Fire exactly once per order: when it transitions INTO COMPLETED.
    if (transitioningToCompleted || (!existing && isNowCompleted)) {
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

      // Schedule email delivery. Failure never rolls back the order write.
      await ctx.scheduler.runAfter(0, internal.squareOrders.sendPaymentEmails, {
        orderId,
        siteId,
        customerEmail: fields.customerEmail,
        customerName: fields.customerName,
        itemName: fields.itemName,
        amountCents: fields.amountCents,
      });
    }

    return { orderId, duplicate: false as const };
  },
});

// ── Email delivery state machine ──────────────────────────────────────────────

/** Update the email delivery status fields on an order. */
export const updateOrderEmailStatus = internalMutation({
  args: {
    orderId: v.id("squareOrders"),
    siteId: v.id("sites"),
    customerEmailStatus: v.optional(v.string()),
    businessEmailStatus: v.optional(v.string()),
    emailAttemptCount: v.optional(v.number()),
    lastEmailAttemptAt: v.optional(v.number()),
    lastEmailError: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
  },
  handler: async (ctx, { orderId, siteId, ...fields }) => {
    const order = await ctx.db.get(orderId);
    // Enforce siteId boundary — never update an order belonging to a different site
    if (!order || order.siteId !== siteId) throw new Error("Order not found or site mismatch");
    await ctx.db.patch(orderId, fields as any);
  },
});

/** Max delivery attempts before permanently giving up. */
const MAX_EMAIL_ATTEMPTS = 5;
/** Retry backoff: 5 min, 15 min, 30 min, 1 h, 2 h */
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000, 120 * 60_000];

/** States that allow a (re)delivery attempt. */
const RETRYABLE_STATUSES = new Set(["pending", "failed", "retryScheduled"]);

/**
 * Scheduled internal action — sends per-recipient confirmation and notification
 * emails for a completed order. Each email's state is managed independently:
 *
 * - If `customerEmailStatus` is already "sent", that recipient is SKIPPED so
 *   retries never send duplicate emails to already-confirmed customers.
 * - If `businessEmailStatus` is already "sent", the business notification is
 *   also skipped for the same reason.
 * - Only statuses in RETRYABLE_STATUSES (pending | failed | retryScheduled)
 *   trigger a delivery attempt.
 *
 * Failure to send does NOT throw — it records the error and schedules a retry.
 */
export const sendPaymentEmails = internalAction({
  args: {
    orderId: v.id("squareOrders"),
    siteId: v.id("sites"),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
  },
  handler: async (ctx, { orderId, siteId, customerEmail, customerName, itemName, amountCents }) => {
    // Re-fetch current state — a concurrent resend could have already changed it
    const order = await ctx.runQuery(internal.squareOrders.getOrderById, { orderId, siteId });
    if (!order) return;

    const now = Date.now();
    const attempt = (order.emailAttemptCount ?? 0) + 1;
    const retryDelay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];

    const needsCustomer = RETRYABLE_STATUSES.has(order.customerEmailStatus ?? "pending");
    const needsBusiness = RETRYABLE_STATUSES.has(order.businessEmailStatus ?? "pending");

    // Nothing to do — both already delivered
    if (!needsCustomer && !needsBusiness) return;

    // Mark only the eligible recipients as "processing"
    await ctx.runMutation(internal.squareOrders.updateOrderEmailStatus, {
      orderId,
      siteId,
      customerEmailStatus: needsCustomer ? "processing" : order.customerEmailStatus,
      businessEmailStatus: needsBusiness ? "processing" : order.businessEmailStatus,
      emailAttemptCount: attempt,
      lastEmailAttemptAt: now,
    });

    let customerResult: { success: boolean; error?: string } = { success: true };
    let businessResult: { success: boolean; error?: string } = { success: true };

    try {
      // ── Customer confirmation email ────────────────────────────────────────
      if (needsCustomer) {
        if (customerEmail) {
          customerResult = await ctx.runAction(internal.email.sendPaymentConfirmation, {
            siteId,
            customerEmail,
            customerName,
            itemName,
            amountCents,
            orderId: orderId.toString(),
          });
        } else {
          // No address on record — treat as a configuration failure so it is
          // visible in the dashboard rather than silently swallowed.
          customerResult = { success: false, error: "No customer email address on file for this order" };
        }
      }

      // ── Business notification email ────────────────────────────────────────
      if (needsBusiness) {
        businessResult = await ctx.runAction(internal.email.sendBusinessNotification, {
          siteId,
          customerName,
          customerEmail,
          itemName,
          amountCents,
          orderId: orderId.toString(),
        });
      }
    } catch (err: unknown) {
      // Defensive catch: network/runtime errors inside email actions must never
      // leave an order stuck in "processing". Transition all processing recipients
      // to retryScheduled (or permanentlyFailed at max attempts) so the cron
      // and dashboard resend button can recover the order.
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[squareOrders.sendPaymentEmails] Unexpected throw during email send:", errMsg, "orderId:", orderId);

      const isPermanent = attempt >= MAX_EMAIL_ATTEMPTS;
      const failStatus  = isPermanent ? "permanentlyFailed" : "retryScheduled";

      await ctx.runMutation(internal.squareOrders.updateOrderEmailStatus, {
        orderId,
        siteId,
        customerEmailStatus: needsCustomer ? failStatus : order.customerEmailStatus,
        businessEmailStatus: needsBusiness ? failStatus : order.businessEmailStatus,
        lastEmailError: `Unexpected error: ${errMsg}`,
        nextRetryAt: isPermanent ? undefined : now + retryDelay,
      });
      return;
    }

    // ── Persist final state per recipient ──────────────────────────────────
    const customerOk = customerResult.success;
    const businessOk = businessResult.success;

    const anyFailed = (needsCustomer && !customerOk) || (needsBusiness && !businessOk);

    if (!anyFailed) {
      await ctx.runMutation(internal.squareOrders.updateOrderEmailStatus, {
        orderId,
        siteId,
        customerEmailStatus: needsCustomer ? "sent" : order.customerEmailStatus,
        businessEmailStatus: needsBusiness ? "sent" : order.businessEmailStatus,
        lastEmailError: undefined,
        nextRetryAt: undefined,
      });
    } else {
      const isPermanent = attempt >= MAX_EMAIL_ATTEMPTS;
      // Non-permanent failures transition to "retryScheduled" (a retry is being
      // scheduled via nextRetryAt). Permanent failures go to "permanentlyFailed".
      // This keeps the state machine consistent with the documented cycle:
      //   pending → processing → sent | retryScheduled → permanentlyFailed
      const failStatus = isPermanent ? "permanentlyFailed" : "retryScheduled";
      const err = (needsCustomer && !customerOk
        ? customerResult.error
        : needsBusiness && !businessOk
        ? businessResult.error
        : undefined) ?? "unknown error";

      await ctx.runMutation(internal.squareOrders.updateOrderEmailStatus, {
        orderId,
        siteId,
        customerEmailStatus: needsCustomer ? (customerOk ? "sent" : failStatus) : order.customerEmailStatus,
        businessEmailStatus: needsBusiness ? (businessOk ? "sent" : failStatus) : order.businessEmailStatus,
        lastEmailError: err,
        nextRetryAt: isPermanent ? undefined : now + retryDelay,
      });
    }
  },
});

/** Fetch a single order by ID, enforcing siteId boundary. */
export const getOrderById = internalQuery({
  args: { orderId: v.id("squareOrders"), siteId: v.id("sites") },
  handler: async (ctx, { orderId, siteId }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.siteId !== siteId) return null;
    return order;
  },
});

/** Find orders due for email retry.
 * Looks for orders where at least one recipient is in `retryScheduled` state
 * (written by sendPaymentEmails after a non-permanent failure) and whose
 * `nextRetryAt` timestamp has elapsed. Also picks up legacy `failed` status
 * written before this convention was established, for backward compatibility.
 */
export const findOrdersPendingEmailRetry = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    // Collect all orders across all sites — cron calls this globally
    const allOrders = await ctx.db.query("squareOrders").collect();
    return allOrders.filter((o) => {
      const needsRetry =
        (o.customerEmailStatus === "retryScheduled" ||
          o.businessEmailStatus === "retryScheduled" ||
          // backward compat: older records may still carry "failed"
          o.customerEmailStatus === "failed" ||
          o.businessEmailStatus === "failed") &&
        (o.emailAttemptCount ?? 0) < MAX_EMAIL_ATTEMPTS;
      const isDue = !o.nextRetryAt || o.nextRetryAt <= now;
      return needsRetry && isDue;
    });
  },
});

/** Cron-triggered retry sweep — re-attempts failed email deliveries. */
export const retryFailedPaymentEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const orders = await ctx.runQuery(internal.squareOrders.findOrdersPendingEmailRetry, { now });
    for (const order of orders) {
      await ctx.scheduler.runAfter(0, internal.squareOrders.sendPaymentEmails, {
        orderId: order._id,
        siteId: order.siteId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        itemName: order.itemName,
        amountCents: order.amountCents,
      });
    }
    return { queued: orders.length };
  },
});

// ── Admin resend mutation ─────────────────────────────────────────────────────

/**
 * Admin-triggered resend for a specific order.
 * Resets delivery state to "pending" and fires the email scheduler.
 * Requires INTEGRATIONS_MANAGE permission.
 */
export const resendConfirmationEmail = mutation({
  args: { siteId: v.id("sites"), orderId: v.id("squareOrders") },
  handler: async (ctx, { siteId, orderId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const order = await ctx.db.get(orderId);
    if (!order || order.siteId !== siteId) throw new Error("Order not found");

    // Reset delivery state so the scheduler will re-attempt
    await ctx.db.patch(orderId, {
      customerEmailStatus: "pending",
      businessEmailStatus: "pending",
      lastEmailError: undefined,
      nextRetryAt: undefined,
    });

    // Schedule the email delivery immediately
    await ctx.scheduler.runAfter(0, internal.squareOrders.sendPaymentEmails, {
      orderId,
      siteId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      itemName: order.itemName,
      amountCents: order.amountCents,
    });

    return { scheduled: true };
  },
});

// ── Square Catalog Items ──────────────────────────────────────────────────────

export const listCatalogItems = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "commerce")) return [];
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
    // SECURITY: actions have no ctx.db — verify WRITE-capable site access via
    // the same internal check used by every other Square action.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.square.checkSiteAccessForAction, { siteId });
    if (!hasAccess) throw new Error("Forbidden: site access required");
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
    if (!await checkModuleEnabled(ctx, siteId, "commerce")) return [];
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
    percentage: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "commerce");
    const id = await ctx.db.insert("squareDiscounts", { siteId, ...fields });
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "square_discount", entityId: id, page: "Commerce", details: fields.name });
    return id;
  },
});

export const updateDiscount = mutation({
  args: { siteId: v.id("sites"), discountId: v.id("squareDiscounts"), name: v.optional(v.string()), code: v.optional(v.string()), expiresAt: v.optional(v.number()) },
  handler: async (ctx, { siteId, discountId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "commerce");
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
    const user = await requirePermission(ctx, siteId, PERMISSIONS.INTEGRATIONS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "commerce");
    const existing = await ctx.db.get(discountId);
    if (!existing || existing.siteId !== siteId) throw new Error("Discount not found");
    await ctx.db.delete(discountId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "square_discount", entityId: discountId, page: "Commerce" });
  },
});
