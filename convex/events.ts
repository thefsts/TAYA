import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess, checkModuleEnabled, requireModuleEnabled } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";
import { internal } from "./_generated/api";
import { calculateLifecycleStatus } from "./lib/lifecycleStatus";
import { siteFromSlug } from "./lib/siteFromSlug";
import { endOfDayMs } from "./lib/timezoneUtils";

// Shorthand for scheduling an immediate lifecycle recalculation after a write.
async function scheduleRecalc(ctx: any, eventId: string) {
  await ctx.scheduler.runAfter(0, (internal as any).lifecycle.recalculateOne, {
    entityType: "event",
    entityId: eventId,
  });
}

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString(), startAt: new Date(doc.startAt).toISOString(), endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "events")) return [];
    return (await ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "events")) return null;
    const doc = await ctx.db.get(eventId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

async function syncEventMapping(ctx: any, siteId: any, entityId: string, squareItemId: string | undefined) {
  if (!squareItemId) return;
  const catalogItem = await ctx.db.query("squareCatalogItems")
    .withIndex("by_site_squareItemId", (q: any) => q.eq("siteId", siteId).eq("squareItemId", squareItemId))
    .first();
  const existing = await ctx.db.query("squareCatalogMappings")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.and(q.eq(q.field("entityType"), "event"), q.eq(q.field("entityId"), entityId)))
    .first();
  const patch = { squareItemId, squareVariationId: catalogItem?.squareVariationId };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("squareCatalogMappings", { siteId, entityType: "event", entityId, ...patch });
  }
}

const capacityArgs = {
  capacity: v.optional(v.number()),
  waitlistCapacity: v.optional(v.number()),
  registrationOpenAt: v.optional(v.number()),
  registrationCloseAt: v.optional(v.number()),
  startDateTime: v.optional(v.number()),
  endDateTime: v.optional(v.number()),
  timezone: v.optional(v.string()),
  registrationStatus: v.optional(v.string()),
  isPublished: v.optional(v.boolean()),
  autoCloseRegistration: v.optional(v.boolean()),
  autoArchive: v.optional(v.boolean()),
  cancelledAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
};
export const create = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    description: v.string(),
    startAt: v.string(),
    endAt: v.optional(v.string()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, startAt, endAt, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.EVENTS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "events");
    const startAtMs = new Date(startAt).getTime();
    const endAtMs = endAt ? new Date(endAt).getTime() : undefined;
    // Mirror startAt/endAt into startDateTime/endDateTime so that lifecycle
    // computation (InProgress, Completed) works from the primary event schedule.
    const startDateTime = (fields as any).startDateTime ?? startAtMs;
    const endDateTime = (fields as any).endDateTime ?? endAtMs;
    const id = await ctx.db.insert("events", {
      siteId,
      status: "draft",
      startAt: startAtMs,
      endAt: endAtMs,
      startDateTime,
      endDateTime,
      ...fields,
    });
    const doc = (await ctx.db.get(id))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, 0, Date.now());
    await ctx.db.patch(id, { lifecycleStatus });
    const finalDoc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "event", entityId: id, page: "Events", newValue: finalDoc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: id, snapshot: finalDoc });
    if (fields.squareItemId) await syncEventMapping(ctx, siteId, id, fields.squareItemId);
    return toResponse(finalDoc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    eventId: v.id("events"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
    startAt: v.optional(v.string()),
    endAt: v.optional(v.string()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, eventId, startAt, endAt, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.EVENTS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "events");
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    const patch: Record<string, unknown> = { ...fields };
    if (startAt) {
      const startAtMs = new Date(startAt).getTime();
      patch.startAt = startAtMs;
      // Keep startDateTime in sync with startAt unless caller explicitly set it
      if (!("startDateTime" in fields)) patch.startDateTime = startAtMs;
    }
    if (endAt !== undefined) {
      const endAtMs = endAt ? new Date(endAt).getTime() : undefined;
      patch.endAt = endAtMs;
      // Keep endDateTime in sync with endAt unless caller explicitly set it
      if (!("endDateTime" in fields)) patch.endDateTime = endAtMs;
    }
    await ctx.db.patch(eventId, patch as any);
    // Recalculate lifecycle status
    const confirmed = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q) => q.eq("entityType", "event").eq("entityId", eventId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();
    const doc = (await ctx.db.get(eventId))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, confirmed.length, Date.now());
    await ctx.db.patch(eventId, { lifecycleStatus });
    await scheduleRecalc(ctx, eventId);
    const finalDoc = (await ctx.db.get(eventId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "event", entityId: eventId, page: "Events", previousValue: existing, newValue: finalDoc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "event", entityId: eventId, snapshot: finalDoc });
    if ("squareItemId" in fields) await syncEventMapping(ctx, siteId, eventId, fields.squareItemId);
    // Archive any linked flyers when the event is cancelled or completed.
    if (
      fields.status &&
      (fields.status === "cancelled" || fields.status === "completed") &&
      existing.status !== fields.status
    ) {
      await ctx.scheduler.runAfter(0, internal.flyers.archiveByEntity, {
        siteId,
        associatedEntityType: "event",
        associatedEntityId: eventId,
        archivedReason: "associated_entity_ended",
      });
    }
    return toResponse(finalDoc);
  },
});

