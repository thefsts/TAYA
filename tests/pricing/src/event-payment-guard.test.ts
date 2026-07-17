/**
 * Event payment guard tests
 *
 * Tests for the discriminated-union CorsairEvent model, the
 * validatePaidEventCourseReferences catalog validator, and the
 * create-order route's explicit slug/payability guards.
 *
 * All tests use fixture data — no production event arrays are mutated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validatePaidEventCourseReferences,
  getCatalog,
  type CatalogItem,
} from "@/lib/pricing";
import type {
  CorsairEvent,
  CorsairEventContact,
  CorsairEventOnline,
} from "@/data/events";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeContactEvent(overrides: Partial<CorsairEventContact> = {}): CorsairEventContact {
  return {
    id: "evt-contact",
    paymentMode: "contact",
    slug: "test-contact-event",
    title: "Contact Test Event",
    date: "2026-08-01",
    dateDisplay: "August 1, 2026",
    time: "9:00 AM CT",
    location: "Dallas, TX",
    category: "Firearms Training",
    shortDescription: "A contact-only test event",
    description: "A contact-only test event with no online payment.",
    heroImage: "/images/test.jpg",
    ...overrides,
  };
}

function makeOnlineEvent(courseSlug: string, overrides: Partial<CorsairEventOnline> = {}): CorsairEventOnline {
  return {
    id: "evt-online",
    paymentMode: "online",
    slug: "test-online-event",
    title: "Online Payment Test Event",
    date: "2026-08-01",
    dateDisplay: "August 1, 2026",
    time: "9:00 AM CT",
    location: "Dallas, TX",
    category: "Firearms Training",
    shortDescription: "An online-payment test event",
    description: "An online-payment test event wired to a course.",
    heroImage: "/images/test.jpg",
    courseSlug,
    ...overrides,
  };
}

function makePayableCatalogItem(slug: string): CatalogItem {
  return {
    id: `course_${slug}`,
    slug,
    name: "Test Payable Course",
    type: "course",
    category: "Training",
    description: "A payable test course",
    priceCents: 7500,
    basePriceCents: 7500,
    currency: "USD",
    variations: [{ id: "opt-standard", name: "Standard", priceCents: 7500 }],
    requiredFees: [],
    optionalAddOns: [],
    active: true,
    contactOnly: false,
  };
}

function makeContactOnlyCatalogItem(slug: string): CatalogItem {
  return {
    id: `course_${slug}`,
    slug,
    name: "Test Contact-Only Course",
    type: "course",
    category: "Training",
    description: "A contact-only test course",
    priceCents: null,
    basePriceCents: null,
    currency: "USD",
    variations: [],
    requiredFees: [],
    optionalAddOns: [],
    active: true,
    contactOnly: true,
  };
}

// ── 1. validatePaidEventCourseReferences — contact-only events skipped ────────

describe("validatePaidEventCourseReferences — contact-only events are skipped", () => {
  it("returns an empty array when all events are contact-only (no online events)", () => {
    const events: CorsairEvent[] = [
      makeContactEvent({ id: "evt-a", slug: "event-a" }),
      makeContactEvent({ id: "evt-b", slug: "event-b" }),
    ];
    const catalog: CatalogItem[] = [];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(0);
  });

  it("ignores contact-only events even when a catalog is provided", () => {
    const events: CorsairEvent[] = [
      makeContactEvent({ id: "evt-c", slug: "event-c" }),
    ];
    const catalog: CatalogItem[] = [makePayableCatalogItem("ar-15-rifle-course")];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(0);
  });
});

// ── 2. validatePaidEventCourseReferences — online event, missing slug ─────────
//
// TypeScript discriminated union makes courseSlug: string required on
// CorsairEventOnline. An empty string is the runtime-reachable edge case.

describe("validatePaidEventCourseReferences — online event with empty slug", () => {
  it("returns valid:false with reason missing-course-slug for an empty courseSlug", () => {
    const events: CorsairEvent[] = [
      makeOnlineEvent(""),
    ];
    const catalog: CatalogItem[] = [makePayableCatalogItem("ar-15-rifle-course")];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("missing-course-slug");
      expect(results[0].eventId).toBe("evt-online");
    }
  });

  it("returns valid:false with reason missing-course-slug for a whitespace-only courseSlug", () => {
    const events: CorsairEvent[] = [
      makeOnlineEvent("   "),
    ];
    const catalog: CatalogItem[] = [];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("missing-course-slug");
    }
  });
});

// ── 3. validatePaidEventCourseReferences — online event, typo slug ────────────

describe("validatePaidEventCourseReferences — online event with unknown slug", () => {
  it("returns valid:false with reason unknown-course-slug for a mistyped AR-15 slug", () => {
    const events: CorsairEvent[] = [
      makeOnlineEvent("ar-15-rifl-course"),
    ];
    const catalog: CatalogItem[] = [makePayableCatalogItem("ar-15-rifle-course")];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("unknown-course-slug");
      expect(results[0].courseSlug).toBe("ar-15-rifl-course");
    }
  });

  it("returns valid:false with reason unknown-course-slug for a completely invented slug", () => {
    const events: CorsairEvent[] = [
      makeOnlineEvent("slug-that-does-not-exist-xyz"),
    ];
    const catalog: CatalogItem[] = [makePayableCatalogItem("ar-15-rifle-course")];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("unknown-course-slug");
    }
  });
});

// ── 4. validatePaidEventCourseReferences — online event, non-payable course ───

describe("validatePaidEventCourseReferences — online event pointing to non-payable course", () => {
  it("returns valid:false with reason course-not-payable for a contact-only catalog item", () => {
    const events: CorsairEvent[] = [
      makeOnlineEvent("armed-security-services"),
    ];
    const catalog: CatalogItem[] = [makeContactOnlyCatalogItem("armed-security-services")];
    const results = validatePaidEventCourseReferences(events, catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("course-not-payable");
      expect(results[0].courseSlug).toBe("armed-security-services");
    }
  });

  it("returns valid:false with reason course-not-payable for a catalog item with no variations", () => {
    const noVariationItem: CatalogItem = {
      ...makePayableCatalogItem("no-price-course"),
      priceCents: null,
      basePriceCents: null,
      variations: [],
      contactOnly: false,
    };
    const events: CorsairEvent[] = [
      makeOnlineEvent("no-price-course"),
    ];
    const results = validatePaidEventCourseReferences(events, [noVariationItem]);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    if (!results[0].valid) {
      expect(results[0].reason).toBe("course-not-payable");
    }
  });
});

// ── 5. validatePaidEventCourseReferences — valid payable slugs ────────────────

describe("validatePaidEventCourseReferences — valid online events pass", () => {
  it("returns valid:true for an online event wired to ar-15-rifle-course in the live catalog", () => {
    const liveCatalog = getCatalog();
    const events: CorsairEvent[] = [
      makeOnlineEvent("ar-15-rifle-course", { id: "evt-ar15", title: "AR-15 Shoot Day" }),
    ];
    const results = validatePaidEventCourseReferences(events, liveCatalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
    expect(results[0].eventId).toBe("evt-ar15");
    expect(results[0].eventTitle).toBe("AR-15 Shoot Day");
  });

  it("returns valid:true for an online event wired to shotgun-course in the live catalog", () => {
    const liveCatalog = getCatalog();
    const events: CorsairEvent[] = [
      makeOnlineEvent("shotgun-course", { id: "evt-sg", title: "Shotgun Shoot Day" }),
    ];
    const results = validatePaidEventCourseReferences(events, liveCatalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
  });

  it("handles a mixed array: contact-only event is skipped, online event with valid slug returns valid:true", () => {
    const liveCatalog = getCatalog();
    const events: CorsairEvent[] = [
      makeContactEvent({ id: "evt-contact-1", slug: "some-contact-event" }),
      makeOnlineEvent("ar-15-rifle-course", { id: "evt-online-1", slug: "ar15-shoot-day" }),
    ];
    const results = validatePaidEventCourseReferences(events, liveCatalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
    expect(results[0].eventId).toBe("evt-online-1");
  });

  it("returns multiple results when multiple online events are present", () => {
    const liveCatalog = getCatalog();
    const events: CorsairEvent[] = [
      makeOnlineEvent("ar-15-rifle-course", { id: "evt-1", slug: "evt-slug-1" }),
      makeOnlineEvent("shotgun-course", { id: "evt-2", slug: "evt-slug-2" }),
    ];
    const results = validatePaidEventCourseReferences(events, liveCatalog);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.valid)).toBe(true);
  });
});

// ── 6. Route guard — distinct 400 codes for unknown/non-payable slug ──────────

vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => "test-key"),
  squareFetch: vi.fn(),
}));

import { squareFetch, isSquareConfigured } from "@/lib/square";
import { POST } from "@/app/api/square/create-order/route";

describe("POST /api/square/create-order — route guards: unknown and non-payable slug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns HTTP 400 with code UNKNOWN_COURSE_SLUG for a slug not in the catalog", async () => {
    const response = await POST(makeRequest({
      courseSlug: "totally-bogus-slug-xyz",
      pricingOptionId: "some-option",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe("UNKNOWN_COURSE_SLUG");
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 with code UNKNOWN_COURSE_SLUG for a mistyped AR-15 slug", async () => {
    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifl-course",
      pricingOptionId: "ar15-base",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe("UNKNOWN_COURSE_SLUG");
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when missing courseSlug — Square is never called", async () => {
    const response = await POST(makeRequest({
      courseSlug: "",
      pricingOptionId: "some-option",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 with code COURSE_NOT_PAYABLE for an event slug (contact-only)", async () => {
    const response = await POST(makeRequest({
      courseSlug: "texas-ltc-certification-class-jun2026",
      pricingOptionId: "some-option",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe("COURSE_NOT_PAYABLE");
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 with code COURSE_NOT_PAYABLE for a service slug (contact-only)", async () => {
    const response = await POST(makeRequest({
      courseSlug: "armed-security-services",
      pricingOptionId: "some-option",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe("COURSE_NOT_PAYABLE");
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("Square is never called for any slug guard failure", async () => {
    const badSlugs = [
      { courseSlug: "totally-fake-slug", pricingOptionId: "opt-a", addOnIds: [] },
      { courseSlug: "armed-security-services", pricingOptionId: "opt-b", addOnIds: [] },
    ];

    for (const body of badSlugs) {
      vi.clearAllMocks();
      await POST(makeRequest(body));
      expect(
        vi.mocked(squareFetch),
        `squareFetch must not be called for slug "${body.courseSlug}"`
      ).not.toHaveBeenCalled();
    }
  });
});
