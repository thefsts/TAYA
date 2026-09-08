/**
 * PHASE 2 PR-2 K6 — PUBLISHING WORKFLOW TESTS (complementary to K3).
 * @vitest-environment edge-runtime
 *
 * K3 (connection-modes.test.ts) pins the §6 mode gate itself: the locked
 * three-mode set, the exact PUBLISH_BLOCKED_MESSAGE, the canPublish matrix,
 * the unverified publish throw (with draft survival), the "Nothing to
 * publish" guard, unknown-key filtering in saveDraft, and cross-tenant
 * Forbidden. This file pins the WORKFLOW AROUND the gate:
 *
 *   saveDraft     — §14 activity rows ("saved"), the details format incl.
 *                   >3-key truncation, singular/plural forms, stale revival
 *                   on edit, the empty-entries guard, the map-less failure.
 *   discardDraft  — "discarded" activity rows, draft removal with
 *                   published/discovered preserved, stale NOT cleared (only
 *                   drafting or publishing revives), empty-keys guard,
 *                   no-op discard of undrafted/unknown keys.
 *   publishContentMap — explicit `keys` subset semantics (exactly those
 *                   keys promoted, other drafts stay pending), publishing a
 *                   stale never-drafted key (effective value fallback
 *                   draft ?? published ?? discovered + stale cleared), the
 *                   §17 contentVersions snapshot shape, the "published"
 *                   activity row, the map-less failure on a publishable
 *                   site.
 *   RBAC floor    — a read_only member (content.view only) is Forbidden on
 *                   all three mutations EVEN ON a publishable TAYA_CONNECTED
 *                   site (permission is checked BEFORE the mode gate, and
 *                   nothing is written); a superadmin bypasses the floor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Identities ───────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const OWNER_EMAIL = "priya@pubtest.example";
const OWNER_CLERK = "user_priya_pubtest";
const OWNER_NAME = "Priya Pubtest";
// read_only role: CONTENT_VIEW + MEDIA_VIEW only — no content.update.
const VIEWER_EMAIL = "vic@pubtest.example";
const VIEWER_CLERK = "user_vic_pubtest";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const SUPERADMIN_CLERK = "user_superadmin_pubtest";

let siteId: any;
let mapId: any;

/**
 * Seed a site + owner + read_only viewer (+ superadmin) and a §5 content
 * map with four discovered keys, one of which is STALE (as a refresh crawl
 * would leave it). `withMap: false` skips the map row entirely.
 */
async function seedSite(mode: string, withMap = true) {
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
      name: "Pubtest Studio",
      slug: "pubtest-studio",
      status: "active",
      domain: "pubtest.example",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
      connectionMode: mode,
    });
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK,
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: VIEWER_CLERK,
      name: "Vic Pubtest",
      email: VIEWER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId, role: "read_only" }],
    });
    if (withMap) {
      mapId = await ctx.db.insert("siteContentMaps", {
        siteId,
        version: 1,
        domain: "pubtest.example",
        pages: [
          { path: "/", label: "Home", keyCount: 2 },
          { path: "/services", label: "Services", keyCount: 1 },
          { path: "/gallery", label: "Gallery", keyCount: 1 },
        ],
        entries: {
          "home.hero.heading": { type: "text", discovered: "Discovered Heading" },
          "home.hero.subheading": { type: "text", discovered: "Discovered Subheading" },
          "services.intro.heading": { type: "text", discovered: "Discovered Intro" },
          "gallery.caption.text": { type: "text", discovered: "Gallery Caption", stale: true },
        },
        keyCount: 4,
        conformed: true,
      });
    }
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  siteId = undefined;
  mapId = undefined;
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
const asViewer = () => t.withIdentity({ subject: VIEWER_CLERK, email: VIEWER_EMAIL });
const asSuper = () =>
  t.withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL });

// ─── saveDraft — activity rows and guards ─────────────────────────────────

