/**
 * Public Booking System — FSTS-WOS™
 *
 * Provides unauthenticated HTTP endpoints for customer-facing class/event
 * registration. All operations are site-scoped and tenant-isolated.
 *
 * Endpoints (wired in http.ts):
 *   GET  /api/public/availability  — entity details + capacity state
 *   POST /api/public/register      — submit a booking (free or paid)
 *   POST /api/public/cancel        — cancel by registrationId + email
 *
 * Architecture:
 *   HTTP action  →  internalMutation/internalQuery  →  registrations table
 *
 * Convex mutations are serialised by the runtime, so capacity enforcement is
 * automatically atomic — two simultaneous requests cannot both take the last
 * seat.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { calculateLifecycleStatus } from "./lib/lifecycleStatus";
import { logActivity } from "./lib/logActivity";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getConfirmedCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) => q.eq("entityType", entityType).eq("entityId", entityId))
    .collect();
  return rows.filter((r: any) => r.status === "confirmed").length;
}

async function getWaitlistCount(ctx: any, entityType: string, entityId: string): Promise<number> {
  const rows = await ctx.db
    .query("registrations")
    .withIndex("by_entity", (q: any) => q.eq("entityType", entityType).eq("entityId", entityId))
    .collect();
  return rows.filter((r: any) => r.status === "waitlisted").length;
}

async function refreshEntityLifecycle(
  ctx: any,
  entityType: "course" | "event",
  entityId: string,
  siteId: any,
  confirmedCount: number,
) {
  const table = entityType === "course" ? "courses" : "events";
  const doc = await ctx.db
    .query(table)
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .filter((q: any) => q.eq(q.field("_id"), entityId))
    .first();
  if (!doc) return;
  const newStatus = calculateLifecycleStatus(doc, confirmedCount, Date.now());
  await ctx.db.patch(doc._id, { lifecycleStatus: newStatus });
}

// ─── Availability query ──────────────────────────────────────────────────────

/**
 * Returns the public availability snapshot for a single course or event.
 * Called by GET /api/public/availability — no auth required.
 */
export const getAvailabilityInternal = internalQuery({
  args: {
    slug: v.string(),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
  },
  handler: async (ctx, { slug, entityType, entityId }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();
    if (!site) return null;

    const table = entityType === "course" ? "courses" : "events";
    const entity = await ctx.db
      .query(table)
      .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
      .filter((q: any) => q.eq(q.field("_id"), entityId))
      .first();
    if (!entity) return null;
    if (!entity.isPublished && entity.status !== "published") return null;

    const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);
    const waitlistCount = await getWaitlistCount(ctx, entityType, entityId);

    const capacity: number | null = entity.capacity ?? null;
    const waitlistCapacity: number = entity.waitlistCapacity ?? 0;
    const seatsRemaining = capacity != null ? Math.max(0, capacity - confirmedCount) : null;
    const isFull = capacity != null && confirmedCount >= capacity;
    const isWaitlistFull =
      waitlistCapacity > 0 ? waitlistCount >= waitlistCapacity : true;

    const now = Date.now();
    const registrationOpenAt: number | null = entity.registrationOpenAt ?? null;
    const registrationCloseAt: number | null = entity.registrationCloseAt ?? null;
    const registrationOpen =
      (registrationOpenAt == null || now >= registrationOpenAt) &&
      (registrationCloseAt == null || now <= registrationCloseAt);

    return {
      entityId: entity._id as string,
      entityType,
      title: entity.title as string,
      description: (entity.description ?? entity.excerpt ?? null) as string | null,
      imageUrl: (entity.imageUrl ?? entity.coverImageUrl ?? null) as string | null,
      priceCents: (typeof entity.priceCents === "number" && isFinite(entity.priceCents))
        ? entity.priceCents
        : null,
      lifecycleStatus: (entity.lifecycleStatus ?? null) as string | null,
      startAt: entity.startAt ? new Date(entity.startAt as number).toISOString() : null,
      endAt: entity.endAt ? new Date(entity.endAt as number).toISOString() : null,
      location: (entity.location ?? null) as string | null,
      capacity,
      waitlistCapacity,
      confirmedCount,
      waitlistCount,
      seatsRemaining,
      isFull,
      hasWaitlist: waitlistCapacity > 0,
      isWaitlistFull,
      registrationOpen,
      registrationOpenAt,
      registrationCloseAt,
      requiresPayment: typeof entity.priceCents === "number" && entity.priceCents > 0,
      siteName: site.name as string,
      siteSlug: site.slug as string,
    };
  },
});

