/**
 * PHASE 2 — §4/§7 WORKSPACE AUTO-CONFORM (PR-2).
 * @vitest-environment edge-runtime
 *
 * Pins the auto-conform contract end to end:
 *
 *   §4  The route → module table is GENERIC DATA — any site, any customer,
 *       no per-customer slug branch anywhere in the derivation.
 *   §7  A completed discovery crawl conforms the client workspace:
 *       enable-only module patch, nav rows for newly-enabled modules, and
 *       the durable §5 page/content map — applied atomically in the same
 *       transaction as the snapshot. Auto-conform is UI/module/page-map
 *       configuration ONLY: it NEVER grants an RBAC permission, NEVER
 *       overwrites an owner role, and can NEVER expose an admin/system
 *       module (CONFORMABLE_MODULES is deliberately narrower than the
 *       module universes a dashboard or a default seed may contain).
 *   Idempotency: conforming the same site twice changes nothing the second
 *       time (enable-only merge, href-deduped nav inserts, single-row
 *       content-map upsert).
 *   §22 isolation still holds after conform.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import {
  ROUTE_MODULE_TABLE,
  CONFORMABLE_MODULES,
  moduleForRoute,
  conformWorkspace,
  mergeEnabledModules,
} from "../../../convex/lib/discovery/contentMap";
import { MODULE_NAV_MAP } from "../../../convex/lib/siteProvisioning";
import { DASHBOARD_MODULES } from "../../../convex/lib/roleCapabilities";
import type { DiscoverySnapshot } from "../../../convex/lib/discovery/crawl";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Fixtures ───────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

const SUPERADMIN_CLERK = "user_superadmin_conform";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";
const RIVAL_EMAIL = "rival@example.com";
const RIVAL_CLERK = "user_rival_conform";
const RIVAL_DOMAIN = "rivalfitness.example";
const FRESH_EMAIL = "dana@example.com";
const FRESH_CLERK = "user_dana_fresh";
const HARBOR_DOMAIN = "harborpointfitness.example";

let rivalSiteId: any;

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
    const rivalSite = await ctx.db.insert("sites", {
      name: "Rival Fitness Co",
      slug: "rival-fitness-co",
      status: "active",
      domain: RIVAL_DOMAIN,
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: RIVAL_CLERK,
      name: "Rival Owner",
      email: RIVAL_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: rivalSite, role: "owner" }],
    });
    rivalSiteId = rivalSite;
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  rivalSiteId = undefined;
  await seed();
  expect(rivalSiteId).toBeTruthy();
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  // Default fetch stub: every URL → 404. Tests that need the Harbor Point
  // fixture site re-stub fetch BEFORE the provisioning call so the §4
  // auto-fired crawl sees it.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
});

afterEach(async () => {
  // §4 wiring determinism: provisionSite schedules a fire-and-forget crawl
  // on a real setTimeout — drain it against a terminal 404 stub (explicit
  // §14 failure, never a hang, never the real network).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const asFresh = () => t.withIdentity({ subject: FRESH_CLERK, email: FRESH_EMAIL });
const asRival = () => t.withIdentity({ subject: RIVAL_CLERK, email: RIVAL_EMAIL });

// ── Harbor Point fixture site (plain HTML, no TAYA build code) ──────────────

const HARBOR_NAV = `<nav><a href="/">Home</a> <a href="/about">About</a> <a href="/services">Services</a> <a href="/team">Our Team</a> <a href="/faq">Questions</a> <a href="/blog">Journal</a> <a href="/pricing">Pricing</a></nav>`;

const HARBOR_HOME = `<!doctype html>
<html><head>
<title>Harbor Point Fitness — Strength for everyone</title>
<meta name="description" content="Strength coaching in Harbor Point.">
</head><body>
${HARBOR_NAV}
<h1>Harbor Point Fitness</h1>
<p>We coach strength, conditioning, and mobility for every body in Harbor Point.</p>
<a class="btn" href="/contact">Book a free intro</a>
<section>
  <h2>Our Services</h2>
  <ul>
    <li><h3>One-on-One Coaching</h3><p>Personal programming, reviewed weekly.</p></li>
    <li><h3>Small Group Training</h3><p>Six people, one coach, real progress.</p></li>
  </ul>
</section>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

const HARBOR_ABOUT = `<!doctype html>
<html><head><title>About — Harbor Point Fitness</title></head><body>
${HARBOR_NAV}
<h1>About Harbor Point</h1>
<p>A neighborhood gym that trains neighbors, opened in 2019.</p>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

const HARBOR_SERVICES = `<!doctype html>
<html><head><title>Services — Harbor Point Fitness</title></head><body>
${HARBOR_NAV}
<h1>Our Services</h1>
<p>Every membership starts with a movement screen.</p>
<section>
  <h2>Coaching Options</h2>
  <ul>
    <li><h3>Personal Coaching</h3><p>One coach, one plan, weekly reviews.</p></li>
    <li><h3>Small Group</h3><p>Capped at six athletes per session.</p></li>
  </ul>
</section>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

const HARBOR_TEAM = `<!doctype html>
<html><head><title>Team — Harbor Point Fitness</title></head><body>
${HARBOR_NAV}
<h1>Our Team</h1>
<p>Coaches who train with you, not at you.</p>
<section>
  <h2>The Coaches</h2>
  <ul>
    <li><h3>Dana Whitfield</h3><p>Head coach, CSCS, twelve years coaching.</p></li>
    <li><h3>Marco Reyes</h3><p>Conditioning lead, former college athlete.</p></li>
  </ul>
</section>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

const HARBOR_FAQ = `<!doctype html>
<html><head><title>FAQ — Harbor Point Fitness</title></head><body>
${HARBOR_NAV}
<h1>Frequently Asked Questions</h1>
<p>Honest answers — no contracts, no hard sell.</p>
<section>
  <h2>Common Questions</h2>
  <ul>
    <li><h3>Do I need experience?</h3><p>No — every plan starts where you are.</p></li>
  </ul>
</section>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

const HARBOR_BLOG = `<!doctype html>
<html><head><title>Journal — Harbor Point Fitness</title></head><body>
${HARBOR_NAV}
<h1>Journal</h1>
<p>Notes from the gym floor.</p>
<footer>© 2025 Harbor Point Fitness.</footer>
</body></html>`;

/** Stub fetch to serve the Harbor Point fixture site (read-only GETs). */
function stubHarborFetch() {
  const pages: Record<string, string> = {
    [`https://${HARBOR_DOMAIN}`]: HARBOR_HOME,
    [`https://${HARBOR_DOMAIN}/about`]: HARBOR_ABOUT,
    [`https://${HARBOR_DOMAIN}/services`]: HARBOR_SERVICES,
    [`https://${HARBOR_DOMAIN}/team`]: HARBOR_TEAM,
    [`https://${HARBOR_DOMAIN}/faq`]: HARBOR_FAQ,
    [`https://${HARBOR_DOMAIN}/blog`]: HARBOR_BLOG,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input);
      const body = pages[url];
      if (body !== undefined) {
        return new Response(body, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      // /pricing and /sitemap.xml (and anything else) → explicit §14 404.
      return new Response(null, { status: 404 });
    }),
  );
}

