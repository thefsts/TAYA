/**
 * ai-tenant-isolation.test.ts
 *
 * MATAYA™ backend tenant-isolation + provider-config suite (convex/ai.ts).
 * @vitest-environment edge-runtime
 *
 * Every MATAYA action (status / chat / generateAltText /
 * generateMetaDescription) is gated by requireSiteAccess, which resolves the
 * Clerk identity and runs internal lib.siteAccessInternal.check against the
 * users table server-side. This suite pins:
 *
 *   1. Authorized access — Client A's owner can use all four actions on
 *      Site A, and the outbound provider request carries the MATAYA/TAYA
 *      system prompt, the section and page-context, and nothing sensitive.
 *   2. Cross-tenant isolation — Client A's owner is Forbidden on every
 *      action for Site B, in both directions, and no provider request is
 *      ever attempted for a denied call.
 *   3. Anonymous — Unauthenticated with no identity, before any provider
 *      request is attempted.
 *   4. Provider config — env is read server-side only. Missing vars yield
 *      configured:false and AI_NOT_CONFIGURED with no outbound fetch; the
 *      plain OPENAI_* fallback vars are honoured when the AI_INTEGRATIONS_*
 *      names are unset; individual missing vars yield unconfigured.
 *   5. Failure taxonomy — provider HTTP failures surface as
 *      AI_PROVIDER_ERROR_<status> with no body/credential leakage; empty
 *      completions surface as AI_EMPTY_RESPONSE.
 *
 * Note on env stubbing: ai.ts reads env with `??`, so an empty string ("")
 * still counts as SET. To make a variable count as unset in these tests, it
 * must be stubbed as `undefined` (which deletes it), not "".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Fixtures ─────────────────────────────────────────────────────────────

const BASE_URL = "https://ai-fixture.example.test/v1";
const API_KEY = "sk-fixture-key-not-real";
const MODEL = "fixture-model";

let t: ReturnType<typeof convexTest>;
let siteA: any;
let siteB: any;

function siteDoc(name: string, slug: string) {
  return {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: {},
  };
}

/** Provider stub: a chat-completions endpoint returning fixed content. */
function stubProvider(content: string) {
  return vi.fn(async () => {
    return new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

beforeEach(async () => {
  t = convexTest(schema, modules);

  vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", BASE_URL);
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", API_KEY);
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_MODEL", MODEL);

  vi.stubGlobal("fetch", stubProvider("MATAYA fixture reply"));

  await t.run(async (ctx) => {
    siteA = await ctx.db.insert("sites", siteDoc("Client A Site", "client-a-site"));
    siteB = await ctx.db.insert("sites", siteDoc("Client B Site", "client-b-site"));
    await ctx.db.insert("users", {
      clerkUserId: "user_client_a",
      name: "Client A Owner",
      email: "owner@client-a.example",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: "user_client_b",
      name: "Client B Owner",
      email: "owner@client-b.example",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteB, role: "owner" }],
    });
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await t.finishInProgressScheduledFunctions();
  await new Promise((r) => setTimeout(r, 0));
});

const asOwnerA = () => t.withIdentity({ subject: "user_client_a", email: "owner@client-a.example" });
const asOwnerB = () => t.withIdentity({ subject: "user_client_b", email: "owner@client-b.example" });

// ── 1. Authorized access ──────────────────────────────────────────────────

describe("authorized tenant — owner A on Site A", () => {
  it("status: reports configured with the model name, no provider call", async () => {
    const fetchMock = vi.mocked(fetch);
    const result = await asOwnerA().action(api.ai.status, { siteId: siteA as Id<"sites"> });
    expect(result).toEqual({ configured: true, model: MODEL });
    expect(fetchMock.mock.calls.length).toBe(0);
  });

  it("chat: returns the assistant reply and sends exactly one provider request", async () => {
    const result = await asOwnerA().action(api.ai.chat, {
      siteId: siteA as Id<"sites">,
      messages: [{ role: "user", content: "How should I describe my services page?" }],
    });
    expect(result.content).toBe("MATAYA fixture reply");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("generateAltText: returns the suggestion with surrounding quotes stripped", async () => {
    vi.stubGlobal("fetch", stubProvider('"A cozy front porch in autumn light"'));
    const result = await asOwnerA().action(api.ai.generateAltText, {
      siteId: siteA as Id<"sites">,
      imageUrl: "https://example.com/porch.jpg",
      context: "Homepage hero image",
    });
    expect(result.altText).toBe("A cozy front porch in autumn light");
  });

  it("generateMetaDescription: returns the description verbatim", async () => {
    vi.stubGlobal("fetch", stubProvider("Warm, patient guitar lessons for every age and level."));
    const result = await asOwnerA().action(api.ai.generateMetaDescription, {
      siteId: siteA as Id<"sites">,
      pageTitle: "About Us",
      pageContent: "We are a family-run guitar studio founded in 2014.",
    });
    expect(result.description).toBe("Warm, patient guitar lessons for every age and level.");
  });
});

// ── 2. Outbound request shape / system prompt ────────────────────────────

describe("outbound provider request", () => {
  it("targets the configured endpoint with the key, MATAYA prompt, and context", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await asOwnerA().action(api.ai.chat, {
      siteId: siteA as Id<"sites">,
      messages: [{ role: "user", content: "Help me with my FAQ page." }],
      section: "SEO Settings",
      pageContext: "Page /about has title About Us",
    });

    expect(fetchMock.mock.calls.length).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);

    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe(MODEL);
    const system = body.messages[0];
    expect(system.role).toBe("system");
    // MATAYA™ by TAYA™ branding — never the obsolete FSTS assistant names.
    expect(system.content).toMatch(/MATAYA™ by TAYA™/);
    expect(system.content).toMatch(/TAYA dashboard/);
    expect(system.content).not.toMatch(/FSTS-WOS|FSTS AI Dashboard Assistant|FSTS Website Operating System/i);
    // Route and page context are threaded into the prompt.
    expect(system.content).toMatch(/SEO Settings/);
    expect(system.content).toMatch(/Page \/about has title About Us/);
    // Secrets never appear inside the prompt body itself.
    expect(system.content).not.toContain(API_KEY);
    expect(system.content).not.toContain(BASE_URL);
  });
});

// ── 3. Cross-tenant isolation ─────────────────────────────────────────────

describe("cross-tenant isolation — owner A cannot touch Site B", () => {
  const siteBId = () => siteB as Id<"sites">;

  it("status: Forbidden", async () => {
    await expect(
      asOwnerA().action(api.ai.status, { siteId: siteBId() }),
    ).rejects.toThrow("Forbidden: site access required");
  });

  it("chat / altText / metaDescription: Forbidden, no provider call attempted", async () => {
    const fetchMock = vi.mocked(fetch);
    await expect(
      asOwnerA().action(api.ai.chat, {
        siteId: siteBId(),
        messages: [{ role: "user", content: "snoop" }],
      }),
    ).rejects.toThrow("Forbidden: site access required");
    await expect(
      asOwnerA().action(api.ai.generateAltText, {
        siteId: siteBId(),
        imageUrl: "https://example.com/x.jpg",
      }),
    ).rejects.toThrow("Forbidden: site access required");
    await expect(
      asOwnerA().action(api.ai.generateMetaDescription, {
        siteId: siteBId(),
        pageTitle: "Snoop",
        pageContent: "Snoop",
      }),
    ).rejects.toThrow("Forbidden: site access required");
    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

describe("cross-tenant isolation — owner B cannot touch Site A", () => {
  it("every action is Forbidden in the reverse direction", async () => {
    const fetchMock = vi.mocked(fetch);
    await expect(
      asOwnerB().action(api.ai.status, { siteId: siteA as Id<"sites"> }),
    ).rejects.toThrow("Forbidden: site access required");
    await expect(
      asOwnerB().action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "snoop" }],
      }),
    ).rejects.toThrow("Forbidden: site access required");
    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

// ── 4. Anonymous access ───────────────────────────────────────────────────

describe("anonymous requests", () => {
  it("status and chat reject Unauthenticated before any provider call", async () => {
    const fetchMock = vi.mocked(fetch);
    await expect(
      t.action(api.ai.status, { siteId: siteA as Id<"sites"> }),
    ).rejects.toThrow("Unauthenticated");
    await expect(
      t.action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("Unauthenticated");
    expect(fetchMock.mock.calls.length).toBe(0);
  });
});

// ── 5. Provider configuration ─────────────────────────────────────────────

describe("provider configuration (server-side env only)", () => {
  it("all six env vars unset: unconfigured, AI_NOT_CONFIGURED, no fetch", async () => {
    // `undefined` DELETES the stub so ai.ts's `??` chain sees them as unset.
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", undefined);
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", undefined);
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_MODEL", undefined);
    vi.stubEnv("OPENAI_BASE_URL", undefined);
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("OPENAI_MODEL", undefined);

    const status = await asOwnerA().action(api.ai.status, { siteId: siteA as Id<"sites"> });
    expect(status.configured).toBe(false);

    const fetchMock = vi.mocked(fetch);
    await expect(
      asOwnerA().action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("AI_NOT_CONFIGURED");
    expect(fetchMock.mock.calls.length).toBe(0);
  });

  it("AI_INTEGRATIONS_* unset falls back to plain OPENAI_* vars", async () => {
    // Delete the AI_INTEGRATIONS_* names so the fallback engages. (Stubbing
    // "" would NOT work: ai.ts reads with `??`, so "" still counts as set.)
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", undefined);
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", undefined);
    vi.stubEnv("OPENAI_BASE_URL", BASE_URL);
    vi.stubEnv("OPENAI_API_KEY", API_KEY);

    const status = await asOwnerA().action(api.ai.status, { siteId: siteA as Id<"sites"> });
    expect(status.configured).toBe(true);

    const result = await asOwnerA().action(api.ai.chat, {
      siteId: siteA as Id<"sites">,
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.content).toBe("MATAYA fixture reply");
  });

  it("base URL set but API key missing: still unconfigured, no fetch", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", undefined);
    const status = await asOwnerA().action(api.ai.status, { siteId: siteA as Id<"sites"> });
    expect(status.configured).toBe(false);
    await expect(
      asOwnerA().action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("AI_NOT_CONFIGURED");
    expect(fetch).toHaveBeenCalledTimes(0);
  });
});

// ── 6. Failure taxonomy ───────────────────────────────────────────────────

describe("provider failure taxonomy", () => {
  it("HTTP 503: throws AI_PROVIDER_ERROR_503 with no body or credential leakage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ error: { message: "upstream exploded", code: "secret-detail" } }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const err = await asOwnerA()
      .action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "hi" }],
      })
      .then(() => null, (e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/^AI_PROVIDER_ERROR_503$/);
    // The provider's raw error body never leaks into the thrown message.
    expect((err as Error).message).not.toMatch(/upstream exploded|secret-detail/);
    expect((err as Error).message).not.toContain(API_KEY);
    expect((err as Error).message).not.toContain(BASE_URL);
  });

  it("empty completion content: throws AI_EMPTY_RESPONSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ choices: [{ message: { role: "assistant", content: "   " } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(
      asOwnerA().action(api.ai.chat, {
        siteId: siteA as Id<"sites">,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow("AI_EMPTY_RESPONSE");
  });
});
