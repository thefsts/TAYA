/**
 * PHASE 6 — AUTO-CONFORM SITE PROFILES + ONBOARDING ADAPTATION (Chat C).
 * @vitest-environment edge-runtime
 *
 * Pins the full Chat C contract end to end:
 *
 *   §1  Connection flow: provisionSite → auto-fired discovery crawl →
 *       site-specific workspace — NO second manual provisioning step.
 *   §2  Business/site-type inference: reusable feature-driven inference +
 *       terminology, no rigid hardcoded industry apps.
 *   §3  Persisted capability profile on siteContentMaps.siteProfile,
 *       exposed read-only (siteProfiles.getProfile / getRecommendations).
 *   §4  External-site editability classification — never claims unsupported
 *       editability (READ_ONLY for third-party-hosted assets, UNSUPPORTED
 *       for platform-owned flows).
 *   §5  MATAYA recommendation surface: suggest-only — never grants a
 *       permission, enables a module, or alters tenant state.
 *   §6  Idempotency + safety: no duplicate sites, manual overrides are
 *       preserved across re-crawls, no cross-tenant leakage.
 *   §7  Fixtures: five DIFFERENT business types → five DIFFERENT capability
 *       outputs (the anti-rigid-industry-hardcode pin).
 *
 * All fixtures are plain HTML (no TAYA build code) served through a stubbed
 * fetch — the crawl parses what any real website would serve.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import {
  EDITABILITY_LEVELS,
  SITE_TYPE_CANDIDATES,
} from "../../../convex/lib/discovery/siteProfile";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ———————————————————— Test identities ————————————————————————

const FRESH_EMAIL = "prospect@example.com";
const FRESH_CLERK = "user_prospect_p6";
const RIVAL_EMAIL = "rival-p6@example.com";
const RIVAL_CLERK = "user_rival_p6";
const RIVAL_DOMAIN = "rivaltech-p6.example";
const SECOND_EMAIL = "secondclient@example.com";
const SECOND_CLERK = "user_secondclient_p6";
const TRAVEL_CLERK = "user_travel_p6";
const TRAVEL_EMAIL = "travel@example.com";
const SUPERADMIN_CLERK = "user_superadmin_p6";
const SUPERADMIN_EMAIL = "superadmin@unknown.local";

let t: ReturnType<typeof convexTest>;

async function seed() {
  await t.run(async (ctx) => {
    // A rival tenant's site: cross-tenant isolation scenarios read/attack it.
    const rivalSite = await ctx.db.insert("sites", {
      name: "Rival Tech Co",
      slug: "rival-tech-co",
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
    // A platform superadmin: the identity sites.update / users.addSiteRole
    // require for owner-level module decisions and multi-site clients.
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Platform Superadmin",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  await seed();
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
  // Default fetch stub: every URL → 404 (explicit §14 failure, never a hang).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
});

afterEach(async () => {
  // §1 wiring determinism: provisionSite schedules the crawl on a real
  // setTimeout — drain it against a terminal 404 stub.
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
const asSecond = () =>
  t.withIdentity({ subject: SECOND_CLERK, email: SECOND_EMAIL });
const asSuperadmin = () =>
  t.withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL });

// ————— Fetch-stub helpers (plain HTML fixture sites) ————————————

/** Serve a map of absolute URL → HTML body; everything else → 404. */
function stubSite(pages: Record<string, string>) {
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
      return new Response(null, { status: 404 });
    }),
  );
}

/** Provision a fixture site via the REAL §1 self-service path and drain the
 *  auto-fired crawl so the profile + conform plan have landed. */
async function provisionFixture(
  company: string,
  domain: string,
  websiteType: string,
  pages: Record<string, string>,
  clerk: string,
  email: string,
): Promise<any> {
  stubSite(pages);
  const caller = t.withIdentity({ subject: clerk, email });
  const provisioned = await caller.mutation(
    api.selfServiceOnboarding.provisionSite,
    {
      name: "Client Owner",
      company,
      websiteUrl: `https://www.${domain}`,
      websiteType,
    },
  );
  expect(provisioned.outcome).toBe("created");
  await new Promise((r) => setTimeout(r, 0));
  await t.finishInProgressScheduledFunctions();
  return provisioned.siteId;
}

// ————— FIXTURE 1 — TRAINING ACADEMY ————————————————————
// courses route, enroll/certification vocabulary, priced course cards, a
// youtube hero video, a syllabus PDF download.

const ACADEMY_DOMAIN = "peakskillsacademy.example";

const ACADEMY_NAV = `<nav><a href="/">Home</a> <a href="/courses">Courses</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav>`;

const ACADEMY_HOME = `<!doctype html>
<html><head>
<title>Peak Skills Academy — professional training</title>
<meta name="description" content="Career training and certification programs.">
</head><body>
${ACADEMY_NAV}
<h1>Peak Skills Academy</h1>
<p>Hands-on professional training programs that take your career further, with certification on completion.</p>
<a class="btn" href="/courses">Enroll Now</a>
<section>
  <h2>Our Courses</h2>
  <ul>
    <li><h3>Intro to Data Analysis</h3><p>Four evenings, real datasets, certification included.</p><a href="/docs/syllabus-intro.pdf">Syllabus (PDF)</a></li>
    <li><h3>Advanced SQL for Analysts</h3><p>Two-day intensive with lab exercises and certification.</p></li>
    <li><h3>Python for Automation</h3><p>Six weeks of guided projects with weekly reviews.</p></li>
  </ul>
</section>
<section>
  <h2>Watch a sample lesson</h2>
  <iframe src="https://www.youtube.com/embed/samplelesson" title="Sample lesson"></iframe>
</section>
<footer>© 2025 Peak Skills Academy.</footer>
</body></html>`;

