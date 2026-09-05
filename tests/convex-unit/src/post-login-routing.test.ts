/**
 * Post-Login Routing Authorization (D8 — TAYA Client Login Page)
 *
 * Pins the server-side contract behind SitesList.tsx post-login routing:
 *   ✓ sites.listWithHealth returns EVERY site for superadmin (Platform Admin
 *     landing on /app sees the full Website Operations control center)
 *   ✓ sites.listWithHealth returns ONLY the user's assigned sites — a
 *     multi-site client with roles on Sites A+B sees exactly A+B and never
 *     Site C; a client with no roles sees [] and lands on the friendly
 *     "No websites available yet" empty state, not a dead-end error
 *   ✓ a client with a role on exactly ONE site gets a one-element list, which
 *     is what drives the client-side auto-redirect straight into that site
 *     workspace (SitesList.tsx lines 52-56, skipping superadmin/internal_qa)
 *   ✓ agency admins see only their agency's sites
 *   ✓ internal QA identities (dashboard roles) see only assigned sites
 *   ✓ deactivated users see nothing ([] — deactivated banner path)
 *   ✓ anonymous callers get [] (sign-in page never needed site data)
 *   ✓ publicBrandBySlug unknown-slug fail-closed fallback (re-pinned here with
 *     the routing contract: unknown slug -> null -> standard TAYA branding)
 *
 * Client-side behavior (single-site redirect, role workspace titles, zero-site
 * empty state) is covered by the SitesList.tsx implementation, verified during
 * D8 local + production visual verification; the tests here pin the
 * server-side authorization those behaviors depend on.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ────────────────────────────────────────────────────────────────

function siteDoc(name: string, slug: string) {
  return {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: {},
  };
}

function userDoc(
  clerkUserId: string,
  overrides: Partial<{
    isSuperAdmin: boolean;
    isActive: boolean;
    roles: { siteId: Id<"sites">; role: string }[];
    agencyId: Id<"agencies">;
    isAgencyAdmin: boolean;
  }> = {},
) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [],
    ...overrides,
  };
}

type Seeded = {
  siteA: Id<"sites">;
  siteB: Id<"sites">;
  siteC: Id<"sites">;
  agency1: Id<"agencies">;
};

async function seed(t: ReturnType<typeof convexTest>): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const agencyBase = {
      primaryColor: "#000",
      accentColor: "#fff",
      supportEmail: "support@test.local",
      featureFlags: {},
      licensingStatus: "active",
      isActive: true,
    };
    const agency1 = await ctx.db.insert("agencies", { name: "Agency One", slug: "agency-one", ...agencyBase });
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "site-a"));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "site-b"));
    const siteC = await ctx.db.insert("sites", siteDoc("Site C", "site-c"));

    // Users — seeded BEFORE any function call so provisionUser never
    // accidentally bootstraps a first-user superadmin.
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("owner_ab", { roles: [{ siteId: siteA, role: "owner" }, { siteId: siteB, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("owner_c", { roles: [{ siteId: siteC, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("qa_staff", { roles: [{ siteId: siteA, role: "internal_qa" }] }));
    await ctx.db.insert("users", userDoc("agency1_admin", { agencyId: agency1, isAgencyAdmin: true }));
    await ctx.db.insert("users", userDoc("unassigned", {}));
    await ctx.db.insert("users", userDoc("deactivated", { roles: [{ siteId: siteA, role: "owner" }], isActive: false }));
    // Agency-admin-owned site (agency1 scope test)
    await ctx.db.insert("sites", { ...siteDoc("Agency Site", "agency-site"), agencyId: agency1 });

    return { siteA, siteB, siteC, agency1 };
  });
}

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await seed(t);
});

// ── sites.listWithHealth — post-login site list authorization ─────────────

describe("sites.listWithHealth — post-login site list authorization", () => {
  it("superadmin sees every site (Platform Admin landing)", async () => {
    const list = await t.withIdentity({ subject: "superadmin" }).query(api.sites.listWithHealth, {});
    expect(list.map((site: any) => site.slug).sort()).toEqual(
      ["site-a", "site-b", "site-c", "agency-site"].sort(),
    );
  });

  it("multi-site client sees ONLY assigned sites (A+B, never C)", async () => {
    const list = await t.withIdentity({ subject: "owner_ab" }).query(api.sites.listWithHealth, {});
    expect(list.map((site: any) => site.slug).sort()).toEqual(["site-a", "site-b"].sort());
  });

  it("single-site client gets a one-element list (drives the direct-to-site redirect)", async () => {
    const list = await t.withIdentity({ subject: "owner_c" }).query(api.sites.listWithHealth, {});
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("site-c");
  });

  it("zero-role client sees [] (friendly empty state, not an error)", async () => {
    const list = await t.withIdentity({ subject: "unassigned" }).query(api.sites.listWithHealth, {});
    expect(list).toEqual([]);
  });

  it("agency admin sees only agency sites", async () => {
    const list = await t.withIdentity({ subject: "agency1_admin" }).query(api.sites.listWithHealth, {});
    expect(list.map((site: any) => site.slug)).toEqual(["agency-site"]);
  });

  it("internal QA identity with a dashboard role sees only its assigned sites", async () => {
    const list = await t.withIdentity({ subject: "qa_staff" }).query(api.sites.listWithHealth, {});
    expect(list.map((site: any) => site.slug)).toEqual(["site-a"]);
  });

  it("deactivated user sees [] (deactivated banner path)", async () => {
    const list = await t.withIdentity({ subject: "deactivated" }).query(api.sites.listWithHealth, {});
    expect(list).toEqual([]);
  });

  it("anonymous callers get []", async () => {
    const list = await t.query(api.sites.listWithHealth, {});
    expect(list).toEqual([]);
  });
});

// ── publicBrandBySlug — sign-in site context fail-closed fallback ──────────

describe("publicBrandBySlug — sign-in site context", () => {
  it("known slug returns cosmetic brand fields only", async () => {
    const brand = await t.query(api.sites.publicBrandBySlug, { slug: "site-a" });
    expect(brand).not.toBeNull();
    expect(brand.name).toBe("Site A");
    const keys = Object.keys(brand).sort();
    expect(keys).toEqual(
      ["brandColorPrimary", "domain", "logoUrl", "name", "whiteLabelEnabled"].sort(),
    );
  });

  it("unknown slug returns null -> standard TAYA fallback, no tenant leakage", async () => {
    const brand = await t.query(api.sites.publicBrandBySlug, { slug: "corsair-tactical" });
    expect(brand).toBeNull();
  });
});