/** Provision Harbor Point via the real §1 self-service path and drain the
 *  §4 auto-fired crawl so conform has landed. Returns the site id. */
async function provisionHarbor(): Promise<any> {
  stubHarborFetch();
  const provisioned = await asFresh().mutation(
    api.selfServiceOnboarding.provisionSite,
    {
      name: "Dana Whitfield",
      company: "Harbor Point Fitness",
      websiteUrl: `https://www.${HARBOR_DOMAIN}`,
      websiteType: "business_website",
    },
  );
  expect(provisioned.outcome).toBe("created");
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  return provisioned.siteId;
}

// ── §4 route → module table (generic data, no per-customer logic) ───────────

describe("§4 route → module table — generic, data-driven", () => {
  it("ROUTE_MODULE_TABLE is the exact locked 12-row table", () => {
    expect(
      ROUTE_MODULE_TABLE.map((r) => [r.path, r.module, r.label]),
    ).toEqual([
      ["/services", "services", "Services"],
      ["/courses", "courses", "Courses"],
      ["/events", "events", "Events"],
      ["/products", "products", "Products"],
      ["/team", "team", "Team"],
      ["/faq", "faq", "FAQ"],
      ["/blog", "articles", "Blog"],
      ["/articles", "articles", "Articles"],
      ["/resources", "articles", "Resources"],
      ["/testimonials", "testimonials", "Testimonials"],
      ["/careers", "careers", "Careers"],
      ["/downloads", "downloads", "Downloads"],
    ]);
  });

  it("moduleForRoute: exact + sub-route matches, prefix-string safety, unknown → null", () => {
    // Exact matches for every table row.
    for (const row of ROUTE_MODULE_TABLE) {
      expect(moduleForRoute(row.path)).toBe(row.module);
    }
    // Sub-routes hit their parent module.
    const subRoutes: Array<[string, string | null]> = [
      ["/courses/basic-pistol", "courses"],
      ["/products/precision-kit", "products"],
      ["/team/jane-doe", "team"],
      ["/faq/returns", "faq"],
      ["/blog/2024/welcome", "articles"],
      ["/articles/how-to", "articles"],
      ["/resources/library", "articles"],
      ["/testimonials/marines", "testimonials"],
      ["/careers/openings", "careers"],
      ["/downloads/manuals", "downloads"],
      ["/events/open-house", "events"],
      ["/services/tuning", "services"],
    ];
    for (const [path, expected] of subRoutes) {
      expect(moduleForRoute(path)).toBe(expected);
    }
    // Prefix-string safety: "/servicesx" is NOT a /services sub-route.
    const notRoutes = [
      "/servicesx",
      "/bloggers",
      "/teamwork",
      "/eventsx",
      "/productsheet",
    ];
    for (const path of notRoutes) {
      expect(moduleForRoute(path)).toBeNull();
    }
    // Home and unknown routes map to nothing — they are fine, they simply
    // appear as pages in the navigator (§4).
    const unknown = ["/", "/pricing", "/about", "/training/classes", "/gallery", ""];
    for (const path of unknown) {
      expect(moduleForRoute(path)).toBeNull();
    }
  });

  it("every route-table module is conformable; CONFORMABLE is the locked 15-key set", () => {
    expect([...CONFORMABLE_MODULES].sort()).toEqual([
      "articles", "careers", "contact", "courses", "downloads", "events",
      "faq", "footer", "homepage", "media", "products", "seo", "services",
      "team", "testimonials",
    ]);
    for (const row of ROUTE_MODULE_TABLE) {
      expect(CONFORMABLE_MODULES).toContain(row.module);
    }
  });
});