const ACADEMY_COURSES = `<!doctype html>
<html><head><title>Courses — Peak Skills Academy</title></head><body>
${ACADEMY_NAV}
<h1>Course Catalog</h1>
<p>Every program includes certification and curriculum materials.</p>
<section>
  <h2>Current Programs</h2>
  <ul>
    <li><h3>Data Analysis Certificate</h3><p>Ten weeks, $1,200.00, enroll online.</p></li>
    <li><h3>SQL Intensive</h3><p>Two days, $450.00, small cohorts.</p></li>
    <li><h3>Automation with Python</h3><p>Six weeks, $890.00, guided projects.</p></li>
  </ul>
</section>
<footer>© 2025 Peak Skills Academy.</footer>
</body></html>`;

const ACADEMY_PAGES: Record<string, string> = {
  [`https://${ACADEMY_DOMAIN}`]: ACADEMY_HOME,
  [`https://${ACADEMY_DOMAIN}/courses`]: ACADEMY_COURSES,
};

// ————— FIXTURE 2 — ECOMMERCE STORE ———————————————————
// shop + products routes, add-to-cart vocabulary, priced product cards.
// (Platform-locked /cart + /checkout never enter snapshot.routes — the
// JUNK route filter excludes them — so §4 UNSUPPORTED is pinned via a
// synthetic snapshot below.)

const SHOP_DOMAIN = "gearforge.example";

const SHOP_NAV = `<nav><a href="/">Home</a> <a href="/shop">Shop</a> <a href="/products">Products</a> <a href="/about">About</a></nav>`;

const SHOP_HOME = `<!doctype html>
<html><head>
<title>GearForge — precision tools shop</title>
<meta name="description" content="Precision tools for makers.">
</head><body>
${SHOP_NAV}
<h1>GearForge Tools</h1>
<p>Precision-machined tools for serious makers. Free shipping on orders over $75.</p>
<a class="btn" href="/shop">Shop Now</a>
<section>
  <h2>Featured Products</h2>
  <ul>
    <li><h3>Bench Vise Pro</h3><p>$189.00 — cast iron, lifetime warranty.</p></li>
    <li><h3>Machinist Square Set</h3><p>$64.00 — hardened steel squares.</p></li>
    <li><h3>Layout Knife</h3><p>$28.00 — replaceable blades.</p></li>
    <li><h3>Edge Finder Pair</h3><p>$42.00 — 0.200 inch tips.</p></li>
  </ul>
</section>
<footer>© 2025 GearForge.</footer>
</body></html>`;

const SHOP_PRODUCTS = `<!doctype html>
<html><head><title>Products — GearForge</title></head><body>
${SHOP_NAV}
<h1>All Products</h1>
<p>Our online store ships worldwide. Add to cart to see pricing in your currency.</p>
<section>
  <h2>Tool Catalog</h2>
  <ul>
    <li><h3>Bench Vise Pro</h3><p>$189.00 — add to cart.</p></li>
    <li><h3>Machinist Square Set</h3><p>$64.00 — add to cart.</p></li>
    <li><h3>Layout Knife</h3><p>$28.00 — add to cart.</p></li>
    <li><h3>Edge Finder Pair</h3><p>$42.00 — add to cart.</p></li>
  </ul>
</section>
<footer>© 2025 GearForge.</footer>
</body></html>`;

const SHOP_PAGES: Record<string, string> = {
  [`https://${SHOP_DOMAIN}`]: SHOP_HOME,
  [`https://${SHOP_DOMAIN}/products`]: SHOP_PRODUCTS,
};

// ————— FIXTURE 3 — TRAVEL OPERATOR ————————————————————
// tours routes, itinerary vocabulary, priced tour cards, a vimeo video and
// an itinerary PDF download (keeps the §7 module-set distinct from the
// bistro's, which has neither).

const TRAVEL_DOMAIN = "cobaltroutes.example";

const TRAVEL_NAV = `<nav><a href="/">Home</a> <a href="/tours">Tours</a> <a href="/destinations">Destinations</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav>`;

const TRAVEL_HOME = `<!doctype html>
<html><head>
<title>Cobalt Routes — guided tours</title>
<meta name="description" content="Guided tours and travel packages.">
</head><body>
${TRAVEL_NAV}
<h1>Cobalt Routes</h1>
<p>Small-group guided tours and travel packages to the coast and the mountains, led by local guides.</p>
<a class="btn" href="/tours">Explore Our Tours</a>
<section>
  <h2>Our Tours</h2>
  <ul>
    <li><h3>Coastal Day Tour</h3><p>Book a tour of the shoreline villages — $95.00 per traveler.</p></li>
    <li><h3>Mountain Multi-Day Trek</h3><p>A multi-day itinerary with hut stays — $640.00.</p></li>
    <li><h3>Wine Country Excursion</h3><p>Vineyard visits and tastings — $130.00.</p></li>
  </ul>
</section>
<section>
  <h2>Trip videos</h2>
  <iframe src="https://player.vimeo.com/video/12345" title="Coastal tour film"></iframe>
  <p>Print the full itinerary PDF before you depart: <a href="/docs/coastal-itinerary.pdf">Tour itinerary (PDF)</a></p>
</section>
<footer>© 2025 Cobalt Routes.</footer>
</body></html>`;

const TRAVEL_TOURS = `<!doctype html>
<html><head><title>Tours — Cobalt Routes</title></head><body>
${TRAVEL_NAV}
<h1>Tours &amp; Itineraries</h1>
<p>Every trip is a fully planned itinerary with local guides.</p>
<section>
  <h2>Trip List</h2>
  <ul>
    <li><h3>Coastal Day Tour</h3><p>$95.00 — shoreline villages, lunch included.</p></li>
    <li><h3>Mountain Multi-Day Trek</h3><p>$640.00 — hut stays, gear shuttle.</p></li>
    <li><h3>Wine Country Excursion</h3><p>$130.00 — three vineyards, tastings.</p></li>
  </ul>
</section>
<footer>© 2025 Cobalt Routes.</footer>
</body></html>`;

