/**
 * Promo-discount security tests — Task #310
 *
 * Confirms that a forged attendeeCount cannot bypass the GROUPDISCOUNT5
 * minimum-seats check, and that attendeeCount drives seat pricing and the
 * minAttendees guard consistently.
 *
 * Two core scenarios:
 *   1. attendeeCount=1 with GROUPDISCOUNT5 → discountCents=0 (minAttendees not met).
 *   2. attendeeCount=5 with GROUPDISCOUNT5 → correct 5% discount and correctly
 *      multiplied seat pricing from resolveCoursePayment.
 *
 * Tests use:
 *   - computePromoDiscount (pure function, registry injected for determinism)
 *   - resolveCoursePayment (server-authoritative pricing resolver)
 *
 * No network calls, no environment variable dependencies.
 */

import { describe, it, expect } from 'vitest';
import { computePromoDiscount, type PromoRule } from '@/lib/promo';
import { resolveCoursePayment } from '@/lib/pricing';

// ── Shared test fixtures ──────────────────────────────────────────────────────

/**
 * texas-ltc-certification-basic-handgun / ltc-bh-combo:
 *   $100 tuition + $25 required range fee = $125 per seat (12 500 cents)
 */
const COURSE = 'texas-ltc-certification-basic-handgun';
const OPTION = 'ltc-bh-combo';
const PER_SEAT_CENTS = 12_500;

/**
 * Deterministic GROUPDISCOUNT5 registry for unit tests.
 * No env vars needed — 5% discount, minAttendees=5, active.
 */
