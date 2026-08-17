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
import { assertValidPriceCents } from "./lib/formatPrice";

// Shorthand for scheduling an immediate lifecycle recalculation after a write.
async function scheduleRecalc(ctx: any, courseId: string) {
  await ctx.scheduler.runAfter(0, (internal as any).lifecycle.recalculateOne, {
    entityType: "course",
    entityId: courseId,
  });
}

function toResponse(doc: any) {
  return { ...doc, id: doc._id, siteId: doc.siteId, createdAt: new Date(doc._creationTime).toISOString(), updatedAt: new Date(doc._creationTime).toISOString() };
}

export const list = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "courses")) return [];
    return (await ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect()).map(toResponse);
  },
});

export const get = query({
  args: { siteId: v.id("sites"), courseId: v.id("courses") },
  handler: async (ctx, { siteId, courseId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    if (!await checkModuleEnabled(ctx, siteId, "courses")) return null;
    const doc = await ctx.db.get(courseId);
    if (!doc || doc.siteId !== siteId) return null;
    return toResponse(doc);
  },
});

async function syncCourseMapping(ctx: any, siteId: any, entityId: string, squareItemId: string | undefined) {
  if (!squareItemId) return;
  const catalogItem = await ctx.db.query("squareCatalogItems")
    .withIndex("by_site_squareItemId", (q: any) => q.eq("siteId", siteId).eq("squareItemId", squareItemId))
    .first();
  const existing = await ctx.db.query("squareCatalogMappings")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.and(q.eq(q.field("entityType"), "course"), q.eq(q.field("entityId"), entityId)))
    .first();
  const patch = { squareItemId, squareVariationId: catalogItem?.squareVariationId };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("squareCatalogMappings", { siteId, entityType: "course", entityId, ...patch });
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
    durationLabel: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    // Validate and normalise priceCents: must be a finite non-negative integer.
    if (fields.priceCents != null) {
      assertValidPriceCents(fields.priceCents, "course price");
      (fields as any).priceCents = Math.round(fields.priceCents);
    }
    const id = await ctx.db.insert("courses", { siteId, status: "draft", ...fields });
    const doc = (await ctx.db.get(id))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, 0, Date.now());
    await ctx.db.patch(id, { lifecycleStatus });
    const finalDoc = (await ctx.db.get(id))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "created", entityType: "course", entityId: id, page: "Courses", newValue: finalDoc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "course", entityId: id, snapshot: finalDoc });
    if (fields.squareItemId) await syncCourseMapping(ctx, siteId, id, fields.squareItemId);
    return toResponse(finalDoc);
  },
});

