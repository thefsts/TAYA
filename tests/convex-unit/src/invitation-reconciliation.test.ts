/**
 * Invitation Reconciliation & First-Login Provisioning — TAYA™
 *
 * Regression suite for the "invited client signs in but sees no site" defect.
 *
 * ROOT CAUSE (production evidence): Clerk's default session-token claims
 * contain only `sub`/`sid` — email is NOT a default claim. The dashboard's
 * Convex provider fetches tokens through the Clerk "convex" JWT template;
 * when that template carries no email claim, the authenticated identity has
 * NO email and `provisionUser` fell back to `<subject>@unknown.local`,
 * missing the `pending:<email>` invitation rebind and inserting a duplicate
 * user with EMPTY roles. The client's site assignments stayed stranded on the
 * pending invitation record, so `sites.listWithHealth` returned nothing and
 * the dashboard showed "Your website workspace has not been assigned yet".
 *
 * The tests below run the REAL provisionUser (via users.provisionMe /
 * users.provisionMeVerified) against an in-memory Convex backend (convex-test)
 * with identities that reproduce the production state, and prove the
 * reconciliation contract:
 *
 *   ✓ invited client with an email claim is rebound to their ONE pending
 *     invitation on first login — roles/active/invitation history preserved,
 *     no duplicate user created
 *   ✓ invited client whose record has been hit twice (orphan user + separate
 *     pending invitation) is MERGED on the next verified sign-in — the
 *     invitation row is kept (roles preserved), the orphan retired
 *   ✓ the orphan rows production actually produced (clerkUserId == subject,
 *     fallback email, empty roles) are repaired via the repeat sign-in
 *     (`existing`) path — this was the dead-code gap in the first fix
 *   ✓ sites.listWithHealth returns the client's assigned site after repair
 *     (the exact production symptom is gone)
 *   ✓ a claimless random signup can NEVER claim someone's pending invitation
 *   ✓ ambiguous matches (two pending invitations with the same email) fail
 *     safely with an actionable error, never a cross-tenant guess
 *   ✓ deactivated invitations are never rebound (fail closed)
 *   ✓ claimless sign-in with multiple pending invitations and no trusted
 *     email fails safely instead of creating another anonymous record
 *   ✓ users.provisionMeVerified verifies via the Clerk Backend API when the
 *     JWT has no email claim (verified primary email trusted; unverified
 *     rejected; CLERK_SECRET_KEY missing continues claimless)
 *   ✓ a client NEVER gains another client's roles (tenant isolation at the
 *     provisioning layer)
 *   ✓ the existing public mutation stays compatible (idempotent repeat calls)
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Constants matching production env ──────────────────────────────────────

const OWNER_EMAIL = "c.weems@fstacktsolutions.com";
const OWNER_CLERK_ID = "user_3Ihbu2ARStHHHdQiro5oDz8tLXr";
const QA_EMAIL = "justinthomas4@gmail.com";
const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const FSTS_CLIENT_EMAIL = "cdweemsbey@gmail.com";

// The real production Clerk subjects of the two broken clients (orphan rows:
// clerkUserId == subject, fallback @unknown.local email, empty roles).
const CORSAIR_CLERK_ID = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const FSTS_CLIENT_CLERK_ID = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";

// ── Helpers ────────────────────────────────────────────────────────────────

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

function setEnv(overrides: {
  superAdminEmails?: string;
  superAdminClerkUserIds?: string;
  internalQaEmails?: string;
  clerkSecretKey?: string;
} = {}) {
  vi.stubEnv("SUPERADMIN_EMAILS", overrides.superAdminEmails ?? OWNER_EMAIL);
  vi.stubEnv(
    "SUPERADMIN_CLERK_USER_IDS",
    overrides.superAdminClerkUserIds ?? OWNER_CLERK_ID,
  );
  vi.stubEnv("INTERNAL_QA_EMAILS", overrides.internalQaEmails ?? "");
  if (overrides.clerkSecretKey !== undefined) {
    vi.stubEnv("CLERK_SECRET_KEY", overrides.clerkSecretKey);
  } else {
    vi.unstubAllEnvs();
    vi.stubEnv("SUPERADMIN_EMAILS", overrides.superAdminEmails ?? OWNER_EMAIL);
    vi.stubEnv(
      "SUPERADMIN_CLERK_USER_IDS",
      overrides.superAdminClerkUserIds ?? OWNER_CLERK_ID,
    );
    vi.stubEnv("INTERNAL_QA_EMAILS", overrides.internalQaEmails ?? "");
  }
}

/** Mock the Clerk Backend API GET /users/{id} used by provisionMeVerified. */
function mockClerkUserLookup(opts: {
  email: string;
  verified?: boolean;
  firstName?: string;
  lastName?: string;
}) {
  const payload = {
    id: "clerk-user",
    first_name: opts.firstName ?? null,
    last_name: opts.lastName ?? null,
    primary_email_address_id: "ema_1",
    email_addresses: [
      {
        id: "ema_1",
        email_address: opts.email,
        verification: { status: opts.verified === false ? "unverified" : "verified" },
      },
    ],
  };
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(payload), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let t: ReturnType<typeof convexTest>;
let corsairSite: Id<"sites">;
let fstsSite: Id<"sites">;

/** Seed the exact production shape: two live sites. */
async function seedSites() {
  await t.run(async (ctx) => {
    corsairSite = await ctx.db.insert("sites", siteDoc("Corsair Tactical Solutions", "corsair-tactical-solutions"));
    fstsSite = await ctx.db.insert("sites", siteDoc("FSTS Website", "fsts-website"));
  });
}

/** A pending invitation row exactly as production stored it. */
async function seedPendingInvitation(opts: {
  email: string;
  name: string;
  siteId: Id<"sites">;
  role?: string;
  isActive?: boolean;
  inviteStatus?: string;
  invitationLastError?: string;
}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: `pending:${opts.email}`,
      name: opts.name,
      email: opts.email,
      isSuperAdmin: false,
      isActive: opts.isActive ?? true,
      roles: [{ siteId: opts.siteId, role: opts.role ?? "owner" }],
      inviteStatus: opts.inviteStatus ?? "pending",
      invitedAt: 1788462369942,
      ...(opts.invitationLastError
        ? { invitationLastError: opts.invitationLastError }
        : {}),
    });
  });
}

