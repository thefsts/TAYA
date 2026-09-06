/**
 * PHASE 1 — CLIENT SELF-SERVICE ONBOARDING (spec §1–§3, §13, §14).
 * @vitest-environment edge-runtime
 *
 * Pins the one-transaction onboarding contract:
 *
 *   §1  Client authenticates (Clerk subject, read server-side) → confirms
 *       profile (name/company/URL) → ONE canonical site + ONE canonical user
 *       + owner role bound + validated → lands in own workspace. No manual
 *       second step, no client-supplied email anywhere in the identity path.
 *   §3  Idempotency: re-run creates NO duplicate users/sites/roles — reuse
 *       instead. A domain/slug that collides with another tenant's site is a
 *       safe-stop error (admin warning), never a silent rewrite.
 *   §13 zero-site status → canSelfProvision true → the UI setup route.
 *   §22 cross-tenant isolation holds after self-provisioning.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Fixtures ──────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;

/** Canonical-style fixtures: two tenants + a superadmin, all correctly bound. */
const FSTS_EMAIL = "fstsclient@example.com";
const FSTS_CLERK = "user_fsts_selfservice";
const CORSAIR_EMAIL = "corsair@example.com";
const CORSAIR_CLERK = "user_corsair_selfservice";
const SUPERADMIN_CLERK = "user_superadmin_selfservice";
const SUPERADMIN_EMAIL = "owner@fstacktsolutions.com";
const NEW_CLIENT_EMAIL = "newclient@example.com";
const NEW_CLIENT_CLERK = "user_newclient_selfservice";

async function seed() {
  await t.run(async (ctx) => {
    // superadmin (env-allowlisted so provisionUser derives it correctly)
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK,
      name: "Platform Owner",
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    // existing tenant: Corsair, with its site + bound owner
    const corsairSite = await ctx.db.insert("sites", {
      name: "Corsair Tactical Solutions",
      slug: "corsair-tactical-solutions",
      status: "active",
      domain: "corsairtacticalsolutions.com",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: CORSAIR_CLERK,
      name: "Corsair Owner",
      email: CORSAIR_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: corsairSite, role: "owner" }],
    });
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  await seed();
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", "");
  vi.stubEnv("INTERNAL_QA_EMAILS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const asNewClient = () =>
  t.withIdentity({
    subject: NEW_CLIENT_CLERK,
    email: NEW_CLIENT_EMAIL,
    name: "New Client",
  });
const asSuperadmin = () =>
  t.withIdentity({ subject: SUPERADMIN_CLERK, email: SUPERADMIN_EMAIL });
const asCorsair = () =>
  t.withIdentity({ subject: CORSAIR_CLERK, email: CORSAIR_EMAIL });

const VALID_ARGS = {
  name: "Jordan Smith",
  company: "Acme Dental Studio",
  websiteUrl: "https://www.acmedental.com",
  websiteType: "business_website",
};

// ── §1: one transaction, no manual second step ─────────────────────────────

describe("selfServiceOnboarding.provisionSite — one-transaction onboarding (§1)", () => {
  it("creates ONE site + binds owner role in a single mutation", async () => {
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );

    expect(result.outcome).toBe("created");
    expect(result.slug).toBe("acmedental-com");
    expect(result.domain).toBe("acmedental.com");
    expect(result.nextStep).toBe("workspace");

    // ONE canonical user for the subject, carrying exactly ONE owner role.
    let user: any, siteCount = 0, userCount = 0;
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      userCount = users.length;
      user = users.find((u: any) => u.clerkUserId === NEW_CLIENT_CLERK);
      const sites = await ctx.db.query("sites").collect();
      siteCount = sites.length;
    });
    expect(userCount).toBe(3); // superadmin + corsair + new client — no duplicates
    expect(user).toBeTruthy();
    expect(user.name).toBe("Jordan Smith"); // confirmed name synced
    expect(user.roles).toHaveLength(1);
    expect(String(user.roles[0].siteId)).toBe(String(result.siteId));
    expect(user.roles[0].role).toBe("owner");
    expect(siteCount).toBe(2); // corsair + the new site — no duplicates
  });

  it("seeds the full content footprint (same tables as sites.create)", async () => {
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    await t.run(async (ctx) => {
      const tables = [
        "crmConnections",
        "homepageContent",
        "footerContent",
        "contactInfo",
        "seoSettings",
        "navigationItems",
      ] as const;
      for (const table of tables) {
        const rows = await (ctx.db as any).query(table).collect();
        const mine = rows.filter((r: any) => String(r.siteId) === String(result.siteId));
        expect(mine.length, `${table} seeded`).toBeGreaterThan(0);
      }
      // nav: business_website → home/about/contact seeded, courses/events off
      const nav = (await (ctx.db as any).query("navigationItems").collect())
        .filter((r: any) => String(r.siteId) === String(result.siteId))
        .map((r: any) => r.label);
      expect(nav).toContain("Home");
      expect(nav).toContain("About");
      expect(nav).toContain("Contact");
      expect(nav).not.toContain("Courses");
      expect(nav).not.toContain("Events");
    });
  });

  it("lands the client in their own workspace (site list = exactly their site)", async () => {
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    const sites = await asNewClient().query(api.sites.listWithHealth);
    expect(sites).toHaveLength(1);
    expect(String(sites[0]._id)).toBe(String(result.siteId));
  });

  it("derives the slug from the domain (www + protocol + path stripped)", async () => {
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        ...VALID_ARGS,
        websiteUrl: "https://www.BlueYonder-Labs.io/pricing?utm=1",
      },
    );
    expect(result.domain).toBe("blueyonder-labs.io");
    expect(result.slug).toBe("blueyonder-labs-io");
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(
      t.mutation(api.selfServiceOnboarding.provisionSite, VALID_ARGS),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("rejects a superadmin (admin tools exist for that)", async () => {
    await expect(
      asSuperadmin().mutation(api.selfServiceOnboarding.provisionSite, VALID_ARGS),
    ).rejects.toThrow(/SuperAdmin/);
  });

  it("validates required fields (name/company/URL)", async () => {
    await expect(
      asNewClient().mutation(api.selfServiceOnboarding.provisionSite, {
        ...VALID_ARGS,
        name: "   ",
      }),
    ).rejects.toThrow(/name is required/i);
    await expect(
      asNewClient().mutation(api.selfServiceOnboarding.provisionSite, {
        ...VALID_ARGS,
        company: "   ",
      }),
    ).rejects.toThrow(/company or business name is required/i);
    await expect(
      asNewClient().mutation(api.selfServiceOnboarding.provisionSite, {
        ...VALID_ARGS,
        websiteUrl: "not-a-url",
      }),
    ).rejects.toThrow(/website address/i);
  });
});

