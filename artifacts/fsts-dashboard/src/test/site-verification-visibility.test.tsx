/**
 * site-verification-visibility.test.tsx
 *
 * HOTFIX (production no-go, BLOCKER 1) regression suite.
 *
 * Production shipped with site-verification listed as tier:core scope:client,
 * exposing an FSTS connection-management surface (Site Verification) as
 * NORMAL CLIENT NAVIGATION. The hotfix makes it an admin-scope capability
 * whose ROUTE is additionally superAdmin-guarded, so a client can neither
 * see it nor deep-link it.
 *
 * Required proof (PM directive — do not merely hide the sidebar if the
 * route remains client-accessible):
 *   1. Registry truth — site-verification is scope:"admin" (tier stays core).
 *   2. Role matrix — read_only, content_editor, manager, and owner NEVER see
 *      Site Verification in the sidebar model (buildSidebarGroups) NOR the
 *      capability model (useSiteCapabilities) — both derivation layers the
 *      dashboard composes from.
 *   3. SuperAdmin — keeps the intended admin verification surface: sidebar
 *      item present, capability visible.
 *   4. Direct unauthorized URL — /app/sites/:siteId/verification is DENIED
 *      at the route level by SuperAdminRouteGuard: non-superAdmin (any
 *      client role, even site members) redirects to their site dashboard;
 *      unprovisioned signed-in user (me === null) denied the same way;
 *      while the viewer loads nothing renders (no locked-content flash).
 *   5. App.tsx wraps the route with withSuperAdminGuard (source scan).
 *   6. SiteDashboard connection-mode chip — clients get plain client
 *      language with NO link into Site Verification; superAdmins keep the
 *      linked technical chip.
 *   7. Client-safe copy — HelpCenter / SetupOnboarding tell clients the
 *      publishing connection is FSTS-completed (source scan).
 *
 * Do not delete this suite when re-plumbing verification; it is the
 * production regression contract for the no-go finding.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, within } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Hoisted mock handles ────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** Mutable current location shared by the wouter mock. */
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_svcheck" }));
/** Captured wouter setLocation — SuperAdminRouteGuard's redirect target. */
const mockSetLocation = vi.hoisted(() => vi.fn());

// ─── External / framework mocks (match sidebar-nav.test.tsx) ────────────────

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