/** An orphan user row exactly as production stored it (claimless first login). */
async function seedOrphanUser(opts: {
  subject: string;
  roles?: Array<{ siteId: Id<"sites">; role: string }>;
}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: opts.subject,
      name: opts.subject,
      email: `${opts.subject.toLowerCase()}@unknown.local`,
      isSuperAdmin: false,
      isActive: true,
      roles: opts.roles ?? [],
    });
  });
}

async function usersByEmail(email: string) {
  return await t.run(async (ctx) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).collect(),
  );
}

async function usersByClerkId(clerkUserId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .collect(),
  );
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  await seedSites();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── 1. First login with an email claim ─────────────────────────────────────

describe("provisionUser — invited client first login (email claim present)", () => {
  it("rebinds the single matching pending invitation and preserves everything", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
      role: "owner",
      inviteStatus: "pending",
    });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});

    // Site assignments, active status, and invitation history preserved.
    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);
    expect(me.isActive).toBe(true);
    expect(me.inviteStatus).toBe("pending");
    expect(me.invitedAt).toBe(1788462369942);
    expect(me.isSuperAdmin).toBe(false);

    // Exactly ONE Corsair record — no duplicate created.
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
    expect(rows[0].clerkUserId).toBe(CORSAIR_CLERK_ID);
    expect(await usersByClerkId(CORSAIR_CLERK_ID)).toHaveLength(1);
  });

  it("returns the client's assigned site in sites.listWithHealth after rebind", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    await as.mutation(api.users.provisionMe, {});

    const sites = await as.query(api.sites.listWithHealth, {});
    expect(sites).toHaveLength(1);
    expect(sites[0].slug).toBe("corsair-tactical-solutions");
  });

  it("does NOT rebind a pending invitation when the email does not match", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv();

    // A different human signing up claimlessly with no email match.
    const as = t.withIdentity({ subject: "user_randomsignup" });
    const me = await as.mutation(api.users.provisionMe, {});

    expect(me.isSuperAdmin).toBe(false);
    expect(me.roles).toEqual([]);
    // Steve's invitation is still waiting for HIM.
    const steveRows = await usersByEmail(CORSAIR_EMAIL);
    expect(steveRows).toHaveLength(1);
    expect(steveRows[0].clerkUserId).toBe(`pending:${CORSAIR_EMAIL}`);
  });

  it("gives a verified email with no matching invitation zero roles (no cross-tenant guess)", async () => {
    // Pending invitation exists only for the Corsair tenant; an FSTS-addressed
    // signup with a different email must never receive the Corsair roles.
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv();

    const as = t.withIdentity({ subject: "user_otherperson", email: FSTS_CLIENT_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});

    expect(me.roles).toEqual([]);
    const steveRows = await usersByEmail(CORSAIR_EMAIL);
    expect(steveRows).toHaveLength(1);
    expect(steveRows[0].clerkUserId).toBe(`pending:${CORSAIR_EMAIL}`);
  });

  it("never assigns a client another client's roles (email mismatch keeps both tenants isolated)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    await seedPendingInvitation({
      email: FSTS_CLIENT_EMAIL,
      name: "curtis Weems",
      siteId: fstsSite,
    });
    setEnv();

    const asCurtis = t.withIdentity({ subject: FSTS_CLIENT_CLERK_ID, email: FSTS_CLIENT_EMAIL });
    const curtis = await asCurtis.mutation(api.users.provisionMe, {});
    expect(curtis.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);

    const asSteve = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const steve = await asSteve.mutation(api.users.provisionMe, {});
    expect(steve.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);

    // Curtis's roles never bleed into Steve's record and vice versa.
    const sitesForSteve = await asSteve.query(api.sites.listWithHealth, {});
    expect(sitesForSteve.map((s: any) => s.slug)).toEqual(["corsair-tactical-solutions"]);
    const sitesForCurtis = await asCurtis.query(api.sites.listWithHealth, {});
    expect(sitesForCurtis.map((s: any) => s.slug)).toEqual(["fsts-website"]);
  });
});

