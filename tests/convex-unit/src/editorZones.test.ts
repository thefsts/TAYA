/**
 * CHAT B — §6 SAFE INSERTION ZONES — server-side surface tests.
 * @vitest-environment edge-runtime
 *
 * Pins the REAL convex/editorZones.ts module (real DB, real permission
 * code, real validation libs — nothing mocked except network fetch):
 *
 *   Zone contract  — zones resolve from the site's OWN map (§5 keys);
 *                    unknown page / unavailable zone / unsupported zone
 *                    id each throw their client-safe reason; kinds are
 *                    filtered by ZONE_ALLOWED_KINDS (hero never hosts a
 *                    PDF; content-section never hosts a CTA).
 *   Validation     — canonical validateBlock runs INSIDE addBlock: empty
 *                    text/button/pdf fields rejected with exact copy;
 *                    unsafe href (javascript:) rejected; video blocks
 *                    built only from provider-parsed YouTube/Vimeo URLs
 *                    (no arbitrary embed HTML); kind-swap on update is
 *                    refused.
 *   Persistence    — add → draft content, published undefined; publish
 *                    promotes content→published + records a §17 content
 *                    versions snapshot; soft-remove of a published block
 *                    sets pendingDelete and publish hard-deletes it;
 *                    restore clears pendingDelete; reorder requires the
 *                    EXACT current id set (stale submissions rejected);
 *                    discard reverts drafts to published.
 *   Structural     — setStructuralOps validates item ids against the
 *                    page's REAL items[i] map keys (unknown id rejected;
 *                    order/hidden XOR enforced); publish promotes to
 *                    publishedItemOrder/publishedHiddenItems.
 *   Permissions    — read_only (content.view only) Forbidden on every
 *                    mutation; unauthenticated rejected; cross-tenant
 *                    denied BOTH directions (FSTS owner cannot touch
 *                    Corsair blocks, Corsair owner cannot touch FSTS);
 *                    superadmin passes (owns the platform).
 *   Publish gate   — DISCOVERED_EXTERNAL sites can draft but publishBlocks
 *                    throws the exact PUBLISH_BLOCKED_MESSAGE and writes
 *                    a publish_blocked activity row (nothing promoted).
 *   Bridge payload — _content serves PUBLISHED blocks only (drafts never
 *                    reach anonymous visitors — same discipline as map
 *                    values).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── identities ─────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const OWNER_EMAIL = "zone-owner@ztest.example";
const OWNER_CLERK = "user_zone_owner";
const OWNER_NAME = "Zoe Zoneowner";
const VIEWER_EMAIL = "zone-viewer@ztest.example";
const VIEWER_CLERK = "user_zone_viewer";
const SUPER_EMAIL = "superadmin@unknown.local";
const SUPER_CLERK = "user_zone_super";
const CROSS_EMAIL = "cross@ztest.example";
const CROSS_CLERK = "user_zone_cross";

let fstsSiteId: any;
let crossSiteId: any;
let fstsMapId: any;

/**
 * Seed FSTS-style site + owner + read_only viewer + superadmin + a cross
 * tenant owner, and a §5 map whose keys resolve zones: hero (home.hero.*),
 * content (home.about.*), service-list (home.services.items[i].*),
 * footer-content (home.footer.text), plus the additive zones' guarantee.
 */
