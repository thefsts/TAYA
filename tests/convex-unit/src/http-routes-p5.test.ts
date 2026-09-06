/**
 * Tests: P5 public HTTP route fixes
 *
 * Covers three defects found by the unauthenticated production audit:
 *
 *   FIX 2 — dead singular routes:
 *     GET /api/public/jobs and GET /api/public/policy were registered for
 *     CORS preflight since Phase 2 but had NO GET handler, so public API
 *     consumers calling the singular spellings got 404s with no CORS
 *     headers. Both now alias the plural routes' queries
 *     (getCareersBySlug / getPoliciesBySlug) and return identical data.
 *
 *   FIX 3 — /api/public/submit info leak:
 *     POST /api/public/submit with an unknown slug previously crashed the
 *     insert mutation ("Site not found" thrown out of formSubmissions), and
 *     the generic catch echoed err.message — which contained the full
 *     server-side stack trace (file paths + line numbers) — in a public 500
 *     response. The handler now pre-checks the slug and returns a clean
 *     404, and the catch block returns a generic message with no leak.
 *
 * Route capture strategy mirrors widget-cache.test.ts: mock convex/server's
 * httpRouter and _generated/server so importing http.ts registers every
 * route's raw handler in a Map, then drive handlers with real Request
 * objects. ctx.runQuery routing is matched by args shape (not function
 * reference identity) so the tests are insensitive to how `internal.*`
 * references resolve.
 */

import { describe, it, expect, vi } from "vitest";

// ─── Hoisted route capture ─────────────────────────────────────────────────
const capturedRoutes = vi.hoisted(
  () => new Map<string, (ctx: unknown, req: Request) => Promise<Response>>()
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

// Import http.ts — populates capturedRoutes as a side effect.
import "../../convex/http.js";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const SLUG = "corsair-tactical-solutions";

const CAREERS_DATA = [
  { _id: "job_1", title: "Tactical Instructor", isActive: true },
  { _id: "job_2", title: "Range Safety Officer", isActive: true },
];

const POLICIES_DATA = [
  { _id: "pol_1", title: "Privacy Policy", slug: "privacy" },
];

const SITE_STUB = { _id: "site_qd7cp", name: "Corsair", slug: SLUG };

// `internal.*` references inside http.ts resolve through the real anyApi
// Proxy from convex/server — plain objects whose String() coercion carries
// no path info. The tests therefore never inspect fnRef. Instead, each ctx
// mock routes by ARG/RETURN shape, which is deterministic per handler:
//   - careers/jobs/policies/policy handlers: exactly ONE runQuery({slug})
//     whose return value is the response body → return the fixture data.
//   - submit handler: ONE runQuery (getSiteBySlug) → return the site stub
//     (or null to simulate unknown slug); then ONE runMutation → return an
//     id, or throw to simulate a mid-insert Convex error.
function careersCtx(data: unknown = CAREERS_DATA) {
  return {
    runQuery: vi.fn(async () => data),
    runMutation: vi.fn(async () => "id"),
  };
}

// ─── GET /api/public/jobs ──────────────────────────────────────────────────

describe("GET /api/public/jobs (singular alias of /careers)", () => {
  const KEY = "GET:/api/public/jobs";
  const PLURAL_KEY = "GET:/api/public/careers";

  it("route is registered with a GET handler", () => {
    expect(capturedRoutes.has(KEY)).toBe(true);
  });

  it("returns 200 + JSON + CORS headers with careers data", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(
      careersCtx(CAREERS_DATA),
      new Request(`https://convex.test/api/public/jobs?slug=${SLUG}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as unknown[];
    expect(body).toEqual(CAREERS_DATA);
  });

  it("returns 404 when slug missing", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(
      careersCtx(),
      new Request("https://convex.test/api/public/jobs")
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "slug required" });
  });

  it("returns data identical to the plural /careers route", async () => {
    const singular = await capturedRoutes.get(KEY)!(
      careersCtx(CAREERS_DATA),
      new Request(`https://convex.test/api/public/jobs?slug=${SLUG}`)
    );
    const plural = await capturedRoutes.get(PLURAL_KEY)!(
      careersCtx(CAREERS_DATA),
      new Request(`https://convex.test/api/public/careers?slug=${SLUG}`)
    );
    expect(await singular.json()).toEqual(await plural.json());
    expect(singular.status).toBe(plural.status);
  });
});

// ─── GET /api/public/policy ────────────────────────────────────────────────

describe("GET /api/public/policy (singular alias of /policies)", () => {
  const KEY = "GET:/api/public/policy";
  const PLURAL_KEY = "GET:/api/public/policies";

  it("route is registered with a GET handler", () => {
    expect(capturedRoutes.has(KEY)).toBe(true);
  });

  it("returns 200 + JSON + CORS headers with policies data", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(
      careersCtx(POLICIES_DATA),
      new Request(`https://convex.test/api/public/policy?slug=${SLUG}`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual(POLICIES_DATA);
  });

  it("returns 404 when slug missing", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(
      careersCtx(),
      new Request("https://convex.test/api/public/policy")
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "slug required" });
  });

  it("returns data identical to the plural /policies route", async () => {
    const singular = await capturedRoutes.get(KEY)!(
      careersCtx(POLICIES_DATA),
      new Request(`https://convex.test/api/public/policy?slug=${SLUG}`)
    );
    const plural = await capturedRoutes.get(PLURAL_KEY)!(
      careersCtx(POLICIES_DATA),
      new Request(`https://convex.test/api/public/policies?slug=${SLUG}`)
    );
    expect(await singular.json()).toEqual(await plural.json());
    expect(singular.status).toBe(plural.status);
  });
});

