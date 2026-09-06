/**
 * website-settings-tiering.test.tsx — P3 certification
 *
 * Proves the Website Settings page implements per-tab RBAC tiering that
 * mirrors the backend exactly (convex/siteSettings.ts + requirePermission):
 *
 *   • SuperAdmin      → all 8 tabs (Identity, Branding, Contact, SEO,
 *                        Integrations, Legal, Events, Modules).
 *   • Client owner / content_editor → only the 4 client tabs
 *                        (Contact, SEO, Legal, Events) with a working Save
 *                        button, plus the DesignLockBanner explaining that
 *                        brand identity / colors / fonts / integrations /
 *                        module setup stay TAYA-managed.
 *   • read_only / finance / support → the explained "View-only access" card
 *                        (no redirect, no blank screen, no fake Save).
 *   • The route is NOT blanket design-locked (App.tsx mounts WebsiteSettings
 *                        directly) and the sidebar item is a working link
 *                        (sidebarNav.ts no longer sets isDesignLocked).
 *
 * Backend counterpart: tests/convex-unit/src/design-lock-rbac.test.ts §7.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";

// ── Hoisted mock handles ─────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

// ── External / framework mocks ───────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a stable token string so the
// mock useQuery/useMutation can be dispatched on the API path.
vi.mock("@convex/_generated/api", () => {
  function makeProxy(path: string): unknown {
    return new Proxy(function () {}, {
      get(_t, key: string) {
        return makeProxy(`${path}.${key}`);
      },
      apply() {
        return path;
      },
    });
  }
  return { api: makeProxy("api") };
});

vi.mock("@convex/_generated/dataModel", () => ({}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  useSearch: () => "",
  useParams: () => ({}),
  useRoute: () => [false, {}],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Redirect: () => null,
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => <button>User</button>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// AppLayout — render children directly so page content is visible in tests.
vi.mock("@/pages/app/SiteDashboard", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// SmartImageEditor — used by ImagePickerField; not under test here.
vi.mock("@/components/SmartImageUploader", () => ({
  SmartImageEditor: () => null,
}));

// ── Lazy page import (after mocks) ───────────────────────────────────────────

import WebsiteSettings from "@/pages/app/sites/WebsiteSettings";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SITE_ID = "site_test123";
const PARAMS = { siteId: SITE_ID };

/** Minimal populated settings doc — enough for every tab to render. */
const SETTINGS_DOC = {
  businessName: "Corsair Test Co",
  tagline: "Test tagline",
  logoUrl: "",
  faviconUrl: "",
  websiteType: "business_website",
  timezone: "America/New_York",
  brandColorPrimary: "#1d4ed8",
  brandColorSecondary: "#0f172a",
  brandColorAccent: "#7c3aed",
  fontHeading: "system",
  fontBody: "system",
  phone: "555-0100",
  email: "hello@corsair.test",
  address: "1 Test Way",
  businessHours: [],
  socialLinks: {},
  seoGlobalTitle: "Corsair",
  seoGlobalDescription: "Test description",
  seoOgImageUrl: "",
  analyticsGa4: "",
  analyticsGtm: "",
  analyticsPixel: "",
  cookieConsentEnabled: false,
  cookiePolicyUrl: "",
  privacyPolicyUrl: "/privacy",
  termsOfServiceUrl: "/terms",
  showCancelledEvents: false,
  contactUpdatedAt: 1000,
  seoUpdatedAt: 1000,
  legalUpdatedAt: 1000,
  eventsUpdatedAt: 1000,
};

const SUPERADMIN_USER = {
  _id: "user_superadmin",
  isSuperAdmin: true,
  email: "admin@fsts.test",
  roles: [],
};

const OWNER_USER = {
  _id: "user_owner",
  isSuperAdmin: false,
  email: "owner@client.test",
  roles: [{ siteId: SITE_ID, role: "owner" }],
};

const CONTENT_EDITOR_USER = {
  _id: "user_editor",
  isSuperAdmin: false,
  email: "editor@client.test",
  roles: [{ siteId: SITE_ID, role: "content_editor" }],
};