const TRAVEL_PAGES: Record<string, string> = {
  [`https://${TRAVEL_DOMAIN}`]: TRAVEL_HOME,
  [`https://${TRAVEL_DOMAIN}/tours`]: TRAVEL_TOURS,
};

// ————— FIXTURE 4 — SERVICE BUSINESS (DENTAL PRACTICE) ————————————
// services + team routes, quote/consultation vocabulary, contact form,
// FAQ items.

const DENTAL_DOMAIN = "acmeperioperio.example";

const DENTAL_NAV = `<nav><a href="/">Home</a> <a href="/services">Services</a> <a href="/team">Team</a> <a href="/faq">FAQ</a> <a href="/contact">Contact</a></nav>`;

const DENTAL_HOME = `<!doctype html>
<html><head>
<title>Acme Perio — periodontal care</title>
<meta name="description" content="Periodontal care and dental implants.">
</head><body>
${DENTAL_NAV}
<h1>Acme Perio</h1>
<p>Gentle periodontal care and dental implants in a calm office. New patients welcome.</p>
<a class="btn" href="/contact">Book a free consultation</a>
<section>
  <h2>Our Services</h2>
  <ul>
    <li><h3>Periodontal Therapy</h3><p>Deep cleaning and maintenance for gum health.</p></li>
    <li><h3>Dental Implants</h3><p>Single and full-arch implant restorations.</p></li>
    <li><h3>Second Opinions</h3><p>Get a quote on any existing treatment plan.</p></li>
  </ul>
</section>
<footer>© 2025 Acme Perio.</footer>
</body></html>`;

const DENTAL_CONTACT = `<!doctype html>
<html><head><title>Contact — Acme Perio</title></head><body>
${DENTAL_NAV}
<h1>Contact Us</h1>
<p>Request a quote or a free estimate for your treatment plan.</p>
<form action="/contact" method="post">
  <input name="name" type="text" placeholder="Your name">
  <input name="email" type="email" placeholder="Your email">
  <textarea name="message" placeholder="How can we help?"></textarea>
  <button type="submit">Send request</button>
</form>
<footer>© 2025 Acme Perio.</footer>
</body></html>`;

const DENTAL_TEAM = `<!doctype html>
<html><head><title>Team — Acme Perio</title></head><body>
${DENTAL_NAV}
<h1>Our Team</h1>
<p>Our staff includes two periodontists and three hygienists.</p>
<footer>© 2025 Acme Perio.</footer>
</body></html>`;

const DENTAL_FAQ = `<!doctype html>
<html><head><title>FAQ — Acme Perio</title></head><body>
${DENTAL_NAV}
<h1>Frequently Asked Questions</h1>
<p>Honest answers about treatment and insurance.</p>
<section>
  <h2>Common Questions</h2>
  <ul>
    <li><h3>Do you take insurance?</h3><p>We work with most major PPO plans.</p></li>
    <li><h3>Is the consultation free?</h3><p>Yes — new-patient exams are free.</p></li>
  </ul>
</section>
<footer>© 2025 Acme Perio.</footer>
</body></html>`;

const DENTAL_PAGES: Record<string, string> = {
  [`https://${DENTAL_DOMAIN}`]: DENTAL_HOME,
  [`https://${DENTAL_DOMAIN}/contact`]: DENTAL_CONTACT,
  [`https://${DENTAL_DOMAIN}/team`]: DENTAL_TEAM,
  [`https://${DENTAL_DOMAIN}/faq`]: DENTAL_FAQ,
};

// ————— FIXTURE 5 — RESTAURANT ———————————————————————
// menu route, menu/reservation vocabulary, priced menu cards, a booking
// CTA ("Book a Table" — matches the §2 booking action vocabulary).

const BISTRO_DOMAIN = "petitebistro.example";

const BISTRO_NAV = `<nav><a href="/">Home</a> <a href="/menu">Menu</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav>`;

const BISTRO_HOME = `<!doctype html>
<html><head>
<title>Petite Bistro — neighborhood dining</title>
<meta name="description" content="A neighborhood bistro with a seasonal menu.">
</head><body>
${BISTRO_NAV}
<h1>Petite Bistro</h1>
<p>A seasonal dinner menu from a small kitchen, and a wine list that leans local.</p>
<a class="btn" href="/contact">Book a Table</a>
<section>
  <h2>Our Menu</h2>
  <ul>
    <li><h3>Seared Scallops</h3><p>$24.00 — with brown butter and lemon.</p></li>
    <li><h3>Bistro Steak Frites</h3><p>$29.00 — grass-fed, hand-cut fries.</p></li>
    <li><h3>Seasonal Tart</h3><p>$11.00 — fruit from the market.</p></li>
  </ul>
</section>
<footer>© 2025 Petite Bistro.</footer>
</body></html>`;

const BISTRO_MENU = `<!doctype html>
<html><head><title>Menu — Petite Bistro</title></head><body>
${BISTRO_NAV}
<h1>Full Menu</h1>
<p>Our menu changes with the seasons; reservations are recommended.</p>
<section>
  <h2>Dinner Menu</h2>
  <ul>
    <li><h3>Seared Scallops</h3><p>$24.00 — brown butter, lemon.</p></li>
    <li><h3>Bistro Steak Frites</h3><p>$29.00 — grass-fed strip, fries.</p></li>
    <li><h3>Seasonal Tart</h3><p>$11.00 — market fruit.</p></li>
  </ul>
</section>
<footer>© 2025 Petite Bistro.</footer>
</body></html>`;

const BISTRO_PAGES: Record<string, string> = {
  [`https://${BISTRO_DOMAIN}`]: BISTRO_HOME,
  [`https://${BISTRO_DOMAIN}/menu`]: BISTRO_MENU,
};

// ————— Shared assertion helpers ————————————————————

async function readProfile(siteId: any): Promise<any> {
  return await t.run(async (ctx) => {
    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();
    return (map as any)?.siteProfile ?? null;
  });
}

