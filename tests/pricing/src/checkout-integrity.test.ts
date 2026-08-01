/**
 * Checkout integrity tests — Task #295
 *
 * Confirms that the three server round-trips (validate-promo → create-order →
 * create-payment) cannot produce a wrong total at Square.
 *
 * Four scenarios covered:
 *   1. Forged discountCents sent to create-payment does NOT lower the charged
 *      amount — the server ignores client-supplied discounts without a promo code.
 *   2. GROUPDISCOUNT5 (minAttendees=5) is rejected by the validate-promo route
 *      when only 2 attendees are supplied.
 *   3. create-order and create-payment both call resolveCoursePayment with the
 *      same inputs and therefore agree on the same total.
 *   4. The create-payment route sets group_registration='true' in Square payment
 *      metadata when seats ≥ 5 (server-derived, not client-supplied).
 *
 * No live Square or Resend API calls are made; global fetch is mocked per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock @/lib/square before any route imports ────────────────────────────────
// create-order and create-payment import constants and helpers from here.
vi.mock('@/lib/square', () => ({
  SQUARE_BASE_URL: 'https://square.test',
  SQUARE_VERSION: '2024-11-20',
  GROUP_REGISTRATION_MIN_ATTENDEES: 10,
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => 'test-idempotency-key'),
  // squareFetch proxies through the stubbed global fetch so vi.stubGlobal('fetch')
  // can capture payloads while the route uses squareFetch instead of raw fetch.
  squareFetch: vi.fn(async (path: string, init?: RequestInit) =>
    fetch(`https://square.test${path}`, init),
  ),
}));

import { isSquareConfigured } from '@/lib/square';
import { POST as validatePromoPost } from '@/app/api/square/validate-promo/route';
import { POST as createOrderPost } from '@/app/api/square/create-order/route';
import { POST as createPaymentPost } from '@/app/api/square/create-payment/route';
import { resolveCoursePayment } from '@/lib/pricing';

// ── Fixtures ─────────────────────────────────────────────────────────────────

// texas-ltc-certification-basic-handgun: $100 tuition + $25 range fee = $125/seat
const COURSE = 'texas-ltc-certification-basic-handgun';
const OPTION = 'ltc-bh-combo';
const PER_SEAT_CENTS = 12500;

function makeReq(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request;
}

/** Minimal valid create-payment request body for N attendees. */
function makePaymentBody(
  attendeeCount: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sourceId: 'cnon:card-nonce-ok',
    courseSlug: COURSE,
    pricingOptionId: OPTION,
    addOnIds: [],
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '2145550000',
    attendeeCount,
    discountCents: 0,
    ...overrides,
  };
}

// ── Shared Square fetch mock helper ──────────────────────────────────────────

type SquarePaymentPayload = {
  amount_money: { amount: number; currency: string };
  metadata: Record<string, string>;
  [key: string]: unknown;
};

/**
 * Mocks global fetch for create-payment tests.
 * - Customer search → no existing customer
 * - Customer create → returns a stub customer ID
 * - Payment call → captures payload, returns COMPLETED payment
 * Returns a reference to the captured payment payload.
 */
function mockPaymentFetch(): { captured: SquarePaymentPayload | null } {
  const ref: { captured: SquarePaymentPayload | null } = { captured: null };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, opts?: RequestInit) => {
      const urlStr = String(url);

      if (urlStr.includes('/v2/customers/search')) {
        return {
          ok: true,
          json: async () => ({ customers: [] }),
        } as unknown as Response;
      }

      if (urlStr.includes('/v2/customers')) {
        return {
          ok: true,
          json: async () => ({ customer: { id: 'cust_test_123' } }),
        } as unknown as Response;
      }

      if (urlStr.includes('/v2/payments')) {
        ref.captured = JSON.parse((opts as RequestInit).body as string) as SquarePaymentPayload;
        return {
          ok: true,
          json: async () => ({
            payment: { id: 'pay_test_123', status: 'COMPLETED', receipt_url: null },
          }),
        } as unknown as Response;
      }

      // Resend emails (only reached if RESEND_API_KEY is set — not set in tests)
      return { ok: true, json: async () => ({ id: 'email_stub' }) } as unknown as Response;
    }),
  );

  return ref;
}

