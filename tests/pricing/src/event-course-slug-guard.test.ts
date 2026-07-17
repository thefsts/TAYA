/**
 * Guard tests: event courseSlug validation
 *
 * Events that are wired for online payment declare a courseSlug pointing to a
 * payable entry in the course catalog. A typo in that field causes
 * resolveCoursePayment to return null — silently charging $0 and failing the
 * booking. These tests ensure:
 *
 *   1. validateEventCourseSlug gives a clear error for every broken-slug case
 *      (missing, mistyped, contact-only, non-existent) — never a silent null.
 *   2. resolveCoursePayment returns null (not $0) for a mistyped slug.
 *   3. The POST /api/square/create-order route returns HTTP 400, not $0, when
 *      the courseSlug is invalid.
 *   4. The catalog-level guard getInvalidEventCourseSlugs() returns an empty
 *      array, confirming no currently-defined event has a broken courseSlug.
 *   5. When a paying event IS correctly wired (courseSlug = "ar-15-rifle-course"
 *      or "shotgun-course"), both validateEventCourseSlug and
 *      resolveCoursePayment succeed.
 *
 * Relevant source files:
 *   corsair-source/src/data/events.ts          — CorsairEvent.courseSlug field
 *   corsair-source/src/lib/pricing.ts          — validateEventCourseSlug,
 *                                                getInvalidEventCourseSlugs,
 *                                                resolveCoursePayment
 *   corsair-source/src/app/api/square/create-order/route.ts — HTTP guard
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateEventCourseSlug,
  getInvalidEventCourseSlugs,
  resolveCoursePayment,
} from "@/lib/pricing";

// ── 1. validateEventCourseSlug — clear errors for every broken-slug case ──────

describe("validateEventCourseSlug — invalid slug produces a clear error", () => {
  it("returns valid:false and a non-empty error for an empty string", () => {
    const result = validateEventCourseSlug("");
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("returns valid:false and a non-empty error for a whitespace-only string", () => {
    const result = validateEventCourseSlug("   ");
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("returns valid:false for a mistyped AR-15 slug (ar-15-rifl-course)", () => {
    const result = validateEventCourseSlug("ar-15-rifl-course");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ar-15-rifl-course/);
    expect(result.error).toMatch(/does not exist/i);
  });

  it("returns valid:false for a mistyped Shotgun slug (shotgun-corse)", () => {
    const result = validateEventCourseSlug("shotgun-corse");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/shotgun-corse/);
    expect(result.error).toMatch(/does not exist/i);
  });

  it("returns valid:false for an entirely invented slug", () => {
    const result = validateEventCourseSlug("this-slug-never-existed-xyz");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns valid:false for a contact-only event slug used as a courseSlug", () => {
    // Event slugs exist in the catalog but are contact-only — using one as a
    // courseSlug is another form of silent $0 bug.
    const result = validateEventCourseSlug("texas-ltc-certification-class-jun2026");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("error message is a non-empty string — never undefined or null — so the caller can surface it", () => {
    const badSlugs = [
      "",
      "   ",
      "ar-15-rifl-course",
      "shotgun-corse",
      "totally-bogus",
    ];
    for (const slug of badSlugs) {
      const result = validateEventCourseSlug(slug);
      expect(result.valid, `slug "${slug}" should be invalid`).toBe(false);
      expect(
        result.error,
        `slug "${slug}" should carry a non-empty error string`
      ).toBeTruthy();
    }
  });
});

// ── 2. validateEventCourseSlug — valid slugs succeed ─────────────────────────

describe("validateEventCourseSlug — valid payable slugs pass", () => {
  it("returns valid:true for ar-15-rifle-course", () => {
    const result = validateEventCourseSlug("ar-15-rifle-course");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid:true for shotgun-course", () => {
    const result = validateEventCourseSlug("shotgun-course");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid:true for defensive-shooting-skills", () => {
    const result = validateEventCourseSlug("defensive-shooting-skills");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ── 3. resolveCoursePayment — null (not $0) for a mistyped slug ───────────────
//
// This is the root-cause scenario: if resolveCoursePayment silently returned
// { totalCents: 0 } instead of null, a mistyped slug would charge $0.

describe("resolveCoursePayment — mistyped slug returns null, not $0", () => {
  it("returns null for a mistyped AR-15 slug", () => {
    const result = resolveCoursePayment("ar-15-rifl-course", "ar15-base", []);
    expect(result).toBeNull();
  });

  it("returns null for a mistyped Shotgun slug", () => {
    const result = resolveCoursePayment("shotgun-corse", "shotgun-base", []);
    expect(result).toBeNull();
  });

  it("returns null for a completely bogus slug", () => {
    const result = resolveCoursePayment("totally-bogus-slug", "any-option", []);
    expect(result).toBeNull();
  });

  it("does NOT return an object with totalCents === 0 for a mistyped slug", () => {
    const result = resolveCoursePayment("ar-15-rifl-course", "ar15-base", []);
    // The critical invariant: we never get a $0 charge, we get null.
    expect(result).not.toEqual(expect.objectContaining({ totalCents: 0 }));
  });
});

// ── 4. POST /api/square/create-order — HTTP 400 for mistyped slug ─────────────

vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => "test-key"),
  squareFetch: vi.fn(),
}));

import { squareFetch, isSquareConfigured } from "@/lib/square";
import { POST } from "@/app/api/square/create-order/route";

describe("POST /api/square/create-order — mistyped courseSlug returns HTTP 400, not $0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns HTTP 400 for a mistyped AR-15 slug (ar-15-rifl-course)", async () => {
    const response = await POST(
      makeRequest({
        courseSlug: "ar-15-rifl-course",
        pricingOptionId: "ar15-base",
        addOnIds: [],
      })
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 for a mistyped Shotgun slug (shotgun-corse)", async () => {
    const response = await POST(
      makeRequest({
        courseSlug: "shotgun-corse",
        pricingOptionId: "shotgun-base",
        addOnIds: [],
      })
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("error body is non-empty — not a silent empty response", async () => {
    const response = await POST(
      makeRequest({
        courseSlug: "ar-15-rifl-course",
        pricingOptionId: "ar15-base",
        addOnIds: [],
      })
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
    expect((body.error as string).length).toBeGreaterThan(0);
  });

  it("does NOT call Square when the slug is invalid (no $0 charge created)", async () => {
    await POST(
      makeRequest({
        courseSlug: "shotgun-corse",
        pricingOptionId: "shotgun-base",
        addOnIds: [],
      })
    );

    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });
});

// ── 5. Catalog-level guard — no currently-defined event has a broken slug ─────
//
// This test acts as a compile-time + runtime regression: whenever someone adds
// a new paying event or edits an existing courseSlug, this test will fail
// immediately (before code reaches production) if the slug is wrong.

describe("getInvalidEventCourseSlugs — catalog-level guard", () => {
  it("returns an empty array (no event has a broken courseSlug)", () => {
    const broken = getInvalidEventCourseSlugs();
    if (broken.length > 0) {
      const messages = broken
        .map((b) => `  event "${b.eventSlug}" → courseSlug "${b.courseSlug}": ${b.error}`)
        .join("\n");
      throw new Error(
        `Found ${broken.length} event(s) with invalid courseSlug reference(s):\n${messages}\n` +
          `Fix the courseSlug field in corsair-source/src/data/events.ts.`
      );
    }
    expect(broken).toHaveLength(0);
  });

  it("would catch a mistyped AR-15 slug if an event declared one", () => {
    // Simulate an event with a mistyped courseSlug by calling the validator directly.
    const result = validateEventCourseSlug("ar-15-rifl-course");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("ar-15-rifl-course");
  });

  it("would catch a mistyped Shotgun slug if an event declared one", () => {
    const result = validateEventCourseSlug("shotgun-corse");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("shotgun-corse");
  });
});
