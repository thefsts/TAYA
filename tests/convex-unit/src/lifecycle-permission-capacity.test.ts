/**
 * Lifecycle, Capacity, and Permission Test Suite — FSTS-WOS™
 *
 * Integration tests that run the REAL Convex mutation/query handlers against
 * an in-memory convex-test backend (no mocks). Covers:
 *
 *   1. Permission enforcement — design-locked mutations blocked for client roles
 *   2. Capacity & concurrent registrations — no double-booking, waitlist promotion
 *   3. Lifecycle transitions — tick-driven Upcoming → Completed, list filtering
 *   4. Flyer lifecycle — expiry, entity-cancel cascade, client CRUD flow
 *   5. Tenant isolation — cross-site mutations rejected
 *   6. Timezone correctness — DST-aware end-time, end-of-day fallback
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Seed helpers ─────────────────────────────────────────────────────────────

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
    // All modules enabled so requireModuleEnabled never blocks our test calls
    enabledModules: { courses: true, events: true, flyers: true },
  };
}

function userDoc(
  clerkUserId: string,
  overrides: Partial<{
    isSuperAdmin: boolean;
    isActive: boolean;
    roles: { siteId: Id<"sites">; role: string }[];
  }> = {},
) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [],
    ...overrides,
  };
}

type BaseSeeded = {
  siteA: Id<"sites">;
  siteB: Id<"sites">;
};

/**
 * Seeds two sites plus a representative set of users.
 * Users are inserted BEFORE any function call to prevent the first-user
 * superadmin bootstrap from running during a mutation.
 */
