/**
 * Tests: GET /widget/reviews.js — ETag conditional-response cache behavior
 *
 * The widget handler in convex/http.ts computes:
 *   etag = `"${Math.max(site._creationTime, contentTs)}"`
 * where contentTs comes from internal.reviews.getWidgetCacheTimestamp.
 *
 * These tests capture the real httpAction handler by mocking the Convex
 * infrastructure layer and importing http.ts as a side-effect, then drive
 * the handler directly with mocked ctx.runQuery and real Request objects.
 *
 * ctx.runQuery routing strategy:
 *   The widget handler calls runQuery with two distinct arg shapes:
 *     { slug }   → getSiteBySlug  → return the test site stub
 *     { siteId } → getWidgetCacheTimestamp → return contentTs
 *   Matching on args (not on the function-reference identity) makes the
 *   tests insensitive to how `internal.*.*` references are resolved, whether
 *   by the real anyApi Proxy or a mock — the correct branch fires either way.
 *
 * The four-step cycle tested:
 *   1. Initial GET (no If-None-Match)            → 200 + ETag E1
 *   2. Conditional GET (If-None-Match: E1)        → 304  (cache hit)
 *   3. After review/settings change, same header  → 200 + ETag E2 ≠ E1
 *   4. Conditional GET (If-None-Match: E2)        → 304  (cache re-confirmed)
 */

import { describe, it, expect, vi } from "vitest";

// ── Hoist shared state so vi.mock factories can close over it ──────────────
const capturedRoutes = vi.hoisted(
  () => new Map<string, (ctx: unknown, req: Request) => Promise<Response>>()
);

// ── Mock Convex infrastructure ─────────────────────────────────────────────

// Use importOriginal so that other convex/server exports (queryGeneric, etc.)
// that _generated/server.js depends on remain intact — only httpRouter is
// replaced with a capturing stub.
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
          capturedRoutes.set(
            `${config.method}:${config.path}`,
            config.handler._handler
          );
        }
      },
    }),
  };
});

vi.mock("../../convex/_generated/server.js", () => ({
  httpAction: (fn: (ctx: unknown, req: Request) => Promise<Response>) => ({
    _handler: fn,
  }),
  query: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  mutation: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalMutation: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalAction: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
  internalQuery: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
}));

// ── Import http.ts — populates capturedRoutes as a side effect ─────────────
//
// `internal` references inside the widget handler resolve to real anyApi
// Proxy objects from convex/server — we never need to inspect them because
// ctx.runQuery is matched by argument shape (see makeCtx below).
import "../../convex/http.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const WIDGET_KEY = "GET:/widget/reviews.js";
const BASE_URL = "https://test.convex.site/widget/reviews.js?slug=acme";

interface MockSite {
  _id: string;
  _creationTime: number;
}

/**
 * Builds a minimal ctx mock for the widget handler.
 *
 * The widget handler issues exactly two runQuery calls with distinct arg shapes:
 *   { slug }   → getSiteBySlug          → return the site stub
 *   { siteId } → getWidgetCacheTimestamp → return contentTs
 *
 * Routing by args (not by function-reference identity) is necessary because
 * the real `internal.*.*` references are live anyApi Proxy objects whose
 * identity cannot be predicted or controlled from outside the handler.
 */
