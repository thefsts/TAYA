/**
 * PHASE 2 PR-2 K3 — CONNECTION MODES TESTS.
 * @vitest-environment edge-runtime
 *
 * Pins the §6 three-locked-modes contract:
 *
 *   TAYA_NATIVE         can publish (TAYA hosts it).
 *   TAYA_CONNECTED      can publish (ownership verified — bridge flow).
 *   DISCOVERED_EXTERNAL CANNOT publish — server-blocked with the exact
 *                       PUBLISH_BLOCKED_MESSAGE. DRAFTING stays allowed.
 *
 * The publish gate is SERVER-SIDE: publishContentMap re-reads the mode at
 * publish time and throws even when the caller holds CONTENT_UPDATE (the
 * owner does). No UI path can bypass it. A null/absent mode is never a
 * silent pass — explicit "not identified yet" reason.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import {
  CONNECTION_MODES,
  PUBLISH_BLOCKED_MESSAGE,
  connectionModeOf,
  publishAuthorityFor,
} from "../../../convex/publishing";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Pure: the locked mode set + authority matrix ────────────────────────

describe("connection modes — locked set (pure)", () => {
  it("CONNECTION_MODES is exactly the three modes, no more, no less", () => {
    expect([...CONNECTION_MODES]).toEqual([
      "TAYA_NATIVE",
      "TAYA_CONNECTED",
      "DISCOVERED_EXTERNAL",
    ]);
  });

  it("PUBLISH_BLOCKED_MESSAGE is the exact contract string (UI renders verbatim)", () => {
    expect(PUBLISH_BLOCKED_MESSAGE).toBe(
      "Publishing connection required: verify ownership of your site to enable publishing. Use Site Verification in your workspace.",
    );
  });

  it("connectionModeOf accepts only the three locked values", () => {
    expect(connectionModeOf({ connectionMode: "TAYA_NATIVE" })).toBe("TAYA_NATIVE");
    expect(connectionModeOf({ connectionMode: "TAYA_CONNECTED" })).toBe("TAYA_CONNECTED");
    expect(connectionModeOf({ connectionMode: "DISCOVERED_EXTERNAL" })).toBe("DISCOVERED_EXTERNAL");
    expect(connectionModeOf({ connectionMode: "taya_native" })).toBeNull(); // case-sensitive
    expect(connectionModeOf({ connectionMode: "SOMETHING_ELSE" })).toBeNull();
    expect(connectionModeOf({})).toBeNull();
    expect(connectionModeOf(null)).toBeNull();
    expect(connectionModeOf(undefined)).toBeNull();
  });
});

describe("connection modes — publishAuthorityFor matrix (pure)", () => {
  it("TAYA_NATIVE → can publish, native reason, not blocked by ownership", () => {
    const a = publishAuthorityFor({ _id: "s1", connectionMode: "TAYA_NATIVE" });
    expect(a.canPublish).toBe(true);
    expect(a.connectionMode).toBe("TAYA_NATIVE");
    expect(a.blockedByOwnership).toBe(false);
    expect(a.reason).toBe("TAYA_NATIVE: the site is hosted by TAYA and publishes directly.");
  });

  it("TAYA_CONNECTED → can publish, bridge reason, not blocked by ownership", () => {
    const a = publishAuthorityFor({ _id: "s1", connectionMode: "TAYA_CONNECTED" });
    expect(a.canPublish).toBe(true);
    expect(a.connectionMode).toBe("TAYA_CONNECTED");
    expect(a.blockedByOwnership).toBe(false);
    expect(a.reason).toBe(
      "TAYA_CONNECTED: ownership verified — publishing flows through the TAYA Web Bridge.",
    );
  });

  it("DISCOVERED_EXTERNAL → CANNOT publish, exact block message, blockedByOwnership", () => {
    const a = publishAuthorityFor({ _id: "s1", connectionMode: "DISCOVERED_EXTERNAL" });
    expect(a.canPublish).toBe(false);
    expect(a.connectionMode).toBe("DISCOVERED_EXTERNAL");
    expect(a.blockedByOwnership).toBe(true);
    expect(a.reason).toBe(PUBLISH_BLOCKED_MESSAGE);
  });

  it("verification_pending does NOT soften the DISCOVERED_EXTERNAL block", () => {
    const a = publishAuthorityFor({
      _id: "s1",
      connectionMode: "DISCOVERED_EXTERNAL",
      ownershipVerification: { state: "verification_pending", token: "abc" },
    });
    expect(a.canPublish).toBe(false);
    expect(a.reason).toBe(PUBLISH_BLOCKED_MESSAGE);
    expect(a.ownershipState).toBe("verification_pending");
  });

  it("null mode (discovery not yet landed) → cannot publish, explicit reason, not ownership-blocked", () => {
    const a = publishAuthorityFor({ _id: "s1" });
    expect(a.canPublish).toBe(false);
    expect(a.connectionMode).toBeNull();
    expect(a.blockedByOwnership).toBe(false);
    expect(a.reason).toBe(
      "Publishing mode not identified yet — discovery is still running for this site.",
    );
  });

  it("unknown/garbage mode values are never treated as publishable (fail-closed)", () => {
    for (const garbage of ["fsts_native", "", "external", "connected", "NATIVE"]) {
      const a = publishAuthorityFor({ _id: "s1", connectionMode: garbage });
      expect(a.canPublish, `mode ${JSON.stringify(garbage)} must not publish`).toBe(false);
    }
  });

  it("the authority is UNIVERSAL — no customer names anywhere in reasons", () => {
    const modes: Array<Record<string, unknown>> = [
      { connectionMode: "TAYA_NATIVE" },
      { connectionMode: "TAYA_CONNECTED" },
      { connectionMode: "DISCOVERED_EXTERNAL" },
      {},
    ];
    for (const site of modes) {
      const a = publishAuthorityFor({ _id: "s", ...site } as any);
      expect(a.reason.toLowerCase()).not.toContain("corsair");
    }
  });
});

// ─── Integration: the server-side gate (convexTest) ──────────────────────

let t: ReturnType<typeof convexTest>;

const OWNER_EMAIL = "owner@modescheck.example";
const OWNER_CLERK = "user_owner_modescheck";
const OTHER_EMAIL = "outsider@rival.example";
const OTHER_CLERK = "user_outsider_rival";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const SUPERADMIN_CLERK = "user_superadmin_cm";

let siteId: any;
let contentMapId: any;

async function seedSite(mode: string | null) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Super Admin",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    siteId = await ctx.db.insert("sites", {
      name: "Modes Check Studio",
      slug: "modes-check-studio",
      status: "active",
      domain: "modescheck.example",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      ...(mode ? { connectionMode: mode } : {}),
    });
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK,
      name: "Modes Owner",
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId, role: "owner" }], // owner holds CONTENT_UPDATE
    });
    await ctx.db.insert("users", {
      clerkUserId: OTHER_CLERK,
      name: "Outsider",
      email: OTHER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [],
    });
    // A discovered content map with one entry (no overlays yet).
    contentMapId = await ctx.db.insert("siteContentMaps", {
      siteId,
      version: 1,
      domain: "modescheck.example",
      pages: [{ path: "/", label: "Home", keyCount: 1 }],
      entries: {
        "home.hero.heading": {
          type: "text",
          discovered: "Discovered Heading",
          evidence: "h1",
        },
      },
      keyCount: 1,
      conformed: true,
    });
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  siteId = undefined;
  contentMapId = undefined;
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
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

const asOwner = () => t.withIdentity({ subject: OWNER_CLERK, email: OWNER_EMAIL });
const asOther = () => t.withIdentity({ subject: OTHER_CLERK, email: OTHER_EMAIL });

describe("connection modes — canPublish query (integration)", () => {
  it("canPublish mirrors the authority per mode", async () => {
    for (const mode of ["TAYA_NATIVE", "TAYA_CONNECTED", "DISCOVERED_EXTERNAL", null]) {
      await seedSite(mode);
      const verdict = await asOwner().query(api.publishing.canPublish, { siteId });
      expect(verdict.connectionMode).toBe(mode);
      if (mode === "DISCOVERED_EXTERNAL" || mode === null) {
        expect(verdict.canPublish).toBe(false);
      } else {
        expect(verdict.canPublish).toBe(true);
      }
      // reset for next loop iteration
      t = convexTest(schema, modules);
      siteId = undefined;
      contentMapId = undefined;
    }
  });

  it("canPublish is site-scoped: a cross-tenant caller gets null (§22)", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    const outsider = await asOther().query(api.publishing.canPublish, { siteId });
    expect(outsider).toBeNull();
  });
});

describe("connection modes — the SERVER-side publish gate (integration)", () => {
  it("publish on an UNVERIFIED external site throws the exact block message EVEN THOUGH the owner holds CONTENT_UPDATE", async () => {
    await seedSite("DISCOVERED_EXTERNAL");

    // Drafting is allowed unverified (§16).
    const drafted = await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "home.hero.heading", value: "My New Heading" }],
    });
    expect(drafted.ok).toBe(true);

    // Publishing is server-blocked — permission is necessary but NOT
    // sufficient. The owner has content.update; the mode gate still throws.
    let blocked: any = null;
    try {
      await asOwner().mutation(api.publishing.publishContentMap, { siteId });
    } catch (e: any) {
      blocked = e;
    }
    expect(blocked).toBeTruthy();
    expect(String(blocked?.message ?? blocked)).toBe(PUBLISH_BLOCKED_MESSAGE);
    // NOTE: Convex rolls back the whole mutation transaction on throw, so
    // the in-transaction logActivity("publish_blocked") write does not
    // persist — the §14 contract surfaces through the throw message itself
    // (and through the canPublish verdict, asserted across the suite).

    // The draft SURVIVED the blocked publish (still not published).
    await t.run(async (ctx) => {
      const map = await ctx.db.get(contentMapId);
      expect((map as any).entries["home.hero.heading"].draft).toBe("My New Heading");
      expect((map as any).entries["home.hero.heading"].published).toBeUndefined();
    });
  });

  it("publish works on TAYA_CONNECTED: drafts promote to published, versions + activity recorded", async () => {
    await seedSite("TAYA_CONNECTED");

    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [
        { key: "home.hero.heading", value: "Published Heading" },
        { key: "nonexistent.key.path", value: "ignored" }, // unknown keys ignored
      ],
    });

    const published = await asOwner().mutation(api.publishing.publishContentMap, { siteId });
    expect(published.ok).toBe(true);
    expect(published.publishedKeys).toBe(1); // the unknown key is NOT published
    expect(published.publishedAt).toBeGreaterThan(0);

    await t.run(async (ctx) => {
      const map = await ctx.db.get(contentMapId);
      const entry = (map as any).entries["home.hero.heading"];
      expect(entry.published).toBe("Published Heading");
      expect(entry.draft).toBeUndefined(); // draft cleared after publish
      expect(entry.discovered).toBe("Discovered Heading"); // baseline untouched

      // §17 revision history: a contentVersions row with the publish snapshot.
      const versions = await ctx.db
        .query("contentVersions")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      const publishRows = versions.filter(
        (v: any) => v.entityType === "content_map_publish",
      );
      expect(publishRows.length).toBe(1);
      expect(publishRows[0].snapshot).toMatchObject({
        connectionMode: "TAYA_CONNECTED",
      });
      expect((publishRows[0].snapshot as any).keys["home.hero.heading"]).toBe(
        "Published Heading",
      );

      // Activity: the publish was logged.
      const rows = await ctx.db.query("activityLog").collect();
      const publishedRows = rows.filter(
        (r: any) => String(r.siteId) === String(siteId) && r.action === "published",
      );
      expect(publishedRows.length).toBe(1);
    });
  });

  it("publish with nothing drafted is an explicit no-op error (§14)", async () => {
    await seedSite("TAYA_CONNECTED");
    await expect(
      asOwner().mutation(api.publishing.publishContentMap, { siteId }),
    ).rejects.toThrow("Nothing to publish");
  });

  it("discardDraft reverts a draft to the discovered value", async () => {
    await seedSite("DISCOVERED_EXTERNAL"); // drafting allowed unverified
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "home.hero.heading", value: "Draft I Regret" }],
    });
    const discarded = await asOwner().mutation(api.publishing.discardDraft, {
      siteId,
      keys: ["home.hero.heading"],
    });
    expect(discarded.ok).toBe(true);
    await t.run(async (ctx) => {
      const map = await ctx.db.get(contentMapId);
      expect((map as any).entries["home.hero.heading"].draft).toBeUndefined();
      expect((map as any).entries["home.hero.heading"].discovered).toBe("Discovered Heading");
    });
  });

  it("saveDraft ignores unknown keys (allowlist = map keys)", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    const applied = await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "totally.unknown.key", value: "nope" }],
    });
    expect(applied.ok).toBe(true);
    await t.run(async (ctx) => {
      const map = await ctx.db.get(contentMapId);
      expect((map as any).entries["totally.unknown.key"]).toBeUndefined();
    });
  });

  it("a null-mode site (discovery not yet landed) cannot publish either (fail-closed)", async () => {
    await seedSite(null);
    await expect(
      asOwner().mutation(api.publishing.publishContentMap, { siteId }),
    ).rejects.toThrow("Publishing mode not identified yet");
  });

  it("cross-tenant saveDraft is Forbidden (§22)", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    await expect(
      asOther().mutation(api.publishing.saveDraft, {
        siteId,
        entries: [{ key: "home.hero.heading", value: "hostile takeover" }],
      }),
    ).rejects.toThrow(/Forbidden|you do not have access/i);
  });
});
