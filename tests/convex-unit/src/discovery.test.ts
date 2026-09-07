/**
 * PHASE 2 — UNIVERSAL WEBSITE ADAPTER: server-side discovery (spec §4–§6, §16).
 * @vitest-environment edge-runtime
 *
 * Pins the read-only crawler contract:
 *
 *   §4  ADD WEBSITE → auto: the crawl discovers routes (nav > footer >
 *       sitemap > body), extracts the page model per route, identifies the
 *       platform, and folds everything into stable §5 content keys.
 *   §5  STABLE KEYS: keys derive from PAGE + SECTION SEMANTICS — never raw
 *       DOM selectors. Same HTML must always yield the SAME keys
 *       (determinism). Canonical shapes pinned: home.hero.heading /
 *       .subheading / .image / .primaryButton.label, about.intro.heading,
 *       services.items[0].title/.description/.image.
 *   §6  CONNECTION MODES: external-domain crawl success →
 *       sites.connectionMode = "DISCOVERED_EXTERNAL"; TAYA_NATIVE is set at
 *       provisioning when no external domain.
 *   §14 explicit reasons — a failed crawl persists failureReason, never a
 *       fabricated snapshot.
 *   §16 READ-ONLY: the crawl performs only GET fetches; the snapshot is a
 *       review artifact — nothing is applied to any live site.
 *   §22 TENANT ISOLATION: discovery reads are site-scoped; cross-tenant
 *       callers get null/[] and triggerDiscovery denies access.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import {
  absoluteUrl,
  sameSite,
  routePath,
  pageKeySegment,
  sectionKeyRoot,
  extractMeta,
  extractNavLinks,
  parseSitemap,
  extractPageModel,
} from "../../../convex/lib/discovery/html";
import { crawlSite } from "../../../convex/lib/discovery/crawl";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Fixtures ───────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const OWNER_EMAIL = "acmeowner@example.com";
const OWNER_CLERK = "user_acme_owner";
const OTHER_EMAIL = "othertenant@example.com";
const OTHER_CLERK = "user_other_tenant";
const SUPERADMIN_CLERK = "user_superadmin_discovery";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const ACME_DOMAIN = "acmedental.com";
// A client with NO prior TAYA presence and a domain no seeded tenant owns —
// exercises the §4 scheduler wiring through the real provisionSite mutation
// (a domain colliding with Acme would §3 safe-stop before scheduling).
const FRESH_EMAIL = "riley.chen@example.com";
const FRESH_CLERK = "user_riley_fresh";
const FRESH_DOMAIN = "sparkledentalpractice.com";

const HOME_HTML = `<!doctype html>
<html><head>
<title>Acme Dental Studio — Modern dentistry</title>
<meta name="description" content="Friendly dental care for the whole family in Springfield.">
<meta property="og:title" content="Acme Dental Studio">
<meta name="generator" content="WordPress 6.4">
</head>
<body>
<nav><a href="/">Home</a> <a href="/about">About</a> <a href="/services">Services</a> <a href="/contact">Contact</a></nav>
<h1>Welcome to Acme Dental Studio</h1>
<p>We provide gentle, modern dental care for the whole family in Springfield, Oregon.</p>
<a class="btn btn-primary" href="/contact">Book an appointment</a>
<img src="/images/hero-clinic.jpg" alt="The Acme clinic">
<section>
  <h2>About Us</h2>
  <p>Acme Dental Studio has served Springfield for over twenty years with honest advice.</p>
</section>
<section>
  <h2>Our Services</h2>
  <ul>
    <li><h3>Cleanings</h3><p>Thorough preventive cleanings every six months.</p><img src="/images/cleaning.jpg" alt="Cleaning"></li>
    <li><h3>Whitening</h3><p>Professional whitening that brightens your smile safely.</p><img src="/images/whitening.jpg" alt="Whitening"></li>
    <li><h3>Implants</h3><p>Durable implants that restore chewing and confidence.</p></li>
  </ul>
</section>
<footer>© 2024 Acme Dental Studio. All rights reserved.</footer>
</body></html>`;

const ABOUT_HTML = `<!doctype html>
<html><head><title>About — Acme Dental Studio</title></head><body>
<nav><a href="/">Home</a> <a href="/about">About</a> <a href="/services">Services</a></nav>
<h1>About Acme Dental Studio</h1>
<p>Our practice was founded in 2004 with one goal: dental care that respects your time.</p>
<section>
  <h2>Our Mission</h2>
  <p>Honest, unhurried dentistry for every family in Springfield, Oregon.</p>
</section>
<footer>© 2024 Acme Dental Studio.</footer>
</body></html>`;

const SERVICES_HTML = `<!doctype html>
<html><head><title>Services — Acme Dental Studio</title></head><body>
<nav><a href="/">Home</a> <a href="/about">About</a> <a href="/services">Services</a></nav>
<h1>Our Services</h1>
<p>Everything your family needs for a healthy smile, under one roof in Springfield.</p>
<section>
  <h2>What We Offer</h2>
  <ul>
    <li><h3>Cleanings</h3><p>Thorough preventive cleanings every six months.</p><img src="/images/cleaning.jpg" alt="Cleaning"></li>
    <li><h3>Whitening</h3><p>Professional whitening that brightens your smile safely.</p></li>
    <li><h3>Implants</h3><p>Durable implants that restore chewing and confidence.</p></li>
  </ul>
</section>
<footer>© 2024 Acme Dental Studio.</footer>
</body></html>`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://acmedental.com/</loc></url>
<url><loc>https://acmedental.com/about</loc></url>
<url><loc>https://acmedental.com/services</loc></url>
</urlset>`;

/**
 * Homepage for the second tenant-style fixture (sparkledentalpractice.com).
 * A one-page WordPress site: the crawl fetches it, its /sitemap.xml 404s,
 * every other nav link 404s as error pages — a crawl that still completes
 * and folds stable keys (the §4 "auto" contract tolerates partial sites).
 */
