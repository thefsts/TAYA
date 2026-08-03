/**
 * Design-Lock RBAC Integration Tests — FSTS-WOS™
 *
 * Runs the REAL Convex mutation handlers against an in-memory convex-test
 * backend (no mocks of requirePermission or rolePermissions). These tests
 * prove that a future refactor of the RBAC enforcement path cannot silently
 * break the design-lock:
 *
 *   1. A content_editor (client role) calling a LAYOUT_MANAGE-gated mutation
 *      (api.navigation.create) receives ConvexError("Forbidden: …").
 *   2. A content_editor calling a DESIGN_MANAGE-gated mutation
 *      (api.siteSettings.updateBranding) receives ConvexError("Forbidden: …").
 *   3. A content_editor calling an INTEGRATIONS_MANAGE-gated mutation
 *      (api.siteSettings.updateIntegrations) receives ConvexError("Forbidden: …").
 *   4. An owner (highest client role) is still blocked by all three guards.
 *   5. A superAdmin calling the same three mutations succeeds.
 *   6. A content_editor CAN call a CONTENT_UPDATE-gated mutation
 *      (api.siteSettings.updateSeo) — confirms non-design permissions still work.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Seed helpers ─────────────────────────────────────────────────────────────

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

type Seeded = { siteId: Id<"sites"> };

async function seed(t: ReturnType<typeof convexTest>): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", siteDoc("Test Site", "test-site-rbac"));

    // Seed users BEFORE any function call so provisionUser never accidentally
    // bootstraps a first-user superadmin.
    await ctx.db.insert("users", {
      clerkUserId: "superadmin",
      name: "FSTS Admin",
      email: "admin@fsts.test",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });

    // content_editor — full content + media CRUD, zero design-tier permissions.
    await ctx.db.insert("users", {
      clerkUserId: "content_editor_user",
      name: "Content Editor",
      email: "editor@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId, role: "content_editor" }],
    });

    // owner — highest client role; also must not pass design-tier guards.
    await ctx.db.insert("users", {
      clerkUserId: "owner_user",
      name: "Site Owner",
      email: "owner@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId, role: "owner" }],
    });

    return { siteId };
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await seed(t);
});

// ── Helper: typed caller ──────────────────────────────────────────────────────

const asEditor  = () => t.withIdentity({ subject: "content_editor_user" });
const asOwner   = () => t.withIdentity({ subject: "owner_user" });
const asAdmin   = () => t.withIdentity({ subject: "superadmin" });

// ── 1. content_editor is blocked by LAYOUT_MANAGE guard ──────────────────────

describe("content_editor calling LAYOUT_MANAGE-gated mutation (navigation.create)", () => {
  it("throws ConvexError containing 'Forbidden'", async () => {
    await expect(
      asEditor().mutation(api.navigation.create, {
        siteId: s.siteId,
        label: "Home",
        href: "/",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ── 2. content_editor is blocked by DESIGN_MANAGE guard ──────────────────────

describe("content_editor calling DESIGN_MANAGE-gated mutation (siteSettings.updateBranding)", () => {
  it("throws ConvexError containing 'Forbidden'", async () => {
    await expect(
      asEditor().mutation(api.siteSettings.updateBranding, {
        siteId: s.siteId,
        brandColorPrimary: "#ff0000",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ── 3. content_editor is blocked by INTEGRATIONS_MANAGE guard ────────────────

describe("content_editor calling INTEGRATIONS_MANAGE-gated mutation (siteSettings.updateIntegrations)", () => {
  it("throws ConvexError containing 'Forbidden'", async () => {
    await expect(
      asEditor().mutation(api.siteSettings.updateIntegrations, {
        siteId: s.siteId,
        cookieConsentEnabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ── 4. owner (highest client role) is also blocked ───────────────────────────

describe("owner calling design-locked mutations", () => {
  it("is blocked by LAYOUT_MANAGE guard (navigation.create)", async () => {
    await expect(
      asOwner().mutation(api.navigation.create, {
        siteId: s.siteId,
        label: "About",
        href: "/about",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("is blocked by DESIGN_MANAGE guard (siteSettings.updateBranding)", async () => {
    await expect(
      asOwner().mutation(api.siteSettings.updateBranding, {
        siteId: s.siteId,
        brandColorPrimary: "#00ff00",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("is blocked by INTEGRATIONS_MANAGE guard (siteSettings.updateIntegrations)", async () => {
    await expect(
      asOwner().mutation(api.siteSettings.updateIntegrations, {
        siteId: s.siteId,
        cookieConsentEnabled: false,
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

// ── 5. superAdmin bypasses all design-lock guards ────────────────────────────

describe("superAdmin calling design-locked mutations", () => {
  it("can create a navigation item (LAYOUT_MANAGE)", async () => {
    const result = await asAdmin().mutation(api.navigation.create, {
      siteId: s.siteId,
      label: "Home",
      href: "/",
    });
    expect(result).toMatchObject({ label: "Home", href: "/" });
  });

  it("can update branding (DESIGN_MANAGE)", async () => {
    const result = await asAdmin().mutation(api.siteSettings.updateBranding, {
      siteId: s.siteId,
      brandColorPrimary: "#1d4ed8",
    });
    expect(result).toMatchObject({ brandColorPrimary: "#1d4ed8" });
  });

  it("can update integrations (INTEGRATIONS_MANAGE)", async () => {
    const result = await asAdmin().mutation(api.siteSettings.updateIntegrations, {
      siteId: s.siteId,
      cookieConsentEnabled: true,
    });
    expect(result).toMatchObject({ cookieConsentEnabled: true });
  });
});

// ── 6. Non-design permissions are still granted to client roles ───────────────

describe("content_editor calling CONTENT_UPDATE-gated mutation (siteSettings.updateSeo)", () => {
  it("succeeds — non-design permissions are not superAdmin-only", async () => {
    const result = await asEditor().mutation(api.siteSettings.updateSeo, {
      siteId: s.siteId,
      seoGlobalTitle: "My Site",
    });
    expect(result).toMatchObject({ seoGlobalTitle: "My Site" });
  });
});
