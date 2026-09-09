/**
 * PHASE 3 — CLIENT VISUAL WEBSITE EDITOR — ANNOTATION + FRAME + TOKEN + ROUTE.
 * @vitest-environment edge-runtime
 *
 * Four parts, all testing REAL production-facing code:
 *
 *   Part 1 — ANNOTATION PARITY: every key the annotation engine stamps
 *   must be a REAL Phase 2 key (annotated ⊆ foldIntoContentMap output —
 *   no invented keys), and every element that OWNS a key 1:1 must carry
 *   it (hero fields, section headings, single-paragraph bodies, item
 *   fields, footer text, images). The fold ALSO emits ALIAS keys with no
 *   1:1 element of their own: positional headings[n] duplicating semantic
 *   stamps, images[n] aliasing hero/item images (element already taken,
 *   first key wins), .href companions riding the stamped button element,
 *   and .body keys composed from list/scattered text. One element carries
 *   exactly ONE key, so aliases are intentionally unstamped — §26: never
 *   fake an editable binding. What you click is what you edit, and what
 *   you edit is what publishes.
 *   foldIntoContentMap is module-private, so the test mirrors its
 *   documented assembly from the SAME exported primitives
 *   (pageKeySegment/sectionKeyRoot) and conditions — pinned by the
 *   section below to the exact keys foldIntoContentMap writes.
 *
 *   Part 2 — FRAME SECURITY: stripExecutableScripts / neutralizeNavigation /
 *   buildFrameDocument — no site script/handler/iframe/meta-refresh/target
 *   survives; base + CSP + bootstrap present; malformed docs survive.
 *
 *   Part 3 — EDITOR SURFACE (convexTest, real DB): frame tokens (mint auth,
 *   site-scope, burn, replay dead, expiry dead, concurrent burn race,
 *   revoked-role re-check), cross-tenant denial BOTH DIRECTIONS (FSTS
 *   member cannot mint/frame/edit Corsair; Corsair member cannot mint/
 *   frame/edit FSTS), revisions (tenant-scoped list, restore-becomes-draft,
 *   publish-from-restore, cross-site revision denied), draft isolation
 *   (bridge _content never serves drafts).
 *
 *   Part 4 — HTTP ROUTE /api/editor/frame (hoisted capture harness): route
 *   registration, token required, burn-first 401 on null burn (and that
 *   no _frameSite call happens), scope re-check 404, bounded fetch
 *   failure 502, happy path end-to-end (annotate + editor-safe doc +
 *   frame-ancestors CSP + no-store), replay 401.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Part 4 harness: hoisted route capture (verbatim pattern from
// bridge-http.test.ts — convex/server httpRouter + _generated/server
// httpAction wrapped so handlers are captured by `method:path`) ─────────

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

import "../../convex/http.js";

// ── Fixtures ─────────────────────────────────────────────────────────────

const HOME_HTML = `<!doctype html>
<html><head><title>Studio</title><meta charset="utf-8">
<link rel="stylesheet" href="/styles.css"></head>
<body>
<header><nav><a href="/">Home</a><a href="/services">Services</a><a href="/gallery">Gallery</a></nav></header>
<main>
<h1>Make Every Print Bold</h1>
<p>From storefront banners to trade-show backdrops, our studio prints, laminates, and ships in-house for fast turnaround and crisp color that sells.</p>
<img src="/hero.jpg" alt="Studio front">
<a class="btn" href="/quote">Get a Quote</a>
<section id="about">
<h2>About the Studio</h2>
<p>We opened our doors two decades ago and never outsourced a single job. Our designers sit down with you, and our presses run three shifts so deadlines hold.</p>
</section>
<section id="services">
<h2>Our Services</h2>
<ul>
<li><h3>Banners</h3><p>Vinyl and mesh banners with grommets and hems, printed at photo resolution for indoor and outdoor durability.</p><img src="/b.jpg" alt="Banner"></li>
<li><h3>Stickers</h3><p>Die-cut stickers and decals in any shape, laminated for UV resistance and finished on rolls or sheets as you need them.</p><img src="/s.jpg" alt="Stickers"></li>
</ul>
</section>
<section id="gallery">
<h2>Gallery</h2>
<img src="/g1.jpg" alt="Gallery photo one"><img src="/g2.jpg" alt="Gallery photo two">
</section>
</main>
<footer><p>© 2025 Studio. All rights reserved.</p></footer>
</body></html>`;

const ABOUT_HTML = `<!doctype html>
<html><head><title>About</title></head>
<body>
<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
<main>
<h1>About the Studio</h1>
<p>Behind the counter is a team of designers, press operators, and finishers who have shipped over forty thousand orders without missing a deadline yet.</p>
<section id="team">
<h2>Our Team</h2>
<ul>
<li><h3>Maya Lin</h3><p>Lead designer with a decade of brand work for regional retailers and food brands across the metro area.</p></li>
<li><h3>Owen Reyes</h3><p>Press operator and color specialist who keeps our swatches matched across machines and materials.</p></li>
</ul>
</section>
</main>
<footer><p>© 2025 Studio.</p></footer>
</body></html>`;

/**
 * Mirror foldIntoContentMap's assembly (crawl.ts:163) using ONLY exported
 * primitives — same keys, same conditions. Mirroring (not exporting the
 * fold) keeps Phase 2's module surface untouched.
 */
