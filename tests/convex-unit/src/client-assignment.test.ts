/**
 * Client Assignment (Phase 1 — Client CMS completion)
 *
 * Covers the coherent client-onboarding backend contracts:
 *   ✓ users.assignClient creates a brand-new client with owner role
 *   ✓ users.assignClient REUSES an existing user by email (no duplicate record)
 *   ✓ users.assignClient UPDATES the role of an already-assigned client
 *   ✓ users.assignClient refuses to attach a superadmin to a single site
 *   ✓ users.assignClient is superadmin-only (client/anonymous rejected)
 *   ✓ users.assignClient validates email + site existence
 *   ✓ onboarding.launch attaches the owner when owner fields are provided
 *   ✓ onboarding.launch stays backward compatible (no owner → null)
 *   ✓ sites.getClientAssignments reports assigned/unassigned per site (admin view)
 *   ✓ sites.getClientAssignments hides other agencies' sites (tenant-safe)
 *   ✓ sites.publicBrandBySlug returns cosmetic fields only (no ids/users)
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ───────────────────────────────────────────────────────────────

function agencyBase() {
  return {
    primaryColor: "#000",
    accentColor: "#fff",
    supportEmail: "support@test.local",
    featureFlags: {},
    licensingStatus: "active",
    isActive: true,
  };
}

let t: ReturnType<typeof convexTest>;
let siteA: any;
let siteB: any;

beforeEach(async () => {
  t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const agency = await ctx.db.insert("agencies", {
      name: "Test Agency",
      slug: "test-agency",
      ...agencyBase(),
    });
    siteA = await ctx.db.insert("sites", {
      name: "Site A",
      slug: "site-a",
      status: "active",
      brandColorPrimary: "#111111",
      brandColorSecondary: "#222222",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: { homepage: true },
      agencyId: agency,
    });
    siteB = await ctx.db.insert("sites", {
      name: "Site B",
      slug: "site-b",
      status: "active",
      brandColorPrimary: "#333333",
      brandColorSecondary: "#444444",
      whiteLabelEnabled: true,
      poweredByFsts: false,
      websiteType: "business_website",
      enabledModules: { homepage: true },
    });
    await ctx.db.insert("users", {
      clerkUserId: "superadmin",
      name: "Super Admin",
      email: "superadmin@test.local",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
  });
});

// ── users.assignClient ────────────────────────────────────────────────────

describe("users.assignClient — upsert semantics", () => {
  it("creates a brand-new client user with the owner role", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    const result = await as.mutation(api.users.assignClient, {
      siteId: siteA,
      email: "newowner@client.test",
      name: "New Owner",
      role: "owner",
    });

    expect(result.outcome).toBe("created");
    expect(result.email).toBe("newowner@client.test");
    expect(result.role).toBe("owner");

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "newowner@client.test"))
        .first();
      expect(user).not.toBeNull();
      expect(user!.roles).toEqual([{ siteId: siteA, role: "owner" }]);
      expect(user!.isSuperAdmin).toBe(false);
      expect(user!.clerkUserId).toBe("pending:newowner@client.test");
    });
  });

  it("REUSES an existing client user instead of failing", async () => {
    // Pre-existing client of Site B
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_existing",
        name: "Existing Client",
        email: "existing@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteB, role: "manager" }],
      });
    });

    const as = t.withIdentity({ subject: "superadmin" });
    const result = await as.mutation(api.users.assignClient, {
      siteId: siteA,
      email: "existing@client.test",
      name: "Existing Client",
      role: "owner",
    });

    expect(result.outcome).toBe("reused");

    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const same = users.filter((u) => u.email === "existing@client.test");
      expect(same.length).toBe(1); // no duplicate record
      // Both assignments preserved: old site B manager + new site A owner
      expect(same[0]!.roles).toEqual([
        { siteId: siteB, role: "manager" },
        { siteId: siteA, role: "owner" },
      ]);
    });
  });

  it("updates the role when the client is already assigned to the site", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_promote",
        name: "Promote Me",
        email: "promote@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteA, role: "content_editor" }],
      });
    });

    const as = t.withIdentity({ subject: "superadmin" });
    const result = await as.mutation(api.users.assignClient, {
      siteId: siteA,
      email: "promote@client.test",
      role: "owner",
    });

    expect(result.outcome).toBe("role_updated");
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "promote@client.test"))
        .first();
      expect(user!.roles).toEqual([{ siteId: siteA, role: "owner" }]);
    });
  });

  it("refuses to attach a superadmin to a single site", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await expect(
      as.mutation(api.users.assignClient, {
        siteId: siteA,
        email: "superadmin@test.local",
        role: "owner",
      }),
    ).rejects.toThrow(/platform administrator/i);
  });

  it("is superadmin-only — a plain client is rejected", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_client",
        name: "Plain Client",
        email: "plain@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteA, role: "owner" }],
      });
    });

    const asClient = t.withIdentity({ subject: "user_client" });
    await expect(
      asClient.mutation(api.users.assignClient, {
        siteId: siteA,
        email: "victim@client.test",
        role: "owner",
      }),
    ).rejects.toThrow(/forbidden/i);

    const asAnon = t.withIdentity({ subject: "" });
    await expect(
      asAnon.mutation(api.users.assignClient, {
        siteId: siteA,
        email: "victim@client.test",
        role: "owner",
      }),
    ).rejects.toThrow();
  });

  it("validates email format and site existence", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await expect(
      as.mutation(api.users.assignClient, {
        siteId: siteA,
        email: "not-an-email",
        role: "owner",
      }),
    ).rejects.toThrow(/valid email/i);

    const fakeId = siteB.replace(/[a-z0-9]/g, "0");
    await expect(
      as.mutation(api.users.assignClient, {
        siteId: fakeId,
        email: "ok@client.test",
        role: "owner",
      }),
    ).rejects.toThrow();
  });
});

// ── onboarding.launch owner attachment ────────────────────────────────────

describe("onboarding.launch — owner attachment", () => {
  const STEP_DATA = {
    businessName: "Acme Dojo",
    websiteName: "Acme Dojo",
    industry: "business_website",
    pages: ["home", "about", "contact"],
    domainChoice: "later",
    integrations: [],
  };

  it("attaches the client owner when owner fields are provided", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: "owner-1" });
    const result = await as.mutation(api.onboarding.launch, {
      sessionKey: "owner-1",
      stepData: STEP_DATA,
      owner: { email: "launchowner@client.test", name: "Launch Owner", role: "owner" },
    });

    expect(result.owner).not.toBeNull();
    expect(result.owner!.outcome).toBe("created");

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", "launchowner@client.test"))
        .first();
      expect(user).not.toBeNull();
      expect(user!.roles).toEqual([{ siteId: result.siteId, role: "owner" }]);
    });
  });

  it("reuses an existing client during launch (no duplicate)", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_reuse",
        name: "Reuse Me",
        email: "reuse@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [],
      });
    });

    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: "owner-2" });
    const result = await as.mutation(api.onboarding.launch, {
      sessionKey: "owner-2",
      stepData: STEP_DATA,
      owner: { email: "reuse@client.test", role: "owner" },
    });

    expect(result.owner!.outcome).toBe("reused");
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      expect(users.filter((u) => u.email === "reuse@client.test").length).toBe(1);
    });
  });

  it("remains backward compatible when no owner is provided", async () => {
    const as = t.withIdentity({ subject: "superadmin" });
    await as.mutation(api.onboarding.createSession, { sessionKey: "owner-3" });
    const result = await as.mutation(api.onboarding.launch, {
      sessionKey: "owner-3",
      stepData: STEP_DATA,
    });
    expect(result.owner).toBeNull();
    expect(result.siteId).toBeTruthy();
  });
});

// ── sites.getClientAssignments ────────────────────────────────────────────

describe("sites.getClientAssignments — assignment status", () => {
  it("reports assigned sites with owner details and unassigned sites as null", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_jane",
        name: "Jane Owner",
        email: "jane@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteA, role: "owner" }],
      });
    });

    const as = t.withIdentity({ subject: "superadmin" });
    const rows = await as.query(api.sites.getClientAssignments, {});

    const siteARow = rows.find((r: any) => String(r.siteId) === String(siteA));
    const siteBRow = rows.find((r: any) => String(r.siteId) === String(siteB));
    expect(siteARow.owner).not.toBeNull();
    expect(siteARow.owner.ownerName).toBe("Jane Owner");
    expect(siteARow.owner.ownerEmail).toBe("jane@client.test");
    expect(siteARow.owner.ownerConnected).toBe(true); // real clerk id, not pending:
    expect(siteBRow.owner).toBeNull();
  });

  it("is tenant-safe — a Site A client only sees Site A's row", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_jane",
        name: "Jane Owner",
        email: "jane@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteA, role: "owner" }],
      });
      await ctx.db.insert("users", {
        clerkUserId: "user_bob",
        name: "Bob Staff",
        email: "bob@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: siteB, role: "content_editor" }],
      });
    });

    const asJane = t.withIdentity({ subject: "user_jane" });
    const rows = await asJane.query(api.sites.getClientAssignments, {});
    expect(rows.length).toBe(1);
    expect(String(rows[0].siteId)).toBe(String(siteA));
  });

  it("returns nothing for anonymous callers", async () => {
    const rows = await t.query(api.sites.getClientAssignments, {});
    expect(rows).toEqual([]);
  });
});

// ── sites.publicBrandBySlug ───────────────────────────────────────────────

describe("sites.publicBrandBySlug — cosmetic login context", () => {
  it("returns only cosmetic fields for a known slug", async () => {
    const brand = await t.query(api.sites.publicBrandBySlug, { slug: "site-b" });
    expect(brand).not.toBeNull();
    expect(brand.name).toBe("Site B");
    expect(brand.whiteLabelEnabled).toBe(true);
    // Contract: no ids, no users, no configuration leak
    const keys = Object.keys(brand).sort();
    expect(keys).toEqual(
      ["brandColorPrimary", "domain", "logoUrl", "name", "whiteLabelEnabled"].sort(),
    );
  });

  it("returns null for an unknown slug", async () => {
    const brand = await t.query(api.sites.publicBrandBySlug, { slug: "nope" });
    expect(brand).toBeNull();
  });
});
