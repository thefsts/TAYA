/**
 * Group-registration flag tests — Task #314
 *
 * Confirms that POST /api/square/create-order stamps group_registration=true
 * in Square order metadata when attendeeCount >= GROUP_REGISTRATION_MIN_ATTENDEES,
 * and group_registration=false below the threshold.
 *
 * The constant is imported from @/lib/square so the test stays in sync with
 * any future threshold changes automatically.
 *
 * No live Square API calls are made; global fetch is mocked per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock @/lib/square before route imports ────────────────────────────────────
vi.mock('@/lib/square', () => ({
  SQUARE_BASE_URL: 'https://square.test',
  SQUARE_VERSION: '2024-11-20',
  GROUP_REGISTRATION_MIN_ATTENDEES: 10,
  isSquareConfigured: vi.fn(() => true),
  newIdempotencyKey: vi.fn(() => 'test-idempotency-key'),
}));

import { GROUP_REGISTRATION_MIN_ATTENDEES } from '@/lib/square';
import { isSquareConfigured } from '@/lib/square';
import { POST as createOrderPost } from '@/app/api/square/create-order/route';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// basic-handgun-skills-training / bh-1session: $75 tuition + $25 range fee = $100/seat
const COURSE = 'basic-handgun-skills-training';
const OPTION = 'bh-1session';

function makeReq(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request;
}

type OrderPayload = {
  order: {
    metadata: Record<string, string>;
    [key: string]: unknown;
  };
};

/**
 * Mocks global fetch for create-order tests.
 * Captures the Square order payload so metadata can be inspected.
 */
function mockOrderFetch(): { captured: OrderPayload | null } {
  const ref: { captured: OrderPayload | null } = { captured: null };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string | URL, opts?: RequestInit) => {
      ref.captured = JSON.parse((opts as RequestInit).body as string) as OrderPayload;
      return {
        ok: true,
        json: async () => ({
          order: { id: 'ord_test_group', total_money: { amount: 10000 } },
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Constant sanity
// ═══════════════════════════════════════════════════════════════════════════════

it('GROUP_REGISTRATION_MIN_ATTENDEES equals 10', () => {
  expect(GROUP_REGISTRATION_MIN_ATTENDEES).toBe(10);
});

// ═══════════════════════════════════════════════════════════════════════════════
// create-order — group_registration in Square order metadata
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/square/create-order — group_registration metadata', () => {
  it('stamps group_registration="true" when attendeeCount equals the threshold (10)', async () => {
    const ref = mockOrderFetch();

    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: GROUP_REGISTRATION_MIN_ATTENDEES, // exactly 10
      addOnIds: [],
    }));

    expect(ref.captured).not.toBeNull();
    const meta = ref.captured!.order.metadata;
    expect(meta.group_registration).toBe('true');
  });

  it('stamps group_registration="true" when attendeeCount exceeds the threshold (15)', async () => {
    const ref = mockOrderFetch();

    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: 15,
      addOnIds: [],
    }));

    expect(ref.captured).not.toBeNull();
    expect(ref.captured!.order.metadata.group_registration).toBe('true');
  });

  it('stamps group_registration="false" when attendeeCount is one below the threshold (9)', async () => {
    const ref = mockOrderFetch();

    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: GROUP_REGISTRATION_MIN_ATTENDEES - 1, // exactly 9
      addOnIds: [],
    }));

    expect(ref.captured).not.toBeNull();
    expect(ref.captured!.order.metadata.group_registration).toBe('false');
  });

  it('stamps group_registration="false" for a single attendee (default)', async () => {
    const ref = mockOrderFetch();

    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      attendeeCount: 1,
      addOnIds: [],
    }));

    expect(ref.captured).not.toBeNull();
    expect(ref.captured!.order.metadata.group_registration).toBe('false');
  });

  it('stamps group_registration="false" when attendeeCount defaults (omitted from body)', async () => {
    const ref = mockOrderFetch();

    // No attendeeCount supplied — route defaults to 1
    await createOrderPost(makeReq({
      courseSlug: COURSE,
      pricingOptionId: OPTION,
      addOnIds: [],
    }));

    expect(ref.captured).not.toBeNull();
    expect(ref.captured!.order.metadata.group_registration).toBe('false');
  });

  it('group_registration metadata key is always present (never absent from order)', async () => {
    for (const count of [1, 5, 9, 10, 20]) {
      const ref = mockOrderFetch();
      await createOrderPost(makeReq({
        courseSlug: COURSE,
        pricingOptionId: OPTION,
        attendeeCount: count,
        addOnIds: [],
      }));
      expect(ref.captured).not.toBeNull();
      expect(ref.captured!.order.metadata).toHaveProperty('group_registration');
    }
  });
});