describe("saveDraft — activity rows and guards", () => {
  it("writes a 'saved' activity row with §14 details and returns the map keyCount", async () => {
    await seedSite("DISCOVERED_EXTERNAL"); // drafting allowed in every mode (§16)

    const res = await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [
        { key: "home.hero.heading", value: "New Heading" },
        { key: "home.hero.subheading", value: "New Subheading" },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.keyCount).toBe(4);

    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      expect(map.entries["home.hero.heading"].draft).toBe("New Heading");
      expect(map.entries["home.hero.subheading"].draft).toBe("New Subheading");
      expect(typeof map.refreshedAt).toBe("number");

      // Exactly ONE activity row exists and it is the §14 "saved" record.
      const rows: any[] = await ctx.db.query("activityLog").collect();
      expect(rows.length).toBe(1);
      expect(rows[0].actorName).toBe(OWNER_NAME);
      expect(rows[0].action).toBe("saved");
      expect(rows[0].entityType).toBe("content draft");
      expect(rows[0].page).toBe("Visual Editor");
      expect(rows[0].details).toBe(
        "2 keys drafted (home.hero.heading, home.hero.subheading)",
      );
    });
  });

  it("truncates the details list after three keys (§14 formatting)", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [
        { key: "home.hero.heading", value: "1" },
        { key: "home.hero.subheading", value: "2" },
        { key: "services.intro.heading", value: "3" },
        { key: "gallery.caption.text", value: "4" },
      ],
    });
    await t.run(async (ctx) => {
      const rows: any[] = await ctx.db.query("activityLog").collect();
      expect(rows.length).toBe(1);
      // First three keys listed verbatim, then the ellipsis continuation.
      expect(rows[0].details).toBe(
        "4 keys drafted (home.hero.heading, home.hero.subheading, services.intro.heading, \u2026)",
      );
    });
  });

  it("revives a stale key when drafted and logs the singular form", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    // gallery.caption.text is seeded stale (a vanished-on-refresh key).
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "gallery.caption.text", value: "Fresh Caption" }],
    });
    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      const e = map.entries["gallery.caption.text"];
      expect(e.draft).toBe("Fresh Caption");
      expect(e.stale).toBeUndefined(); // editing a stale key revives it
      expect(e.discovered).toBe("Gallery Caption"); // baseline untouched

      const rows: any[] = await ctx.db.query("activityLog").collect();
      expect(rows[0].details).toBe("1 key drafted (gallery.caption.text)");
    });
  });

  it("rejects an empty entries array with an explicit message", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    await expect(
      asOwner().mutation(api.publishing.saveDraft, { siteId, entries: [] }),
    ).rejects.toThrow("No draft entries provided.");
  });

  it("fails explicitly when no content map exists (discovery not completed)", async () => {
    await seedSite("DISCOVERED_EXTERNAL", false);
    await expect(
      asOwner().mutation(api.publishing.saveDraft, {
        siteId,
        entries: [{ key: "home.hero.heading", value: "x" }],
      }),
    ).rejects.toThrow("No content map for this site yet");
  });
});

// ─── discardDraft — guards and activity ───────────────────────────────────

describe("discardDraft — guards and activity", () => {
  it("rejects an empty keys array with an explicit message", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    await expect(
      asOwner().mutation(api.publishing.discardDraft, { siteId, keys: [] }),
    ).rejects.toThrow("No keys provided.");
  });

  it("removes the draft, keeps published and discovered, does NOT clear stale, and logs 'discarded'", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "home.hero.heading", value: "Temp Copy" }],
    });
    // Simulate a key that also carries a published overlay and a stale flag
    // (exactly the state a refresh crawl + earlier publish would leave).
    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      const entries = { ...map.entries };
      entries["home.hero.heading"] = {
        ...entries["home.hero.heading"],
        published: "Old Published",
        stale: true,
      };
      await ctx.db.patch(mapId, { entries });
    });

    const res = await asOwner().mutation(api.publishing.discardDraft, {
      siteId,
      keys: ["home.hero.heading"],
    });
    expect(res.ok).toBe(true);

    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      const e = map.entries["home.hero.heading"];
      expect(e.draft).toBeUndefined(); // the draft is gone
      expect(e.published).toBe("Old Published"); // published overlay survives
      expect(e.discovered).toBe("Discovered Heading"); // baseline survives
      expect(e.stale).toBe(true); // discard NEVER revives a stale key

      const discarded = (await ctx.db.query("activityLog").collect()).filter(
        (r: any) => r.action === "discarded",
      );
      expect(discarded.length).toBe(1);
      expect(discarded[0].actorName).toBe(OWNER_NAME);
      expect(discarded[0].entityType).toBe("content draft");
      expect(discarded[0].page).toBe("Visual Editor");
      expect(discarded[0].details).toBe("1 draft value discarded");
    });
  });

  it("discarding a key with no draft (or an unknown key) is a harmless no-op", async () => {
    await seedSite("DISCOVERED_EXTERNAL");
    const res = await asOwner().mutation(api.publishing.discardDraft, {
      siteId,
      keys: ["home.hero.subheading", "not.a.map.key"],
    });
    expect(res.ok).toBe(true);
    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      expect(map.entries["home.hero.subheading"].discovered).toBe("Discovered Subheading");
      expect(map.entries["not.a.map.key"]).toBeUndefined();
    });
  });
});

// ─── publishContentMap — explicit subsets, stale clearing, versions ────────

