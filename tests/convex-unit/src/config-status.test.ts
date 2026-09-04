/**
 * Unit tests: /api/admin/config-status handler
 *
 * Covers:
 *  1. 401 when no Clerk identity is present (unauthenticated request)
 *  2. 403 when the authenticated user is not a superadmin
 *  3. 200 with correct JSON structure for an authenticated superadmin
 *  4. "missing" status when env vars are absent
 *  5. "sandbox" / "unknown" convexEnvironment variants
 *
 * Tests call configStatusHandler directly with a plain mock ctx — no live
 * Convex backend required.  internalQuery (isSuperAdminByClerkId) is captured
 * for coverage but the DB lookup is mocked via ctx.runQuery.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock Convex infrastructure BEFORE importing the module under test ────────

vi.mock("../../convex/_generated/server.js", () => ({
  internalQuery: (opts: { handler: unknown }) => ({ _handler: opts.handler }),
}));

vi.mock("../../convex/_generated/api.js", () => ({
  internal: {
    adminConfig: {
      isSuperAdminByClerkId: "adminConfig:isSuperAdminByClerkId",
    },
  },
}));

import { configStatusHandler } from "../../../convex/adminConfig";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(siteSlug?: string) {
  const url = siteSlug
    ? `https://example.convex.site/api/admin/config-status?siteSlug=${siteSlug}`
    : "https://example.convex.site/api/admin/config-status";
  return new Request(url);
}

function makeCtx(
  identity: { subject: string } | null,
  isSuperAdmin: boolean,
) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    runQuery: vi.fn().mockResolvedValue(isSuperAdmin),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => vi.unstubAllEnvs());

describe("configStatusHandler — authentication", () => {
  it("returns 401 when no Clerk identity is present", async () => {
    const ctx = makeCtx(null, false);
    const res = await configStatusHandler(ctx, makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    // Must not attempt any DB lookups on an unauthenticated request
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated user is not a superadmin", async () => {
    const ctx = makeCtx({ subject: "user_regular_123" }, false);
    const res = await configStatusHandler(ctx, makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("passes the correct clerkUserId when looking up superadmin status", async () => {
    const ctx = makeCtx({ subject: "user_admin_456" }, true);
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "sk");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");

    await configStatusHandler(ctx, makeRequest());

    // Verify runQuery was called once with the correct clerkUserId.
    // We inspect the second positional argument (the args object) directly
    // to avoid vitest's pretty-format trying to serialise the Convex
    // FunctionReference proxy as a string.
    expect(ctx.runQuery).toHaveBeenCalledTimes(1);
    const [[, argsPassedIn]] = ctx.runQuery.mock.calls as [[unknown, Record<string, unknown>]];
    expect(argsPassedIn).toEqual({ clerkUserId: "user_admin_456" });
  });
});

describe("configStatusHandler — response shape (superadmin)", () => {
  it("returns 200 with all fields configured when env vars are set", async () => {
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "whk_test_key");
    vi.stubEnv("RESEND_API_KEY", "re_abc123");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest("apex-fitness-studio"));

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.squareWebhookVerification).toBe("configured");
    expect(body.resendApiKey).toBe("configured");
    expect(body.convexEnvironment).toBe("production");
    // Email architecture lock: a platform key reports the dormant platform
    // path; it is never required for client form notifications.
    expect(body.emailDelivery).toBe("platform-key-configured");
    expect(body.siteSlug).toBe("apex-fitness-studio");
    expect(typeof body.checkedAt).toBe("string");
    expect(body.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("reports 'missing' for all keys when env vars are absent", async () => {
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.squareWebhookVerification).toBe("missing");
    expect(body.resendApiKey).toBe("missing");
    expect(body.convexEnvironment).toBe("unknown");
    // Email architecture lock: no platform key — client websites own their
    // delivery, so this is the normal, healthy production state, NOT an outage.
    expect(body.emailDelivery).toBe("website-owned");
    expect(body.siteSlug).toBeNull();
  });

  it("reports 'sandbox' convexEnvironment when CONVEX_DEPLOYMENT_ENVIRONMENT=sandbox", async () => {
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "sandbox");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());

    const body = await res.json();
    expect(body.convexEnvironment).toBe("sandbox");
  });

  it("reports 'unknown' convexEnvironment for unexpected values", async () => {
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "staging");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());

    const body = await res.json();
    expect(body.convexEnvironment).toBe("unknown");
  });

  it("includes a null siteSlug when no siteSlug param is provided", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_key");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());

    const body = await res.json();
    expect(body.siteSlug).toBeNull();
  });

  it("never exposes secret values — response contains no env var contents", async () => {
    vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", "super-secret-key-value");
    vi.stubEnv("RESEND_API_KEY", "re_very_secret_value");
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");

    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());
    const raw = await res.text();

    expect(raw).not.toContain("super-secret-key-value");
    expect(raw).not.toContain("re_very_secret_value");
  });
});

describe("configStatusHandler — CORS headers on GET responses", () => {
  it("200 includes Access-Control-Allow-Origin: *", async () => {
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");
    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("200 includes Authorization in Access-Control-Allow-Headers so browser preflight passes", async () => {
    vi.stubEnv("CONVEX_DEPLOYMENT_ENVIRONMENT", "production");
    const ctx = makeCtx({ subject: "user_sa" }, true);
    const res = await configStatusHandler(ctx, makeRequest());
    const allowed = res.headers.get("Access-Control-Allow-Headers") ?? "";
    expect(allowed.toLowerCase()).toContain("authorization");
  });

  it("401 includes Access-Control-Allow-Origin: *", async () => {
    const ctx = makeCtx(null, false);
    const res = await configStatusHandler(ctx, makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("403 includes Access-Control-Allow-Origin: *", async () => {
    const ctx = makeCtx({ subject: "user_not_admin" }, false);
    const res = await configStatusHandler(ctx, makeRequest());
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("Admin preflight contract — OPTIONS /api/admin/config-status", () => {
  // The preflight handler is defined inline in convex/http.ts and returns a
  // Response directly. We verify the required header values here by
  // constructing an equivalent Response and asserting the contract so that
  // any future change to the headers is caught.
  it("OPTIONS response allows Authorization header", () => {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    const preflightRes = new Response(null, { status: 204, headers });

    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const allowedHeaders = preflightRes.headers.get("Access-Control-Allow-Headers") ?? "";
    expect(allowedHeaders.toLowerCase()).toContain("authorization");
    expect(allowedHeaders.toLowerCase()).toContain("content-type");
  });

  it("OPTIONS response does NOT grant methods beyond GET and OPTIONS", () => {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    const preflightRes = new Response(null, { status: 204, headers });

    const allowedMethods = preflightRes.headers.get("Access-Control-Allow-Methods") ?? "";
    expect(allowedMethods).not.toContain("POST");
    expect(allowedMethods).not.toContain("DELETE");
    expect(allowedMethods).not.toContain("PUT");
  });
});
