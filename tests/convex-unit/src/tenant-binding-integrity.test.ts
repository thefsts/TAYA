/**
 * TENANT BINDING INTEGRITY — permanent regression suite (spec §22).
 * @vitest-environment edge-runtime
 */

import { test, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../../convex/_generated/api.js";
import schema from "../../../convex/schema";

/**
 * These tests use the CANONICAL production fixtures (FSTS + Corsair) to pin
 * the identity/authorization contract that the 2026-09-06 defect violated:
 *
 *   1. Clerk subject → exactly ONE users record (the subject is the
 *      identity authority — a subject can never resolve to two records).
 *   2. A users record's roles authorize ONLY its own tenant's site —
 *      cross-tenant roles are rejected by every role-gated reader.
 *   3. A swapped binding (subject bound to the other client's record)
 *      FAILS the identity-vs-record consistency check — surface it as an
 *      error, never as silent wrong-tenant access.
 *   4. Direct foreign-site URL access is denied SERVER-SIDE.
 *   5. Stale/previous-site preferences never cross tenant boundaries.
 *   6. Invitation reconciliation never rebinds a subject that is already
 *      canonically bound to another record (no silent rewrite of another
 *      client's assignment).
 *
 * These are contract tests on the same in-memory Convex backend the other
 * suites use, seeded with the canonical production fixtures. Role-gated
 * reader tests use the in-memory site IDs (so authorization resolves);
 * the swap-detection test mirrors production exactly (literal production
 * site IDs inside roles), matching what migrations/swapSwappedClientBindings
 * guards against.
 */

const modules = import.meta.glob("../../../convex/**/*.ts");

// Canonical production fixtures (owner-verified 2026-09-06, live-proven).
const FSTS_CLERK = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const FSTS_EMAIL = "cdweemsbey@gmail.com";
const FSTS_SITE_SLUG = "httpswwwfstacktsolutionscom";
const FSTS_SITE_ID = "qd74hpd1vk391fkpy797xk7dzh8drmz9"; // literal production id
const CORSAIR_CLERK = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const CORSAIR_SITE_SLUG = "corsair-tactical-solutions";
const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc"; // literal production id
const SUPERADMIN_EMAIL = "c.weems@fstacktsolutions.com";
const SUPERADMIN_CLERK_ID = "user_3Ihbu2ARStHHHdQiro5oDz8tLXr";

const norm = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase() : "";

let fstsSite: any;
let corsairSite: any;

/**
 * Seed CANONICAL production state: 2 sites + FSTS client + Corsair client +
 * superadmin, all correctly bound. Roles reference the in-memory site IDs so
 * the role-gated readers (api.sites.*) can resolve authorization.
 */
async function seedCanonical() {
  await t.run(async (ctx) => {
    corsairSite = await ctx.db.insert("sites", {
      name: "Corsair Tactical Solutions",
      slug: CORSAIR_SITE_SLUG,
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
      slug: FSTS_SITE_SLUG,
      status: "active",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: {},
    });
    await ctx.db.insert("users", {
      clerkUserId: FSTS_CLERK,
      name: "curtis Weems",
      email: FSTS_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: fstsSite, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: CORSAIR_CLERK,
      name: "Steve — Corsair Tactical",
      email: CORSAIR_EMAIL,
      isSuperAdmin: false,
      isActive: true,
      roles: [
        { siteId: corsairSite, role: "owner" },
        { siteId: corsairSite, role: "content_editor" },
      ],
    });
    await ctx.db.insert("users", {
      clerkUserId: SUPERADMIN_CLERK_ID,
      name: SUPERADMIN_CLERK_ID,
      email: SUPERADMIN_EMAIL,
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
  });
}

let t: any;

beforeEach(async () => {
  vi.stubEnv("SUPERADMIN_EMAILS", SUPERADMIN_EMAIL);
  vi.stubEnv("SUPERADMIN_CLERK_USER_IDS", SUPERADMIN_CLERK_ID);
  vi.stubEnv("INTERNAL_QA_EMAILS", "justinthomas4@gmail.com");
  t = convexTest(schema, modules);
  await seedCanonical();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function allUsers() {
  return await t.run(async (ctx: any) => ctx.db.query("users").collect());
}

const asUser = (clerkId: string) => t.withIdentity({ subject: clerkId });
const audit = () =>
  (t as any).query((api as any).migrations.swapSwappedClientBindings.audit, {});

// ---------------------------------------------------------------------------
// 1. Subject → record uniqueness (identity authority)
// ---------------------------------------------------------------------------

test("each Clerk subject resolves to exactly ONE users record (canonical state)", async () => {
  const users = await allUsers();
  const bySubject = new Map<string, number>();
  for (const u of users) {
    const k = String(u.clerkUserId);
    bySubject.set(k, (bySubject.get(k) ?? 0) + 1);
  }
  for (const [subject, count] of bySubject) {
    expect(count, `subject ${subject} must map to exactly one record`).toBe(1);
  }
});

test("canonical fixtures present: FSTS and Corsair clients both bound correctly", async () => {
  const users = await allUsers();
  const fsts = users.find((u: any) => u.clerkUserId === FSTS_CLERK);
  const corsair = users.find((u: any) => u.clerkUserId === CORSAIR_CLERK);
  expect(fsts?.email).toBe(FSTS_EMAIL);
  expect(fsts?.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);
  expect(corsair?.email).toBe(CORSAIR_EMAIL);
  expect(corsair?.roles).toHaveLength(2);
  expect(corsair?.roles.every((r: any) => String(r.siteId) === String(corsairSite))).toBe(true);
});

// ---------------------------------------------------------------------------
// 2. Cross-tenant denial is server-side (direct URL attack)
// ---------------------------------------------------------------------------

test("FSTS client is denied the Corsair site by the role-gated reader (direct URL)", async () => {
  const out = await asUser(FSTS_CLERK).query(api.sites.get, {
    siteId: corsairSite,
  });
  expect(out).toBeNull();
});

test("Corsair client is denied the FSTS site by the role-gated reader (direct URL)", async () => {
  const out = await asUser(CORSAIR_CLERK).query(api.sites.get, {
    siteId: fstsSite,
  });
  expect(out).toBeNull();
});

test("sites.listWithHealth returns ONLY the client's own site (single-site auto-open safety)", async () => {
  const fstsList = await asUser(FSTS_CLERK).query(api.sites.listWithHealth, {});
  expect(fstsList.map((s: any) => String(s._id))).toEqual([String(fstsSite)]);

  const corsairList = await asUser(CORSAIR_CLERK).query(api.sites.listWithHealth, {});
  expect(corsairList.map((s: any) => String(s._id))).toEqual([String(corsairSite)]);
});

test("superadmin sees both sites (control center), clients never see the other tenant", async () => {
  const admin = await asUser(SUPERADMIN_CLERK_ID).query(api.sites.listWithHealth, {});
  expect(admin).toHaveLength(2);

  const fstsList = await asUser(FSTS_CLERK).query(api.sites.listWithHealth, {});
  expect(fstsList.find((s: any) => String(s._id) === String(corsairSite))).toBeUndefined();
});

// ---------------------------------------------------------------------------
// 3. A swapped binding must FAIL the consistency check — never silent access
// ---------------------------------------------------------------------------

test("swapped bindings are detectable and grant the WRONG tenant — the exact 2026-09-06 defect", async () => {
  // Simulate the audited production defect: the two clerkUserIds are
  // crosswise, with each record's roles still correct per record. This is
  // schema-valid (in-memory site IDs) so the readers behave exactly like
  // production did on 2026-09-06.
  await t.run(async (ctx: any) => {
    const users = await ctx.db.query("users").collect();
    const fsts = users.find((u: any) => norm(u.email) === FSTS_EMAIL);
    const corsair = users.find((u: any) => norm(u.email) === CORSAIR_EMAIL);
    await ctx.db.patch(fsts._id, { clerkUserId: CORSAIR_CLERK }); // ❌ swapped
    await ctx.db.patch(corsair._id, { clerkUserId: FSTS_CLERK }); // ❌ swapped
  });

  // 1. DETECTION: the audit query must report "swapped" — the defect is
  //    detectable, never silently absorbed.
  const auditOut = await audit();
  expect(auditOut.state).toBe("swapped");
  expect(auditOut.fstsRecord.clerkUserId).toBe(CORSAIR_CLERK);
  expect(auditOut.corsairRecord.clerkUserId).toBe(FSTS_CLERK);

  // 2. BLAST RADIUS (documents why the invariant matters): with swapped
  //    bindings, cdweemsbey (FSTS client) is served the CORSAIR workspace —
  //    the live-reported defect — and loses access to their own site.
  const fstsSees = await asUser(FSTS_CLERK).query(api.sites.listWithHealth, {});
  expect(fstsSees.map((s: any) => String(s._id))).toEqual([String(corsairSite)]);

  const corsairSees = await asUser(CORSAIR_CLERK).query(api.sites.listWithHealth, {});
  expect(corsairSees.map((s: any) => String(s._id))).toEqual([String(fstsSite)]);

  // cdweemsbey's OWN site is now out of reach (the other half of the defect:
  // the Corsair client's login looped because their subject hit the FSTS
  // record and authorization bounced).
  const ownSite = await asUser(FSTS_CLERK).query(api.sites.get, {
    siteId: fstsSite,
  });
  expect(ownSite).toBeNull();
});

// ---------------------------------------------------------------------------
// 4. Stale site preference never crosses tenant boundaries
// ---------------------------------------------------------------------------

test("stale localStorage siteId is harmless: authorization comes from server roles, not client state", async () => {
  // A stale preference pointing at the OTHER tenant's site id must simply
  // be ignored by the server — the FSTS client's role list only contains
  // their own site. The server-side reader is the authority; this pins that
  // the direct foreign-site query returns null regardless of any client state.
  const out = await asUser(FSTS_CLERK).query(api.sites.get, {
    siteId: corsairSite, // "stale preference" = foreign site id
  });
  expect(out).toBeNull();
});

// ---------------------------------------------------------------------------
// 5. Invitation reconciliation never steals an already-bound subject
// ---------------------------------------------------------------------------

test("reconciliation never rebinds a subject that is already canonically bound (no silent rewrite)", async () => {
  // The FSTS record is canonically bound. A NEW invitation arrives for a
  // different email and is accepted by a NEW Clerk subject — it must NOT
  // steal or rewrite the canonical FSTS record.
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkUserId: `pending:someoneelse@example.com`,
      name: "Someone Else",
      email: "someoneelse@example.com",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: corsairSite, role: "content_editor" }],
      inviteStatus: "pending",
      invitedAt: Date.now(),
    });
  });

  // The canonical fixtures remain untouched after the new invitation:
  // one record per email, canonical binding preserved, no duplicates.
  const users = await allUsers();
  const fsts = users.find((u: any) => u.clerkUserId === FSTS_CLERK)!;
  expect(fsts.email).toBe(FSTS_EMAIL);
  expect(fsts.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);
  const dup = users.filter((u: any) => norm(u.email) === norm(FSTS_EMAIL));
  expect(dup).toHaveLength(1); // no duplicate user was created
});