// ─── POST /api/public/submit ───────────────────────────────────────────────

describe("POST /api/public/submit", () => {
  const KEY = "POST:/api/public/submit";

  function submitCtx(site: unknown, submitError: Error | null = null) {
    return {
      runQuery: vi.fn(async () => site),
      runMutation: vi.fn(async () => {
        if (submitError) throw submitError;
        return "submission_id_123";
      }),
    };
  }

  function submitRequest(slug: string) {
    return new Request("https://convex.test/api/public/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        formType: "contact",
        name: "Test User",
        email: "test@example.com",
        message: "Hello",
      }),
    });
  }

  it("route is registered", () => {
    expect(capturedRoutes.has(KEY)).toBe(true);
  });

  it("returns 404 with clean JSON for unknown slug (was 500 + stack leak)", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const handler = capturedRoutes.get(KEY)!;
      const res = await handler(
        submitCtx(null),
        submitRequest("no-such-site")
      );
      expect(res.status).toBe(404);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      const body = await res.json();
      expect(body).toEqual({ error: "site not found" });
      // The insert mutation must never run for an unknown site.
    } finally {
      errSpy.mockRestore();
    }
  });

  it("does not leak stack traces in any error body", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const handler = capturedRoutes.get(KEY)!;
      // Force the runMutation to throw a Convex-style error containing a
      // stack trace, as the production defect did.
      const res = await handler(
        submitCtx(SITE_STUB, new Error("Uncaught Error: Site not found\n    at submitHandler (../convex/formSubmissions.ts:76:19)")),
        submitRequest(SLUG)
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      const body = JSON.parse(text) as { error: string };
      expect(body.error).toBe("submission failed");
      expect(text).not.toContain("formSubmissions.ts");
      expect(text).not.toContain("submitHandler");
      expect(text).not.toContain("Uncaught");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("returns 200 with id for a valid submission", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(submitCtx(SITE_STUB), submitRequest(SLUG));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "submission_id_123" });
  });

  it("returns 400 when slug or formType missing", async () => {
    const handler = capturedRoutes.get(KEY)!;
    const res = await handler(
      submitCtx(SITE_STUB),
      new Request("https://convex.test/api/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: SLUG }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "slug and formType required" });
  });
});