describe("publishContentMap — explicit subsets, stale clearing, versions", () => {
  it("publishes exactly the requested keys; other drafts stay pending; §17 version + activity recorded", async () => {
    await seedSite("TAYA_CONNECTED");
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [
        { key: "home.hero.heading", value: "Published Heading" },
        { key: "home.hero.subheading", value: "Published Subheading" },
        { key: "services.intro.heading", value: "Still Pending" },
      ],
    });

    const res = await asOwner().mutation(api.publishing.publishContentMap, {
      siteId,
      keys: ["home.hero.heading", "home.hero.subheading"],
    });
    expect(res.ok).toBe(true);
    expect(res.publishedKeys).toBe(2); // a COUNT, not a list
    expect(res.publishedAt).toBeGreaterThan(0);

    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      expect(map.entries["home.hero.heading"]).toMatchObject({
        published: "Published Heading",
        discovered: "Discovered Heading",
      });
      expect(map.entries["home.hero.heading"].draft).toBeUndefined();
      expect(map.entries["home.hero.subheading"].published).toBe("Published Subheading");
      expect(map.entries["home.hero.subheading"].draft).toBeUndefined();
      // The third draft was NOT in the subset — still pending, not published.
      expect(map.entries["services.intro.heading"].draft).toBe("Still Pending");
      expect(map.entries["services.intro.heading"].published).toBeUndefined();

      // §17 revision history: the publish snapshot records exactly the
      // published subset with the mode and actor.
      const versions: any[] = await ctx.db
        .query("contentVersions")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      const row = versions.find((v: any) => v.entityType === "content_map_publish");
      expect(row).toBeTruthy();
      expect(row.entityId).toBe(String(mapId));
      expect(row.createdByName).toBe(OWNER_NAME);
      expect(row.snapshot.connectionMode).toBe("TAYA_CONNECTED");
      expect(Object.keys(row.snapshot.keys).sort()).toEqual([
        "home.hero.heading",
        "home.hero.subheading",
      ]);
      expect(row.snapshot.keys["home.hero.heading"]).toBe("Published Heading");
      expect(typeof row.snapshot.publishedAt).toBe("number");

      // §14: the publish action is logged with the exact details format.
      const publishedRows = (await ctx.db.query("activityLog").collect()).filter(
        (r: any) => r.action === "published",
      );
      expect(publishedRows.length).toBe(1);
      expect(publishedRows[0].actorName).toBe(OWNER_NAME);
      expect(publishedRows[0].entityType).toBe("content map");
      expect(publishedRows[0].page).toBe("Visual Editor");
      expect(publishedRows[0].details).toBe(
        "Published 2 keys to the live map (TAYA_CONNECTED).",
      );
    });
  });

  it("publishing a stale, never-drafted key clears stale and promotes the effective value", async () => {
    await seedSite("TAYA_CONNECTED");
    // gallery.caption.text is seeded stale with NO draft. Publishing it via
    // an explicit subset re-asserts the effective value (draft ?? published
    // ?? discovered) and revives the key.
    const res = await asOwner().mutation(api.publishing.publishContentMap, {
      siteId,
      keys: ["gallery.caption.text"],
    });
    expect(res.publishedKeys).toBe(1);
    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      const e = map.entries["gallery.caption.text"];
      expect(e.stale).toBeUndefined(); // publish revives stale keys
      expect(e.published).toBe("Gallery Caption"); // effective value promoted
      expect(e.draft).toBeUndefined();
      expect(e.discovered).toBe("Gallery Caption");
    });
  });

  it("fails explicitly on a publishable site with no content map", async () => {
    await seedSite("TAYA_CONNECTED", false); // mode gate passes; map guard fires
    await expect(
      asOwner().mutation(api.publishing.publishContentMap, {
        siteId,
        keys: ["home.hero.heading"],
      }),
    ).rejects.toThrow("No content map for this site yet");
  });
});

// ─── RBAC floor — permissions are checked before the mode gate ─────────────

describe("RBAC floor — permissions are checked before the mode gate", () => {
  it("a read_only member (content.view only) is Forbidden on draft, discard, and publish even on a publishable site", async () => {
    await seedSite("TAYA_CONNECTED");
    await expect(
      asViewer().mutation(api.publishing.saveDraft, {
        siteId,
        entries: [{ key: "home.hero.heading", value: "nope" }],
      }),
    ).rejects.toThrow("your role does not grant 'content.update' on this site.");
    await expect(
      asViewer().mutation(api.publishing.discardDraft, {
        siteId,
        keys: ["home.hero.heading"],
      }),
    ).rejects.toThrow("does not grant 'content.update'");
    // The mode gate would ALLOW this publish (TAYA_CONNECTED) — the RBAC
    // floor is checked FIRST and stops the read_only member cold.
    await expect(
      asViewer().mutation(api.publishing.publishContentMap, {
        siteId,
        keys: ["home.hero.heading"],
      }),
    ).rejects.toThrow("does not grant 'content.update'");

    // Nothing was written: no activity rows, map untouched.
    await t.run(async (ctx) => {
      const rows: any[] = await ctx.db
        .query("activityLog")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      expect(rows.length).toBe(0);
      const map: any = await ctx.db.get(mapId);
      expect(map.entries["home.hero.heading"].draft).toBeUndefined();
      expect(map.entries["home.hero.heading"].published).toBeUndefined();
    });
  });

  it("a superadmin bypasses the permission floor (§22 platform authority)", async () => {
    await seedSite("TAYA_CONNECTED");
    await asSuper().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "home.hero.heading", value: "Super Copy" }],
    });
    const res = await asSuper().mutation(api.publishing.publishContentMap, {
      siteId,
      keys: ["home.hero.heading"],
    });
    expect(res.publishedKeys).toBe(1);
    await t.run(async (ctx) => {
      const map: any = await ctx.db.get(mapId);
      expect(map.entries["home.hero.heading"].published).toBe("Super Copy");
      expect(map.entries["home.hero.heading"].draft).toBeUndefined();
    });
  });
});