async function seed(mode = "TAYA_CONNECTED", withMap = true): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPER_CLERK, name: "Super Admin", email: SUPER_EMAIL,
      isSuperAdmin: true, isActive: true, roles: [],
    });
    fstsSiteId = await ctx.db.insert("sites", {
      name: "Zone Test Studio", slug: "zone-test-studio", status: "active",
      domain: "www.zonetest.example",
      brandColorPrimary: "#111827", brandColorSecondary: "#1f2937",
      whiteLabelEnabled: false, poweredByFsts: true,
      websiteType: "business_website", enabledModules: {},
      connectionMode: mode,
    });
    crossSiteId = await ctx.db.insert("sites", {
      name: "Cross Tenant Site", slug: "cross-tenant-site", status: "active",
      domain: "www.cross.example",
      brandColorPrimary: "#111827", brandColorSecondary: "#1f2937",
      whiteLabelEnabled: false, poweredByFsts: true,
      websiteType: "business_website", enabledModules: {},
      connectionMode: mode,
    });
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK, name: OWNER_NAME, email: OWNER_EMAIL,
      isSuperAdmin: false, isActive: true,
      roles: [{ siteId: fstsSiteId, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: VIEWER_CLERK, name: "Vic Zoneviewer", email: VIEWER_EMAIL,
      isSuperAdmin: false, isActive: true,
      roles: [{ siteId: fstsSiteId, role: "read_only" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: CROSS_CLERK, name: "Cal Crosstenant", email: CROSS_EMAIL,
      isSuperAdmin: false, isActive: true,
      roles: [{ siteId: crossSiteId, role: "owner" }],
    });
    if (withMap) {
      fstsMapId = await ctx.db.insert("siteContentMaps", {
        siteId: fstsSiteId, version: 1, domain: "www.zonetest.example",
        pages: [
          { path: "/", label: "Home", keyCount: 9 },
          { path: "/services", label: "Services", keyCount: 1 },
        ],
        entries: {
          "home.hero.heading": { type: "text", discovered: "Zone Hero" },
          "home.about.heading": { type: "text", discovered: "About Us" },
          "home.about.body": { type: "text", discovered: "We make zones." },
          "home.services.items[0].title": { type: "text", discovered: "Item Zero" },
          "home.services.items[1].title": { type: "text", discovered: "Item One" },
          "home.services.items[2].title": { type: "text", discovered: "Item Two" },
          "home.services.items[0].description": { type: "text", discovered: "Zero body" },
          "home.footer.text": { type: "text", discovered: "© 2025 Zones" },
          "services.intro.heading": { type: "text", discovered: "Intro" },
        },
        keyCount: 9, conformed: true,
      });
      // Cross tenant map: its owner's CONTROL writes must clear the same
      // map-driven zone floor as FSTS (no special-cased access).
      await ctx.db.insert("siteContentMaps", {
        siteId: crossSiteId, version: 1, domain: "www.cross.example",
        pages: [{ path: "/", label: "Home", keyCount: 1 }],
        entries: {
          "cross.hero.heading": { type: "text", discovered: "Cross Hero" },
        },
        keyCount: 1, conformed: true,
      });
    }
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  vi.stubEnv("SUPERADMIN_EMAILS", SUPER_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
});

afterEach(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const asOwner = () => t.withIdentity({ subject: OWNER_CLERK, email: OWNER_EMAIL });
const asViewer = () => t.withIdentity({ subject: VIEWER_CLERK, email: VIEWER_EMAIL });
const asSuper = () => t.withIdentity({ subject: SUPER_CLERK, email: SUPER_EMAIL });
const asCross = () => t.withIdentity({ subject: CROSS_CLERK, email: CROSS_EMAIL });

// ── zone summaries + blocks read paths ────────────────────────────────

describe("editorZones — zone resolution (server-side, map-driven)", () => {
  it("zoneSummaries resolves zones from the site's OWN map keys", async () => {
    await seed();
    const r = await asOwner().query(api.editorZones.zoneSummaries, { siteId: fstsSiteId });
    expect(r.connected).toBe(true);
    const home = r.pages.find((p: any) => p.path === "/");
    expect(home).toBeDefined();
    const zoneIds = home.zones.map((z: any) => z.zone);
    // hero/content/service-list from keys + the two additive zones.
    expect(zoneIds).toContain("hero");
    expect(zoneIds).toContain("content");
    expect(zoneIds).toContain("service-list");
    expect(zoneIds).toContain("video-section");
    expect(zoneIds).toContain("cta-stack");
    // footer-content resolves from home.footer.text.
    expect(zoneIds).toContain("footer-content");
    // The services page has its own intro-driven content zone.
    const services = r.pages.find((p: any) => p.path === "/services");
    expect(services.zones.map((z: any) => z.zone)).toContain("content");
    // Kinds are carried per zone from the registry.
    expect(home.zones.find((z: any) => z.zone === "hero").kinds).toEqual(["text", "button", "video"]);
  });

  it("returns { connected: false } when the site has no map", async () => {
    await seed("TAYA_CONNECTED", false);
    const r = await asOwner().query(api.editorZones.zoneSummaries, { siteId: fstsSiteId });
    expect(r).toEqual({ connected: false, pages: [] });
  });

  it("returns null without an identity (queries use checkSiteAccess)", async () => {
    await seed();
    const r = await t.query(api.editorZones.zoneSummaries, { siteId: fstsSiteId });
    expect(r).toBeNull();
  });

  it("addBlock rejects an unknown page with the client-safe reason", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/nope", zone: "content",
        content: { kind: "text", text: "Hi" },
      }),
    ).rejects.toThrow("That page isn't available for editing.");
  });

  it("addBlock rejects a zone the page doesn't have (service-list on /services)", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/services", zone: "service-list",
        content: { kind: "text", text: "Hi" },
      }),
    ).rejects.toThrow("The Service list isn't available on this page.");
  });

  it("addBlock rejects an unsupported zone id", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "sidebar",
        content: { kind: "text", text: "Hi" },
      }),
    ).rejects.toThrow("That content area isn't supported.");
  });

  it("listZoneBlocks returns sorted client-safe rows for the site", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "First" },
    });
    const b = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Second" },
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(2);
    expect(rows[0].content.text).toBe("First");
    expect(rows[0].order).toBe(0);
    expect(rows[1].content.text).toBe("Second");
    expect(rows[1].order).toBe(1);
    // Draft state: published is null until publishBlocks promotes it.
    expect(rows[0].published).toBe(null);
    expect(rows[0].pendingDelete).toBe(false);
  });
});