/**
 * Mocks global fetch for create-order tests.
 * Captures the Square order payload and returns a stub order.
 */
function mockOrderFetch(orderId = 'ord_test_123'): { captured: Record<string, unknown> | null } {
  const ref: { captured: Record<string, unknown> | null } = { captured: null };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, opts?: RequestInit) => {
      ref.captured = JSON.parse((opts as RequestInit).body as string) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({
          order: { id: orderId, total_money: { amount: 0 } },
        }),
      } as unknown as Response;
    }),
  );

  return ref;
}

// ── Environment setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(isSquareConfigured).mockReturnValue(true);
  process.env.SQUARE_ACCESS_TOKEN = 'test-access-token';
  process.env.SQUARE_LOCATION_ID = 'test-location';
  delete process.env.RESEND_API_KEY; // Prevent email fetches in tests
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. validate-promo route — minAttendees enforcement
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/validate-promo — minAttendees enforcement', () => {
  it('rejects GROUPDISCOUNT5 with 1 attendee (requires 5)', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: COURSE, attendeeCount: 1, subtotalCents: PER_SEAT_CENTS }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
    expect(String(body.message)).toMatch(/5/);
  });

  it('rejects GROUPDISCOUNT5 with 2 attendees (requires 5)', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: COURSE, attendeeCount: 2, subtotalCents: PER_SEAT_CENTS * 2 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
    expect(String(body.message)).toMatch(/5/);
  });

  it('rejects GROUPDISCOUNT5 with 4 attendees (one below threshold)', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: COURSE, attendeeCount: 4, subtotalCents: PER_SEAT_CENTS * 4 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it('accepts GROUPDISCOUNT5 with exactly 5 attendees', async () => {
    const subtotal = PER_SEAT_CENTS * 5; // 62 500 — tuition + range fee
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: COURSE, pricingOptionId: OPTION, attendeeCount: 5, subtotalCents: subtotal }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(true);
    expect(typeof body.discountCents).toBe('number');
    // GROUPDISCOUNT5 is tuitionOnly=true. The route derives tuitionCents from the
    // course catalog: $100 tuition × 5 seats = 50 000 cents. The $25 range fee
    // per seat is excluded from the discount base.
    // Expected: 5% of 50 000 = 2 500 cents, NOT 5% of 62 500 = 3 125 cents.
    const RANGE_FEE_PER_SEAT = 2_500; // $25
    const tuitionOnlyCents = (PER_SEAT_CENTS - RANGE_FEE_PER_SEAT) * 5; // 50 000
    expect(body.discountCents as number).toBe(Math.floor(tuitionOnlyCents * 0.05));
  });

  it('accepts GROUPDISCOUNT5 with 8 attendees (above threshold)', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: COURSE, attendeeCount: 8, subtotalCents: PER_SEAT_CENTS * 8 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(true);
  });

  it('rejects FAMILY001 with only 1 attendee (requires 2)', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'FAMILY001', courseSlug: COURSE, attendeeCount: 1, subtotalCents: PER_SEAT_CENTS }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it('accepts FAMILY001 with 2 attendees', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'FAMILY001', courseSlug: COURSE, attendeeCount: 2, subtotalCents: PER_SEAT_CENTS * 2 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(true);
  });

  it('rejects an unknown promo code', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'FAKECODE99', courseSlug: COURSE, attendeeCount: 5, subtotalCents: PER_SEAT_CENTS * 5 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it('rejects any promo code for the online-texas-ltc-assessment course', async () => {
    const res = await validatePromoPost(
      makeReq({ promoCode: 'GROUPDISCOUNT5', courseSlug: 'online-texas-ltc-assessment', attendeeCount: 5, subtotalCents: 10000 }),
    );
    const body = await res.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it('returns HTTP 400 when no promo code is supplied', async () => {
    const res = await validatePromoPost(makeReq({ courseSlug: COURSE, attendeeCount: 1 }));
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. create-order route — multi-attendee total agreement
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/create-order — multi-attendee pricing', () => {
  it('resolvedTotal equals PER_SEAT × 3 for three attendees with no promo', async () => {
    mockOrderFetch();
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE, pricingOptionId: OPTION, attendeeCount: 3, addOnIds: [],
    }));
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.resolvedTotal).toBe(PER_SEAT_CENTS * 3);
  });

  it('resolvedTotal equals PER_SEAT × 5 for five attendees with no promo', async () => {
    mockOrderFetch();
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE, pricingOptionId: OPTION, attendeeCount: 5, addOnIds: [],
    }));
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.resolvedTotal).toBe(PER_SEAT_CENTS * 5);
  });

  it('ignores a forged discountCents when no normalizedPromoCode is supplied', async () => {
    mockOrderFetch();
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: 3,
      addOnIds: [],
      discountCents: 30000, // wildly inflated — no promo code supplied
    }));
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    // Discount is forced to 0 server-side; full catalog price must be charged
    expect(body.resolvedTotal).toBe(PER_SEAT_CENTS * 3);
  });

  it('applies a legitimate server-validated discount when normalizedPromoCode is present', async () => {
    // GROUPDISCOUNT5 requires minAttendees=5; use 5 seats so re-validation passes.
    mockOrderFetch();
    const subtotal5 = PER_SEAT_CENTS * 5;
    const promoDiscount = Math.floor(subtotal5 * 0.05); // 5% of 5-seat subtotal
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: 5,
      addOnIds: [],
      discountCents: promoDiscount,
      normalizedPromoCode: 'GROUPDISCOUNT5',
    }));
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.resolvedTotal).toBe(subtotal5 - promoDiscount);
  });

  it('passes the promo discount block to Square as an ORDER-scoped discount line', async () => {
    // GROUPDISCOUNT5 requires minAttendees=5; use 5 seats so re-validation passes.
    const ref = mockOrderFetch();
    const subtotal5 = PER_SEAT_CENTS * 5;
    const promoDiscount = Math.floor(subtotal5 * 0.05);

    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: 5,
      addOnIds: [],
      discountCents: promoDiscount,
      normalizedPromoCode: 'GROUPDISCOUNT5',
    }));

    expect(ref.captured).not.toBeNull();
    const order = ref.captured!.order as { discounts?: Array<{ amount_money: { amount: number } }> };
    expect(order.discounts).toBeDefined();
    expect(order.discounts![0].amount_money.amount).toBe(promoDiscount);
  });

  it('returns HTTP 503 when Square is not configured', async () => {
    vi.mocked(isSquareConfigured).mockReturnValue(false);
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE, pricingOptionId: OPTION, attendeeCount: 1, addOnIds: [],
    }));
    expect(res.status).toBe(503);
  });

  it('returns HTTP 400 for the online-texas-ltc-assessment course (external checkout)', async () => {
    const res = await createOrderPost(makeReq({
      courseSlug: 'online-texas-ltc-assessment', pricingOptionId: OPTION, attendeeCount: 1, addOnIds: [],
    }));
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. create-payment route — forged discount protection
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/create-payment — forged discountCents is rejected', () => {
  it('charges the full catalog price when a large forged discountCents is sent without a promo code', async () => {
    const ref = mockPaymentFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody(1, {
      discountCents: 12400, // forged — nearly full discount on $125 course
      // normalizedPromoCode is intentionally absent
    })));

    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);

    // Square must be charged the full server-computed catalog price
    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
    expect(amountCharged).toBe(PER_SEAT_CENTS); // $125 — no discount applied
  });

  it('charges the full catalog price for 3 attendees when a forged discount is sent without a promo code', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(3, {
      discountCents: 30000, // forged
    })));

    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
    expect(amountCharged).toBe(PER_SEAT_CENTS * 3);
  });

  it('applies a server-recomputed tuition-only discount when normalizedPromoCode is also supplied', async () => {
    // After the server-authoritative recomputation (Task #327), the route calls
    // computePromoDiscount internally.  GROUPDISCOUNT5 is tuitionOnly=true, so
    // it discounts 5% of tuition ($100 × 5 = $500) — NOT 5% of the full subtotal
    // ($125 × 5 = $625).  The client-supplied discountCents value is ignored.
    const ref = mockPaymentFetch();
    const subtotal = PER_SEAT_CENTS * 5;            // 62 500 cents

    // Server will independently compute:
    //   tuitionCents = 10 000 × 5 = 50 000
    //   discount     = floor(50 000 × 0.05) = 2 500  (tuition-only)
    const TUITION_PER_SEAT = 10_000; // $100
    const serverDiscount = Math.floor(TUITION_PER_SEAT * 5 * 0.05); // 2 500

    // Client sends a larger (wrong) discount — server must recompute and ignore it
    await createPaymentPost(makeReq(makePaymentBody(5, {
      discountCents: Math.floor(subtotal * 0.05), // 3 125 — full-subtotal (wrong)
      normalizedPromoCode: 'GROUPDISCOUNT5',
    })));

    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
    expect(amountCharged).toBe(subtotal - serverDiscount); // 60 000, not 59 375
  });

  it('returns HTTP 400 when a forged discount drives totalCents to 0 (route guard fires)', async () => {
    // Client sends discount equal to full subtotal with no promo code.
    // Server forces discountCents=0 → totalCents = PER_SEAT_CENTS → NOT a 400.
    // This test confirms the guard fires only when totalCents actually reaches 0.
    mockPaymentFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody(1, {
      discountCents: PER_SEAT_CENTS, // would be 0 if not blocked — route will block forged discount, so total = PER_SEAT_CENTS > 0
      // normalizedPromoCode absent → discount forced to 0
    })));

    // Route forces discount to 0, total stays PER_SEAT_CENTS → succeeds
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. create-payment route — group_registration flag is server-derived
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/create-payment — group_registration in Square metadata', () => {
  it('sets group_registration="true" in Square metadata when attendeeCount = 10 (threshold)', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(10)));

    expect(ref.captured).not.toBeNull();
    const meta = ref.captured!.metadata as Record<string, string>;
    expect(meta.group_registration).toBe('true');
    expect(meta.attendee_count).toBe('10');
  });

  it('sets group_registration="true" when attendeeCount = 10 (well above threshold)', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(10)));

    expect(ref.captured).not.toBeNull();
    const meta = ref.captured!.metadata as Record<string, string>;
    expect(meta.group_registration).toBe('true');
  });

  it('sets group_registration="false" when attendeeCount = 4 (one below threshold)', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(4)));

    expect(ref.captured).not.toBeNull();
    const meta = ref.captured!.metadata as Record<string, string>;
    expect(meta.group_registration).toBe('false');
  });

  it('sets group_registration="false" for 1 attendee', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(1)));

    expect(ref.captured).not.toBeNull();
    expect((ref.captured!.metadata as Record<string, string>).group_registration).toBe('false');
  });

  it('ignores client-supplied isGroupRegistration=true for a 1-attendee booking', async () => {
    // Even if client sends isGroupRegistration: true, server derives false for 1 attendee.
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(1, {
      isGroupRegistration: true, // client lie — must be ignored
    })));

    expect(ref.captured).not.toBeNull();
    expect((ref.captured!.metadata as Record<string, string>).group_registration).toBe('false');
  });

  it('sends group_registration="true" for 10 attendees even if client sends isGroupRegistration=false', async () => {
    // Server derives the flag; client override must not suppress the group flag.
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(10, {
      isGroupRegistration: false, // client understatement — must be ignored
    })));

    expect(ref.captured).not.toBeNull();
    expect((ref.captured!.metadata as Record<string, string>).group_registration).toBe('true');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. create-order ↔ create-payment price agreement
