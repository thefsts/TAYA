/**
 * PHASE 2 — §5 PAGE/CONTENT MAP (PR-2).
 * @vitest-environment edge-runtime
 *
 * Pins the durable content-map contract:
 *
 *   buildPageMap (§5 pure):
 *    - deterministic: same snapshot in → identical map out
 *    - pages ordered home-first then lexicographic
 *    - per-page keyCount via longest pageKeySegment attribution
 *      (nested routes never misattributed to their parent)
 *    - pageLabel fallback chain (nav label → <title> → title-cased segment)
 *    - entry shape {type, discovered, evidence} — unknown types → "text"
 *
 *   convex/contentMap api (site-scoped §22):
 *    - get returns the map + entries (draft/published/stale per §5)
 *      with per-page attribution consistent with the persisted counts
 *    - listDraftEntries returns only keys with a pending draft
 *    - outsiders see null; anonymous sees null
 *
 *   refresh preservation (§5/§7/§16):
 *    - a second crawl preserves prior draft + published overlays per key
 *    - keys the new crawl no longer finds stay in the map, marked stale
 *    - the map row is upserted — never duplicated
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { buildPageMap } from "../../../convex/lib/discovery/contentMap";
import type { DiscoverySnapshot } from "../../../convex/lib/discovery/crawl";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Fixtures ───────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const SUPERADMIN_CLERK = "user_superadmin_cmap";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const OWNER_EMAIL = "nadia@example.com";
const OWNER_CLERK = "user_nadia_owner";
const OTHER_EMAIL = "outsider@example.com";
const OTHER_CLERK = "user_outsider_cmap";
const DOMAIN = "willowcreekstudio.example";

let siteId: any;

async function seed() {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Platform Owner",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    const site = await ctx.db.insert("sites", {
      name: "Willow Creek Studio",
      slug: "willow-creek-studio",
      status: "active",
      domain: DOMAIN,
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK,
      name: "Nadia Owner",
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: site, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: OTHER_CLERK,
      name: "Outsider Owner",
      email: OTHER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [],
    });
    siteId = site;
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  siteId = undefined;
  await seed();
  expect(siteId).toBeTruthy();
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

// ── Pure: buildPageMap (§5) ─────────────────────────────────────────────────

const NAV = `<nav><a href="/">Home</a> <a href="/services">Services</a> <a href="/gallery">Gallery</a></nav>`;

const HOME_V1 = `<!doctype html>
<html><head><title>Willow Creek Studio — Craft and light</title></head><body>
${NAV}
<h1>Willow Creek Studio</h1>
<p>Ceramics and textiles made in Willow Creek since 1998.</p>
<section>
  <h2>Our Services</h2>
  <ul>
    <li><h3>Custom Pieces</h3><p>Commissions made to order.</p></li>
  </ul>
</section>
</body></html>`;

const SERVICES_V1 = `<!doctype html>
<html><head><title>Commissions — Willow Creek Studio</title></head><body>
${NAV}
<h1>Our Services</h1>
<p>Commissions, classes, and repairs.</p>
<section>
  <h2>Offerings</h2>
  <ul>
    <li><h3>Commissions</h3><p>Custom pieces for your home.</p></li>
    <li><h3>Classes</h3><p>Wheel throwing for all levels.</p></li>
  </ul>
</section>
</body></html>`;

const GALLERY_V1 = `<!doctype html>
<html><head><title>Gallery — Willow Creek Studio</title></head><body>
${NAV}
<h1>Recent Work</h1>
<p>A rotating gallery of finished pieces.</p>
</body></html>`;

/** Stub the V1 fixture site (all three pages + 404 elsewhere). */
function stubV1() {
  const pages: Record<string, string> = {
    [`https://${DOMAIN}`]: HOME_V1,
    [`https://${DOMAIN}/services`]: SERVICES_V1,
    [`https://${DOMAIN}/gallery`]: GALLERY_V1,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input);
      const body = pages[url];
      return body !== undefined
        ? new Response(body, { status: 200, headers: { "content-type": "text/html" } })
        : new Response(null, { status: 404 });
    }),
  );
}