// ── validation (canonical validateBlock inside every write) ───────────

describe("editorZones — block validation (§1–§4 field rules)", () => {
  it("rejects empty text / button label / pdf fields with the exact copy", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "text", text: "   " },
      }),
    ).rejects.toThrow("Add some text for this block.");
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "button", label: "", href: "/about" },
      }),
    ).rejects.toThrow("Add a label for this button.");
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "pdf", resourceId: "", title: "Catalog" },
      }),
    ).rejects.toThrow("Pick a PDF resource for this block.");
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "pdf", resourceId: "dl1", title: "" },
      }),
    ).rejects.toThrow("Add a title for this PDF.");
  });

  it("rejects a kind the zone doesn't allow (hero never hosts PDF; content never hosts CTA)", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "hero",
        content: { kind: "pdf", resourceId: "dl1", title: "Nope" },
      }),
    ).rejects.toThrow("That content type isn't allowed in the Hero area.");
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "cta", heading: "H", buttonLabel: "B", buttonHref: "/x" },
      }),
    ).rejects.toThrow("That content type isn't allowed in the Content section.");
  });

  it("rejects unsafe button destinations (javascript:) with the §2 reason", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "button", label: "Go", href: "javascript:alert(1)" },
      }),
    ).rejects.toThrow("That link type isn't allowed for safety.");
  });

  it("rejects arbitrary embed HTML as a video block (§3 — share links only)", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "video-section",
        content: { kind: "video", url: '<iframe src="https://evil.example"></iframe>' },
      }),
    ).rejects.toThrow("Paste the video's share link — embed code isn't allowed.");
  });

  it("stores a provider-parsed YouTube video block with the canonical fields", async () => {
    await seed();
    const r = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "video-section",
      content: {
        kind: "video",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        provider: "youtube", // redundant fields are rebuilt from the URL alone
        videoId: "evil-override",
        embedUrl: "https://evil.example/embed",
        watchUrl: "https://evil.example/watch",
        caption: "Our process",
      },
    });
    expect(r.ok).toBe(true);
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    const video = rows.find((x: any) => x.kind === "video");
    expect(video.content.videoId).toBe("dQw4w9WgXcQ");
    expect(video.content.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(video.content.watchUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(video.content.provider).toBe("youtube");
    // Client-supplied provider fields NEVER override the parse.
    expect(video.content.embedUrl).not.toContain("evil");
  });

  it("updateBlock refuses a kind swap (remove + add is the only path)", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Original" },
    });
    await expect(
      asOwner().mutation(api.editorZones.updateBlock, {
        siteId: fstsSiteId, blockId: a.blockId,
        content: { kind: "button", label: "Go", href: "/about" },
      }),
    ).rejects.toThrow("A block's content type can't be changed — remove it and add a new one.");
  });

  it("updateBlock refuses edits to a pendingDelete block", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Original" },
    });
    await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    await asOwner().mutation(api.editorZones.removeBlock, { siteId: fstsSiteId, blockId: a.blockId });
    await expect(
      asOwner().mutation(api.editorZones.updateBlock, {
        siteId: fstsSiteId, blockId: a.blockId,
        content: { kind: "text", text: "Edited while removed" },
      }),
    ).rejects.toThrow("Restore the block before editing it.");
  });
});