// ── §3: idempotency — re-run reuses, never duplicates ───────────────────────

describe("selfServiceOnboarding.provisionSite — idempotency (§3)", () => {
  it("re-running the same onboarding returns the SAME site, no duplicates", async () => {
    const first = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    const second = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      {
        ...VALID_ARGS,
        // different answers on re-run still reuse — onboarding already ran
        company: "Acme Dental Studio LLC",
        websiteUrl: "https://acmedental.com/about",
      },
    );

    expect(second.outcome).toBe("reused");
    expect(String(second.siteId)).toBe(String(first.siteId));
    expect(second.slug).toBe(first.slug);

    await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      expect(sites.filter((s: any) => s.domain?.includes("acmedental")).length).toBe(1);
      const users = await ctx.db.query("users").collect();
      expect(users.filter((u: any) => u.clerkUserId === NEW_CLIENT_CLERK).length).toBe(1);
      const me = users.find((u: any) => u.clerkUserId === NEW_CLIENT_CLERK);
      expect(me.roles).toHaveLength(1); // no duplicate role rows
    });
  });

  it("an INVITED client (pending invitation with roles) reuses their assigned site", async () => {
    // Superadmin pre-assigns a site to the new client via the existing path.
    let invitedSiteId: any;
    await t.run(async (ctx) => {
      const site = await ctx.db.insert("sites", {
        name: "Invited Client Site",
        slug: "invited-client-site",
        status: "active",
        domain: "invitedclient.com",
        brandColorPrimary: "#1d4ed8",
        brandColorSecondary: "#0f172a",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "business_website",
        enabledModules: {},
      });
      invitedSiteId = site;
      await ctx.db.insert("users", {
        clerkUserId: `pending:${NEW_CLIENT_EMAIL}`,
        name: "New Client",
        email: NEW_CLIENT_EMAIL,
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: site, role: "owner" }],
        inviteStatus: "pending",
      });
    });

    // The invited client signs in and runs self-service onboarding anyway —
    // their pending invitation is claimed (roles preserved) and the EXISTING
    // site is reused: no duplicate, no orphan, no second site.
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    expect(result.outcome).toBe("reused");
    expect(String(result.siteId)).toBe(String(invitedSiteId));

    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const mine = users.filter(
        (u: any) =>
          u.clerkUserId === NEW_CLIENT_CLERK ||
          u.clerkUserId === `pending:${NEW_CLIENT_EMAIL}`,
      );
      expect(mine.length).toBe(1); // invitation claimed, no duplicate user
      expect(mine[0].clerkUserId).toBe(NEW_CLIENT_CLERK);
      expect(mine[0].roles).toHaveLength(1);
      expect(String(mine[0].roles[0].siteId)).toBe(String(invitedSiteId));
      const sites = await ctx.db.query("sites").collect();
      // seed() created corsair's site; this test inserted the invited site;
      // the idempotent re-run must have created NO third site.
      expect(sites.length).toBe(2);
    });
  });

  it("a domain belonging to ANOTHER tenant is a safe-stop conflict (no silent rewrite)", async () => {
    await expect(
      asNewClient().mutation(api.selfServiceOnboarding.provisionSite, {
        ...VALID_ARGS,
        websiteUrl: "https://corsairtacticalsolutions.com",
      }),
    ).rejects.toThrow(/already exists for the website/i);

    // Corsair's assignment is untouched.
    await t.run(async (ctx) => {
      const corsair = (await ctx.db.query("users").collect()).find(
        (u: any) => u.clerkUserId === CORSAIR_CLERK,
      );
      expect(corsair.roles).toHaveLength(1);
      expect(corsair.roles[0].role).toBe("owner");
    });
  });

  it("www/non-www variants of another tenant's domain still conflict", async () => {
    await expect(
      asNewClient().mutation(api.selfServiceOnboarding.provisionSite, {
        ...VALID_ARGS,
        websiteUrl: "https://www.corsairtacticalsolutions.com/about",
      }),
    ).rejects.toThrow(/already exists for the website/i);
  });

  it("an internal-QA-role user is NOT treated as onboarded (qa roles ignored)", async () => {
    // QA users hold internal_qa roles on every site; self-service must not
    // treat those as "already has a site" — but they also shouldn't create
    // client sites. The zero-nonQa-role condition routes them to the lockout.
    let siteId: any;
    await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      siteId = sites[0]._id;
      await ctx.db.insert("users", {
        clerkUserId: "user_qa_selfservice",
        name: "QA User",
        email: "qa@example.com",
        isSuperAdmin: false,
        isActive: true,
        roles: sites.map((s: any) => ({ siteId: s._id, role: "internal_qa" })),
      });
    });
    // status reports canSelfProvision true (no non-QA roles) — QA users are
    // env-allowlisted in production, not blocked here.
    const st = await t
      .withIdentity({ subject: "user_qa_selfservice", email: "qa@example.com" })
      .query(api.selfServiceOnboarding.status);
    expect(st.canSelfProvision).toBe(true);
  });
});