// ── §7 conformable universe — admin/system modules can never be derived ─────

describe("§7 conformable universe — a crawl can never expose admin/system modules", () => {
  // The admin/system half of the dashboard module universe: a crawl of a
  // CLIENT'S WEBSITE must never derive any of these.
  // NOTE (Phase 6 adaptive dashboard): the RBAC DASHBOARD_MODULES universe
  // gained 8 additive keys (services, products, reviews, flyers, portal,
  // automation, site_users, payment_providers). services/products are
  // CONFORMABLE (they exist on real client sites). The remaining six are
  // dashboard-only surfaces (review management, flyer manager, portal
  // admin, automation engine, site-user admin, payment connector config) —
  // they are admin/system by definition and joined this half of the
  // partition. No behavior change: CONFORMABLE_MODULES is untouched.
  const ADMIN_SYSTEM = [
    "dashboard", "forms", "inbox", "navigation", "announcement", "cta",
    "popup", "policy", "payments", "commerce", "email", "crm", "health",
    "history", "activity", "backups", "help",
    // Phase 6 additive keys — dashboard-only surfaces:
    "reviews", "flyers", "portal", "automation", "site_users", "payment_providers",
  ];

  it("CONFORMABLE excludes every admin/system dashboard module", () => {
    for (const admin of ADMIN_SYSTEM) {
      expect(CONFORMABLE_MODULES).not.toContain(admin);
    }
  });

  it("every dashboard module partitions cleanly: client-facing OR admin/system", () => {
    // The complete invariant: each of the 38 DASHBOARD_MODULES keys is
    // either a conform-eligible client-facing module or an admin/system
    // module — nothing ambiguous, nothing missing.
    for (const dm of DASHBOARD_MODULES) {
      const conformable = (CONFORMABLE_MODULES as readonly string[]).includes(dm);
      const admin = ADMIN_SYSTEM.includes(dm);
      expect(conformable || admin).toBe(true);
      expect(conformable && admin).toBe(false);
    }
    // The two module universes: since Phase 6 folded services and products
    // into the RBAC DASHBOARD_MODULES list (they were previously outside
    // it, living only in the enabledModules universe), every CONFORMABLE
    // key is now inside the RBAC list — the outside set is empty.
    const outside = CONFORMABLE_MODULES.filter(
      (k) => !(DASHBOARD_MODULES as readonly string[]).includes(k),
    );
    expect(outside.sort()).toEqual([]);
  });

  it("no customer names anywhere in the route table or conformable set", () => {
    const haystack = JSON.stringify({
      routes: ROUTE_MODULE_TABLE,
      conformable: CONFORMABLE_MODULES,
    }).toLowerCase();
    expect(haystack).not.toContain("fsts");
    expect(haystack).not.toContain("corsair");
  });
});