export const update = mutation({
  args: {
    siteId: v.id("sites"),
    courseId: v.id("courses"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    status: v.optional(v.string()),
    description: v.optional(v.string()),
    durationLabel: v.optional(v.string()),
    /**
     * Price in integer minor units (cents).
     * Pass `null` to explicitly clear a stored price.
     * Omit to leave the existing price unchanged.
     */
    priceCents: v.optional(v.union(v.number(), v.null())),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, courseId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const existing = await ctx.db.get(courseId);
    if (!existing || existing.siteId !== siteId) throw new Error("Course not found");
    // Handle priceCents: null = explicitly clear; number = validate, round, set; absent = no change.
    const { priceCents, ...otherFields } = fields as any;
    const pricePatch: Record<string, unknown> = {};
    if ("priceCents" in fields) {
      if (priceCents === null) {
        // Explicit clear — store null so the field is present but empty.
        // null renders as "Contact for pricing" / "—" in all UI paths.
        pricePatch.priceCents = null;
      } else if (typeof priceCents === "number") {
        assertValidPriceCents(priceCents, "course price");
        pricePatch.priceCents = Math.round(priceCents);
      }
    }
    await ctx.db.patch(courseId, { ...otherFields, ...pricePatch } as any);
    // Recalculate lifecycle status — requires confirmed count from registrations
    const confirmed = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q) => q.eq("entityType", "course").eq("entityId", courseId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();
    const doc = (await ctx.db.get(courseId))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, confirmed.length, Date.now());
    await ctx.db.patch(courseId, { lifecycleStatus });
    await scheduleRecalc(ctx, courseId);
    const finalDoc = (await ctx.db.get(courseId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated", entityType: "course", entityId: courseId, page: "Courses", previousValue: existing, newValue: finalDoc });
    await recordVersion(ctx, { siteId, actorName: user.name, entityType: "course", entityId: courseId, snapshot: finalDoc });
    if ("squareItemId" in fields) await syncCourseMapping(ctx, siteId, courseId, fields.squareItemId);
    // Archive any linked flyers when the course is cancelled or completed.
    if (
      fields.status &&
      (fields.status === "cancelled" || fields.status === "completed") &&
      existing.status !== fields.status
    ) {
      await ctx.scheduler.runAfter(0, internal.flyers.archiveByEntity, {
        siteId,
        associatedEntityType: "class",
        associatedEntityId: courseId,
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
    courseId: v.id("courses"),
    ...capacityArgs,
  },
  handler: async (ctx, { siteId, courseId, ...fields }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const existing = await ctx.db.get(courseId);
    if (!existing || existing.siteId !== siteId) throw new Error("Course not found");
    await ctx.db.patch(courseId, fields as any);
    const confirmed = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q) => q.eq("entityType", "course").eq("entityId", courseId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();
    const doc = (await ctx.db.get(courseId))!;
    const lifecycleStatus = calculateLifecycleStatus(doc, confirmed.length, Date.now());
    await ctx.db.patch(courseId, { lifecycleStatus });
    await scheduleRecalc(ctx, courseId);
    const finalDoc = (await ctx.db.get(courseId))!;
    await logActivity(ctx, { siteId, actorName: user.name, action: "updated_capacity", entityType: "course", entityId: courseId, page: "Courses", newValue: { capacity: finalDoc.capacity, waitlistCapacity: finalDoc.waitlistCapacity, lifecycleStatus } });
    return toResponse(finalDoc);
  },
});
/**
 * Returns a lightweight list of courses that need attention:
 * nearly full, registration closing within 24 hours.
 */
export const listActionRequired = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    if (!await checkModuleEnabled(ctx, siteId, "courses")) return [];
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return courses
      .filter((c) => {
        const nearlyFull = c.lifecycleStatus === "NearlyFull" || c.lifecycleStatus === "Full";
        const regClosingSoon =
          c.registrationCloseAt != null &&
          c.registrationCloseAt > now &&
          c.registrationCloseAt <= in24h;
        return nearlyFull || regClosingSoon;
      })
      .map((c) => ({
        _id: c._id,
        title: c.title,
        nearlyFull: c.lifecycleStatus === "NearlyFull" || c.lifecycleStatus === "Full",
        registrationClosingSoon:
          c.registrationCloseAt != null &&
          c.registrationCloseAt > now &&
          c.registrationCloseAt <= in24h,
      }));
  },
});

export const remove = mutation({
  args: { siteId: v.id("sites"), courseId: v.id("courses") },
  handler: async (ctx, { siteId, courseId }) => {
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CLASSES_MANAGE);
    await requireModuleEnabled(ctx, siteId, "courses");
    const existing = await ctx.db.get(courseId);
    if (!existing || existing.siteId !== siteId) throw new Error("Course not found");
    await ctx.db.delete(courseId);
    await logActivity(ctx, { siteId, actorName: user.name, action: "deleted", entityType: "course", entityId: courseId, page: "Courses", previousValue: existing });
    return { success: true };
  },
});

// ── Public website queries (no auth, scoped by siteSlug) ──────────────────

/**
 * Returns true when a course should be visible on the public website.
 * Accepts explicit `isPublished: true` OR legacy records that only have
 * `status: "published"` (seeded before the isPublished field was introduced).
 */
function isEffectivelyPublished(d: any): boolean {
  if (d.isPublished === true) return true;
  if (d.isPublished == null && d.status === "published") return true;
  return false;
}

/** Lifecycle statuses that represent a course visible in "upcoming" sections. */
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
function toPublicCourseResponse(doc: any, extra?: Record<string, unknown>) {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    durationLabel: doc.durationLabel ?? null,
    priceCents: doc.priceCents ?? null,
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
 * Public — upcoming courses for a site.
 * Returns published courses whose lifecycleStatus is one of:
 *   Scheduled | RegistrationOpen | NearlyFull | Full | WaitlistOpen |
 *   RegistrationClosed | InProgress
 * Ordered by startDateTime ASC.
 */
export const listUpcoming = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("courses")
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
      .sort((a, b) => (a.startDateTime ?? 0) - (b.startDateTime ?? 0))
      .map((d) => toPublicCourseResponse(d));
  },
});