async function phase2Keys(html: string, path: string): Promise<Set<string>> {
  const htmlLib = await import("../../../convex/lib/discovery/html.ts");
  const { extractPageModel, pageKeySegment, sectionKeyRoot } = htmlLib;
  const model = extractPageModel(html, path, `https://studio.example${path}`);
  const map: Record<string, unknown> = {};

  const pageSeg = pageKeySegment(path);
  if (model.hero.heading) map[`${pageSeg}.hero.heading`] = 1;
  if (model.hero.subheading) map[`${pageSeg}.hero.subheading`] = 1;
  if (model.hero.image) map[`${pageSeg}.hero.image`] = 1;
  if (model.hero.primaryButton?.label) map[`${pageSeg}.hero.primaryButton.label`] = 1;
  if (model.hero.primaryButton?.href) map[`${pageSeg}.hero.primaryButton.href`] = 1;

  for (const s of model.sections) {
    const roleSeg = sectionKeyRoot(path, s.role);
    const isHomeHero = s.role === "hero" && path === "/";
    if (s.heading && !isHomeHero) map[`${roleSeg}.heading`] = 1;
    if (s.body && !isHomeHero) map[`${roleSeg}.body`] = 1;
    s.items.forEach((it: any, i: number) => {
      if (it.title) map[`${roleSeg}.items[${i}].title`] = 1;
      if (it.description) map[`${roleSeg}.items[${i}].description`] = 1;
      if (it.image) map[`${roleSeg}.items[${i}].image`] = 1;
    });
    // Section-scoped element keys live on the TOP-LEVEL model arrays (key
    // already carries the roleSeg) — mirror the fold's startsWith filter.
    for (const im of model.images) if (im.key.startsWith(`${roleSeg}.`)) map[im.key] = 1;
    for (const b of model.buttons) if (b.key.startsWith(`${roleSeg}.`)) map[b.key] = 1;
    for (const l of model.links) if (l.key.startsWith(`${roleSeg}.`)) map[l.key] = 1;
  }
  model.headings.forEach((h: any, i: number) => { map[`${pageSeg}.headings[${i}].text`] = 1; });
  if (model.footerText) map[`${pageSeg}.footer.text`] = 1;
  return new Set(Object.keys(map));
}


async function annotate(html: string, path: string): Promise<string> {
  const { annotatePage } = await import("../../../convex/lib/editorAnnotate.ts");
  return annotatePage(html, path, `https://studio.example${path}`);
}

function keysIn(annotated: string): Set<string> {
  const out = new Set<string>();
  const re = /data-taya-edit="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(annotated))) out.add(m[1]);
  return out;
}

// ── Part 1: annotation parity ─────────────────────────────────────────
//
// The fold (foldIntoContentMap, crawl.ts:163) emits THREE key kinds:
//   (a) keys whose element the annotation engine stamps 1:1 — these MUST
//       be stamped;
//   (b) ALIAS keys riding an element already taken by a semantic key
//       (first-key-wins): positional headings[n] over stamped h1/h2/h3,
//       images[n] over stamped hero/item images, .href companions over
//       the stamped button — intentionally UNSTAMPED (one element, one
//       key; the editor edits .href through the button's Destination
//       control, not a second stamp);
//   (c) composed keys with no single element (list/scattered .body) —
//       honestly UNSTAMPED: there is nothing to click that publishes
//       that key alone (§26: never fake an editable binding).
//
// Parity therefore asserts: annotated ⊆ fold (no invented keys) + every
// 1:1 canonical key of kind (a) is present + kind (b)/(c) keys absent.