const SPARKLE_HTML = `<!doctype html>
<html><head>
<title>Sparkle Dental Practice</title>
<meta name="description" content="Gentle family dentistry in Eugene.">
<meta name="generator" content="WordPress 6.5">
</head><body>
<nav><a href="/">Home</a> <a href="/about">About</a></nav>
<h1>Sparkle Dental Practice</h1>
<p>Gentle, unhurried family dentistry for every neighbor in Eugene, Oregon.</p>
<a class="btn btn-primary" href="/book">Book a visit</a>
<img src="/img/office.jpg" alt="Our office">
<section>
  <h2>What We Offer</h2>
  <ul>
    <li><h3>Exams</h3><p>Complete exams with honest, plain-language findings.</p></li>
    <li><h3>Cleanings</h3><p>Gentle cleanings that keep smiles healthy year-round.</p></li>
  </ul>
</section>
<footer>© 2024 Sparkle Dental Practice.</footer>
</body></html>`;

/** Stub fetch to serve the fake site above (read-only GETs only). */
function stubSiteFetch() {
  const pages: Record<string, { status: number; body?: string; type?: string }> = {
    "https://acmedental.com": { status: 200, body: HOME_HTML, type: "text/html" },
    "https://acmedental.com/about": { status: 200, body: ABOUT_HTML, type: "text/html" },
    "https://acmedental.com/services": { status: 200, body: SERVICES_HTML, type: "text/html" },
    "https://acmedental.com/sitemap.xml": { status: 200, body: SITEMAP_XML, type: "application/xml" },
    "https://acmedental.com/contact": { status: 404 },
    "https://sparkledentalpractice.com": { status: 200, body: SPARKLE_HTML, type: "text/html" },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input);
      const hit = pages[url];
      if (hit) {
        return new Response(hit.status === 200 ? hit.body! : null, {
          status: hit.status,
          headers: { "content-type": hit.type ?? "text/html" },
        });
      }
      return new Response(null, { status: 404 });
    }),
  );
}