// ── §13: status powers the post-login routing UX ───────────────────────────

describe("selfServiceOnboarding.status — post-login routing inputs (§13)", () => {
  it("anonymous caller: no user, cannot self-provision", async () => {
    const st = await t.query(api.selfServiceOnboarding.status);
    expect(st.hasUser).toBe(false);
    expect(st.canSelfProvision).toBe(false);
    expect(st.subject).toBeNull();
  });

  it("zero-site client: canSelfProvision true (the §13 setup route)", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: NEW_CLIENT_CLERK,
        name: "New Client",
        email: NEW_CLIENT_EMAIL,
        isSuperAdmin: false,
        isActive: true,
        roles: [],
      });
    });
    const st = await asNewClient().query(api.selfServiceOnboarding.status);
    expect(st.hasUser).toBe(true);
    expect(st.hasSites).toBe(false);
    expect(st.siteCount).toBe(0);
    expect(st.canSelfProvision).toBe(true);
    expect(st.subject).toBe(NEW_CLIENT_CLERK);
  });

  it("single-site client: hasSites true, canSelfProvision false (auto-open path)", async () => {
    const st = await asCorsair().query(api.selfServiceOnboarding.status);
    expect(st.hasSites).toBe(true);
    expect(st.siteCount).toBe(1);
    expect(st.canSelfProvision).toBe(false);
  });

  it("superadmin: never offered self-service", async () => {
    const st = await asSuperadmin().query(api.selfServiceOnboarding.status);
    expect(st.isSuperAdmin).toBe(true);
    expect(st.canSelfProvision).toBe(false);
  });

  it("deactivated client: cannot self-provision", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_deactivated",
        name: "Deactivated",
        email: "deactivated@example.com",
        isSuperAdmin: false,
        isActive: false,
        roles: [],
      });
    });
    const st = await t
      .withIdentity({ subject: "user_deactivated", email: "deactivated@example.com" })
      .query(api.selfServiceOnboarding.status);
    expect(st.canSelfProvision).toBe(false);
  });
});

