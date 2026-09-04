/**
 * white-label.test.tsx
 *
 * Phase 6 test suite — DORMANT EDITION GUARD.
 *
 * Product direction (locked, FSTS): TAYA is the product brand. The current
 * client experience is "TAYA dashboard + client logo/name/domain" — NOT a
 * client-branded replacement dashboard. Normal clients cannot replace the
 * TAYA name, core colors, product identity, navigation style, login
 * branding, or footer attribution.
 *
 * This suite enforces that product decision with three layers:
 *   1. Unit layer — the dormant whiteLabel.ts always reports standard TAYA
 *      chrome (edition master switch hard-off), even for a site record with
 *      whiteLabelEnabled=true; hexToHslTriplet stays strict/injection-safe
 *      for the future seam.
 *   2. UI layer — whiteLabelEnabled=true site records flow through the REAL
 *      production components (SiteDashboard/AppLayout, HelpCenter, SitesList)
 *      and produce ZERO chrome change: TAYA System™ label, TAYA footer
 *      attribution, TAYA workspace header, no accent override.
 *   3. Architecture layer — static audit that no production (non-test) file
 *      imports the dormant module, so the seam cannot silently activate.
 *
 * Allowed client customization is NOT suppressed by this suite: the client
 * logo/name/domain inside the site workspace (sidebar identity, site cards,
 * informational login context) stay covered by sidebar-nav.test.tsx and
 * site-dashboard.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---- Hoisted mock handles -----------------------------------------------

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_test123" }));
const mockSetLocation = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());

// ---- External / framework mocks ------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@convex/_generated/api", () => {
  function makeProxy(path: string): unknown {
    return new Proxy(function () {}, {
      get(_t, key: string | symbol) {
        if (typeof key === "symbol") return undefined;
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
  useLocation: () => [mockLocation.value, mockSetLocation],
  useSearch: () => mockLocation.value.split("?")[1] ?? "",
  useParams: () => ({ siteId: "site_test123" }),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  Redirect: () => null,
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ isSignedIn: true, isLoaded: true, sessionId: "sess_test" }),
  useClerk: () => ({ signOut: mockSignOut }),
  SignIn: () => <div data-testid="clerk-signin" />,
  SignUp: () => <div data-testid="clerk-signup" />,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => <button>User</button>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AIAssistant", () => ({ AIAssistant: () => null }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ---- Imports (after mocks) ------------------------------------------------

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  hexToHslTriplet,
  whiteLabelChrome,
  authBrand,
  WHITE_LABEL_EDITION_ENABLED,
  WHITE_LABEL_SIDEBAR_LABEL,
  WHITE_LABEL_POWERED_BY_COPY,
} from "@/lib/whiteLabel";
import SiteDashboard from "@/pages/app/SiteDashboard";
import HelpCenter from "@/pages/app/sites/HelpCenter";
import SitesList from "@/pages/app/SitesList";

// ---- Fixtures --------------------------------------------------------------

const SITE_ID = "site_test123";

const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  slug: "fsts-test",
  status: "active",
};

/** Site record with EVERY white-label/brand field set — must still get TAYA chrome. */
const WL_SITE = {
  ...SITE,
  name: "Acme Studios",
  whiteLabelEnabled: true,
  poweredByFsts: true,
  brandColorPrimary: "#1d4ed8",
  brandColorSecondary: "#0f172a",
  logoUrl: "https://cdn.test/acme.png",
};

const CLIENT = { _id: "user_client_1", name: "Client User", isSuperAdmin: false, roles: [] };
const SUPERADMIN = { _id: "user_super", name: "Platform Admin", isSuperAdmin: true, roles: [] };

const AGENCY = {
  _id: "agency_1",
  name: "Acme Agency",
  supportEmail: "support@acme.agency",
  helpCenterUrl: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
};

function summary(overrides: Record<string, unknown> = {}) {
  return {
    siteId: SITE_ID,
    courseCount: 0,
    eventCount: 0,
    articleCount: 0,
    serviceCount: 0,
    teamCount: 0,
    publishedArticles: 0,
    draftArticles: 0,
    mediaCount: 0,
    formsConfigured: false,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * Configure the convex useQuery mock for the union of SiteDashboard body,
 * HelpCenter, AppLayout, and SitesList queries. Unknown paths return null.
 */
function workspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.users.me": CLIENT,
    "api.sites.getDashboardSummary": summary(),
    "api.sites.getEffectiveModules": null,
    "api.healthScans.getLatestScan": null,
    "api.healthScans.getNotifications": null,
    "api.courses.listActionRequired": null,
    "api.events.listActionRequired": null,
    "api.flyers.listExpiringSoon": null,
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 0 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    ...overrides,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
}

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_test123";
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
  mockSetLocation.mockClear();
  mockToast.mockClear();
  mockSignOut.mockClear();
});