// ── conformWorkspace — §7 plan derivation (pure) ────────────────────────────

/** A synthetic completed snapshot for a generic services/team/faq/blog site. */
function synthSnapshot(): DiscoverySnapshot {
  const routes = [
    { path: "/", source: "nav" as const, label: "Home" },
    { path: "/about", source: "nav" as const, label: "About" },
    { path: "/services", source: "nav" as const, label: "Our Services" },
    { path: "/team", source: "nav" as const, label: "Our Team" },
    { path: "/faq", source: "nav" as const, label: "Questions" },
    { path: "/blog", source: "nav" as const, label: "Journal" },
    { path: "/pricing", source: "footer" as const, label: "Pricing" },
  ];
  const page = (path: string, title: string) => ({
    path,
    url: `https://${HARBOR_DOMAIN}${path === "/" ? "" : path}`,
    status: "fetched" as const,
    httpStatus: 200,
    bytes: 1000,
    model: { meta: { title } } as any,
    error: null,
  });
  return {
    domain: HARBOR_DOMAIN,
    origin: `https://${HARBOR_DOMAIN}`,
    crawlStartedAt: 1,
    crawlCompletedAt: 2,
    platform: null,
    contentMap: {
      "home.hero.heading": { type: "text", value: "Harbor Point Fitness", evidence: "h1" },
      "home.services.items[0].title": { type: "text", value: "One-on-One Coaching", evidence: "li h3" },
      "about.intro.body": { type: "text", value: "A gym for everyone.", evidence: "p" },
      "services.intro.heading": { type: "text", value: "Our Services", evidence: "h1" },
      "team.intro.heading": { type: "text", value: "Our Team", evidence: "h1" },
      "faq.intro.heading": { type: "text", value: "Questions", evidence: "h1" },
    },
    keyCount: 6,
    pages: [
      page("/", "Harbor Point Fitness"),
      page("/about", "About — Harbor Point Fitness"),
      page("/services", "Services — Harbor Point Fitness"),
      page("/team", "Team — Harbor Point Fitness"),
      page("/faq", "FAQ — Harbor Point Fitness"),
    ],
    routes,
    siteMeta: {} as any,
  };
}