/** A synthetic completed DiscoverySnapshot (shape-matched to crawl.ts). */
function synthSnapshot(routes: any[], contentMap: any, pages: any[]): DiscoverySnapshot {
  return {
    domain: DOMAIN,
    origin: `https://${DOMAIN}`,
    crawlStartedAt: 1,
    crawlCompletedAt: 2,
    platform: null,
    contentMap,
    keyCount: Object.keys(contentMap).length,
    pages,
    routes,
    siteMeta: {} as any,
  };
}

const fetchedPage = (path: string, title: string | null) => ({
  path,
  url: `https://${DOMAIN}${path === "/" ? "" : path}`,
  status: "fetched" as const,
  httpStatus: 200,
  bytes: 900,
  model: { meta: { title } } as any,
  error: null,
});

// ── buildPageMap — pure §5 pins ─────────────────────────────────────────────

describe("buildPageMap — §5 pure contract", () => {
  const routes = [
    { path: "/", source: "nav" as const, label: "Home" },
    { path: "/services", source: "nav" as const, label: "Services" },
    { path: "/gallery", source: "nav" as const, label: "" },
  ];
  const contentMap = {
    "home.hero.heading": { type: "text", value: "Willow Creek Studio", evidence: "h1" },
    "home.services.items[0].title": { type: "text", value: "Custom Pieces", evidence: "li h3" },
    "home.services.items[0].image": { type: "image", value: "/img/custom.jpg", evidence: "li img" },
    "services.intro.heading": { type: "text", value: "Our Services", evidence: "h1" },
    "services.offerings.items[0].title": { type: "text", value: "Commissions", evidence: "li h3" },
    "services.offerings.items[1].title": { type: "text", value: "Classes", evidence: "li h3" },
    "gallery.intro.heading": { type: "heading_kind_unknown", value: "Recent Work", evidence: "h1" },
  };
  const pages = [
    fetchedPage("/", "Willow Creek Studio — Craft and light"),
    fetchedPage("/services", "Commissions — Willow Creek Studio"),
    fetchedPage("/gallery", "Gallery — Willow Creek Studio"),
  ];

  const map = () => buildPageMap(synthSnapshot(routes, contentMap, pages));

  it("shapes the entry: type normalized, discovered = crawl value, evidence kept", () => {
    const m = map();
    expect(m.entries["home.hero.heading"]).toEqual({
      type: "text",
      discovered: "Willow Creek Studio",
      evidence: "h1",
    });
    expect(m.entries["home.services.items[0].image"].type).toBe("image");
    // Unknown crawl type → normalized to text (§5 allowlist).
    expect(m.entries["gallery.intro.heading"].type).toBe("text");
    expect(m.entries["gallery.intro.heading"].discovered).toBe("Recent Work");
    // No overlays fabricated at build time.
    expect(m.entries["home.hero.heading"].draft).toBeUndefined();
    expect(m.entries["home.hero.heading"].published).toBeUndefined();
    expect(m.entries["home.hero.heading"].stale).toBeUndefined();
  });

  it("orders pages home-first then lexicographic", () => {
    const m = map();
    expect(m.pages.map((p) => p.path)).toEqual(["/", "/gallery", "/services"]);
  });

  it("labels: nav label wins, then <title>, then title-cased segment", () => {
    const m = map();
    const byPath: Record<string, any> = Object.fromEntries(m.pages.map((p) => [p.path, p]));
    // "/" → "Home" always.
    expect(byPath["/"].label).toBe("Home");
    // Nav label present ("Services") → used even though a <title> exists.
    expect(byPath["/services"].label).toBe("Services");
    // No nav label → <title> first 80 chars.
    expect(byPath["/gallery"].label).toBe("Gallery — Willow Creek Studio");
  });

  it("keyCount attribution: home owns its keys, sub-pages own theirs (longest segment)", () => {
    const m = map();
    const byPath: Record<string, any> = Object.fromEntries(m.pages.map((p) => [p.path, p]));
    // home: hero.heading + services.items[0].title + [0].image = 3
    expect(byPath["/"].keyCount).toBe(3);
    // services: intro.heading + offerings.items[0/1].title = 3
    expect(byPath["/services"].keyCount).toBe(3);
    // gallery: 1
    expect(byPath["/gallery"].keyCount).toBe(1);
    expect(m.keyCount).toBe(7);
    // Longest-match: "services.offerings.items[0].title" belongs to
    // /services, not the home page (home's segment is "home" — no match).
  });

  it("deterministic: same snapshot → byte-identical map", () => {
    expect(map()).toEqual(map());
  });

  it("nested routes attribute to the nested page, not the parent", () => {
    const routes2 = [
      { path: "/services", source: "nav" as const, label: "Services" },
      { path: "/services/restoration", source: "sitemap" as const, label: "" },
    ];
    const contentMap2 = {
      "services.intro.heading": { type: "text", value: "Our Services", evidence: "h1" },
      "services.restoration.intro.heading": {
        type: "text",
        value: "Restoration",
        evidence: "h1",
      },
    };
    const pages2 = [
      fetchedPage("/", "Home"),
      fetchedPage("/services", "Services"),
      fetchedPage("/services/restoration", "Restoration — Willow Creek"),
    ];
    const m = buildPageMap(synthSnapshot(routes2, contentMap2, pages2));
    const byPath: Record<string, any> = Object.fromEntries(m.pages.map((p) => [p.path, p]));
    expect(byPath["/services"].keyCount).toBe(1);
    expect(byPath["/services/restoration"].keyCount).toBe(1);
    // The nested page's keys are never attributed to "/" (its segment
    // "home" matches nothing).
    expect(byPath["/"].keyCount).toBe(0);
  });

  it("errors are excluded from the page list (fetched pages only)", () => {
    const snap = synthSnapshot(routes, contentMap, pages);
    const withError = [
      ...pages,
      {
        path: "/broken",
        url: `https://${DOMAIN}/broken`,
        status: "error" as const,
        httpStatus: 500,
        bytes: null,
        model: null,
        error: "boom",
      },
    ];
    const m = buildPageMap({ ...snap, pages: withError });
    expect(m.pages.map((p) => p.path)).not.toContain("/broken");
  });
});