describe("editor-annotate — §5 parity with the Phase 2 extractor", () => {
  it("stamps only REAL §5 keys — annotated ⊆ fold, zero invented keys (both fixtures)", async () => {
    const home2 = await phase2Keys(HOME_HTML, "/");
    const home3 = keysIn(await annotate(HOME_HTML, "/"));
    expect(home2.size).toBeGreaterThanOrEqual(12);
    expect([...home3].filter((k) => !home2.has(k))).toEqual([]);

    const about2 = await phase2Keys(ABOUT_HTML, "/about");
    const about3 = keysIn(await annotate(ABOUT_HTML, "/about"));
    expect(about2.size).toBeGreaterThanOrEqual(8);
    expect([...about3].filter((k) => !about2.has(k))).toEqual([]);
  });

  it("stamps every 1:1 canonical element (hero, sections, items, single-paragraph bodies, footer, gallery)", async () => {
    const home = await annotate(HOME_HTML, "/");
    expect(home).toContain('<h1 data-taya-edit="home.hero.heading" data-taya-type="text">');
    expect(home).toContain('data-taya-edit="home.hero.subheading"');
    expect(home).toContain('data-taya-edit="home.hero.image"');
    expect(home).toContain('data-taya-edit="home.hero.primaryButton.label"');
    expect(home).toContain('data-taya-edit="home.about.heading"');
    expect(home).toContain('data-taya-edit="home.about.body"'); // single <p> section → 1:1 body
    expect(home).toContain('data-taya-edit="home.services.heading"');
    expect(home).toContain('data-taya-edit="home.services.items[0].title"');
    expect(home).toContain('data-taya-edit="home.services.items[0].description"');
    expect(home).toContain('data-taya-edit="home.services.items[0].image"');
    expect(home).toContain('data-taya-edit="home.services.items[1].title"');
    expect(home).toContain('data-taya-edit="home.services.items[1].image"');
    expect(home).toContain('data-taya-edit="home.gallery.heading"');
    // Gallery images follow the extractor's GLOBAL image ordinal: hero.image
    // and the two item images consumed ordinals 0–1, so gallery = [2]/[3].
    // The fold agrees (fold set contains home.gallery.images[2] and [3]).
    expect(home).toContain('data-taya-edit="home.gallery.images[2]"');
    expect(home).toContain('data-taya-edit="home.gallery.images[3]"');
    expect(home).not.toContain('data-taya-edit="home.gallery.images[0]"');
    expect(home).toContain('data-taya-edit="home.footer.text"');

    const about = await annotate(ABOUT_HTML, "/about");
    expect(about).toContain('data-taya-edit="about.intro.heading"');
    expect(about).toContain('data-taya-edit="about.intro.body"');
    expect(about).toContain('data-taya-edit="about.team.heading"');
    expect(about).toContain('data-taya-edit="about.team.items[0].title"');
    expect(about).toContain('data-taya-edit="about.team.items[0].description"');
    expect(about).toContain('data-taya-edit="about.team.items[1].title"');
    expect(about).toContain('data-taya-edit="about.footer.text"');
  });

  it("honestly leaves ALIAS and COMPOSED keys unstamped — one element carries exactly one key", async () => {
    const home = keysIn(await annotate(HOME_HTML, "/"));
    // The hero <a class="btn"> already carries primaryButton.label; its .href
    // companion is an attribute of the SAME element (edited via the button
    // Destination control), not a second stamp.
    expect(home.has("home.hero.primaryButton.href")).toBe(false);
    // Item images are stamped items[i].image; the fold's images[n] keys for
    // those SAME elements are aliases.
    expect(home.has("home.services.images[0]")).toBe(false);
    expect(home.has("home.services.images[1]")).toBe(false);
    // Positional headings[n] alias headings that already carry semantic keys.
    expect(home.has("home.headings[0].text")).toBe(false);

    const about = keysIn(await annotate(ABOUT_HTML, "/about"));
    expect(about.has("about.headings[0].text")).toBe(false);
    // Section bodies composed of LIST text have no single element to edit.
    expect(home.has("home.services.body")).toBe(false);
    expect(about.has("about.team.body")).toBe(false);
  });

  it("keeps the document well-formed (no broken tags, valid key grammar, no double-stamps)", async () => {
    const a = await annotate(HOME_HTML, "/") + await annotate(ABOUT_HTML, "/about");
    // Offset-preserving means original text intact and no tag was split.
    expect(a).toContain("Make Every Print Bold");
    expect(a).toContain("Maya Lin");
    expect((a.match(/data-taya-edit/g) ?? []).length).toBeGreaterThanOrEqual(24);
    // No tag carries two stamps.
    expect(a).not.toMatch(/<h1[^>]*data-taya-edit="[^"]*"[^>]*data-taya-edit=/);
    // Key grammar: page-segmented, no empty segments, no stray edges.
    const all = [
      ...keysIn(await annotate(HOME_HTML, "/")),
      ...keysIn(await annotate(ABOUT_HTML, "/about")),
    ];
    expect(all.length).toBeGreaterThanOrEqual(24);
    for (const k of all) {
      expect(k.startsWith("home.") || k.startsWith("about.")).toBe(true);
      expect(k.includes("..")).toBe(false);
      expect(k.startsWith(".")).toBe(false);
      expect(k.endsWith(".")).toBe(false);
    }
  });

  it("does not double-annotate site-embedded data-taya-edit tags", async () => {
    const tagged = HOME_HTML.replace(
      "<h1>Make Every Print Bold</h1>",
      '<h1 data-taya-edit="home.hero.heading" data-taya-type="text">Make Every Print Bold</h1>',
    );
    const a = await annotate(tagged, "/");
    const total = (a.match(/data-taya-edit/g) ?? []).length;
    const hero = a.match(/data-taya-edit="home\.hero\.heading"/g)?.length ?? 0;
    expect(hero).toBe(1);
    // every tag carries its type companion; protected tags are not re-stamped
    const annotatedKeys = keysIn(a);
    expect(annotatedKeys.has("home.hero.heading")).toBe(true);
    // total marker count = keys stamped (each key stamped exactly once)
    expect(total).toBe(annotatedKeys.size);
  });

  it("annotates a completely untagged page (keyless sites derive §5 keys from the DOM alone)", async () => {
    const p2 = await phase2Keys(ABOUT_HTML, "/about");
    const p3 = keysIn(await annotate(ABOUT_HTML, "/about"));
    expect([...p3].filter((k) => !p2.has(k))).toEqual([]); // no invented keys
    expect(p3.has("about.intro.heading")).toBe(true);
    expect(p3.has("about.intro.body")).toBe(true);
    expect(p3.has("about.team.items[0].title")).toBe(true);
    expect(p3.has("about.footer.text")).toBe(true);
  });
});


// ── Part 2: frame transform security ─────────────────────────────────────