async function seed(): Promise<any> {
  const acmeSiteId = await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Platform Owner",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    const acmeSite = await ctx.db.insert("sites", {
      name: "Acme Dental Studio",
      slug: "acme-dental-studio",
      status: "active",
      domain: ACME_DOMAIN,
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: OWNER_CLERK,
      name: "Acme Owner",
      email: OWNER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: acmeSite, role: "owner" }],
    });
    const otherSite = await ctx.db.insert("sites", {
      name: "Other Tenant Co",
      slug: "other-tenant-co",
      status: "active",
      domain: "othertenant.example",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: OTHER_CLERK,
      name: "Other Owner",
      email: OTHER_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: otherSite, role: "owner" }],
    });
    return acmeSite;
  });
  return acmeSiteId;
}

let acmeSiteId: any;

beforeEach(async () => {
  t = convexTest(schema, modules);
  acmeSiteId = await seed();
  stubSiteFetch();
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
});

afterEach(async () => {
  // DETERMINISM (§4 wiring): provisionSite/sites.create/onboarding.launch
  // schedule the crawl fire-and-forget via ctx.scheduler.runAfter(0, …).
  // convex-test auto-fires those with a REAL setTimeout — but module loads
  // are microtask-only, so a scheduled crawl never starts before the test
  // body completes. Left alone, it would run between tests against the REAL
  // network (afterEach unstubs fetch first). Drain instead: keep the fetch
  // stub (unknown URLs → 404 → crawl records an explicit error, §14), yield
  // one macrotask so the setTimeout fires, then wait for in-flight crawls.
  // Never a hang-stub: a pending fetch inside the crawl holds the test
  // TransactionManager lock and would deadlock every later call.
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const asOwner = () => t.withIdentity({ subject: OWNER_CLERK, email: OWNER_EMAIL });
const asOther = () => t.withIdentity({ subject: OTHER_CLERK, email: OTHER_EMAIL });
const asSuperadmin = () => t.withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL });
// A client with no prior TAYA presence — mirrors the §1 self-service path.
const asFresh = () =>
  t.withIdentity({ subject: FRESH_CLERK, email: FRESH_EMAIL, name: "Riley Chen" });

// ─── §4/§5 pure helpers: URL + route + key grammar ──────────────────────────

describe("discovery key grammar (§5) — page-scoped, namesake-elided", () => {
  it("pageKeySegment: '/' → home; deep paths → dotted slugs", () => {
    expect(pageKeySegment("/")).toBe("home");
    expect(pageKeySegment("/about")).toBe("about");
    expect(pageKeySegment("/services")).toBe("services");
    expect(pageKeySegment("/team/join")).toBe("team.join");
  });

  it("sectionKeyRoot: page-prefixed; namesake section elides its role", () => {
    // A hero on the homepage → home.hero.*
    expect(sectionKeyRoot("/", "hero")).toBe("home.hero");
    // A "services" section on /services → services.* (namesake elision)
    expect(sectionKeyRoot("/services", "services")).toBe("services");
    // An "about" section on the homepage → home.about.*
    expect(sectionKeyRoot("/", "about")).toBe("home.about");
    // A lead block on /about → about.intro.* (§5 about.intro.heading)
    expect(sectionKeyRoot("/about", "intro")).toBe("about.intro");
  });

  it("absoluteUrl/sameSite/routePath: same-site normalization", () => {
    expect(absoluteUrl("/about", "https://acmedental.com")).toBe("https://acmedental.com/about");
    expect(absoluteUrl("https://other.example/x", "https://acmedental.com")).toBe(
      "https://other.example/x",
    );
    expect(sameSite("https://acmedental.com/about", ACME_DOMAIN)).toBe(true);
    expect(sameSite("https://shop.other.example", ACME_DOMAIN)).toBe(false);
    expect(routePath("https://acmedental.com/about?x=1", "https://acmedental.com")).toBe("/about");
    expect(routePath("https://other.example/about", "https://acmedental.com")).toBe(null);
  });
});

// ─── §5 extraction: stable keys from the fixture site ───────────────────────