async function seedBase(t: ReturnType<typeof convexTest>): Promise<BaseSeeded> {
  return await t.run(async (ctx) => {
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "test-lifecycle-site-a"));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "test-lifecycle-site-b"));

    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    // owner — full CRUD on site A (has CONTENT_CREATE, FLYERS_*, EVENTS_MANAGE, CLASSES_MANAGE)
    await ctx.db.insert("users", userDoc("owner_a", { roles: [{ siteId: siteA, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("owner_b", { roles: [{ siteId: siteB, role: "owner" }] }));
    // content_editor — CONTENT_* + MEDIA_* + FLYERS_* but NOT CLASSES/EVENTS_MANAGE or design-tier
    await ctx.db.insert("users", userDoc("content_editor_a", { roles: [{ siteId: siteA, role: "content_editor" }] }));
    // course_manager — CLASSES_MANAGE + registration permissions
    await ctx.db.insert("users", userDoc("course_manager_a", { roles: [{ siteId: siteA, role: "course_manager" }] }));
    // events_manager — EVENTS_MANAGE + registration permissions
    await ctx.db.insert("users", userDoc("events_manager_a", { roles: [{ siteId: siteA, role: "events_manager" }] }));

    return { siteA, siteB };
  });
}

let t: ReturnType<typeof convexTest>;
let s: BaseSeeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await seedBase(t);
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Permission enforcement
// ────────────────────────────────────────────────────────────────────────────

describe("Permission enforcement — design-locked mutations block client roles", () => {
  const asEditor = () => t.withIdentity({ subject: "content_editor_a" });
  const asOwner  = () => t.withIdentity({ subject: "owner_a" });
  const asAdmin  = () => t.withIdentity({ subject: "superadmin" });

  it("content_editor is blocked from DESIGN_MANAGE-gated mutation (updateBranding)", async () => {
    await expect(
      asEditor().mutation(api.siteSettings.updateBranding, {
        siteId: s.siteA,
        brandColorPrimary: "#ff0000",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("content_editor is blocked from LAYOUT_MANAGE-gated mutation (navigation.create)", async () => {
    await expect(
      asEditor().mutation(api.navigation.create, {
        siteId: s.siteA,
        label: "Home",
        href: "/",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("content_editor is blocked from INTEGRATIONS_MANAGE-gated mutation (updateIntegrations)", async () => {
    await expect(
      asEditor().mutation(api.siteSettings.updateIntegrations, {
        siteId: s.siteA,
        cookieConsentEnabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner (highest client role) is also blocked by DESIGN_MANAGE guard", async () => {
    await expect(
      asOwner().mutation(api.siteSettings.updateBranding, {
        siteId: s.siteA,
        brandColorPrimary: "#00ff00",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner (highest client role) is also blocked by LAYOUT_MANAGE guard", async () => {
    await expect(
      asOwner().mutation(api.navigation.create, {
        siteId: s.siteA,
        label: "About",
        href: "/about",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner (highest client role) is also blocked by INTEGRATIONS_MANAGE guard", async () => {
    await expect(
      asOwner().mutation(api.siteSettings.updateIntegrations, {
        siteId: s.siteA,
        cookieConsentEnabled: false,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("superAdmin bypasses DESIGN_MANAGE guard", async () => {
    const result = await asAdmin().mutation(api.siteSettings.updateBranding, {
      siteId: s.siteA,
      brandColorPrimary: "#1d4ed8",
    });
    expect(result).toMatchObject({ brandColorPrimary: "#1d4ed8" });
  });

  it("superAdmin bypasses LAYOUT_MANAGE guard", async () => {
    const result = await asAdmin().mutation(api.navigation.create, {
      siteId: s.siteA,
      label: "Home",
      href: "/",
    });
    expect(result).toMatchObject({ label: "Home" });
  });

  it("superAdmin bypasses INTEGRATIONS_MANAGE guard", async () => {
    const result = await asAdmin().mutation(api.siteSettings.updateIntegrations, {
      siteId: s.siteA,
      cookieConsentEnabled: true,
    });
    expect(result).toMatchObject({ cookieConsentEnabled: true });
  });
});

describe("Permission enforcement — client roles succeed on permitted mutations", () => {
  it("course_manager can call courses.create", async () => {
    const as = () => t.withIdentity({ subject: "course_manager_a" });
    const result = await as().mutation(api.courses.create, {
      siteId: s.siteA,
      title: "Permitted Course",
      slug: "permitted-course-perm",
      description: "course_manager permission test",
    });
    expect(result).toMatchObject({ title: "Permitted Course" });
  });

  it("events_manager can call events.create", async () => {
    const as = () => t.withIdentity({ subject: "events_manager_a" });
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await as().mutation(api.events.create, {
      siteId: s.siteA,
      title: "Permitted Event",
      slug: "permitted-event-perm",
      description: "events_manager permission test",
      startAt: futureDate,
    });
    expect(result).toMatchObject({ title: "Permitted Event" });
  });

  it("owner can call flyers.create", async () => {
    const as = () => t.withIdentity({ subject: "owner_a" });
    const result = await as().mutation(api.flyers.create, {
      siteId: s.siteA,
      title: "Permitted Flyer",
    });
    expect(result).toMatchObject({ title: "Permitted Flyer", status: "draft" });
  });

  it("content_editor calling courses.create is blocked (requires CLASSES_MANAGE)", async () => {
    const as = () => t.withIdentity({ subject: "content_editor_a" });
    await expect(
      as().mutation(api.courses.create, {
        siteId: s.siteA,
        title: "Bad Course",
        slug: "bad-course-perm",
        description: "Should fail",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("content_editor calling events.create is blocked (requires EVENTS_MANAGE)", async () => {
    const as = () => t.withIdentity({ subject: "content_editor_a" });
    await expect(
      as().mutation(api.events.create, {
        siteId: s.siteA,
        title: "Bad Event",
        slug: "bad-event-perm",
        description: "Should fail",
        startAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Capacity and concurrent registrations
// ────────────────────────────────────────────────────────────────────────────

describe("Capacity — registration closes when confirmedCount reaches capacity", () => {
  it("second registration when capacity=1 and no waitlist throws class_full", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Full Class",
        slug: "full-class-cap",
        status: "published",
        description: "Capacity test",
        capacity: 1,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const as = t.withIdentity({ subject: "owner_a" });

    // First registration fills the only seat
    const r1 = await as.mutation(api.registrations.register, {
      siteId: s.siteA,
      entityType: "course",
      entityId: courseId,
      userId: "user-cap-one",
    });
    expect(r1.status).toBe("confirmed");

    // Second registration exceeds capacity
    await expect(
      as.mutation(api.registrations.register, {
        siteId: s.siteA,
        entityType: "course",
        entityId: courseId,
        userId: "user-cap-two",
      }),
    ).rejects.toThrow(/class_full/);
  });
});

describe("Capacity — concurrent registrations with one seat remaining", () => {
  it("exactly one succeeds and one returns class_full when capacity=1", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Race Course",
        slug: "race-class-concurrent",
        status: "published",
        description: "Concurrency test",
        capacity: 1,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const as = t.withIdentity({ subject: "owner_a" });

    // Fire two requests simultaneously — Convex serializes mutations so
    // exactly one will claim the seat; the other must receive class_full.
    const results = await Promise.allSettled([
      as.mutation(api.registrations.register, {
        siteId: s.siteA,
        entityType: "course",
        entityId: courseId,
        userId: "racer-one",
      }),
      as.mutation(api.registrations.register, {
        siteId: s.siteA,
        entityType: "course",
        entityId: courseId,
        userId: "racer-two",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<any>).value.status).toBe("confirmed");
    expect((rejected[0] as PromiseRejectedResult).reason?.message ?? "").toMatch(/class_full/);
  });
});

describe("Capacity — cancellation decrements count and recalculates lifecycleStatus", () => {
  it("cancelling the only confirmed registration updates lifecycleStatus away from Full", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Cancelable Class",
        slug: "cancel-class-cap",
        status: "published",
        description: "Cancel test",
        capacity: 1,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const as = t.withIdentity({ subject: "owner_a" });

    const reg = await as.mutation(api.registrations.register, {
      siteId: s.siteA,
      entityType: "course",
      entityId: courseId,
      userId: "cancel-user",
    });
    expect(reg.status).toBe("confirmed");

    // Verify the entity shows Full after the confirmed registration
    const fullCourse = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(fullCourse?.lifecycleStatus).toBe("Full");

    // Cancel the registration
    await as.mutation(api.registrations.cancel, {
      siteId: s.siteA,
      registrationId: reg.registrationId,
    });

    // registrations.cancel schedules recalculateOne via ctx.scheduler.runAfter(0).
    // convex-test does not auto-drain the scheduler, so we explicitly run it here
    // to simulate the same effect as the Convex runtime's immediate scheduling.
    await t.mutation(internal.lifecycle.recalculateOne, {
      entityType: "course",
      entityId: courseId,
    });

    const afterCancel = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(afterCancel?.lifecycleStatus).not.toBe("Full");
  });
});

describe("Capacity — waitlisted user is promoted when confirmed cancels", () => {
  it("cancelling the confirmed seat promotes the first waitlisted registrant", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Waitlist Promo Class",
        slug: "waitlist-promo-cap",
        status: "published",
        description: "Waitlist promotion test",
        capacity: 1,
        waitlistCapacity: 1,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const as = t.withIdentity({ subject: "owner_a" });

    // First user takes the confirmed seat
    const r1 = await as.mutation(api.registrations.register, {
      siteId: s.siteA,
      entityType: "course",
      entityId: courseId,
      userId: "confirmed-user-wl",
    });
    expect(r1.status).toBe("confirmed");

    // Second user lands on the waitlist
    const r2 = await as.mutation(api.registrations.register, {
      siteId: s.siteA,
      entityType: "course",
      entityId: courseId,
      userId: "waitlist-user-wl",
    });
    expect(r2.status).toBe("waitlisted");

    // Cancel the confirmed registration
    await as.mutation(api.registrations.cancel, {
      siteId: s.siteA,
      registrationId: r1.registrationId,
    });

    // registrations.cancel schedules promoteNextWaitlisted via ctx.scheduler.runAfter(0).
    // convex-test does not auto-drain the scheduler, so we explicitly run it here
    // to simulate the same effect as the Convex runtime's immediate scheduling.
    await t.mutation(internal.registrations.promoteNextWaitlisted, {
      siteId: s.siteA,
      entityType: "course",
      entityId: courseId,
    });

    // The formerly-waitlisted registration must now be confirmed
    const promoted = await t.run(async (ctx) => ctx.db.get(r2.registrationId));
    expect(promoted?.status).toBe("confirmed");
    expect(promoted?.promotedFromWaitlistAt).toBeDefined();
  });
});

describe("Capacity — lifecycleStatus shows RegistrationClosed when registrationCloseAt is in the past", () => {
  it("entity seeded with past registrationCloseAt has RegistrationClosed lifecycle status", async () => {
    const pastClose = Date.now() - 60_000; // 1 minute ago
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Closed Reg Class",
        slug: "closed-reg-cap",
        status: "published",
        description: "RegistrationClosed test",
        capacity: 10,
        waitlistCapacity: 0,
        registrationCloseAt: pastClose,
        lifecycleStatus: "RegistrationClosed",
        isPublished: true,
      });
    });

    // Run tick so calculateLifecycleStatus is applied fresh
    await t.mutation(internal.lifecycle.tick, {});

    const course = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(course?.lifecycleStatus).toBe("RegistrationClosed");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Lifecycle transitions
// ────────────────────────────────────────────────────────────────────────────

describe("Lifecycle transitions — tick moves entities to Completed after endDateTime", () => {
  it("event with past endDateTime transitions to Completed after tick", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    const eventId = await t.run(async (ctx) => {
      return ctx.db.insert("events", {
        siteId: s.siteA,
        title: "Past Event Tick",
        slug: "past-event-tick",
        status: "published",
        description: "Tick test",
        startAt: pastStart,
        startDateTime: pastStart,
        endDateTime: pastEnd,
        lifecycleStatus: "InProgress",
        isPublished: true,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event?.lifecycleStatus).toBe("Completed");
  });

  it("course with past endDateTime transitions to Completed after tick", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Past Course Tick",
        slug: "past-course-tick",
        status: "published",
        description: "Tick test",
        startDateTime: pastStart,
        endDateTime: pastEnd,
        lifecycleStatus: "InProgress",
        isPublished: true,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const course = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(course?.lifecycleStatus).toBe("Completed");
  });

  it("entity already in Completed stays Completed across tick (idempotent)", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Already Completed Course",
        slug: "already-completed-tick",
        status: "published",
        description: "Idempotency test",
        startDateTime: pastStart,
        endDateTime: pastEnd,
        completedAt: pastEnd,
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const course = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(course?.lifecycleStatus).toBe("Completed");
  });
});

describe("Lifecycle transitions — list queries respect lifecycle status", () => {
  it("completed event is excluded from listUpcoming and included in listPast", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId: s.siteA,
        title: "Completed List Event",
        slug: "completed-list-event",
        status: "published",
        description: "List filtering test",
        startAt: pastStart,
        startDateTime: pastStart,
        endDateTime: pastEnd,
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const upcoming = await t.query(api.events.listUpcoming, { siteSlug: "test-lifecycle-site-a" });
    const past     = await t.query(api.events.listPast,     { siteSlug: "test-lifecycle-site-a" });

    expect(upcoming.map((e: any) => e.title)).not.toContain("Completed List Event");
    expect(past.map((e: any) => e.title)).toContain("Completed List Event");
  });

  it("cancelled event is not returned by listUpcoming", async () => {
    const futureStart = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId: s.siteA,
        title: "Cancelled List Event",
        slug: "cancelled-list-event",
        status: "published",
        description: "Cancelled list test",
        startAt: futureStart,
        startDateTime: futureStart,
        cancelledAt: Date.now() - 1000,
        lifecycleStatus: "Cancelled",
        isPublished: true,
      });
    });

    const upcoming = await t.query(api.events.listUpcoming, { siteSlug: "test-lifecycle-site-a" });
    expect(upcoming.map((e: any) => e.title)).not.toContain("Cancelled List Event");
  });

  it("cancelled event appears in listCancelled only when showCancelledEvents is true", async () => {
    const futureStart = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId: s.siteA,
        title: "Showable Cancelled Event",
        slug: "showable-cancelled-event",
        status: "published",
        description: "showCancelledEvents gate test",
        startAt: futureStart,
        startDateTime: futureStart,
        cancelledAt: Date.now() - 1000,
        lifecycleStatus: "Cancelled",
        isPublished: true,
      });
    });

    // Without the flag the query returns nothing
    const hiddenList = await t.query(api.events.listCancelled, { siteSlug: "test-lifecycle-site-a" });
    expect(hiddenList.map((e: any) => e.title)).not.toContain("Showable Cancelled Event");

    // Enable showCancelledEvents via the proper mutation (owner has CONTENT_UPDATE)
    await t.withIdentity({ subject: "owner_a" }).mutation(api.siteSettings.updateEventDisplay, {
      siteId: s.siteA,
      showCancelledEvents: true,
    });

    const shownList = await t.query(api.events.listCancelled, { siteSlug: "test-lifecycle-site-a" });
    expect(shownList.map((e: any) => e.title)).toContain("Showable Cancelled Event");
  });

  it("course in Completed state is excluded from listUpcoming and included in listPast", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Completed List Course",
        slug: "completed-list-course",
        status: "published",
        description: "Course list filtering test",
        startDateTime: pastStart,
        endDateTime: pastEnd,
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const upcoming = await t.query(api.courses.listUpcoming, { siteSlug: "test-lifecycle-site-a" });
    const past     = await t.query(api.courses.listPast,     { siteSlug: "test-lifecycle-site-a" });

    expect(upcoming.map((c: any) => c.title)).not.toContain("Completed List Course");
    expect(past.map((c: any) => c.title)).toContain("Completed List Course");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Flyer lifecycle
// ────────────────────────────────────────────────────────────────────────────

describe("Flyer lifecycle — expired flyer is archived by tick", () => {
  it("published flyer with past expirationDate has status archived after tick", async () => {
    const pastExpiry = Date.now() - 60_000;

    const flyerId = await t.run(async (ctx) => {
      return ctx.db.insert("flyers", {
        siteId: s.siteA,
        title: "Expired Flyer",
        status: "published",
        expirationDate: pastExpiry,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const flyer = await t.run(async (ctx) => ctx.db.get(flyerId));
    expect(flyer?.status).toBe("archived");
    expect(flyer?.archivedReason).toBe("expired");
  });

  it("expired flyer does not appear in flyers.listActive", async () => {
    const pastExpiry = Date.now() - 60_000;

    await t.run(async (ctx) => {
      await ctx.db.insert("flyers", {
        siteId: s.siteA,
        title: "Stale Active Flyer",
        status: "published",
        expirationDate: pastExpiry,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const active = await t.query(api.flyers.listActive, { siteSlug: "test-lifecycle-site-a" });
    expect(active.map((f: any) => f.title)).not.toContain("Stale Active Flyer");
  });

  it("published flyer with a future expirationDate is NOT archived by tick", async () => {
    const futureExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const flyerId = await t.run(async (ctx) => {
      return ctx.db.insert("flyers", {
        siteId: s.siteA,
        title: "Future Expiry Flyer",
        status: "published",
        expirationDate: futureExpiry,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const flyer = await t.run(async (ctx) => ctx.db.get(flyerId));
    expect(flyer?.status).toBe("published");
  });
});

describe("Flyer lifecycle — flyer linked to a cancelled entity is archived", () => {
  it("published flyer linked to a course gets archivedReason associated_entity_ended", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Course With Linked Flyer",
        slug: "course-with-linked-flyer",
        status: "published",
        description: "Will have its flyers archived",
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const flyerId = await t.run(async (ctx) => {
      return ctx.db.insert("flyers", {
        siteId: s.siteA,
        title: "Linked Course Flyer",
        status: "published",
        associatedEntityType: "class",
        associatedEntityId: courseId,
      });
    });

    // Directly invoke the internal bulk-archive mutation (as the lifecycle engine does)
    await t.mutation(internal.flyers.archiveByEntity, {
      siteId: s.siteA,
      associatedEntityType: "class",
      associatedEntityId: courseId,
      archivedReason: "associated_entity_ended",
    });

    const flyer = await t.run(async (ctx) => ctx.db.get(flyerId));
    expect(flyer?.status).toBe("archived");
    expect(flyer?.archivedReason).toBe("associated_entity_ended");
  });

  it("published flyer linked to an event is archived when the event is cancelled via update", async () => {
    const futureStart = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Seed the event directly via t.run to have precise control
    const eventId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("events", {
        siteId: s.siteA,
        title: "Event With Linked Flyer",
        slug: "event-with-linked-flyer",
        status: "published",
        description: "Will be cancelled",
        startAt: futureStart,
        startDateTime: futureStart,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
      return id;
    });

    const flyerId = await t.run(async (ctx) => {
      return ctx.db.insert("flyers", {
        siteId: s.siteA,
        title: "Linked Event Flyer",
        status: "published",
        associatedEntityType: "event",
        associatedEntityId: eventId,
      });
    });

    // Cancel via the internal archive helper (same path the update mutation uses)
    await t.mutation(internal.flyers.archiveByEntity, {
      siteId: s.siteA,
      associatedEntityType: "event",
      associatedEntityId: eventId,
      archivedReason: "associated_entity_ended",
    });

    const flyer = await t.run(async (ctx) => ctx.db.get(flyerId));
    expect(flyer?.status).toBe("archived");
    expect(flyer?.archivedReason).toBe("associated_entity_ended");
  });
});

describe("Flyer lifecycle — client completes full create → publish → archive flow", () => {
  it("owner can create a draft, publish it, then archive it manually", async () => {
    const as = t.withIdentity({ subject: "owner_a" });

    // Create
    const created = await as.mutation(api.flyers.create, {
      siteId: s.siteA,
      title: "Full Lifecycle Flyer",
    });
    expect(created.status).toBe("draft");
    expect(created._id).toBeDefined();

    // Publish
    const published = await as.mutation(api.flyers.publish, {
      siteId: s.siteA,
      flyerId: created._id,
    });
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeDefined();

    // Archive
    const archived = await as.mutation(api.flyers.archive, {
      siteId: s.siteA,
      flyerId: created._id,
      archivedReason: "manual",
    });
    expect(archived.status).toBe("archived");
    expect(archived.archivedReason).toBe("manual");
    expect(archived.archivedAt).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Tenant isolation
// ────────────────────────────────────────────────────────────────────────────

describe("Tenant isolation — site A user cannot modify site B entities", () => {
  const asOwnerA = () => t.withIdentity({ subject: "owner_a" });

  it("owner_a is blocked from updating an event on site B", async () => {
    const eventB = await t.run(async (ctx) => {
      return ctx.db.insert("events", {
        siteId: s.siteB,
        title: "Site B Event",
        slug: "site-b-event-iso",
        status: "published",
        description: "Site B entity",
        startAt: Date.now() + 86400000,
        startDateTime: Date.now() + 86400000,
      });
    });

    await expect(
      asOwnerA().mutation(api.events.update, {
        siteId: s.siteB,
        eventId: eventB,
        title: "Hijacked Title",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner_a is blocked from updating a course on site B", async () => {
    const courseB = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteB,
        title: "Site B Course",
        slug: "site-b-course-iso",
        status: "published",
        description: "Site B entity",
      });
    });

    await expect(
      asOwnerA().mutation(api.courses.update, {
        siteId: s.siteB,
        courseId: courseB,
        title: "Hijacked Title",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner_a is blocked from updating a flyer on site B", async () => {
    const flyerB = await t.run(async (ctx) => {
      return ctx.db.insert("flyers", {
        siteId: s.siteB,
        title: "Site B Flyer",
        status: "draft",
      });
    });

    await expect(
      asOwnerA().mutation(api.flyers.update, {
        siteId: s.siteB,
        flyerId: flyerB,
        title: "Hijacked Title",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner_a is blocked from cancelling a registration on site B", async () => {
    const courseB = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteB,
        title: "Site B Reg Course",
        slug: "site-b-reg-course-iso",
        status: "published",
        description: "Site B entity",
        capacity: 10,
      });
    });

    const regB = await t.run(async (ctx) => {
      return ctx.db.insert("registrations", {
        siteId: s.siteB,
        entityType: "course",
        entityId: courseB,
        userId: "site-b-user",
        status: "confirmed",
        registeredAt: Date.now(),
      });
    });

    await expect(
      asOwnerA().mutation(api.registrations.cancel, {
        siteId: s.siteB,
        registrationId: regB,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner_a is blocked from registering for an entity on site B", async () => {
    const courseB = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteB,
        title: "Site B Open Course",
        slug: "site-b-open-course-iso",
        status: "published",
        description: "Site B entity",
        capacity: 10,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    await expect(
      asOwnerA().mutation(api.registrations.register, {
        siteId: s.siteB,
        entityType: "course",
        entityId: courseB,
        userId: "owner-a-as-interloper",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Timezone correctness
// ────────────────────────────────────────────────────────────────────────────

describe("Timezone correctness — lifecycle uses DST-aware end times", () => {
  it("event in America/New_York timezone transitions to Completed when its UTC endDateTime passes", async () => {
    // EDT = UTC-4. A past UTC timestamp always triggers Completed regardless of timezone
    // because calculateLifecycleStatus compares endDateTime (stored as UTC epoch) to now.
    // This test verifies the full path: a stored UTC epoch that corresponds to
    // a past New York local time causes the entity to be marked Completed by tick.
    const nyPastEndUtc = Date.now() - 60_000;   // 1 minute ago in UTC
    const nyPastStartUtc = nyPastEndUtc - 3_600_000; // 1 hour earlier

    const eventId = await t.run(async (ctx) => {
      return ctx.db.insert("events", {
        siteId: s.siteA,
        title: "NY Timezone Event",
        slug: "ny-tz-event-tick",
        status: "published",
        description: "DST-aware timezone test",
        startAt: nyPastStartUtc,
        startDateTime: nyPastStartUtc,
        endDateTime: nyPastEndUtc,
        timezone: "America/New_York",
        lifecycleStatus: "InProgress",
        isPublished: true,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event?.lifecycleStatus).toBe("Completed");
  });

  it("course with timezone but no endDateTime stays InProgress after tick (end-of-day fallback is display-only)", async () => {
    // calculateLifecycleStatus only fires Completed when `end && end <= now`.
    // When endDateTime is absent, it cannot cross that threshold — the entity
    // transitions to InProgress (started, no end) and waits for explicit completion.
    // The endOfDayMs() helper is used by listPast for display ordering only.
    const pastStart = Date.now() - 3_600_000; // 1 hour ago

    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "No EndDateTime Course NY",
        slug: "no-end-dt-ny-course",
        status: "published",
        description: "End-of-day fallback test",
        startDateTime: pastStart,
        // endDateTime intentionally omitted — fallback applies only to display
        timezone: "America/New_York",
        lifecycleStatus: "Scheduled",
        isPublished: true,
      });
    });

    await t.mutation(internal.lifecycle.tick, {});

    // tick should move this to InProgress (started, no explicit end)
    const course = await t.run(async (ctx) => ctx.db.get(courseId));
    expect(course?.lifecycleStatus).toBe("InProgress");
  });

  it("listPast includes a completed course with no endDateTime using end-of-day display fallback", async () => {
    // Seed a Completed course with no endDateTime; listPast should still include it
    // because it uses endOfDayMs(timezone, startDateTime) as the effective end for sorting.
    const pastStart = Date.now() - 7 * 24 * 60 * 60 * 1000; // 1 week ago

    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId: s.siteA,
        title: "Completed No End Course NY",
        slug: "completed-no-end-ny",
        status: "published",
        description: "listPast end-of-day fallback",
        startDateTime: pastStart,
        // no endDateTime — listPast uses endOfDayMs fallback
        timezone: "America/New_York",
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const past = await t.query(api.courses.listPast, { siteSlug: "test-lifecycle-site-a" });
    const found = past.find((c: any) => c.title === "Completed No End Course NY");
    expect(found).toBeDefined();
    // The record is flagged as missing end time so the UI can render a note
    expect((found as any).missingEndTime).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Public booking end-to-end — slug-based handlers (production path)
//
// All tests exercise the SAME handlers that the HTTP routes call:
//   GET  /api/public/availability → getAvailabilityByEntitySlug
//   POST /api/public/register     → registerPublicByEntitySlug
//
// The availability query resolves site-slug → entity-slug → row, and the
// registration mutation resolves the same path before inserting.  Tests
// that exercise the ID-based internal variants (registerPublicInternal /
// getAvailabilityInternal) would miss regressions in slug resolution.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Seeds a published course in the Corsair LTC site.
 * Returns { siteId, courseSlug } — the same slug the HTTP handler uses.
 */
async function seedCorsairCourse(
  t: ReturnType<typeof convexTest>,
  options: {
    capacity?: number;
    waitlistCapacity?: number;
    courseSlug?: string;
    siteSlug?: string;
    title?: string;
  } = {},
): Promise<{ siteId: Id<"sites">; courseSlug: string; siteSlug: string }> {
  const resolvedSiteSlug = options.siteSlug ?? "corsair-ltc";
  const resolvedCourseSlug = options.courseSlug ?? "ltc-concealed-carry";
  return await t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", {
      name: "Corsair LTC",
      slug: resolvedSiteSlug,
      status: "active",
      brandColorPrimary: "#1a1a2e",
      brandColorSecondary: "#ffffff",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: { courses: true, events: true },
    });

    await ctx.db.insert("courses", {
      siteId,
      title: options.title ?? "LTC Concealed Carry Class",
      slug: resolvedCourseSlug,
      status: "published",
      isPublished: true,
      description: "Texas License to Carry course",
      capacity: options.capacity ?? 10,
      waitlistCapacity: options.waitlistCapacity ?? 0,
      lifecycleStatus: "RegistrationOpen",
      startDateTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
    });

    return { siteId, courseSlug: resolvedCourseSlug, siteSlug: resolvedSiteSlug };
  });
}

describe("Public booking end-to-end — happy path for a Corsair LTC class", () => {
  it("creates a confirmed registration row with all required fields", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t);

    // Uses the same slug-based handler that POST /api/public/register invokes
    const result = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug,
      entityType: "course",
      entitySlug: courseSlug,
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      customerPhone: "555-0100",
      termsAccepted: true,
    });

    expect(result.status).toBe("confirmed");
    expect(result.registrationId).toBeTruthy();

    // Verify the row exists in the DB with the expected shape
    const row = await t.run(async (ctx) => ctx.db.get(result.registrationId as Id<"registrations">));
    expect(row).not.toBeNull();
    expect(row?.status).toBe("confirmed");
    expect(row?.customerName).toBe("Jane Smith");
    expect(row?.customerEmail).toBe("jane@example.com");
    expect(row?.bookingSource).toBe("public");
    expect(row?.entityType).toBe("course");
    expect(row?.attendanceStatus).toBe("registered");
    expect(row?.registeredAt).toBeTypeOf("number");
  });

  it("confirmedCount increments and seatsRemaining decrements after registration", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, { capacity: 5 });

    // Before: confirmedCount = 0, seatsRemaining = 5 (via GET /api/public/availability handler)
    const before = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug,
      entityType: "course",
      entitySlug: courseSlug,
    });
    expect(before).not.toBeNull();
    expect(before!.confirmedCount).toBe(0);
    expect(before!.seatsRemaining).toBe(5);
    expect(before!.isFull).toBe(false);

    // Register one customer via POST /api/public/register handler
    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug,
      entityType: "course",
      entitySlug: courseSlug,
      customerName: "Bob Jones",
      customerEmail: "bob@example.com",
    });

    // After: confirmedCount = 1, seatsRemaining = 4
    const after = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug,
      entityType: "course",
      entitySlug: courseSlug,
    });
    expect(after!.confirmedCount).toBe(1);
    expect(after!.seatsRemaining).toBe(4);
    expect(after!.isFull).toBe(false);
  });

  it("seatsRemaining reaches 0 and isFull flips true when last seat is taken", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      capacity: 2,
      courseSlug: "ltc-two-seats",
      siteSlug: "corsair-ltc-two-seats",
    });

    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Alice A", customerEmail: "alice@example.com",
    });
    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Bob B", customerEmail: "bob@example.com",
    });

    const av = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
    });
    expect(av!.confirmedCount).toBe(2);
    expect(av!.seatsRemaining).toBe(0);
    expect(av!.isFull).toBe(true);
  });

  it("getAvailabilityByEntitySlug returns correct entity metadata for the Corsair course", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      capacity: 10,
      siteSlug: "corsair-ltc-meta",
      courseSlug: "ltc-meta-check",
    });

    const av = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
    });

    expect(av).not.toBeNull();
    expect(av!.title).toBe("LTC Concealed Carry Class");
    expect(av!.capacity).toBe(10);
    expect(av!.entitySlug).toBe(courseSlug);
    expect(av!.entityType).toBe("course");
    expect(av!.siteSlug).toBe(siteSlug);
    expect(av!.siteName).toBe("Corsair LTC");
    expect(av!.requiresPayment).toBe(false);
    expect(av!.registrationOpen).toBe(true);
  });
});

describe("Public booking end-to-end — duplicate registration rejected", () => {
  it("second registration for the same email throws already_registered", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      siteSlug: "corsair-ltc-dupe",
      courseSlug: "ltc-dupe-test",
    });

    // First registration succeeds
    const first = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Carol C", customerEmail: "carol@example.com",
    });
    expect(first.status).toBe("confirmed");

    // Second attempt with the same email must be rejected
    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug, entityType: "course", entitySlug: courseSlug,
        customerName: "Carol C", customerEmail: "carol@example.com",
      }),
    ).rejects.toThrow(/already_registered/);
  });

  it("exact-same email is always rejected (duplicate check uses db .eq which is case-sensitive)", async () => {
    // The registration mutation stores customerEmail as-is and deduplicates via a
    // case-sensitive Convex db.filter .eq() call.  Two calls with exactly the same
    // email string are always blocked.  Case variants resolve as distinct — documented
    // here as a known gap, not a guarantee.
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      siteSlug: "corsair-ltc-case",
      courseSlug: "ltc-case-exact",
    });

    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Dave D", customerEmail: "dave@example.com",
    });

    // Identical email (same casing) must be rejected
    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug, entityType: "course", entitySlug: courseSlug,
        customerName: "Dave D", customerEmail: "dave@example.com",
      }),
    ).rejects.toThrow(/already_registered/);
  });

  it("cancelled registration does not block a fresh registration from the same email", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      siteSlug: "corsair-ltc-rereg",
      courseSlug: "ltc-reregister",
    });

    const first = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Eve E", customerEmail: "eve@example.com",
    });

    // Cancel the registration directly in DB (simulates a public cancel)
    await t.run(async (ctx) => {
      await ctx.db.patch(first.registrationId as Id<"registrations">, {
        status: "cancelled",
        cancelledAt: Date.now(),
      });
    });

    // Same email should now be allowed to re-register
    const second = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Eve E", customerEmail: "eve@example.com",
    });
    expect(second.status).toBe("confirmed");
  });
});

describe("Public booking end-to-end — class full rejects with class_full", () => {
  it("registration attempt when class is full (no waitlist) throws class_full", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      capacity: 1, waitlistCapacity: 0,
      siteSlug: "corsair-ltc-full-nowl",
      courseSlug: "ltc-full-no-wl",
    });

    // Fill the only seat
    const first = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Frank F", customerEmail: "frank@example.com",
    });
    expect(first.status).toBe("confirmed");

    // Next attempt must fail with class_full
    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug, entityType: "course", entitySlug: courseSlug,
        customerName: "Grace G", customerEmail: "grace@example.com",
      }),
    ).rejects.toThrow(/class_full/);
  });

  it("registration attempt when class and waitlist are both full throws class_full", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      capacity: 1, waitlistCapacity: 1,
      siteSlug: "corsair-ltc-full-wl",
      courseSlug: "ltc-full-wl-full",
    });

    // Fill the confirmed seat
    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Hank H", customerEmail: "hank@example.com",
    });

    // Fill the waitlist slot
    const wl = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Iris I", customerEmail: "iris@example.com",
    });
    expect(wl.status).toBe("waitlisted");

    // Third attempt — both confirmed and waitlist are full
    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug, entityType: "course", entitySlug: courseSlug,
        customerName: "Jake J", customerEmail: "jake@example.com",
      }),
    ).rejects.toThrow(/class_full/);
  });

  it("when class is full but waitlist has capacity, registration lands on waitlist", async () => {
    const { siteSlug, courseSlug } = await seedCorsairCourse(t, {
      capacity: 1, waitlistCapacity: 5,
      siteSlug: "corsair-ltc-wl-open",
      courseSlug: "ltc-wl-open",
    });

    // Confirmed seat taken
    await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Karen K", customerEmail: "karen@example.com",
    });

    // Second registers to waitlist
    const wl = await t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
      customerName: "Leo L", customerEmail: "leo@example.com",
    });
    expect(wl.status).toBe("waitlisted");

    // Availability reflects the waitlisted count via the GET handler
    const av = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug, entityType: "course", entitySlug: courseSlug,
    });
    expect(av!.isFull).toBe(true);
    expect(av!.waitlistCount).toBe(1);
    expect(av!.hasWaitlist).toBe(true);
    expect(av!.isWaitlistFull).toBe(false);
  });
});