const READ_ONLY_USER = {
  _id: "user_readonly",
  isSuperAdmin: false,
  email: "readonly@client.test",
  roles: [{ siteId: SITE_ID, role: "read_only" }],
};

const OTHER_SITE_USER = {
  _id: "user_other_site",
  isSuperAdmin: false,
  email: "other@client.test",
  // Roles on a DIFFERENT site must not grant content editing here.
  roles: [{ siteId: "site_other456", role: "owner" }],
};

/** Dispatch useQuery per API path — real DesignLockBanner queries api.users.me. */
function setQueryDispatch(dispatch: Record<string, unknown>) {
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    return dispatch[path] ?? null;
  });
}

let saveContactFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  saveContactFn = vi.fn().mockResolvedValue(undefined);
  // Default: settings doc loads, superadmin user (overridden per test).
  setQueryDispatch({
    "api.siteSettings.get": SETTINGS_DOC,
    "api.users.me": SUPERADMIN_USER,
    "api.sites.getEffectiveModules": { articles: true, events: true },
  });
  mockUseMutation.mockImplementation((m: unknown) => {
    const path = typeof m === "function" ? (m as () => string)() : (m as string);
    if (path === "api.siteSettings.updateContact") return saveContactFn;
    return vi.fn().mockResolvedValue(undefined);
  });
});

