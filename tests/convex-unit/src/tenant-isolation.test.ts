/**
 * Tenant Isolation Tests — FSTS-WOS™ Production Readiness Sprint, Phase 1.
 *
 * Runs the REAL Convex functions and schema against an in-memory backend
 * (convex-test). No mocks of the authorization layer — these tests prove:
 *
 *   1. A user with a role on Site A CAN read and write Site A.
 *   2. A user from Site A CANNOT read Site B content via dashboard queries.
 *   3. A user from Site A CANNOT create/update/delete data in Site B.
 *   4. Read-only staff can read their own site but cannot write anywhere.
 *   5. SuperAdmin retains full access to every site.
 *   6. Agency Admins can access sites in their agency only.
 *   7. Unknown/portal identities and anonymous callers get nothing.
 *   8. Security regressions: superadmin bootstrap mutations are locked down,
 *      upload URLs are site-gated, storage URL resolution requires auth,
 *      and the Square catalog sync action rejects non-members.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

function siteDoc(name: string, slug: string, agencyId?: Id<"agencies">) {
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
    ...(agencyId ? { agencyId } : {}),
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
  corsairSite: Id<"sites">;
  agency1: Id<"agencies">;
  agency2: Id<"agencies">;
  articleB: Id<"articles">;
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
    const agency2 = await ctx.db.insert("agencies", { name: "Agency Two", slug: "agency-two", ...agencyBase });
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "site-a", agency1));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "site-b", agency2));
    const corsairSite = await ctx.db.insert("sites", siteDoc("Corsair Tactical Solutions", "corsair-tactical-solutions"));

    // Users — seeded BEFORE any function call so provisionUser never
    // accidentally bootstraps a first-user superadmin.
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("owner_a", { roles: [{ siteId: siteA, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("staff_a", { roles: [{ siteId: siteA, role: "read_only" }] }));
    await ctx.db.insert("users", userDoc("agency1_admin", { agencyId: agency1, isAgencyAdmin: true }));
    await ctx.db.insert("users", {
      clerkUserId: "corsair_owner_clerk",
      name: "Corsair Tactical Solutions",
      email: "corsairtacticalsolutions@gmail.com",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: corsairSite, role: "owner" }],
    });

    const articleB = await ctx.db.insert("articles", {
      siteId: siteB,
      title: "Site B secret article",
      slug: "site-b-secret",
      status: "draft",
      body: "Confidential tenant-B content",
    });
    return { siteA, siteB, corsairSite, agency1, agency2, articleB };
  });
}

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await seed(t);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Client Admin (owner on Site A)", () => {
  const as = () => t.withIdentity({ subject: "owner_a" });

  it("CAN create and read content in Site A", async () => {
    const created = await as().mutation(api.articles.create, {
      siteId: s.siteA,
      title: "Hello A",
      slug: "hello-a",
      body: "Site A content",
    });
    expect(created.title).toBe("Hello A");
    const list = await as().query(api.articles.list, { siteId: s.siteA });
    expect(list.map((a: any) => a.slug)).toContain("hello-a");
  });

  it("CANNOT read Site B content (list returns empty, get returns null)", async () => {
    const list = await as().query(api.articles.list, { siteId: s.siteB });
    expect(list).toEqual([]);
    const doc = await as().query(api.articles.get, { siteId: s.siteB, articleId: s.articleB });
    expect(doc).toBeNull();
  });

  it("CANNOT create data in Site B", async () => {
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteB, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT update Site B", async () => {
    await expect(
      as().mutation(api.articles.update, { siteId: s.siteB, articleId: s.articleB, title: "hacked" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT delete from Site B", async () => {
    await expect(
      as().mutation(api.articles.remove, { siteId: s.siteB, articleId: s.articleB }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT read Site B settings or site record", async () => {
    expect(await as().query(api.siteSettings.get, { siteId: s.siteB })).toBeNull();
    expect(await as().query(api.sites.get, { siteId: s.siteB })).toBeNull();
  });

  it("CANNOT request an upload URL for Site B", async () => {
    await expect(as().mutation(api.siteSettings.generateUploadUrl, { siteId: s.siteB })).rejects.toThrow(/Forbidden/);
    await expect(as().mutation(api.siteSettings.generateUploadUrl, { siteId: s.siteA })).resolves.toBeTypeOf("string");
  });
});

describe("Staff (read_only on Site A)", () => {
  const as = () => t.withIdentity({ subject: "staff_a" });

  it("CAN read Site A but CANNOT write anywhere", async () => {
    const list = await as().query(api.articles.list, { siteId: s.siteA });
    expect(Array.isArray(list)).toBe(true);
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteA, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteB, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("CANNOT read Site B", async () => {
    expect(await as().query(api.articles.list, { siteId: s.siteB })).toEqual([]);
  });
});

describe("SuperAdmin", () => {
  const as = () => t.withIdentity({ subject: "superadmin" });

  it("has full access to every site", async () => {
    for (const siteId of [s.siteA, s.siteB]) {
      const created = await as().mutation(api.articles.create, {
        siteId,
        title: "admin note",
        slug: `admin-note-${siteId}`,
        body: "ok",
      });
      expect(created.siteId).toBe(siteId);
      const list = await as().query(api.articles.list, { siteId });
      expect(list.length).toBeGreaterThan(0);
      expect(await as().query(api.sites.get, { siteId })).not.toBeNull();
    }
  });
});

describe("Agency Admin (agency1)", () => {
  const as = () => t.withIdentity({ subject: "agency1_admin" });

  it("CAN see the site record of a site in their agency", async () => {
    expect(await as().query(api.sites.get, { siteId: s.siteA })).not.toBeNull();
  });

  it("CANNOT see a site belonging to another agency", async () => {
    expect(await as().query(api.sites.get, { siteId: s.siteB })).toBeNull();
  });

  it("CANNOT write site content without an explicit site role", async () => {
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteA, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("Portal/unknown identities and anonymous callers", () => {
  it("an identity with no dashboard roles cannot read or write any site", async () => {
    const as = t.withIdentity({ subject: "portal_user_1", email: "portal@test.local" });
    expect(await as.query(api.articles.list, { siteId: s.siteA })).toEqual([]);
    await expect(
      as.mutation(api.articles.create, { siteId: s.siteA, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("anonymous callers get nothing from dashboard surfaces", async () => {
    expect(await t.query(api.articles.list, { siteId: s.siteA })).toEqual([]);
    expect(await t.query(api.sites.get, { siteId: s.siteA })).toBeNull();
    await expect(
      t.mutation(api.articles.create, { siteId: s.siteA, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Not authenticated/);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["tenant asset"])));
    await expect(t.query(api.siteSettings.getFileUrl, { storageId }))
      .rejects.toThrow(/Not authenticated/);
    // …but an authenticated active user can resolve it.
    await expect(
      t.withIdentity({ subject: "owner_a" }).query(api.siteSettings.getFileUrl, { storageId }),
    ).resolves.toBeTypeOf("string");
  });
});

describe("Security regressions — superadmin bootstrap lockdown", () => {
  it("upsertTestSuperAdmin is rejected outside CONVEX_TEST_MODE", async () => {
    vi.stubEnv("CONVEX_TEST_MODE", "");
    await expect(
      t.withIdentity({ subject: "owner_a" }).mutation(api.users.upsertTestSuperAdmin, {
        email: "evil@test.local",
        name: "Evil",
      }),
    ).rejects.toThrow(/only available in test environments/);
  });

  it("promoteToSuperAdminByClerkId requires a superadmin caller outside test mode", async () => {
    vi.stubEnv("CONVEX_TEST_MODE", "");
    await expect(
      t.withIdentity({ subject: "owner_a" }).mutation(api.users.promoteToSuperAdminByClerkId, {
        targetClerkUserId: "owner_a",
      }),
    ).rejects.toThrow(/Forbidden/);
    // A real superadmin may still promote.
    await t.withIdentity({ subject: "superadmin" }).mutation(api.users.promoteToSuperAdminByClerkId, {
      targetClerkUserId: "staff_a",
    });
    const promoted = await t.run(async (ctx) =>
      ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "staff_a")).first(),
    );
    expect(promoted?.isSuperAdmin).toBe(true);
  });
});

describe("Security regressions — superadmin + site role conflict guard", () => {
  const as = () => t.withIdentity({ subject: "superadmin" });

  it("users:create throws when isSuperAdmin:true is combined with roleAssignments", async () => {
    await expect(
      as().mutation(api.users.create, {
        name: "Bad Actor",
        email: "badactor@test.local",
        isSuperAdmin: true,
        roleAssignments: [{ siteId: s.siteA, role: "owner" }],
      }),
    ).rejects.toThrow(/Cannot combine isSuperAdmin/);
  });

  it("users:update throws when the resulting state would be superadmin + site roles", async () => {
    // Create a client user that already has a site role
    const clientUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", userDoc("client_with_role", { roles: [{ siteId: s.siteA, role: "owner" }] })),
    );
    await expect(
      as().mutation(api.users.update, {
        userId: clientUserId,
        isSuperAdmin: true,
        // roleAssignments not passed — existing roles on the user make this invalid
      }),
    ).rejects.toThrow(/Cannot combine isSuperAdmin/);
  });

  it("users:addSiteRole throws when the target user is already a superadmin", async () => {
    // Insert a second superadmin directly so we can attempt to assign them a site role
    const superAdminId = await t.run(async (ctx) =>
      ctx.db.insert("users", userDoc("second_superadmin", { isSuperAdmin: true })),
    );
    await expect(
      as().mutation(api.users.addSiteRole, {
        userId: superAdminId,
        siteId: s.siteA,
        role: "owner",
      }),
    ).rejects.toThrow(/Cannot combine isSuperAdmin/);
  });
});

describe("Security regressions — Square catalog sync action", () => {
  it("rejects anonymous, non-member, and read-only callers", async () => {
    await expect(t.action(api.squareOrders.syncCatalog, { siteId: s.siteA })).rejects.toThrow(/Unauthenticated/);
    await expect(
      t.withIdentity({ subject: "portal_user_1" }).action(api.squareOrders.syncCatalog, { siteId: s.siteA }),
    ).rejects.toThrow(/Forbidden/);
    // read_only staff are members but lack write roles — still rejected.
    await expect(
      t.withIdentity({ subject: "staff_a" }).action(api.squareOrders.syncCatalog, { siteId: s.siteA }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ---------------------------------------------------------------------------
// Corsair Owner — role-resolution regression guard
//
// Verifies that corsairtacticalsolutions@gmail.com's "owner" assignment on the
// Corsair site is correctly resolved by users:me and that checkSiteAccess
// grants access only to their own site.
// ---------------------------------------------------------------------------
describe("Corsair Owner — role resolution and site access", () => {
  const as = () => t.withIdentity({ subject: "corsair_owner_clerk" });

  it("users:me returns roleAssignments with the Corsair siteId and role owner", async () => {
    const me = await as().query(api.users.me, {});
    expect(me).not.toBeNull();
    expect(me.roleAssignments).toBeDefined();
    const corsairAssignment = me.roleAssignments.find(
      (ra: { siteId: string; role: string }) => ra.siteId === s.corsairSite,
    );
    expect(corsairAssignment).toBeDefined();
    expect(corsairAssignment?.role).toBe("owner");
  });

  it("checkSiteAccess: CAN access their own Corsair site (sites.get returns the record)", async () => {
    const site = await as().query(api.sites.get, { siteId: s.corsairSite });
    expect(site).not.toBeNull();
    expect(site?.name).toBe("Corsair Tactical Solutions");
  });

  it("checkSiteAccess: CANNOT access an unrelated site (sites.get returns null)", async () => {
    expect(await as().query(api.sites.get, { siteId: s.siteA })).toBeNull();
    expect(await as().query(api.sites.get, { siteId: s.siteB })).toBeNull();
  });

  it("CAN write content on their own Corsair site", async () => {
    const article = await as().mutation(api.articles.create, {
      siteId: s.corsairSite,
      title: "Corsair article",
      slug: "corsair-article",
      body: "Corsair content",
    });
    expect(article.siteId).toBe(s.corsairSite);
  });

  it("CANNOT write content on an unrelated site", async () => {
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteA, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      as().mutation(api.articles.create, { siteId: s.siteB, title: "x", slug: "x", body: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("isSuperAdmin is false — no platform-wide privilege escalation", async () => {
    const me = await as().query(api.users.me, {});
    expect(me?.isSuperAdmin).toBe(false);
  });

  // ------------------------------------------------------------------
  // Regression: users.update replaces the entire roles array.  A partial
  // update that omits roleAssignments must NOT wipe existing role entries.
  // ------------------------------------------------------------------
  it("partial update (name only, no roleAssignments) preserves the Corsair owner role", async () => {
    const superadminAs = () => t.withIdentity({ subject: "superadmin" });

    // Resolve the Corsair owner's Convex userId via their clerkUserId.
    const corsairUserId = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "corsair_owner_clerk"))
        .first()
        .then((u) => u!._id),
    );

    // Perform a partial update that touches only the name field.
    await superadminAs().mutation(api.users.update, {
      userId: corsairUserId,
      name: "Corsair Tactical Solutions (updated)",
    });

    // The Corsair owner role must still be present after the name-only update.
    const me = await as().query(api.users.me, {});
    expect(me).not.toBeNull();
    const corsairAssignment = me.roleAssignments.find(
      (ra: { siteId: string; role: string }) => ra.siteId === s.corsairSite,
    );
    expect(corsairAssignment).toBeDefined();
    expect(corsairAssignment?.role).toBe("owner");
  });

  it("explicit roleAssignments: [] correctly removes the Corsair owner role (intended behaviour)", async () => {
    const superadminAs = () => t.withIdentity({ subject: "superadmin" });

    const corsairUserId = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "corsair_owner_clerk"))
        .first()
        .then((u) => u!._id),
    );

    // Explicitly pass an empty roleAssignments — this is the intentional
    // "revoke all roles" path and must succeed (not be silently ignored).
    await superadminAs().mutation(api.users.update, {
      userId: corsairUserId,
      roleAssignments: [],
    });

    const me = await as().query(api.users.me, {});
    expect(me).not.toBeNull();
    // After an explicit empty-array update, no role assignments should remain.
    expect(me.roleAssignments).toHaveLength(0);
    // And the user loses access to the Corsair site.
    expect(await as().query(api.sites.get, { siteId: s.corsairSite })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Corsair Owner — content queries return non-empty results
//
// Verifies that api.courses.list, api.services.list, and api.products.list
// each return at least one record for the Corsair owner on the Corsair site.
// Seeds one record per collection when the collection is empty so the test
// is self-healing even if the global seed function was not called.
// ---------------------------------------------------------------------------
describe("Corsair Owner — content queries return non-empty results", () => {
  const as = () => t.withIdentity({ subject: "corsair_owner_clerk" });

  it("api.courses.list returns at least one course for the Corsair site", async () => {
    // Initial state: clean in-memory DB, courses table is empty.
    let courses = await as().query(api.courses.list, { siteId: s.corsairSite });
    if (courses.length === 0) {
      await t.run(async (ctx) => {
        await ctx.db.insert("courses", {
          siteId: s.corsairSite,
          title: "Texas License to Carry (LTC)",
          slug: "texas-ltc-certification-basic-handgun",
          status: "published",
          description:
            "Texas DPS-certified License to Carry course covering laws, safe storage, and shooting proficiency.",
        });
      });
      courses = await as().query(api.courses.list, { siteId: s.corsairSite });
    }
    expect(courses.length).toBeGreaterThan(0);
  });

  it("api.services.list returns at least one service for the Corsair site", async () => {
    let services = await as().query(api.services.list, { siteId: s.corsairSite });
    if (services.length === 0) {
      await t.run(async (ctx) => {
        await ctx.db.insert("siteServices", {
          siteId: s.corsairSite,
          title: "Firearms Training",
          slug: "firearms-training",
          description: "Professional firearms training for civilians and security personnel.",
          order: 0,
          isVisible: true,
        });
      });
      services = await as().query(api.services.list, { siteId: s.corsairSite });
    }
    expect(services.length).toBeGreaterThan(0);
  });

  it("api.products.list returns at least one product for the Corsair site", async () => {
    let products = await as().query(api.products.list, { siteId: s.corsairSite });
    // products.list returns null on access-denied, or an array otherwise
    if (!products || products.length === 0) {
      await t.run(async (ctx) => {
        await ctx.db.insert("siteProducts", {
          siteId: s.corsairSite,
          title: "LTC Course Bundle",
          slug: "ltc-course-bundle",
          description: "Complete LTC course package for Texas residents.",
          order: 0,
          isVisible: true,
        });
      });
      products = await as().query(api.products.list, { siteId: s.corsairSite });
    }
    expect(products).not.toBeNull();
    expect(products!.length).toBeGreaterThan(0);
  });
});