/** Read the site row (enabledModules, moduleOverrides, connectionMode…). */
async function readSite(siteId: any): Promise<any> {
  return await t.run(async (ctx) => ctx.db.get(siteId));
}

/** Count content-map rows for a site (idempotency: single row, upserted). */
async function readMapCount(siteId: any): Promise<number> {
  return await t.run(async (ctx) => {
    const maps = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();
    return maps.length;
  });
}

// ————————————————————————————————————————————————————————
// §7 FIXTURE PINS — five different business types → five different
// capability outputs (the anti-rigid-industry-hardcode pin)
// ————————————————————————————————————————————————————————

describe("§7 five fixtures — different sites, different capability outputs", () => {
  it("training academy → training_academy type, courses module, video + download evidence", async () => {
    const siteId = await provisionFixture(
      "Peak Skills Academy",
      ACADEMY_DOMAIN,
      "business_website",
      ACADEMY_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const profile = await readProfile(siteId);
    expect(profile).toBeTruthy();
    expect(profile.siteType.type).toBe("training_academy");
    // Courses route discovered → courses module auto-enabled (§1/§7).
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("courses");
    // Terminology prefers the discovered nav label "Courses".
    expect(profile.terminology.primaryNoun).toBe("Courses");
    expect(profile.terminology.primaryAction).toBe("Enroll Now");
    // Video + download evidence carried into signals (§1 media + downloads).
    expect(profile.signals.videoCount).toBeGreaterThan(0);
    expect(profile.signals.downloadCount).toBeGreaterThan(0);
    // Editability: third-party video is READ_ONLY (§4 never claims hosting).
    const videoArea = profile.editability.areas.find(
      (a: any) => a.classification === "READ_ONLY" && /^videos\[\*\]/.test(a.area),
    );
    expect(videoArea).toBeTruthy();
    const downloadArea = profile.editability.areas.find(
      (a: any) => a.classification === "READ_ONLY" && /^downloads\[\*\]/.test(a.area),
    );
    expect(downloadArea).toBeTruthy();
  });

  it("ecommerce store → ecommerce type, products module, price signals", async () => {
    const siteId = await provisionFixture(
      "GearForge Tools",
      SHOP_DOMAIN,
      "business_website",
      SHOP_PAGES,
      SECOND_CLERK,
      SECOND_EMAIL,
    );
    const profile = await readProfile(siteId);
    expect(profile).toBeTruthy();
    expect(profile.siteType.type).toBe("ecommerce");
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("products");
    expect(profile.signals.priceKeyCount).toBeGreaterThanOrEqual(4);
    // The priced catalog suggests pricing + forms capabilities (§5).
    const suggestedIds = profile.capabilities.suggested.map((c: any) => c.capabilityId);
    expect(suggestedIds).toContain("manage_pricing");
    // Shop vocabulary discovered.
    expect(profile.siteType.evidence.join(" ")).toContain("Product catalog");
  });

  it("travel operator → travel type, tours evidence, services-module items", async () => {
    const siteId = await provisionFixture(
      "Cobalt Routes",
      TRAVEL_DOMAIN,
      "business_website",
      TRAVEL_PAGES,
      TRAVEL_CLERK,
      TRAVEL_EMAIL,
    );
    const profile = await readProfile(siteId);
    expect(profile).toBeTruthy();
    expect(profile.siteType.type).toBe("travel");
    // Tours are repeatable items managed through the services module
    // (FEATURE_MODULES maps tours → services) — NOT a rigid "travel app".
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("services");
    expect(profile.terminology.primaryNoun).toBe("Tours");
    // Travel vocabulary discovered.
    expect(profile.siteType.evidence.join(" ")).toContain("Travel signals");
    // Videos are READ_ONLY; priced tours are NOT ecommerce (price is
    // secondary evidence — §2 reusable features, no rigid industry apps).
    expect(profile.signals.priceKeyCount).toBeGreaterThanOrEqual(3);
    expect(profile.siteType.type).not.toBe("ecommerce");
  });

  it("service business (dental) → lead_generation type, form + inbox suggestions", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const profile = await readProfile(siteId);
    expect(profile).toBeTruthy();
    expect(profile.siteType.type).toBe("lead_generation");
    // Contact form + quote vocabulary → forms + inbox SUGGESTED (§5:
    // never auto-granted — approval required).
    const suggestedIds = profile.capabilities.suggested.map((c: any) => c.capabilityId);
    expect(suggestedIds).toContain("manage_forms");
    expect(suggestedIds).toContain("view_inbox");
    // Services route → services module auto-enabled.
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("services");
    expect(profile.terminology.primaryNoun).toBe("Services");
    // Team + FAQ routes → team + faq modules.
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("team");
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("faq");
  });

  it("restaurant → restaurant type, menu evidence — prices do NOT flip it to ecommerce", async () => {
    const siteId = await provisionFixture(
      "Petite Bistro",
      BISTRO_DOMAIN,
      "business_website",
      BISTRO_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const profile = await readProfile(siteId);
    expect(profile).toBeTruthy();
    expect(profile.siteType.type).toBe("restaurant");
    // Priced menu cards are repeatable content, NOT a storefront.
    expect(profile.siteType.type).not.toBe("ecommerce");
    expect(profile.signals.priceKeyCount).toBeGreaterThanOrEqual(3);
    // Menu items managed through the services module.
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("services");
    expect(profile.terminology.primaryNoun).toBe("Menu");
    // "Book a Table" CTA → booking feature → manage_forms suggestion.
    const suggestedIds = profile.capabilities.suggested.map((c: any) => c.capabilityId);
    expect(suggestedIds).toContain("manage_forms");
  });

  it("the five fixtures produce five DIFFERENT (type, moduleKey-set) pairs", async () => {
    const rows: Array<{ type: string; mods: string[] }> = [];
    // Provision all five in sequence — one DISTINCT tenant each (a user who
    // already has a site role is reused, not re-provisioned, so each spec
    // needs its own identity).
    const specs = [
      ["Peak Skills Academy", ACADEMY_DOMAIN, ACADEMY_PAGES, "user_p6_academy", "academy@example.com"],
      ["GearForge Tools", SHOP_DOMAIN, SHOP_PAGES, "user_p6_shop", "shop@example.com"],
      ["Cobalt Routes", TRAVEL_DOMAIN, TRAVEL_PAGES, "user_p6_travel", "travel2@example.com"],
      ["Acme Perio", DENTAL_DOMAIN, DENTAL_PAGES, "user_p6_dental", "dental@example.com"],
      ["Petite Bistro", BISTRO_DOMAIN, BISTRO_PAGES, "user_p6_bistro", "bistro@example.com"],
    ] as Array<[string, string, Record<string, string>, string, string]>;
    for (const [company, domain, pages, clerk, email] of specs) {
      const siteId = await provisionFixture(
        company,
        domain,
        "business_website",
        pages,
        clerk,
        email,
      );
      const profile = await readProfile(siteId);
      rows.push({
        type: profile.siteType.type,
        mods: profile.capabilities.autoEnabled
          .map((c: any) => c.moduleKey)
          .sort(),
      });
    }
    // Five distinct site types (the strongest anti-rigid pin).
    expect(new Set(rows.map((r) => r.type)).size).toBe(5);
    // AND five distinct module sets — the workspace adapts per site.
    const modSets = rows.map((r) => r.mods.join(","));
    expect(new Set(modSets).size).toBe(5);
  });
});

// ————————————————————————————————————————————————————————
// §1 ONBOARDING FLOW — provision → crawl → workspace, no second manual step
// ————————————————————————————————————————————————————————

describe("§1 connection flow — auto-built workspace from discovery", () => {
  it("provision → auto-crawl → conformed workspace + profile in ONE flow (no manual step 2)", async () => {
    const siteId = await provisionFixture(
      "Peak Skills Academy",
      ACADEMY_DOMAIN,
      "business_website",
      ACADEMY_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );

    // The workspace exists immediately: site + owner role + module UI.
    const site = await readSite(siteId);
    expect(site.connectionMode).toBe("DISCOVERED_EXTERNAL");
    expect(site.enabledModules.courses).toBe(true);
    expect(site.inferredWebsiteType).toBe("training_academy");
    expect(site.inferredSiteTypeConfidence).toBeGreaterThan(0);

    // The content map + profile landed in the SAME flow.
    const profile = await readProfile(siteId);
    expect(profile.version).toBe(1);
    expect(profile.siteType.type).toBe("training_academy");

    // Nav rows for newly-enabled conformable modules were inserted (§7
    // auto-conform — MODULE_NAV_MAP carries /courses).
    const nav = await t.run(async (ctx) =>
      ctx.db
        .query("navigationItems")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect(),
    );
    expect(nav.length).toBeGreaterThan(0);
    expect(nav.map((n: any) => n.href)).toContain("/courses");

    // And certify observes the profile: capability_profile_built passes.
    const cert = await asFresh().action(api.selfServiceOnboarding.certify, {
      siteId,
    });
    const profileCheck = cert.checks.find(
      (c: any) => c.check === "capability_profile_built",
    );
    expect(profileCheck.status).toBe("pass");
    expect(profileCheck.reason).toContain("training_academy");
  });

  it("existing site re-provision (same owner) → reused, not duplicated (§6)", async () => {
    stubSite(ACADEMY_PAGES);
    const first = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Peak Skills Academy",
        websiteUrl: `https://www.${ACADEMY_DOMAIN}`,
        websiteType: "business_website",
      },
    );
    expect(first.outcome).toBe("created");
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();

    // Same owner + same domain (www and non-www are the same bare domain)
    // → REUSED (idempotent, no duplicate site).
    const second = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Peak Skills Academy",
        websiteUrl: `https://${ACADEMY_DOMAIN}`,
        websiteType: "business_website",
      },
    );
    expect(second.outcome).toBe("reused");
    expect(String(second.siteId)).toBe(String(first.siteId));

    // Exactly ONE site row + ONE content map for the domain.
    const counts = await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      const maps = await ctx.db.query("siteContentMaps").collect();
      return {
        sites: sites.filter((s: any) => s.domain === ACADEMY_DOMAIN).length,
        maps: maps.filter((m: any) => m.domain === ACADEMY_DOMAIN).length,
      };
    });
    expect(counts.sites).toBe(1);
    expect(counts.maps).toBe(1);
  });
});