// ── §22: cross-tenant isolation after self-provisioning ────────────────────

describe("tenant isolation after self-service onboarding (§22)", () => {
  it("the new client cannot read the existing tenant's site (both directions)", async () => {
    const result = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    let corsairSiteId: any;
    await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      corsairSiteId = sites.find((s: any) => s.slug === "corsair-tactical-solutions")._id;
    });

    // sites.get is the role-gated reader: cross-tenant denied server-side.
    const leaked = await asNewClient().query(api.sites.get, { siteId: corsairSiteId });
    expect(leaked).toBeNull();

    // And Corsair cannot read the new client's site.
    const reverse = await asCorsair().query(api.sites.get, { siteId: result.siteId });
    expect(reverse).toBeNull();
  });

  it("listWithHealth never shows another tenant's site as fallback (§13)", async () => {
    await asNewClient().mutation(api.selfServiceOnboarding.provisionSite, VALID_ARGS);
    const mine = await asNewClient().query(api.sites.listWithHealth);
    const corsairs = await asCorsair().query(api.sites.listWithHealth);
    expect(mine.map((s: any) => s.slug)).toEqual(["acmedental-com"]);
    expect(corsairs.map((s: any) => s.slug)).toEqual(["corsair-tactical-solutions"]);
  });
});

// ── §14: onboarding self-certification ─────────────────────────────────────

describe("selfServiceOnboarding.certify — setup self-certification (§14)", () => {
  it("certifies a healthy self-provisioned workspace (required checks pass)", async () => {
    const provisioned = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    // The domain acmedental.com does not resolve in the sandbox — stub fetch
    // to answer for the domain-resolution check.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const cert = await asNewClient().action(api.selfServiceOnboarding.certify, {
      siteId: provisioned.siteId,
    });
    expect(cert.complete).toBe(true);
    const byCheck = Object.fromEntries(cert.checks.map((c: any) => [c.check, c.status]));
    expect(byCheck.clerk_user_exists).toBe("pass");
    expect(byCheck.convex_user_exists).toBe("pass");
    expect(byCheck.subject_ids_match).toBe("pass");
    expect(byCheck.site_exists).toBe("pass");
    expect(byCheck.owner_role_references_site).toBe("pass");
    expect(byCheck.no_unauthorized_site_roles).toBe("pass");
    expect(byCheck.site_domain_resolves).toBe("pass");
    // Phase 2 hooks reported with explicit reasons — never a silent pass.
    expect(byCheck.page_discovery_completed).toBe("pending_phase2");
    expect(byCheck.publishing_mode_identified).toBe("pending_phase2");
    expect(byCheck.visual_preview_responds).toBe("pending_phase2");
  });

  it("fails certification when the domain does not resolve (actionable error, not success)", async () => {
    const provisioned = await asNewClient().mutation(
      api.selfServiceOnboarding.provisionSite,
      VALID_ARGS,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const cert = await asNewClient().action(api.selfServiceOnboarding.certify, {
      siteId: provisioned.siteId,
    });
    expect(cert.complete).toBe(false);
    expect(cert.error).toBeTruthy();
    const failed = cert.checks.find(
      (c: any) => c.check === "site_domain_resolves",
    );
    expect(failed.status).toBe("fail");
    expect(failed.reason).toBeTruthy();
  });

  it("denies certification of a site the caller does not own (cross-tenant)", async () => {
    await asNewClient().mutation(api.selfServiceOnboarding.provisionSite, VALID_ARGS);
    let corsairSiteId: any;
    await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      corsairSiteId = sites.find((s: any) => s.slug === "corsair-tactical-solutions")._id;
    });
    const cert = await asNewClient().action(api.selfServiceOnboarding.certify, {
      siteId: corsairSiteId,
    });
    expect(cert.complete).toBe(false);
    const ownerCheck = cert.checks.find(
      (c: any) => c.check === "owner_role_references_site",
    );
    expect(ownerCheck.status).toBe("fail");
  });
});
