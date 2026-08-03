/**
 * admin-roles-grid.test.tsx
 *
 * Rendering test: mounts the AdminRoles grid and asserts that every role
 * in the ROLES constant produces a visible column header.
 *
 * Purpose: catch the silent regression where a developer adds a new value
 * to ROLES (and wires up ROLE_CAPABILITIES / ROLE_PERMISSIONS) but forgets
 * that ROLE_BADGE_COLORS inside AdminRoles.tsx also needs a new entry —
 * or simply that the component iterates over a different, narrower source
 * and no existing test would fail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ROLES, ROLE_LABELS } from "@/lib/roleCapabilities";

// ── Hoisted mock handles ────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());

// ── External / framework mocks ─────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a stable token string
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
  useParams: () => ({}),
  useRoute: () => [false, {}],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Redirect: () => <div data-testid="redirect" />,
}));

// Tooltip requires a TooltipProvider context in jsdom — stub the whole module
// so tests render without the Radix context chain.
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <span>{children}</span>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  UserButton: () => <button>User</button>,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Page import (after mocks) ───────────────────────────────────────────────

import AdminRoles from "@/pages/app/admin/AdminRoles";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A minimal superadmin object sufficient to pass the isSuperAdmin guard */
const SUPERADMIN = {
  _id: "user_superadmin",
  isSuperAdmin: true,
  email: "admin@fsts.test",
};

function resetMocks() {
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("AdminRoles grid — role completeness", () => {
  beforeEach(resetMocks);

  it("renders a column for every role in ROLES when the user is a superadmin", () => {
    // useQuery(api.users.me) must return a superadmin so the guard passes
    mockUseQuery.mockReturnValue(SUPERADMIN);

    render(<AdminRoles />);

    // The grid header renders one <th> per role using ROLE_LABELS[role].
    // The summary cards at the bottom also repeat each label.
    // getAllByText ensures at least one occurrence is present for each role.
    for (const role of ROLES) {
      const label = ROLE_LABELS[role];
      const matches = screen.getAllByText(label);
      expect(
        matches.length,
        `Expected role '${role}' (label: "${label}") to appear in the grid, but it was not found. ` +
          `Add it to AdminRoles.tsx — likely ROLE_BADGE_COLORS is missing an entry.`,
      ).toBeGreaterThan(0);
    }
  });

  it("renders exactly the same number of role columns as ROLES.length", () => {
    mockUseQuery.mockReturnValue(SUPERADMIN);

    const { container } = render(<AdminRoles />);

    // The thead has one <th> for the permission label column plus one per role
    const headerRow = container.querySelector("thead tr");
    expect(headerRow).not.toBeNull();

    const allHeaderCells = headerRow!.querySelectorAll("th");
    // First th is the "Permission" label column; the rest are role columns
    const roleCellCount = allHeaderCells.length - 1;

    expect(roleCellCount).toBe(ROLES.length);
  });

  it("renders a summary card for every role in ROLES", () => {
    mockUseQuery.mockReturnValue(SUPERADMIN);

    const { container } = render(<AdminRoles />);

    // Summary cards live in the grid below the table.
    // Each card contains the role label and a "permissions granted" line.
    const cards = container.querySelectorAll(".grid > div");
    expect(cards.length).toBe(ROLES.length);
  });

  it("redirects (does not render the grid) when the user is not a superadmin", () => {
    mockUseQuery.mockReturnValue({ _id: "user_1", isSuperAdmin: false, email: "client@test.com" });

    render(<AdminRoles />);

    expect(screen.getByTestId("redirect")).toBeInTheDocument();
    // No role columns should be visible
    for (const role of ROLES) {
      expect(screen.queryByText(ROLE_LABELS[role])).not.toBeInTheDocument();
    }
  });

  it("renders a skeleton while the me query is still loading (undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { container } = render(<AdminRoles />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // The grid table must NOT be present during the loading state
    expect(container.querySelector("table")).toBeNull();
  });
});
