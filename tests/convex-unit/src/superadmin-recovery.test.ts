/**
 * SuperAdmin Recovery & Provisioning Tests — FSTS-WOS™
 *
 * Runs the REAL `provisionUser` (via `users.provisionMe`) against an in-memory
 * Convex backend (convex-test). No mocks of the authorization layer. These
 * tests prove the safety properties of the SuperAdmin recovery path:
 *
 *   1. Owner email allowlist path — identity with a SUPERADMIN_EMAILS email
 *      is provisioned as isSuperAdmin=true.
 *   2. Owner Clerk user-ID allowlist path — identity with a
 *      SUPERADMIN_CLERK_USER_IDS subject (and no email claim) is provisioned
 *      as isSuperAdmin=true with the canonical superadmin email.
 *   3. Fallback @unknown.local recovery — an existing user record with a
 *      fallback @unknown.local email and isSuperAdmin=false is reconciled to
 *      isSuperAdmin=true and the canonical email when the owner signs in with
 *      the trusted Clerk user ID.
 *   4. Normal client Clerk ID cannot self-promote — a non-superadmin Clerk ID
 *      with a non-superadmin email is provisioned as isSuperAdmin=false.
 *   5. QA identity remains Internal QA — an INTERNAL_QA_EMAILS identity is
 *      provisioned as isSuperAdmin=false with internal_qa roles on all sites.
 *   6. SuperAdmin and Internal QA overlap fails closed — an email in both
 *      allowlists throws a configuration error.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Constants matching production env ───────────────────────────────────

const OWNER_EMAIL = "c.weems@fstacktsolutions.com";
const OWNER_CLERK_ID = "user_3Ihbu2ARStHHHdQiro5oDz8tLXr";
const QA_EMAIL = "justinthomas4@gmail.com";
const CLIENT_EMAIL = "corsairtacticalsolutions@gmail.com";
const CLIENT_CLERK_ID = "user_corsairclient123";

// ── Helpers ─────────────────────────────────────────────────────────────

function siteDoc(name: string, slug: string) {
  return {
    name,
    slug,
    status: "active" as const,
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: {},
  };
}

/**
 * Set the env vars that provisionUser reads. Tests can override individual
 * values before calling provisionMe.
 */
function setEnv(overrides: {
  superAdminEmails?: string;
  superAdminClerkUserIds?: string;
  internalQaEmails?: string;
} = {}) {
  vi.stubEnv("SUPERADMIN_EMAILS", overrides.superAdminEmails ?? OWNER_EMAIL);
  vi.stubEnv(
    "SUPERADMIN_CLERK_USER_IDS",
    overrides.superAdminClerkUserIds ?? OWNER_CLERK_ID,
  );
  vi.stubEnv("INTERNAL_QA_EMAILS", overrides.internalQaEmails ?? QA_EMAIL);
}

let t: ReturnType<typeof convexTest>;
let corsairSiteId: Id<"sites">;