// ─── Public registration mutation ────────────────────────────────────────────

/**
 * Atomically registers a public (unauthenticated) customer for a course or event.
 *
 * Uses the email address as `userId` for backward-compat with the existing
 * waitlist-promotion logic (which detects public registrations via `userId.includes("@")`).
 *
 * Returns { status: "confirmed" | "waitlisted", registrationId }.
 * Throws typed error { code: "class_full" } when no seat or waitlist slot is available.
 * Throws { code: "already_registered" } for duplicate active registrations.
 * Throws { code: "registration_closed" } when outside the registration window.
 * Throws { code: "entity_not_found" } when slug/entityType/entityId don't resolve.
 */
export const registerPublicInternal = internalMutation({
  args: {
    slug: v.string(),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    termsAccepted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { slug, entityType, entityId, customerName, customerEmail } = args;

    // ── 1. Resolve site ────────────────────────────────────────────────────
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();
    if (!site) throw new Error(JSON.stringify({ code: "entity_not_found", message: "Site not found." }));

    // ── 2. Validate entity belongs to site + is published ──────────────────
    const table = entityType === "course" ? "courses" : "events";
    const entity = await ctx.db
      .query(table)
      .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
      .filter((q: any) => q.eq(q.field("_id"), entityId))
      .first();
    if (!entity || (entity.status !== "published" && !entity.isPublished)) {
      throw new Error(JSON.stringify({ code: "entity_not_found", message: "Class or event not found." }));
    }

    // ── 3. Enforce registration window ──────────────────────────────────────
    const now = Date.now();
    if (entity.registrationOpenAt && now < entity.registrationOpenAt) {
      throw new Error(JSON.stringify({ code: "registration_closed", message: "Registration has not opened yet." }));
    }
    if (entity.registrationCloseAt && now > entity.registrationCloseAt) {
      throw new Error(JSON.stringify({ code: "registration_closed", message: "Registration is closed." }));
    }

    // ── 4. Duplicate check (same email, same entity, not cancelled) ─────────
    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_entity", (q: any) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("customerEmail"), customerEmail),
          q.neq(q.field("status"), "cancelled"),
        ),
      )
      .first();
    if (existing) {
      throw new Error(JSON.stringify({ code: "already_registered", message: "You are already registered.", registrationId: existing._id }));
    }

    // ── 5. Capacity / waitlist decision (atomic within mutation) ────────────
    const capacity: number | undefined = entity.capacity;
    const waitlistCapacity: number = entity.waitlistCapacity ?? 0;
    const confirmedCount = await getConfirmedCount(ctx, entityType, entityId);

    let regStatus: "confirmed" | "waitlisted";
    if (!capacity || confirmedCount < capacity) {
      regStatus = "confirmed";
    } else {
      const waitlistCount = await getWaitlistCount(ctx, entityType, entityId);
      if (waitlistCapacity > 0 && waitlistCount < waitlistCapacity) {
        regStatus = "waitlisted";
      } else {
        throw new Error(JSON.stringify({ code: "class_full", message: "No seats or waitlist slots available." }));
      }
    }

    // ── 6. Insert registration ──────────────────────────────────────────────
    const regId = await ctx.db.insert("registrations", {
      siteId: site._id,
      entityType,
      entityId,
      // Use email as userId for compat with promoteNextWaitlisted email resolution
      userId: customerEmail,
      status: regStatus,
      registeredAt: now,
      customerName,
      customerEmail,
      customerPhone: args.customerPhone,
      notes: args.notes,
      termsAccepted: args.termsAccepted,
      bookingSource: "public",
      attendanceStatus: "registered",
    });

    // ── 7. Refresh entity lifecycle ─────────────────────────────────────────
    const newConfirmedCount = regStatus === "confirmed" ? confirmedCount + 1 : confirmedCount;
    await refreshEntityLifecycle(ctx, entityType, entityId, site._id, newConfirmedCount);
    await ctx.scheduler.runAfter(0, (internal as any).lifecycle.recalculateOne, {
      entityType,
      entityId,
    });

    // ── 8. Activity log ─────────────────────────────────────────────────────
    await logActivity(ctx, {
      siteId: site._id,
      actorName: `${customerName} <${customerEmail}>`,
      action: regStatus === "confirmed" ? "public_booking_confirmed" : "public_booking_waitlisted",
      entityType,
      entityId,
      page: entityType === "course" ? "Courses" : "Events",
      newValue: { status: regStatus, customerEmail },
    });

    // ── 9. Schedule confirmation email ──────────────────────────────────────
    try {
      const emailSettings = await ctx.db
        .query("emailSettings")
        .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
        .first();

      await ctx.scheduler.runAfter(0, internal.publicBooking.sendBookingConfirmationEmail, {
        registrationId: regId,
        customerName,
        customerEmail,
        entityTitle: entity.title as string,
        entityType,
        startAt: entity.startAt ? new Date(entity.startAt as number).toISOString() : null,
        location: (entity.location ?? null) as string | null,
        status: regStatus,
        siteName: site.name as string,
        fromName: (emailSettings?.fromName ?? site.name ?? "FSTS Platform") as string,
        fromEmail: (emailSettings?.fromEmail ?? null) as string | null,
        resendApiKey: (emailSettings?.resendApiKey ?? null) as string | null,
      });
    } catch (err) {
      // Email is best-effort — never block the booking itself
      console.warn("[publicBooking] Email scheduling failed:", err);
    }

    return { status: regStatus, registrationId: regId as string };
  },
});

