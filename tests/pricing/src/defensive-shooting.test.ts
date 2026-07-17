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

  it("ignores an unknown add-on id (no price inflation)", () => {
    const baseline = resolveCoursePayment("defensive-shooting-skills", "dss-standard", []);
    const withBogus = resolveCoursePayment("defensive-shooting-skills", "dss-standard", ["fake-addon-id"]);
    expect(withBogus!.totalCents).toBe(baseline!.totalCents);
    expect(withBogus!.appliedOptionalAddonIds).not.toContain("fake-addon-id");
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
