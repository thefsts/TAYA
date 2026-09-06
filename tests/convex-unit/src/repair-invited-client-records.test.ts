import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../../convex/_generated/api.js";
import { schema } from "../../../convex/schema.js";

/**
 * Guards for the one-off production repair migration
 * `migrations/repairInvitedClientRecords.ts`.
 *
 * Simulates the exact audited production state (2 orphan users + 2 pending
 * invitations + superadmin + QA record with a stale role) and verifies:
 *   - the rebind + orphan retirement works,
 *   - role preservation (no invented roles, invitation roles kept, admin-set
 *     names and invitation history preserved),
 *   - activation of the Corsair invitation,
 *   - stale-role cleanup,
 *   - idempotency (second run is a no-op),
 *   - precondition guards (refusals on mismatched state).
 */

const modules = import.meta.glob("../../../convex/**/*.ts");

// Mirrors of the audited production identities (the migration locates rows
// by state — clerk id / pending email / @unknown.local suffix — not row id).
const CORSAIR_INVITE_CLERK = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const CORSAIR_INVITE_EMAIL = "corsairtacticalsolutions@gmail.com";
const FSTS_INVITE_CLERK = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const FSTS_INVITE_EMAIL = "cdweemsbey@gmail.com";
const STALE_SITE_ID = "qd71sbs6m0q215ehvdw9gbvkcn8brk1e";
const JUSTIN_EMAIL = "justinthomas4@gmail.com";
const SUPERADMIN_EMAIL = "c.weems@fstacktsolutions.com";
const SUPERADMIN_CLERK_ID = "user_3Ihbu2ARStHHHdQiro5oDz8tLXr";

let corsairSite: any;
let fstsSite: any;

async function seed() {
  await t.run(async (ctx) => {
    corsairSite = await ctx.db.insert("sites", {
      name: "Corsair Tactical Solutions",
      slug: "corsair-tactical-solutions",
      status: "active",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: {},
    });
    fstsSite = await ctx.db.insert("sites", {
      name: "https://www.fstacktsolutions.com/",
      slug: "httpswwwfstacktsolutionscom",
      status: "active",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: {},
    });

    // Pending invitations (admin-created, roles stranded here).
    await ctx.db.insert("users", {
      clerkUserId: `pending:${CORSAIR_INVITE_EMAIL}`,
      name: "Steve — Corsair Tactical",
      email: CORSAIR_INVITE_EMAIL,
      isSuperAdmin: false,
      isActive: false, // production defect: invitation deactivated
      roles: [
        { siteId: corsairSite, role: "owner" },
        { siteId: corsairSite, role: "content_editor" },
      ],
      inviteStatus: "pending",
      invitedAt: 1788462369942,
    });
    await ctx.db.insert("users", {
      clerkUserId: `pending:${FSTS_INVITE_EMAIL}`,
      name: "curtis Weems",
      email: FSTS_INVITE_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: fstsSite, role: "owner" }],
      inviteStatus: "failed",
      invitedAt: 1788565189923,
      invitationLastError: "Server Error",
    });

    // Orphan users (provisioned claimless by the old code).
    await ctx.db.insert("users", {
      clerkUserId: CORSAIR_INVITE_CLERK,
      name: CORSAIR_INVITE_CLERK,
      email: "user_3iqpwkrg7oerlhccrv0n4yxlmrs@unknown.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [],
    });
    await ctx.db.insert("users", {
      clerkUserId: FSTS_INVITE_CLERK,
      name: FSTS_INVITE_CLERK,
      email: "user_3isugrs6vmvy9rdylz86szn7l9k@unknown.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [],
    });

    // Superadmin + QA with stale role.
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK_ID,
      name: SUPERADMIN_CLERK_ID,
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    await ctx.db.insert("users", {
      clerkUserId: `pending:${JUSTIN_EMAIL}`,
      name: "Justin Thomas — Internal QA",
      email: JUSTIN_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [
        { siteId: corsairSite, role: "internal_qa" },
        { siteId: STALE_SITE_ID as any, role: "internal_qa" },
      ],
      inviteStatus: "pending",
      invitedAt: 1788462369942,
    });
  });
}

let t: any;

