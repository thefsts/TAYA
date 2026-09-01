/**
 * Lifecycle automation engine for courses, events, and flyers.
 *
 * Two entry-points:
 *   - `tick`          — called every 5 minutes by the `lifecycleClock` cron.
 *                       Scans all active entities and applies time-based
 *                       lifecycle transitions. Idempotent: skips writes when
 *                       the calculated status already matches the stored one.
 *   - `recalculateOne` — called immediately (via ctx.scheduler.runAfter 0) by
 *                       every mutation that can change lifecycle status, so the
 *                       entity reflects the new reality without waiting for the
 *                       next clock tick.
 *
 * Every automatic transition is recorded in `activityLog` with
 * `actor: "system"`.
 */
import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { calculateLifecycleStatus } from "./lib/lifecycleStatus";

const AUTO_ARCHIVE_DAYS = 90;
const AUTO_ARCHIVE_MS = AUTO_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

async function getConfirmedCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) => q.eq("entityType", entityType).eq("entityId", entityId))
    .filter((q: any) => q.eq(q.field("status"), "confirmed"))
    .collect();
  return rows.length;
}

async function getWaitlistCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) => q.eq("entityType", entityType).eq("entityId", entityId))
    .filter((q: any) => q.eq(q.field("status"), "waitlisted"))
    .collect();
  return rows.length;
}

async function writeSystemActivityLog(
  ctx: any,
  opts: {
    siteId: any;
    entityType: string;
    entityId: string;
    previousValue: string;
    newValue: string;
    details?: string;
  },
) {
  const now = Date.now();
  await ctx.db.insert("activityLog", {
    siteId: opts.siteId,
    actorName: "system",
    action: "lifecycle_transition",
    entityType: opts.entityType,
    entityId: opts.entityId,
    previousValue: opts.previousValue,
    newValue: opts.newValue,
    details: opts.details ?? `Auto-transitioned from ${opts.previousValue} → ${opts.newValue} at ${new Date(now).toISOString()}`,
    createdAt: now,
  });
}

async function processEntity(
  ctx: any,
  table: "courses" | "events",
  entityType: "course" | "event",
  doc: any,
  now: number,
): Promise<boolean> {
  const confirmedCount = await getConfirmedCount(ctx, entityType, doc._id);
  const calculated = calculateLifecycleStatus(doc, confirmedCount, now);
  if (doc.lifecycleStatus === calculated) return false;

  const previous = doc.lifecycleStatus ?? "Draft";
  const patch: Record<string, unknown> = { lifecycleStatus: calculated };

  if (calculated === "Completed" && !doc.completedAt) patch.completedAt = now;
  if (calculated === "Archived" && doc.status !== "archived") patch.status = "archived";

  await ctx.db.patch(doc._id, patch);
  await writeSystemActivityLog(ctx, {
    siteId: doc.siteId,
    entityType,
    entityId: doc._id,
    previousValue: previous,
    newValue: calculated,
  });

  const seatOpened = previous === "Full" || previous === "WaitlistOpen" || previous === "Scheduled";
  if (seatOpened && calculated === "RegistrationOpen") {
    const waitlistCount = await getWaitlistCount(ctx, entityType, doc._id);
    if (waitlistCount > 0) {
      await ctx.scheduler.runAfter(0, (internal as any).registrations.promoteNextWaitlisted, {
        siteId: doc.siteId,
        entityType: entityType as "course" | "event",
        entityId: doc._id,
      });
    }
  }

  if ((calculated === "Completed" || calculated === "Cancelled") && previous !== calculated) {
    await ctx.scheduler.runAfter(0, internal.flyers.archiveByEntity, {
      siteId: doc.siteId,
      associatedEntityType: entityType === "course" ? "class" : "event",
      associatedEntityId: doc._id,
      archivedReason: "associated_entity_ended",
    });
  }

  return true;
}