// ————————————————————————————————————————————————————————
// §4 EXTERNAL EDITABILITY — never claims unsupported editability
// ————————————————————————————————————————————————————————

describe("§4 external-site editability classification", () => {
  it("external site: text REPLACE_CONTENT, items REORDER, videos/downloads READ_ONLY, pages ADD_CONTENT", async () => {
    const siteId = await provisionFixture(
      "Peak Skills Academy",
      ACADEMY_DOMAIN,
      "business_website",
      ACADEMY_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const profile = await readProfile(siteId);
    const byClass = (level: string) =>
      profile.editability.areas.filter((a: any) => a.classification === level);

    // Text bands → REPLACE_CONTENT (draft now, publish after verification).
    expect(byClass("REPLACE_CONTENT").length).toBeGreaterThan(0);
    // Repeatable course items → REORDER.
    expect(byClass("REORDER").length).toBeGreaterThan(0);
    // Pages → ADD_CONTENT (drafting is native).
    expect(byClass("ADD_CONTENT").length).toBeGreaterThan(0);
    // Third-party videos + PDF downloads → READ_ONLY.
    expect(byClass("READ_ONLY").length).toBe(2);
    // External unverified site → NO FULL_EDIT areas claimed.
    expect(byClass("FULL_EDIT").length).toBe(0);
    // Summary counts add up.
    const total = Object.values(profile.editability.summary).reduce(
      (a: any, b: any) => a + b,
      0,
    );
    expect(total).toBe(profile.editability.areas.length);
  });

  it("TAYA_NATIVE site: mapped content is FULL_EDIT — no external constraints", async () => {
    // TAYA_NATIVE classification needs a snapshot to classify — build one
    // synthetically through the pure library (TAYA_NATIVE sites are not
    // crawled; classifyEditability is the shared pure fn).
    const { classifyEditability } = await import(
      "../../../convex/lib/discovery/siteProfile"
    );
    const snapshot = {
      domain: "localcraft.example",
      origin: "https://localcraft.example",
      crawlStartedAt: 1,
      crawlCompletedAt: 2,
      platform: null,
      contentMap: {
        "home.hero.heading": { type: "text", value: "Local Craft", evidence: "x" },
        "home.services.items[0].title": { type: "text", value: "Classes", evidence: "x" },
        "home.services.items[1].title": { type: "text", value: "Events", evidence: "x" },
        "home.videos[0].src": { type: "video", value: "https://youtu.be/x", evidence: "x" },
      },
      keyCount: 4,
      pages: [
        { path: "/", status: "fetched", url: "https://localcraft.example", httpStatus: 200, bytes: 100, model: null, error: null },
      ],
      routes: [],
      siteMeta: { title: "Local Craft", description: null, ogImage: null },
    } as any;
    const classification = classifyEditability(snapshot, "TAYA_NATIVE");
    const byClass = (level: string) =>
      classification.areas.filter((a: any) => a.classification === level);
    expect(byClass("FULL_EDIT").length).toBeGreaterThan(0);
    expect(byClass("REPLACE_CONTENT").length).toBe(0);
    expect(byClass("READ_ONLY").length).toBe(1); // video still READ_ONLY
  });

  it("platform-owned routes are UNSUPPORTED — never claim checkout/account editability", async () => {
    const { classifyEditability } = await import(
      "../../../convex/lib/discovery/siteProfile"
    );
    const snapshot = {
      domain: "shop.example",
      origin: "https://shop.example",
      crawlStartedAt: 1,
      crawlCompletedAt: 2,
      platform: "shopify",
      contentMap: {
        "home.hero.heading": { type: "text", value: "Shop", evidence: "x" },
      },
      keyCount: 1,
      pages: [{ path: "/", status: "fetched", url: "https://shop.example", httpStatus: 200, bytes: 100, model: null, error: null }],
      routes: [
        { path: "/cart", source: "nav", label: "Cart" },
        { path: "/checkout", source: "nav", label: "Checkout" },
        { path: "/my-account", source: "nav", label: "Account" },
      ],
      siteMeta: { title: null, description: null, ogImage: null },
    } as any;
    const classification = classifyEditability(snapshot, "DISCOVERED_EXTERNAL");
    const unsupported = classification.areas.filter(
      (a: any) => a.classification === "UNSUPPORTED",
    );
    expect(unsupported.length).toBe(3);
    // Areas appear in snapshot.routes order (the classification is
    // deterministic, not sorted).
    expect(unsupported.map((a: any) => a.area)).toEqual([
      "route:/cart",
      "route:/checkout",
      "route:/my-account",
    ]);
    expect(unsupported.every((a: any) => /owned by the external platform/.test(a.note))).toBe(true);
  });
});

// ————————————————————————————————————————————————————————
// §5 MATAYA RECOMMENDATION SURFACE — suggest-only, never grants
// ————————————————————————————————————————————————————————

describe("§5 MATAYA recommendation surface — suggest-only", () => {
  it("getRecommendations returns suggestions; NOTHING is granted/enabled/mutated", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const siteBefore = await readSite(siteId);
    const recommendations = await asFresh().query(
      api.siteProfiles.getRecommendations,
      { siteId },
    );
    expect(recommendations).toBeTruthy();
    expect(recommendations.suggested.length).toBeGreaterThan(0);
    const ids = recommendations.suggested.map((c: any) => c.capabilityId);
    expect(ids).toContain("manage_forms");
    expect(ids).toContain("view_inbox");

    // SUGGEST-ONLY: the owner's role set and module state are byte-identical
    // after the read.
    const siteAfter = await readSite(siteId);
    expect(siteAfter.enabledModules).toEqual(siteBefore.enabledModules);
    expect(siteAfter.moduleOverrides ?? {}).toEqual(siteBefore.moduleOverrides ?? {});
    const user = await t.run(async (ctx) => {
      const u = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", FRESH_CLERK))
        .first();
      return u;
    });
    expect(user.roles.length).toBe(1);
    expect(user.roles[0].role).toBe("owner");
    expect(user.roles[0].siteId).toBe(siteId);
  });

  it("getRecommendations suggests only capabilities the site does NOT have; modules already on are not re-suggested", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const site = await readSite(siteId);
    const recs = await asFresh().query(api.siteProfiles.getRecommendations, {
      siteId,
    });
    // modules auto-enabled by conform are listed under autoEnabled (they ARE
    // on — transparency), and every suggested capability is approval-required.
    expect(recs.autoEnabled.length).toBeGreaterThan(0);
    expect(recs.autoEnabled.every((c: any) => c.moduleKey !== null)).toBe(true);
    expect(recs.suggested.every((c: any) => c.moduleKey === null)).toBe(true);
    expect(site.enabledModules.services).toBe(true);
  });

  it("recommendations degrade honestly: no crawl → null, never fabricated (§14)", async () => {
    stubSite({}); // nothing serves — crawl fails
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Ghost Site Co",
        websiteUrl: "https://ghostsite-p6.example",
        websiteType: "business_website",
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    const recs = await asFresh().query(api.siteProfiles.getRecommendations, {
      siteId: provisioned.siteId,
    });
    expect(recs).toBeNull();
    const profileQuery = await asFresh().query(api.siteProfiles.getProfile, {
      siteId: provisioned.siteId,
    });
    expect(profileQuery).toBeNull();
  });
});