// ─── Public cancellation mutation ────────────────────────────────────────────

/**
 * Cancels a public booking. Verifies that the provided email matches the
 * registration's customerEmail before allowing cancellation.
 */
export const cancelPublicInternal = internalMutation({
  args: {
    registrationId: v.id("registrations"),
    customerEmail: v.string(),
  },
  handler: async (ctx, { registrationId, customerEmail }) => {
    const reg = await ctx.db.get(registrationId);
    if (!reg) throw new Error(JSON.stringify({ code: "not_found", message: "Registration not found." }));
    if (reg.bookingSource !== "public") {
      throw new Error(JSON.stringify({ code: "not_found", message: "Registration not found." }));
    }
    // Email verification — prevents cancellation by a third party who guesses an ID
    if (reg.customerEmail?.toLowerCase() !== customerEmail.toLowerCase()) {
      throw new Error(JSON.stringify({ code: "email_mismatch", message: "Email does not match." }));
    }
    if (reg.status === "cancelled") {
      throw new Error(JSON.stringify({ code: "already_cancelled", message: "Registration already cancelled." }));
    }

    const wasConfirmed = reg.status === "confirmed";
    const now = Date.now();
    await ctx.db.patch(registrationId, { status: "cancelled", cancelledAt: now });

    await logActivity(ctx, {
      siteId: reg.siteId,
      actorName: `${reg.customerName ?? customerEmail} <${customerEmail}> (public cancel)`,
      action: "cancelled_registration",
      entityType: reg.entityType,
      entityId: reg.entityId,
      page: reg.entityType === "course" ? "Courses" : "Events",
    });

    if (wasConfirmed) {
      await ctx.scheduler.runAfter(0, (internal as any).registrations.promoteNextWaitlisted, {
        siteId: reg.siteId,
        entityType: reg.entityType,
        entityId: reg.entityId,
      });
    } else {
      const confirmedCount = await getConfirmedCount(ctx, reg.entityType, reg.entityId);
      await refreshEntityLifecycle(ctx, reg.entityType, reg.entityId, reg.siteId, confirmedCount);
    }

    await ctx.scheduler.runAfter(0, (internal as any).lifecycle.recalculateOne, {
      entityType: reg.entityType,
      entityId: reg.entityId,
    });

    // Cancellation confirmation email (best-effort)
    try {
      const emailSettings = await ctx.db
        .query("emailSettings")
        .withIndex("by_site", (q: any) => q.eq("siteId", reg.siteId))
        .first();
      const site = await ctx.db.get(reg.siteId);

      // Resolve entity title
      const table = reg.entityType === "course" ? "courses" : "events";
      const entity = await ctx.db
        .query(table as any)
        .filter((q: any) => q.eq(q.field("_id"), reg.entityId))
        .first();

      await ctx.scheduler.runAfter(0, internal.publicBooking.sendBookingCancellationEmail, {
        customerName: reg.customerName ?? customerEmail,
        customerEmail,
        entityTitle: (entity?.title ?? (reg.entityType === "course" ? "the class" : "the event")) as string,
        entityType: reg.entityType,
        siteName: (site?.name ?? "FSTS Platform") as string,
        fromName: (emailSettings?.fromName ?? site?.name ?? "FSTS Platform") as string,
        fromEmail: (emailSettings?.fromEmail ?? null) as string | null,
        resendApiKey: (emailSettings?.resendApiKey ?? null) as string | null,
      });
    } catch (err) {
      console.warn("[publicBooking] Cancellation email scheduling failed:", err);
    }

    return { success: true };
  },
});