describe("extractPageModel — canonical §5 key shapes from fixture HTML", () => {
  it("homepage hero: extractHero owns home.hero.* (h1, ≥40-char lede, image, button)", () => {
    const model = extractPageModel(HOME_HTML, "/", "https://acmedental.com");
    expect(model.hero.heading).toBe("Welcome to Acme Dental Studio");
    expect(model.hero.subheading).toContain("gentle, modern dental care");
    expect(model.hero.image).toBe("/images/hero-clinic.jpg");
    expect(model.hero.primaryButton?.label).toBe("Book an appointment");
    expect(model.hero.primaryButton?.href).toBe("/contact");
  });

  it("services page: repeatable cards fold into services.items (§5 namesake elision)", () => {
    const model = extractPageModel(SERVICES_HTML, "/services", "https://acmedental.com/services");
    // The lead h1 "Our Services" is intro (lead-scoped), so the "What We
    // Offer" section is the namesake services section: its cards fold to
    // services.items[0].title, not services.services.items[0].title.
    const services = model.sections.find((s) => s.role === "services");
    expect(services?.items).toHaveLength(3);
    expect(services?.items[0].title).toBe("Cleanings");
    expect(services?.items[0].description).toContain("preventive cleanings");
    expect(services?.items[0].image).toBe("/images/cleaning.jpg");
    expect(services?.items[2].title).toBe("Implants");
    expect(services?.items[2].image).toBeNull();
  });

  it("about page: lead block becomes intro (§5 about.intro.heading)", () => {
    const model = extractPageModel(ABOUT_HTML, "/about", "https://acmedental.com/about");
    const intro = model.sections.find((s) => s.role === "intro");
    expect(intro).toBeTruthy();
    // The about page's own h1/lede are not re-extracted as a hero (hero is
    // homepage-only per §5's home.hero.* canonical).
    expect(model.hero.heading).toBeNull();
    // Namesake rule does not apply to "intro" on /about — key stays about.intro.*.
    expect(sectionKeyRoot("/about", "intro")).toBe("about.intro");
  });

  it("determinism: the SAME html always yields the SAME keys", () => {
    const a = extractPageModel(HOME_HTML, "/", "https://acmedental.com");
    const b = extractPageModel(HOME_HTML, "/", "https://acmedental.com");
    const keySet = (m: any) => {
      const keys: string[] = [];
      for (const s of m.sections) keys.push(...s.keys);
      return keys.sort().join(",");
    };
    expect(keySet(a)).toBe(keySet(b));
    // And the canonical keys are present, page-prefixed.
    expect(keySet(a)).toContain("home.about.heading");
    expect(keySet(a)).toContain("home.services.items[0].title");
  });

  it("nav extraction: <nav> links become routes (nav > footer priority source)", () => {
    const { navItems, routes } = extractNavLinks(HOME_HTML, "https://acmedental.com");
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/about");
    expect(paths).toContain("/services");
    expect(paths).toContain("/contact");
    expect(navItems.length).toBeGreaterThanOrEqual(3);
  });

  it("sitemap parsing: <loc> entries become route paths", () => {
    const paths = parseSitemap(SITEMAP_XML);
    expect(paths).toContain("/about");
    expect(paths).toContain("/services");
    expect(paths).not.toContain("/");
  });

  it("meta extraction + platform detection (§4 identify technology)", () => {
    const meta = extractMeta(HOME_HTML);
    expect(meta.title).toContain("Acme Dental Studio");
    expect(meta.description).toContain("dental care");
    expect(meta.generator).toMatch(/WordPress/i);
  });
});

// ─── §4/§16 crawlSite: read-only end-to-end crawl ───────────────────────────

