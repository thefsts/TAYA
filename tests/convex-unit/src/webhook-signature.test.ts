/**
 * Square Webhook Signature Verification Tests
 *
 * These tests exercise the actual POST /api/square/webhook HTTP handler
 * in convex/http.ts to verify that signature validation gates are enforced:
 *   - Missing webhookSignatureKey in config → 401 (no key configured)
 *   - Missing Square-Signature header      → 401 (header absent)
 *   - Invalid / tampered signature         → 401 (HMAC mismatch)
 *   - Valid HMAC-SHA256 signature          → 200 (processed or duplicate)
 *
 * Uses the same captured-handler pattern as widget-cache.test.ts:
 *   1. vi.mock replaces httpRouter with a capturing stub
 *   2. Importing convex/http.ts populates capturedRoutes as a side-effect
 *   3. Tests drive the raw handler function directly with crafted Requests
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, vi } from "vitest";

// ── Capture HTTP routes ──────────────────────────────────────────────────────
const capturedRoutes = vi.hoisted(
  () => new Map<string, (ctx: unknown, req: Request) => Promise<Response>>(),
);

vi.mock("convex/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/server")>();
  return {
    ...actual,
    httpRouter: () => ({
      route: (config: {
        path: string;
        method: string;
        handler: { _handler: (ctx: unknown, req: Request) => Promise<Response> };
      }) => {
        if (config.handler?._handler) {
          capturedRoutes.set(`${config.method}:${config.path}`, config.handler._handler);
        }
      },
    }),
  };
});

vi.mock("../../convex/_generated/server.js", () => ({
  httpAction: (fn: (ctx: unknown, req: Request) => Promise<Response>) => ({
    _handler: fn,
  }),
  query:           (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  mutation:        (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalMutation:(opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalAction:  (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalQuery:   (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  action:          (opts: { handler: unknown }) => ({ _handler: opts.handler }),
}));

// Populate capturedRoutes
import "../../convex/http.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_KEY = "POST:/api/square/webhook";
const WEBHOOK_URL  = "https://test.convex.site/api/square/webhook?slug=test-site";

/** Compute the HMAC-SHA256 signature Square would send. */
async function computeSquareSignature(signingKey: string, url: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(url + body));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
}

const SIGNING_KEY = "test-webhook-signing-key";
const SITE_ID     = "k17abc0000000000000000" as const;

/**
 * Minimal ctx mock for the Square webhook handler.
 * The handler calls:
 *   ctx.runQuery(internal.square.getSiteBySlugInternal, { slug })   → site | null
 *   ctx.runQuery(internal.square.getConfigInternal, { siteId })     → cfg  | null
 *   ctx.runMutation(internal.squareOrders.upsertOrderFromWebhook, …) → { orderId, duplicate }
 *   ctx.runMutation(internal.square.webhookUpsertOrder, …)          → …
 *
 * Routing is done by argument shape (not by function-reference identity).
 */
function makeCtx(opts: {
  siteExists?: boolean;
  signingKey?: string | null;
  upsertDuplicate?: boolean;
}) {
  const {
    siteExists    = true,
    signingKey    = SIGNING_KEY,
    upsertDuplicate = false,
  } = opts;

  const site = siteExists ? { _id: SITE_ID, slug: "test-site" } : null;
  const cfg  = signingKey !== null
    ? { webhookSignatureKey: signingKey, connected: true }
    : { connected: false };

  return {
    runQuery: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
      if ("slug" in args) return site;
      if ("siteId" in args && !("squareEventId" in args) && !("orderId" in args)) return cfg;
      return null;
    }),
    runMutation: vi.fn(async () => ({ orderId: "order_111", duplicate: upsertDuplicate })),
    scheduler: { runAfter: vi.fn(), runAt: vi.fn() },
    runAction: vi.fn(async () => ({ success: true })),
  };
}

function squareEventBody(eventId = "ev_001"): string {
  return JSON.stringify({
    type: "payment.created",
    event_id: eventId,
    data: {
      object: {
        payment: {
          id: "pay_001",
          order_id: "order_001",
          amount_money: { amount: 1500, currency: "USD" },
          status: "COMPLETED",
          created_at: new Date().toISOString(),
          buyer_email_address: "buyer@example.com",
        },
      },
    },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/square/webhook — signature verification (real handler)", () => {

  it("handler is captured from http.ts", () => {
    expect(capturedRoutes.has(WEBHOOK_KEY)).toBe(true);
  });

  // ── Scenario 4: missing webhookSignatureKey → 401 ─────────────────────────
  it("Scenario 4 — returns 401 when webhookSignatureKey is absent from config", async () => {
    const handler = capturedRoutes.get(WEBHOOK_KEY)!;
    const body     = squareEventBody();
    const ctx      = makeCtx({ signingKey: null });
    // signingKey: null → cfg has no webhookSignatureKey

    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Square-Signature": "any-value",
      },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(401);

    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/not configured/i);
  });

  // ── Scenario 5a: missing Square-Signature header → 401 ────────────────────
  it("Scenario 5a — returns 401 when Square-Signature header is absent", async () => {
    const handler = capturedRoutes.get(WEBHOOK_KEY)!;
    const body     = squareEventBody();
    const ctx      = makeCtx({ signingKey: SIGNING_KEY });

    // No Square-Signature header
    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(401);

    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/missing.*signature/i);
  });

  // ── Scenario 5b: invalid / tampered signature → 401 ───────────────────────
  it("Scenario 5b — returns 401 when Square-Signature is tampered", async () => {
    const handler = capturedRoutes.get(WEBHOOK_KEY)!;
    const body     = squareEventBody();
    const ctx      = makeCtx({ signingKey: SIGNING_KEY });

    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Square-Signature": "definitely-wrong-signature",
      },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(401);

    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/invalid signature/i);
  });

  // ── Scenario 1: valid HMAC signature → 200 ────────────────────────────────
  it("Scenario 1 — valid HMAC-SHA256 signature returns 200", async () => {
    const handler  = capturedRoutes.get(WEBHOOK_KEY)!;
    const body     = squareEventBody("ev_valid");
    const sig      = await computeSquareSignature(SIGNING_KEY, WEBHOOK_URL, body);
    const ctx      = makeCtx({ signingKey: SIGNING_KEY });

    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Square-Signature": sig,
      },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(200);

    const json = await res.json() as { received: boolean; duplicate?: boolean };
    expect(json.received).toBe(true);
  });

  // ── Scenario 2: duplicate event → 200 with duplicate flag ─────────────────
  it("Scenario 2 — duplicate event ID returns 200 with duplicate: true", async () => {
    const handler  = capturedRoutes.get(WEBHOOK_KEY)!;
    const body     = squareEventBody("ev_dup");
    const sig      = await computeSquareSignature(SIGNING_KEY, WEBHOOK_URL, body);
    const ctx      = makeCtx({ signingKey: SIGNING_KEY, upsertDuplicate: true });

    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Square-Signature": sig,
      },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(200);

    const json = await res.json() as { received: boolean; duplicate: boolean };
    expect(json.received).toBe(true);
    expect(json.duplicate).toBe(true);
  });

  // ── Site not found → 404 ───────────────────────────────────────────────────
  it("returns 404 when the site slug is not found", async () => {
    const handler = capturedRoutes.get(WEBHOOK_KEY)!;
    const body    = squareEventBody();
    const ctx     = makeCtx({ siteExists: false });

    const req = new Request(WEBHOOK_URL, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "Square-Signature": "any",
      },
    });

    const res = await handler(ctx, req);
    expect(res.status).toBe(404);
  });
});