function makeCtx(site: MockSite, contentTs: number) {
  return {
    runQuery: vi.fn(
      async (
        _queryRef: unknown,
        args: Record<string, unknown>
      ): Promise<unknown> => {
        if (args && "slug" in args) return site;
        if (args && "siteId" in args) return contentTs;
        return null;
      }
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Widget ETag conditional-response tests (real handler)
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /widget/reviews.js — ETag conditional response (real handler)", () => {
  const site: MockSite = { _id: "site_abc", _creationTime: 1_000 };

  it("route is registered and handler is captured from http.ts", () => {
    expect(capturedRoutes.has(WIDGET_KEY)).toBe(true);
  });

  it("step 1: initial GET (no If-None-Match) returns 200 with an ETag header", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;
    const ctx = makeCtx(site, 5_000);
    const req = new Request(BASE_URL);

    const res = await handler(ctx, req);

    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag");
    expect(etag).not.toBeNull();
    expect(etag).toBe('"5000"');
  });

  it("step 2: conditional GET with the stored ETag returns 304 (cache hit)", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;
    const ctx = makeCtx(site, 5_000);

    // First request to learn the ETag.
    const res1 = await handler(ctx, new Request(BASE_URL));
    const etag = res1.headers.get("ETag")!;

    // Repeat with If-None-Match header set.
    const req2 = new Request(BASE_URL, { headers: { "If-None-Match": etag } });
    const res2 = await handler(ctx, req2);

    expect(res2.status).toBe(304);
  });

  it("step 3a: after a review is approved/hidden/pinned, conditional GET returns 200 with a new ETag", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;

    // Before the review change.
    const ctxBefore = makeCtx(site, 5_000);
    const res1 = await handler(ctxBefore, new Request(BASE_URL));
    const oldEtag = res1.headers.get("ETag")!;

    // A review mutation stamps updatedAt = 9_000; getWidgetCacheTimestamp now returns 9_000.
    const ctxAfter = makeCtx(site, 9_000);
    const req2 = new Request(BASE_URL, { headers: { "If-None-Match": oldEtag } });
    const res2 = await handler(ctxAfter, req2);

    expect(res2.status).toBe(200);
    const newEtag = res2.headers.get("ETag")!;
    expect(newEtag).not.toBe(oldEtag);
    expect(newEtag).toBe('"9000"');
  });

  it("step 3b: after display settings are updated, conditional GET returns 200 with a new ETag", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;

    // Before the settings change.
    const ctxBefore = makeCtx(site, 5_000);
    const res1 = await handler(ctxBefore, new Request(BASE_URL));
    const oldEtag = res1.headers.get("ETag")!;

    // updateDisplaySettings stamps updatedAt = 7_500.
    const ctxAfter = makeCtx(site, 7_500);
    const req2 = new Request(BASE_URL, { headers: { "If-None-Match": oldEtag } });
    const res2 = await handler(ctxAfter, req2);

    expect(res2.status).toBe(200);
    const newEtag = res2.headers.get("ETag")!;
    expect(newEtag).not.toBe(oldEtag);
    expect(newEtag).toBe('"7500"');
  });

  it("step 4: conditional GET with the fresh ETag after a change returns 304 (cache re-confirmed)", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;

    // Get the fresh ETag after a content change.
    const ctxAfter = makeCtx(site, 9_000);
    const res1 = await handler(ctxAfter, new Request(BASE_URL));
    const freshEtag = res1.headers.get("ETag")!;

    // Conditional GET with the fresh ETag must return 304.
    const req2 = new Request(BASE_URL, { headers: { "If-None-Match": freshEtag } });
    const res2 = await handler(ctxAfter, req2);

    expect(res2.status).toBe(304);
    expect(res2.headers.get("ETag")).toBe(freshEtag);
  });

  it("ETag floor: site._creationTime is used when contentTs is lower", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;
    const ctx = makeCtx(site, 0); // contentTs below site creation time
    const req = new Request(BASE_URL);

    const res = await handler(ctx, req);

    expect(res.status).toBe(200);
    // ETag must reflect site._creationTime (1_000), not contentTs (0).
    expect(res.headers.get("ETag")).toBe(`"${site._creationTime}"`);
  });

  it("unknown slug returns 200 JS error shim (not 404) and no ETag", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;
    const ctx = {
      runQuery: vi.fn(async (): Promise<unknown> => null), // site not found
    };
    const req = new Request(BASE_URL);

    const res = await handler(ctx, req);

    // The handler returns 200 with a console.error shim — not a 404.
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("console.error");
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("missing slug returns 200 JS error shim and no ETag", async () => {
    const handler = capturedRoutes.get(WIDGET_KEY)!;
    const ctx = { runQuery: vi.fn(async (): Promise<unknown> => null) };
    const req = new Request("https://test.convex.site/widget/reviews.js"); // no ?slug=

    const res = await handler(ctx, req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("console.error");
    expect(res.headers.get("ETag")).toBeNull();
  });
});
