/**
 * Group-registration flag — Square sandbox integration test
 *
 * Calls the real create-order route handler (the same code that runs in
 * production) with Square credentials pointed at the sandbox.  No fetch is
 * mocked — every outbound request reaches Square's REST API.  After the
 * route returns an orderId the test reads the order back from Square and
 * asserts that order.metadata.group_registration reflects what the route's
 * own logic computed.
 *
 * This catches regressions that the unit-test mock cannot:
 *   • Wrong field name / key in the metadata object
 *   • Threshold constant drifting from GROUP_REGISTRATION_MIN_ATTENDEES
 *   • Serialisation bugs (boolean → string coercion)
 *   • Silent Square rejection of the metadata payload
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GROUP_REGISTRATION_MIN_ATTENDEES = 10  (corsair-source/src/lib/square) │
 * │  attendees >= 10  →  group_registration = "true"                        │
 * │  attendees <  10  →  group_registration = "false"                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Skipped automatically when sandbox credentials are absent.
 * To run against the real Square sandbox set:
 *
 *   SQUARE_SANDBOX_ACCESS_TOKEN=<sandbox access token>
 *   SQUARE_SANDBOX_LOCATION_ID=<sandbox location id>
 *
 * These intentionally differ from the runtime SQUARE_ACCESS_TOKEN /
 * SQUARE_LOCATION_ID env vars so this test can run in CI without touching
 * the live site configuration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ── Route handler (real app code, not a copy) ─────────────────────────────────
// We import the actual Next.js route handler — the same function the production
// server calls.  The next/server alias resolves to our NextResponse shim
// (src/__mocks__/next-server.ts) so the handler runs in plain Node.
import { POST as createOrderPost } from '@/app/api/square/create-order/route';

// GROUP_REGISTRATION_MIN_ATTENDEES imported directly from the app lib so the
// test threshold is always in sync with the application code.
import { GROUP_REGISTRATION_MIN_ATTENDEES, SQUARE_BASE_URL, SQUARE_VERSION } from '@/lib/square';

// ── Credential guard ──────────────────────────────────────────────────────────

const SANDBOX_TOKEN    = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;
const SANDBOX_LOCATION = process.env.SQUARE_SANDBOX_LOCATION_ID;

const credentialsPresent = Boolean(SANDBOX_TOKEN && SANDBOX_LOCATION);

const SKIP_REASON =
  'SQUARE_SANDBOX_ACCESS_TOKEN and/or SQUARE_SANDBOX_LOCATION_ID are not set ' +
  '— skipping Square sandbox integration tests.';

// ── Env var swap ──────────────────────────────────────────────────────────────
// The route reads SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID at call-time.
// We temporarily point them at the sandbox credentials so the real route code
// sends requests to the sandbox, then restore the originals afterwards.

let originalToken:    string | undefined;
let originalLocation: string | undefined;

beforeAll(() => {
  if (!credentialsPresent) return;
  originalToken    = process.env.SQUARE_ACCESS_TOKEN;
  originalLocation = process.env.SQUARE_LOCATION_ID;
  process.env.SQUARE_ACCESS_TOKEN  = SANDBOX_TOKEN!;
  process.env.SQUARE_LOCATION_ID   = SANDBOX_LOCATION!;
  // Ensure the square lib uses the sandbox URL (default when env var is absent).
  process.env.SQUARE_ENVIRONMENT   = 'sandbox';
});

afterAll(() => {
  if (!credentialsPresent) return;
  if (originalToken !== undefined) {
    process.env.SQUARE_ACCESS_TOKEN = originalToken;
  } else {
    delete process.env.SQUARE_ACCESS_TOKEN;
  }
  if (originalLocation !== undefined) {
    process.env.SQUARE_LOCATION_ID = originalLocation;
  } else {
    delete process.env.SQUARE_LOCATION_ID;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal Request shim accepted by the route handler. */
function makeRequest(body: Record<string, unknown>): Request {
  return { json: async () => body } as unknown as Request;
}

/**
 * Calls the real create-order route handler and returns the orderId.
 * Throws if the route returns an error so test failures are explicit.
 */
async function callRouteAndGetOrderId(attendeeCount: number): Promise<string> {
  const req = makeRequest({
    courseSlug:      'basic-handgun-skills-training',
    pricingOptionId: 'bh-1session',
    attendeeCount,
    addOnIds:        [],
  });

  // createOrderPost is the real route handler — no fetch is mocked here.
  const response = await createOrderPost(req);
  const body = await response.json() as {
    success?: boolean;
    orderId?: string;
    error?: string;
  };

  if (!body.success || !body.orderId) {
    throw new Error(
      `create-order route failed for attendeeCount=${attendeeCount}: ${body.error ?? JSON.stringify(body)}`
    );
  }

  return body.orderId;
}