/** Update only capacity and scheduling fields, then recalculate lifecycle. */
export const updateCapacity = mutation({
  args: {
    siteId: v.id("sites"),
    eventId: v.id("events"),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, eventId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.EVENTS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "events");
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    await ctx.db.patch(eventId, fields as any);
    const confirmed = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q) => q.eq("entityType", "event").eq("entityId", eventId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();
    const doc = (await ctx.db.get(eventId))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, confirmed.length, Date.now());
    await ctx.db.patch(eventId, { lifecycleStatus });
    await scheduleRecalc(ctx, eventId);
    const finalDoc = (await ctx.db.get(eventId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated_capacity", entityType: "event", entityId: eventId, page: "Events", newValue: { capacity: finalDoc.capacity, waitlistCapacity: finalDoc.waitlistCapacity, lifecycleStatus } });
    return toResponse(finalDoc);
  },
});
export const remove = mutation({
  args: { siteId: v.id("sites"), eventId: v.id("events") },
  handler: async (ctx, { siteId, eventId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.EVENTS_MANAGE);
    await requireModuleEnabled(ctx, siteId, "events");
    const existing = await ctx.db.get(eventId);
    if (!existing || existing.siteId !== siteId) throw new Error("Event not found");
    await ctx.db.delete(eventId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "event", entityId: eventId, page: "Events", previousValue: existing });
    return { success: true };
  },
});

// ── Public website queries (no auth, scoped by siteSlug) ──────────────────

/**
 * Returns true when an event should be visible on the public website.
 * Accepts explicit `isPublished: true` OR legacy records that only have
 * `status: "published"` (seeded before the isPublished field was introduced).
 */
function isEffectivelyPublished(d: any): boolean {
  if (d.isPublished === true) return true;
  if (d.isPublished == null && d.status === "published") return true;
  return false;
}

/** Lifecycle statuses that represent an event visible in "upcoming" sections. */
const UPCOMING_LIFECYCLE_STATUSES = new Set([
  "Scheduled",
  "RegistrationOpen",
  "NearlyFull",
  "Full",
  "WaitlistOpen",
  "RegistrationClosed",
  "InProgress",
]);

/** Shape returned to the public website — excludes internal write fields. */
function toPublicEventResponse(doc: any, extra?: Record<string, unknown>) {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    startAt: new Date(doc.startAt).toISOString(),
    endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
    location: doc.location ?? null,
    imageUrl: doc.imageUrl ?? null,
    startDateTime: doc.startDateTime ?? null,
    endDateTime: doc.endDateTime ?? null,
    timezone: doc.timezone ?? null,
    lifecycleStatus: doc.lifecycleStatus ?? null,
    registrationStatus: doc.registrationStatus ?? null,
    capacity: doc.capacity ?? null,
    cancelledAt: doc.cancelledAt ?? null,
    completedAt: doc.completedAt ?? null,
    ...extra,
  };
}

/**
 * Public — upcoming events for a site.
 * Returns published events whose lifecycleStatus is one of:
 *   Scheduled | RegistrationOpen | NearlyFull | Full | WaitlistOpen |
 *   RegistrationClosed | InProgress
 * Ordered by startDateTime ASC.
 */
export const listUpcoming = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("events")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter(
        (d) =>
          isEffectivelyPublished(d) &&
          (UPCOMING_LIFECYCLE_STATUSES.has(d.lifecycleStatus ?? "") ||
            // Legacy records with no lifecycleStatus default to upcoming when published
            (d.lifecycleStatus == null && d.status === "published")),
      )
      .sort(
        (a, b) =>
          (a.startDateTime ?? a.startAt) - (b.startDateTime ?? b.startAt),
      )
      .map((d) => toPublicEventResponse(d));
  },
});

/**
 * Public — past events for a site.
 * Returns published events with lifecycleStatus = "Completed".
 * Ordered by effective endDateTime DESC.
 * When endDateTime is missing, end-of-day in the event's timezone is used
 * and the record includes `missingEndTime: true`.
 */
export const listPast = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("events")
      .withIndex("by_site_lifecycleStatus", (q) =>
        q.eq("siteId", site._id).eq("lifecycleStatus", "Completed"),
      )
      .collect();

    return docs
      .filter((d) => isEffectivelyPublished(d))
      .map((d) => {
        const hasMissingEnd = !d.endDateTime;
        const effectiveEnd = hasMissingEnd
          ? endOfDayMs(d.timezone ?? "UTC", d.startDateTime ?? d.startAt)
          : (d.endDateTime as number);
        return {
          doc: d,
          effectiveEnd,
          hasMissingEnd,
        };
      })
      .sort((a, b) => b.effectiveEnd - a.effectiveEnd)
      .map(({ doc, hasMissingEnd }) =>
        toPublicEventResponse(doc, hasMissingEnd ? { missingEndTime: true } : {}),
      );
  },
});

/**
 * Public — cancelled events for a site.
 * Only returned when the site has `showCancelledEvents: true` in siteSettings.
 * Returns published events with lifecycleStatus = "Cancelled".
 */
export const listCancelled = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    // Gate on the site's showCancelledEvents setting (default: hidden).
    const settings = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first();
    if (!settings?.showCancelledEvents) return [];

    const docs = await ctx.db
      .query("events")
      .withIndex("by_site_lifecycleStatus", (q) =>
        q.eq("siteId", site._id).eq("lifecycleStatus", "Cancelled"),
      )
      .collect();
    return docs
      .filter((d) => isEffectivelyPublished(d))
      .map((d) => toPublicEventResponse(d));
  },
});
