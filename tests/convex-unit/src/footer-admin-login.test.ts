/**
 * Admin Login Link Contract (Phase 1 — locked client journey)
 *
 * The client journey entry point is a link on the public website:
 *   Public Website → Admin Login → app.fstsclientsystem.com/sign-in
 *   → Clerk sign-in → auto-identify assigned website → open that site's CMS.
 *
 * Covers:
 *   ✓ footer.update persists per-site adminLogin overrides (superadmin)
 *   ✓ footer.get resolves a stable {enabled, label, url} object
 *   ✓ footer.get resolves defaults even with no footerContent doc
 *   ✓ public getFooterBySlug carries the resolved adminLogin link
 *   ✓ Default URL is config-driven (DASHBOARD_URL env override)
 *   ✓ Default URL carries the site slug for branded login context
 *   ✓ Blank label/url overrides fall back to platform defaults
 *   ✓ Custom label/url overrides are returned verbatim
 *   ✓ Client roles cannot set adminLogin (LAYOUT_MANAGE design-tier)
 *   ✓ Chat D: client content-only footer updates succeed (CONTENT_UPDATE)
 *   ✓ Per-site overrides never leak across tenants (slug isolation)
 *   ✓ Unknown slug → null (public contract unchanged)
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────

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
      enabledModules: { footer: true },
      agencyId: agency,
    });
    siteB = await ctx.db.insert("sites", {
      name: "Site B",
      slug: "site-b",
      status: "active",
      brandColorPrimary: "#333333",
      brandColorSecondary: "#444444",
      whiteLabelEnabled: true,
      poweredByFsts: true,
      websiteType: "professional_services",
      enabledModules: { footer: true },
      agencyId: agency,
    });

    await ctx.db.insert("users", {
      clerkUserId: "superadmin",
      name: "FSTS Admin",
      email: "superadmin@unknown.local",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    // Client owner — highest client role, must NOT pass LAYOUT_MANAGE.
    await ctx.db.insert("users", {
      clerkUserId: "owner_user",
      name: "Site Owner",
      email: "owner@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "owner" }],
    });
    // Chat D: content_editor — content CRUD role used for the split-tier test.
    await ctx.db.insert("users", {
      clerkUserId: "content_editor_user",
      name: "Content Editor",
      email: "editor@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "content_editor" }],
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const asAdmin = () => t.withIdentity({ subject: "superadmin" });
const asOwner = () => t.withIdentity({ subject: "owner_user" });
const asEditor = () => t.withIdentity({ subject: "content_editor_user" });

// ─── 1. Superadmin configures the Admin Login link ──────────────────────

describe("footer.update persists adminLogin overrides (superadmin)", () => {
  it("stores enabled/label/url and footer.get resolves them", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
      adminLoginLabel: "Client Portal",
      adminLoginUrl: "https://app.fstsclientsystem.com/sign-in?site=site-a",
    });

    const result = await asAdmin().query(api.footer.get, { siteId: siteA });
    expect(result).not.toBeNull();
    expect(result!.adminLogin).toEqual({
      enabled: true,
      label: "Client Portal",
      url: "https://app.fstsclientsystem.com/sign-in?site=site-a",
    });
  });

  it("creates the footerContent doc when none exists (no columns required)", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
    });
    const stored = await t.run(async (ctx) =>
      ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", siteA)).first(),
    );
    expect(stored).not.toBeNull();
    expect(stored!.adminLoginEnabled).toBe(true);
    expect(stored!.copyrightText).toBe("");
  });
});

// ─── 2. Default resolution ───────────────────────────────────────────────

describe("default Admin Login resolution", () => {
  it("footer.get returns resolved defaults even with no footerContent doc", async () => {
    const result = await asAdmin().query(api.footer.get, { siteId: siteA });
    expect(result).not.toBeNull();
    expect(result!.adminLogin.enabled).toBe(false);
    expect(result!.adminLogin.label).toBe("Admin Login");
    expect(result!.adminLogin.url).toBe("https://app.fstsclientsystem.com/sign-in?site=site-a");
  });

  it("public getFooterBySlug carries the resolved link for a doc without overrides", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      copyrightText: "© 2026 Site A",
    });
    const data = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "site-a" }));
    expect(data).not.toBeNull();
    expect((data as any).adminLogin).toEqual({
      enabled: false,
      label: "Admin Login",
      url: "https://app.fstsclientsystem.com/sign-in?site=site-a",
    });
  });

  it("blank label/url overrides fall back to platform defaults", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
      adminLoginLabel: "   ",
      adminLoginUrl: "   ",
    });
    const result = await asAdmin().query(api.footer.get, { siteId: siteA });
    expect(result!.adminLogin).toEqual({
      enabled: true,
      label: "Admin Login",
      url: "https://app.fstsclientsystem.com/sign-in?site=site-a",
    });
  });

  it("DASHBOARD_URL env override changes the resolved default URL", async () => {
    vi.stubEnv("DASHBOARD_URL", "https://dashboard.example.com");
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
    });
    const result = await asAdmin().query(api.footer.get, { siteId: siteA });
    expect(result!.adminLogin.url).toBe("https://dashboard.example.com/sign-in?site=site-a");
  });
});

// ─── 3. Public endpoint contract ─────────────────────────────────────────

describe("public getFooterBySlug adminLogin contract", () => {
  it("returns the configured override verbatim to external public sites", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
      adminLoginLabel: "Staff Login",
      adminLoginUrl: "https://custom.example.com/login",
    });
    const data = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "site-a" }));
    expect((data as any).adminLogin).toEqual({
      enabled: true,
      label: "Staff Login",
      url: "https://custom.example.com/login",
    });
  });

  it("keeps per-site overrides isolated across slugs (no leakage)", async () => {
    await asAdmin().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      adminLoginEnabled: true,
      adminLoginLabel: "Site A Login",
    });
    await asAdmin().mutation(api.footer.update, {
      siteId: siteB as Id<"sites">,
      adminLoginEnabled: false,
    });

    const a = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "site-a" }));
    const b = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "site-b" }));
    expect((a as any).adminLogin.label).toBe("Site A Login");
    expect((a as any).adminLogin.enabled).toBe(true);
    expect((b as any).adminLogin.enabled).toBe(false);
    expect((b as any).adminLogin.label).toBe("Admin Login");
    expect((b as any).adminLogin.url).toBe("https://app.fstsclientsystem.com/sign-in?site=site-b");
  });

  it("returns null for an unknown slug (contract unchanged)", async () => {
    const data = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "no-such-site" }));
    expect(data).toBeNull();
  });

  it("returns null when the site has no footerContent doc (external sites handle absence)", async () => {
    const data = await t.run((ctx) => ctx.runQuery(internal.public.getFooterBySlug, { slug: "site-a" }));
    expect(data).toBeNull();
  });
});

// ─── 4. RBAC — design-tier guard ─────────────────────────────────────────

// Chat D split-tier contract: footer content (columns/social/copyright) is
// client content (CONTENT_UPDATE), but any adminLogin* field still requires
// LAYOUT_MANAGE (superadmin-only) — preserving the Phase 1 admin-login
// contract while unblocking client footer content edits.

describe("footer.update split-tier guard (Chat D)", () => {
  it("owner (highest client role) cannot set adminLogin", async () => {
    await expect(
      asOwner().mutation(api.footer.update, {
        siteId: siteA as Id<"sites">,
        adminLoginEnabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("owner can save content-only footer updates (CONTENT_UPDATE)", async () => {
    const result = await asOwner().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      copyrightText: "owned by client",
    });
    expect(result).toMatchObject({ copyrightText: "owned by client" });
  });

  it("content_editor can save footer columns and social links", async () => {
    const result = await asEditor().mutation(api.footer.update, {
      siteId: siteA as Id<"sites">,
      columns: [
        { heading: "Services", links: [{ label: "Classes", href: "/classes" }] },
      ],
      socialLinks: [{ label: "Instagram", href: "https://instagram.com/client" }],
    });
    expect((result as any).columns).toEqual([
      { heading: "Services", links: [{ label: "Classes", href: "/classes" }] },
    ]);
    expect((result as any).socialLinks).toEqual([
      { label: "Instagram", href: "https://instagram.com/client" },
    ]);
  });

  it("owner payload mixing content + adminLogin is rejected whole", async () => {
    await expect(
      asOwner().mutation(api.footer.update, {
        siteId: siteA as Id<"sites">,
        copyrightText: "my footer",
        adminLoginLabel: "Client Portal",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});
