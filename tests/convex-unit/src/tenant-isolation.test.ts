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

    // Users — seeded BEFORE any function call so provisionUser never
    // accidentally bootstraps a first-user superadmin.
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("owner_a", { roles: [{ siteId: siteA, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("staff_a", { roles: [{ siteId: siteA, role: "read_only" }] }));
    await ctx.db.insert("users", userDoc("agency1_admin", { agencyId: agency1, isAgencyAdmin: true }));

    const articleB = await ctx.db.insert("articles", {
      siteId: siteB,
      title: "Site B secret article",
      slug: "site-b-secret",
      status: "draft",
      body: "Confidential tenant-B content",
    });
    return { siteA, siteB, agency1, agency2, articleB };
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
