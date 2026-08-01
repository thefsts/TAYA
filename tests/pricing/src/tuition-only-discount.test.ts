/**
 * tuitionOnly discount enforcement tests — Task #328
 *
 * Confirms that promo codes marked tuitionOnly=true compute their discount
 * against the tuition-only portion of the order, NOT the full subtotal that
 * includes required fees (e.g. the $25 range fee).
 *
 * Course under test: texas-ltc-certification-basic-handgun / ltc-bh-combo
 *   Tuition:   $100.00 = 10 000 cents per seat
 *   Range fee: $ 25.00 =  2 500 cents per seat  (required, not discountable)
 *   Full total: $125.00 = 12 500 cents per seat
 *
 * Two codes exercised:
 *   GROUPDISCOUNT5  5 %  minAttendees=5  tuitionOnly=true
 *   FAMILY001      10 %  minAttendees=2  tuitionOnly=true
 *
 * No network calls, no environment variable dependencies.
 */

import { describe, it, expect } from 'vitest';
import { computePromoDiscount, type PromoRule } from '@/lib/promo';

// ── Course pricing constants ──────────────────────────────────────────────────

/** Tuition portion per seat (excludes range fee). */
const TUITION_PER_SEAT = 10_000; // $100.00

/** Required range fee per seat — must NOT be discounted by tuitionOnly codes. */
const RANGE_FEE_PER_SEAT = 2_500; // $25.00

/** Full per-seat price (tuition + range fee). */
const FULL_PER_SEAT = TUITION_PER_SEAT + RANGE_FEE_PER_SEAT; // $125.00 = 12 500 cents

// ── Deterministic registries ──────────────────────────────────────────────────

const GROUP_REGISTRY: Record<string, PromoRule> = {
  GROUPDISCOUNT5: {
    percent: 5,
    minAttendees: 5,
    tuitionOnly: true,
    active: true,
  },
};

const FAMILY_REGISTRY: Record<string, PromoRule> = {
  FAMILY001: {
    percent: 10,
    minAttendees: 2,
    eligibilityNote: 'I confirm that the attendees are family members registering together.',
    requiresDeclaration: true,
    tuitionOnly: true,
    active: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GROUPDISCOUNT5 (5 %, tuitionOnly) — discount base is tuition only
// ═══════════════════════════════════════════════════════════════════════════════

describe('tuitionOnly enforcement — GROUPDISCOUNT5 (5%, 5-seat minimum)', () => {
  it('discounts only the tuition portion for 5 attendees, not the full subtotal', () => {
    const seats = 5;
    const subtotalCents = FULL_PER_SEAT * seats;   // 62 500 — tuition + fees
    const tuitionCents  = TUITION_PER_SEAT * seats; // 50 000 — tuition only

    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents,
      tuitionCents,
      registry: GROUP_REGISTRY,
    });

    expect(result.valid).toBe(true);

    // Correct: 5% of $500 tuition = $25.00 (2 500 cents)
    const expectedDiscount = Math.floor(tuitionCents * 0.05); // 2 500
    expect(result.discountCents).toBe(expectedDiscount);

    // Confirm it is NOT 5% of the full subtotal (3 125 cents would be wrong)
    const wrongDiscount = Math.floor(subtotalCents * 0.05); // 3 125
    expect(result.discountCents).not.toBe(wrongDiscount);
  });

  it('range fee is excluded: discount is $25.00, not $31.25, for 5 seats', () => {
    const seats = 5;
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents: FULL_PER_SEAT * seats,   // 62 500
      tuitionCents: TUITION_PER_SEAT * seats,  // 50 000
      registry: GROUP_REGISTRY,
    });

    // $25.00 saved (tuition only), not $31.25 (full subtotal)
    expect(result.discountCents).toBe(2_500);
  });

  it('discount scales correctly with attendeeCount=8 (tuition only)', () => {
    const seats = 8;
    const tuitionCents = TUITION_PER_SEAT * seats; // 80 000

    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents: FULL_PER_SEAT * seats,
      tuitionCents,
      registry: GROUP_REGISTRY,
    });

    expect(result.valid).toBe(true);
    expect(result.discountCents).toBe(Math.floor(tuitionCents * 0.05)); // 4 000
  });

  it('without tuitionCents the function falls back to full subtotal (legacy behaviour)', () => {
    // When the caller cannot supply tuitionCents, the full subtotal is used.
    // This preserves backwards compatibility for callers that lack fee-split data.
    const seats = 5;
    const subtotalCents = FULL_PER_SEAT * seats; // 62 500

    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents,
      // tuitionCents intentionally omitted
      registry: GROUP_REGISTRY,
    });

    expect(result.valid).toBe(true);
    // Falls back to 5% of full subtotal
    expect(result.discountCents).toBe(Math.floor(subtotalCents * 0.05)); // 3 125
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. FAMILY001 (10 %, tuitionOnly) — discount base is tuition only
// ═══════════════════════════════════════════════════════════════════════════════