// ————————————————————————————————————————————————————————
// §6 IDEMPOTENCY + OVERRIDE PRESERVATION
// ————————————————————————————————————————————————————————

describe("§6 idempotency + manual override preservation", () => {
  it("re-crawling the same site changes nothing the second time (idempotent)", async () => {
    const siteId = await provisionFixture(
      "Peak Skills Academy",
      ACADEMY_DOMAIN,
      "business_website",
      ACADEMY_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const readState = async () => {
      const site = await readSite(siteId);
      const profile = await readProfile(siteId);
      const nav = await t.run(async (ctx) =>
        ctx.db
          .query("navigationItems")
          .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
          .collect(),
      );
      const snaps = await t.run(async (ctx) =>
        ctx.db
          .query("discoverySnapshots")
          .withIndex("by_site_startedAt", (q: any) => q.eq("siteId", siteId))
          .collect(),
      );
      const mapCount = await readMapCount(siteId);
      return {
        enabledModules: (site as any).enabledModules,
        // generatedAt is the crawl-completed timestamp — strip it for the
        // equality comparison; everything else must be identical.
        profile:
          profile === null
            ? null
            : { ...profile, generatedAt: undefined },
        navCount: nav.length,
        mapCount,
        snapCount: snaps.length,
      };
    };
    const before = await readState();
    // Re-run discovery via the REAL user-triggered path.
    await asFresh().action(api.discovery.triggerDiscovery, { siteId });
    const after = await readState();
    expect(after.enabledModules).toEqual(before.enabledModules);
    expect(after.profile).toEqual(before.profile);
    expect(after.navCount).toBe(before.navCount);
    expect(after.mapCount).toBe(before.mapCount);
    // The snapshot history grows (refresh kind) but nothing else moves.
    expect(after.snapCount).toBe(before.snapCount + 1);
  });

  it("owner disables a module → re-crawl never re-enables it (override preserved)", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    // Owner decision (recorded via the superadmin-gated sites.update):
    // turn OFF the faq module.
    await asSuperadmin().mutation(api.sites.update, {
      siteId,
      enabledModules: { faq: false },
    });
    let site = await readSite(siteId);
    expect(site.enabledModules.faq).toBe(false);
    expect((site.moduleOverrides ?? {}).faq).toBe(false);

    // Re-crawl: the faq route is still there, but the override wins — the
    // MODULE MERGE (not the profile's recommendation evidence) is what
    // honors overrides, and enabledModules is the hard guarantee.
    await asFresh().action(api.discovery.triggerDiscovery, { siteId });
    site = await readSite(siteId);
    expect(site.enabledModules.faq).toBe(false);
    expect((site.moduleOverrides ?? {}).faq).toBe(false);

    // The profile's autoEnabled list describes CRAWL EVIDENCE (faq route
    // still exists), so it still lists the faq capability — transparency
    // about what the crawl found, NOT a re-enable. The workspace module
    // state (pinned above) is the enforced surface.
    const profile = await readProfile(siteId);
    expect(profile.capabilities.autoEnabled.map((c: any) => c.moduleKey)).toContain("faq");
  });

  it("a different owner decision (module ON) is also honored — overrides work both ways", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    // careers is OFF in the business_website defaults and has NO route in
    // the fixture — an explicit owner enable must survive the re-crawl.
    await asSuperadmin().mutation(api.sites.update, {
      siteId,
      enabledModules: { careers: true },
    });
    let site = await readSite(siteId);
    expect(site.enabledModules.careers).toBe(true);
    expect((site.moduleOverrides ?? {}).careers).toBe(true);

    // Re-crawl: careers route absent — the override keeps it on anyway
    // (owner decision outranks crawl absence: never disable valid caps).
    await asFresh().action(api.discovery.triggerDiscovery, { siteId });
    site = await readSite(siteId);
    expect(site.enabledModules.careers).toBe(true);
    expect((site.moduleOverrides ?? {}).careers).toBe(true);
  });
});