beforeEach(async () => {
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", SUPERADMIN_CLERK_ID);
  vi.stubEnv("INTERNAL_QA_EMAILS", JUSTIN_EMAIL);
  t = convexTest(schema, modules);
  await seed();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const audit = () =>
  (t as any).query((api as any).migrations.repairInvitedClientRecords.audit, {});
const repair = () =>
  (t as any).mutation((api as any).migrations.repairInvitedClientRecords.repair, {});

async function allUsers() {
  return await t.run(async (ctx: any) => ctx.db.query("users").collect());
}

test("audit reflects the audited production state", async () => {
  const out = await audit();
  expect(out.totalUsers).toBe(6);
  expect(out.orphanCount).toBe(2);
  expect(out.corsair.orphanCount).toBe(1);
  expect(out.corsair.orphanEmails[0]).toContain("@unknown.local");
  expect(out.corsair.invitationPresent).toBe(true);
  expect(out.corsair.invitationActive).toBe(false);
  expect(out.corsair.invitationRoles).toHaveLength(2);
  expect(out.fsts.orphanCount).toBe(1);
  expect(out.fsts.invitationRoles).toHaveLength(1);
  expect(out.justin.staleSiteRole).toBeTruthy();
  expect(out.justin.staleSiteExists).toBe(false);
});

test("repair rebinds both invitations, retires orphans, activates, and cleans the stale role", async () => {
  const out = await repair();
  expect(out.patched).toBe(3); // 2 invitations + justin
  expect(out.deleted).toBe(2); // 2 orphans
  expect(out.postRepair.orphanCount).toBe(0);
  expect(out.postRepair.totalUsers).toBe(4);

  const users = await allUsers();
  const corsair = users.find((u: any) => u.clerkUserId === CORSAIR_INVITE_CLERK)!;
  expect(corsair.email).toBe(CORSAIR_INVITE_EMAIL);
  expect(corsair.name).toBe("Steve — Corsair Tactical"); // admin-set name preserved
  expect(corsair.isActive).toBe(true); // activated
  expect(corsair.isSuperAdmin).toBe(false);
  expect(corsair.roles).toEqual([
    { siteId: corsairSite, role: "owner" },
    { siteId: corsairSite, role: "content_editor" },
  ]);
  expect(corsair.inviteStatus).toBe("pending"); // invitation history preserved
  expect(corsair.invitedAt).toBe(1788462369942);

  const fsts = users.find((u: any) => u.clerkUserId === FSTS_INVITE_CLERK)!;
  expect(fsts.email).toBe(FSTS_INVITE_EMAIL);
  expect(fsts.name).toBe("curtis Weems");
  expect(fsts.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);
  expect(fsts.inviteStatus).toBe("failed"); // invitation history preserved
  expect(fsts.invitationLastError).toBe("Server Error");

  // Orphans retired: no @unknown.local rows remain.
  expect(users.filter((u: any) => u.email.endsWith("@unknown.local"))).toHaveLength(0);

  // Justin's stale role removed, live role kept.
  const justin = users.find((u: any) => u.email === JUSTIN_EMAIL)!;
  expect(justin.roles).toEqual([{ siteId: corsairSite, role: "internal_qa" }]);

  // Superadmin untouched.
  const superadmin = users.find((u: any) => u.clerkUserId === SUPERADMIN_CLERK_ID)!;
  expect(superadmin.isSuperAdmin).toBe(true);
});

test("repair is idempotent — second run is a no-op", async () => {
  await repair();
  const second = await repair();
  expect(second.patched).toBe(0);
  expect(second.deleted).toBe(0);
  expect(second.log.join("\n")).toMatch(/already repaired/);
  expect(second.postRepair.totalUsers).toBe(4);
});

test("repair refuses when the invitation does not reference the expected site (cross-tenant guard)", async () => {
  const users = await allUsers();
  const invite = users.find(
    (u: any) => u.clerkUserId === `pending:${CORSAIR_INVITE_EMAIL}`,
  )!;
  await t.run(async (ctx: any) => {
    await ctx.db.patch(invite._id, {
      roles: [{ siteId: fstsSite, role: "owner" }],
    });
  });
  await expect(repair()).rejects.toThrow(/does not reference site/i);
});

test("repair refuses when the orphan is missing entirely", async () => {
  const users = await allUsers();
  const orphan = users.find(
    (u: any) =>
      u.clerkUserId === CORSAIR_INVITE_CLERK &&
      u.email.endsWith("@unknown.local"),
  )!;
  await t.run(async (ctx: any) => {
    await ctx.db.delete(orphan._id);
  });
  await expect(repair()).rejects.toThrow(/expected exactly 1 orphan/i);
});

test("repair never strips roles whose site still exists (live-role safety)", async () => {
  // Point Justin's roles at live sites only — nothing may be stripped.
  await t.run(async (ctx: any) => {
    const users = await ctx.db.query("users").collect();
    const justin = users.find(
      (u: any) => u.email.trim().toLowerCase() === JUSTIN_EMAIL,
    );
    await ctx.db.patch(justin._id, {
      roles: [
        { siteId: corsairSite, role: "internal_qa" },
        { siteId: fstsSite, role: "content_editor" },
      ],
    });
  });
  const out = await repair();
  expect(out.log.join("\n")).toMatch(/no dangling roles/i);
  const users = await allUsers();
  const justin = users.find((u: any) => u.email === JUSTIN_EMAIL)!;
  expect(justin.roles).toEqual([
    { siteId: corsairSite, role: "internal_qa" },
    { siteId: fstsSite, role: "content_editor" },
  ]);
});