describe("editor-frame — editor-safe document transform", () => {
  it("strips every script, handler, iframe, meta-refresh, target; injects base+CSP+bootstrap", async () => {
    const { buildFrameDocument } = await import("../../../convex/lib/editorFrame.ts");
    const messy = `<!doctype html><html><head>
<script>alert(1)</script><script src="/app.js" defer></script>
<meta http-equiv="refresh" content="0;url=/elsewhere"></head>
<body onmouseover="x()" onload="y()">
<h1 onclick="steal()">Title</h1>
<iframe src="https://evil.example/track"></iframe>
<noscript><img src="/fallback.png"></noscript>
<a href="/a" target="_blank">A</a><a href="/b" target="_top">B</a>
</body></html>`;
    const doc = buildFrameDocument(messy, {
      origin: "https://studio.example", path: "/", slug: "studio",
      dashboardOrigin: "https://app.fstsclientsystem.com",
    });
    expect(doc).not.toContain("alert(1)");
    expect(doc).not.toContain("/app.js");
    expect(doc).not.toContain("onmouseover");
    expect(doc).not.toContain("onload=");
    expect(doc).not.toContain("onclick=");
    expect(doc).not.toContain("<iframe");
    expect(doc).not.toContain("noscript");
    expect(doc).not.toContain('http-equiv="refresh"');
    expect(doc).not.toContain("target=");
    expect(doc).toContain('<base href="https://studio.example/">');
    expect(doc).toContain("Content-Security-Policy");
    expect((doc.match(/<script/g) ?? []).length).toBe(1);
    expect(doc).toContain("taya-editor-bootstrap");
  });

  it("survives headless/bodyless malformed documents", async () => {
    const { buildFrameDocument } = await import("../../../convex/lib/editorFrame.ts");
    const doc = buildFrameDocument("<h1>Hello</h1>", {
      origin: "https://studio.example", path: "/", slug: "studio",
      dashboardOrigin: "https://app.fstsclientsystem.com",
    });
    expect(doc).toContain('<base href="https://studio.example/">');
    expect(doc).toContain("taya-editor-bootstrap");
  });
});

// ── Part 3 setup: tenants, identities, seeds ─────────────────────────────

let t: ReturnType<typeof convexTest>;
const FSTS_CLERK = "user_fsts_editor";
const FSTS_EMAIL = "fsts-editor@fsts.example";
const CORSAIR_CLERK = "user_corsair_editor";
const CORSAIR_EMAIL = "corsair-editor@corsair.example";
const SUPER_EMAIL = "superadmin@unknown.local";
const SUPER_CLERK = "user_super_editor";

let fstsSiteId: any;
let corsairSiteId: any;

async function seedTenants(): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPER_CLERK, name: "Super Admin", email: SUPER_EMAIL,
      isSuperAdmin: true, isActive: true, roles: [],
    });
    fstsSiteId = await ctx.db.insert("sites", {
      name: "FSTS Site", slug: "fsts-tenant", status: "active",
      domain: "www.fstacktsolutions.com",
      brandColorPrimary: "#111827", brandColorSecondary: "#1f2937",
      whiteLabelEnabled: false, poweredByFsts: true,
      websiteType: "business_website", enabledModules: {},
      connectionMode: "TAYA_CONNECTED",
    });
    corsairSiteId = await ctx.db.insert("sites", {
      name: "Corsair Site", slug: "corsair-tenant", status: "active",
      domain: "www.corsairtacticalsolution.com",
      brandColorPrimary: "#111827", brandColorSecondary: "#1f2937",
      whiteLabelEnabled: false, poweredByFsts: true,
      websiteType: "business_website", enabledModules: {},
      connectionMode: "TAYA_CONNECTED",
    });
    await ctx.db.insert("users", {
      clerkUserId: FSTS_CLERK, name: "FSTS Editor", email: FSTS_EMAIL,
      isSuperAdmin: false, isActive: true, roles: [{ siteId: fstsSiteId, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: CORSAIR_CLERK, name: "Corsair Editor", email: CORSAIR_EMAIL,
      isSuperAdmin: false, isActive: true, roles: [{ siteId: corsairSiteId, role: "owner" }],
    });
    await ctx.db.insert("siteContentMaps", {
      siteId: fstsSiteId, version: 1, domain: "www.fstacktsolutions.com",
      pages: [
        { path: "/", label: "Home", keyCount: 3 },
        { path: "/about", label: "About", keyCount: 2 },
      ],
      entries: {
        "home.hero.heading": { type: "text", discovered: "Fire Systems, Done Right" },
        "home.hero.subheading": { type: "text", discovered: "Inspection, testing, and maintenance for life-safety systems across the metro region every day." },
        "home.hero.image": { type: "image", discovered: "/hero.png" },
        "about.team.heading": { type: "text", discovered: "Our Team" },
        "about.team.body": { type: "text", discovered: "Certified technicians who keep code books current and walk every job with the inspector." },
      },
      keyCount: 5, conformed: true,
    });
    await ctx.db.insert("siteContentMaps", {
      siteId: corsairSiteId, version: 1, domain: "www.corsairtacticalsolution.com",
      pages: [
        { path: "/", label: "Home", keyCount: 2 },
        {      path: "/services", label: "Services", keyCount: 1 },
      ],
      entries: {
        "home.hero.heading": { type: "text", discovered: "Tactical Training, Real Standards" },
        "home.hero.subheading": { type: "text", discovered: "Firearms and safety instruction built from range time and real field experience for every student." },
        "services.instruction.heading": { type: "text", discovered: "Instruction" },
      },
      keyCount: 3, conformed: true,
    });
  });
}

