import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { calculateLifecycleStatus } from "./lib/lifecycleStatus";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch the entity from the correct table and validate it belongs to siteId.
 * Throws if the entity doesn't exist, belongs to the wrong site, or if the
 * provided entityType doesn't match the actual Convex table — preventing
 * cross-type seat-count bypass attacks.
 */
async function getEntityChecked(
  ctx: any,
  entityType: "course" | "event",
  entityId: string,
  siteId: any,
): Promise<any> {
  const table = entityType === "course" ? "courses" : "events";
  const doc = await ctx.db
    .query(table)
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.eq(q.field("_id"), entityId))
    .first();

  if (!doc) {
    throw new Error(
      `${entityType} not found (id=${entityId}, siteId=${siteId}). ` +
      "entityType must match the entity's actual table.",
    );
  }
  return doc;
}

/**
 * Refresh the lifecycle status stored on the entity document.
 * Fetches from the correct typed table to prevent cross-type patching.
 */
async function refreshEntityLifecycle(
  ctx: any,
  entityType: "course" | "event",
  entityId: string,
  siteId: any,
  confirmedCount: number,
) {
  const table = entityType === "course" ? "courses" : "events";
  // Re-fetch from the correct table so we never patch a wrong-type document
  const doc = await ctx.db
    .query(table)
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.eq(q.field("_id"), entityId))
    .first();
  if (!doc) return;
  const newStatus = calculateLifecycleStatus(doc, confirmedCount, Date.now());
  await ctx.db.patch(doc._id, { lifecycleStatus: newStatus });
}

async function getConfirmedCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) =>
      q.eq("entityType", entityType).eq("entityId", entityId),
    )
    .filter((q: any) => q.eq(q.field("status"), "confirmed"))
    .collect();
  return rows.length;
}

async function getWaitlistCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) =>
      q.eq("entityType", entityType).eq("entityId", entityId),
    )
    .filter((q: any) => q.eq(q.field("status"), "waitlisted"))
    .collect();
  return rows.length;
}

// ── Public queries ─────────────────────────────────────────────────────────

/**
 * Returns { confirmedCount, waitlistCount } for a class or event.
 * Computed from actual registration records (not a denormalized count).
 */
export const getCount = query({
  args: {
    siteId: v.id("sites"),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
  },
  handler: async (ctx, { siteId, entityType, entityId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return { confirmedCount: 0, waitlistCount: 0 };
    // Validate the entity actually belongs to this site — prevents cross-tenant
    // read exposure where a caller with Site A access queries an entity from Site B.
    const table = entityType === "course" ? "courses" : "events";
    const entity = await ctx.db
      .query(table)
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .filter((q: any) => q.eq(q.field("_id"), entityId))
      .first();
    if (!entity) return { confirmedCount: 0, waitlistCount: 0 };
    const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);
    const waitlistCount = await getWaitlistCount(ctx, entityType, entityId);
    return { confirmedCount, waitlistCount };
  },
});

/**
 * Lists all registrations for a specific class or event.
 */