describe("conformWorkspace — §7 plan derivation (pure)", () => {
  it("derives the enable-only module patch from discovered routes", () => {
    const plan = conformWorkspace(synthSnapshot());
    // /services /team /faq /blog enable their modules; "/", /about and
    // /pricing derive nothing. Every patch value is true — enable-only.
    expect(plan.enabledModulesPatch).toEqual({
      services: true,
      team: true,
      faq: true,
      articles: true,
    });
    expect(plan.enabledModuleKeys).toEqual(["services", "team", "faq", "articles"]);
    expect(Object.values(plan.enabledModulesPatch).every((v) => v === true)).toBe(true);
  });

  it("navEntries: MODULE_NAV_MAP labels first, then crawl labels for non-standard routes, deduped by href", () => {
    const plan = conformWorkspace(synthSnapshot());
    // articles is a MODULE_NAV_MAP module → the STANDARD label ("Blog") and
    // href win even though the crawl called the route "Journal"; /blog is
    // then deduped when the ROUTE_MODULE_TABLE row is reached. Non-standard
    // conformable routes keep the CRAWL'S OWN labels ("Our Services",
    // "Our Team", "Questions"). /about and /pricing produce no nav rows.
    expect(plan.navEntries).toEqual([
      { label: "Blog", href: "/blog", moduleKey: "articles" },
      { label: "Our Services", href: "/services", moduleKey: "services" },
      { label: "Our Team", href: "/team", moduleKey: "team" },
      { label: "Questions", href: "/faq", moduleKey: "faq" },
    ]);
    const hrefs = plan.navEntries.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length); // deduped by href
    expect(hrefs).not.toContain("/");
    expect(hrefs).not.toContain("/about");
    expect(hrefs).not.toContain("/pricing");
  });

  it("pages: home first then lexicographic, labels from nav, per-page keyCount attribution", () => {
    const plan = conformWorkspace(synthSnapshot());
    expect(plan.pages.map((p) => p.path)).toEqual([
      "/", "/about", "/faq", "/services", "/team",
    ]);
    // Label chain: nav label first ("/faq" → "Questions"), home is "Home".
    expect(plan.pages.map((p) => p.label)).toEqual([
      "Home", "About", "Questions", "Our Services", "Our Team",
    ]);
    // Longest-segment attribution: home.hero.heading AND
    // home.services.items[0].title both belong to "/" (2 keys); each
    // sub-page owns its own intro key (1 each).
    expect(plan.pages.map((p) => p.keyCount)).toEqual([2, 1, 1, 1, 1]);
  });

  it("deterministic + idempotent: the same snapshot yields an identical plan", () => {
    const a = conformWorkspace(synthSnapshot());
    const b = conformWorkspace(synthSnapshot());
    expect(a).toEqual(b);
  });

  it("a snapshot with no conformable routes enables nothing and adds no nav", () => {
    const snap = synthSnapshot();
    snap.routes = [
      { path: "/", source: "nav" as const, label: "Home" },
      { path: "/about", source: "nav" as const, label: "About" },
      { path: "/pricing", source: "nav" as const, label: "Pricing" },
    ];
    const plan = conformWorkspace(snap);
    expect(plan.enabledModulesPatch).toEqual({});
    expect(plan.enabledModuleKeys).toEqual([]);
    expect(plan.navEntries).toEqual([]);
  });
});

// ── mergeEnabledModules — enable-only, allowlisted, never-disables ──────────

describe("mergeEnabledModules — enable-only, allowlisted, never-disables", () => {
  it("enables only allowlisted keys; unknown and admin patch keys are dropped", () => {
    const merged = mergeEnabledModules(
      { homepage: true, courses: false },
      { courses: true, team: true, payments: true, bogus_module: true },
    );
    expect(merged).toEqual({ homepage: true, courses: true, team: true });
    // §7: a conform patch can never smuggle in an admin module or invent a
    // module key outside CONFORMABLE_MODULES.
    expect(merged).not.toHaveProperty("payments");
    expect(merged).not.toHaveProperty("bogus_module");
  });

  it("never disables: existing true survives a patch that lacks or falsifies it", () => {
    // conformWorkspace never emits false, but the merge is defense-in-depth:
    // only value === true is processed.
    expect(mergeEnabledModules({ courses: true, faq: false }, { courses: false, faq: true })).toEqual({
      courses: true,
      faq: true,
    });
    expect(mergeEnabledModules({ courses: true }, {})).toEqual({ courses: true });
    expect(mergeEnabledModules({ courses: true }, { events: true })).toEqual({
      courses: true,
      events: true,
    });
  });

  it("null/undefined current starts from empty", () => {
    expect(mergeEnabledModules(null, { team: true })).toEqual({ team: true });
    expect(mergeEnabledModules(undefined, {})).toEqual({});
  });

  it("idempotent: merging the same patch twice changes nothing", () => {
    const patch = { services: true, team: true, courses: true };
    const once = mergeEnabledModules({}, patch);
    const twice = mergeEnabledModules(once, patch);
    expect(twice).toEqual(once);
  });
});

