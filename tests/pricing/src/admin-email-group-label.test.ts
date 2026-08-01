/**
 * Admin-email GROUP label tests — Task #330
 *
 * Confirms that the admin (business) notification email sent by the
 * create-payment route contains "(GROUP)" in the subject when
 * isGroupRegistration=true, and omits it for individual registrations.
 *
 * Tests drive the full POST /api/square/create-payment handler with a mocked
 * global fetch so no live Square or Resend API calls are made.
 * RESEND_API_KEY is set in beforeEach to enable the email-sending path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock @/lib/square before route import ─────────────────────────────────────
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
    attendeeCount: 1,
    discountCents: 0,
    ...overrides,
  };
}

// ── Fetch mock ────────────────────────────────────────────────────────────────

/**
 * Stubs global fetch so Square calls succeed with minimal payloads and
 * Resend calls are captured. Returns a ref to all captured Resend payloads.
 */
function mockFetchCapturingResend(): { resendCalls: Array<{ subject: string; to: string[] }> } {
  const resendCalls: Array<{ subject: string; to: string[] }> = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, opts?: RequestInit) => {
      const urlStr = String(url);

      if (urlStr.includes('/v2/customers/search')) {
        return { ok: true, json: async () => ({ customers: [] }) } as unknown as Response;
      }

      if (urlStr.includes('/v2/customers')) {
        return {
          ok: true,
          json: async () => ({ customer: { id: 'cust_test' } }),
        } as unknown as Response;
      }

      if (urlStr.includes('/v2/payments')) {
        return {
          ok: true,
          json: async () => ({
            payment: { id: 'pay_test', status: 'COMPLETED', receipt_url: null },
          }),
        } as unknown as Response;
      }

      // Resend email calls
      if (urlStr.includes('resend.com')) {
        const body = JSON.parse((opts as RequestInit).body as string) as {
          subject: string;
          to: string[];
        };
        resendCalls.push({ subject: body.subject, to: body.to });
        return { ok: true, json: async () => ({ id: 'email_stub' }) } as unknown as Response;
      }

      return { ok: true, json: async () => ({}) } as unknown as Response;
    }),
  );

  return { resendCalls };
}

// ── Environment setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(isSquareConfigured).mockReturnValue(true);
  process.env.SQUARE_ACCESS_TOKEN = 'test-token';
  process.env.SQUARE_LOCATION_ID = 'test-location';
  process.env.RESEND_API_KEY = 'test-resend-key'; // enable email path
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/square/create-payment — admin email GROUP label', () => {
  it('includes (GROUP) in the admin email subject for a group registration', async () => {
    const { resendCalls } = mockFetchCapturingResend();

    const res = await createPaymentPost(
      makeReq(makePaymentBody({ attendeeCount: 10, isGroupRegistration: true })),
    );
    const body = await res.json() as Record<string, unknown>;

    expect(body.success).toBe(true);

    // The first Resend call is the admin (business) notification
    const adminEmail = resendCalls.find((c) => c.to.includes('corsairtacticalsolutions@gmail.com'));
    expect(adminEmail).toBeDefined();
    expect(adminEmail!.subject).toContain('(GROUP)');
  });

  it('omits (GROUP) from the admin email subject for an individual registration', async () => {
    const { resendCalls } = mockFetchCapturingResend();

    const res = await createPaymentPost(
      makeReq(makePaymentBody({ attendeeCount: 1, isGroupRegistration: false })),
    );
    const body = await res.json() as Record<string, unknown>;

    expect(body.success).toBe(true);

    const adminEmail = resendCalls.find((c) => c.to.includes('corsairtacticalsolutions@gmail.com'));
    expect(adminEmail).toBeDefined();
    expect(adminEmail!.subject).not.toContain('(GROUP)');
  });
});