describe("crawlSite — read-only crawl of the fixture site (§4, §16)", () => {
  it("crawls the homepage, discovers routes, and folds a stable content map", async () => {
    const result = await crawlSite(ACME_DOMAIN);
    expect(result.failureReason).toBeNull();
    expect(result.snapshot).toBeTruthy();
    const snap: any = result.snapshot;

    // §5 canonical keys present in the content map.
    expect(snap.contentMap["home.hero.heading"]?.value).toBe("Welcome to Acme Dental Studio");
    expect(snap.contentMap["home.hero.subheading"]?.value).toContain("gentle");
    expect(snap.contentMap["home.hero.primaryButton.label"]?.value).toBe("Book an appointment");
    expect(snap.contentMap["home.about.heading"]?.value).toBe("About Us");
    expect(snap.contentMap["home.services.items[0].title"]?.value).toBe("Cleanings");
    expect(snap.contentMap["home.services.items[0].description"]).toBeTruthy();

    // Routes discovered via nav + sitemap; the 404 contact page is recorded
    // as an error page, not a silent drop.
    const routes = snap.routes.map((r: any) => r.path);
    expect(routes).toContain("/about");
    expect(routes).toContain("/services");
    // SnapshotPage carries both the status and the HTTP code (§14 evidence).
    const contact = snap.pages.find((p: any) => p.path === "/contact");
    expect(contact?.status).toBe("error");
    expect(contact?.httpStatus).toBe(404);
    // Report parity: keyCount is the map's own size (§5 contract).
    expect(snap.keyCount).toBe(Object.keys(snap.contentMap).length);
    // §4 identify technology: the WordPress generator meta wins.
    expect(snap.platform).toBe("wordpress");
  });

  it("namesake elision: a services section on /services yields services.items[0].title (§5)", async () => {
    const result = await crawlSite(ACME_DOMAIN);
    const snap: any = result.snapshot;
    // The /services cards are namesake keys — never nested under a
    // services.services.* prefix (§5 page + section semantics).
    expect(snap.contentMap["services.items[0].title"]?.value).toBe("Cleanings");
    expect(
      Object.keys(snap.contentMap).some((k: string) =>
        k.startsWith("services.services"),
      ),
    ).toBe(false);
    // And the /about lead block folds into the about.intro.* canonical.
    expect(snap.contentMap["about.intro.heading"]?.value).toBeTruthy();
  });

  it("junk routes are filtered (wp-admin, login, assets, query strings)", async () => {
    // §4/§16: the fixture nav is clean — no admin/asset/query routes — so
    // this pins the negative space AND crawl determinism below.
    const result = await crawlSite(ACME_DOMAIN);
    expect(result.failureReason).toBeNull();
    const snap: any = result.snapshot;
    const visited = snap.pages.map((p: any) => p.path);
    expect(visited).not.toContain("/wp-admin");
    expect(visited).not.toContain("/login");
    // Determinism: repeated crawl of the same site → identical key set.
    const again = await crawlSite(ACME_DOMAIN);
    expect(Object.keys((again.snapshot as any).contentMap).sort()).toEqual(
      Object.keys(snap.contentMap).sort(),
    );
  });

  it("unreachable site → explicit failureReason, never a fabricated snapshot (§14)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ENOTFOUND");
      }),
    );
    const result = await crawlSite("unreachable.example");
    expect(result.snapshot).toBeNull();
    expect(result.failureReason).toBeTruthy();
    expect(result.failureReason).toContain("unreachable.example");
  });
});

// ─── §6/§16/§22 Convex surface: snapshots, connectionMode, isolation ────────