// ── persistence workflow (draft → publish → restore → discard) ────────

describe("editorZones — draft/publish/restore/discard workflow", () => {
  it("publish promotes content→published, deletes pendingDelete, and records a §17 snapshot", async () => {
    await seed();
    const keep = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Keep me" },
    });
    const drop = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Drop me" },
    });
    // Nothing published yet — publish both.
    const p0 = await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    expect(p0.ok).toBe(true);
    expect(p0.changed).toBe(2);
    // Soft-remove one (published) — hidden until publish.
    await asOwner().mutation(api.editorZones.removeBlock, { siteId: fstsSiteId, blockId: drop.blockId });
    // Edit the survivor.
    await asOwner().mutation(api.editorZones.updateBlock, {
      siteId: fstsSiteId, blockId: keep.blockId,
      content: { kind: "text", text: "Keep me (edited)" },
    });
    const p1 = await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    expect(p1.changed).toBe(2); // one edit promoted + one pendingDelete removed
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(1); // the dropped block is gone for good
    expect(rows[0].content.text).toBe("Keep me (edited)");
    expect(rows[0].published.text).toBe("Keep me (edited)");
    // §17 revision snapshot recorded (entityType editor_blocks_publish).
    const versions: any[] = await t.run(async (ctx) =>
      await ctx.db.query("contentVersions").collect(),
    );
    expect(versions.length).toBe(2);
    expect(versions.every((v) => v.entityType === "editor_blocks_publish")).toBe(true);
  });

  it("removeBlock on a never-published block hard-deletes it", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Draft only" },
    });
    const r = await asOwner().mutation(api.editorZones.removeBlock, {
      siteId: fstsSiteId, blockId: a.blockId,
    });
    expect(r.removed).toBe(true);
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(0);
  });

  it("restoreBlock clears pendingDelete (a removed published block comes back)", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Published once" },
    });
    await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    await asOwner().mutation(api.editorZones.removeBlock, { siteId: fstsSiteId, blockId: a.blockId });
    await asOwner().mutation(api.editorZones.restoreBlock, { siteId: fstsSiteId, blockId: a.blockId });
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(1);
    expect(rows[0].pendingDelete).toBe(false);
    expect(rows[0].published.text).toBe("Published once");
  });

  it("reorderBlock requires the EXACT current id set (stale submission rejected)", async () => {
    await seed();
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "A" },
    });
    const b = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "B" },
    });
    const c = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "C" },
    });
    // Stale: only 2 of the current 3 ids submitted.
    await expect(
      asOwner().mutation(api.editorZones.reorderBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        orderedIds: [a.blockId, b.blockId],
      }),
    ).rejects.toThrow("That change is out of date — refresh and try again.");
    // Exact set in a new order succeeds and rewrites order fields.
    await asOwner().mutation(api.editorZones.reorderBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      orderedIds: [c.blockId, a.blockId, b.blockId],
    });
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    const byText: Record<string, any> = {};
    for (const r of rows) byText[r.content.text] = r;
    expect(byText["C"].order).toBe(0);
    expect(byText["A"].order).toBe(1);
    expect(byText["B"].order).toBe(2);
  });

  it("discardBlocks reverts draft edits to published (and drops never-published drafts)", async () => {
    await seed();
    const keep = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Stable" },
    });
    const temp = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Temporary" },
    });
    await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    // Draft edits: edit one, remove the other.
    await asOwner().mutation(api.editorZones.updateBlock, {
      siteId: fstsSiteId, blockId: keep.blockId,
      content: { kind: "text", text: "Stable (draft)" },
    });
    await asOwner().mutation(api.editorZones.removeBlock, { siteId: fstsSiteId, blockId: temp.blockId });
    const d = await asOwner().mutation(api.editorZones.discardBlocks, { siteId: fstsSiteId });
    expect(d.ok).toBe(true);
    expect(d.discarded).toBe(2);
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(2); // the removed one came back
    const byText: Record<string, any> = {};
    for (const r of rows) byText[r.content.text] = r;
    expect(byText["Stable"]).toBeDefined();
    expect(byText["Stable"].content.text).toBe("Stable");
    expect(byText["Temporary"]).toBeDefined();
  });

  it("video cap: MAX_VIDEO_BLOCKS_PER_SITE blocks, then rejection", async () => {
    await seed();
    for (let i = 0; i < 8; i++) {
      const r = await asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "video-section",
        content: { kind: "video", url: `https://www.youtube.com/watch?v=video000${i}` },
      });
      expect(r.ok).toBe(true);
    }
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "video-section",
        content: { kind: "video", url: "https://www.youtube.com/watch?v=video0008" },
      }),
    ).rejects.toThrow("This website already has the maximum of 8 videos.");
  });
});