// ---- 1. Dormant edition — unit policy --------------------------------------

describe("whiteLabel.ts — dormant edition policy (TAYA stays TAYA)", () => {
  it("hard-disables the white-label edition", () => {
    expect(WHITE_LABEL_EDITION_ENABLED).toBe(false);
  });

  it("reports standard TAYA chrome for a non-white-labeled site", () => {
    const chrome = whiteLabelChrome(SITE, null, false);
    expect(chrome).toEqual({
      isWhiteLabel: false,
      showPoweredBy: true,
      sidebarLabel: "",
      accentTriplet: null,
      accentHex: null,
    });
  });

  it("reports standard TAYA chrome even when whiteLabelEnabled=true (edition off)", () => {
    // The site record says white-label, with every brand field set — the
    // dormant edition must still return the standard TAYA platform chrome.
    const chrome = whiteLabelChrome(WL_SITE, { brandColorPrimary: "#1d4ed8", brandingUpdatedAt: 1 }, false);
    expect(chrome.isWhiteLabel).toBe(false);
    expect(chrome.showPoweredBy).toBe(true);
    expect(chrome.sidebarLabel).toBe("");
    expect(chrome.accentTriplet).toBeNull();
    expect(chrome.accentHex).toBeNull();
  });

  it("reports standard TAYA chrome for internal users and missing sites", () => {
    expect(whiteLabelChrome(WL_SITE, null, false, true).isWhiteLabel).toBe(false);
    expect(whiteLabelChrome(null, null, false).isWhiteLabel).toBe(false);
    expect(whiteLabelChrome(undefined, undefined, false, true).showPoweredBy).toBe(true);
  });

  it("keeps poweredByFsts=false hiding only the footer badge (chrome-only knob)", () => {
    const chrome = whiteLabelChrome({ ...SITE, poweredByFsts: false }, null, false);
    expect(chrome.isWhiteLabel).toBe(false);
    expect(chrome.showPoweredBy).toBe(false);
    expect(chrome.sidebarLabel).toBe("");
    expect(chrome.accentTriplet).toBeNull();
  });

  it("authBrand always returns the TAYA platform identity (edition off)", () => {
    expect(authBrand(WL_SITE)).toEqual({ logoUrl: null, name: null, isWhiteLabel: false });
    expect(authBrand(SITE)).toEqual({ logoUrl: null, name: null, isWhiteLabel: false });
    expect(authBrand(null)).toEqual({ logoUrl: null, name: null, isWhiteLabel: false });
  });
});

// ---- 2. hexToHslTriplet — strict conversion for the future seam -------------

describe("hexToHslTriplet — strict hex conversion (future-edition seam)", () => {
  it("converts known brand hexes to H S% L% triplets", () => {
    expect(hexToHslTriplet("#1d4ed8")).toBe("224 76% 48%");
    expect(hexToHslTriplet("#FF0000")).toBe("0 100% 50%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#7c3aed")).toBe("262 83% 58%");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(hexToHslTriplet("  #1d4ed8  ")).toBe("224 76% 48%");
  });

  it("rejects anything that is not a strict #rrggbb value (injection-safe)", () => {
    expect(hexToHslTriplet("1d4ed8")).toBeNull();
    expect(hexToHslTriplet("#1d4ed")).toBeNull();
    expect(hexToHslTriplet("#1d4ed88")).toBeNull();
    expect(hexToHslTriplet("#gggggg")).toBeNull();
    expect(hexToHslTriplet("#1d4ed8; color:red")).toBeNull();
    expect(hexToHslTriplet("javascript:#1d4ed8")).toBeNull();
    expect(hexToHslTriplet("")).toBeNull();
    expect(hexToHslTriplet("   ")).toBeNull();
  });
});

// ---- 3. UI layer — whiteLabelEnabled causes ZERO chrome change --------------