describe("discovery.run — snapshot persistence + connection mode (§6, §16)", () => {
  it("persists an initial snapshot and sets DISCOVERED_EXTERNAL + platform", async () => {
    const result = await asSuperadmin().action(internal.discovery.run, {
      siteId: acmeSiteId,
      triggeredBy: OWNER_EMAIL,
    });
    expect(result.status).toBe("completed");
    expect(result.keyCount).toBeGreaterThan(0);

    let row: any, site: any;
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("discoverySnapshots").collect();
      expect(rows).toHaveLength(1);
      row = rows[0];
      site = await ctx.db.get(acmeSiteId);
    });
    expect(row.kind).toBe("initial");
    expect(row.status).toBe("completed");
    expect(row.domain).toBe(ACME_DOMAIN);
    expect(row.triggeredBy).toBe(OWNER_EMAIL);
    expect(row.snapshot.contentMap["home.hero.heading"]).toBeTruthy();
    expect(row.report.keyCount).toBe(row.snapshot.keyCount);
    // §6: external-domain crawl success → DISCOVERED_EXTERNAL.
    expect(site.connectionMode).toBe("DISCOVERED_EXTERNAL");
    expect(site.detectedPlatform).toBeTruthy();
  });

  it("a second crawl is kind=refresh and the site stays DISCOVERED_EXTERNAL", async () => {
    await asSuperadmin().action(internal.discovery.run, { siteId: acmeSiteId });
    const second = await asSuperadmin().action(internal.discovery.run, {
      siteId: acmeSiteId,
      triggeredBy: OWNER_EMAIL,
    });
    expect(second.status).toBe("completed");
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("discoverySnapshots").collect();
      expect(rows).toHaveLength(2);
      expect(rows.filter((r: any) => r.kind === "initial")).toHaveLength(1);
      expect(rows.filter((r: any) => r.kind === "refresh")).toHaveLength(1);
    });
  });

  it("failed crawl persists an explicit failureReason (§14 — never silent)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );
    const result = await asSuperadmin().action(internal.discovery.run, {
      siteId: acmeSiteId,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toBeTruthy();
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("discoverySnapshots").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("failed");
      expect(rows[0].failureReason).toBeTruthy();
      expect(rows[0].snapshot).toBeUndefined();
      // §6: no mode change on failure — the site stays unset.
      const site = await ctx.db.get(acmeSiteId);
      expect(site.connectionMode).toBeUndefined();
    });
  });

  it("a site without a domain records an explicit no-domain failure", async () => {
    let domainlessId: any;
    await t.run(async (ctx) => {
      domainlessId = await ctx.db.insert("sites", {
        name: "No Domain Site",
        slug: "no-domain-site",
        status: "active",
        brandColorPrimary: "#1d4ed8",
        brandColorSecondary: "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
      });
    });
    const result = await asSuperadmin().action(internal.discovery.run, {
      siteId: domainlessId,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("No domain recorded");
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("discoverySnapshots").withIndex("by_site", (q: any) =>
        q.eq("siteId", domainlessId),
      ).collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].failureReason).toContain("No domain recorded");
    });
  });
});

