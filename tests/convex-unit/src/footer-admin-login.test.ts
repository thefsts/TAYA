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
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const asAdmin = () => t.withIdentity({ subject: "superadmin" });
const asOwner = () => t.withIdentity({ subject: "owner_user" });

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

describe("adminLogin fields are design-tier (LAYOUT_MANAGE)", () => {
  it("owner (highest client role) cannot set adminLogin", async () => {
    await expect(
      asOwner().mutation(api.footer.update, {
        siteId: siteA as Id<"sites">,
        adminLoginEnabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("client cannot flip the link on even when the footer module is enabled", async () => {
    // Ensure the module is genuinely enabled for the site.
    await expect(
      asOwner().mutation(api.footer.update, {
        siteId: siteA as Id<"sites">,
        copyrightText: "owned by client",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});