// wouter — useParams supplies siteId (both the dashboard body and the route
// guard read it); useLocation hands back the captured setLocation so the
// guard's redirect can be asserted exactly.
vi.mock("wouter", () => ({
  useLocation: () => [mockLocation.value, mockSetLocation],
  useSearch: () => mockLocation.value.split("?")[1] ?? "",
  useParams: () => ({ siteId: "site_svcheck" }),
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
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => <button>User</button>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AIAssistant", () => ({
  AIAssistant: () => null,
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import SuperAdminRouteGuard from "@/components/SuperAdminRouteGuard";
import SiteDashboard from "@/pages/app/SiteDashboard";
import { buildSidebarGroups } from "@/lib/sidebarNav";
import {
  useSiteCapabilities,
  getSiteCapability,
  type MyPermissionsPayload,
} from "@/hooks/useSiteCapabilities";
import { getCapability, CAPABILITY_REGISTRY } from "@/lib/capabilityRegistry";
import { ROLE_CAPABILITIES } from "@/lib/roleCapabilities";

// ─── Fixtures & helpers ──────────────────────────────────────────────────────

const SITE_ID = "site_svcheck";

/** The four NORMAL CLIENT roles from the production directive. */
const CLIENT_ROLES = ["read_only", "content_editor", "manager", "owner"] as const;

const SITE = {
  _id: SITE_ID,
  name: "SV Check Site",
  domain: "sv-check.example.com",
  status: "active",
  connectionMode: "TAYA_NATIVE",
};

type RoleKey = keyof typeof ROLE_CAPABILITIES;

/** getMyPermissions success shape for a role row. */
function permissionsFor(role: RoleKey): MyPermissionsPayload {
  return {
    isSuperAdmin: false,
    role: String(role),
    permissions: ROLE_CAPABILITIES[role],
  };
}

const SUPERADMIN_PERMISSIONS: MyPermissionsPayload = {
  isSuperAdmin: true,
  role: "owner",
  permissions: ROLE_CAPABILITIES.owner,
};

const CLIENT_ME = { _id: "user_client_sv", isSuperAdmin: false, roles: [] };
const SUPERADMIN_ME = { _id: "user_fsts_admin", isSuperAdmin: true, roles: [] };

/** Sidebar ctx type derived from the builder signature. */
type SidebarCtx = Parameters<typeof buildSidebarGroups>[0];

function sidebarCtx(overrides: Partial<SidebarCtx> = {}): SidebarCtx {
  return {
    siteId: SITE_ID,
    enabledModules: {},
    rolePermissions: ROLE_CAPABILITIES.owner,
    isSuperAdmin: false,
    websiteType: null,
    ...overrides,
  };
}

/** Flat sidebar item ids across all groups (incl. nested children). */
function sidebarItemIds(ctx: SidebarCtx): string[] {
  const out: string[] = [];
  for (const g of buildSidebarGroups(ctx)) {
    for (const item of g.items) {
      out.push(item.id);
      if (item.children) out.push(...item.children.map((c) => c.id));
    }
  }
  return out;
}

/** Flat sidebar labels across all groups (incl. nested children). */
function sidebarLabels(ctx: SidebarCtx): string[] {
  const out: string[] = [];
  for (const g of buildSidebarGroups(ctx)) {
    for (const item of g.items) {
      out.push(item.label);
      if (item.children) out.push(...item.children.map((c) => c.label));
    }
  }
  return out;
}

/** Render the capability hook with explicit truth sources. */
function renderCapabilities(
  modules: Record<string, boolean> | null,
  permissions: MyPermissionsPayload | null,
) {
  const dispatch: Record<string, unknown> = {
    "api.sites.getEffectiveModules": modules,
    "api.accessControl.getMyPermissions": permissions,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    return dispatch[path] ?? null;
  });
  return renderHook(() => useSiteCapabilities(SITE_ID));
}

/** Configure the dashboard query dispatch; explicit undefined is preserved. */
function dashboardWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.getDashboardSummary": {
      siteId: SITE_ID,
      courseCount: 0,
      eventCount: 0,
      articleCount: 0,
      serviceCount: 0,
      publishedArticles: 0,
      draftArticles: 0,
      mediaCount: 0,
      lastBackupAt: null,
      squareConnected: false,
      emailConfigured: false,
      formsConfigured: false,
      websiteOnline: null,
      sslActive: null,
      responseTimeMs: null,
      recentActivity: [],
      recentSubmissions: [],
      unreadSubmissionCount: 0,
      upcomingEvents: [],
      upcomingCourses: [],
      seoPagesConfigured: 0,
      recentMedia: [],
    },
    "api.sites.get": SITE,
    "api.sites.getEffectiveModules": {},
    "api.healthScans.getLatestScan": null,
    "api.healthScans.getNotifications": null,
    "api.courses.listActionRequired": null,
    "api.events.listActionRequired": null,
    "api.flyers.listExpiringSoon": null,
    "api.users.me": CLIENT_ME,
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 0 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    "api.accessControl.getMyPermissions": permissionsFor("owner"),
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

function renderDashboard() {
  return render(
    <TooltipProvider>
      <SiteDashboard />
    </TooltipProvider>,
  );
}

function renderGuard(me: unknown) {
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (path !== "api.users.me") return null;
    // Explicit undefined (convex "loading") must be preserved.
    if (me === undefined) return undefined;
    return me;
  });
  return render(
    <SuperAdminRouteGuard>
      <div data-testid="verification-surface">Verification panel</div>
    </SuperAdminRouteGuard>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_svcheck";
  mockSetLocation.mockReset();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ─── 1. Registry truth ───────────────────────────────────────────────────────

describe("BLOCKER 1 — registry truth: site-verification is admin scope", () => {
  it("the capability definition is scope:'admin' (never scope:'client')", () => {
    const cap = getCapability("site-verification");
    expect(cap).not.toBeNull();
    expect(cap?.scope).toBe("admin");
    // Tier stays core — this is a scope problem, not a tier problem.
    expect(cap?.tier).toBe("core");
    expect(cap?.route).toBe("verification");
  });

  it("no other core-tier capability silently carries client scope into the admin surface", () => {
    const offenders = CAPABILITY_REGISTRY.filter(
      (c) => c.key !== "site-verification" && c.scope === "admin",
    );
    // user-management is the pre-existing admin-scope entry; nothing else
    // may appear here without the same route-level guard treatment.
    expect(offenders.map((c) => c.key).sort()).toEqual(["user-management"]);
  });
});

// ─── 2. Client role matrix ──────────────────────────────────────────────────

describe("BLOCKER 1 — normal client roles never see Site Verification", () => {
  it.each(CLIENT_ROLES)("sidebar model hides it for %s", (role) => {
    const ids = sidebarItemIds(sidebarCtx({ rolePermissions: ROLE_CAPABILITIES[role] }));
    expect(ids).not.toContain("site-verification");
    const labels = sidebarLabels(sidebarCtx({ rolePermissions: ROLE_CAPABILITIES[role] }));
    expect(labels).not.toContain("Site Verification");
  });

  it.each(CLIENT_ROLES)("capability model hides it for %s", (role) => {
    const { result } = renderCapabilities({}, permissionsFor(role));
    const sv = getSiteCapability(result.current, "site-verification");
    expect(sv).not.toBeNull();
    expect(sv?.visible).toBe(false);
    expect(sv?.canView).toBe(false);
    expect(sv?.canEdit).toBe(false);
    expect(sv?.canManage).toBe(false);
  });

  it("module truth can never resurrect it for a client (explicit true + owner)", () => {
    const { result } = renderCapabilities(
      { "site-verification": true } as Record<string, boolean>,
      permissionsFor("owner"),
    );
    expect(result.current.byKey["site-verification"].visible).toBe(false);
  });

  it("core-only fallback (unknown truth) never guesses it into existence", () => {
    const { result } = renderCapabilities(null, null);
    expect(result.current.byKey["site-verification"].visible).toBe(false);
    const ids = sidebarItemIds(sidebarCtx({ enabledModules: null, rolePermissions: null }));
    expect(ids).not.toContain("site-verification");
  });
});

// ─── 3. SuperAdmin keeps the admin surface ───────────────────────────────────

describe("BLOCKER 1 — superAdmin keeps the intended admin verification surface", () => {
  it("sidebar model shows it for a superAdmin", () => {
    const ids = sidebarItemIds(sidebarCtx({ isSuperAdmin: true }));
    expect(ids).toContain("site-verification");
    const labels = sidebarLabels(sidebarCtx({ isSuperAdmin: true }));
    expect(labels).toContain("Site Verification");
  });

  it("capability model resolves it visible for a superAdmin", () => {
    const { result } = renderCapabilities({}, SUPERADMIN_PERMISSIONS);
    const sv = getSiteCapability(result.current, "site-verification");
    expect(sv?.visible).toBe(true);
    expect(sv?.canView).toBe(true);
  });

  it("renders the guarded panel content for a superAdmin viewer", () => {
    renderGuard(SUPERADMIN_ME);
    expect(screen.getByTestId("verification-surface")).toBeTruthy();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });
});

// ─── 4. Direct unauthorized URL is denied at the ROUTE level ─────────────────

describe("BLOCKER 1 — direct unauthorized URL /app/sites/:siteId/verification is denied", () => {
  it("a signed-in client (owner, strongest client role) is redirected to their site dashboard", () => {
    renderGuard(CLIENT_ME);
    expect(screen.queryByTestId("verification-surface")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledTimes(1);
    expect(mockSetLocation).toHaveBeenCalledWith(`/app/sites/${SITE_ID}`, { replace: true });
  });

  it.each(CLIENT_ROLES)("every client role (%s) is denied the route", (role) => {
    const me = { ...CLIENT_ME, role };
    renderGuard(me);
    expect(screen.queryByTestId("verification-surface")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith(`/app/sites/${SITE_ID}`, { replace: true });
  });

  it("an unprovisioned signed-in viewer (me === null) is denied the same way", () => {
    renderGuard(null);
    expect(screen.queryByTestId("verification-surface")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith(`/app/sites/${SITE_ID}`, { replace: true });
  });

  it("renders nothing (no flash of the panel) while the viewer query loads", () => {
    renderGuard(undefined);
    expect(screen.queryByTestId("verification-surface")).toBeNull();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });
});

// ─── 5. App.tsx route is actually wrapped (source scan) ──────────────────────

describe("BLOCKER 1 — App.tsx wraps the verification route with the superAdmin guard", () => {
  const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

  it("the route component is withSuperAdminGuard(VerificationPanel)", () => {
    expect(appSource).toContain(
      '<Route path="/app/sites/:siteId/verification" component={withSuperAdminGuard(VerificationPanel)} />',
    );
  });

  it("no unguarded verification route remains", () => {
    expect(appSource).not.toMatch(
      /path="\/app\/sites\/:siteId\/verification"\s+component=\{VerificationPanel\}/,
    );
  });

  it("the guard component is imported and defined in the app shell", () => {
    expect(appSource).toContain('import SuperAdminRouteGuard from "@/components/SuperAdminRouteGuard"');
    expect(appSource).toContain("function withSuperAdminGuard");
  });
});

// ─── 6. SiteDashboard chip: clients get plain language, no link ──────────────

describe("BLOCKER 1 — connection-mode chip is de-linked for clients", () => {
  it("a client sees plain client language and NO link to Site Verification", () => {
    dashboardWorkspace();
    renderDashboard();

    // Plain-language status chip (not a link).
    const chip = screen.getByTitle("Your publishing connection status");
    expect(within(chip).getByText("Website live — publishing ready")).toBeTruthy();

    // No anchor anywhere in the rendered dashboard points at verification.
    const verificationAnchors = document.querySelectorAll('a[href*="/verification"]');
    expect(verificationAnchors.length).toBe(0);

    // And the sidebar (AppLayout) offers no Site Verification entry either.
    const sidebarLinks = Array.from(document.querySelectorAll("a")).map((a) =>
      (a.getAttribute("href") ?? "").toLowerCase(),
    );
    expect(sidebarLinks.some((h) => h.includes("verification"))).toBe(false);
  });

  it("a superAdmin keeps the linked technical chip into the admin surface", () => {
    dashboardWorkspace({
      "api.users.me": SUPERADMIN_ME,
      "api.accessControl.getMyPermissions": SUPERADMIN_PERMISSIONS,
    });
    renderDashboard();

    // A superAdmin legitimately gets TWO verification links: the sidebar
    // entry (admin navigation) and the dashboard chip. The chip is the one
    // carrying the technical title attribute.
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(`a[href="/app/sites/${SITE_ID}/verification"]`),
    );
    expect(links.length).toBeGreaterThanOrEqual(2);
    const chip = links.find(
      (l) => l.getAttribute("title") === "Site connection mode & publishing status",
    );
    expect(chip).toBeDefined();
    expect(chip?.textContent).toContain("TAYA Native");
  });
});

// ─── 7. Client-safe copy (source scan) ───────────────────────────────────────

describe("BLOCKER 1 — client-facing copy points at FSTS, not self-serve verification", () => {
  it("HelpCenter FAQ keeps the question but answers with the FSTS-completed connection copy", () => {
    const src = readFileSync(join(process.cwd(), "src/pages/app/sites/HelpCenter.tsx"), "utf8");
    expect(src).toContain("How do I connect my website to the TAYA system (site verification)?");
    expect(src).toContain("Your publishing connection is set up by your FSTS support team");
    expect(src).toContain("drafting and preview are always available");
  });

  it("SetupOnboarding banner tells clients publishing is FSTS-completed", () => {
    const raw = readFileSync(join(process.cwd(), "src/pages/app/SetupOnboarding.tsx"), "utf8");
    // JSX wraps the sentence across lines — normalize whitespace before
    // asserting the phrase, mirroring what the user actually reads.
    const normalized = raw.replace(/\s+/g, " ");
    expect(normalized).toContain("Your FSTS support team completes the publishing connection for you");
    expect(normalized).toContain("contact them and publishing will be enabled once the connection is set up");
  });
});