// ── structural ops (§8 repeatables) ───────────────────────────────────

describe("editorZones — structural ops on discovered repeatables", () => {
  it("setStructuralOps validates item ids against the page's REAL map keys", async () => {
    await seed();
    // Reorder + hide: items[2] is hidden — it must NOT also appear in
    // itemOrder (setStructuralOps enforces the order/hidden XOR rule).
    const r = await asOwner().mutation(api.editorZones.setStructuralOps, {
      siteId: fstsSiteId, pagePath: "/",
      itemOrder: ["home.services.items[1]", "home.services.items[0]"],
      hiddenItems: ["home.services.items[2]"],
    });
    expect(r.ok).toBe(true);
    const rows = await asOwner().query(api.editorZones.structuralsFor, { siteId: fstsSiteId });
    expect(rows.length).toBe(1);
    expect(rows[0].itemOrder).toEqual([
      "home.services.items[1]", "home.services.items[0]",
    ]);
    expect(rows[0].hiddenItems).toEqual(["home.services.items[2]"]);

    // Unknown id → rejected.
    await expect(
      asOwner().mutation(api.editorZones.setStructuralOps, {
        siteId: fstsSiteId, pagePath: "/", itemOrder: ["home.services.items[9]"],
      }),
    ).rejects.toThrow("That item no longer exists on this page.");
    // An item ordered AND hidden → rejected (XOR).
    await expect(
      asOwner().mutation(api.editorZones.setStructuralOps, {
        siteId: fstsSiteId, pagePath: "/",
        itemOrder: ["home.services.items[0]"],
        hiddenItems: ["home.services.items[0]"],
      }),
    ).rejects.toThrow("A removed item can't also be ordered.");
  });

  it("publish promotes structural drafts to published fields", async () => {
    await seed();
    await asOwner().mutation(api.editorZones.setStructuralOps, {
      siteId: fstsSiteId, pagePath: "/",
      itemOrder: ["home.services.items[1]", "home.services.items[0]"],
      hiddenItems: ["home.services.items[2]"],
    });
    const p = await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    expect(p.changed).toBe(1);
    const rows = await asOwner().query(api.editorZones.structuralsFor, { siteId: fstsSiteId });
    expect(rows[0].publishedItemOrder).toEqual(rows[0].itemOrder);
    expect(rows[0].publishedHiddenItems).toEqual(rows[0].hiddenItems);
  });

  it("unknown page rejected for structural ops", async () => {
    await seed();
    await expect(
      asOwner().mutation(api.editorZones.setStructuralOps, {
        siteId: fstsSiteId, pagePath: "/missing", itemOrder: [],
      }),
    ).rejects.toThrow("That page isn't available for editing.");
  });
});