// ── §7 end-to-end: provision → auto-crawl → conform applied atomically ──────

describe("§7 auto-conform end-to-end (provision → auto-crawl → applied)", () => {
  it("conform enables route-derived modules, inserts nav rows, and maps content — without touching a single role", async () => {
    const siteId = await provisionHarbor();

    let site: any;
    let mapRow: any;
    let navRows: any;
    let dana: any;
    let rival: any;
    let userCount: number;
    let conformActivity: any;
    await t.run(async (ctx) => {
      site = await ctx.db.get(siteId);
      const maps = await ctx.db
        .query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      expect(maps).toHaveLength(1);
      mapRow = maps[0];
      navRows = await ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      const users = await ctx.db.query("users").collect();
      userCount = users.length;
      dana = users.find((u: any) => u.clerkUserId === FRESH_CLERK);
      rival = users.find((u: any) => u.clerkUserId === RIVAL_CLERK);
      const activities = await ctx.db
        .query("activityLog")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      conformActivity = activities.find((a: any) => a.action === "workspace_auto_conformed");
    });

    // §6: the external crawl identified the publishing mode.
    expect(site.connectionMode).toBe("DISCOVERED_EXTERNAL");

    // §7 module patch — enable-only, on top of the business_website
    // defaults (courses/events seeded OFF):
    //   /services /team /faq /blog discovered → services, team, faq enabled
    //   (articles was already on by default).
    const em: Record<string, boolean> = site.enabledModules ?? {};
    expect(em.services).toBe(true);
    expect(em.team).toBe(true);
    expect(em.faq).toBe(true);
    expect(em.articles).toBe(true);
    expect(em.homepage).toBe(true);
    // Enable-only + no /courses or /events route → the OFF defaults stand.
    expect(em.courses).toBe(false);
    expect(em.events).toBe(false);
    // Conform never touches unrelated defaults (payments/email/crm/reviews
    // were seeded by provisioning, not by the crawl).
    expect(em.payments).toBe(true);
    expect(em.email).toBe(true);
    expect(em.crm).toBe(true);
    expect(em.reviews).toBe(true);
    // No module was invented for undiscovered routes.
    expect(em).not.toHaveProperty("downloads");
    expect(em).not.toHaveProperty("careers");
    expect(em).not.toHaveProperty("testimonials");
    expect(em).not.toHaveProperty("commerce");

    // §7 nav: provisioning seeded Home/About/Contact/Blog/Media (articles +
    // media are on by default for business_website); conform added the
    // three non-standard conformable routes with the CRAWL'S labels.
    const byHref: Record<string, any> = Object.fromEntries(
      navRows.map((n: any) => [n.href, n]),
    );
    expect(Object.keys(byHref).sort()).toEqual([
      "/", "/about", "/blog", "/contact", "/faq", "/media", "/services", "/team",
    ]);
    expect(byHref["/services"].label).toBe("Services");
    expect(byHref["/team"].label).toBe("Our Team");
    expect(byHref["/faq"].label).toBe("Questions");
    expect(byHref["/blog"].label).toBe("Blog"); // standard label wins

    // §5 durable content map: conformed, typed, evidenced.
    expect(mapRow.conformed).toBe(true);
    expect(mapRow.keyCount).toBe(Object.keys(mapRow.entries).length);
    expect(mapRow.keyCount).toBeGreaterThan(10);
    const hero = mapRow.entries["home.hero.heading"];
    expect(hero.type).toBe("text");
    expect(hero.discovered).toBe("Harbor Point Fitness");
    expect(hero.evidence).toBeTruthy();
    expect(hero.draft).toBeUndefined();
    expect(hero.published).toBeUndefined();
    expect(mapRow.entries["services.intro.heading"]?.discovered).toBe("Our Services");
    expect(mapRow.pages[0].path).toBe("/");
    const servicesPage = mapRow.pages.find((p: any) => p.path === "/services");
    expect(servicesPage.keyCount).toBeGreaterThan(0);

    // §7 NO RBAC GRANTS: Dana keeps exactly the ONE owner role provisioning
    // bound; the crawl granted nothing to anyone; no user rows appeared.
    expect(dana.roles).toEqual([{ siteId, role: "owner" }]);
    expect(rival.roles).toEqual([{ siteId: rivalSiteId, role: "owner" }]);
    expect(userCount).toBe(3); // superadmin + rival owner + Dana — no creations

    // §14 evidence: the conform step is logged by the discovery actor.
    expect(conformActivity).toBeTruthy();
    expect(conformActivity.actorName).toBe("TAYA Discovery");
    expect(conformActivity.details).toContain("content keys mapped");
  });

  it("idempotent: a refresh crawl adds no duplicate nav, flips no module, upserts the single content-map row", async () => {
    const siteId = await provisionHarbor();

    let before: any;
    await t.run(async (ctx) => {
      const site = await ctx.db.get(siteId);
      const nav = await ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      const maps = await ctx.db
        .query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      before = {
        enabledModules: site.enabledModules,
        navHrefs: nav.map((n: any) => n.href).sort(),
        mapCount: maps.length,
        keyCount: maps[0].keyCount,
        conformed: maps[0].conformed,
      };
    });

    // Owner-triggered refresh crawl of the SAME site (inline run).
    const refreshed = await asFresh().action(api.discovery.triggerDiscovery, { siteId });
    expect(refreshed.status).toBe("completed");

    let after: any;
    let snapshotRows: any;
    await t.run(async (ctx) => {
      const site = await ctx.db.get(siteId);
      const nav = await ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      const maps = await ctx.db
        .query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      snapshotRows = await ctx.db
        .query("discoverySnapshots")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      after = {
        enabledModules: site.enabledModules,
        navHrefs: nav.map((n: any) => n.href).sort(),
        mapCount: maps.length,
        keyCount: maps[0].keyCount,
        conformed: maps[0].conformed,
      };
    });

    // The second conform changed NOTHING structural: same modules (courses
    // still OFF), same nav set (no duplicate rows), one upserted map row
    // with the same deterministic key count.
    expect(after.enabledModules).toEqual(before.enabledModules);
    expect(after.navHrefs).toEqual(before.navHrefs);
    expect(new Set(after.navHrefs).size).toBe(after.navHrefs.length);
    expect(after.mapCount).toBe(1);
    expect(after.keyCount).toBe(before.keyCount);
    expect(after.conformed).toBe(true);

    // §16 history: initial + refresh snapshots are both retained.
    expect(snapshotRows).toHaveLength(2);
    expect(snapshotRows.filter((s: any) => s.kind === "initial")).toHaveLength(1);
    expect(snapshotRows.filter((s: any) => s.kind === "refresh")).toHaveLength(1);
  });

  it("§22 isolation holds after conform: no cross-tenant reads, no role grants, anonymous null", async () => {
    const siteId = await provisionHarbor();

    // The conformed map is site-scoped: the rival tenant sees null on every
    // surface, the owner sees the conformed map, anonymous sees null.
    expect(await asRival().query(api.contentMap.get, { siteId })).toBeNull();
    expect(await asRival().query(api.discovery.getReport, { siteId })).toBeNull();
    const ownerView: any = await asFresh().query(api.contentMap.get, { siteId });
    expect(ownerView).toBeTruthy();
    expect(ownerView.conformed).toBe(true);
    expect(await t.query(api.contentMap.get, { siteId })).toBeNull();

    // The rival tenant's own site is untouched by Harbor Point's conform.
    let rivalSite: any;
    let rivalRoles: any;
    await t.run(async (ctx) => {
      rivalSite = await ctx.db.get(rivalSiteId);
      const rivalUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", RIVAL_CLERK))
        .first();
      rivalRoles = rivalUser.roles;
      const rivalMaps = await ctx.db
        .query("siteContentMaps")
        .withIndex("by_site", (q: any) => q.eq("siteId", rivalSiteId))
        .collect();
      expect(rivalMaps).toHaveLength(0);
    });
    expect(rivalSite.enabledModules).toEqual({});
    expect(rivalRoles).toEqual([{ siteId: rivalSiteId, role: "owner" }]);
  });
});
