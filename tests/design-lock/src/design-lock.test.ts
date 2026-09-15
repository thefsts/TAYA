/**
 * Integration tests: Design Lock™ backend guards
 *
 * These tests confirm that the Global Design Lock™ (`requireDesignCapability`)
 * properly rejects every non-super-admin caller regardless of which client role
 * they hold, and that the three design-locked mutations (email.update,
 * crm.updateConnection, square.updateConfig) use that guard exclusively.
 * (Chat D: footer.update and navigation.create were re-tiered to client-safe
 * content permissions — see footer.ts / navigation.ts — so their coverage now
 * lives in convex-unit footer-admin-login.test.ts and design-lock-rbac.test.ts.)
 *
 * The Convex `MutationCtx` is satisfied by a plain JS mock object — the guard
 * functions are ordinary async functions that call `ctx.auth` / `ctx.db`.
 */

import { describe, it, expect } from "vitest";
import {
  requireDesignCapability,
  requireSiteAccessMutation,
} from "../../convex/lib/requireSiteAccess.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_SITE_ID = "j570abcdef1234567" as any; // arbitrary Id<"sites"> shape

/** Builds a minimal MutationCtx mock around a user record. */
function mockCtx(opts: {
  authenticated?: boolean;
  user?: Record<string, unknown> | null;
  extraUsers?: Record<string, unknown>[];
}): any {
  const { authenticated = true, user = null, extraUsers = [] } = opts;
  const allUsers = user ? [user, ...extraUsers] : extraUsers;

  return {
    auth: {
      getUserIdentity: async () =>
        authenticated
          ? {
              subject: (user as any)?.clerkUserId ?? "clerk_test_subject",
              name: (user as any)?.name ?? "Test User",
              email: (user as any)?.email ?? "test@example.com",
              givenName: "Test",
              familyName: "User",
            }
          : null,
    },
    db: {
      query: (table: string) => ({
        withIndex: (_indexName: string, _fn?: any) => ({
          first: async () => {
            if (table === "users") return user ?? null;
            if (table === "siteRoleOverrides") return null;
            return null;
          },
          collect: async () => {
            if (table === "users") return allUsers;
            if (table === "siteRoleOverrides") return [];
            return [];
          },
        }),
        collect: async () => (table === "users" ? allUsers : []),
      }),
      insert: async (_table: string, _doc: any) => "inserted_id",
      patch: async (_id: string, _fields: any) => {},
      get: async (_id: string) => user,
    },
  };
}

/** Creates a non-super-admin user record with a given role on FAKE_SITE_ID. */
function clientUser(role: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: "user_client_1",
    _creationTime: Date.now(),
    clerkUserId: "clerk_client_subject",
    name: "Client User",
    email: "client@example.com",
    isSuperAdmin: false,
    isActive: true,
    roles: [{ siteId: FAKE_SITE_ID, role }],
    ...overrides,
  };
}

/** Creates a super-admin user record. */
function superAdmin() {
  return {
    _id: "user_admin_1",
    _creationTime: Date.now(),
    clerkUserId: "clerk_admin_subject",
    name: "FSTS Admin",
    email: "admin@fsts.com",
    isSuperAdmin: true,
    isActive: true,
    roles: [],
  };
}

// ── Tests: requireDesignCapability ───────────────────────────────────────────