// ————————————————————————————————————————————————————————
// §16 CROSS-TENANT ISOLATION
// ————————————————————————————————————————————————————————

describe("§16 cross-tenant isolation", () => {
  it("rival owner cannot read another tenant's profile or recommendations", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    const rivalProfile = await asRival().query(api.siteProfiles.getProfile, {
      siteId,
    });
    expect(rivalProfile).toBeNull();
    const rivalRecs = await asRival().query(
      api.siteProfiles.getRecommendations,
      { siteId },
    );
    expect(rivalRecs).toBeNull();
  });

  it("rival owner cannot trigger discovery on another tenant's site", async () => {
    const siteId = await provisionFixture(
      "Acme Perio",
      DENTAL_DOMAIN,
      "business_website",
      DENTAL_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );
    await expect(
      asRival().action(api.discovery.triggerDiscovery, { siteId }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ————————————————————————————————————————————————————————
// §14 FAILURE + EDGE STATES — explicit, never fabricated
// ————————————————————————————————————————————————————————

describe("§14 failure + edge states", () => {
  it("failed discovery → no profile, explicit failureReason, certify pending (not pass)", async () => {
    // Everything 404s (the default fetch stub): homepage unfetchable.
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Ghost Site Co",
        websiteUrl: "https://ghostsite-p6.example",
        websiteType: "business_website",
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    const profile = await readProfile(provisioned.siteId);
    expect(profile).toBeNull();
    const latest = await asFresh().query(api.discovery.getLatestSnapshot, {
      siteId: provisioned.siteId,
    });
    expect(latest.status).toBe("failed");
    expect(latest.failureReason).toContain("Could not fetch");
    const cert = await asFresh().action(api.selfServiceOnboarding.certify, {
      siteId: provisioned.siteId,
    });
    const byCheck = Object.fromEntries(
      cert.checks.map((c: any) => [c.check, c.status]),
    );
    expect(byCheck.capability_profile_built).toBe("pending");
    expect(byCheck.page_discovery_completed).toBe("fail");
  });

  it("zero-page discovery (homepage fetches, nothing else) → profile with business_website fallback", async () => {
    stubSite({ [`https://zeropage-p6.example`]: ZEROPAGE_HOME });
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Zero Page Co",
        websiteUrl: "https://www.zeropage-p6.example",
        websiteType: "business_website",
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    const profile = await readProfile(provisioned.siteId);
    // §14: a near-empty page yields the honest fallback, never fabrication.
    expect(profile.siteType.type).toBe("business_website");
    expect(profile.siteType.confidence).toBeLessThan(1);
    expect(profile.siteType.evidence.length).toBe(1);
    expect(profile.siteType.evidence[0]).toContain("No strong business-type signals");
    // Terminology falls back to derived-from-features wording.
    expect(profile.terminology.primaryNoun).toBe("Content");
    expect(profile.terminology.primaryAction).toBeNull();
    expect(profile.editability.areas.length).toBeGreaterThan(0);
  });

  it("partial discovery (some routes 404) → snapshot completed, healthy, honest", async () => {
    // Serve ONLY home + /services; /team + /faq + /contact pages 404. The
    // routes themselves were still DISCOVERED (nav evidence) — the crawl
    // honestly records both the found services content and the missing
    // pages without failing the snapshot.
    const pages: Record<string, string> = {
      [`https://${DENTAL_DOMAIN}`]: DENTAL_HOME,
      [`https://${DENTAL_DOMAIN}/services`]: DENTAL_HOME.replace(
        "Acme Perio",
        "Acme Perio Services",
      ),
    };
    stubSite(pages);
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Acme Perio",
        websiteUrl: `https://www.${DENTAL_DOMAIN}`,
        websiteType: "business_website",
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    const latest = await asFresh().query(api.discovery.getLatestSnapshot, {
      siteId: provisioned.siteId,
    });
    expect(latest.status).toBe("completed");
    const profile = await readProfile(provisioned.siteId);
    expect(profile).toBeTruthy();
    // Services route fetched → services module enabled; the team/faq routes
    // were discovered (nav) so their capability evidence stays — but their
    // PAGES carry no content keys (honest about what was actually read).
    const mods = profile.capabilities.autoEnabled.map((c: any) => c.moduleKey);
    expect(mods).toContain("services");
    expect(profile.signals.pageCount).toBe(2); // home + /services fetched
  });

  it("unsupported site (no crawlable structure) → no modules auto-enabled, profile honest", async () => {
    stubSite({ [`https://unsupported-p6.example`]: UNSUPPORTED_HOME });
    const provisioned = await asFresh().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        name: "Client Owner",
        company: "Unsupported Co",
        websiteUrl: "https://www.unsupported-p6.example",
        websiteType: "business_website",
      },
    );
    expect(provisioned.outcome).toBe("created");
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    const site = await readSite(provisioned.siteId);
    expect(site.inferredWebsiteType).toBe("business_website");
    const profile = await readProfile(provisioned.siteId);
    expect(profile.capabilities.autoEnabled.length).toBe(0);
    expect(profile.capabilities.suggested.length).toBe(1); // configure_seo only
    expect(profile.terminology.primaryNoun).toBe("Content");
  });

  it("multiple-site client: two sites under one agency owner → separate workspaces, no cross-contamination", async () => {
    // A real multi-site client: the first site is self-service provisioned
    // by the client; the second is created by the platform (superadmin
    // sites.create fires the same auto-discovery) and the client owner is
    // attached via the real users.addSiteRole path.
    const firstId = await provisionFixture(
      "Peak Skills Academy",
      ACADEMY_DOMAIN,
      "business_website",
      ACADEMY_PAGES,
      FRESH_CLERK,
      FRESH_EMAIL,
    );

    // Second site for the SAME client owner, via the real platform path.
    // sites.create requires slug, returns the full site response (id, not
    // siteId), and does NOT www-strip the domain — discovery crawls
    // https://<domain> verbatim, so the bare domain is stored.
    stubSite(SHOP_PAGES);
    const second = await asSuperadmin().mutation(api.sites.create, {
      name: "GearForge Tools",
      slug: "gearforge-tools-p6",
      domain: SHOP_DOMAIN,
      websiteType: "business_website",
    });
    await new Promise((r) => setTimeout(r, 0));
    await t.finishInProgressScheduledFunctions();
    // Attach the client owner to the second workspace (real role grant).
    const freshUser = await t.run(async (ctx) => {
      const u = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", FRESH_CLERK))
        .first();
      return u;
    });
    await asSuperadmin().mutation(api.users.addSiteRole, {
      userId: freshUser._id,
      siteId: second.id,
      role: "owner",
    });

    // The owner can now read BOTH profiles — each with its own site type
    // and module state; nothing bleeds across the two workspaces.
    const p1 = await asFresh().query(api.siteProfiles.getProfile, {
      siteId: firstId,
    });
    const p2 = await asFresh().query(api.siteProfiles.getProfile, {
      siteId: second.id,
    });
    expect(p1.siteType.type).toBe("training_academy");
    expect(p2.siteType.type).toBe("ecommerce");
    expect(p2.siteType.type).not.toBe(p1.siteType.type);
    // No cross-contamination of module state.
    const s1 = await readSite(firstId);
    const s2 = await readSite(second.id);
    expect(s1.enabledModules.products).not.toBe(true);
    expect(s2.enabledModules.courses).not.toBe(true);
  });
});

const ZEROPAGE_HOME = `<!doctype html>
<html><head><title>Zero Page Co</title></head><body>
<p>A single paragraph with no headings, no nav, no structure.</p>
</body></html>`;

const UNSUPPORTED_HOME = `<!doctype html>
<html><head><title>Unsupported Co</title></head><body>
<object data="legacy.swf"></object>
<h1>Click to enter</h1>
<marquee>Welcome</marquee>
</body></html>`;
