/**
 * PHASE 2 PR-2 K7 — TAYA WEB BRIDGE HTTP SURFACE + INTERNAL QUERIES.
 * @vitest-environment edge-runtime
 *
 * Part 1 (route capture — harness copied verbatim from http-routes-p5 /
 * widget-cache): mock convex/server httpRouter + _generated/server wrappers,
 * import convex/http.js as a side effect, drive the captured handlers with
 * real Request objects. Each bridge handler makes EXACTLY ONE runQuery or
 * runMutation call, so a single-purpose ctx mock per invocation is
 * deterministic even where two handlers share an args shape ({slug, token}
 * is used by both _draft and _verifyPing — the ctx is what disambiguates).
 *
 * Part 2 (integration — convexTest with a real DB): the internal queries
 * themselves. _content published-only filtering (drafts NEVER leak),
 * _draft token gating + mode gate, _verifyPing match contract,
 * _recordClick upsert/increment, unknown-slug nulls, and cross-site
 * isolation by slug.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Part 1: hoisted route capture (verbatim harness) ─────────────────────

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

// A single-purpose ctx: the handler under test makes exactly one runQuery
// (or runMutation) call, so the canned result fully determines the response.
function ctxWith(queryResult: unknown, mutationResult: unknown = null) {
  return {
    runQuery: vi.fn(async () => queryResult),
    runMutation: vi.fn(async () => mutationResult),
  };
}

const ACAO = "Access-Control-Allow-Origin";

// ─── Route registration + preflights ───────────────────────────────────────

describe("bridge routes — registration + OPTIONS preflights", () => {
  it("registers exactly the nine bridge routes (4 preflights + 5 handlers)", () => {
    const expected = [
      "OPTIONS:/api/bridge/content",
      "OPTIONS:/api/bridge/draft",
      "OPTIONS:/api/bridge/verify",
      "OPTIONS:/api/bridge/click",
      "GET:/api/bridge/content",
      "GET:/api/bridge/draft",
      "POST:/api/bridge/verify",
      "GET:/api/bridge/click",
      "POST:/api/bridge/click",
    ];
    for (const key of expected) {
      expect(capturedRoutes.has(key), `missing route ${key}`).toBe(true);
    }
    expect(capturedRoutes.size).toBeGreaterThanOrEqual(expected.length);
  });

  it("every OPTIONS preflight answers 204 with the four CORS headers", async () => {
    for (const path of [
      "/api/bridge/content",
      "/api/bridge/draft",
      "/api/bridge/verify",
      "/api/bridge/click",
    ]) {
      const handler = capturedRoutes.get(`OPTIONS:${path}`)!;
      const res = await handler({}, new Request(`https://convex.test${path}`, { method: "OPTIONS" }));
      expect(res.status, `${path} preflight status`).toBe(204);
      expect(res.headers.get(ACAO), `${path} ACAO`).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Methods"), `${path} methods`).toBe("GET, POST, OPTIONS");
      expect(res.headers.get("Access-Control-Allow-Headers"), `${path} headers`).toBe("Content-Type");
      expect(res.headers.get("Access-Control-Max-Age"), `${path} max-age`).toBe("86400");
    }
  });
});

// ─── GET /api/bridge/content ───────────────────────────────────────────────

describe("GET /api/bridge/content", () => {
  const KEY = "GET:/api/bridge/content";

  it("404s with 'slug required' when slug is missing", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      new Request("https://convex.test/api/bridge/content")
    );
    expect(res.status).toBe(404);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual({ error: "slug required" });
  });

  it("404s with 'site not found' when the query resolves null", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      new Request("https://convex.test/api/bridge/content?slug=no-such-site")
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "site not found" });
  });

  it("returns 200 + CORS + the manifest payload verbatim", async () => {
    const manifest = {
      version: 1,
      bridgeVersion: 1,
      domain: "proof.example",
      mode: "TAYA_CONNECTED",
      publishedAt: 1700000000000,
      pages: [{ path: "/", label: "Home", keyCount: 2 }],
      values: { "home.hero.heading": "Published Hero" },
    };
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(manifest),
      new Request("https://convex.test/api/bridge/content?slug=proof-site")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual(manifest);
  });
});

// ─── GET /api/bridge/draft ─────────────────────────────────────────────────

describe("GET /api/bridge/draft", () => {
  const KEY = "GET:/api/bridge/draft";

  it("404s when slug or token is missing", async () => {
    for (const url of [
      "https://convex.test/api/bridge/draft",
      "https://convex.test/api/bridge/draft?slug=some-site",
      "https://convex.test/api/bridge/draft?token=abc",
    ]) {
      const res = await capturedRoutes.get(KEY)!(ctxWith(null), new Request(url));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "slug and token params required" });
    }
  });

  it("404s with the combined message for an unknown site OR wrong token", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null), // _draft returns null for unknown slug or bad token
      new Request("https://convex.test/api/bridge/draft?slug=some-site&token=wrong")
    );
    expect(res.status).toBe(404);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual({ error: "site not found or token invalid" });
  });

  it("returns 200 + the owner-preview payload (values + drafts) verbatim", async () => {
    const preview = {
      version: 1,
      bridgeVersion: 1,
      domain: "proof.example",
      mode: "DISCOVERED_EXTERNAL",
      pages: [],
      values: { "home.hero.heading": "Published Hero" },
      drafts: { "home.hero.heading": "Drafted Hero" },
    };
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(preview),
      new Request("https://convex.test/api/bridge/draft?slug=proof-site&token=correct-token")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(preview);
  });
});

// ─── POST /api/bridge/verify ───────────────────────────────────────────────

describe("POST /api/bridge/verify", () => {
  const KEY = "POST:/api/bridge/verify";

  function verifyRequest(body: unknown) {
    return new Request("https://convex.test/api/bridge/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("400s when slug or token is missing from the body", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      verifyRequest({ slug: "some-site" })
    );
    expect(res.status).toBe(400);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual({ error: "slug and token required" });
  });

  it("400s on an invalid JSON body", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      verifyRequest("{not-json")
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid JSON body" });
  });

  it("404s for an unknown slug", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      verifyRequest({ slug: "no-such-site", token: "abc" })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "site not found" });
  });

  it("returns the ping verdict (matches/method/state) with CORS", async () => {
    const verdict = {
      slug: "proof-site",
      matches: true,
      method: "bridge_token",
      state: "verification_pending",
      bridgeVersion: 1,
    };
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(verdict),
      verifyRequest({ slug: "proof-site", token: "correct-token" })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual(verdict);
  });
});

// ─── POST /api/bridge/click + GET fallback ─────────────────────────────────

describe("POST /api/bridge/click", () => {
  const KEY = "POST:/api/bridge/click";

  function clickRequest(body: unknown) {
    return new Request("https://convex.test/api/bridge/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("400s when slug or key is missing", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null),
      clickRequest({ slug: "some-site" })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "slug and key required" });
  });

  it("400s on an invalid JSON body", async () => {
    const res = await capturedRoutes.get(KEY)!(ctxWith(null), clickRequest("{oops"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid JSON body" });
  });

  it("404s for an unknown slug (mutation returned null)", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null, null),
      clickRequest({ slug: "no-such-site", key: "home.hero.heading" })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "site not found" });
  });

  it("returns the click tally and forwards type/path to the mutation", async () => {
    const ctx = ctxWith(null, { ok: true, clicks: 3 });
    const res = await capturedRoutes.get(KEY)!(
      ctx,
      clickRequest({
        slug: "proof-site",
        key: "home.hero.heading",
        type: "text",
        path: "/",
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(ACAO)).toBe("*");
    expect(await res.json()).toEqual({ ok: true, clicks: 3 });
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation.mock.calls[0][1]).toEqual({
      slug: "proof-site",
      key: "home.hero.heading",
      type: "text",
      path: "/",
    });
  });
});

describe("GET /api/bridge/click (image-pixel fallback)", () => {
  const KEY = "GET:/api/bridge/click";

  it("404s (not 400) when slug or key params are missing", async () => {
    for (const url of [
      "https://convex.test/api/bridge/click",
      "https://convex.test/api/bridge/click?slug=some-site",
      "https://convex.test/api/bridge/click?key=home.hero.heading",
    ]) {
      const res = await capturedRoutes.get(KEY)!(ctxWith(null, null), new Request(url));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "slug and key params required" });
    }
  });

  it("404s for an unknown slug", async () => {
    const res = await capturedRoutes.get(KEY)!(
      ctxWith(null, null),
      new Request("https://convex.test/api/bridge/click?slug=no-such-site&key=k")
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "site not found" });
  });

  it("forwards optional type/path and omits them when absent", async () => {
    // With type + path present:
    const ctxFull = ctxWith(null, { ok: true, clicks: 1 });
    const resFull = await capturedRoutes.get(KEY)!(
      ctxFull,
      new Request(
        "https://convex.test/api/bridge/click?slug=proof-site&key=home.hero.heading&type=text&path=/"
      )
    );
    expect(resFull.status).toBe(200);
    expect(await resFull.json()).toEqual({ ok: true, clicks: 1 });
    expect(ctxFull.runMutation.mock.calls[0][1]).toEqual({
      slug: "proof-site",
      key: "home.hero.heading",
      type: "text",
      path: "/",
    });

    // Without type/path the mutation args carry exactly slug + key:
    const ctxBare = ctxWith(null, { ok: true, clicks: 2 });
    const resBare = await capturedRoutes.get(KEY)!(
      ctxBare,
      new Request("https://convex.test/api/bridge/click?slug=proof-site&key=home.hero.heading")
    );
    expect(resBare.status).toBe(200);
    expect(ctxBare.runMutation.mock.calls[0][1]).toEqual({
      slug: "proof-site",
      key: "home.hero.heading",
    });
  });
});

// ─── Part 2: the internal queries against a real database ──────────────────

let t: ReturnType<typeof convexTest>;

const ALPHA_SLUG = "alpha-bridge-studio";
const ALPHA_TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
const BETA_SLUG = "beta-bridge-boutique";
const BETA_TOKEN = "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7";
const NATIVE_SLUG = "native-bridge-site";
const NATIVE_TOKEN = "c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8";

let alphaSiteId: any;
let betaSiteId: any;
let nativeSiteId: any;
let alphaMapId: any;
let betaMapId: any;

async function seedBridgeSites() {
  await t.run(async (ctx) => {
    alphaSiteId = await ctx.db.insert("sites", {
      name: "Alpha Bridge Studio",
      slug: ALPHA_SLUG,
      status: "active",
      domain: "alphabridge.example",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      connectionMode: "DISCOVERED_EXTERNAL",
      ownershipVerification: {
        state: "verification_pending",
        method: "html_meta_token",
        token: ALPHA_TOKEN,
      },
    });
    alphaMapId = await ctx.db.insert("siteContentMaps", {
      siteId: alphaSiteId,
      version: 1,
      domain: "alphabridge.example",
      pages: [
        { path: "/", label: "Home", keyCount: 3 },
        { path: "/gallery", label: "Gallery", keyCount: 1 },
      ],
      entries: {
        // published wins over draft AND discovered
        "home.hero.heading": {
          type: "text",
          discovered: "Discovered Hero",
          draft: "Drafted Hero",
          published: "Published Hero",
        },
        // draft exists, no published → served value is the DISCOVERED one
        "home.hero.subheading": {
          type: "text",
          discovered: "Discovered Sub",
          draft: "Drafted Sub",
        },
        // published, no draft
        "services.intro.heading": {
          type: "text",
          discovered: "Discovered Intro",
          published: "Published Intro",
        },
        // discovered only
        "gallery.caption.text": { type: "text", discovered: "Discovered Caption" },
      },
      keyCount: 4,
      conformed: true,
      refreshedAt: 1700000000000,
    });

    betaSiteId = await ctx.db.insert("sites", {
      name: "Beta Bridge Boutique",
      slug: BETA_SLUG,
      status: "active",
      domain: "betaboutique.example",
      brandColorPrimary: "#9d174d",
      brandColorSecondary: "#1c1917",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      connectionMode: "TAYA_CONNECTED",
      ownershipVerification: {
        state: "verified",
        method: "dns_txt",
        token: BETA_TOKEN,
      },
    });
    betaMapId = await ctx.db.insert("siteContentMaps", {
      siteId: betaSiteId,
      version: 1,
      domain: "betaboutique.example",
      pages: [{ path: "/", label: "Home", keyCount: 1 }],
      entries: {
        "home.hero.heading": {
          type: "text",
          discovered: "Beta Discovered",
          published: "Beta Published",
        },
      },
      keyCount: 1,
      conformed: true,
      refreshedAt: 1700000000001,
    });

    nativeSiteId = await ctx.db.insert("sites", {
      name: "Native Bridge Site",
      slug: NATIVE_SLUG,
      status: "active",
      domain: "nativebridge.example",
      brandColorPrimary: "#065f46",
      brandColorSecondary: "#022c22",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      connectionMode: "TAYA_NATIVE",
      ownershipVerification: {
        state: "verification_pending",
        method: "bridge_token",
        token: NATIVE_TOKEN,
      },
    });
    await ctx.db.insert("siteContentMaps", {
      siteId: nativeSiteId,
      version: 1,
      domain: "nativebridge.example",
      pages: [{ path: "/", label: "Home", keyCount: 1 }],
      entries: {
        "home.hero.heading": {
          type: "text",
          discovered: "Native Discovered",
          draft: "Native Draft",
        },
      },
      keyCount: 1,
      conformed: true,
    });
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  alphaSiteId = undefined;
  betaSiteId = undefined;
  nativeSiteId = undefined;
  alphaMapId = undefined;
  betaMapId = undefined;
  vi.stubEnv("SUPERADMIN_EMAILS", "superadmin@unknown.local");
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await seedBridgeSites();
});

afterEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bridge._content — PUBLISHED-ONLY manifest (no draft ever leaks)", () => {
  it("serves published-over-draft values and never any draft string", async () => {
    const data: any = await t.query(internal.bridge._content, { slug: ALPHA_SLUG });
    expect(data).toBeTruthy();
    expect(data.version).toBe(1);
    expect(data.bridgeVersion).toBe(1);
    expect(data.domain).toBe("alphabridge.example");
    expect(data.mode).toBe("DISCOVERED_EXTERNAL");
    expect(data.publishedAt).toBe(1700000000000);
    expect(data.pages).toEqual([
      { path: "/", label: "Home", keyCount: 3 },
      { path: "/gallery", label: "Gallery", keyCount: 1 },
    ]);
    expect(data.values).toEqual({
      "home.hero.heading": "Published Hero", // published beats draft + discovered
      "home.hero.subheading": "Discovered Sub", // draft hidden, no published → discovered
      "services.intro.heading": "Published Intro",
      "gallery.caption.text": "Discovered Caption",
    });
    // THE invariant: no draft value appears anywhere in the public payload.
    expect(JSON.stringify(data)).not.toContain("Drafted");
  });

  it("returns null for an unknown slug", async () => {
    expect(await t.query(internal.bridge._content, { slug: "no-such-site" })).toBeNull();
  });

  it("returns null for a known site with no content map", async () => {
    // A discovered-but-not-yet-mapped site has nothing to serve.
    let bareId: any;
    await t.run(async (ctx) => {
      bareId = await ctx.db.insert("sites", {
        name: "Bare Site",
        slug: "bare-bridge-site",
        status: "active",
        domain: "bare.example",
        brandColorPrimary: "#1d4ed8",
        brandColorSecondary: "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
        connectionMode: "DISCOVERED_EXTERNAL",
      });
    });
    expect(await t.query(internal.bridge._content, { slug: "bare-bridge-site" })).toBeNull();
    expect(bareId).toBeTruthy();
  });

  it("is isolated by slug: alpha's slug never serves beta's values (§22)", async () => {
    const alpha: any = await t.query(internal.bridge._content, { slug: ALPHA_SLUG });
    const beta: any = await t.query(internal.bridge._content, { slug: BETA_SLUG });
    expect(alpha.values["home.hero.heading"]).toBe("Published Hero");
    expect(beta.values["home.hero.heading"]).toBe("Beta Published");
    expect(JSON.stringify(alpha)).not.toContain("Beta");
    expect(JSON.stringify(beta)).not.toContain("Published Hero"); // alpha's copy
    expect(beta.mode).toBe("TAYA_CONNECTED");
  });
});

describe("bridge._draft — token-gated owner preview", () => {
  it("returns published values PLUS drafts for the site's own token", async () => {
    const data: any = await t.query(internal.bridge._draft, {
      slug: ALPHA_SLUG,
      token: ALPHA_TOKEN,
    });
    expect(data).toBeTruthy();
    expect(data.mode).toBe("DISCOVERED_EXTERNAL");
    expect(data.values).toEqual({
      "home.hero.heading": "Published Hero",
      "home.hero.subheading": "Discovered Sub",
      "services.intro.heading": "Published Intro",
      "gallery.caption.text": "Discovered Caption",
    });
    expect(data.drafts).toEqual({
      "home.hero.heading": "Drafted Hero",
      "home.hero.subheading": "Drafted Sub",
    });
  });

  it("rejects a wrong token with null", async () => {
    expect(
      await t.query(internal.bridge._draft, { slug: ALPHA_SLUG, token: "wrong-token" })
    ).toBeNull();
  });

  it("rejects an empty stored token (no verification begun) with null", async () => {
    let bareId: any;
    await t.run(async (ctx) => {
      bareId = await ctx.db.insert("sites", {
        name: "No Token Site",
        slug: "notoken-bridge-site",
        status: "active",
        domain: "notoken.example",
        brandColorPrimary: "#1d4ed8",
        brandColorSecondary: "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
        connectionMode: "DISCOVERED_EXTERNAL",
      });
      await ctx.db.insert("siteContentMaps", {
        siteId: bareId,
        version: 1,
        domain: "notoken.example",
        pages: [],
        entries: { "home.hero.heading": { type: "text", discovered: "X", draft: "Y" } },
        keyCount: 1,
        conformed: true,
      });
    });
    expect(
      await t.query(internal.bridge._draft, { slug: "notoken-bridge-site", token: "anything" })
    ).toBeNull();
  });

  it("never serves drafts for a TAYA_NATIVE site even with the right token", async () => {
    expect(
      await t.query(internal.bridge._draft, { slug: NATIVE_SLUG, token: NATIVE_TOKEN })
    ).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    expect(
      await t.query(internal.bridge._draft, { slug: "no-such-site", token: ALPHA_TOKEN })
    ).toBeNull();
  });
});

describe("bridge._verifyPing — the bridge_token exchange contract", () => {
  it("reports matches=true with method and state for the correct pair", async () => {
    const data: any = await t.query(internal.bridge._verifyPing, {
      slug: ALPHA_SLUG,
      token: ALPHA_TOKEN,
    });
    expect(data).toEqual({
      slug: ALPHA_SLUG,
      matches: true,
      method: "html_meta_token",
      state: "verification_pending",
      bridgeVersion: 1,
    });
  });

  it("reports matches=false for a wrong token (no error, no leak)", async () => {
    const data: any = await t.query(internal.bridge._verifyPing, {
      slug: ALPHA_SLUG,
      token: "wrong-token",
    });
    expect(data.matches).toBe(false);
    expect(data.state).toBe("verification_pending");
  });

  it("returns null for an unknown slug", async () => {
    expect(
      await t.query(internal.bridge._verifyPing, { slug: "no-such-site", token: "x" })
    ).toBeNull();
  });
});

describe("bridge._recordClick — telemetry upsert", () => {
  it("inserts a new row on first click and increments on repeats (one row per key)", async () => {
    const first: any = await t.mutation(internal.bridge._recordClick, {
      slug: ALPHA_SLUG,
      key: "home.hero.heading",
      type: "text",
      path: "/",
    });
    expect(first).toEqual({ ok: true, clicks: 1 });

    const second: any = await t.mutation(internal.bridge._recordClick, {
      slug: ALPHA_SLUG,
      key: "home.hero.heading",
      path: "/",
    });
    expect(second).toEqual({ ok: true, clicks: 2 });

    await t.run(async (ctx) => {
      const rows: any[] = await ctx.db
        .query("bridgeClicks")
        .withIndex("by_site", (q: any) => q.eq("siteId", alphaSiteId))
        .collect();
      expect(rows.length).toBe(1); // upsert, not append
      expect(rows[0].key).toBe("home.hero.heading");
      expect(rows[0].clicks).toBe(2);
      expect(rows[0].type).toBe("text");
      expect(rows[0].path).toBe("/");
      expect(rows[0].firstClickedAt).toBeLessThanOrEqual(rows[0].lastClickedAt);
    });
  });

  it("keeps separate rows per key", async () => {
    await t.mutation(internal.bridge._recordClick, {
      slug: ALPHA_SLUG,
      key: "home.hero.heading",
    });
    await t.mutation(internal.bridge._recordClick, {
      slug: ALPHA_SLUG,
      key: "gallery.caption.text",
    });
    await t.run(async (ctx) => {
      const rows: any[] = await ctx.db
        .query("bridgeClicks")
        .withIndex("by_site", (q: any) => q.eq("siteId", alphaSiteId))
        .collect();
      expect(rows.length).toBe(2);
      expect(new Set(rows.map((r: any) => r.key))).toEqual(
        new Set(["home.hero.heading", "gallery.caption.text"])
      );
    });
  });

  it("scopes clicks to the resolved site (§22) and nulls on unknown slug", async () => {
    await t.mutation(internal.bridge._recordClick, {
      slug: ALPHA_SLUG,
      key: "home.hero.heading",
    });
    await t.mutation(internal.bridge._recordClick, {
      slug: BETA_SLUG,
      key: "home.hero.heading",
    });
    expect(
      await t.mutation(internal.bridge._recordClick, {
        slug: "no-such-site",
        key: "home.hero.heading",
      })
    ).toBeNull();
    await t.run(async (ctx) => {
      const alphaRows: any[] = await ctx.db
        .query("bridgeClicks")
        .withIndex("by_site", (q: any) => q.eq("siteId", alphaSiteId))
        .collect();
      const betaRows: any[] = await ctx.db
        .query("bridgeClicks")
        .withIndex("by_site", (q: any) => q.eq("siteId", betaSiteId))
        .collect();
      expect(alphaRows.length).toBe(1);
      expect(betaRows.length).toBe(1);
      expect(alphaRows[0].siteId).not.toBe(betaRows[0].siteId);
    });
  });
});