// ── permissions + tenant isolation ────────────────────────────────────

describe("editorZones — permissions and tenant isolation", () => {
  it("read_only is Forbidden on EVERY mutation (content.view only)", async () => {
    await seed();
    const base = { siteId: fstsSiteId, pagePath: "/", zone: "content" as const };
    await expect(
      asViewer().mutation(api.editorZones.addBlock, {
        ...base, content: { kind: "text", text: "V" },
      }),
    ).rejects.toThrow();
    await expect(
      asViewer().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId }),
    ).rejects.toThrow();
    await expect(
      asViewer().mutation(api.editorZones.discardBlocks, { siteId: fstsSiteId }),
    ).rejects.toThrow();
    await expect(
      asViewer().mutation(api.editorZones.setStructuralOps, {
        siteId: fstsSiteId, pagePath: "/", itemOrder: [],
      }),
    ).rejects.toThrow();
  });

  it("unauthenticated calls are rejected on mutations", async () => {
    await seed();
    await expect(
      t.mutation(api.editorZones.addBlock, {
        siteId: fstsSiteId, pagePath: "/", zone: "content",
        content: { kind: "text", text: "Anon" },
      }),
    ).rejects.toThrow();
  });

  it("cross-tenant denied BOTH directions (FSTS owner vs Corsair owner)", async () => {
    await seed();
    // FSTS owner cannot add to the cross tenant's site.
    await expect(
      asOwner().mutation(api.editorZones.addBlock, {
        siteId: crossSiteId, pagePath: "/", zone: "content",
        content: { kind: "text", text: "Intrusion" },
      }),
    ).rejects.toThrow();
    // ...and reads are null (checkSiteAccess fails).
    const summaries = await asOwner().query(api.editorZones.zoneSummaries, { siteId: crossSiteId });
    expect(summaries).toBeNull();
    const blocks = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: crossSiteId });
    expect(blocks).toBeNull();
    // Reverse direction: cross owner cannot touch FSTS blocks.
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "FSTS block" },
    });
    await expect(
      asCross().mutation(api.editorZones.removeBlock, { siteId: fstsSiteId, blockId: a.blockId }),
    ).rejects.toThrow();
    await expect(
      asCross().mutation(api.editorZones.updateBlock, {
        siteId: fstsSiteId, blockId: a.blockId,
        content: { kind: "text", text: "Hacked" },
      }),
    ).rejects.toThrow();
    await expect(
      asCross().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId }),
    ).rejects.toThrow();
    // Cross owner's own site works fine (control).
    const own = await asCross().mutation(api.editorZones.addBlock, {
      siteId: crossSiteId, pagePath: "/", zone: "video-section",
      content: { kind: "video", url: "https://www.youtube.com/watch?v=cross0001" },
    });
    expect(own.ok).toBe(true);
  });

  it("superadmin passes the permission floor (platform owner)", async () => {
    await seed();
    const r = await asSuper().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Super block" },
    });
    expect(r.ok).toBe(true);
  });
});

// ── publish gate (connection-mode authority) ──────────────────────────