export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const courses = await ctx.db.query("courses").collect();
    for (const course of courses) {
      if (
        course.status === "archived" ||
        course.status === "cancelled" ||
        course.lifecycleStatus === "Archived" ||
        course.lifecycleStatus === "Cancelled"
      ) continue;
      await processEntity(ctx, "courses", "course", course, now);
    }

    const events = await ctx.db.query("events").collect();
    for (const event of events) {
      if (
        event.status === "archived" ||
        event.status === "cancelled" ||
        event.lifecycleStatus === "Archived" ||
        event.lifecycleStatus === "Cancelled"
      ) continue;
      await processEntity(ctx, "events", "event", event, now);
    }

    const autoArchiveCutoff = now - AUTO_ARCHIVE_MS;
    const completedCourses = await ctx.db
      .query("courses")
      .filter((q: any) => q.and(
        q.eq(q.field("autoArchive"), true),
        q.eq(q.field("lifecycleStatus"), "Completed"),
        q.lt(q.field("completedAt"), autoArchiveCutoff),
      ))
      .collect();

    for (const course of completedCourses) {
      if (course.status === "archived") continue;
      await ctx.db.patch(course._id, { status: "archived", lifecycleStatus: "Archived" });
      await writeSystemActivityLog(ctx, {
        siteId: course.siteId,
        entityType: "course",
        entityId: course._id,
        previousValue: "Completed",
        newValue: "Archived",
        details: `Auto-archived after ${AUTO_ARCHIVE_DAYS} days in Completed state`,
      });
    }

    const completedEvents = await ctx.db
      .query("events")
      .filter((q: any) => q.and(
        q.eq(q.field("autoArchive"), true),
        q.eq(q.field("lifecycleStatus"), "Completed"),
        q.lt(q.field("completedAt"), autoArchiveCutoff),
      ))
      .collect();

    for (const event of completedEvents) {
      if (event.status === "archived") continue;
      await ctx.db.patch(event._id, { status: "archived", lifecycleStatus: "Archived" });
      await writeSystemActivityLog(ctx, {
        siteId: event.siteId,
        entityType: "event",
        entityId: event._id,
        previousValue: "Completed",
        newValue: "Archived",
        details: `Auto-archived after ${AUTO_ARCHIVE_DAYS} days in Completed state`,
      });
    }

    const publishedFlyers = await ctx.db
      .query("flyers")
      .filter((q: any) => q.eq(q.field("status"), "published"))
      .collect();

    for (const flyer of publishedFlyers) {
      if (flyer.expirationDate && flyer.expirationDate <= now) {
        await ctx.db.patch(flyer._id, { status: "archived", archivedAt: now, archivedReason: "expired" });
        await writeSystemActivityLog(ctx, {
          siteId: flyer.siteId,
          entityType: "flyer",
          entityId: flyer._id,
          previousValue: "published",
          newValue: "archived",
          details: `Flyer expired at ${new Date(flyer.expirationDate).toISOString()}`,
        });
      }
    }

    const scheduledFlyers = await ctx.db
      .query("flyers")
      .filter((q: any) => q.eq(q.field("status"), "scheduled"))
      .collect();

    for (const flyer of scheduledFlyers) {
      if (flyer.startDate && flyer.startDate <= now) {
        await ctx.db.patch(flyer._id, { status: "published", publishedAt: now });
        await writeSystemActivityLog(ctx, {
          siteId: flyer.siteId,
          entityType: "flyer",
          entityId: flyer._id,
          previousValue: "scheduled",
          newValue: "published",
          details: `Flyer published on schedule at ${new Date(now).toISOString()}`,
        });
      }
    }
  },
});

export const recalculateOne = internalMutation({
  args: {
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
  },
  handler: async (ctx, { entityType, entityId }) => {
    const now = Date.now();
    const table = entityType === "course" ? "courses" : "events";
    const doc = await ctx.db
      .query(table as any)
      .filter((q: any) => q.eq(q.field("_id"), entityId))
      .first();
    if (!doc) return;
    if (doc.status === "archived" || doc.lifecycleStatus === "Archived" || doc.lifecycleStatus === "Cancelled") return;
    await processEntity(ctx, table as "courses" | "events", entityType, doc, now);
  },
});

export const sendWaitlistPromotionEmail = internalAction({
  args: {
    recipientEmail: v.string(),
    entityTitle: v.string(),
    fromName: v.string(),
    fromEmail: v.string(),
    resendApiKey: v.optional(v.string()),
  },
  handler: async (ctx, { recipientEmail, entityTitle, fromName, fromEmail, resendApiKey }) => {
    await ctx.runAction(internal.email.send, {
      to: recipientEmail,
      subject: `You're in! Your spot in "${entityTitle}" has been confirmed`,
      html: `
        <p>Great news — a spot has opened up and you've been promoted from the waitlist!</p>
        <p>Your registration for <strong>${entityTitle}</strong> is now confirmed.</p>
        <p>If you have any questions, please reply to this email.</p>
        <p>— ${fromName}</p>
      `.trim(),
      fromName,
      fromEmail,
      ...(resendApiKey ? { apiKey: resendApiKey } : {}),
    });
  },
});