// ── 2. Production orphan scenarios ─────────────────────────────────────────

describe("provisionUser — production orphan repair (claimless first sign-in already happened)", () => {
  it("merges the orphan + pending invitation on the next verified sign-in (existing path)", async () => {
    // Exact production state for the Corsair client:
    // - pending invitation row with the real roles
    // - orphan row with clerkUserId == subject, fallback email, empty roles
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
      role: "owner",
    });
    await seedOrphanUser({ subject: CORSAIR_CLERK_ID });
    setEnv();

    // Next sign-in carries the verified email (JWT claim or Backend API).
    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});

    // The invitation row was kept (roles/history/active preserved)...
    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);
    expect(me.isActive).toBe(true);
    expect(me.inviteStatus).toBe("pending");
    // ...and the orphan was retired.
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
    const bySubject = await usersByClerkId(CORSAIR_CLERK_ID);
    expect(bySubject).toHaveLength(1);
    expect(bySubject[0].email).toBe(CORSAIR_EMAIL);
    // No @unknown.local rows remain for this subject.
    const orphanRows = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q) =>
          q.eq("email", `${CORSAIR_CLERK_ID.toLowerCase()}@unknown.local`),
        )
        .collect(),
    );
    expect(orphanRows).toHaveLength(0);
  });

  it("merges the orphan + pending invitation via provisionMeVerified (action path)", async () => {
    await seedPendingInvitation({
      email: FSTS_CLIENT_EMAIL,
      name: "curtis Weems",
      siteId: fstsSite,
      role: "owner",
      inviteStatus: "failed",
      invitationLastError: "[CONVEX A(clerkInvitations:invite)] Server Error",
    });
    await seedOrphanUser({ subject: FSTS_CLIENT_CLERK_ID });
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    mockClerkUserLookup({ email: FSTS_CLIENT_EMAIL, firstName: "curtis" });

    // JWT carries NO email claim — the action must verify via Backend API.
    const as = t.withIdentity({ subject: FSTS_CLIENT_CLERK_ID });
    const me = await as.action(api.users.provisionMeVerified, {});

    expect(me.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);
    expect(me.isActive).toBe(true);
    // invitation history preserved (failed invite recorded for the operator)
    expect(me.inviteStatus).toBe("failed");
    expect(me.invitationLastError).toContain("Server Error");

    const rows = await usersByEmail(FSTS_CLIENT_EMAIL);
    expect(rows).toHaveLength(1);
    expect(rows[0].clerkUserId).toBe(FSTS_CLIENT_CLERK_ID);
  });

  it("merges when the orphan row itself is found by subject and the pending invitation is separate (first-login path)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    // Orphan whose clerkUserId is DIFFERENT from the subject: legacy data.
    await seedOrphanUser({ subject: "user_legacy_different_id" });
    setEnv();

    const as = t.withIdentity({ subject: "user_legacy_different_id", email: CORSAIR_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});

    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
  });

  it("repairs a no-invitation orphan by upgrading its fallback email when a trusted email arrives", async () => {
    // Steve already signed in claimlessly (orphan, no invitation exists).
    await seedOrphanUser({ subject: CORSAIR_CLERK_ID });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});

    expect(me.email).toBe(CORSAIR_EMAIL);
    expect(me.roles).toEqual([]);
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
    expect(rows[0].clerkUserId).toBe(CORSAIR_CLERK_ID);
  });
});