// ── api.contentMap — site-scoped reads (§22) ────────────────────────────────

describe("api.contentMap — site-scoped reads (§22)", () => {
  it("get returns the map with per-page counts consistent with the persisted map", async () => {
    stubV1();
    const result: any = await asOwner().action(api.discovery.triggerDiscovery, { siteId });
    expect(result.status).toBe("completed");

    const view: any = await asOwner().query(api.contentMap.get, { siteId });
    expect(view).toBeTruthy();
    expect(view.siteId).toBe(siteId);
    expect(view.version).toBe(1);
    expect(view.domain).toBe(DOMAIN);
    expect(view.conformed).toBe(true);
    expect(view.keyCount).toBe(Object.keys(view.entries).length);
    expect(view.keyCount).toBeGreaterThan(5);

    // Per-page counts in the READ view are non-zero and consistent —
    // home and /services both own keys, and the sum of per-page counts
    // equals the whole map (every key attributed).
    let sum = 0;
    for (const p of view.pages) {
      expect(p.keyCount).toBeGreaterThanOrEqual(0);
      sum += p.keyCount;
    }
    expect(sum).toBe(view.keyCount);
    const homePage = view.pages.find((p: any) => p.path === "/");
    expect(homePage.keyCount).toBeGreaterThan(0);
    const servicesPage = view.pages.find((p: any) => p.path === "/services");
    expect(servicesPage.keyCount).toBeGreaterThan(0);

    // Entry shape: discovered baseline + evidence, no overlays yet.
    const hero = view.entries["home.hero.heading"];
    expect(hero.type).toBe("text");
    expect(hero.discovered).toBe("Willow Creek Studio");
    expect(hero.evidence).toBeTruthy();
    expect(hero.draft).toBeUndefined();
  });

  it("listDraftEntries returns only keys with pending drafts; none before drafting", async () => {
    stubV1();
    await asOwner().action(api.discovery.triggerDiscovery, { siteId });
    const empty: any = await asOwner().query(api.contentMap.listDraftEntries, { siteId });
    expect(empty.count).toBe(0);
    expect(empty.drafts).toEqual([]);

    // Draft two keys; one published earlier (no draft now).
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [
        { key: "home.hero.heading", value: "Drafted Hero Copy" },
        { key: "services.intro.heading", value: "Drafted Services Copy" },
      ],
    });
    const drafts: any = await asOwner().query(api.contentMap.listDraftEntries, { siteId });
    expect(drafts.count).toBe(2);
    const keys = drafts.drafts.map((d: any) => d.key).sort();
    expect(keys).toEqual(["home.hero.heading", "services.intro.heading"]);
    const heroDraft = drafts.drafts.find((d: any) => d.key === "home.hero.heading");
    expect(heroDraft.draft).toBe("Drafted Hero Copy");
    expect(heroDraft.discovered).toBe("Willow Creek Studio");
    expect(heroDraft.published).toBeNull();
  });

  it("outsiders and anonymous see null (§22); superadmin reads across sites", async () => {
    stubV1();
    await asOwner().action(api.discovery.triggerDiscovery, { siteId });

    expect(await asOther().query(api.contentMap.get, { siteId })).toBeNull();
    expect(await asOther().query(api.contentMap.listDraftEntries, { siteId })).toBeNull();
    expect(await t.query(api.contentMap.get, { siteId })).toBeNull();
    expect(await t.query(api.contentMap.listDraftEntries, { siteId })).toBeNull();

    const adminView: any = await t
      .withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL })
      .query(api.contentMap.get, { siteId });
    expect(adminView).toBeTruthy();
  });
});

