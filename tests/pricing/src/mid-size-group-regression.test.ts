/**
 * Mid-size group regression test — Task #360
 *
 * Confirms that a booking with 7 attendees (in the old 5–9 "grey zone" that
 * used to be treated as GROUP on the client) is NOT treated as a group
 * registration anywhere downstream:
 *
 *   1. The admin (business) email subject does NOT contain "(GROUP)".
 *   2. The Square payment metadata has group_registration="false".
 *
 * The threshold is GROUP_REGISTRATION_MIN_ATTENDEES = 10 (server-side) and
 * GROUP_THRESHOLD = 10 (client-side, corsair-source/src/components/BookingForm.tsx).
 *
 * No live Square or Resend API calls are made; global fetch is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock @/lib/square before route imports ────────────────────────────────────
vi.mock('@/lib/square', () => ({
  SQUARE_BASE_URL: 'https://square.test',
  SQUARE_VERSION: '2024-11-20',
  GROUP_REGISTRATION_MIN_ATTENDEES: 10,
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => 'test-idem-key'),
  squareFetch: vi.fn(async (path: string, init?: RequestInit) =>
    fetch(`https://square.test${path}`, init),
  ),
}));

import { isSquareConfigured } from '@/lib/square';
import { POST as createPaymentPost } from '@/app/api/square/create-payment/route';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// texas-ltc-certification-basic-handgun: $100 tuition + $25 range fee = $125/seat
const COURSE = 'texas-ltc-certification-basic-handgun';
const OPTION = 'ltc-bh-combo';

function makeReq(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request;
}

function makePaymentBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceId: 'cnon:card-nonce-ok',
    courseSlug: COURSE,
    pricingOptionId: OPTION,
    addOnIds: [],
    firstName: 'Test',
    lastName: 'User',
    email: 'buyer@example.com',
    phone: '2145550000',
    attendeeCount: 7,
    discountCents: 0,
    ...overrides,
  };
}

// ── Fetch mock ────────────────────────────────────────────────────────────────

type CapturedResendCall = { subject: string; to: string[] };
type CapturedSquarePayment = { metadata: Record<string, string> };

/**
 * Stubs global fetch so Square calls succeed and both Resend calls and
 * Square payment payloads are captured for inspection.
 */
function mockFetch(): {
  resendCalls: CapturedResendCall[];
  squarePaymentCaptures: CapturedSquarePayment[];
} {
  const resendCalls: CapturedResendCall[] = [];
  const squarePaymentCaptures: CapturedSquarePayment[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, opts?: RequestInit) => {
      const urlStr = String(url);

      // Square customer search — return no existing customer
      if (urlStr.includes('/v2/customers/search')) {
        return {
          ok: true,
          json: async () => ({ customers: [] }),
        } as unknown as Response;
      }

      // Square customer create
      if (urlStr.includes('/v2/customers')) {
        return {
          ok: true,
          json: async () => ({ customer: { id: 'cust_test_7att' } }),
        } as unknown as Response;
      }

      // Square payment — capture the metadata
      if (urlStr.includes('/v2/payments')) {
        const payload = JSON.parse((opts as RequestInit).body as string) as {
          metadata: Record<string, string>;
        };
        squarePaymentCaptures.push({ metadata: payload.metadata ?? {} });
        return {
          ok: true,
          json: async () => ({
            payment: { id: 'pay_test_7att', status: 'COMPLETED', receipt_url: null },
          }),
        } as unknown as Response;
      }

      // Resend email calls — capture subject + recipients
      if (urlStr.includes('resend.com')) {
        const body = JSON.parse((opts as RequestInit).body as string) as {
          subject: string;
          to: string[];
        };
        resendCalls.push({ subject: body.subject, to: body.to });
        return {
          ok: true,
          json: async () => ({ id: 'email_stub' }),
        } as unknown as Response;
      }

      return { ok: true, json: async () => ({}) } as unknown as Response;
    }),
  );

  return { resendCalls, squarePaymentCaptures };
}

// ── Environment setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(isSquareConfigured).mockReturnValue(true);
  process.env.SQUARE_ACCESS_TOKEN = 'test-token';
  process.env.SQUARE_LOCATION_ID = 'test-location';
  process.env.RESEND_API_KEY = 'test-resend-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('7-attendee booking — no GROUP label anywhere (regression for old threshold=5)', () => {
  it('admin email subject does NOT contain "(GROUP)" for 7 attendees', async () => {
    const { resendCalls } = mockFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 7 })));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);

    const adminEmail = resendCalls.find((c) =>
      c.to.includes('corsairtacticalsolutions@gmail.com'),
    );
    expect(adminEmail).toBeDefined();
    expect(adminEmail!.subject).not.toContain('(GROUP)');
  });

  it('Square payment metadata has group_registration="false" for 7 attendees', async () => {
    const { squarePaymentCaptures } = mockFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 7 })));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);

    expect(squarePaymentCaptures).toHaveLength(1);
    const meta = squarePaymentCaptures[0].metadata;
    expect(meta).toHaveProperty('group_registration');
    expect(meta.group_registration).toBe('false');
  });

  it('same booking: attendee_count is "7" in Square metadata', async () => {
    const { squarePaymentCaptures } = mockFetch();

    await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 7 })));

    const meta = squarePaymentCaptures[0].metadata;
    expect(meta.attendee_count).toBe('7');
  });

  it('boundary check: 9 attendees also stays non-GROUP (one below threshold)', async () => {
    const { resendCalls, squarePaymentCaptures } = mockFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 9 })));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);

    const adminEmail = resendCalls.find((c) =>
      c.to.includes('corsairtacticalsolutions@gmail.com'),
    );
    expect(adminEmail!.subject).not.toContain('(GROUP)');
    expect(squarePaymentCaptures[0].metadata.group_registration).toBe('false');
  });

  it('boundary check: 10 attendees IS GROUP (at the threshold)', async () => {
    const { resendCalls, squarePaymentCaptures } = mockFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 10 })));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);

    const adminEmail = resendCalls.find((c) =>
      c.to.includes('corsairtacticalsolutions@gmail.com'),
    );
    expect(adminEmail!.subject).toContain('(GROUP)');
    expect(squarePaymentCaptures[0].metadata.group_registration).toBe('true');
  });

  it('boundary check: 5 attendees is NOT GROUP (formerly would have been under old threshold=5)', async () => {
    const { resendCalls, squarePaymentCaptures } = mockFetch();

    const res = await createPaymentPost(makeReq(makePaymentBody({ attendeeCount: 5 })));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);

    const adminEmail = resendCalls.find((c) =>
      c.to.includes('corsairtacticalsolutions@gmail.com'),
    );
    expect(adminEmail!.subject).not.toContain('(GROUP)');
    expect(squarePaymentCaptures[0].metadata.group_registration).toBe('false');
  });
});