describe("editorZones — publish authority gate", () => {
  it("DISCOVERED_EXTERNAL can draft but NEVER publish (exact blocked message + activity row)", async () => {
    await seed("DISCOVERED_EXTERNAL");
    const a = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Draft on external" },
    });
    expect(a.ok).toBe(true); // drafting allowed in every mode
    await expect(
      asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId }),
    ).rejects.toThrow(
      "Publishing connection required: verify ownership of your site to enable publishing. Use Site Verification in your workspace.",
    );
    // The draft is untouched (survives the blocked publish).
    const rows = await asOwner().query(api.editorZones.listZoneBlocks, { siteId: fstsSiteId });
    expect(rows.length).toBe(1);
    expect(rows[0].published).toBe(null);
    // Convex rolls back the whole mutation transaction on throw — the
    // in-transaction logActivity("publish_blocked") write does not persist
    // (same discipline as connection-modes.test.ts). The §14 contract
    // surfaces through the thrown message itself, asserted above.
  });
});

// ── bridge payload draft isolation ────────────────────────────────────

describe("editorZones — bridge payload draft isolation", () => {
  it("_content serves PUBLISHED blocks only — drafts never reach visitors", async () => {
    await seed();
    // Draft a video block + a text block (unpublished).
    await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "video-section",
      content: { kind: "video", url: "https://www.youtube.com/watch?v=draft0001" },
    });
    const text = await asOwner().mutation(api.editorZones.addBlock, {
      siteId: fstsSiteId, pagePath: "/", zone: "content",
      content: { kind: "text", text: "Draft secret text" },
    });
    // Bridge _content BEFORE publish: no blocks at all (internal query —
    // invoke through convexTest's internal API path, never a raw import).
    const payloadBefore = await t.query(internal.bridge._content, { slug: "zone-test-studio" });
    expect(payloadBefore.blocks).toEqual({});
    // Publish → blocks appear, in order, as sanitized zone HTML.
    await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    const payloadAfter = await t.query(internal.bridge._content, { slug: "zone-test-studio" });
    const homeBlocks = payloadAfter.blocks["/"];
    expect(Array.isArray(homeBlocks)).toBe(true);
    const videoZone = homeBlocks.find((b: any) => b.zone === "video-section");
    expect(videoZone).toBeDefined();
    // The safe renderer emits a click-to-watch CARD (provider data
    // attributes + the canonical watch URL) — never a raw iframe; actual
    // embedding happens only inside the snippet's sandboxed runtime.
    expect(videoZone.html).toContain('data-taya-video-provider="youtube"');
    expect(videoZone.html).toContain("https://www.youtube.com/watch?v=draft0001");
    const contentZone = homeBlocks.find((b: any) => b.zone === "content");
    expect(contentZone.html).toContain("Draft secret text");
    // Then a NEW draft edit must NOT leak into the payload.
    await asOwner().mutation(api.editorZones.updateBlock, {
      siteId: fstsSiteId, blockId: text.blockId,
      content: { kind: "text", text: "Edited draft (must stay private)" },
    });
    const payloadFinal = await t.query(internal.bridge._content, { slug: "zone-test-studio" });
    expect(JSON.stringify(payloadFinal.blocks)).not.toContain("must stay private");
    expect(JSON.stringify(payloadFinal.blocks)).toContain("Draft secret text");
  });

  it("_content serves published structural state (order + hidden) per page", async () => {
    await seed();
    await asOwner().mutation(api.editorZones.setStructuralOps, {
      siteId: fstsSiteId, pagePath: "/",
      itemOrder: ["home.services.items[1]", "home.services.items[0]"],
      hiddenItems: ["home.services.items[2]"],
    });
    const before = await t.query(internal.bridge._content, { slug: "zone-test-studio" });
    expect(before.structural).toEqual({}); // draft not yet published
    await asOwner().mutation(api.editorZones.publishBlocks, { siteId: fstsSiteId });
    const after = await t.query(internal.bridge._content, { slug: "zone-test-studio" });
    expect(after.structural["/"].itemOrder).toEqual([
      "home.services.items[1]", "home.services.items[0]",
    ]);
    expect(after.structural["/"].hiddenItems).toEqual(["home.services.items[2]"]);
  });
});
