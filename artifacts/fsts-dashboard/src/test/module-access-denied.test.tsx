/**
 * module-access-denied.test.tsx
 *
 * Verifies that every dashboard page covered by Task #70 renders
 * <ModuleAccessDenied> (showing "Access denied") instead of crashing
 * when its primary Convex query returns null (module disabled / no access).
 *
 * Covered pages:
 *   ActivityLog, BackupsList, CoursesList, EventsList, FormSubmissions,
 *   MediaLibrary, SeoSettings, VersionHistory, PaymentsConfig (mappings),
 *   PaymentProviders, CrmConnectionConfig, AdminSites, AdminDesignLock
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

// ── External / framework mocks ─────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a stable token string so the
// mock useQuery can be called without errors, regardless of the API path used.
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

// dataModel — types only; no runtime value needed
vi.mock("@convex/_generated/dataModel", () => ({}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
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

// AppLayout — render children directly so page content is visible in tests
vi.mock("@/pages/app/SiteDashboard", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// LockedField / DesignLockBanner — pass-through wrappers
vi.mock("@/components/LockedField", () => ({
  LockedField: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DesignLockBanner: () => null,
}));

// MediaLibrary-specific local components
vi.mock("@/components/SmartImageUploader", () => ({
  SmartImageUploader: () => null,
}));

vi.mock("@/components/UploadQueue", () => ({
  UploadQueue: () => null,
}));

// MediaLibrary destructures useUploadQueue as [items, actions] — return a tuple.
vi.mock("@/hooks/useUploadQueue", () => ({
  useUploadQueue: () => [
    [],
    {
      addToQueue: vi.fn(),
      _setStatus: vi.fn(),
      _setProgress: vi.fn(),
      _setStorageId: vi.fn(),
      _setError: vi.fn(),
      removeItem: vi.fn(),
      clearDone: vi.fn(),
    },
  ],
}));

// AIAssistant (referenced by SiteDashboard — mocked above, but guard here too)
vi.mock("@/components/AIAssistant", () => ({
  AIAssistant: () => null,
}));

// ── Lazy page imports ──────────────────────────────────────────────────────
// Imported after mocks so module factories are in place.

import ActivityLog from "@/pages/app/sites/ActivityLog";
import BackupsList from "@/pages/app/sites/BackupsList";
import CoursesList from "@/pages/app/sites/CoursesList";
import EventsList from "@/pages/app/sites/EventsList";
import FormSubmissions from "@/pages/app/sites/FormSubmissions";
import MediaLibrary from "@/pages/app/sites/MediaLibrary";
import SeoSettings from "@/pages/app/sites/SeoSettings";
import VersionHistory from "@/pages/app/sites/VersionHistory";
import PaymentsConfig from "@/pages/app/sites/PaymentsConfig";
import PaymentProviders from "@/pages/app/sites/PaymentProviders";
import CrmConnectionConfig from "@/pages/app/sites/CrmConnectionConfig";
import AdminSites from "@/pages/app/admin/AdminSites";
import AdminDesignLock from "@/pages/app/admin/AdminDesignLock";

// ── Helpers ─────────────────────────────────────────────────────────────────

const SITE_PARAMS = { siteId: "site_test123" };

/** Superadmin stub returned for api.users.me on admin pages */
const SUPERADMIN = {
  _id: "user_superadmin",
  isSuperAdmin: true,
  email: "admin@fsts.test",
};

/**
 * Reset all Convex mocks before each test.
 * Default: useQuery returns null (module disabled), mutations return a no-op fn.
 */
function resetMocks() {
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
}

/**
 * Configure useQuery so the FIRST call returns a superadmin object (satisfying
 * the isSuperAdmin guard on admin pages) and all subsequent calls return null.
 */
function withSuperadminThenNull() {
  mockUseQuery.mockReturnValueOnce(SUPERADMIN).mockReturnValue(null);
}

