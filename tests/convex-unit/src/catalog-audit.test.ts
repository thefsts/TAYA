/**
 * Catalog Audit Test Suite — Course & Event Pricing and Lifecycle
 *
 * Verifies the 10 required scenarios from the catalog audit task:
 *
 *   1. Numeric priceCents renders as formatted currency string
 *   2. Legacy string price is normalized before reaching the UI
 *   3. Missing price falls back to "Contact for pricing" or "Free" as appropriate
 *   4. Free course (priceCents = 0 or null) displays "Free"
 *   5. Invalid price value never reaches checkout — validated at mutation boundary
 *   6. Event with invalid/missing courseSlug flagged in admin dashboard query
 *   7. Sold-out class registration rejected at Convex mutation level
 *   8. Past event excluded from upcoming events public query
 *   9. Cancelled event not returned by any active-status query
 *  10. All 14 Corsair courses return valid price and slug data from the public API query
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { normalizePriceCents, assertValidPriceCents } from "../../../convex/lib/formatPrice";
import { formatPrice, parsePriceStringToCents } from "../../../artifacts/fsts-dashboard/src/lib/formatPrice";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Seed helpers ─────────────────────────────────────────────────────────────

function siteDoc(slug: string) {
  return {
    name: `Catalog Audit Site — ${slug}`,
    slug,
    status: "active",
    brandColorPrimary: "#000",
    brandColorSecondary: "#fff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: { courses: true, events: true },
  };
}

function userDoc(clerkUserId: string, siteId: Id<"sites">) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [{ siteId, role: "owner" }],
  };
}

let t: ReturnType<typeof convexTest>;
let siteId: Id<"sites">;
let siteSlug: string;

beforeEach(async () => {
  t = convexTest(schema, modules);
  siteSlug = `catalog-audit-${Date.now()}`;
  siteId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("sites", siteDoc(siteSlug));
    await ctx.db.insert("users", userDoc("audit-owner", id));
    return id;
  });
});

// ── 1. Numeric priceCents renders as formatted currency string ────────────────

describe("Scenario 1 — priceCents formats as currency string", () => {
  it("normalizePriceCents(number) returns rounded integer", () => {
    expect(normalizePriceCents(9900)).toBe(9900);
    expect(normalizePriceCents(99.7)).toBe(100); // rounds
    expect(normalizePriceCents(0)).toBe(0);
  });

  it("formatPrice(9900) returns '$99.00'", () => {
    expect(formatPrice(9900)).toBe("$99.00");
  });

  it("formatPrice(150) returns '$1.50'", () => {
    expect(formatPrice(150)).toBe("$1.50");
  });

  it("formatPrice returns the same value whether passed integer or float-rounded cents", () => {
    expect(formatPrice(normalizePriceCents(99.99))).toBe("$1.00"); // 99.99 cents → 100 → $1.00
    expect(formatPrice(normalizePriceCents(9999))).toBe("$99.99");
  });
});

// ── 2. Legacy string price normalized before reaching the UI ─────────────────

describe("Scenario 2 — legacy string price normalized at API boundary", () => {
  it("normalizePriceCents('$99.00') → 9900", () => {
    expect(normalizePriceCents("$99.00")).toBe(9900);
  });

  it("normalizePriceCents('99') → 9900", () => {
    expect(normalizePriceCents("99")).toBe(9900);
  });

  it("parsePriceStringToCents('$149.99') → 14999", () => {
    expect(parsePriceStringToCents("$149.99")).toBe(14999);
  });

  it("parsePriceStringToCents('Free') → null (no digits)", () => {
    expect(parsePriceStringToCents("Free")).toBeNull();
  });

  it("parsePriceStringToCents('') → null", () => {
    expect(parsePriceStringToCents("")).toBeNull();
  });

  it("getServicesBySlug returns priceCents derived from string price field", async () => {
    await t.run(async (ctx) => {
      await (ctx.db as any).insert("siteServices", {
        siteId,
        title: "Personal Training",
        slug: "personal-training",
        description: "One-on-one coaching",
        price: "$150.00",
        order: 0,
        isVisible: true,
      });
    });
    // Call via the HTTP handler's underlying query
    const result = await t.query(internal.public.getServicesBySlug, { slug: siteSlug });
    expect(result).toHaveLength(1);
    const svc = result[0] as any;
    expect(svc.price).toBe("$150.00");
    expect(svc.priceCents).toBe(15000);
  });
});

// ── 3. Missing price falls back to "Contact for pricing" ─────────────────────

describe("Scenario 3 — missing price has a safe fallback display", () => {
  it("formatPrice(null) → 'Contact for pricing'", () => {
    expect(formatPrice(null)).toBe("Contact for pricing");
  });

  it("formatPrice(undefined) → 'Contact for pricing'", () => {
    expect(formatPrice(undefined)).toBe("Contact for pricing");
  });

  it("normalizePriceCents(null) → null (caller renders fallback)", () => {
    expect(normalizePriceCents(null)).toBeNull();
  });

  it("normalizePriceCents(undefined) → null", () => {
    expect(normalizePriceCents(undefined)).toBeNull();
  });
});

// ── 4. Free course (priceCents = 0 or null) displays "Free" ─────────────────

describe("Scenario 4 — free course price displays correctly", () => {
  it("formatPrice(0) → 'Free'", () => {
    expect(formatPrice(0)).toBe("Free");
  });

  it("getCoursesBySlug returns null priceCents for a course with no price", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Free Intro Class",
        slug: "free-intro",
        status: "published",
        description: "No charge",
        isPublished: true,
      });
    });
    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    expect(results).toHaveLength(1);
    expect((results[0] as any).priceCents).toBeNull();
  });

  it("getCoursesBySlug returns 0 priceCents for a course explicitly priced at zero", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Free Workshop",
        slug: "free-workshop",
        status: "published",
        description: "Complimentary",
        priceCents: 0,
        isPublished: true,
      });
    });
    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    expect(results).toHaveLength(1);
    expect((results[0] as any).priceCents).toBe(0);
    expect(formatPrice((results[0] as any).priceCents)).toBe("Free");
  });
});

// ── 5. Invalid price never reaches checkout ──────────────────────────────────

describe("Scenario 5 — invalid price blocked at mutation boundary", () => {
  it("assertValidPriceCents throws for NaN", () => {
    expect(() => assertValidPriceCents(NaN, "course price")).toThrow(/Invalid course price/);
  });

  it("assertValidPriceCents throws for Infinity", () => {
    expect(() => assertValidPriceCents(Infinity, "course price")).toThrow(/Invalid course price/);
  });

  it("assertValidPriceCents throws for negative cents", () => {
    expect(() => assertValidPriceCents(-100, "course price")).toThrow(/negative/);
  });

  it("assertValidPriceCents passes for null (free / contact-for-pricing)", () => {
    expect(() => assertValidPriceCents(null)).not.toThrow();
  });

  it("assertValidPriceCents passes for a valid positive integer", () => {
    expect(() => assertValidPriceCents(9900)).not.toThrow();
  });

  it("assertValidPriceCents passes for 0 (free)", () => {
    expect(() => assertValidPriceCents(0)).not.toThrow();
  });

  it("normalizePriceCents(NaN) → null (safe coercion before any display)", () => {
    expect(normalizePriceCents(NaN)).toBeNull();
  });

  it("normalizePriceCents(Infinity) → null", () => {
    expect(normalizePriceCents(Infinity)).toBeNull();
  });
});

// ── 6. Orphaned courseSlug flagged in admin dashboard ────────────────────────

describe("Scenario 6 — orphaned courseSlug detected in admin query", () => {
  it("listOrphanedCourseSlug flags events referencing a non-existent course slug", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId,
        title: "Orphaned Event",
        slug: "orphaned-event",
        status: "published",
        description: "Links to a course that does not exist",
        startAt: Date.now() + 86400000,
        courseSlug: "nonexistent-course-slug",
        lifecycleStatus: "Scheduled",
        isPublished: true,
      });
    });

    const asOwner = t.withIdentity({ subject: "audit-owner" });
    const orphaned = await asOwner.query(api.events.listOrphanedCourseSlug, { siteId });
    expect(orphaned).toHaveLength(1);
    expect((orphaned[0] as any).courseSlug).toBe("nonexistent-course-slug");
  });

  it("listOrphanedCourseSlug does not flag events whose courseSlug matches a real course", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Linked Course",
        slug: "linked-course",
        status: "published",
        description: "The real course",
        isPublished: true,
      });
      await ctx.db.insert("events", {
        siteId,
        title: "Linked Event",
        slug: "linked-event",
        status: "published",
        description: "Links to a real course",
        startAt: Date.now() + 86400000,
        courseSlug: "linked-course",
        lifecycleStatus: "Scheduled",
        isPublished: true,
      });
    });

    const asOwner = t.withIdentity({ subject: "audit-owner" });
    const orphaned = await asOwner.query(api.events.listOrphanedCourseSlug, { siteId });
    expect(orphaned).toHaveLength(0);
  });

  it("listOrphanedCourseSlug ignores events with no courseSlug set", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId,
        title: "Normal Event",
        slug: "normal-event",
        status: "published",
        description: "No course link",
        startAt: Date.now() + 86400000,
        lifecycleStatus: "Scheduled",
        isPublished: true,
      });
    });

    const asOwner = t.withIdentity({ subject: "audit-owner" });
    const orphaned = await asOwner.query(api.events.listOrphanedCourseSlug, { siteId });
    expect(orphaned).toHaveLength(0);
  });
});

// ── 7. Sold-out class registration rejected at mutation level ────────────────

describe("Scenario 7 — sold-out class registration rejected", () => {
  it("registration is rejected with class_full when capacity is exhausted", async () => {
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId,
        title: "Full Class",
        slug: "full-class-audit",
        status: "published",
        description: "At capacity",
        capacity: 1,
        waitlistCapacity: 0,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const asOwner = t.withIdentity({ subject: "audit-owner" });

    // Fill the only seat
    await asOwner.mutation(api.registrations.register, {
      siteId,
      entityType: "course",
      entityId: courseId,
      userId: "first-user-audit",
    });

    // Second attempt must fail
    await expect(
      asOwner.mutation(api.registrations.register, {
        siteId,
        entityType: "course",
        entityId: courseId,
        userId: "second-user-audit",
      }),
    ).rejects.toThrow(/class_full/);
  });
});

// ── 8. Past event excluded from upcoming events public query ─────────────────

describe("Scenario 8 — past event excluded from upcoming query", () => {
  it("listUpcoming excludes Completed events", async () => {
    const pastStart = Date.now() - 120_000;
    const pastEnd   = Date.now() - 60_000;

    await t.run(async (ctx) => {
      const id = await ctx.db.insert("events", {
        siteId,
        title: "Past Event",
        slug: "past-event-audit",
        status: "published",
        description: "Already over",
        startAt: pastStart,
        startDateTime: pastStart,
        endDateTime: pastEnd,
        lifecycleStatus: "InProgress",
        isPublished: true,
      });
      // Drive lifecycle to Completed
      await ctx.db.patch(id, { lifecycleStatus: "Completed" });
    });

    const results = await t.query(api.events.listUpcoming, { siteSlug });
    expect(results.map((e: any) => e.slug)).not.toContain("past-event-audit");
  });

  it("getEventsBySlug (HTTP endpoint) excludes Completed events", async () => {
    const pastStart = Date.now() - 120_000;
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId,
        title: "HTTP Past Event",
        slug: "http-past-event",
        status: "published",
        description: "Already over",
        startAt: pastStart,
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const results = await t.query(internal.public.getEventsBySlug, { slug: siteSlug });
    expect(results.map((e: any) => e.slug)).not.toContain("http-past-event");
  });
});

// ── 9. Cancelled event excluded from active-status queries ───────────────────

describe("Scenario 9 — cancelled event excluded from active queries", () => {
  it("listUpcoming excludes Cancelled events", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId,
        title: "Cancelled Event",
        slug: "cancelled-event-audit",
        status: "published",
        description: "Was cancelled",
        startAt: Date.now() + 86400000,
        lifecycleStatus: "Cancelled",
        isPublished: true,
      });
    });

    const results = await t.query(api.events.listUpcoming, { siteSlug });
    expect(results.map((e: any) => e.slug)).not.toContain("cancelled-event-audit");
  });

  it("getEventsBySlug (HTTP endpoint) excludes Cancelled events", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("events", {
        siteId,
        title: "HTTP Cancelled Event",
        slug: "http-cancelled-event",
        status: "published",
        description: "Cancelled",
        startAt: Date.now() + 86400000,
        lifecycleStatus: "Cancelled",
        isPublished: true,
      });
    });

    const results = await t.query(internal.public.getEventsBySlug, { slug: siteSlug });
    expect(results.map((e: any) => e.slug)).not.toContain("http-cancelled-event");
  });

  it("getCoursesBySlug (HTTP endpoint) excludes Cancelled courses", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Cancelled Course",
        slug: "cancelled-course-audit",
        status: "published",
        description: "Cancelled",
        lifecycleStatus: "Cancelled",
        isPublished: true,
      });
    });

    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    expect(results.map((c: any) => c.slug)).not.toContain("cancelled-course-audit");
  });

  it("getCoursesBySlug (HTTP endpoint) excludes Archived courses", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Archived Course",
        slug: "archived-course-audit",
        status: "archived",
        description: "Archived",
        lifecycleStatus: "Archived",
      });
    });

    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    expect(results.map((c: any) => c.slug)).not.toContain("archived-course-audit");
  });
});

// ── 9b. Completed courses excluded from default public course feed ────────────

describe("Scenario 9b — completed courses excluded from getCoursesBySlug", () => {
  it("getCoursesBySlug excludes Completed courses", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Completed Course",
        slug: "completed-course-audit",
        status: "published",
        description: "Session is over",
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    expect(results.map((c: any) => c.slug)).not.toContain("completed-course-audit");
  });

  it("getCoursesBySlug still returns active (non-Completed, non-Cancelled) courses", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("courses", {
        siteId,
        title: "Active Course",
        slug: "active-course-audit",
        status: "published",
        description: "Still running",
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
      // Also seed a Completed one to confirm it stays out
      await ctx.db.insert("courses", {
        siteId,
        title: "Old Completed Course",
        slug: "old-completed-course-audit",
        status: "published",
        description: "Ended",
        lifecycleStatus: "Completed",
        isPublished: true,
      });
    });

    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });
    const slugs = results.map((c: any) => c.slug);
    expect(slugs).toContain("active-course-audit");
    expect(slugs).not.toContain("old-completed-course-audit");
  });
});

// ── 5b. Integer enforcement — non-integer priceCents rejected ─────────────────

describe("Scenario 5b — fractional priceCents rejected by assertValidPriceCents", () => {
  it("assertValidPriceCents throws for fractional cents (99.5)", () => {
    expect(() => assertValidPriceCents(99.5, "price")).toThrow(/not an integer/);
  });

  it("assertValidPriceCents throws for fractional cents (0.1)", () => {
    expect(() => assertValidPriceCents(0.1, "price")).toThrow(/not an integer/);
  });

  it("assertValidPriceCents passes for whole-number cents stored as a float (100.0)", () => {
    // 100.0 === 100 — Number.isInteger returns true
    expect(() => assertValidPriceCents(100.0, "price")).not.toThrow();
  });
});

// ── 5c. Price-clear: null priceCents in update unsets the stored value ────────

describe("Scenario 5c — null priceCents update clears the stored price", () => {
  it("events.update with null priceCents removes the price from the document", async () => {
    const asOwner = t.withIdentity({ subject: "audit-owner" });

    // Insert directly so we get a plain Id back (mutations return the full response object)
    const eventId = await t.run(async (ctx) => {
      return ctx.db.insert("events", {
        siteId,
        title: "Paid Event",
        slug: "paid-event-clear-test",
        status: "published",
        description: "Has a price",
        startAt: Date.now() + 86400000,
        priceCents: 9900,
        lifecycleStatus: "Scheduled",
        isPublished: true,
      });
    });

    // Verify price was stored
    const before = await t.run(async (ctx) => ctx.db.get(eventId));
    expect((before as any).priceCents).toBe(9900);

    // Clear the price via update with null
    await asOwner.mutation(api.events.update, {
      siteId,
      eventId,
      priceCents: null,
    });

    const after = await t.run(async (ctx) => ctx.db.get(eventId));
    // priceCents must be null (explicitly cleared) — not 9900
    expect((after as any).priceCents).toBeNull();
  });

  it("courses.update with null priceCents clears the stored price to null", async () => {
    const asOwner = t.withIdentity({ subject: "audit-owner" });

    // Insert directly so we get a plain Id back
    const courseId = await t.run(async (ctx) => {
      return ctx.db.insert("courses", {
        siteId,
        title: "Paid Course",
        slug: "paid-course-clear-test",
        status: "published",
        description: "Has a price",
        priceCents: 19900,
        lifecycleStatus: "RegistrationOpen",
        isPublished: true,
      });
    });

    const before = await t.run(async (ctx) => ctx.db.get(courseId));
    expect((before as any).priceCents).toBe(19900);

    await asOwner.mutation(api.courses.update, {
      siteId,
      courseId,
      priceCents: null,
    });

    const after = await t.run(async (ctx) => ctx.db.get(courseId));
    // priceCents must be null (explicitly cleared) — not 19900
    expect((after as any).priceCents).toBeNull();
  });

  it("events.create rejects a fractional priceCents via mutation", async () => {
    const asOwner = t.withIdentity({ subject: "audit-owner" });
    await expect(
      asOwner.mutation(api.events.create, {
        siteId,
        title: "Fractional Price Event",
        slug: "fractional-price-event",
        status: "draft",
        description: "Bad price",
        startAt: new Date(Date.now() + 86400000).toISOString(),
        priceCents: 99.5 as any,
      }),
    ).rejects.toThrow(/not an integer/);
  });

  it("courses.create rejects a negative priceCents via mutation", async () => {
    const asOwner = t.withIdentity({ subject: "audit-owner" });
    await expect(
      asOwner.mutation(api.courses.create, {
        siteId,
        title: "Negative Price Course",
        slug: "negative-price-course",
        status: "draft",
        description: "Bad price",
        priceCents: -500 as any,
      }),
    ).rejects.toThrow(/negative price/);
  });
});

// ── 10. Corsair Tactical catalog: all 6 seeded courses return valid data ───────

describe("Scenario 10 — Corsair Tactical catalog returns valid price and slug data", () => {
  /**
   * These courses mirror the real Corsair Tactical seed in `convex/seedCorsair.ts`
   * (function: seedCorsairCourses). Titles, slugs, and priceCents must stay in
   * sync with that seed file; update here if the seed changes.
   *
   * priceCents: null means the course is contact-for-pricing (no stored price).
   */
  const CORSAIR_COURSES: { title: string; slug: string; priceCents: number | null }[] = [
    {
      title: "Texas License to Carry (LTC)",
      slug: "texas-ltc-certification-basic-handgun",
      priceCents: 10000,
    },
    {
      title: "Level II Unarmed Security Officer Training",
      slug: "level-2-security-training",
      priceCents: 6500,
    },
    {
      title: "Level III Armed Security Officer Training",
      slug: "level-3-security-training",
      priceCents: 13000,
    },
    {
      title: "Level IV Personal Protection Officer (PPO) Training",
      slug: "level-4-ppo-training",
      priceCents: 22500,
    },
    {
      title: "Level III + IV Complete Package",
      slug: "level-3-4-security-bundle",
      priceCents: 40000,
    },
    {
      title: "Basic Handgun & Private Instruction",
      slug: "basic-handgun-private-instruction",
      priceCents: null, // contact-for-pricing — intentionally no stored price
    },
  ];

  it("all Corsair courses return a valid slug and priceCents (number | null, never NaN)", async () => {
    await t.run(async (ctx) => {
      for (const c of CORSAIR_COURSES) {
        await ctx.db.insert("courses", {
          siteId,
          title: c.title,
          slug: c.slug,
          status: "published",
          description: `Description for ${c.title}`,
          ...(c.priceCents !== null ? { priceCents: c.priceCents } : {}),
          isPublished: true,
        });
      }
    });

    const results = await t.query(internal.public.getCoursesBySlug, { slug: siteSlug });

    // All 6 must be returned (none cancelled/archived/completed, all published)
    expect(results).toHaveLength(CORSAIR_COURSES.length);

    for (const course of results as any[]) {
      // Slug must be a non-empty string
      expect(typeof course.slug).toBe("string");
      expect(course.slug.length).toBeGreaterThan(0);

      // priceCents must be a finite number OR null — never NaN, undefined, or string
      const pc = course.priceCents;
      if (pc !== null) {
        expect(typeof pc).toBe("number");
        expect(isFinite(pc)).toBe(true);
        expect(isNaN(pc)).toBe(false);
        // Format must produce a valid display string (no "$NaN", "$undefined")
        const formatted = formatPrice(pc);
        expect(formatted).not.toContain("NaN");
        expect(formatted).not.toContain("undefined");
        expect(formatted).not.toContain("null");
      }
    }

    // Verify each known Corsair slug returned the expected priceCents
    const bySlugs = new Map((results as any[]).map((c) => [c.slug, c]));
    for (const expected of CORSAIR_COURSES) {
      const returned = bySlugs.get(expected.slug);
      expect(returned, `slug '${expected.slug}' was not returned by getCoursesBySlug`).toBeDefined();
      if (expected.priceCents !== null) {
        expect((returned as any).priceCents).toBe(expected.priceCents);
      } else {
        // Contact-for-pricing: API must return null (not NaN, undefined, or a string)
        expect((returned as any).priceCents ?? null).toBeNull();
      }
    }
  });
});
