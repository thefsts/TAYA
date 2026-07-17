/**
 * Integration tests: Defensive Shooting Skills — pricing correctness
 *
 * Verifies that the base price fix ($50 → $150) is correctly reflected in:
 *   1. The course catalog entry (price badge, pricingOptions)
 *   2. resolveCoursePayment — server-side total calculation
 *   3. The Square create-order route — totalCents passed to Square
 *
 * These are pure unit/integration tests; no live Square API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. Course catalog ──────────────────────────────────────────────────────

import { getCourseBySlug } from "@/lib/courses";

describe("defensive-shooting-skills — course catalog entry", () => {
  const course = getCourseBySlug("defensive-shooting-skills");

  it("exists in the course catalog", () => {
    expect(course).toBeDefined();
  });

  it('displays "From $150" as the price badge', () => {
    expect(course!.price).toBe("From $150");
  });

  it("has exactly one pricing option (Standard Course at $150)", () => {
    expect(course!.pricingOptions).toHaveLength(1);
    const option = course!.pricingOptions[0];
    expect(option.id).toBe("dss-standard");
    expect(option.name).toBe("Standard Course");
    expect(option.price).toBe(150);
  });

  it("does NOT offer an Advanced Package option", () => {
    const names = (course!.pricingOptions ?? []).map((o) => o.name);
    expect(names).not.toContain("Advanced Package");
  });

  it("has a required range fee of $25", () => {
    const rangeFee = (course!.requiredFees ?? []).find((f) => f.id === "range-fee");
    expect(rangeFee).toBeDefined();
    expect(rangeFee!.price).toBe(25);
  });
});

// ── 2. resolveCoursePayment — server-side total ────────────────────────────

import { resolveCoursePayment } from "@/lib/pricing";

describe("resolveCoursePayment — defensive-shooting-skills", () => {
  it("resolves successfully for the standard option", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    expect(result).not.toBeNull();
  });

  it("returns baseCents = 15000 (i.e. $150.00)", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    expect(result!.baseCents).toBe(15_000);
  });

  it("returns requiredFeesCents = 2500 (range fee $25)", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    expect(result!.requiredFeesCents).toBe(2_500);
  });

  it("returns totalCents = 17500 ($150 base + $25 range fee) with no add-ons", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    expect(result!.totalCents).toBe(17_500);
  });

  it("returns optionName = 'Standard Course'", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    expect(result!.optionName).toBe("Standard Course");
  });

  it("includes the base course as the first line item at 15000 cents", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    const base = result!.lineItems.find((li) => li.kind === "course");
    expect(base).toBeDefined();
    expect(base!.priceCents).toBe(15_000);
  });

  it("includes the range fee as a locked line item at 2500 cents", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    const fee = result!.lineItems.find((li) => li.kind === "fee");
    expect(fee).toBeDefined();
    expect(fee!.priceCents).toBe(2_500);
  });

  it("adds ammo package when selected (totalCents = 18900)", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", ["ammo-package"]);
    expect(result!.totalCents).toBe(18_900);
    expect(result!.appliedOptionalAddonIds).toContain("ammo-package");
  });

  it("adds gun rental when selected (totalCents = 18799)", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-standard", ["firearm-rental"]);
    expect(result!.totalCents).toBe(Math.round((150 + 25 + 12.99) * 100));
    expect(result!.appliedOptionalAddonIds).toContain("firearm-rental");
  });

  it("returns null for a non-existent pricing option", () => {
    const result = resolveCoursePayment("defensive-shooting-skills", "dss-advanced", []);
    expect(result).toBeNull();
  });

  it("returns null for an unknown add-on id (strict rejection)", () => {
    const withBogus = resolveCoursePayment("defensive-shooting-skills", "dss-standard", ["fake-addon-id"]);
    expect(withBogus).toBeNull();
  });
});

// ── 3. Square create-order route — mock integration ───────────────────────
//
// next/server resolves from corsair-source/node_modules so the real
// NextResponse (a subclass of the fetch Response) is used. We read the body
// with response.json() and check the HTTP status via response.status.

vi.mock("@/lib/square", () => ({
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => "test-idempotency-key"),
  squareFetch: vi.fn(),
}));

import { squareFetch, isSquareConfigured } from "@/lib/square";
import { POST } from "@/app/api/square/create-order/route";

describe("POST /api/square/create-order — defensive-shooting-skills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return {
      json: async () => body,
    } as unknown as Request;
  }

  it("returns totalCents = 17500 and success=true in the JSON response", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_test_123", total_money: { amount: 17_500 } } }),
    } as unknown as Response);

    const req = makeRequest({
      courseSlug: "defensive-shooting-skills",
      pricingOptionId: "dss-standard",
      addOnIds: [],
    });

    const response = await POST(req);
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(17_500);
    expect(body.orderId).toBe("ord_test_123");
  });

  it("passes two line items to Square: base course ($150) and range fee ($25)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    vi.mocked(squareFetch).mockImplementation(async (_path, opts) => {
      capturedPayload = JSON.parse((opts as RequestInit).body as string);
      return {
        ok: true,
        json: async () => ({ order: { id: "ord_test_456" } }),
      } as unknown as Response;
    });

    const req = makeRequest({
      courseSlug: "defensive-shooting-skills",
      pricingOptionId: "dss-standard",
      addOnIds: [],
    });

    await POST(req);

    expect(capturedPayload).not.toBeNull();
    const lineItems = (capturedPayload!.order as { line_items: Array<{ base_price_money: { amount: number } }> }).line_items;
    expect(lineItems).toHaveLength(2);

    const amounts = lineItems.map((li) => li.base_price_money.amount);
    expect(amounts).toContain(15_000);
    expect(amounts).toContain(2_500);
  });

  it("rejects an unknown pricingOptionId with HTTP 400", async () => {
    const req = makeRequest({
      courseSlug: "defensive-shooting-skills",
      pricingOptionId: "dss-advanced",
      addOnIds: [],
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 503 when Square is not configured", async () => {
    vi.mocked(isSquareConfigured).mockReturnValue(false);

    const req = makeRequest({
      courseSlug: "defensive-shooting-skills",
      pricingOptionId: "dss-standard",
      addOnIds: [],
    });

    const response = await POST(req);
    expect(response.status).toBe(503);
  });
});

// ── 4. texas-ltc-wichita — Square mock integration ────────────────────────
//
// Base: $125 + range fee $25 = $150 (15 000 cents)
// Optional add-ons: ammo-package ($14), firearm-rental ($12.99)

describe("POST /api/square/create-order — texas-ltc-wichita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns totalCents = 15000 and success=true (base $125 + range fee $25)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_ltc_001", total_money: { amount: 15_000 } } }),
    } as unknown as Response);

    const req = makeRequest({
      courseSlug: "texas-ltc-wichita",
      pricingOptionId: "ltc-wichita",
      addOnIds: [],
    });

    const response = await POST(req);
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(15_000);
    expect(body.orderId).toBe("ord_ltc_001");
  });

  it("passes two line items to Square: base course ($125 = 12500 cents) and range fee ($25 = 2500 cents)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    vi.mocked(squareFetch).mockImplementation(async (_path, opts) => {
      capturedPayload = JSON.parse((opts as RequestInit).body as string);
      return {
        ok: true,
        json: async () => ({ order: { id: "ord_ltc_002" } }),
      } as unknown as Response;
    });

    await POST(makeRequest({
      courseSlug: "texas-ltc-wichita",
      pricingOptionId: "ltc-wichita",
      addOnIds: [],
    }));

    expect(capturedPayload).not.toBeNull();
    const lineItems = (capturedPayload!.order as { line_items: Array<{ base_price_money: { amount: number } }> }).line_items;
    expect(lineItems).toHaveLength(2);

    const amounts = lineItems.map((li) => li.base_price_money.amount);
    expect(amounts).toContain(12_500);
    expect(amounts).toContain(2_500);
  });

  it("adds ammo-package add-on correctly (totalCents = 15000 + 1400 = 16400)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_ltc_003" } }),
    } as unknown as Response);

    const req = makeRequest({
      courseSlug: "texas-ltc-wichita",
      pricingOptionId: "ltc-wichita",
      addOnIds: ["ammo-package"],
    });

    const response = await POST(req);
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(16_400);
  });

  it("rejects an unknown pricingOptionId with HTTP 400", async () => {
    const response = await POST(makeRequest({
      courseSlug: "texas-ltc-wichita",
      pricingOptionId: "ltc-bogus",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });
});

// ── 5. basic-handgun-skills-training — Square mock integration ────────────
//
// Option 1 (bh-1session): $75 + range fee $25 = $100 (10 000 cents)
// Option 2 (bh-3session): $210 + range fee $25 = $235 (23 500 cents)
// Optional add-ons: firearm-rental ($12.99), ammo-package ($14)

describe("POST /api/square/create-order — basic-handgun-skills-training", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns totalCents = 10000 for the 1-session option ($75 + $25 range fee)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_bh_001" } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "basic-handgun-skills-training",
      pricingOptionId: "bh-1session",
      addOnIds: [],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(10_000);
  });

  it("returns totalCents = 23500 for the 3-session pack ($210 + $25 range fee)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_bh_002" } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "basic-handgun-skills-training",
      pricingOptionId: "bh-3session",
      addOnIds: [],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(23_500);
  });

  it("passes two line items to Square for 1-session: base (7500 cents) and range fee (2500 cents)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    vi.mocked(squareFetch).mockImplementation(async (_path, opts) => {
      capturedPayload = JSON.parse((opts as RequestInit).body as string);
      return {
        ok: true,
        json: async () => ({ order: { id: "ord_bh_003" } }),
      } as unknown as Response;
    });

    await POST(makeRequest({
      courseSlug: "basic-handgun-skills-training",
      pricingOptionId: "bh-1session",
      addOnIds: [],
    }));

    expect(capturedPayload).not.toBeNull();
    const lineItems = (capturedPayload!.order as { line_items: Array<{ base_price_money: { amount: number } }> }).line_items;
    expect(lineItems).toHaveLength(2);

    const amounts = lineItems.map((li) => li.base_price_money.amount);
    expect(amounts).toContain(7_500);
    expect(amounts).toContain(2_500);
  });

  it("adds firearm-rental add-on correctly (totalCents = 10000 + 1299 = 11299)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_bh_004" } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "basic-handgun-skills-training",
      pricingOptionId: "bh-1session",
      addOnIds: ["firearm-rental"],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(Math.round((75 + 25 + 12.99) * 100));
  });

  it("rejects an unknown pricingOptionId with HTTP 400", async () => {
    const response = await POST(makeRequest({
      courseSlug: "basic-handgun-skills-training",
      pricingOptionId: "bh-bogus",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });
});

// ── 6. armed-first-responder — Square mock integration ────────────────────
//
// Base: $595 + range fee $25 = $620 (62 000 cents)
// Optional add-ons: ammo-package ($80)

describe("POST /api/square/create-order — armed-first-responder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns totalCents = 62000 and success=true (base $595 + range fee $25)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_afr_001", total_money: { amount: 62_000 } } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "armed-first-responder",
      pricingOptionId: "afr-cert",
      addOnIds: [],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(62_000);
    expect(body.orderId).toBe("ord_afr_001");
  });

  it("passes two line items to Square: base course (59500 cents) and range fee (2500 cents)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    vi.mocked(squareFetch).mockImplementation(async (_path, opts) => {
      capturedPayload = JSON.parse((opts as RequestInit).body as string);
      return {
        ok: true,
        json: async () => ({ order: { id: "ord_afr_002" } }),
      } as unknown as Response;
    });

    await POST(makeRequest({
      courseSlug: "armed-first-responder",
      pricingOptionId: "afr-cert",
      addOnIds: [],
    }));

    expect(capturedPayload).not.toBeNull();
    const lineItems = (capturedPayload!.order as { line_items: Array<{ base_price_money: { amount: number } }> }).line_items;
    expect(lineItems).toHaveLength(2);

    const amounts = lineItems.map((li) => li.base_price_money.amount);
    expect(amounts).toContain(59_500);
    expect(amounts).toContain(2_500);
  });

  it("adds ammo-package add-on correctly (totalCents = 62000 + 8000 = 70000)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_afr_003" } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "armed-first-responder",
      pricingOptionId: "afr-cert",
      addOnIds: ["ammo-package"],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(70_000);
  });

  it("rejects an unknown pricingOptionId with HTTP 400", async () => {
    const response = await POST(makeRequest({
      courseSlug: "armed-first-responder",
      pricingOptionId: "afr-bogus",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });
});

// ── 7. ar-15-rifle-course — Square mock integration ───────────────────────
//
// Base: $90 + required fees: range $25 + ammo $40 + rifle rental $35 = $190 (19 000 cents)
// ammo-package and ar15-rental are now required fees, not optional add-ons.
// No handgun add-ons apply to this course.

describe("POST /api/square/create-order — ar-15-rifle-course", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSquareConfigured).mockReturnValue(true);
    process.env.SQUARE_LOCATION_ID = "test-location";
  });

  function makeRequest(body: Record<string, unknown>): Request {
    return { json: async () => body } as unknown as Request;
  }

  it("returns totalCents = 19000 and success=true (base $90 + range $25 + ammo $40 + rental $35)", async () => {
    vi.mocked(squareFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ order: { id: "ord_ar15_001", total_money: { amount: 19_000 } } }),
    } as unknown as Response);

    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-base",
      addOnIds: [],
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.totalCents).toBe(19_000);
    expect(body.orderId).toBe("ord_ar15_001");
  });

  it("passes four line items to Square: base course (9000) + range fee (2500) + ammo (4000) + rental (3500)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    vi.mocked(squareFetch).mockImplementation(async (_path, opts) => {
      capturedPayload = JSON.parse((opts as RequestInit).body as string);
      return {
        ok: true,
        json: async () => ({ order: { id: "ord_ar15_002" } }),
      } as unknown as Response;
    });

    await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-base",
      addOnIds: [],
    }));

    expect(capturedPayload).not.toBeNull();
    const lineItems = (capturedPayload!.order as { line_items: Array<{ base_price_money: { amount: number } }> }).line_items;
    expect(lineItems).toHaveLength(4);

    const amounts = lineItems.map((li) => li.base_price_money.amount);
    expect(amounts).toContain(9_000);
    expect(amounts).toContain(2_500);
    expect(amounts).toContain(4_000);
    expect(amounts).toContain(3_500);
  });

  it("returns HTTP 400 when ammo-package is sent as add-on ID (it is now a required fee, not an add-on)", async () => {
    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-base",
      addOnIds: ["ammo-package"],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when ar15-rental is sent as add-on ID (it is now a required fee, not an add-on)", async () => {
    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-base",
      addOnIds: ["ar15-rental"],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when both former add-on IDs are sent (both are now required fees, not add-ons)", async () => {
    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-base",
      addOnIds: ["ammo-package", "ar15-rental"],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });

  it("rejects an unknown pricingOptionId with HTTP 400", async () => {
    const response = await POST(makeRequest({
      courseSlug: "ar-15-rifle-course",
      pricingOptionId: "ar15-bogus",
      addOnIds: [],
    }));

    expect(response.status).toBe(400);
    expect(vi.mocked(squareFetch)).not.toHaveBeenCalled();
  });
});