describe("SiteDashboard/AppLayout — whiteLabelEnabled produces no chrome change", () => {
  it("renders the standard TAYA sidebar label and footer attribution", () => {
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
    });
    renderWithProviders(<SiteDashboard />);
    expect(screen.getAllByText("TAYA System™").length).toBeGreaterThan(0);
    expect(screen.getByText(/Powered by/)).toBeVisible();
    expect(screen.getByText("Full Stack Tech Solutions")).toBeVisible();
    // No white-label chrome leaks:
    expect(screen.queryByText(WHITE_LABEL_SIDEBAR_LABEL)).toBeNull();
    expect(screen.queryByText("Client Dashboard")).toBeNull();
  });

  it("never overrides the TAYA core accent on a white-labeled site record", () => {
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
    });
    renderWithProviders(<SiteDashboard />);
    const aside = document.querySelector("aside");
    expect(aside?.getAttribute("style")).toBeNull();
  });

  it("keeps the TAYA login-screen identity for white-labeled site records", () => {
    // App.tsx keeps the inline AuthPageBrand: TAYA logo + "TAYA Client
    // Dashboard" heading; the site context only adds the informational
    // "— Admin Login" sub-line. Verified statically in section 5.
    // Here we assert the client logo DOES appear inside the workspace
    // sidebar (allowed customization) while TAYA chrome stays.
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
    });
    renderWithProviders(<SiteDashboard />);
    // Allowed: client logo + name in the site workspace identity block.
    expect(screen.getByAltText("Acme Studios")).toBeVisible();
    expect(screen.getByText("Acme Studios")).toBeVisible();
    // Required: TAYA chrome.
    expect(screen.getAllByText("TAYA System™").length).toBeGreaterThan(0);
  });

  it("renders the TAYA footer for superadmin on a white-labeled site record", () => {
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
      "api.users.me": SUPERADMIN,
    });
    renderWithProviders(<SiteDashboard />);
    expect(screen.getAllByText("TAYA System™").length).toBeGreaterThan(0);
    expect(screen.getByText(/Powered by/)).toBeVisible();
  });

  it("renders ™ and em-dash characters correctly (no literal escape leaks)", () => {
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
      "api.healthScans.getLatestScan": { overallScore: 82 },
    });
    renderWithProviders(<SiteDashboard />);
    // Display-bug class: literal \uXXXX sequences must never render.
    expect(document.body.textContent).not.toContain("\\u2122");
    expect(document.body.textContent).not.toContain("\\u2014");
    expect(document.body.textContent).toContain("TAYA System™");
    expect(screen.getByText("Website Health Command Center™")).toBeVisible();
    expect(screen.getByText("Excellent — your site is healthy")).toBeVisible();
  });
});

// ---- 4. HelpCenter + SitesList — TAYA attribution everywhere -----------------

describe("HelpCenter — TAYA platform attribution regardless of whiteLabelEnabled", () => {
  it("credits the TAYA platform for a standard site", () => {
    workspace();
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getByText(/This dashboard is the TAYA System/)).toBeVisible();
    expect(screen.getAllByText("Full Stack Tech Solutions").length).toBeGreaterThan(0);
  });

  it("keeps TAYA attribution even when whiteLabelEnabled=true (edition off)", () => {
    workspace({
      "api.sites.get": WL_SITE,
      "api.sites.list": [WL_SITE],
    });
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getByText(/This dashboard is the TAYA System/)).toBeVisible();
    expect(screen.getAllByText("Full Stack Tech Solutions").length).toBeGreaterThan(0);
    expect(screen.queryByText(WHITE_LABEL_POWERED_BY_COPY)).toBeNull();
  });

  it("credits the managing agency for agency sites (agency label precedence)", () => {
    workspace({
      "api.sites.get": { ...SITE, agencyId: "agency_1" },
      "api.sites.list": [{ ...SITE, agencyId: "agency_1" }],
      "api.agencies.get": AGENCY,
    });
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getByText(/This dashboard is managed by/)).toBeVisible();
    expect(screen.getByText(/powered by the TAYA System/)).toBeVisible();
    expect(screen.getAllByText("Acme Agency").length).toBeGreaterThan(0);
  });
});