// ── 3. Fail-safes ──────────────────────────────────────────────────────────

describe("provisionUser — fail-safes and ambiguity guards", () => {
  it("fails safely when two pending invitations share the same email (first login)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — duplicate",
      siteId: fstsSite,
    });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      /multiple pending invitations exist for this email address/i,
    );
    // Neither invitation was touched.
    expect(await usersByEmail(CORSAIR_EMAIL)).toHaveLength(2);
  });

  it("fails safely when two pending invitations share the same email (orphan repair path)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — duplicate",
      siteId: fstsSite,
    });
    await seedOrphanUser({ subject: CORSAIR_CLERK_ID });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      /multiple pending invitations exist for this email address/i,
    );
    expect(await usersByEmail(CORSAIR_EMAIL)).toHaveLength(2);
  });

  it("never rebinds a deactivated invitation (fails closed)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
      isActive: false,
    });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      "Account is deactivated",
    );
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
    expect(rows[0].clerkUserId).toBe(`pending:${CORSAIR_EMAIL}`);
  });

  it("fails safely on claimless sign-in with multiple pending invitations", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    await seedPendingInvitation({
      email: FSTS_CLIENT_EMAIL,
      name: "curtis Weems",
      siteId: fstsSite,
    });
    setEnv();

    // Claimless identity: no email claim, no server-side verification.
    const as = t.withIdentity({ subject: "user_unknown_claimless" });
    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      /no verified email and multiple pending invitations exist/i,
    );
  });

  it("does not create a second user when the email already belongs to a different Clerk identity", async () => {
    // Steve is already connected under one Clerk ID...
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_steve_old_id",
        name: "Steve — Corsair Tactical",
        email: CORSAIR_EMAIL,
        isSuperAdmin: false,
        isActive: true,
        roles: [{ siteId: corsairSite, role: "owner" }],
      });
    });
    setEnv();

    // ...and a DIFFERENT Clerk identity signs in with the same email.
    const as = t.withIdentity({ subject: "user_attacker", email: CORSAIR_EMAIL });
    await expect(as.mutation(api.users.provisionMe, {})).rejects.toThrow(
      "Account already exists with a different authentication identity",
    );
    expect(await usersByEmail(CORSAIR_EMAIL)).toHaveLength(1);
  });

  it("is idempotent — a repeat provisionMe call for the same identity is a no-op", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const first = await as.mutation(api.users.provisionMe, {});
    const second = await as.mutation(api.users.provisionMe, {});

    expect(second._id).toBe(first._id);
    expect(await usersByEmail(CORSAIR_EMAIL)).toHaveLength(1);
  });
});