describe("discovery public reads — site-scoped (§22)", () => {
  it("getLatestSnapshot/getReport/listSnapshots: owner sees data, other tenant sees null/[]", async () => {
    await asSuperadmin().action(internal.discovery.run, { siteId: acmeSiteId });

    // Owner reads.
    const latest = await asOwner().query(api.discovery.getLatestSnapshot, {
      siteId: acmeSiteId,
    });
    expect(latest).toBeTruthy();
    expect(latest.status).toBe("completed");
    expect(latest.snapshot.contentMap["home.hero.heading"]).toBeTruthy();

    const report = await asOwner().query(api.discovery.getReport, { siteId: acmeSiteId });
    expect(report.status).toBe("completed");
    expect(report.platform).toBeTruthy();
    expect(report.keyCount).toBeGreaterThan(0);
    expect(report.pages.length).toBeGreaterThanOrEqual(3);
    expect(report.routes.length).toBeGreaterThanOrEqual(2);

    const history = await asOwner().query(api.discovery.listSnapshots, {
      siteId: acmeSiteId,
    });
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("completed");

    // Cross-tenant: §22 isolation — null / empty, never another tenant's data.
    expect(await asOther().query(api.discovery.getLatestSnapshot, { siteId: acmeSiteId })).toBeNull();
    expect(await asOther().query(api.discovery.getReport, { siteId: acmeSiteId })).toBeNull();
    expect(await asOther().query(api.discovery.listSnapshots, { siteId: acmeSiteId })).toEqual([]);
  });

  it("triggerDiscovery: owner succeeds, other tenant denied (§22)", async () => {
    const result = await asOwner().action(api.discovery.triggerDiscovery, {
      siteId: acmeSiteId,
    });
    expect(result.status).toBe("completed");
    await expect(
      asOther().action(api.discovery.triggerDiscovery, { siteId: acmeSiteId }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ─── §4 auto-discovery wiring at provisioning ───────────────────────────────

describe("provisioning schedules auto-discovery (§4 fire-and-forget)", () => {
  it("provisionSite schedules the crawl (external domain)", async () => {
    // A FRESH client (no prior TAYA presence, no seeded role) provisions a
    // domain no other tenant owns — the real §1/§4 path, so the §4 scheduler
    // wiring inside provisionSite itself is what fires here.
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Riley Chen",
        company: "Sparkle Dental Practice",
        websiteUrl: `https://www.${FRESH_DOMAIN}`,
        websiteType: "business_website",
      },
    );
    expect(provisioned.outcome).toBe("created");
    expect(provisioned.domain).toBe(FRESH_DOMAIN);

    // Drain: yield one macrotask so the auto-fired crawl starts (if it has
    // not already — convex-test fires it on a real setTimeout, and dynamic
    // module loads inside later calls can yield the event loop early), then
    // wait for it to finish. It runs WITHOUT auth (fresh top-level
    // execution) and the stub serves the Sparkle WordPress homepage.
    // NOTE: the PRE-drain state is deliberately NOT asserted — exactly when
    // the auto-fire begins is a convex-test implementation detail, not a
    // product contract. The product contracts are: provisioning returns
    // immediately (§4 fire-and-forget — the pending-until-lands certify
    // state is pinned in self-service-onboarding.test.ts) and, once drained,
    // the crawl landed the INITIAL snapshot and the §6 mode.
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();

    // The scheduled crawl persisted the INITIAL snapshot (§16)…
    const latest: any = await asFresh().query(api.discovery.getLatestSnapshot, {
      siteId: provisioned.siteId,
    });
    expect(latest).toBeTruthy();
    expect(latest.kind).toBe("initial");
    expect(latest.status).toBe("completed");
    expect(latest.domain).toBe(FRESH_DOMAIN);
    expect(latest.triggeredBy).toBe(FRESH_EMAIL);
    expect(latest.snapshot.contentMap["home.hero.heading"]?.value).toBe(
      "Sparkle Dental Practice",
    );
    // …and identified the site as DISCOVERED_EXTERNAL (§6).
    const site: any = await asFresh().query(api.sites.get, {
      siteId: provisioned.siteId,
    });
    expect(site.connectionMode).toBe("DISCOVERED_EXTERNAL");
    expect(site.detectedPlatform).toBe("wordpress");

    // §4 step 11: the onboarding report the client reviews.
    const report: any = await asFresh().query(api.discovery.getReport, {
      siteId: provisioned.siteId,
    });
    expect(report.status).toBe("completed");
    expect(report.platform).toBe("wordpress");
    expect(report.keyCount).toBeGreaterThan(0);

    // §14: with the snapshot landed, certify upgrades the phase-2 checks.
    const cert: any = await asFresh().action(api.selfServiceOnboarding.certify, {
      siteId: provisioned.siteId,
    });
    expect(cert.complete).toBe(true);
    const byCheck = Object.fromEntries(cert.checks.map((c: any) => [c.check, c.status]));
    expect(byCheck.page_discovery_completed).toBe("pass");
    expect(byCheck.publishing_mode_identified).toBe("pass");
  });

  it("sites.create with a TAYA subdomain is TAYA_NATIVE — nothing to crawl", async () => {
    // §6: a TAYA-hosted subdomain is native — provisioning records
    // TAYA_NATIVE and schedules NO crawl (the guard in sites.create).
    const created: any = await asSuperadmin().mutation(api.sites.create, {
      name: "Native Demo Site",
      slug: "native-demo-site",
      domain: "native-demo.fstsclientsystem.com",
    });
    expect(created.connectionMode).toBe("TAYA_NATIVE");

    // Drain to prove the negative: nothing was scheduled for this site.
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();

    expect(
      await asSuperadmin().query(api.discovery.listSnapshots, {
        siteId: created.id,
      }),
    ).toEqual([]);
  });

  it("sites.create with an external domain schedules exactly one crawl", async () => {
    const created: any = await asSuperadmin().mutation(api.sites.create, {
      name: "Another External Site",
      slug: "another-external-site",
      domain: "anotherexternal.example",
    });
    expect(created.connectionMode).toBeUndefined(); // §6: unset until crawl

    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();

    // The stub 404s every unknown origin → §14 explicit failureReason, and
    // connectionMode stays unset (never a fabricated success).
    const snaps: any = await asSuperadmin().query(api.discovery.listSnapshots, {
      siteId: created.id,
    });
    expect(snaps).toHaveLength(1);
    expect(snaps[0].status).toBe("failed");
    expect(snaps[0].failureReason).toBeTruthy();
    const site: any = await asSuperadmin().query(api.sites.get, {
      siteId: created.id,
    });
    expect(site.connectionMode).toBeUndefined();
  });
});