// ─── Email actions ───────────────────────────────────────────────────────────

import { internalAction } from "./_generated/server";

export const sendBookingConfirmationEmail = internalAction({
  args: {
    registrationId: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    entityTitle: v.string(),
    entityType: v.union(v.literal("course"), v.literal("event")),
    startAt: v.union(v.string(), v.null()),
    location: v.union(v.string(), v.null()),
    status: v.union(v.literal("confirmed"), v.literal("waitlisted")),
    siteName: v.string(),
    fromName: v.string(),
    fromEmail: v.union(v.string(), v.null()),
    resendApiKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    if (!args.fromEmail) {
      console.warn("[publicBooking] sendBookingConfirmationEmail: no fromEmail configured for site — skipping");
      return { skipped: true };
    }

    const label = args.entityType === "course" ? "Class" : "Event";
    const isWaitlisted = args.status === "waitlisted";

    const startLine = args.startAt
      ? `<tr><td style="padding:6px 0;color:#555;width:120px">Date / Time</td><td style="padding:6px 0;font-weight:600">${new Date(args.startAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</td></tr>`
      : "";
    const locationLine = args.location
      ? `<tr><td style="padding:6px 0;color:#555">Location</td><td style="padding:6px 0">${args.location}</td></tr>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px;color:#ffffff">${args.siteName}</h1>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 12px;font-size:20px">
            ${isWaitlisted ? "You're on the waitlist" : "Booking Confirmed"} ✓
          </h2>
          <p style="color:#475569;line-height:1.7;margin:0 0 20px">
            Hi ${args.customerName},<br/>
            ${isWaitlisted
              ? `You have been added to the waitlist for <strong>${args.entityTitle}</strong>. We will notify you if a spot becomes available.`
              : `Your booking for <strong>${args.entityTitle}</strong> is confirmed.`
            }
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:6px 0;color:#555;width:120px">${label}</td><td style="padding:6px 0;font-weight:600">${args.entityTitle}</td></tr>
            ${startLine}
            ${locationLine}
            <tr><td style="padding:6px 0;color:#555">Status</td><td style="padding:6px 0;font-weight:600;color:${isWaitlisted ? "#f59e0b" : "#16a34a"}">${isWaitlisted ? "Waitlisted" : "Confirmed"}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="color:#94a3b8;font-size:13px;margin:0">
            Registration ID: ${args.registrationId}<br/>
            To cancel your booking reply to this email or contact ${args.siteName} directly.
          </p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:16px">Sent by FSTS Platform on behalf of ${args.siteName}</p>
        </div>
      </div>
    `;

    await ctx.runAction(internal.email.send, {
      to: args.customerEmail,
      subject: isWaitlisted
        ? `Waitlist Confirmation — ${args.entityTitle}`
        : `Booking Confirmed — ${args.entityTitle}`,
      html,
      fromName: args.fromName,
      fromEmail: args.fromEmail,
      apiKey: args.resendApiKey ?? undefined,
    });
    return { skipped: false };
  },
});

export const sendBookingCancellationEmail = internalAction({
  args: {
    customerName: v.string(),
    customerEmail: v.string(),
    entityTitle: v.string(),
    entityType: v.union(v.literal("course"), v.literal("event")),
    siteName: v.string(),
    fromName: v.string(),
    fromEmail: v.union(v.string(), v.null()),
    resendApiKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    if (!args.fromEmail) {
      console.warn("[publicBooking] sendBookingCancellationEmail: no fromEmail — skipping");
      return { skipped: true };
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px;color:#ffffff">${args.siteName}</h1>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 12px;font-size:20px">Booking Cancelled</h2>
          <p style="color:#475569;line-height:1.7;margin:0 0 20px">
            Hi ${args.customerName},<br/>
            Your registration for <strong>${args.entityTitle}</strong> has been cancelled.
            If this was a mistake or you have questions, please contact ${args.siteName} directly.
          </p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:32px">Sent by FSTS Platform on behalf of ${args.siteName}</p>
        </div>
      </div>
    `;

    await ctx.runAction(internal.email.send, {
      to: args.customerEmail,
      subject: `Booking Cancelled — ${args.entityTitle}`,
      html,
      fromName: args.fromName,
      fromEmail: args.fromEmail,
      apiKey: args.resendApiKey ?? undefined,
    });
    return { skipped: false };
  },
});