// ── 4. provisionMeVerified action (server-side verification) ───────────────

describe("users.provisionMeVerified — server-side email verification", () => {
  it("uses the JWT email claim when present (no Backend API call)", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const me = await as.action(api.users.provisionMeVerified, {});

    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies a claimless identity through the Clerk Backend API and rebinds", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    const fetchMock = mockClerkUserLookup({
      email: CORSAIR_EMAIL,
      firstName: "Steve",
      lastName: "Corsair",
    });

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID });
    const me = await as.action(api.users.provisionMeVerified, {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);
    // The invitation's admin-set display name is preserved on rebind;
    // cosmetic name repair only applies to subject-seeded/placeholder names.
    expect(me.name).toBe("Steve — Corsair Tactical");
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
  });

  it("rejects an UNVERIFIED primary email instead of trusting it", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    mockClerkUserLookup({ email: CORSAIR_EMAIL, verified: false });

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID });
    await expect(as.action(api.users.provisionMeVerified, {})).rejects.toThrow(
      /not verified/i,
    );
    // The invitation was NOT rebound to an unverified identity.
    const rows = await usersByEmail(CORSAIR_EMAIL);
    expect(rows).toHaveLength(1);
    expect(rows[0].clerkUserId).toBe(`pending:${CORSAIR_EMAIL}`);
  });

  it("continues claimless (fail-safe) when CLERK_SECRET_KEY is not configured", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
    });
    // No CLERK_SECRET_KEY: production's current state.
    setEnv({ clerkSecretKey: "" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const as = t.withIdentity({ subject: "user_fresh_client" });
    // Must NOT throw (sign-in is never blocked) and must NOT claim Steve's
    // invitation — the claimless guard applies with a single pending record.
    const me = await as.action(api.users.provisionMeVerified, {});

    expect(me.roles).toEqual([]);
    const steveRows = await usersByEmail(CORSAIR_EMAIL);
    expect(steveRows).toHaveLength(1);
    expect(steveRows[0].clerkUserId).toBe(`pending:${CORSAIR_EMAIL}`);
  });

  it("provisions a trusted-verified email even when NO invitation exists (normal self-signup)", async () => {
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    mockClerkUserLookup({ email: "newperson@example.com", firstName: "New" });

    const as = t.withIdentity({ subject: "user_newperson" });
    const me = await as.action(api.users.provisionMeVerified, {});

    expect(me.email).toBe("newperson@example.com");
    expect(me.isSuperAdmin).toBe(false);
    expect(me.roles).toEqual([]);
    expect(me.name).toBe("New");
  });
});

// ── 5. Compatibility & the legacy superadmin/QA paths stay intact ──────────