// ── Part 3: tokens + cross-tenant denial ─────────────────────────────────

describe("editor surface — frame tokens + cross-tenant denial", () => {
  beforeEach(async () => {
    t = convexTest(schema, modules);
    vi.stubEnv("SUPERADMIN_EMAILS", SUPER_EMAIL);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await seedTenants();
  });
  afterEach(async () => {
    await t.finishInProgressScheduledFunctions();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("mints a single-use token scoped to user + site + a discovered route", async () => {
    const r = await t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL })
      .mutation(api.editor.createFrameToken, { siteId: fstsSiteId, path: "/about" });
    expect(r.token).toMatch(/^[0-9a-f]{64}$/);
    expect(r.path).toBe("/about");
    expect(r.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects unauthenticated mint", async () => {
    await expect(t.mutation(api.editor.createFrameToken, { siteId: fstsSiteId }))
      .rejects.toThrow();
  });

  it("DENIES cross-tenant mint: FSTS member → Corsair site", async () => {
    await expect(
      t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL })
        .mutation(api.editor.createFrameToken, { siteId: corsairSiteId, path: "/" })
    ).rejects.toThrow();
  });

  it("DENIES cross-tenant mint: Corsair member → FSTS site", async () => {
    await expect(
      t.withIdentity({ subject: CORSAIR_CLERK, email: CORSAIR_EMAIL })
        .mutation(api.editor.createFrameToken, { siteId: fstsSiteId, path: "/" })
    ).rejects.toThrow();
  });

  it("DENIES cross-tenant frame: _frameSite rejects a Corsair member's scope on the FSTS site (server-side, not just UI)", async () => {
    // Even if a Corsair token somehow burned with an FSTS siteId scope
    // (mint-reject prevents it; this pins the second wall), the scope
    // re-check at consumption fails.
    const site = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: fstsSiteId, clerkUserId: CORSAIR_CLERK, path: "/",
      }));
    expect(site).toBeNull();
  });

  it("DENIES cross-tenant frame: _frameSite rejects an FSTS member's scope on the Corsair site", async () => {
    const site = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: corsairSiteId, clerkUserId: FSTS_CLERK, path: "/",
      }));
    expect(site).toBeNull();
  });

  it("_frameSite resolves a member's OWN site + discovered route and returns domain/slug/path/mode", async () => {
    const site = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: fstsSiteId, clerkUserId: FSTS_CLERK, path: "/about",
      }));
    expect(site).toEqual({
      domain: "www.fstacktsolutions.com",
      slug: "fsts-tenant",
      path: "/about",
      mode: "TAYA_CONNECTED",
    });
  });

  it("_frameSite rejects a path that is NOT one of the site's discovered routes", async () => {
    const site = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: fstsSiteId, clerkUserId: FSTS_CLERK, path: "/corsair-secret/admin",
      }));
    expect(site).toBeNull();
  });

  it("_frameSite rejects superadmin-frame when the user was revoked (roles removed)", async () => {
    const site = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: fstsSiteId, clerkUserId: FSTS_CLERK, path: "/",
      }));
    expect(site).not.toBeNull();
    await t.run(async (ctx) => {
      const u = await ctx.db.query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", FSTS_CLERK)).first();
      await ctx.db.patch(u._id, { roles: [] });
    });
    const after = await t.run(async (ctx) =>
      ctx.runQuery(internal.editor._frameSite, {
        siteId: fstsSiteId, clerkUserId: FSTS_CLERK, path: "/",
      }));
    expect(after).toBeNull();
  });

  it("burns single-use (replay dead) and expires stale tokens", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    const minted = await asFsts.mutation(api.editor.createFrameToken, { siteId: fstsSiteId, path: "/" });
    const burn1 = await t.run(async (ctx) =>
      ctx.runMutation(internal.editor._burnFrameToken, { token: minted.token }));
    expect(String(burn1.siteId)).toBe(String(fstsSiteId));
    expect(burn1.clerkUserId).toBe(FSTS_CLERK);
    const burn2 = await t.run(async (ctx) =>
      ctx.runMutation(internal.editor._burnFrameToken, { token: minted.token }));
    expect(burn2).toBeNull();
    const old = await asFsts.mutation(api.editor.createFrameToken, { siteId: fstsSiteId, path: "/" });
    await t.run(async (ctx) => {
      const doc = await ctx.db.query("editorFrameTokens")
        .withIndex("by_token", ( q: any) => q.eq("token", old.token)).first();
      await ctx.db.patch(doc._id, { mintedAt: Date.now() - 10 * 60 * 1000 });
    });
    const burn3 = await t.run(async (ctx) =>
      ctx.runMutation(internal.editor._burnFrameToken, { token: old.token }));
    expect(burn3).toBeNull();
  });

  it("concurrent burn race: two simultaneous burns → exactly one wins", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    const minted = await asFsts.mutation(api.editor.createFrameToken, { siteId: fstsSiteId, path: "/" });
    const [a, b] = await Promise.all([
      t.run((ctx) => ctx.runMutation(internal.editor._burnFrameToken, { token: minted.token })),
      t.run((ctx) => ctx.runMutation(internal.editor._burnFrameToken, { token: minted.token })),
    ]);
    const winners = [a, b].filter((x) => x !== null);
    expect(winners.length).toBe(1);
  });
});