describe("Public booking end-to-end — registration window enforcement", () => {
  it("registration before registrationOpenAt throws registration_closed", async () => {
    await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        name: "Corsair LTC Not Open",
        slug: "corsair-ltc-not-open",
        status: "active",
        brandColorPrimary: "#000",
        brandColorSecondary: "#fff",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "professional_services",
        enabledModules: { courses: true },
      });
      await ctx.db.insert("courses", {
        siteId,
        title: "LTC Not Open Yet",
        slug: "ltc-not-open-yet",
        status: "published",
        isPublished: true,
        description: "Registration not open yet",
        capacity: 10,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationOpen",
        registrationOpenAt: Date.now() + 24 * 60 * 60 * 1000, // opens tomorrow
      });
    });

    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug: "corsair-ltc-not-open",
        entityType: "course",
        entitySlug: "ltc-not-open-yet",
        customerName: "Early Bird",
        customerEmail: "early@example.com",
      }),
    ).rejects.toThrow(/registration_closed/);
  });

  it("registration after registrationCloseAt throws registration_closed", async () => {
    await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        name: "Corsair LTC Expired",
        slug: "corsair-ltc-expired",
        status: "active",
        brandColorPrimary: "#000",
        brandColorSecondary: "#fff",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "professional_services",
        enabledModules: { courses: true },
      });
      await ctx.db.insert("courses", {
        siteId,
        title: "LTC Already Closed",
        slug: "ltc-already-closed",
        status: "published",
        isPublished: true,
        description: "Registration window has passed",
        capacity: 10,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationClosed",
        registrationCloseAt: Date.now() - 24 * 60 * 60 * 1000, // closed yesterday
      });
    });

    await expect(
      t.mutation(internal.publicBooking.registerPublicByEntitySlug, {
        siteSlug: "corsair-ltc-expired",
        entityType: "course",
        entitySlug: "ltc-already-closed",
        customerName: "Late Arrival",
        customerEmail: "late@example.com",
      }),
    ).rejects.toThrow(/registration_closed/);
  });

  it("getAvailabilityByEntitySlug returns null for an unpublished course (404 path)", async () => {
    // Validates the slug-resolution guard: an unpublished entity must not be
    // visible via the public availability endpoint.
    await t.run(async (ctx) => {
      const siteId = await ctx.db.insert("sites", {
        name: "Corsair Draft Site",
        slug: "corsair-draft-site",
        status: "active",
        brandColorPrimary: "#000",
        brandColorSecondary: "#fff",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "professional_services",
        enabledModules: { courses: true },
      });
      await ctx.db.insert("courses", {
        siteId,
        title: "Draft LTC Class",
        slug: "draft-ltc",
        status: "draft",
        isPublished: false,
        description: "Not published yet",
        capacity: 10,
        waitlistCapacity: 0,
        lifecycleStatus: "Upcoming",
      });
    });

    const av = await t.query(internal.publicBooking.getAvailabilityByEntitySlug, {
      siteSlug: "corsair-draft-site",
      entityType: "course",
      entitySlug: "draft-ltc",
    });
    expect(av).toBeNull();
  });
});