function assertAccessDenied() {
  // The ModuleAccessDenied component always renders "Access denied" as its heading.
  // Some pages (e.g. CrmConnectionConfig) render it in multiple sections when
  // several queries return null; getAllByText handles both the single and multi case.
  const hits = screen.getAllByText("Access denied");
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0]).toBeInTheDocument();
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe("ModuleAccessDenied — null query guard", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── Site pages ─────────────────────────────────────────────────────────

  it("ActivityLog renders ModuleAccessDenied when query returns null", () => {
    render(<ActivityLog params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("BackupsList renders ModuleAccessDenied when query returns null", () => {
    render(<BackupsList params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("CoursesList renders ModuleAccessDenied when primary query returns null", () => {
    render(<CoursesList params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("EventsList renders ModuleAccessDenied when primary query returns null", () => {
    render(<EventsList params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("FormSubmissions renders ModuleAccessDenied when query returns null", () => {
    render(<FormSubmissions params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("MediaLibrary renders ModuleAccessDenied when primary query returns null", () => {
    render(<MediaLibrary params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("SeoSettings renders ModuleAccessDenied when query returns null", () => {
    render(<SeoSettings params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("VersionHistory renders ModuleAccessDenied when query returns null", () => {
    render(<VersionHistory params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("PaymentsConfig renders ModuleAccessDenied in mappings section when that query returns null", () => {
    // config (1st call) returns null → LockedField form section still renders (no early exit on null config).
    // mappings (2nd call) returns null → triggers ModuleAccessDenied in the mappings section.
    // mockReturnValue(null) covers both calls.
    render(<PaymentsConfig params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("PaymentProviders renders ModuleAccessDenied in Providers tab when connectors query returns null", () => {
    // ProvidersTab (the default tab) calls useQuery for connectors; null → ModuleAccessDenied.
    render(<PaymentProviders params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  it("CrmConnectionConfig renders ModuleAccessDenied when entitySettings query returns null", () => {
    // entitySettings (2nd useQuery call) null → ModuleAccessDenied in entity sync section.
    // All calls return null; connection null doesn't cause an early return.
    render(<CrmConnectionConfig params={SITE_PARAMS} />);
    assertAccessDenied();
  });

  // ── Admin pages ────────────────────────────────────────────────────────

  it("AdminSites renders ModuleAccessDenied when sites list query returns null", () => {
    // me (1st call) must be a superadmin to pass the isSuperAdmin guard.
    // sites (2nd call) returns null → ModuleAccessDenied.
    withSuperadminThenNull();
    render(<AdminSites />);
    assertAccessDenied();
  });

  it("AdminDesignLock renders ModuleAccessDenied when sites list query returns null", () => {
    // me (1st call) must be a superadmin to pass the isSuperAdmin guard.
    // sites (2nd call) returns null → ModuleAccessDenied in the enforcement-status section.
    withSuperadminThenNull();
    render(<AdminDesignLock />);
    assertAccessDenied();
  });
});

// ── Loading-state suite ──────────────────────────────────────────────────────
//
// When useQuery returns `undefined` the query is still in flight.
// Every covered page must render a Skeleton (animate-pulse div) instead of
// content or ModuleAccessDenied, so users never see a blank page while loading.

describe("Skeleton loading guard — undefined query", () => {
  beforeEach(() => {
    // All queries return undefined → in-flight / loading
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue(undefined);
    mockUseMutation.mockReset();
    mockUseMutation.mockReturnValue(vi.fn());
    mockUseAction.mockReset();
    mockUseAction.mockReturnValue(vi.fn());
  });

  function assertSkeleton({ container }: { container: HTMLElement }) {
    // Skeleton renders a div with the "animate-pulse" class.
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // Must NOT show the access-denied message — that's a different state.
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
  }

  // ── Site pages ─────────────────────────────────────────────────────────

  it("ActivityLog renders Skeleton while query is undefined", () => {
    const { container } = render(<ActivityLog params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("BackupsList renders Skeleton while query is undefined", () => {
    const { container } = render(<BackupsList params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("CoursesList renders Skeleton while primary query is undefined", () => {
    const { container } = render(<CoursesList params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("EventsList renders Skeleton while primary query is undefined", () => {
    const { container } = render(<EventsList params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("FormSubmissions renders Skeleton while query is undefined", () => {
    const { container } = render(<FormSubmissions params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("MediaLibrary renders Skeleton while primary query is undefined", () => {
    const { container } = render(<MediaLibrary params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("SeoSettings renders Skeleton while query is undefined", () => {
    const { container } = render(<SeoSettings params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("VersionHistory renders Skeleton while query is undefined", () => {
    const { container } = render(<VersionHistory params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("PaymentsConfig renders Skeleton while config query is undefined", () => {
    const { container } = render(<PaymentsConfig params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("PaymentProviders renders Skeleton while connectors query is undefined", () => {
    const { container } = render(<PaymentProviders params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  it("CrmConnectionConfig renders Skeleton while connection query is undefined", () => {
    const { container } = render(<CrmConnectionConfig params={SITE_PARAMS} />);
    assertSkeleton({ container });
  });

  // ── Admin pages ────────────────────────────────────────────────────────
  // When me === undefined the page renders a Skeleton immediately (no isSuperAdmin
  // check fires yet) — no special first-call override needed.

  it("AdminSites renders Skeleton while me query is undefined", () => {
    const { container } = render(<AdminSites />);
    assertSkeleton({ container });
  });

  it("AdminDesignLock renders Skeleton while me query is undefined", () => {
    const { container } = render(<AdminDesignLock />);
    assertSkeleton({ container });
  });
});