afterEach(() => {
  cleanup();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const TAB_LABELS = [
  "Identity",
  "Branding",
  "Contact",
  "SEO",
  "Integrations",
  "Legal",
  "Events",
  "Modules",
] as const;

function expectTabVisible(label: string) {
  expect(screen.queryByText(label, { selector: "[role='tab']" })).not.toBeNull();
}

function expectTabHidden(label: string) {
  expect(screen.queryByText(label, { selector: "[role='tab']" })).toBeNull();
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("WebsiteSettings — per-tab RBAC tiering (P3)", () => {
  it("SuperAdmin sees all 8 tabs and lands on Identity", () => {
    render(<WebsiteSettings params={PARAMS} />);
    for (const label of TAB_LABELS) expectTabVisible(label);
    expectTabVisible("Identity");
    // Superadmin subtitle mentions the full manage scope.
    expect(
      screen.getByText(/Manage site identity, branding, contact details/),
    ).toBeInTheDocument();
  });

  it("client owner sees only the 4 client tabs + DesignLockBanner, and Contact Save works", async () => {
    setQueryDispatch({
      "api.siteSettings.get": SETTINGS_DOC,
      "api.users.me": OWNER_USER,
      "api.sites.getEffectiveModules": { articles: true, events: true },
    });
    render(<WebsiteSettings params={PARAMS} />);

    // Client-editable tabs remain.
    expectTabVisible("Contact");
    expectTabVisible("SEO");
    expectTabVisible("Legal");
    expectTabVisible("Events");

    // SuperAdmin-only tabs are hidden (no fake forms whose Save would 403).
    expectTabHidden("Identity");
    expectTabHidden("Branding");
    expectTabHidden("Integrations");
    expectTabHidden("Modules");

    // DesignLockBanner explains TAYA-managed sections (real component,
    // queries api.users.me → OWNER_USER, isSuperAdmin false).
    expect(screen.getByText(/is controlled by TAYA administrators/)).toBeInTheDocument();
    expect(
      screen.getByText(/Brand identity, colors, fonts, integrations, and module setup/),
    ).toBeInTheDocument();

    // Clients land on the Contact tab by default (defaultValue must match a
    // visible trigger), so the Save Contact button is present without clicking.
    const saveBtn = screen.getByRole("button", { name: "Save Contact" });
    expect(saveBtn).toBeEnabled();

    // REAL click — no dead buttons. Save resolves → success toast.
    fireEvent.click(saveBtn);
    // handleSave is async: flush the microtask chain inside act().
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveContactFn).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: SITE_ID, phone: "555-0100" }),
    );
    expect(mockToast).toHaveBeenCalledWith({ title: "Saved successfully" });
  });

  it("client content_editor (Corsair second seat) gets the same 4 client tabs", () => {
    setQueryDispatch({
      "api.siteSettings.get": SETTINGS_DOC,
      "api.users.me": CONTENT_EDITOR_USER,
      "api.sites.getEffectiveModules": { articles: true, events: true },
    });
    render(<WebsiteSettings params={PARAMS} />);

    expectTabVisible("Contact");
    expectTabVisible("SEO");
    expectTabVisible("Legal");
    expectTabVisible("Events");
    expectTabHidden("Identity");
    expectTabHidden("Branding");
    expectTabHidden("Integrations");
    expectTabHidden("Modules");
    expect(screen.getByRole("button", { name: "Save Contact" })).toBeEnabled();
  });

  it("read_only role gets the explained view-only card (no tabs, no fake Save)", () => {
    setQueryDispatch({
      "api.siteSettings.get": SETTINGS_DOC,
      "api.users.me": READ_ONLY_USER,
      "api.sites.getEffectiveModules": { articles: true, events: true },
    });
    render(<WebsiteSettings params={PARAMS} />);

    expect(screen.getByText("View-only access")).toBeInTheDocument();
    expect(
      screen.getByText(/Website Settings editing is not available to you/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Brand identity, colors, fonts, integrations, and module setup are always/,
      ),
    ).toBeInTheDocument();

    // No tab bar at all — nothing to click, nothing that looks savable.
    for (const label of TAB_LABELS) expectTabHidden(label);
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("roles from a DIFFERENT site never grant tab visibility here", () => {
    setQueryDispatch({
      "api.siteSettings.get": SETTINGS_DOC,
      "api.users.me": OTHER_SITE_USER,
      "api.sites.getEffectiveModules": { articles: true, events: true },
    });
    render(<WebsiteSettings params={PARAMS} />);
    expect(screen.getByText("View-only access")).toBeInTheDocument();
    for (const label of TAB_LABELS) expectTabHidden(label);
  });

  it("renders skeleton while loading (no role flash / blank screen)", () => {
    mockUseQuery.mockImplementation(() => undefined);
    render(<WebsiteSettings params={PARAMS} />);
    // AppLayout is mocked as a pass-through wrapper; the page renders its
    // loading skeleton without any tabs or view-only card.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText("View-only access")).toBeNull();
  });

  it("renders an explained error card when access is denied (no blank screen)", () => {
    setQueryDispatch({
      "api.siteSettings.get": null,
      "api.users.me": OWNER_USER,
      "api.sites.getEffectiveModules": { articles: true, events: true },
    });
    render(<WebsiteSettings params={PARAMS} />);
    expect(
      screen.getByText(/Unable to load Website Settings/),
    ).toBeInTheDocument();
  });
});

// ── Static wiring audits (App.tsx + sidebarNav.ts) ───────────────────────────

describe("WebsiteSettings route & sidebar wiring (static audit)", () => {
  const appSrc = readFileSync("src/App.tsx", "utf8");

  it("App.tsx no longer blanket design-locks the settings route", () => {
    expect(appSrc).not.toContain("WebsiteSettingsGuarded");
    expect(appSrc).not.toMatch(
      /withDesignLock\(WebsiteSettings\)/,
    );
  });

  it("App.tsx mounts WebsiteSettings directly on the settings route", () => {
    expect(appSrc).toMatch(
      /path="\/app\/sites\/:siteId\/settings"\s+component=\{WebsiteSettings\}/,
    );
  });

  it("sidebarNav.ts never blanket-locks website-settings (working client link)", () => {
    const sidebarSrc = readFileSync("src/lib/sidebarNav.ts", "utf8");
    const settingsItem = sidebarSrc.match(
      /\{[^{}]*id:\s*"website-settings"[^{}]*\}/,
    );
    expect(settingsItem).not.toBeNull();
    expect(settingsItem![0]).not.toContain("isDesignLocked");
    expect(settingsItem![0]).toContain('href: HREF(siteId, "settings")');
  });
});
