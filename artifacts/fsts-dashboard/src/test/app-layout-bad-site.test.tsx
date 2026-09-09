/**
 * app-layout-bad-site.test.tsx
 *
 * G-1 (Phase 5 UX closeout) regression suite: AppLayout's handling of a bad
 * siteId. `api.sites.get` returns `null` when the site does not exist, was
 * deleted, or the signed-in user has no role on it — every one of those
 * server-side reasons produces the same indistinguishable null, so the client
 * must render a single professional TAYA-branded "Website not found or you
 * don't have access" screen with a safe return to the Websites workspace, and
 * must never render the half-empty workspace shell (sidebar + empty body).
 *
 * Contracts verified:
 *   1. site === null (invalid OR unauthorized site ID — indistinguishable):
 *      - branded not-found screen renders (heading + guidance + two actions)
 *      - no workspace shell is rendered (no sidebar, no page body)
 *      - "Back to Websites" links safely to /app
 *      - no text reveals whether the site exists for another tenant
 *   2. site === undefined (loading): the workspace shell still renders with
 *      skeleton loading state — NOT the not-found screen (no flash of error
 *      before data arrives).
 *   3. site === object (valid): the workspace shell renders normally with the
 *      page body visible — the G-1 branch must not affect healthy sites.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ─────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_bad456/forms" }));

// ── External / framework mocks (match sidebar-nav.test.tsx) ─────────────────

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a callable that returns its own
// path string ("api.sites.get") so the mock useQuery can dispatch on the
// queried function path.
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

// wouter — Link renders a real <a href> so the "Back to Websites" href can be
// asserted exactly as production renders it.
vi.mock("wouter", () => ({
  useLocation: () => [mockLocation.value, vi.fn()],
  useSearch: () => mockLocation.value.split("?")[1] ?? "",
  useParams: () => ({}),
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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/pages/app/SiteDashboard";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SITE_ID = "site_bad456";

const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
  logoUrl: null,
};

const CLIENT = { _id: "user_client_1", id: "user_client_1", isSuperAdmin: false, roles: [] };

/** Configure the convex useQuery mock for a signed-in client on SITE_ID. */
function useClientWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.users.me": CLIENT,
    "api.sites.getEffectiveModules": null,
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 0 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    ...overrides,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    // Preserve explicitly-provided undefined (convex "loading"); fall back to
    // null only for paths the fixture did not configure.
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
}

function renderAppLayout() {
  return render(
    <TooltipProvider>
      <AppLayout siteId={SITE_ID}>
        <div data-testid="page-body">Page content</div>
      </AppLayout>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_bad456/forms";
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── Suite: site === null → branded not-found screen (G-1) ───────────────────

describe("AppLayout — G-1 bad siteId (sites.get returns null)", () => {
  it("renders the TAYA-branded not-found screen for an invalid or unauthorized site ID", () => {
    // Invalid site ID and unauthorized site ID are indistinguishable server-
    // side: both return null. The client must show one shared screen.
    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();

    expect(
      screen.getByText("Website not found or you don't have access"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This website may have been moved or removed./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact FSTS support/i),
    ).toBeInTheDocument();
  });

  it("hides the New Form / page body and sidebar when the site is not accessible", () => {
    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();

    // The page body (children) must NOT render inside the broken shell.
    expect(screen.queryByTestId("page-body")).not.toBeInTheDocument();
    // The workspace sidebar (rendered only in the healthy shell) must NOT render.
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("links back to the Websites workspace (/app) safely", () => {
    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();

    const backLink = screen.getByRole("link", { name: /Back to Websites/i });
    expect(backLink).toHaveAttribute("href", "/app");
  });

  it("offers a secondary Go Back action using browser history", () => {
    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();

    expect(screen.getByRole("button", { name: /Go Back/i })).toBeInTheDocument();
  });

  it("never reveals whether the site exists for another tenant", () => {
    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();

    // The screen must not say "site not found" in a way that confirms the
    // siteId exists elsewhere, nor expose any tenant/agency identifiers.
    expect(screen.queryByText(/not found for you|exists but|belongs to another/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/agency|tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/site_test|site_bad|other tenant/i)).not.toBeInTheDocument();
  });

  it("renders the same screen whether the site is missing (deleted) or unauthorized — no distinction", () => {
    // Both cases return the identical null from sites.get; render twice and
    // confirm the visible heading is identical (shared single message).
    const { unmount } = renderAppLayout();
    const headingOne = screen.getByText("Website not found or you don't have access").textContent;
    unmount();

    useClientWorkspace({ "api.sites.get": null });
    renderAppLayout();
    const headingTwo = screen.getByText("Website not found or you don't have access").textContent;
    expect(headingOne).toBe(headingTwo);
  });
});

// ── Suite: site === undefined (loading) → workspace shell + skeletons ────────

describe("AppLayout — loading state (sites.get undefined)", () => {
  it("renders the workspace shell with skeletons, not the not-found screen", () => {
    useClientWorkspace({ "api.sites.get": undefined });
    const { container } = renderAppLayout();

    // Loading must show skeletons, never the G-1 error screen.
    expect(
      screen.queryByText("Website not found or you don't have access"),
    ).not.toBeInTheDocument();
    // The workspace shell itself renders during loading.
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    // The sidebar/site-identity skeleton block renders (animate-pulse).
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("keeps the workspace shell mounted while loading (no unmount flash)", () => {
    useClientWorkspace({ "api.sites.get": undefined });
    renderAppLayout();

    // The shell (sidebar aside) stays mounted during loading — it is only
    // the not-found branch that would tear it down, and that must not fire
    // while the query is still in flight.
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    // No error screen during loading.
    expect(
      screen.queryByText("Website not found or you don't have access"),
    ).not.toBeInTheDocument();
  });
});

// ── Suite: valid site → normal workspace (G-1 branch must not regress) ──────

describe("AppLayout — valid site renders the normal workspace", () => {
  it("renders the full workspace shell with the page body when site resolves", () => {
    useClientWorkspace(); // api.sites.get → SITE
    renderAppLayout();

    expect(screen.getByTestId("page-body")).toBeInTheDocument();
    expect(screen.queryByText("Website not found or you don't have access")).not.toBeInTheDocument();
  });

  it("shows the site name in the workspace shell for a valid site", () => {
    useClientWorkspace();
    renderAppLayout();

    expect(screen.getByText("FSTS Test Site")).toBeInTheDocument();
  });
});