describe("provisionUser — legacy superadmin/QA behavior unchanged", () => {
  it("provisions the owner allowlist identity as superadmin (no email claim)", async () => {
    setEnv();
    const as = t.withIdentity({ subject: OWNER_CLERK_ID });
    const me = await as.mutation(api.users.provisionMe, {});
    expect(me.isSuperAdmin).toBe(true);
    expect(me.email).toBe(OWNER_EMAIL);
  });

  it("provisions an internal QA identity with internal_qa roles on every site", async () => {
    setEnv({ internalQaEmails: QA_EMAIL });
    const as = t.withIdentity({ subject: "user_qa", email: QA_EMAIL });
    const me = await as.mutation(api.users.provisionMe, {});
    expect(me.isSuperAdmin).toBe(false);
    expect(me.roles.map((r: any) => r.role)).toEqual(["internal_qa", "internal_qa"]);
    expect(me.roles.map((r: any) => String(r.siteId)).sort()).toEqual(
      [String(corsairSite), String(fstsSite)].sort(),
    );
  });

  it("keeps superadmin fallback recovery working (existing record + allowlist subject)", async () => {
    // The owner's pre-existing @unknown.local fallback row (production
    // rd7an728... was recovered exactly this way).
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
    setEnv();

    const as = t.withIdentity({ subject: OWNER_CLERK_ID });
    const me = await as.mutation(api.users.provisionMe, {});
    expect(me.isSuperAdmin).toBe(true);
    expect(me.email).toBe(OWNER_EMAIL);
    expect(await usersByEmail(OWNER_EMAIL)).toHaveLength(1);
  });

  it("leaves the public provisionMe mutation compatible for existing callers", async () => {
    setEnv();
    const as = t.withIdentity({ subject: "user_plain", email: "plain@example.com" });
    const me = await as.mutation(api.users.provisionMe, {});
    expect(me.email).toBe("plain@example.com");
    expect(me.isSuperAdmin).toBe(false);

    // Repeat call is a no-op.
    const again = await as.mutation(api.users.provisionMe, {});
    expect(again._id).toBe(me._id);
  });
});

// ── 6. The production symptom end-to-end ──────────────────────────────────

describe("invitation reconciliation — the production symptom, end-to-end", () => {
  it("a claimless invited client who already signed in gets their site after the fix", async () => {
    // BEFORE: pending invitation + orphan from the claimless first sign-in.
    await seedPendingInvitation({
      email: FSTS_CLIENT_EMAIL,
      name: "curtis Weems",
      siteId: fstsSite,
      role: "owner",
      inviteStatus: "failed",
      invitationLastError: "[CONVEX A(clerkInvitations:invite)] Server Error",
    });
    await seedOrphanUser({ subject: FSTS_CLIENT_CLERK_ID });
    setEnv({ clerkSecretKey: "sk_test_clerk_secret" });
    mockClerkUserLookup({ email: FSTS_CLIENT_EMAIL, firstName: "curtis" });

    // BEFORE the fix: the claimless identity sees nothing.
    const as = t.withIdentity({ subject: FSTS_CLIENT_CLERK_ID });
    const before = await as.query(api.sites.listWithHealth, {});
    expect(before).toHaveLength(0);

    // AFTER: the verified action reconciles the account...
    const me = await as.action(api.users.provisionMeVerified, {});
    expect(me.roles).toEqual([{ siteId: fstsSite, role: "owner" }]);

    // ...and the dashboard now lists the assigned site.
    const after = await as.query(api.sites.listWithHealth, {});
    expect(after).toHaveLength(1);
    expect(after[0].slug).toBe("fsts-website");
  });

  it("a claimless invited client who already signed in gets their site via the JWT email claim", async () => {
    await seedPendingInvitation({
      email: CORSAIR_EMAIL,
      name: "Steve — Corsair Tactical",
      siteId: corsairSite,
      role: "owner",
    });
    await seedOrphanUser({ subject: CORSAIR_CLERK_ID });
    setEnv();

    const as = t.withIdentity({ subject: CORSAIR_CLERK_ID, email: CORSAIR_EMAIL });
    const before = await as.query(api.sites.listWithHealth, {});
    expect(before).toHaveLength(0);

    const me = await as.mutation(api.users.provisionMe, {});
    expect(me.roles).toEqual([{ siteId: corsairSite, role: "owner" }]);

    const after = await as.query(api.sites.listWithHealth, {});
    expect(after).toHaveLength(1);
    expect(after[0].slug).toBe("corsair-tactical-solutions");
  });
});
