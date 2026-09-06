/**
 * require-app-auth.test.tsx
 *
 * P5 FIX 4 regression suite: RequireAppAuth auth gate for /app/* routes.
 *
 * Defect: before this gate, deep links such as /app/sites/<siteId> rendered
 * the full dashboard shell — sidebar, chrome, marketing copy, auto-opening
 * product-tour modal — for signed-out visitors (a "ghost dashboard").
 *
 * Contract under test:
 *   - /app/* while Clerk is loading → PageSpinner (no dashboard chrome)
 *   - /app/* loaded + signed out → redirect to /sign-in, spinner rendered
 *     (never the children)
 *   - /app/* loaded + signed in → children render untouched
 *   - non-/app paths (/, /sign-in, /portal/*, /forms/*) → children render
 *     regardless of auth state (public routes pass through)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ─── Hoisted mock state ────────────────────────────────────────────────────

const mockUseUser = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_1" }));
const mockSetLocation = vi.hoisted(() => vi.fn());

// ─── Framework mocks ───────────────────────────────────────────────────────

vi.mock("@clerk/react", () => ({
  useUser: mockUseUser,
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => <button>User</button>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wouter", () => ({
  useLocation: () => [mockLocation.value, mockSetLocation],
  useSearch: () => "",
  useParams: () => ({}),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  Redirect: () => null,
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import RequireAppAuth from "@/components/RequireAppAuth";

// ─── Helpers ───────────────────────────────────────────────────────────────

function DashboardProbe() {
  return (
    <div>
      <h1>DASHBOARD CHROME</h1>
      <button>Auto Tour Modal</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLocation.value = "/app/sites/site_1";
});

// ─── /app/* routes ─────────────────────────────────────────────────────────

describe("RequireAppAuth — /app routes", () => {
  it("shows the spinner while Clerk auth is loading (no dashboard chrome)", () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: false, isSignedIn: false });
    const { container } = render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(screen.queryByText("DASHBOARD CHROME")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("redirects signed-out visitors to /sign-in and never renders children", async () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: true, isSignedIn: false });
    const { container } = render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/sign-in");
    });
    expect(screen.queryByText("DASHBOARD CHROME")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders children for signed-in users (gate invisible)", () => {
    mockUseUser.mockReturnValue({
      user: { id: "user_1" },
      isLoaded: true,
      isSignedIn: true,
    });
    render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(screen.getByText("DASHBOARD CHROME")).toBeTruthy();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("gates deep /app links like /app/sites/<id>/settings/analytics", () => {
    mockLocation.value = "/app/sites/site_1/settings/analytics";
    mockUseUser.mockReturnValue({ user: null, isLoaded: true, isSignedIn: false });
    render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(screen.queryByText("DASHBOARD CHROME")).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith("/sign-in");
  });

  it("gates /app root exactly the same way", () => {
    mockLocation.value = "/app";
    mockUseUser.mockReturnValue({ user: null, isLoaded: true, isSignedIn: false });
    render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(mockSetLocation).toHaveBeenCalledWith("/sign-in");
    expect(screen.queryByText("DASHBOARD CHROME")).toBeNull();
  });
});

// ─── Non-/app routes pass through ──────────────────────────────────────────

describe("RequireAppAuth — non-/app routes pass through", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/portal/corsair-tactical-solutions/login",
    "/portal/test-site/dashboard",
    "/forms/contact",
  ])("%s renders children even when signed out", (path) => {
    mockLocation.value = path;
    mockUseUser.mockReturnValue({ user: null, isLoaded: true, isSignedIn: false });
    render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(screen.getByText("DASHBOARD CHROME")).toBeTruthy();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("non-/app path passes through even while Clerk is loading", () => {
    mockLocation.value = "/sign-in";
    mockUseUser.mockReturnValue({ user: null, isLoaded: false, isSignedIn: false });
    render(
      <RequireAppAuth>
        <DashboardProbe />
      </RequireAppAuth>,
    );
    expect(screen.getByText("DASHBOARD CHROME")).toBeTruthy();
  });
});