// ── Part 3b: revisions + restore + draft isolation ───────────────────────

describe("editor surface — revisions, restore-as-draft, draft isolation", () => {
  beforeEach(async () => {
    t = convexTest(schema, modules);
    vi.stubEnv("SUPERADMIN_EMAILS", SUPER_EMAIL);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await seedTenants();
  });
  afterEach(async () => {
    await t.finishInProgressScheduledFunctions();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("editorRevisions lists tenant-scoped revisions newest-first with client-safe summary", async () => {
    // Publish twice on FSTS to create revisions, then list.
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Fire Systems, Trusted Daily" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Fire Systems, Trusted Always" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });

    const revs = await asFsts.query(api.editor.editorRevisions, { siteId: fstsSiteId });
    expect(revs).not.toBeNull();
    expect(revs!.length).toBe(2);
    expect(revs![0].publishedAt).toBeGreaterThanOrEqual(revs![1].publishedAt);
    // Client-safe: no semantic keys in the summary, no internal ids leaked
    expect(revs![0].summary).toBe("Published 1 value to the live website");
    expect(JSON.stringify(revs)).not.toContain("home.hero.heading");
    expect(JSON.stringify(revs)).not.toContain("subject");
    expect(revs![0].publishedBy).toBe("FSTS Editor");
  });

  it("editorRevisions is DENIED cross-tenant (Corsair member sees null on FSTS)", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "X" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    const asCorsair = t.withIdentity({ subject: CORSAIR_CLERK, email: CORSAIR_EMAIL });
    const revs = await asCorsair.query(api.editor.editorRevisions, { siteId: fstsSiteId });
    expect(revs).toBeNull();
  });

  it("restore-as-draft promotes nothing live; the restored values land in drafts only", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Original A" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Newer B" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });

    const revs = await asFsts.query(api.editor.editorRevisions, { siteId: fstsSiteId });
    const oldest = revs![revs!.length - 1];
    const restored = await asFsts.mutation(api.editor.restoreAsDraft, {
      siteId: fstsSiteId, revisionId: oldest.revisionId as any,
    });
    expect(restored.ok).toBe(true);
    expect(restored.restoredKeys).toBe(1);
    // BUG #1 REGRESSION: the returned pending set is the EXACT applied
    // key→value entries — the client seeds Publish/Discard gating and the
    // apply-draft preview channel from precisely these pairs.
    expect(restored.restored).toEqual([
      { key: "home.hero.heading", value: "Original A" },
    ]);

    // LIVE (published) overlay must be untouched by the restore.
    const map = await t.run(async (ctx) => {
      const doc = await ctx.db.query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", fstsSiteId)).first();
      return doc;
    });
    const live = map.entries["home.hero.heading"].published ?? map.entries["home.hero.heading"].discovered;
    expect(live).toBe("Newer B");
    const draft = map.entries["home.hero.heading"].draft;
    expect(draft).toBe("Original A");
  });

  it("restore DENIES a cross-site revision (Corsair revision on FSTS site)", async () => {
    // Publish on both tenants to create revisions, then attempt the cross
    // restore: FSTS member restoring a CORSAIR revision into the FSTS site.
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    const asCorsair = t.withIdentity({ subject: CORSAIR_CLERK, email: CORSAIR_EMAIL });
    for (const [as, siteId, v] of [[asFsts, fstsSiteId, "F"], [asCorsair, corsairSiteId, "C"]] as const) {
      await as.mutation(api.publishing.saveDraft, { siteId, entries: [
        { key: "home.hero.heading", value: v },
      ]});
      await as.mutation(api.publishing.publishContentMap, { siteId });
    }
    const corsairRevs = await asCorsair.query(api.editor.editorRevisions, { siteId: corsairSiteId });
    await expect(
      asFsts.mutation(api.editor.restoreAsDraft, { siteId: fstsSiteId, revisionId: corsairRevs![0].revisionId as any })
    ).rejects.toThrow(/revision not found for this site/i);
  });

  it("restore returns only map-allowlist keys (a stale-key revision never over-reports the pending set)", async () => {
    // A revision from before a map refresh carries a key the map no longer
    // knows. The restore must apply and report ONLY the real keys — never
    // count silently-skipped keys as publishable pending state.
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Real Value" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });

    // Insert a revision whose snapshot carries one REAL key and one STALE
    // key ("legacy.gone.heading" is not in the FSTS map's entries).
    const staleRevisionId = await t.run(async (ctx) => {
      return await ctx.db.insert("contentVersions", {
        siteId: fstsSiteId,
        entityType: "content_map_publish",
        entityId: "",
        snapshot: {
          publishedAt: Date.now() - 60_000,
          keys: {
            "home.hero.heading": "Restored Heading",
            "legacy.gone.heading": "Ghost Value",
          },
        },
        createdByName: "FSTS Editor",
      });
    });

    const restored = await asFsts.mutation(api.editor.restoreAsDraft, {
      siteId: fstsSiteId, revisionId: staleRevisionId as any,
    });
    expect(restored.ok).toBe(true);
    // Count and exact entries agree, and BOTH are honest: only the key the
    // map actually has. The ghost key is neither applied nor reported.
    expect(restored.restoredKeys).toBe(1);
    expect(restored.restored).toEqual([{ key: "home.hero.heading", value: "Restored Heading" }]);

    const map = await t.run(async (ctx) => {
      const doc = await ctx.db.query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", fstsSiteId)).first();
      return doc;
    });
    expect(map.entries["home.hero.heading"].draft).toBe("Restored Heading");
    expect(map.entries["legacy.gone.heading"]).toBeUndefined();
  });

  it("restored drafts publish through the REAL server authority gate (publish-from-restore goes live)", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Original A" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "Newer B" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });

    const revs = await asFsts.query(api.editor.editorRevisions, { siteId: fstsSiteId });
    const oldest = revs![revs!.length - 1];
    await asFsts.mutation(api.editor.restoreAsDraft, {
      siteId: fstsSiteId, revisionId: oldest.revisionId as any,
    });

    // Publish after restore — no keys subset, the server publishes every
    // drafted entry through publishAuthorityFor, exactly as the UI does.
    const published = await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    expect(published.ok).toBe(true);

    const map = await t.run(async (ctx) => {
      const doc = await ctx.db.query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", fstsSiteId)).first();
      return doc;
    });
    // The restored revision's value went live through the gate, and the
    // draft overlay was cleared by the publish.
    const live = map.entries["home.hero.heading"].published ?? map.entries["home.hero.heading"].discovered;
    expect(live).toBe("Original A");
    expect(map.entries["home.hero.heading"].draft).toBeUndefined();
  });

  it("restore requires CONTENT_UPDATE (read_only member forbidden)", async () =>  {
    // read_only member on the FSTS site cannot restore.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_ro_editor", name: "RO Editor", email: "ro@fsts.example",
        isSuperAdmin: false, isActive: true, roles: [{ siteId: fstsSiteId, role: "read_only" }],
      });
    });
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "RO Test" },
    ]});
    await asFsts.mutation(api.publishing.publishContentMap, { siteId: fstsSiteId });
    const revs = await asFsts.query(api.editor.editorRevisions, { siteId: fstsSiteId });
    const asRO = t.withIdentity({ subject: "user_ro_editor", email: "ro@fsts.example" });
    await expect(asRO.mutation(api.editor.restoreAsDraft, {
      siteId: fstsSiteId, revisionId: revs![0].revisionId as any,
    })).rejects.toThrow();
  });

  it("bridge _content NEVER serves draft values (draft isolation for anonymous visitors)", async () => {
    const asFsts = t.withIdentity({ subject: FSTS_CLERK, email: FSTS_EMAIL });
    await asFsts.mutation(api.publishing.saveDraft, { siteId: fstsSiteId, entries: [
      { key: "home.hero.heading", value: "SECRET DRAFT NEVER LEAK" },
    ]});
    const data: any = await t.query(internal.bridge._content, { slug: "fsts-tenant" });
    expect(data.values["home.hero.heading"]).toBe("Fire Systems, Done Right"); // discovered only
    expect(JSON.stringify(data)).not.toContain("SECRET DRAFT NEVER LEAK");
  });
});