beforeEach(async () => {
  setEnv();
  t = convexTest(schema, modules);
  corsairSiteId = await t.run(async (ctx) => {
    return await ctx.db.insert("sites", siteDoc("Corsair Tactical Solutions", "corsair-tactical-solutions"));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ──────────────────────────────────────────────────────────────────────────
// Test 1: Owner email allowlist path
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — Owner email allowlist path", () => {
  it("provisions a new user as SuperAdmin when the email is in SUPERADMIN_EMAILS", async () => {
    // Identity carries the owner's email claim directly.
    const as = t.withIdentity({
      subject: "user_newowner456",
      email: OWNER_EMAIL,
      name: "Platform Owner",
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(true);
    expect(result.email).toBe(OWNER_EMAIL);
    expect(result.isActive).toBe(true);
    expect(result.roles).toEqual([]);
  });

  it("reconciles an existing SuperAdmin user and keeps isSuperAdmin=true", async () => {
    // Seed an existing superadmin record with the owner's Clerk ID.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_existingowner789",
        name: "Platform Owner",
        email: OWNER_EMAIL,
        isSuperAdmin: true,
        isActive: true,
        roles: [],
      });
    });

    const as = t.withIdentity({
      subject: "user_existingowner789",
      email: OWNER_EMAIL,
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(true);
    expect(result.email).toBe(OWNER_EMAIL);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Test 2: Owner Clerk user-ID allowlist path
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — Owner Clerk user-ID allowlist path", () => {
  it("provisions as SuperAdmin via Clerk user ID even when no email claim is present", async () => {
    // Identity has the trusted Clerk subject but NO email claim — this is the
    // exact production scenario: Clerk JWT does not supply the email claim.
    const as = t.withIdentity({
      subject: OWNER_CLERK_ID,
      // No email field — simulates the missing email claim.
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(true);
    // The canonical email from SUPERADMIN_EMAILS should be used.
    expect(result.email).toBe(OWNER_EMAIL);
    expect(result.isActive).toBe(true);
    expect(result.roles).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Test 3: Fallback @unknown.local recovery
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — Fallback @unknown.local reconciliation", () => {
  it("reconciles an existing @unknown.local owner record to SuperAdmin with canonical email", async () => {
    // Seed the exact production state: owner record with fallback email,
    // isSuperAdmin=false, correct Clerk ID.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: OWNER_CLERK_ID,
        name: OWNER_CLERK_ID,
        email: `${OWNER_CLERK_ID.toLowerCase()}@unknown.local`,
        isSuperAdmin: false,
        isActive: true,
        roles: [],
      });
    });

    // Owner signs in — identity has the Clerk ID but no email claim.
    const as = t.withIdentity({
      subject: OWNER_CLERK_ID,
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(true);
    // The fallback @unknown.local email should be replaced with the canonical.
    expect(result.email).toBe(OWNER_EMAIL);
    expect(result.isActive).toBe(true);
    expect(result.roles).toEqual([]);
    expect(result.email).not.toContain("@unknown.local");
  });

  it("does not change the email of a non-fallback SuperAdmin record", async () => {
    // Seed a superadmin record that already has the correct email.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: OWNER_CLERK_ID,
        name: "Platform Owner",
        email: OWNER_EMAIL,
        isSuperAdmin: true,
        isActive: true,
        roles: [],
      });
    });

    const as = t.withIdentity({
      subject: OWNER_CLERK_ID,
      email: OWNER_EMAIL,
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(true);
    expect(result.email).toBe(OWNER_EMAIL);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Test 4: Normal client Clerk ID cannot self-promote
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — Normal client cannot self-promote", () => {
  it("provisions a normal client as isSuperAdmin=false", async () => {
    const as = t.withIdentity({
      subject: CLIENT_CLERK_ID,
      email: CLIENT_EMAIL,
      name: "Corsair Client",
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(false);
    expect(result.email).toBe(CLIENT_EMAIL);
    expect(result.isActive).toBe(true);
  });

  it("does not promote an existing client record to SuperAdmin on re-provision", async () => {
    // Seed an existing client record with a site role.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: CLIENT_CLERK_ID,
        name: "Corsair Client",
        email: CLIENT_EMAIL,
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: corsairSiteId, role: "client_admin" }],
      });
    });

    const as = t.withIdentity({
      subject: CLIENT_CLERK_ID,
      email: CLIENT_EMAIL,
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(false);
    expect(result.email).toBe(CLIENT_EMAIL);
    // Client role assignment preserved.
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].role).toBe("client_admin");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Test 5: QA identity remains Internal QA, not SuperAdmin
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — Internal QA identity stays Internal QA", () => {
  it("provisions a QA user as isSuperAdmin=false with internal_qa roles on all sites", async () => {
    // Add a second site so we can verify QA gets roles on ALL sites.
    const secondSiteId = await t.run(async (ctx) => {
      return await ctx.db.insert("sites", siteDoc("Second Site", "second-site"));
    });

    const as = t.withIdentity({
      subject: "user_qatester001",
      email: QA_EMAIL,
      name: "Justin QA",
    });

    const result = await as.mutation(api.users.provisionMe, {});

    expect(result.isSuperAdmin).toBe(false);
    expect(result.email).toBe(QA_EMAIL);
    expect(result.isActive).toBe(true);
    // QA should have internal_qa role on every site.
    expect(result.roles).toHaveLength(2);
    const roleAssignments = result.roles.map((r: any) => ({ siteId: String(r.siteId), role: r.role }));
    expect(roleAssignments).toContainEqual({ siteId: String(corsairSiteId), role: "internal_qa" });
    expect(roleAssignments).toContainEqual({ siteId: String(secondSiteId), role: "internal_qa" });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Test 6: SuperAdmin and Internal QA overlap fails closed
// ──────────────────────────────────────────────────────────────────────────

describe("SuperAdmin Recovery — SuperAdmin/QA overlap fails closed", () => {
  it("throws when an email is in both SUPERADMIN_EMAILS and INTERNAL_QA_EMAILS", async () => {
    // Configure the same email in both allowlists.
    setEnv({
      superAdminEmails: QA_EMAIL,
      internalQaEmails: QA_EMAIL,
    });

    const as = t.withIdentity({
      subject: "user_overlap001",
      email: QA_EMAIL,
    });

    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      /cannot be both SuperAdmin and Internal QA/i,
    );
  });

  it("throws when a Clerk ID is trusted as SuperAdmin but the email is also in INTERNAL_QA_EMAILS", async () => {
    // The Clerk ID is in SUPERADMIN_CLERK_USER_IDS, and the email claim
    // (which may or may not be present) is in INTERNAL_QA_EMAILS.
    setEnv({
      superAdminEmails: OWNER_EMAIL,
      superAdminClerkUserIds: OWNER_CLERK_ID,
      internalQaEmails: OWNER_EMAIL,
    });

    const as = t.withIdentity({
      subject: OWNER_CLERK_ID,
      email: OWNER_EMAIL,
    });

    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      /cannot be both SuperAdmin and Internal QA/i,
    );
  });
});