/**
 * Retrieves a Square order by ID directly from the sandbox REST API and
 * returns its metadata record.  This read-back step confirms Square persisted
 * exactly what the route sent — serialisation bugs would surface here even if
 * the create response looked clean.
 */
async function fetchOrderMetadata(orderId: string): Promise<Record<string, string>> {
  const res = await fetch(`${SQUARE_BASE_URL}/v2/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization:    `Bearer ${SANDBOX_TOKEN}`,
      'Content-Type':   'application/json',
      'Square-Version': SQUARE_VERSION,
    },
  });

  const data = (await res.json()) as {
    order?:  { metadata?: Record<string, string> };
    errors?: Array<{ detail?: string }>;
  };

  if (!res.ok || data.errors?.length) {
    const detail = data.errors?.[0]?.detail ?? `HTTP ${res.status}`;
    throw new Error(`Square retrieve-order failed: ${detail}`);
  }

  return data.order?.metadata ?? {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Integration suite
// ═══════════════════════════════════════════════════════════════════════════════

describe('Square sandbox — group_registration set by real create-order route', () => {
  it(`group_registration="true" when attendeeCount equals the threshold (${GROUP_REGISTRATION_MIN_ATTENDEES})`, async () => {
    if (!credentialsPresent) {
      console.warn(`[SKIP] ${SKIP_REASON}`);
      return;
    }

    // Route computes group_registration from attendeeCount; we don't touch it.
    const orderId  = await callRouteAndGetOrderId(GROUP_REGISTRATION_MIN_ATTENDEES);
    const metadata = await fetchOrderMetadata(orderId);

    expect(metadata).toHaveProperty('group_registration');
    // Route stamps String(seatCount >= GROUP_REGISTRATION_MIN_ATTENDEES) → "true"
    expect(metadata.group_registration).toBe('true');
  });

  it('group_registration="true" when attendeeCount exceeds the threshold (15)', async () => {
    if (!credentialsPresent) {
      console.warn(`[SKIP] ${SKIP_REASON}`);
      return;
    }

    const orderId  = await callRouteAndGetOrderId(15);
    const metadata = await fetchOrderMetadata(orderId);

    expect(metadata.group_registration).toBe('true');
  });

  it(`group_registration="false" when attendeeCount is one below the threshold (${GROUP_REGISTRATION_MIN_ATTENDEES - 1})`, async () => {
    if (!credentialsPresent) {
      console.warn(`[SKIP] ${SKIP_REASON}`);
      return;
    }

    const orderId  = await callRouteAndGetOrderId(GROUP_REGISTRATION_MIN_ATTENDEES - 1);
    const metadata = await fetchOrderMetadata(orderId);

    expect(metadata.group_registration).toBe('false');
  });

  it('group_registration="false" for a single attendee', async () => {
    if (!credentialsPresent) {
      console.warn(`[SKIP] ${SKIP_REASON}`);
      return;
    }

    const orderId  = await callRouteAndGetOrderId(1);
    const metadata = await fetchOrderMetadata(orderId);

    expect(metadata.group_registration).toBe('false');
  });

  it('group_registration key is always present in Square metadata for boundary counts', async () => {
    if (!credentialsPresent) {
      console.warn(`[SKIP] ${SKIP_REASON}`);
      return;
    }

    // Test counts that straddle the threshold set by the application constant.
    const cases: Array<{ count: number; expected: string }> = [
      { count: 1,                                      expected: 'false' },
      { count: GROUP_REGISTRATION_MIN_ATTENDEES - 1,   expected: 'false' },
      { count: GROUP_REGISTRATION_MIN_ATTENDEES,        expected: 'true'  },
      { count: GROUP_REGISTRATION_MIN_ATTENDEES + 5,   expected: 'true'  },
    ];

    for (const { count, expected } of cases) {
      const orderId  = await callRouteAndGetOrderId(count);
      const metadata = await fetchOrderMetadata(orderId);

      expect(metadata, `attendeeCount=${count}`).toHaveProperty('group_registration');
      expect(metadata.group_registration, `attendeeCount=${count}`).toBe(expected);
    }
  });
});
