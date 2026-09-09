/**
 * forms-module-parity.test.tsx
 *
 * G-2 (Phase 5 UX closeout) regression suite: FormsList deep-link parity with
 * Events/Courses. When the forms module is disabled (or unavailable), the page
 * must render the client-safe ModuleAccessDenied experience instead of an
 * unexplained empty "No forms yet" list.
 *
 * Because `api.forms.list` returns [] (not null) when the module is off, the
 * page derives the disabled state from `api.sites.getEffectiveModules` — the
 * same effective-modules record the server's checkModuleEnabled consults
 * (site flag + agency feature-flag/_modules overrides, identical flag map).
 * This is presentation only; every Convex query and mutation still enforces
 * authorization server-side.
 *
 * Contracts verified:
 *   1. Module disabled (effectiveModules.forms === false) → ModuleAccessDenied
 *      with the Forms message, and NO "New Form" action (a disabled module's
 *      Create would be rejected server-side — no fake affordance).
 *   2. Module enabled + forms loading (undefined) → skeletons, not denied.
 *   3. Modules record loading (undefined) + forms [] → skeletons (must not
 *      flash a misleading "No forms yet" before the flag arrives).
 *   4. Module enabled + forms [] → the real empty state with Create Form.
 *   5. Module enabled + forms present → the list renders with form names.
 *   6. Defensive: forms === null (query error contract change) → denied, not
 *      a crash on `.length`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ─────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

// ── External / framework mocks (match module-access-denied.test.tsx) ─────────

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
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/AIAssistant", () => ({
  AIAssistant: () => null,
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import FormsList from "@/pages/app/sites/FormsList";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SITE_PARAMS = { siteId: "site_test123" };

const SITE = {
  _id: "site_test123",
  name: "FSTS Test Site",
  slug: "fsts-test",
  status: "active",
};

const FORM_A = { _id: "form_a", id: "form_a", name: "Contact Form", status: "published" };
const FORM_B = { _id: "form_b", id: "form_b", name: "Quote Request", status: "draft" };

/**
 * Configure the convex useQuery mock. Dispatch is keyed by query path string;
 * explicitly-provided undefined is preserved (convex "loading"), and
 * unconfigured paths fall back to null.
 */
function workspace(dispatch: Record<string, unknown>) {
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
}

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── Suite: module disabled → ModuleAccessDenied parity (G-2) ────────────────

describe("FormsList — G-2 module disabled parity", () => {
  it("renders ModuleAccessDenied when the forms module is disabled at site level", () => {
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: false, events: true },
      "api.forms.list": [],
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unable to load Forms — you may not have access to this site or the forms module is disabled.",
      ),
    ).toBeInTheDocument();
    // The misleading empty state must not render.
    expect(screen.queryByText("No forms yet")).not.toBeInTheDocument();
  });

  it("renders ModuleAccessDenied when the forms module is disabled via agency feature flag", () => {
    // getEffectiveModules merges agency flags into the same record — the page
    // only ever sees effectiveModules.forms === false either way.
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: false },
      "api.forms.list": [],
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("hides the New Form action when the module is disabled (no fake affordance)", () => {
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: false },
      "api.forms.list": [],
    });
    render(<FormsList params={SITE_PARAMS} />);

    // A disabled module's create would be rejected server-side
    // (requireModuleEnabled) — the button must not be offered.
    expect(screen.queryByRole("button", { name: /New Form/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Form/i })).not.toBeInTheDocument();
  });

  it("does not treat an empty forms list as the disabled state (flag enabled)", () => {
    // forms === [] with the module ENABLED is a genuine empty state.
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: true },
      "api.forms.list": [],
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    expect(screen.getByText("No forms yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Form/i })).toBeInTheDocument();
  });
});

// ── Suite: loading states ────────────────────────────────────────────────────

describe("FormsList — loading states", () => {
  it("renders skeletons while the forms list is in flight (module enabled)", () => {
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: true },
      "api.forms.list": undefined,
    });
    const { container } = render(<FormsList params={SITE_PARAMS} />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    expect(screen.queryByText("No forms yet")).not.toBeInTheDocument();
  });

  it("renders skeletons while the effective-modules record is in flight, even if forms already resolved empty", () => {
    // forms resolves [] before the module flag arrives — the page must not
    // flash "No forms yet" and then swap to denied.
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": undefined,
      "api.forms.list": [],
    });
    const { container } = render(<FormsList params={SITE_PARAMS} />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("No forms yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
  });
});

// ── Suite: healthy module → normal list (parity must not regress) ────────────

describe("FormsList — enabled module renders normally", () => {
  it("renders the forms list with names when the module is enabled and forms exist", () => {
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: true },
      "api.forms.list": [FORM_A, FORM_B],
      "api.forms.getSubmissionCount": 0,
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.getByText("Contact Form")).toBeInTheDocument();
    expect(screen.getByText("Quote Request")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Form/i })).toBeInTheDocument();
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
  });

  it("keeps the module-undefined flag treated as enabled (sidebar gating precedent)", () => {
    // effectiveModules === null (query fallback / unconfigured) must NOT be
    // read as "disabled" — mirrors AppLayout sidebar gating where null means
    // loading and items stay visible.
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": null,
      "api.forms.list": [FORM_A],
      "api.forms.getSubmissionCount": 0,
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    expect(screen.getByText("Contact Form")).toBeInTheDocument();
  });
});

// ── Suite: defensive null guard ──────────────────────────────────────────────

describe("FormsList — defensive null guard", () => {
  it("renders ModuleAccessDenied instead of crashing if forms resolves null", () => {
    // If the server contract ever changes to return null (as events.get does),
    // the page must degrade to the denied experience, not crash on .length.
    workspace({
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": { forms: true },
      "api.forms.list": null,
    });
    render(<FormsList params={SITE_PARAMS} />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("No forms yet")).not.toBeInTheDocument();
  });
});
