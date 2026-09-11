/**
 * PHASE 6 FINAL CONVERGENCE — PORTAL ADMIN WRITE AUTHORIZATION TESTS.
 * @vitest-environment edge-runtime
 *
 * Deterministic proof that portal administration writes enforce the
 * owner/manager/server contract SERVER-SIDE (Phase 6 security blocker fix).
 *
 * Previously reported defect: convex/portal.ts gated saveConfig,
 * updateUserStatus, updateUserRole, deletePortalUser, and updateUserNotes on
 * MEMBERSHIP ONLY — `user.roles.some((r) => r.siteId === siteId)` — so ANY
 * site role (read_only, support, marketing, finance, …) could call the
 * mutations directly through the Convex API. The dashboard simply did not
 * show the PortalManager route to those roles; frontend hiding is not
 * authorization.
 *
 * These tests run the REAL mutation handlers against an in-memory
 * convex-test backend (no mocks of the gate). They pin:
 *
 *   1. Every non-admin site role is REJECTED by every admin write.
 *   2. Owner and manager (intended admins) are ALLOWED for their site.
 *   3. FSTS SuperAdmin is ALLOWED.
 *   4. An owner of a DIFFERENT site is REJECTED (no cross-tenant writes).
 *   5. An unauthenticated caller is REJECTED.
 *   6. An inactive owner is REJECTED (no silent pass on deactivated accounts).
 *   7. Writes actually persist when allowed (the gate is not a blanket deny).
 *   8. Membership-scoped READS (getConfig/listUsers) are unchanged: members
 *      still see config/member lists (no read regression introduced by the fix).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Seed helpers ───────────────────────────────────────────────

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

type Seeded = {
  siteId: Id<"sites">;
  otherSiteId: Id<"sites">;
  portalUserId: Id<"portalUsers">;
  deletedPortalUserId: Id<"portalUsers">;
};

async function seed(t: ReturnType<typeof convexTest>): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", siteDoc("Main Site", "portal-auth-main"));
    const otherSiteId = await ctx.db.insert("sites", siteDoc("Other Site", "portal-auth-other"));

    // A portal member on the main site — the TARGET of admin writes.
    const portalUserId = await ctx.db.insert("portalUsers", {
      siteId,
      email: "member@client.test",
      firstName: "Portal",
      lastName: "Member",
      passwordHash: "0".repeat(64),
      passwordSalt: "0".repeat(32),
      role: "member",
      status: "active",
      emailVerified: true,
    });

    // A second portal member that is then DELETED — its now-dangling ID is a
    // guaranteed VALID-format-but-nonexistent Id<"portalUsers">, so handlers
    // reach their own "User not found" branch instead of a validator error.
    const deletedPortalUserId = await ctx.db.insert("portalUsers", {
      siteId,
      email: "ghost@client.test",
      firstName: "Deleted",
      lastName: "Member",
      passwordHash: "0".repeat(64),
      passwordSalt: "0".repeat(32),
      role: "member",
      status: "active",
      emailVerified: true,
    });
    await ctx.db.delete(deletedPortalUserId);

    const user = (clerkUserId: string, email: string, roles: Array<{ siteId: Id<"sites">; role: string }>, isActive = true) =>
      ctx.db.insert("users", {
        clerkUserId,
        name: clerkUserId,
        email,
        isSuperAdmin: false,
        isActive,
        roles,
      });

    // Every non-admin client role on the MAIN site — all must be denied.
    await user("read_only_user", "ro@client.test", [{ siteId, role: "read_only" }]);
    await user("support_user", "sup@client.test", [{ siteId, role: "support" }]);
    await user("marketing_user", "mkt@client.test", [{ siteId, role: "marketing" }]);
    await user("content_editor_user", "ed@client.test", [{ siteId, role: "content_editor" }]);
    await user("finance_user", "fin@client.test", [{ siteId, role: "finance" }]);
    await user("course_manager_user", "cm@client.test", [{ siteId, role: "course_manager" }]);
    await user("events_manager_user", "em@client.test", [{ siteId, role: "events_manager" }]);
    await user("internal_qa_user", "qa@client.test", [{ siteId, role: "internal_qa" }]);

    // Intended admins on the MAIN site — must be allowed for THEIR site.
    await user("owner_user", "owner@client.test", [{ siteId, role: "owner" }]);
    await user("manager_user", "mgr@client.test", [{ siteId, role: "manager" }]);

    // Owner of the OTHER site — must be denied against the main site
    // (cross-tenant), even though "owner" is an admin role.
    await user("other_owner_user", "otherowner@client.test", [{ siteId: otherSiteId, role: "owner" }]);

    // SuperAdmin (FSTS server authority).
    await ctx.db.insert("users", {
      clerkUserId: "superadmin_user",
      name: "FSTS Admin",
      email: "admin@fsts.test",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });

    // Inactive owner — membership was real once; account now deactivated.
    await user("inactive_owner_user", "inactive@client.test", [{ siteId, role: "owner" }], false);

    return { siteId, otherSiteId, portalUserId, deletedPortalUserId };
  });
}

// ── Suite ──────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await seed(t);
});

// Non-admin roles that hold membership on the main site. Each of these was
// accepted by the OLD membership-only gate — the exact defect under test.
const NON_ADMIN_MEMBERS = [
  ["read_only", "read_only_user"],
  ["support", "support_user"],
  ["marketing", "marketing_user"],
  ["content_editor", "content_editor_user"],
  ["finance", "finance_user"],
  ["course_manager", "course_manager_user"],
  ["events_manager", "events_manager_user"],
  ["internal_qa", "internal_qa_user"],
] as const;

const configArgs = {
  enabled: true,
  registrationOpen: true,
  requireApproval: false,
  enabledFeatures: { courses: true },
};

describe("portal admin writes — non-admin site members are rejected", () => {
  it.each(NON_ADMIN_MEMBERS)("role %s cannot saveConfig", async (_role: string, subject: string) => {
    await expect(
      t.withIdentity({ subject }).mutation(api.portal.saveConfig, {
        siteId: s.siteId,
        ...configArgs,
      }),
    ).rejects.toThrow(/Access denied/);
  });

  it.each(NON_ADMIN_MEMBERS)("role %s cannot updateUserStatus", async (_role: string, subject: string) => {
    await expect(
      t.withIdentity({ subject }).mutation(api.portal.updateUserStatus, {
        portalUserId: s.portalUserId,
        status: "suspended",
      }),
    ).rejects.toThrow(/Access denied/);
  });

  it.each(NON_ADMIN_MEMBERS)("role %s cannot updateUserRole", async (_role: string, subject: string) => {
    await expect(
      t.withIdentity({ subject }).mutation(api.portal.updateUserRole, {
        portalUserId: s.portalUserId,
        role: "admin",
      }),
    ).rejects.toThrow(/Access denied/);
  });

  it.each(NON_ADMIN_MEMBERS)("role %s cannot deletePortalUser", async (_role: string, subject: string) => {
    await expect(
      t.withIdentity({ subject }).mutation(api.portal.deletePortalUser, {
        portalUserId: s.portalUserId,
      }),
    ).rejects.toThrow(/Access denied/);
  });

  it.each(NON_ADMIN_MEMBERS)("role %s cannot updateUserNotes", async (_role: string, subject: string) => {
    await expect(
      t.withIdentity({ subject }).mutation(api.portal.updateUserNotes, {
        portalUserId: s.portalUserId,
        notes: "should not persist",
      }),
    ).rejects.toThrow(/Access denied/);
  });
});

describe("portal admin writes — intended admins are allowed for their own site", () => {
  it("owner can saveConfig", async () => {
    await t.withIdentity({ subject: "owner_user" }).mutation(api.portal.saveConfig, {
      siteId: s.siteId,
      ...configArgs,
    });
    const cfg = await t.withIdentity({ subject: "owner_user" }).query(api.portal.getConfig, { siteId: s.siteId });
    expect(cfg?.enabled).toBe(true);
  });

  it("manager can saveConfig", async () => {
    await expect(
      t.withIdentity({ subject: "manager_user" }).mutation(api.portal.saveConfig, {
        siteId: s.siteId,
        ...configArgs,
      }),
    ).resolves.toBeDefined();
  });

  it("owner can updateUserStatus and the write persists", async () => {
    await t.withIdentity({ subject: "owner_user" }).mutation(api.portal.updateUserStatus, {
      portalUserId: s.portalUserId,
      status: "suspended",
    });
    const members = await t.withIdentity({ subject: "owner_user" }).query(api.portal.listUsers, { siteId: s.siteId });
    expect(members?.find((m: any) => m._id === s.portalUserId)?.status).toBe("suspended");
  });

  it("manager can updateUserRole and the write persists", async () => {
    await t.withIdentity({ subject: "manager_user" }).mutation(api.portal.updateUserRole, {
      portalUserId: s.portalUserId,
      role: "editor",
    });
    const members = await t.withIdentity({ subject: "manager_user" }).query(api.portal.listUsers, { siteId: s.siteId });
    expect(members?.find((m: any) => m._id === s.portalUserId)?.role).toBe("editor");
  });

  it("owner can deletePortalUser and the row is gone", async () => {
    await t.withIdentity({ subject: "owner_user" }).mutation(api.portal.deletePortalUser, {
      portalUserId: s.portalUserId,
    });
    const members = await t.withIdentity({ subject: "owner_user" }).query(api.portal.listUsers, { siteId: s.siteId });
    expect(members?.some((m: any) => m._id === s.portalUserId)).toBe(false);
  });

  it("owner can updateUserNotes and the write persists", async () => {
    await t.withIdentity({ subject: "owner_user" }).mutation(api.portal.updateUserNotes, {
      portalUserId: s.portalUserId,
      notes: "VIP client",
    });
    const members = await t.withIdentity({ subject: "owner_user" }).query(api.portal.listUsers, { siteId: s.siteId });
    expect(members?.find((m: any) => m._id === s.portalUserId)?.notes).toBe("VIP client");
  });
});

describe("portal admin writes — superadmin (FSTS server authority)", () => {
  it("superadmin can saveConfig", async () => {
    await expect(
      t.withIdentity({ subject: "superadmin_user" }).mutation(api.portal.saveConfig, {
        siteId: s.siteId,
        ...configArgs,
      }),
    ).resolves.toBeDefined();
  });

  it("superadmin can updateUserStatus", async () => {
    await expect(
      t.withIdentity({ subject: "superadmin_user" }).mutation(api.portal.updateUserStatus, {
        portalUserId: s.portalUserId,
        status: "active",
      }),
    ).resolves.toBeDefined();
  });
});

describe("portal admin writes — cross-tenant and edge cases", () => {
  it("an owner of a DIFFERENT site cannot write this site's portal", async () => {
    await expect(
      t.withIdentity({ subject: "other_owner_user" }).mutation(api.portal.saveConfig, {
        siteId: s.siteId,
        ...configArgs,
      }),
    ).rejects.toThrow(/Access denied/);

    await expect(
      t.withIdentity({ subject: "other_owner_user" }).mutation(api.portal.updateUserStatus, {
        portalUserId: s.portalUserId,
        status: "suspended",
      }),
    ).rejects.toThrow(/Access denied/);
  });

  it("an unauthenticated caller is rejected (no identity)", async () => {
    await expect(
      t.mutation(api.portal.saveConfig, { siteId: s.siteId, ...configArgs }),
    ).rejects.toThrow(/Not authenticated/);

    await expect(
      t.mutation(api.portal.updateUserStatus, {
        portalUserId: s.portalUserId,
        status: "suspended",
      }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("an INACTIVE owner is rejected (deactivated accounts never pass)", async () => {
    await expect(
      t.withIdentity({ subject: "inactive_owner_user" }).mutation(api.portal.saveConfig, {
        siteId: s.siteId,
        ...configArgs,
      }),
    ).rejects.toThrow(/deactivated|Not authenticated|Access denied/);
  });

  it("updating a nonexistent portalUser still throws User not found (unchanged behavior)", async () => {
    await expect(
      t.withIdentity({ subject: "owner_user" }).mutation(api.portal.updateUserStatus, {
        portalUserId: s.deletedPortalUserId,
        status: "suspended",
      }),
    ).rejects.toThrow(/User not found/);
  });
});

describe("portal membership READS — unchanged by the write-gate fix", () => {
  it("a read_only member can still read config and member list (no read regression)", async () => {
    const cfg = await t.withIdentity({ subject: "read_only_user" }).query(api.portal.getConfig, {
      siteId: s.siteId,
    });
    expect(cfg).toBeNull(); // no config yet — reads stay membership-scoped

    const members = await t.withIdentity({ subject: "read_only_user" }).query(api.portal.listUsers, {
      siteId: s.siteId,
    });
    expect(Array.isArray(members)).toBe(true);
    expect(members?.length).toBe(1);
  });

  it("a member with NO role on the site reads nothing (existing scope preserved)", async () => {
    await t.run(async (c) => {
      await c.db.insert("users", {
        clerkUserId: "outsider_user",
        name: "Outsider",
        email: "out@client.test",
        isSuperAdmin: false,
        isActive: true,
        roles: [],
      });
    });
    const cfg = await t.withIdentity({ subject: "outsider_user" }).query(api.portal.getConfig, {
      siteId: s.siteId,
    });
    expect(cfg).toBeNull();
    const members = await t.withIdentity({ subject: "outsider_user" }).query(api.portal.listUsers, {
      siteId: s.siteId,
    });
    expect(members).toBeNull();
  });
});