describe('tuitionOnly enforcement — FAMILY001 (10%, 2-seat minimum)', () => {
  it('discounts only the tuition portion for 3 family members', () => {
    const seats = 3;
    const subtotalCents = FULL_PER_SEAT * seats;   // 37 500
    const tuitionCents  = TUITION_PER_SEAT * seats; // 30 000

    const result = computePromoDiscount({
      promoCode: 'FAMILY001',
      attendeeCount: seats,
      subtotalCents,
      tuitionCents,
      registry: FAMILY_REGISTRY,
    });

    expect(result.valid).toBe(true);

    // Correct: 10% of $300 tuition = $30.00 (3 000 cents)
    const expectedDiscount = Math.floor(tuitionCents * 0.10); // 3 000
    expect(result.discountCents).toBe(expectedDiscount);

    // Wrong: 10% of full subtotal ($375) = $37.50 (3 750 cents)
    const wrongDiscount = Math.floor(subtotalCents * 0.10); // 3 750
    expect(result.discountCents).not.toBe(wrongDiscount);
  });

  it('discount is $20.00, not $25.00, for a 2-seat family booking', () => {
    const seats = 2;
    const result = computePromoDiscount({
      promoCode: 'FAMILY001',
      attendeeCount: seats,
      subtotalCents: FULL_PER_SEAT * seats,    // 25 000
      tuitionCents: TUITION_PER_SEAT * seats,   // 20 000
      registry: FAMILY_REGISTRY,
    });

    // 10% of $200 tuition = $20.00 (2 000 cents) — not 10% of $250 (2 500 cents)
    expect(result.discountCents).toBe(2_000);
  });

  it('range fee is never discounted regardless of seat count', () => {
    for (const seats of [2, 3, 5, 10]) {
      const tuitionCents  = TUITION_PER_SEAT * seats;
      const subtotalCents = FULL_PER_SEAT * seats;

      const result = computePromoDiscount({
        promoCode: 'FAMILY001',
        attendeeCount: seats,
        subtotalCents,
        tuitionCents,
        registry: FAMILY_REGISTRY,
      });

      expect(result.valid).toBe(true);

      const expectedDiscount = Math.floor(tuitionCents * 0.10);
      const wrongDiscount    = Math.floor(subtotalCents * 0.10);

      // Discount must equal tuition-only portion
      expect(result.discountCents).toBe(expectedDiscount);
      // And must be strictly less than a discount on the full subtotal
      expect(result.discountCents).toBeLessThan(wrongDiscount);
    }
  });

  it('returns valid=false below minAttendees=2 even with tuitionCents supplied', () => {
    const result = computePromoDiscount({
      promoCode: 'FAMILY001',
      attendeeCount: 1,
      subtotalCents: FULL_PER_SEAT,
      tuitionCents: TUITION_PER_SEAT,
      registry: FAMILY_REGISTRY,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. validate-promo route — tuitionCents derived server-side from course catalog
// ═══════════════════════════════════════════════════════════════════════════════

describe('validate-promo route — server derives tuitionCents from course catalog', () => {
  /**
   * This test calls the actual validate-promo route handler with a real course
   * slug. The route computes tuitionCents by looking up the course's
   * requiredFees in the catalog rather than trusting client-supplied values,
   * so the discount is always tuition-only regardless of what subtotalCents
   * the client sends.
   */
  it('returns tuition-only discount for GROUPDISCOUNT5 on texas-ltc-certification-basic-handgun', async () => {
    // Dynamic import so vi.mock calls in other test files do not interfere
    const { POST } = await import('@/app/api/square/validate-promo/route');

    const seats = 5;
    // Client sends the full subtotal (tuition + fees) — server must still
    // restrict the discount to tuition only.
    const clientSubtotal = FULL_PER_SEAT * seats; // 62 500

    const req = {
      json: async () => ({
        promoCode: 'GROUPDISCOUNT5',
        courseSlug: 'texas-ltc-certification-basic-handgun',
        attendeeCount: seats,
        subtotalCents: clientSubtotal,
      }),
    } as unknown as Request;

    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    expect(body.valid).toBe(true);

    // Server should have derived tuitionCents = 10 000 × 5 = 50 000
    // and applied 5% to that, yielding 2 500 cents — NOT 3 125 (5% of full subtotal)
    expect(body.discountCents).toBe(2_500);
    expect(body.discountDisplay).toBe('$25.00');
  });

  it('returns tuition-only discount for FAMILY001 on texas-ltc-certification-basic-handgun', async () => {
    const { POST } = await import('@/app/api/square/validate-promo/route');

    const seats = 3;
    const clientSubtotal = FULL_PER_SEAT * seats; // 37 500

    const req = {
      json: async () => ({
        promoCode: 'FAMILY001',
        courseSlug: 'texas-ltc-certification-basic-handgun',
        attendeeCount: seats,
        subtotalCents: clientSubtotal,
      }),
    } as unknown as Request;

    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    expect(body.valid).toBe(true);

    // Server derives tuitionCents = 10 000 × 3 = 30 000
    // 10% of 30 000 = 3 000, not 10% of 37 500 = 3 750
    expect(body.discountCents).toBe(3_000);
    expect(body.discountDisplay).toBe('$30.00');
  });
});