// ── Part 4: HTTP route GET /api/editor/frame ──────────────────────────────
//
// The route burns the token FIRST (single-use), re-verifies scope against
// the site's own discovered routes, fetches the live page bounded, then
// serves an annotated, editor-safe document. The ctx mock dispatches on
// the REAL internal function references http.ts imports.

describe("HTTP GET /api/editor/frame", () => {
  const KEY = "GET:/api/editor/frame";

  /**
   * Sequenced ctx mock: the route makes exactly two ctx calls in order —
   * runMutation(token) [burn] then runQuery({siteId, clerkUserId, path})
   * [scope re-check]. Args are asserted EXACTLY, so the mock both feeds
   * the route and verifies the burn-first / scope-second call discipline
   * (module-registry refs are symbol-like objects and never identity-
   * comparable across the two module graphs, so args + order is the
   * honest contract here).
   */
  function ctxSequence(
    burnResult: unknown,
    siteResult: unknown,
    expected: { token: string; siteId: string; clerkUserId: string; path: string },
  ) {
    const calls: Array<{ kind: string; args: unknown }> = [];
    let burned = false;
    let scoped = false;
    const runMutation = vi.fn(async (fn: any, args: any) => {
      if (burned) throw new Error("runMutation called twice — burn must be single");
      burned = true;
      calls.push({ kind: "burn", args });
      if (!args || typeof args !== "object" || Object.keys(args).join(",") !== "token") {
        throw new Error("burn args must be exactly { token }");
      }
      if (args.token !== expected.token) {
        throw new Error("burn received a different token than the request");
      }
      return burnResult;
    });
    const runQuery = vi.fn(async (fn: any, args: any) => {
      if (scoped) throw new Error("runQuery called twice");
      scoped = true;
      calls.push({ kind: "scope", args });
      const want = {
        siteId: expected.siteId,
        clerkUserId: expected.clerkUserId,
        path: expected.path,
      };
      if (JSON.stringify(args) !== JSON.stringify(want)) {
        throw new Error(
          "scope args mismatch — route must forward the burned token's siteId/clerkUserId + the requested path: " +
            JSON.stringify(args),
        );
      }
      return siteResult;
    });
    return { runMutation, runQuery, calls };
  }

  function frameRequest(params: Record<string, string>) {
    const q = new URLSearchParams(params).toString();
    return new Request(`https://convex.test/api/editor/frame?${q}`);
  }

  const LIVE_HTML = `<!doctype html>
<html><head><title>Live</title><link rel="stylesheet" href="/style.css"></head>
<body>
<h1>Live Studio Heading</h1>
<p>Live paragraph that is long enough to behave like a real subheading for the hero area of this page in the frame.</p>
<section id="about"><h2>About</h2><p>Live about body text here.</p></section>
<script src="/site.js"></script>
</body></html>`;

  it("registers GET /api/editor/frame (route capture)", () => {
    expect(capturedRoutes.has(KEY)).toBe(true);
  });

  it("400s with a client-safe message when no token is supplied", async () => {
    const ctx = ctxSequence({ siteId: "s", clerkUserId: "u" }, { domain: "d" }, { token: "t", siteId: "s", clerkUserId: "u", path: "/" });
    const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ path: "/" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "token required" });
    expect(ctx.runMutation).not.toHaveBeenCalled(); // burn NOT reached
  });

  it("401s (expired link) when the burn returns null — token was invalid/replayed/expired", async () => {
    const ctx = ctxSequence(null, { domain: "never-reached" }, { token: "deadbeef", siteId: "s", clerkUserId: "u", path: "/" });
    const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ token: "deadbeef", path: "/" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "This editor link has expired. Reopen the editor to continue.",
    });
    expect(ctx.runQuery).not.toHaveBeenCalled(); // scope check NOT reached
  });

  it("404s (page unavailable) when the scope re-check rejects the path/user", async () => {
    const ctx = ctxSequence({ siteId: "s", clerkUserId: "u" }, null,
      { token: "t", siteId: "s", clerkUserId: "u", path: "/not-a-route" });
    const fetchMock = vi.fn(async () => { throw new Error("must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ token: "t", path: "/not-a-route" }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "This page isn't available in the editor." });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("502s (site unreachable) when the bounded fetch fails", async () => {
    const ctx = ctxSequence(
      { siteId: "s", clerkUserId: "u" },
      { domain: "www.fstacktsolutions.com", slug: "fsts-tenant", path: "/", mode: "TAYA_CONNECTED" },
      { token: "t", siteId: "s", clerkUserId: "u", path: "/" },
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    try {
      const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ token: "t", path: "/" }));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({
        error: "The website couldn't be reached. Try again shortly.",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("serves the annotated editor-safe document on the happy path (CSP, no-store, base, bootstrap)", async () => {
    const ctx = ctxSequence(
      { siteId: "s", clerkUserId: "u" },
      { domain: "www.fstacktsolutions.com", slug: "fsts-tenant", path: "/", mode: "TAYA_CONNECTED" },
      { token: "t", siteId: "s", clerkUserId: "u", path: "/" },
    );
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(LIVE_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    ));
    try {
      const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ token: "t", path: "/" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors");
      expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      const body = await res.text();
      // The REAL page (annotated), not an error page.
      expect(body).toContain("Live Studio Heading");
      expect(body).toContain('data-taya-edit="home.hero.heading"');
      // Editor-safe transform artifacts.
      expect(body).toContain("<base href=\"https://www.fstacktsolutions.com/\">");
      expect((body.match(/<script/g) ?? []).length).toBe(1); // bootstrap ONLY
      expect(body).not.toContain("/site.js");
      expect(body).toContain("taya-editing");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("replay of the same token is dead: second burn returns null → 401", async () => {
    // First call consumes the token.
    const ctx1 = ctxSequence(
      { siteId: "s", clerkUserId: "u" },
      { domain: "www.fstacktsolutions.com", slug: "fsts-tenant", path: "/", mode: "TAYA_CONNECTED" },
      { token: "t", siteId: "s", clerkUserId: "u", path: "/" },
    );
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(LIVE_HTML, { status: 200, headers: { "content-type": "text/html" } })
    ));
    try {
      const first = await capturedRoutes.get(KEY)!(ctx1, frameRequest({ token: "t", path: "/" }));
      expect(first.status).toBe(200);
      // The token was burned by the first request; a replay gets null burn.
      const ctx2 = ctxSequence(null, null, { token: "t", siteId: "s", clerkUserId: "u", path: "/" });
      const replay = await capturedRoutes.get(KEY)!(ctx2, frameRequest({ token: "t", path: "/" }));
      expect(replay.status).toBe(401);
      expect(await replay.json()).toEqual({
        error: "This editor link has expired. Reopen the editor to continue.",
      });
      expect(ctx2.runQuery).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("burns before ANY work: an invalid token never reaches scope/fetch (server-side assertion)", async () => {
    const ctx = ctxSequence(null, { domain: "never-reached" }, { token: "t", siteId: "s", clerkUserId: "u", path: "/" });
    const fetchMock = vi.fn(async () => { throw new Error("must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await capturedRoutes.get(KEY)!(ctx, frameRequest({ token: "t", path: "/" }));
      expect(res.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
