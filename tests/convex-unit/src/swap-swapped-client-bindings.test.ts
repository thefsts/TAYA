import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../../convex/_generated/api.js";

/**
 * Guards for the one-off production repair migration
 * `migrations/swapSwappedClientBindings.ts` (P11 — swapped Clerk bindings).
 *
 * Simulates the audited SWAPPED production state and verifies:
 *   - audit reports the swapped state,
 *   - swap corrects the bindings to canonical,
 *   - roles/sites/emails/names/invitation history stay untouched,
 *   - re-run is an idempotent no-op ("alreadyCanonical"),
 *   - refusal when state is unknown (protects foreign deployments),
 *   - refusal when roles do not match the canonical site ownership.
 *
 * NOTE ON SCHEMA: This suite seeds the audited production state EXACTLY,
 * including literal production site IDs (qd74hpd1…, qd7cpjk6…) inside
 * role objects — the state the swap guard inspects. The convex-test fake
 * DB validates v.id() values against its own synthetic table-number ID
 * format, which literal production IDs cannot satisfy, so this suite
 * deliberately runs schema-free (convexTest(modules)) like other
 * no-schema migration suites in this repo (e.g. repair-invited-client-records
 * and productionValidation). The mutation under test only writes
 * clerkUserId (a string), so no ID-format writes are involved.
 *
 * @vitest-environment edge-runtime
 */

const modules = import.meta.glob("../../../convex/**/*.ts");

// Canonical identities (owner-verified 2026-09-06, live-proven).
const FSTS_CLERK = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const FSTS_EMAIL = "cdweemsbey@gmail.com";
const FSTS_SITE_ID = "qd74hpd1vk391fkpy797xk7dzh8drmz9";
const CORSAIR_CLERK = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc";
const SUPERADMIN_EMAIL = "c.weems@fstacktsolutions.com";
const SUPERADMIN_CLERK_ID = "user_3Ihbu2ARStHHHdQiro5oDz8tLXr";

let corsairSite: any;
let fstsSite: any;

/** Seed the audited post-P2 SWAPPED production state (4 users, 2 sites). */
async function seedSwapped() {
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

    // The SWAPPED bindings (exactly what production holds after the P2
    // repair mispaired the orphan Clerk IDs): each record carries the OTHER
    // client's Clerk subject. Roles are correct per record.
    await ctx.db.insert("users", {
      clerkUserId: FSTS_CLERK, // ❌ really cdweemsbey's sub
      name: "Steve — Corsair Tactical",
      email: CORSAIR_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [
        { siteId: CORSAIR_SITE_ID as any, role: "owner" },
        { siteId: CORSAIR_SITE_ID as any, role: "content_editor" },
      ],
    });
    await ctx.db.insert("users", {
      clerkUserId: CORSAIR_CLERK, // ❌ really the Corsair account's sub
      name: "curtis Weems",
      email: FSTS_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: FSTS_SITE_ID as any, role: "owner" }],
      inviteStatus: "failed",
      invitedAt: 1788565189923,
      invitationLastError: "Server Error",
    });
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK_ID,
      name: SUPERADMIN_CLERK_ID,
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    await ctx.db.insert("users", {
      clerkUserId: "pending:justinthomas4@gmail.com",
      name: "Justin Thomas — Internal QA",
      email: "justinthomas4@gmail.com",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: CORSAIR_SITE_ID as any, role: "internal_qa" }],
      inviteStatus: "pending",
      invitedAt: 1788462369942,
    });
  });
}

let t: any;

beforeEach(async () => {
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", SUPERADMIN_CLERK_ID);
  vi.stubEnv("INTERNAL_QA_EMAILS", "justinthomas4@gmail.com");
  t = convexTest(undefined, modules);
  await seedSwapped();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const audit = () =>
  (t as any).query((api as any).migrations.swapSwappedClientBindings.audit, {});
const swap = () =>
  (t as any).mutation((api as any).migrations.swapSwappedClientBindings.swap, {});

async function allUsers() {
  return await t.run(async (ctx: any) => ctx.db.query("users").collect());
}

test("audit reports the swapped production state", async () => {
  const out = await audit();
  expect(out.totalUsers).toBe(4);
  expect(out.state).toBe("swapped");
  expect(out.fstsRecord.clerkUserId).toBe(CORSAIR_CLERK);
  expect(out.corsairRecord.clerkUserId).toBe(FSTS_CLERK);
});

test("swap corrects bindings to canonical and preserves everything else", async () => {
  const out = await swap();
  expect(out.status).toBe("swapped");
  expect(out.swapped).toBe(2);
  expect(out.postSwap.state).toBe("canonical");

  const users = await allUsers();
  const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL)!;
  const corsair = users.find((u: any) => norm(u.email) === CORSAIR_EMAIL)!;

  // Bindings are canonical now.
  expect(fsts.clerkUserId).toBe(FSTS_CLERK);
  expect(corsair.clerkUserId).toBe(CORSAIR_CLERK);

  // Everything else untouched: roles, emails, names, history.
  expect(fsts.roles).toEqual([{ siteId: FSTS_SITE_ID, role: "owner" }]);
  expect(corsair.roles).toEqual([
    { siteId: CORSAIR_SITE_ID, role: "owner" },
    { siteId: CORSAIR_SITE_ID, role: "content_editor" },
  ]);
  expect(fsts.name).toBe("curtis Weems");
  expect(corsair.name).toBe("Steve — Corsair Tactical");
  expect(fsts.inviteStatus).toBe("failed");
  expect(fsts.invitationLastError).toBe("Server Error");

  // Record identity unchanged (FK references elsewhere stay valid).
  expect(String(fsts._id)).toBe(String(out.postSwap.fstsRecord.id));
  expect(String(corsair._id)).toBe(String(out.postSwap.corsairRecord.id));
});

test("second run is an idempotent no-op", async () => {
  await swap();
  const out2 = await swap();
  expect(out2.status).toBe("alreadyCanonical");
  expect(out2.swapped).toBe(0);
  expect(out2.postSwap.state).toBe("canonical");

  const users = await allUsers();
  expect(users).toHaveLength(4); // no duplicates ever
  const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL)!;
  expect(fsts.clerkUserId).toBe(FSTS_CLERK);
});

test("refuses when state is unknown (foreign deployment protection)", async () => {
  // Corrupt the state: bind a stranger's subject to the FSTS record.
  await t.run(async (ctx: any) => {
    const fsts = (await ctx.db.query("users").collect()).find(
      (u: any) => norm(u.email) === FSTS_EMAIL,
    );
    await ctx.db.patch(fsts._id, { clerkUserId: "user_someStrangerXXX" });
  });
  await expect(swap()).rejects.toThrow(/REFUSING/);
});

test("refuses when a record's roles are cross-tenant (would hand a stranger the wrong tenant)", async () => {
  // Corrupt the state: FSTS record carries a Corsair role — swapping the
  // binding would then authorize cdweemsbey on the Corsair site.
  await t.run(async (ctx: any) => {
    const fsts = (await ctx.db.query("users").collect()).find(
      (u: any) => norm(u.email) === FSTS_EMAIL,
    );
    await ctx.db.patch(fsts._id, {
      roles: [
        { siteId: FSTS_SITE_ID, role: "owner" },
        { siteId: CORSAIR_SITE_ID, role: "owner" }, // ❌ cross-tenant
      ],
    });
  });
  await expect(swap()).rejects.toThrow(/REFUSING/);
});

const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");