export const listByEntity = query({
  args: {
    siteId: v.id("sites"),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
  },
  handler: async (ctx, { siteId, entityType, entityId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return [];
    // Validate the entity belongs to this site before returning any registrations.
    const table = entityType === "course" ? "courses" : "events";
    const entity = await ctx.db
      .query(table)
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .filter((q: any) => q.eq(q.field("_id"), entityId))
      .first();
    if (!entity) return [];
    return ctx.db
      .query("registrations")
      .withIndex("by_entity", (q: any) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .collect();
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Atomically registers a user for a course or event.
 *
 * The entity is fetched from the *correct typed table* (courses or events),
 * not from the generic ctx.db.get — preventing a cross-type mismatch where
 * a caller supplies entityType="course" with an event's ID to bypass capacity
 * counts (since counts are keyed by entityType+entityId).
 *
 * Convex mutations are serialised so two concurrent calls cannot both claim
 * the last seat.
 *
 * Throws a typed error `{ code: "class_full" }` when capacity is exhausted
 * and no waitlist slots remain.
 */
export const register = mutation({
  args: {
    siteId: v.id("sites"),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { siteId, entityType, entityId, userId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);

    // Validate entityId belongs to the correct typed table AND this site.
    // This prevents capacity bypass via entityType/entityId mismatch.
    const entity = await getEntityChecked(ctx, entityType, entityId, siteId);

    // Check for an existing active registration
    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q: any) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.neq(q.field("status"), "cancelled"),
        ),
      )
      .first();

    if (existing) {
      return { status: existing.status, registrationId: existing._id };
    }

    const capacity = entity.capacity as number | undefined;
    const waitlistCapacity = (entity.waitlistCapacity as number | undefined) ?? 0;

    // Count current confirmed registrations (within this mutation = atomic)
    const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);

    let regStatus: "confirmed" | "waitlisted";

    if (!capacity || confirmedCount < capacity) {
      regStatus = "confirmed";
    } else {
      // Full — check waitlist
      const waitlistCount = await getWaitlistCount(ctx, entityType, entityId);
      if (waitlistCapacity > 0 && waitlistCount < waitlistCapacity) {
        regStatus = "waitlisted";
      } else {
        throw new Error(
          JSON.stringify({ code: "class_full", message: "No seats or waitlist slots available." }),
        );
      }
    }

    const now = Date.now();
    const regId = await ctx.db.insert("registrations", {
      siteId,
      entityType,
      entityId,
      userId,
      status: regStatus,
      registeredAt: now,
    });

    // Recalculate lifecycle status on the validated entity document
    const newConfirmedCount = regStatus === "confirmed" ? confirmedCount + 1 : confirmedCount;
    await refreshEntityLifecycle(ctx, entityType, entityId, siteId, newConfirmedCount);

    await logActivity(ctx, {
      siteId,
      actorName: userId,
      action: "registered",
      entityType,
      entityId,
      page: entityType === "course" ? "Courses" : "Events",
      newValue: { status: regStatus },
    });

    return { status: regStatus, registrationId: regId };
  },
});

/**
 * Cancels a registration, then optionally promotes the next waitlisted user.
 */
export const cancel = mutation({
  args: {
    siteId: v.id("sites"),
    registrationId: v.id("registrations"),
  },
  handler: async (ctx, { siteId, registrationId }) => {
    await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);

    const reg = await ctx.db.get(registrationId);
    if (!reg || reg.siteId !== siteId) throw new Error("Registration not found");
    if (reg.status === "cancelled") throw new Error("Already cancelled");

    const wasConfirmed = reg.status === "confirmed";
    const now = Date.now();

    await ctx.db.patch(registrationId, { status: "cancelled", cancelledAt: now });

    await logActivity(ctx, {
      siteId,
      actorName: reg.userId,
      action: "cancelled_registration",
      entityType: reg.entityType,
      entityId: reg.entityId,
      page: reg.entityType === "course" ? "Courses" : "Events",
    });

    // If a confirmed slot opened up, promote next on waitlist
    if (wasConfirmed) {
      await ctx.runMutation((internal as any).registrations.promoteNextWaitlisted, {
        siteId,
        entityType: reg.entityType,
        entityId: reg.entityId,
      });
    } else {
      // Just recalculate lifecycle
      const confirmedCount = await getConfirmedCount(ctx, reg.entityType, reg.entityId);
      await refreshEntityLifecycle(ctx, reg.entityType, reg.entityId, siteId, confirmedCount);
    }

    return { success: true };
  },
});

/**
 * Internal: promotes the oldest waitlisted registrant to confirmed.
 * Called after a confirmed registration is cancelled.
 */
export const promoteNextWaitlisted = internalMutation({
  args: {
    siteId: v.id("sites"),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
  },
  handler: async (ctx, { siteId, entityType, entityId }) => {
    const next = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q: any) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .filter((q: any) => q.eq(q.field("status"), "waitlisted"))
      .order("asc")
      .first();

    if (!next) {
      const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);
      await refreshEntityLifecycle(ctx, entityType, entityId, siteId, confirmedCount);
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(next._id, {
      status: "confirmed",
      promotedFromWaitlistAt: now,
    });

    await logActivity(ctx, {
      siteId,
      actorName: next.userId,
      action: "promoted_from_waitlist",
      entityType,
      entityId,
      page: entityType === "course" ? "Courses" : "Events",
    });

    const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);
    await refreshEntityLifecycle(ctx, entityType, entityId, siteId, confirmedCount);

    return next._id;
  },
});