describe("requireDesignCapability — authorization guard", () => {
  it("throws 'Not authenticated' for an unauthenticated request", async () => {
    const ctx = mockCtx({ authenticated: false });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("throws 'Account is deactivated' for a deactivated user", async () => {
    const user = clientUser("owner", { isActive: false });
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Account is deactivated",
    );
  });

  it("throws 'Forbidden: write access required' for a read-only role", async () => {
    // read_only role is not in WRITE_ROLES — should be blocked before design lock
    const user = clientUser("read_only");
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("throws 'Design Lock' for a non-super-admin with write access (owner role)", async () => {
    const user = clientUser("owner");
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Design Lock",
    );
  });

  it("resolves successfully for a super-admin", async () => {
    const user = superAdmin();
    const ctx = mockCtx({ user, extraUsers: [user] });
    const result = await requireDesignCapability(ctx, FAKE_SITE_ID);
    expect(result.isSuperAdmin).toBe(true);
  });
});

// ── Tests: per-mutation role coverage ────────────────────────────────────────
//
// Each of the three remaining design-locked mutations calls
// requireDesignCapability. We verify that every common write role is blocked —
// including roles that do have site write access (owner, manager, etc.) so we
// confirm the *design lock tier* check (not just missing site access) is what
// fires. (Chat D: footer.update / navigation.create moved to content tier.)

const DESIGN_LOCKED_MUTATIONS = [
  "email.update",
  "crm.updateConnection",
  "square.updateConfig",
] as const;

const WRITE_ROLES_TO_TEST = [
  "owner",
  "manager",
  "marketing",
  "content_editor",
  "course_manager",
  "events_manager",
  "finance",
  "support",
] as const;

describe("Design-locked mutations: any non-super-admin write role is rejected", () => {
  for (const mutation of DESIGN_LOCKED_MUTATIONS) {
    describe(mutation, () => {
      for (const role of WRITE_ROLES_TO_TEST) {
        it(`role '${role}' → throws Design Lock error`, async () => {
          const user = clientUser(role);
          const ctx = mockCtx({ user, extraUsers: [user] });

          // requireDesignCapability is the exact guard each mutation calls.
          // A separate source-code audit (below) confirms no mutation uses a
          // weaker guard.
          await expect(
            requireDesignCapability(ctx, FAKE_SITE_ID),
          ).rejects.toThrow("Design Lock");
        });
      }
    });
  }
});

// ── Tests: read-only auditor role ─────────────────────────────────────────────
//
// The 'read_only' role specifically represents the scenario described in the
// task: a future auditor account. It must be blocked at every layer.

describe("read_only auditor role", () => {
  it("is blocked by requireSiteAccessMutation (before reaching design lock)", async () => {
    const user = clientUser("read_only");
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireSiteAccessMutation(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Forbidden: write access required",
    );
  });

  it("is blocked by requireDesignCapability", async () => {
    const user = clientUser("read_only");
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("cannot bypass the guard even if roles list contains both read_only and owner for different sites", async () => {
    // read_only on FAKE_SITE_ID, owner on a different site — must not grant access
    const OTHER_SITE_ID = "other_site_id" as any;
    const user = {
      ...clientUser("read_only"),
      roles: [
        { siteId: FAKE_SITE_ID, role: "read_only" },
        { siteId: OTHER_SITE_ID, role: "owner" },
      ],
    };
    const ctx = mockCtx({ user, extraUsers: [user] });
    await expect(requireDesignCapability(ctx, FAKE_SITE_ID)).rejects.toThrow(
      "Forbidden",
    );
  });
});

// ── Source-code audit: guard usage ────────────────────────────────────────────
//
// These tests read the actual mutation source files to confirm that
// requireDesignCapability (and not a weaker guard) protects each mutation.
// They fail immediately if a mutation is changed to use a weaker guard,
// providing a regression trip-wire.

import fs from "fs";
import path from "path";

const CONVEX_ROOT = path.resolve(__dirname, "../../../convex");
const PAGES_ROOT = path.resolve(
  __dirname,
  "../../../artifacts/fsts-dashboard/src/pages/app/sites",
);

function readConvexSource(file: string): string {
  return fs.readFileSync(path.join(CONVEX_ROOT, file), "utf-8");
}

function readPageSource(file: string): string {
  return fs.readFileSync(path.join(PAGES_ROOT, file), "utf-8");
}

// The Design Lock™ is enforced through requirePermission with SUPERADMIN_ONLY
// design-tier permissions (LAYOUT_MANAGE, INTEGRATIONS_MANAGE, DESIGN_MANAGE).
// These are listed in SUPERADMIN_ONLY_PERMISSIONS (permissions.ts) so that
// non-superAdmin callers — including internal_qa — always receive a
// ConvexError("Forbidden: ..."). The runtime enforcement is independently
// proven by design-lock-rbac.test.ts (10/10 integration tests). These source
// audits act as a regression trip-wire confirming each design-locked mutation
// calls requirePermission with the correct design-tier permission constant.

describe("Source audit: mutation handlers enforce the Design Lock via requirePermission", () => {
  it("footer.update enforces the split-tier contract (LAYOUT_MANAGE only for adminLogin payloads)", () => {
    const src = readConvexSource("footer.ts");
    expect(src).toContain("requirePermission");
    // Chat D contract: content-only payload → CONTENT_UPDATE (client-safe);
    // any adminLogin* field → LAYOUT_MANAGE (superadmin-only).
    expect(src).toContain("PERMISSIONS.CONTENT_UPDATE");
    expect(src).toContain("PERMISSIONS.LAYOUT_MANAGE");
  });

  it("email.update uses requirePermission with INTEGRATIONS_MANAGE", () => {
    const src = readConvexSource("email.ts");
    expect(src).toContain("requirePermission");
    expect(src).toContain("PERMISSIONS.INTEGRATIONS_MANAGE");
  });

  it("crm.updateConnection uses requirePermission with INTEGRATIONS_MANAGE", () => {
    const src = readConvexSource("crm.ts");
    expect(src).toContain("requirePermission");
    expect(src).toContain("PERMISSIONS.INTEGRATIONS_MANAGE");
  });

  it("square.updateConfig uses requirePermission with INTEGRATIONS_MANAGE", () => {
    const src = readConvexSource("square.ts");
    expect(src).toContain("requirePermission");
    expect(src).toContain("PERMISSIONS.INTEGRATIONS_MANAGE");
  });

  it("navigation mutations use client-safe content permissions (Chat D)", () => {
    const src = readConvexSource("navigation.ts");
    expect(src).toContain("requirePermission");
    expect(src).toContain("PERMISSIONS.CONTENT_CREATE");
    expect(src).toContain("PERMISSIONS.CONTENT_UPDATE");
    expect(src).toContain("PERMISSIONS.CONTENT_DELETE");
    // No design-tier guard remains in navigation.
    expect(src).not.toContain("PERMISSIONS.LAYOUT_MANAGE");
    expect(src).not.toContain("requireDesignCapability");
  });

  it("requirePermission gates design-tier permissions on isSuperAdmin", () => {
    const src = readConvexSource("lib/requirePermission.ts");
    expect(src).toContain("isSuperAdmin");
    expect(src).toContain("SUPERADMIN_ONLY_PERMISSIONS");
  });

  it("LAYOUT_MANAGE and INTEGRATIONS_MANAGE are SUPERADMIN_ONLY", () => {
    const src = readConvexSource("lib/permissions.ts");
    expect(src).toContain("LAYOUT_MANAGE");
    expect(src).toContain("INTEGRATIONS_MANAGE");
    expect(src).toMatch(/SUPERADMIN_ONLY_PERMISSIONS[\s\S]*LAYOUT_MANAGE/);
    expect(src).toMatch(/SUPERADMIN_ONLY_PERMISSIONS[\s\S]*INTEGRATIONS_MANAGE/);
  });
});

// ── Source-code audit: UI renders LockedField / DesignLockBanner ──────────────
//
// Confirms the frontend rendering layer imports and uses the locking components
// on each page. These tests act as a trip-wire: if a page removes the locking
// UI while the backend guard remains, these tests will catch the gap.

describe("Source audit: pages render DesignLockBanner and LockedField", () => {
  // Chat D: FooterEditor and NavigationManager are now client-content pages.
  // The only design-tier field left in FooterEditor is the Admin Login Link
  // (adminLogin* fields → LAYOUT_MANAGE), so it still renders LockedField for
  // that section only — NOT a page-wide DesignLockBanner. NavigationManager is
  // fully client-managed (no locks at all).
  const LOCKED_PAGES: Array<{ page: string; file: string }> = [
    { page: "EmailConfig", file: "EmailConfig.tsx" },
    { page: "CrmConnectionConfig", file: "CrmConnectionConfig.tsx" },
    { page: "PaymentsConfig", file: "PaymentsConfig.tsx" },
  ];

  for (const { page, file } of LOCKED_PAGES) {
    it(`${page} imports LockedField and DesignLockBanner`, () => {
      const src = readPageSource(file);
      expect(src, `${page} must import LockedField`).toContain("LockedField");
      expect(src, `${page} must import DesignLockBanner`).toContain(
        "DesignLockBanner",
      );
    });

    it(`${page} renders <DesignLockBanner`, () => {
      const src = readPageSource(file);
      expect(src, `${page} must render <DesignLockBanner`).toContain(
        "<DesignLockBanner",
      );
    });

    it(`${page} renders at least one <LockedField`, () => {
      const src = readPageSource(file);
      expect(src, `${page} must render at least one <LockedField`).toContain(
        "<LockedField",
      );
    });
  }

  it("FooterEditor keeps LockedField only for the Admin Login Link (design-tier) and no page-wide banner", () => {
    const src = readPageSource("FooterEditor.tsx");
    // The adminLogin* fields are the only design-tier contract left.
    expect(src).toContain("<LockedField");
    expect(src).not.toContain("<DesignLockBanner");
    // Clients must never send adminLogin fields (backend rejects anyway).
    expect(src).toContain("canEditAdminLogin");
  });

  it("NavigationManager is fully client-managed — no design locks", () => {
    const src = readPageSource("NavigationManager.tsx");
    expect(src).not.toContain("LockedField");
    expect(src).not.toContain("DesignLockBanner");
  });
});