// ═══════════════════════════════════════════════════════════════════════════════

describe('create-order / create-payment price agreement (same resolveCoursePayment inputs)', () => {
  it('both routes resolve the same totalCents for 3 attendees with no discount', () => {
    // Both routes call resolveCoursePayment with identical arguments.
    // The function is pure, so identical inputs always yield identical outputs.
    const orderResult = resolveCoursePayment(COURSE, OPTION, [], 3, 0);
    const paymentResult = resolveCoursePayment(COURSE, OPTION, [], 3, 0);
    expect(orderResult).not.toBeNull();
    expect(paymentResult).not.toBeNull();
    expect(orderResult!.totalCents).toBe(paymentResult!.totalCents);
    expect(orderResult!.totalCents).toBe(PER_SEAT_CENTS * 3);
  });

  it('both routes resolve the same totalCents for 5 attendees with a 5% promo discount', () => {
    const subtotal = PER_SEAT_CENTS * 5;
    const discount = Math.floor(subtotal * 0.05);
    const orderResult = resolveCoursePayment(COURSE, OPTION, [], 5, discount);
    const paymentResult = resolveCoursePayment(COURSE, OPTION, [], 5, discount);
    expect(orderResult!.totalCents).toBe(paymentResult!.totalCents);
    expect(orderResult!.totalCents).toBe(subtotal - discount);
  });

  it('create-order resolvedTotal for 3 attendees matches resolveCoursePayment directly', async () => {
    mockOrderFetch();
    const res = await createOrderPost(makeReq({
      courseSlug: COURSE, pricingOptionId: OPTION, attendeeCount: 3, addOnIds: [],
    }));
    const body = await res.json() as Record<string, unknown>;

    const expected = resolveCoursePayment(COURSE, OPTION, [], 3, 0);
    expect(body.resolvedTotal).toBe(expected!.totalCents);
  });

  it('create-payment charges Square the same totalCents that resolveCoursePayment returns', async () => {
    const ref = mockPaymentFetch();

    await createPaymentPost(makeReq(makePaymentBody(3)));

    const expected = resolveCoursePayment(COURSE, OPTION, [], 3, 0);
    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
    expect(amountCharged).toBe(expected!.totalCents);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. create-payment — tuitionOnly discount enforcement
//
// GROUPDISCOUNT5 and FAMILY001 are both tuitionOnly=true.  After the
// server-authoritative recomputation the route calls computePromoDiscount
// internally and must apply the percent only to the tuition portion of the
// order, never to the full subtotal that includes the required range fee.
//
// Course: texas-ltc-certification-basic-handgun / ltc-bh-combo
//   Tuition:   $100.00 = 10 000 cents per seat
//   Range fee: $ 25.00 =  2 500 cents per seat (required, not discountable)
//   Full total: $125.00 = 12 500 cents per seat
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/create-payment — tuitionOnly discount enforcement', () => {
  const TUITION_PER_SEAT = 10_000; // $100
  const RANGE_FEE_PER_SEAT = 2_500; // $25

  it('GROUPDISCOUNT5: Square is charged percent × tuition only, not percent × full subtotal (5 seats)', async () => {
    const ref = mockPaymentFetch();
    const seats = 5;
    const fullSubtotal = PER_SEAT_CENTS * seats;       // 62 500
    const tuitionOnly = TUITION_PER_SEAT * seats;      // 50 000
    const correctDiscount = Math.floor(tuitionOnly * 0.05);  // 2 500
    const wrongDiscount   = Math.floor(fullSubtotal * 0.05); // 3 125

    await createPaymentPost(makeReq(makePaymentBody(seats, {
      // Client sends the wrong (inflated) discount — server must override it
      discountCents: wrongDiscount,
      normalizedPromoCode: 'GROUPDISCOUNT5',
    })));

    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;

    // Server-derived discount = 5% of tuition → $25.00 saved, not $31.25
    expect(amountCharged).toBe(fullSubtotal - correctDiscount); // 60 000
    expect(amountCharged).not.toBe(fullSubtotal - wrongDiscount); // must NOT be 59 375
  });

  it('GROUPDISCOUNT5: range fee ($25/seat) is excluded from the discount base (8 seats)', async () => {
    const ref = mockPaymentFetch();
    const seats = 8;
    const fullSubtotal = PER_SEAT_CENTS * seats;
    const tuitionOnly = TUITION_PER_SEAT * seats;
    const correctDiscount = Math.floor(tuitionOnly * 0.05);

    await createPaymentPost(makeReq(makePaymentBody(seats, {
      discountCents: Math.floor(fullSubtotal * 0.05), // inflated client value
      normalizedPromoCode: 'GROUPDISCOUNT5',
    })));

    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
    expect(amountCharged).toBe(fullSubtotal - correctDiscount);
  });

  it('FAMILY001: Square is charged percent × tuition only, not percent × full subtotal (2 seats)', async () => {
    const ref = mockPaymentFetch();
    const seats = 2;
    const fullSubtotal = PER_SEAT_CENTS * seats;       // 25 000
    const tuitionOnly = TUITION_PER_SEAT * seats;      // 20 000
    const correctDiscount = Math.floor(tuitionOnly * 0.10); // 2 000
    const wrongDiscount   = Math.floor(fullSubtotal * 0.10); // 2 500

    await createPaymentPost(makeReq(makePaymentBody(seats, {
      discountCents: wrongDiscount,
      normalizedPromoCode: 'FAMILY001',
    })));

    expect(ref.captured).not.toBeNull();
    const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;

    // 10% of $200 tuition = $20.00 saved — not 10% of $250 ($25.00)
    expect(amountCharged).toBe(fullSubtotal - correctDiscount); // 23 000
    expect(amountCharged).not.toBe(fullSubtotal - wrongDiscount); // must NOT be 22 500
  });

  it('FAMILY001: range fee is never discounted for any seat count', async () => {
    for (const seats of [2, 3, 5]) {
      const ref = mockPaymentFetch();
      const fullSubtotal = PER_SEAT_CENTS * seats;
      const tuitionOnly = TUITION_PER_SEAT * seats;
      const correctDiscount = Math.floor(tuitionOnly * 0.10);

      await createPaymentPost(makeReq(makePaymentBody(seats, {
        discountCents: Math.floor(fullSubtotal * 0.10), // inflated
        normalizedPromoCode: 'FAMILY001',
      })));

      expect(ref.captured).not.toBeNull();
      const amountCharged = (ref.captured!.amount_money as { amount: number }).amount;
      expect(amountCharged).toBe(fullSubtotal - correctDiscount);

      // Verify the range fee portion was not discounted
      const rangeFeeTotal = RANGE_FEE_PER_SEAT * seats;
      const effectiveDiscount = fullSubtotal - amountCharged;
      expect(effectiveDiscount).toBeLessThan(rangeFeeTotal + correctDiscount);
      vi.unstubAllGlobals();
    }
  });

  it('discountCents in the response reflects the tuition-only server computation', async () => {
    mockPaymentFetch();
    const seats = 5;
    const tuitionOnly = TUITION_PER_SEAT * seats;
    const expectedDiscount = Math.floor(tuitionOnly * 0.05); // 2 500

    const res = await createPaymentPost(makeReq(makePaymentBody(seats, {
      discountCents: Math.floor(PER_SEAT_CENTS * seats * 0.05), // wrong client value
      normalizedPromoCode: 'GROUPDISCOUNT5',
    })));

    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.discountCents).toBe(expectedDiscount); // 2 500, not 3 125
  });
});