describe("SitesList — TAYA workspace header regardless of whiteLabelEnabled", () => {
  it("shows the TAYA™ header for a client whose sites are all white-label records", () => {
    workspace({
      "api.sites.listWithHealth": [WL_SITE, { ...WL_SITE, _id: "site_wl_2" }],
    });
    renderWithProviders(<SitesList />);
    expect(screen.getByText("TAYA™")).toBeVisible();
    expect(screen.getByText("Tools • Automation • Your Advantage")).toBeVisible();
    expect(screen.queryByText(WHITE_LABEL_SIDEBAR_LABEL)).toBeNull();
    expect(screen.queryByAltText("Acme Studios logo")).toBeNull();
  });

  it("shows the TAYA™ header for a mixed client (some white-label records)", () => {
    workspace({
      "api.sites.listWithHealth": [SITE, { ...WL_SITE, _id: "site_wl_2" }],
    });
    renderWithProviders(<SitesList />);
    expect(screen.getByText("TAYA™")).toBeVisible();
    expect(screen.queryByText("Client Dashboard")).toBeNull();
  });

  it("keeps the TAYA™ header for superadmin", () => {
    workspace({
      "api.users.me": SUPERADMIN,
      "api.sites.listWithHealth": [WL_SITE, { ...WL_SITE, _id: "site_wl_2" }],
    });
    renderWithProviders(<SitesList />);
    expect(screen.getByText("TAYA™")).toBeVisible();
    expect(screen.queryByText("Client Dashboard")).toBeNull();
  });

  it("redirects single-site clients straight to their workspace", () => {
    workspace({
      "api.sites.listWithHealth": [WL_SITE],
    });
    const { container } = renderWithProviders(<SitesList />);
    expect(mockSetLocation).toHaveBeenCalledWith(`/app/sites/${WL_SITE._id}`, { replace: true });
    expect(container.textContent).toBe("");
  });

  it("shows client logos on site cards (allowed customization, TAYA header)", () => {
    workspace({
      "api.sites.listWithHealth": [WL_SITE, { ...WL_SITE, _id: "site_wl_2" }],
    });
    renderWithProviders(<SitesList />);
    // Client logo on the site CARD is allowed customization.
    expect(screen.getAllByAltText("Acme Studios").length).toBeGreaterThan(0);
    // The workspace header stays TAYA.
    expect(screen.getByText("TAYA™")).toBeVisible();
  });
});

// ---- 5. Architecture layer — the seam cannot silently activate ---------------

describe("Architecture — dormant module is not wired into production", () => {
  /** Recursively collect all non-test .ts/.tsx files under a directory. */
  function productionFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...productionFiles(full));
      } else if ((entry.endsWith(".ts") || entry.endsWith(".tsx")) && !/\.(test|spec)\./.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it("no production file imports the dormant whiteLabel module", () => {
    const files = productionFiles("src");
    expect(files.length).toBeGreaterThan(50); // sanity: we actually scanned
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (src.includes("@/lib/whiteLabel")) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("the login screen keeps the TAYA identity (App.tsx static audit)", () => {
    const appSrc = readFileSync("src/App.tsx", "utf8");
    // TAYA logo is the login brand, and the heading is the product name.
    expect(appSrc).toContain("tayaLogoUrl");
    expect(appSrc).toContain("TAYA Client Dashboard");
    // The site context is informational only — no rebranding seam.
    expect(appSrc).not.toContain("whiteLabel");
    expect(appSrc).not.toContain("authBrand(");
  });

  it("AppLayout/SitesList/HelpCenter keep TAYA chrome statically (no seam import)", () => {
    for (const f of [
      "src/pages/app/SiteDashboard.tsx",
      "src/pages/app/SitesList.tsx",
      "src/pages/app/sites/HelpCenter.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toContain("@/lib/whiteLabel");
      expect(src).not.toContain("whiteLabelChrome");
      expect(src).not.toContain("WHITE_LABEL");
    }
    // The TAYA sidebar sub-label and footer attribution are present.
    const dashSrc = readFileSync("src/pages/app/SiteDashboard.tsx", "utf8");
    expect(dashSrc).toContain("TAYA System");
    expect(dashSrc).toContain("Powered by");
    expect(dashSrc).toContain("Full Stack Tech Solutions");
    // ™ must never appear as a literal \u2122 escape in JSX text position.
    expect(dashSrc).not.toMatch(/>[^<{\n]*\\u2122/);
  });

  it("no production file rebrands the header away from TAYA (SitesList audit)", () => {
    const src = readFileSync("src/pages/app/SitesList.tsx", "utf8");
    expect(src).toContain("TAYA");
    expect(src).not.toContain("headerBrandName");
    expect(src).not.toContain("brandSite");
  });
});