// ── refresh preservation (§5/§7/§16): draft/published overlays + stale ──────

describe("refresh crawl — overlay preservation + stale marking (§5/§7/§16)", () => {
  it("preserves draft/published overlays, marks vanished keys stale, upserts one row", async () => {
    stubV1();
    await asOwner().action(api.discovery.triggerDiscovery, { siteId });

    // Draft one key and publish another (publish requires verification →
    // verify ownership first via html meta token on the V1 homepage).
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "services.items[1].title", value: "Drafted Classes" }],
    });
    const begun: any = await asOwner().action(api.ownershipVerification.beginVerification, {
      siteId,
      method: "html_meta_token",
    });
    expect(begun.state).toBe("verification_pending");

    // Serve the meta tag on the homepage so checkVerification passes.
    const metaHome = HOME_V1.replace(
      "<title>",
      `<meta name="taya-verification" content="${begun.token}"><title>`,
    );
    const pages: Record<string, string> = {
      [`https://${DOMAIN}`]: metaHome,
      [`https://${DOMAIN}/services`]: SERVICES_V1,
      [`https://${DOMAIN}/gallery`]: GALLERY_V1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = String(input);
        const body = pages[url];
        return body !== undefined
          ? new Response(body, { status: 200, headers: { "content-type": "text/html" } })
          : new Response(null, { status: 404 });
      }),
    );
    const verified: any = await asOwner().action(api.ownershipVerification.checkVerification, {
      siteId,
    });
    expect(verified.state).toBe("verified");
    await asOwner().mutation(api.publishing.saveDraft, {
      siteId,
      entries: [{ key: "home.hero.heading", value: "Published Hero Copy" }],
    });
    const published: any = await asOwner().mutation(api.publishing.publishContentMap, {
      siteId,
      keys: ["home.hero.heading"], // publish ONLY the hero — the classes
      // draft stays pending so refresh preservation is proven below.
    });
    expect(published.ok).toBe(true);
    expect(published.publishedKeys).toBe(1);

    // V2: the site changed — hero heading text changed (replaceAll: the
    // phrase appears in both <title> and <h1>), the classes item vanished
    // from /services, and /gallery was deleted entirely.
    const HOME_V2 = HOME_V1.replaceAll("Willow Creek Studio", "Willow Creek Studios");
    const SERVICES_V2 = SERVICES_V1.replace(
      `<li><h3>Classes</h3><p>Wheel throwing for all levels.</p></li>`,
      "",
    );
    const pagesV2: Record<string, string> = {
      [`https://${DOMAIN}`]: HOME_V2,
      [`https://${DOMAIN}/services`]: SERVICES_V2,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = String(input);
        const body = pagesV2[url];
        return body !== undefined
          ? new Response(body, { status: 200, headers: { "content-type": "text/html" } })
          : new Response(null, { status: 404 });
      }),
    );
    const refreshed: any = await asOwner().action(api.discovery.triggerDiscovery, { siteId });
    expect(refreshed.status).toBe("completed");

    let mapRow: any;
    let mapCount: number;
    await t.run(async (ctx) => {
      const maps = await ctx.db
        .query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      mapCount = maps.length;
      mapRow = maps[0];
    });
    expect(mapCount).toBe(1); // upsert, never duplicate

    // Preservation:
    //  - published overlay survives with the NEW discovered baseline
    //    ("Willow Creek Studios" — the crawl's new truth) and the old
    //    published value intact.
    expect(mapRow.entries["home.hero.heading"].discovered).toBe("Willow Creek Studios");
    expect(mapRow.entries["home.hero.heading"].published).toBe("Published Hero Copy");
    expect(mapRow.entries["home.hero.heading"].draft).toBeUndefined();
    //  - draft overlay survives the refresh (§5 overlay preservation).
    //    (namesake elision: the "Offerings" section on /services folds to
    //    services.items[1].title — the §5 canonical, not
    //    services.offerings.* — so THAT is the key the draft rode on).
    expect(mapRow.entries["services.items[1].title"].draft).toBe("Drafted Classes");
    expect(mapRow.entries["services.items[1].title"].stale).toBe(true);
    //  - gallery keys: the page vanished entirely → stale: true, values kept.
    expect(mapRow.entries["gallery.intro.heading"].stale).toBe(true);
    expect(mapRow.entries["gallery.intro.heading"].discovered).toBe("Recent Work");
    //  - a key the new crawl still finds is NOT stale (the /services lead
    //    h1 survives in V2; its items folded away because a one-<li> list
    //    is not repeatable — ≥2 items required — so items[*] keys going
    //    stale here is CORRECT §5 behavior, not a defect).
    expect(mapRow.entries["services.intro.heading"].stale).toBeFalsy();

    // keyCount is the NEW map's size — stale keys ride along in entries
    // (the reference baseline is never silently deleted) but are NOT
    // counted as live content keys. 14 fresh + 11 preserved-stale = 25.
    expect(mapRow.keyCount).toBeLessThan(Object.keys(mapRow.entries).length);
    expect(mapRow.keyCount).toBe(14);
    expect(Object.keys(mapRow.entries).length).toBe(25);
    const staleKeys = Object.entries(mapRow.entries)
      .filter(([, e]: any) => e.stale === true)
      .map(([k]) => k);
    expect(staleKeys).toContain("gallery.intro.heading");
    expect(staleKeys).toContain("services.items[0].title");
    expect(staleKeys).toContain("services.items[1].title");
    // The site is TAYA_CONNECTED and publishing still works after refresh.
    const authority: any = await asOwner().query(api.publishing.canPublish, { siteId });
    expect(authority.canPublish).toBe(true);
    expect(authority.connectionMode).toBe("TAYA_CONNECTED");
  });
});