const DETERMINISTIC_REGISTRY: Record<string, PromoRule> = {
  GROUPDISCOUNT5: {
    percent: 5,
    minAttendees: 5,
    tuitionOnly: true,
    active: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. computePromoDiscount — attendeeCount=1 returns discountCents=0
// ═══════════════════════════════════════════════════════════════════════════════

describe('computePromoDiscount — GROUPDISCOUNT5 with 1 attendee', () => {
  it('returns valid=false when attendeeCount is 1 (below minAttendees=5)', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 1,
      subtotalCents: PER_SEAT_CENTS,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });

  it('message includes the minAttendees threshold (5) when 1 attendee is supplied', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 1,
      subtotalCents: PER_SEAT_CENTS,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.message).toMatch(/5/);
  });

  it('returns valid=false for attendeeCount=2 (still below minAttendees=5)', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 2,
      subtotalCents: PER_SEAT_CENTS * 2,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });

  it('returns valid=false for attendeeCount=4 (one below minAttendees=5)', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 4,
      subtotalCents: PER_SEAT_CENTS * 4,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });

  it('ignores a large subtotalCents — a 1-attendee booking still gets no discount', () => {
    // A shopper cannot inflate subtotal to trick the server into granting the
    // group discount when only 1 seat is being purchased.
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 1,
      subtotalCents: PER_SEAT_CENTS * 10, // inflated subtotal — must not matter
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(false);
    expect(result.discountCents).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. computePromoDiscount — attendeeCount=5 returns correct 5% discount
// ═══════════════════════════════════════════════════════════════════════════════

describe('computePromoDiscount — GROUPDISCOUNT5 with 5 attendees', () => {
  it('returns valid=true when attendeeCount is exactly 5 (meets minAttendees)', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 5,
      subtotalCents: PER_SEAT_CENTS * 5,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(true);
  });

  it('computes exactly 5% of subtotal for 5 attendees', () => {
    const subtotal = PER_SEAT_CENTS * 5; // 62 500 cents
    const expected = Math.floor(subtotal * 0.05); // 3 125 cents

    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 5,
      subtotalCents: subtotal,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.discountCents).toBe(expected);
  });

  it('returns the normalized code and no eligibility note for GROUPDISCOUNT5', () => {
    const result = computePromoDiscount({
      promoCode: 'groupdiscount5', // lowercase input — must normalize
      attendeeCount: 5,
      subtotalCents: PER_SEAT_CENTS * 5,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(true);
    expect(result.normalizedCode).toBe('GROUPDISCOUNT5');
    expect(result.requiresDeclaration).toBe(false);
  });

  it('returns valid=true for attendeeCount=8 (above threshold)', () => {
    const result = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: 8,
      subtotalCents: PER_SEAT_CENTS * 8,
      registry: DETERMINISTIC_REGISTRY,
    });

    expect(result.valid).toBe(true);
    expect(result.discountCents).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. resolveCoursePayment — seat pricing scales correctly with attendeeCount
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveCoursePayment — seat pricing with attendeeCount', () => {
  it('totalCents equals PER_SEAT_CENTS for 1 attendee (no discount)', () => {
    const result = resolveCoursePayment(COURSE, OPTION, [], 1, 0);
    expect(result).not.toBeNull();
    expect(result!.totalCents).toBe(PER_SEAT_CENTS);
  });

  it('totalCents equals PER_SEAT_CENTS × 5 for 5 attendees (no discount)', () => {
    const result = resolveCoursePayment(COURSE, OPTION, [], 5, 0);
    expect(result).not.toBeNull();
    expect(result!.totalCents).toBe(PER_SEAT_CENTS * 5);
  });

  it('base tuition line quantity equals attendeeCount for 5 seats', () => {
    const result = resolveCoursePayment(COURSE, OPTION, [], 5, 0);
    expect(result).not.toBeNull();
    const baseLine = result!.lineItems.find((li) => li.kind === 'course');
    expect(baseLine).toBeDefined();
    expect(baseLine!.quantity).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Pairing: the same attendeeCount drives both the minAttendees check and
//    seat pricing — a forged attendeeCount cannot unlock a discount for fewer seats
// ═══════════════════════════════════════════════════════════════════════════════

describe('attendeeCount pairing — discount guard and seat pricing use the same value', () => {
  it('attendeeCount=1 → no discount AND only 1 seat charged', () => {
    const seats = 1;
    const subtotal = PER_SEAT_CENTS * seats;

    // Step 1: server validates the promo code using attendeeCount=1 → no discount
    const promoResult = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents: subtotal,
      registry: DETERMINISTIC_REGISTRY,
    });
    expect(promoResult.valid).toBe(false);
    expect(promoResult.discountCents).toBe(0);

    // Step 2: server computes payment using attendeeCount=1 → 1 seat charged
    const paymentResult = resolveCoursePayment(COURSE, OPTION, [], seats, promoResult.discountCents);
    expect(paymentResult).not.toBeNull();
    expect(paymentResult!.totalCents).toBe(PER_SEAT_CENTS); // full price, no discount
    expect(paymentResult!.discountCents).toBe(0);
  });

  it('attendeeCount=5 → 5% discount AND 5 seats charged', () => {
    const seats = 5;
    const subtotal = PER_SEAT_CENTS * seats; // 62 500 cents

    // Step 1: server validates the promo code using attendeeCount=5 → 5% discount
    const promoResult = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: seats,
      subtotalCents: subtotal,
      registry: DETERMINISTIC_REGISTRY,
    });
    expect(promoResult.valid).toBe(true);
    const expectedDiscount = Math.floor(subtotal * 0.05); // 3 125 cents
    expect(promoResult.discountCents).toBe(expectedDiscount);

    // Step 2: server computes payment using attendeeCount=5 → 5 seats charged, discount applied
    const paymentResult = resolveCoursePayment(COURSE, OPTION, [], seats, promoResult.discountCents);
    expect(paymentResult).not.toBeNull();
    expect(paymentResult!.totalCents).toBe(subtotal - expectedDiscount);
    expect(paymentResult!.discountCents).toBe(expectedDiscount);
  });

  it('a shopper who forges attendeeCount=5 at promo-validation then submits attendeeCount=1 at payment gets no usable discount', () => {
    // Simulates the attack: validate with 5 attendees (discount granted), then
    // submit payment with only 1 attendee (and the previously returned discountCents).
    const forgedSeats = 5;
    const realSeats = 1;

    // Step 1: Attacker calls validate-promo with 5 seats — discount is granted.
    const promoResult = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: forgedSeats,
      subtotalCents: PER_SEAT_CENTS * forgedSeats,
      registry: DETERMINISTIC_REGISTRY,
    });
    expect(promoResult.valid).toBe(true);
    const stolenDiscount = promoResult.discountCents; // 3 125 cents
    expect(stolenDiscount).toBeGreaterThan(0);

    // Step 2: Simulate what create-payment now does server-side —
    // compute the authoritative 1-seat subtotal (no discount yet)…
    const baseResult = resolveCoursePayment(COURSE, OPTION, [], realSeats, 0);
    expect(baseResult).not.toBeNull();
    const serverSubtotal = baseResult!.totalCents; // 12 500 cents

    // Step 3: Re-validate the promo against actual seats (1) and server subtotal.
    // minAttendees=5 is not met → discount is zeroed.
    const revalidation = computePromoDiscount({
      promoCode: 'GROUPDISCOUNT5',
      attendeeCount: realSeats,
      subtotalCents: serverSubtotal,
      registry: DETERMINISTIC_REGISTRY,
    });
    expect(revalidation.valid).toBe(false);
    const validatedDiscount = revalidation.valid ? revalidation.discountCents : 0;
    expect(validatedDiscount).toBe(0);

    // Step 4: Final payment resolution uses the server-validated discount (0).
    // The attacker pays the full 1-seat price — the stolen discount is blocked.
    const paymentResult = resolveCoursePayment(COURSE, OPTION, [], realSeats, validatedDiscount);
    expect(paymentResult).not.toBeNull();
    expect(paymentResult!.discountCents).toBe(0);
    expect(paymentResult!.totalCents).toBe(PER_SEAT_CENTS); // full price, no discount
  });

  it('a disabled GROUPDISCOUNT5 returns discountCents=0 for any attendeeCount', () => {
    const disabledRegistry: Record<string, PromoRule> = {
      GROUPDISCOUNT5: {
        percent: 5,
        minAttendees: 5,
        tuitionOnly: true,
        active: false, // disabled
      },
    };

    for (const seats of [1, 5, 10]) {
      const result = computePromoDiscount({
        promoCode: 'GROUPDISCOUNT5',
        attendeeCount: seats,
        subtotalCents: PER_SEAT_CENTS * seats,
        registry: disabledRegistry,
      });
      expect(result.valid).toBe(false);
      expect(result.discountCents).toBe(0);
    }
  });
});