/**
 * Public — open-registration courses for a site.
 * Returns published courses where registrationStatus = "open" and
 * lifecycleStatus is RegistrationOpen or NearlyFull.
 */
export const listOpenRegistration = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    return docs
      .filter(
        (d) =>
          isEffectivelyPublished(d) &&
          d.registrationStatus === "open" &&
          (d.lifecycleStatus === "RegistrationOpen" ||
            d.lifecycleStatus === "NearlyFull"),
      )
      .sort((a, b) => (a.startDateTime ?? 0) - (b.startDateTime ?? 0))
      .map((d) => toPublicCourseResponse(d));
  },
});

/**
 * Public — full courses for a site (no seats available, no waitlist).
 * Returns published courses with lifecycleStatus = "Full".
 */
export const listFull = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("courses")
      .withIndex("by_site_lifecycleStatus", (q) =>
        q.eq("siteId", site._id).eq("lifecycleStatus", "Full"),
      )
      .collect();
    return docs
      .filter((d) => isEffectivelyPublished(d))
      .sort((a, b) => (a.startDateTime ?? 0) - (b.startDateTime ?? 0))
      .map((d) => toPublicCourseResponse(d));
  },
});

/**
 * Public — waitlisted courses for a site.
 * Returns published courses with lifecycleStatus = "WaitlistOpen".
 */
export const listWaitlist = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("courses")
      .withIndex("by_site_lifecycleStatus", (q) =>
        q.eq("siteId", site._id).eq("lifecycleStatus", "WaitlistOpen"),
      )
      .collect();
    return docs
      .filter((d) => isEffectivelyPublished(d))
      .sort((a, b) => (a.startDateTime ?? 0) - (b.startDateTime ?? 0))
      .map((d) => toPublicCourseResponse(d));
  },
});

/**
 * Public — past courses for a site.
 * Returns published courses with lifecycleStatus = "Completed".
 * Ordered by effective endDateTime DESC.
 * When endDateTime is missing, end-of-day in the course's timezone is used
 * and the record includes `missingEndTime: true`.
 */
export const listPast = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, { siteSlug }) => {
    const site = await siteFromSlug(ctx, siteSlug);
    const docs = await ctx.db
      .query("courses")
      .withIndex("by_site_lifecycleStatus", (q) =>
        q.eq("siteId", site._id).eq("lifecycleStatus", "Completed"),
      )
      .collect();

    return docs
      .filter((d) => isEffectivelyPublished(d))
      .map((d) => {
        const hasMissingEnd = !d.endDateTime;
        const effectiveEnd = hasMissingEnd
          ? endOfDayMs(d.timezone ?? "UTC", d.startDateTime ?? Date.now())
          : (d.endDateTime as number);
        return { doc: d, effectiveEnd, hasMissingEnd };
      })
      .sort((a, b) => b.effectiveEnd - a.effectiveEnd)
      .map(({ doc, hasMissingEnd }) =>
        toPublicCourseResponse(doc, hasMissingEnd ? { missingEndTime: true } : {}),
      );
  },
});
