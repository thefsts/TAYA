/**
 * PHASE 2 PR-2 K2 — OWNERSHIP VERIFICATION TESTS.
 * @vitest-environment edge-runtime
 *
 * Pins the §2 ownership-verification contract:
 *   1. State machine: unverified → verification_pending (beginVerification
 *      mints a token) → verified (checkVerification live network check) →
 *      verified flips connectionMode to TAYA_CONNECTED (single writer).
 *   2. Methods: the three self-serve methods (dns_txt / html_meta_token /
 *      bridge_token) each mint a token with correct instructions; the two
 *      connector methods (repo_connector / platform_api) are
 *      SUPERADMIN-approved, never self-serve.
 *   3. §14 discipline: every failed check carries an explicit reason; the
 *      pending state survives a failed check with attempts incremented;
 *      siteVerifications rows record every attempt (verified and failed).
 *   4. TAYA_NATIVE sites have nothing to verify (explicit error).
 *   5. §22 isolation: cross-tenant begin/check is Forbidden; anonymous is
 *      Unauthenticated; getStatus returns null for outsiders (site-scoped).
 *   6. resetVerification (SUPERADMIN-only) re-blocks publishing
 *      (DISCOVERED_EXTERNAL) — publishing authority is server-side, not
 *      client-side.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Fixtures ────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const OWNER_EMAIL = "owner@proofstudio.example";
const OWNER_CLERK = "user_owner_proofstudio";
const OTHER_EMAIL = "rival@competitor.example";
const OTHER_CLERK = "user_rival_competitor";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const SUPERADMIN_CLERK = "user_superadmin_ov";

const SITE_DOMAIN = "proofstudio.example";

async function seed() {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Super Admin",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    const site = await ctx.db.insert("sites", {
      name: "Proof Studio",
      slug: "proof-studio",
      status: "active",
      domain: SITE_DOMAIN,
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      connectionMode: "DISCOVERED_EXTERNAL",
    });
    siteId = site;
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK,
      name: "Proof Owner",
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: site, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: OTHER_CLERK,
      name: "Rival Owner",
      email: OTHER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [],
    });
  });
}

let siteId: any;

beforeEach(async () => {
  t = convexTest(schema, modules);
  siteId = undefined;
  await seed();
  expect(siteId).toBeTruthy();
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  // Default fetch stub: every URL → 404 (§14 explicit failure, never a hang).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
});

afterEach(async () => {
  // Terminal 404 + drain: no leaked network work between tests.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const asOwner = () =>
  t.withIdentity({ subject: OWNER_CLERK, email: OWNER_EMAIL });
const asOther = () =>
  t.withIdentity({ subject: OTHER_CLERK, email: OTHER_EMAIL });
const asSuperadmin = () =>
  t.withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL });

// ─── State machine (§2) ──────────────────────────────────────────────────

describe("ownershipVerification — state machine (§2)", () => {
  it("fresh external site reports unverified with token hidden and no instructions", async () => {
    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("unverified");
    expect(status.token).toBeNull(); // token hidden while unverified
    expect(status.instructions).toEqual([]); // no instructions until a method is picked
    expect(status.connectionMode).toBe("DISCOVERED_EXTERNAL");
    expect(status.attempts).toBe(0);
  });

  it("beginVerification mints a token → verification_pending with per-method instructions", async () => {
    const begun = await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "html_meta_token",
    });
    expect(begun.state).toBe("verification_pending");
    expect(begun.method).toBe("html_meta_token");
    expect(begun.token).toMatch(/^[a-f0-9]{12,64}$/i);
    expect(begun.instructions).toEqual(expect.arrayContaining([
      expect.stringContaining(`<meta name="taya-verification" content="${begun.token}">`),
    ]));

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("verification_pending");
    expect(status.token).toBe(begun.token); // visible while pending (owner needs it)
    expect(status.instructions.length).toBeGreaterThan(0);
  });

  it("two beginnings mint DIFFERENT tokens (no token reuse)", async () => {
    const a = await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "dns_txt",
    });
    const b = await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "dns_txt",
    });
    expect(a.token).not.toBe(b.token);
  });

  it("checkVerification without a pending verification is an explicit error (§14)", async () => {
    await expect(
      asOwner().action(api.ownershipVerification.checkVerification, { siteId }),
    ).rejects.toThrow("No pending verification");
  });

  it("failed check keeps the site pending with attempts incremented and a §14 reason (html_meta_token)", async () => {
    await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "html_meta_token",
    });
    // Default fetch stub → 404 → explicit "Could not fetch" failure.
    const failed = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(failed.state).toBe("verification_pending");
    expect(failed.failureReason).toContain("Could not fetch");

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("verification_pending");
    expect(status.attempts).toBe(1);
    expect(status.lastFailureReason).toContain("Could not fetch");
    // connectionMode is NOT flipped by a failure — still DISCOVERED_EXTERNAL.
    expect(status.connectionMode).toBe("DISCOVERED_EXTERNAL");
  });

  it("verified check flips to TAYA_CONNECTED and records evidence (html_meta_token)", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "html_meta_token" },
    );
    // The owner adds the meta tag — the network check now sees it.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<html><head><meta name="taya-verification" content="${begun.token}"></head><body><h1>Proof</h1></body></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      ),
    );
    const verified = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(verified.state).toBe("verified");
    expect(verified.method).toBe("html_meta_token");
    expect(verified.connectionMode).toBe("TAYA_CONNECTED");
    expect(verified.evidence).toContain("taya-verification");

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("verified");
    expect(status.connectionMode).toBe("TAYA_CONNECTED");
    expect(status.verifiedAt).toBeTruthy();
    // §14 evidence ledger: the attempt row is queryable.
    expect(status.evidence.length).toBeGreaterThanOrEqual(1);
    expect(status.evidence[0].result).toBe("verified");
    expect(status.evidence[0].method).toBe("html_meta_token");
  });

  it("DNS TXT check verifies on the prefixed record and the bare token (dns_txt)", async () => {
    for (const txtValue of [] as string[]) {
      // (loop kept for symmetry; cases asserted below)
      void txtValue;
    }
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "dns_txt" },
    );

    const dohBody = (answerData: string) =>
      new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ name: SITE_DOMAIN, type: 16, data: `"${answerData}"` }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );

    // Prefixed form verifies.
    vi.stubGlobal("fetch", vi.fn(async () => dohBody(`taya-verification=${begun.token}`)));
    const viaPrefixed = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(viaPrefixed.state).toBe("verified");
    expect(viaPrefixed.evidence).toContain("TXT");
  });

  it("DNS TXT bare-token form verifies too", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "dns_txt" },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [{ name: SITE_DOMAIN, type: 16, data: `"${begun.token}"` }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const verified = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(verified.state).toBe("verified");
  });

  it("DNS TXT with the wrong value fails with an explicit expected-value reason (§14)", async () => {
    await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "dns_txt",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [{ name: SITE_DOMAIN, type: 16, data: '"some-other-spf"' }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const failed = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(failed.state).toBe("verification_pending");
    expect(failed.failureReason).toContain("TXT record not found");
    expect(failed.failureReason).toContain("taya-verification=");
  });

  it("bridge_token check verifies via the site's bridge verify ping", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "bridge_token" },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ token: begun.token }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const verified = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(verified.state).toBe("verified");
    expect(verified.method).toBe("bridge_token");
    expect(verified.connectionMode).toBe("TAYA_CONNECTED");
  });

  it("bridge_token with a mismatched token fails explicitly (§14)", async () => {
    await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "bridge_token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ token: "notmymatchingtoken123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const failed = await asOwner().action(
      api.ownershipVerification.checkVerification,
      { siteId },
    );
    expect(failed.state).toBe("verification_pending");
    expect(failed.failureReason).toContain("does not match");
  });

  it("every attempt lands in the siteVerifications ledger (verified AND failed rows)", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "html_meta_token" },
    );
    // One failed attempt (404 fetch) then one verified attempt.
    await asOwner().action(api.ownershipVerification.checkVerification, { siteId });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<html><head><meta name="taya-verification" content="${begun.token}"></head></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      ),
    );
    await asOwner().action(api.ownershipVerification.checkVerification, { siteId });

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.evidence.length).toBe(2);
    const results = status.evidence.map((e: any) => e.result).sort();
    expect(results).toEqual(["failed", "verified"]);
    expect(status.attempts).toBe(2);
  });
});

// ─── Instructions per method (§2 method set) ─────────────────────────────

describe("ownershipVerification — instructions per method", () => {
  it("dns_txt instructions show the TXT record forms", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "dns_txt" },
    );
    expect(begun.instructions.join("\n")).toContain(`taya-verification=${begun.token}`);
    expect(begun.instructions.join("\n")).toContain("bare token");
  });

  it("html_meta_token instructions show the exact meta tag", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "html_meta_token" },
    );
    expect(begun.instructions.join("\n")).toContain(
      `<meta name="taya-verification" content="${begun.token}">`,
    );
  });

  it("bridge_token instructions show the bridge wiring forms", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "bridge_token" },
    );
    const text = begun.instructions.join("\n");
    expect(text).toContain("/api/bridge/verify");
    expect(text).toContain(`data-taya-token="${begun.token}"`);
    expect(text).toContain(`TAYA_BRIDGE_TOKEN="${begun.token}"`);
  });

  it("instructions are generic — no customer names (universal)", async () => {
    for (const method of ["dns_txt", "html_meta_token", "bridge_token"] as const) {
      const begun = await asOwner().action(
        api.ownershipVerification.beginVerification,
        { siteId, method },
      );
      const text = JSON.stringify(begun.instructions).toLowerCase();
      expect(text).not.toContain("corsair");
      expect(text).not.toContain("fstsclientsystem.com");
    }
  });
});

// ─── TAYA_NATIVE guard (§2: nothing to verify) ───────────────────────────

describe("ownershipVerification — TAYA_NATIVE has nothing to verify", () => {
  it("beginVerification on a TAYA_NATIVE site is an explicit error", async () => {
    const nativeClerk = "user_native_hosted_owner";
    const nativeEmail = "native@hosted.example";
    let nativeSiteId: any;
    await t.run(async (ctx) => {
      nativeSiteId = await ctx.db.insert("sites", {
        name: "Native Hosted",
        slug: "native-hosted",
        status: "active",
        domain: "native-hosted.fstsclientsystem.com",
        brandColorPrimary: "#1d4ed8",
        brandColorSecondary: "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
        connectionMode: "TAYA_NATIVE",
      });
      await ctx.db.insert("users", {
        clerkUserId: nativeClerk,
        name: "Native Owner",
        email: nativeEmail,
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: nativeSiteId, role: "owner" }],
      });
    });
    await expect(
      t.withIdentity({ subject: nativeClerk, email: nativeEmail }).action(
        api.ownershipVerification.beginVerification,
        {
          siteId: nativeSiteId,
          method: "html_meta_token",
        },
      ),
    ).rejects.toThrow("TAYA_NATIVE sites are served by TAYA");
  });
});

// ─── §22 isolation + anonymous ───────────────────────────────────────────

describe("ownershipVerification — §22 isolation and anonymous access", () => {
  it("cross-tenant beginVerification is Forbidden", async () => {
    await expect(
      asOther().action(api.ownershipVerification.beginVerification, {
        siteId,
        method: "html_meta_token",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("cross-tenant checkVerification is Forbidden", async () => {
    await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "html_meta_token",
    });
    await expect(
      asOther().action(api.ownershipVerification.checkVerification, { siteId }),
    ).rejects.toThrow("Forbidden");
  });

  it("anonymous beginVerification is Unauthenticated", async () => {
    await expect(
      t.action(api.ownershipVerification.beginVerification, {
        siteId,
        method: "html_meta_token",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("anonymous checkVerification is Unauthenticated", async () => {
    await expect(
      t.action(api.ownershipVerification.checkVerification, { siteId }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("getStatus is site-scoped: outsiders get null, never another tenant's token", async () => {
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "html_meta_token" },
    );
    const outsider = await asOther().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(outsider).toBeNull();
    // sanity: the owner still sees the token (no leak to the outsider).
    const owner = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(owner.token).toBe(begun.token);
  });

  it("a superadmin can read status across tenants (operator support)", async () => {
    const status = await asSuperadmin().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("unverified");
  });
});

// ─── Connector approval + reset (SUPERADMIN-only surfaces) ───────────────

describe("ownershipVerification — connector approval and reset (SUPERADMIN-only)", () => {
  it("approveConnector is forbidden to a plain site owner (§22/§15)", async () => {
    await expect(
      asOwner().mutation(api.ownershipVerification.approveConnector, {
        siteId,
        method: "repo_connector",
        connectorName: "acme-deploy",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("SUPERADMIN approveConnector verifies + connects without a network check", async () => {
    const approved = await asSuperadmin().mutation(
      api.ownershipVerification.approveConnector,
      {
        siteId,
        method: "repo_connector",
        connectorName: "acme-deploy-connector",
      },
    );
    expect(approved.state).toBe("verified");
    expect(approved.method).toBe("repo_connector");
    expect(approved.connectionMode).toBe("TAYA_CONNECTED");

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("verified");
    expect(status.connectionMode).toBe("TAYA_CONNECTED");
    expect(status.evidence[0].evidence).toContain("repository/deployment connector");
    expect(status.evidence[0].evidence).toContain("acme-deploy-connector");
  });

  it("SUPERADMIN approveConnector works for platform_api too", async () => {
    const approved = await asSuperadmin().mutation(
      api.ownershipVerification.approveConnector,
      {
        siteId,
        method: "platform_api",
        connectorName: "wix-platform-auth",
      },
    );
    expect(approved.connectionMode).toBe("TAYA_CONNECTED");
    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.evidence[0].evidence).toContain("site-platform API authorization");
  });

  it("resetVerification is forbidden to a plain site owner", async () => {
    await expect(
      asOwner().mutation(api.ownershipVerification.resetVerification, { siteId }),
    ).rejects.toThrow("Forbidden");
  });

  it("SUPERADMIN resetVerification returns the site to unverified + DISCOVERED_EXTERNAL (publish re-blocks)", async () => {
    // Verify first (so there is something to reset).
    const begun = await asOwner().action(
      api.ownershipVerification.beginVerification,
      { siteId, method: "html_meta_token" },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<html><head><meta name="taya-verification" content="${begun.token}"></head></html>`,
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      ),
    );
    await asOwner().action(api.ownershipVerification.checkVerification, { siteId });

    const reset = await asSuperadmin().mutation(
      api.ownershipVerification.resetVerification,
      { siteId },
    );
    expect(reset.state).toBe("unverified");
    expect(reset.connectionMode).toBe("DISCOVERED_EXTERNAL");

    const status = await asOwner().query(api.ownershipVerification.getStatus, {
      siteId,
    });
    expect(status.state).toBe("unverified");
    expect(status.token).toBeNull();
    expect(status.attempts).toBe(0);

    // Publishing authority immediately re-blocks (server-side verdict).
    const authority = await asOwner().query(api.publishing.canPublish, { siteId });
    expect(authority.canPublish).toBe(false);
    expect(authority.blockedByOwnership).toBe(true);
    expect(authority.connectionMode).toBe("DISCOVERED_EXTERNAL");
  });
});
