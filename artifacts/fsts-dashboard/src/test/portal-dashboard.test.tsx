/**
 * portal-dashboard.test.tsx
 *
 * P5 FIX 1 regression suite: PortalDashboard member view.
 *
 * Defects covered:
 *   1. Dead NavLinks — the sidebar "My Profile" / "Account Settings" /
 *      feature links were cursor-pointer DIVs with no onClick, so members
 *      could never leave the dashboard view. They are now real <button>
 *      elements wired to section state.
 *   2. Feature-key mismatch — production portal configs seeded legacy keys
 *      (courseMaterials / bookingHistory / messaging) while the UI looks up
 *      canonical keys (courses / events / ...). The component normalizes via
 *      convex/lib/portalFeatures so a legacy-keyed config still renders its
 *      feature sections.
 *
 * Also covers the new self-service flows:
 *   - Profile save → updateMyProfile action called with token + trimmed names
 *   - Password change validation (required fields, ≥8 chars, match)
 *   - Sign out → logout mutation + localStorage clear + redirect to portal login
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";

// ─── Hoisted mock handles ──────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockSetLocation = vi.hoisted(() => vi.fn());
const mockLocationValue = vi.hoisted(() => ({
  value: "/portal/test-site/dashboard",
}));

// ─── Framework mocks ───────────────────────────────────────────────────────

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
  useLocation: () => [mockLocationValue.value, mockSetLocation],
  useSearch: () => "",
  useParams: () => ({ siteSlug: "test-site" }),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  Redirect: () => null,
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import PortalDashboard from "@/pages/portal/PortalDashboard";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TOKEN = "tok_abc123";
const SLUG = "test-site";

const SESSION_USER = {
  _id: "pu_1",
  firstName: "Maria",
  lastName: "Hernandez",
  email: "maria@example.com",
  role: "member",
  status: "active",
  profileData: { phone: "555-0100" },
};

const VALIDATE_SESSION = { user: SESSION_USER };

function siteConfig(enabledFeatures: Record<string, unknown>) {
  return {
    siteName: "Test Site Co",
    welcomeMessage: "Welcome to your portal",
    portalPrimaryColor: "#16a34a",
    sitePrimaryColor: "#16a34a",
    portalLogoUrl: null,
    siteLogoUrl: null,
    enabledFeatures,
  };
}

function setupQueryDispatch(config: Record<string, unknown>) {
  // The api Proxy mock is a function that returns its path string when
  // invoked (matching the repo's established pattern in
  // site-dashboard.test.tsx).
  mockUseQuery.mockImplementation((fnRef: unknown) => {
    const path = resolvePath(fnRef);
    if (path.includes("validateSession")) return VALIDATE_SESSION;
    if (path.includes("getPublicSiteConfig")) return config;
    return undefined;
  });
}

function resolvePath(fnRef: unknown): string {
  if (typeof fnRef === "function") {
    const v = (fnRef as () => unknown)();
    return String(v);
  }
  return String(fnRef);
}

function setupActions() {
  const profileAction = vi.fn().mockResolvedValue({ success: true });
  const passwordAction = vi.fn().mockResolvedValue({ success: true });
  mockUseAction.mockImplementation((fnRef: unknown) => {
    const path = resolvePath(fnRef);
    if (path.includes("updateMyProfile")) return profileAction;
    if (path.includes("updateMyPassword")) return passwordAction;
    return vi.fn();
  });
  return { profileAction, passwordAction };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.localStorage.setItem(
    `portal_session_${SLUG}`,
    JSON.stringify({ token: TOKEN, user: { ...SESSION_USER, profileData: undefined } }),
  );
  mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));
});

afterEach(() => {
  window.localStorage.clear();
});

// ─── Section 1: Dead NavLink fix ───────────────────────────────────────────

describe("P5 FIX 1a — sidebar NavLinks are real interactive buttons", () => {
  it("renders My Profile / Account Settings / feature links as buttons", () => {
    setupQueryDispatch(siteConfig({ courses: true }));
    setupActions();
    render(<PortalDashboard />);
    const profileBtn = screen.getByRole("button", { name: /my profile/i });
    const settingsBtn = screen.getByRole("button", { name: /account settings/i });
    const coursesBtn = screen.getByRole("button", { name: /my courses/i });
    expect(profileBtn.tagName).toBe("BUTTON");
    expect(settingsBtn.tagName).toBe("BUTTON");
    expect(coursesBtn.tagName).toBe("BUTTON");
  });

  it("clicking My Profile switches to the profile section", async () => {
    setupQueryDispatch(siteConfig({}));
    setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /my profile/i }));
    expect(screen.getByTestId("portal-profile-section")).toBeTruthy();
  });

  it("clicking Account Settings switches to the password section", async () => {
    setupQueryDispatch(siteConfig({}));
    setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /account settings/i }));
    expect(screen.getByTestId("portal-password-section")).toBeTruthy();
  });

  it("clicking a feature NavLink switches to that feature section", async () => {
    setupQueryDispatch(siteConfig({ certificates: true }));
    setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /certificates/i }));
    // The section blurb is unique to the Certificates feature section.
    expect(screen.getByText(/earned certificates/i)).toBeTruthy();
  });

  it("disabled features never appear in the sidebar", () => {
    setupQueryDispatch(siteConfig({ courses: false, certificates: false }));
    setupActions();
    render(<PortalDashboard />);
    expect(screen.queryByRole("button", { name: /my courses/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /certificates/i })).toBeNull();
  });

  it("clicking Dashboard returns from a feature section", async () => {
    setupQueryDispatch(siteConfig({ courses: true }));
    setupActions();
    render(<PortalDashboard />);
    // Enter the Courses section (blurb card is the section body)
    fireEvent.click(screen.getByRole("button", { name: /my courses/i }));
    // Back to Dashboard: the account summary cards render again
    fireEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));
    expect(screen.queryByTestId("portal-profile-section")).toBeNull();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Portal")).toBeTruthy();
  });
});

// ─── Section 2: feature-key normalization ──────────────────────────────────

describe("P5 FIX 1b — legacy feature keys normalize to canonical", () => {
  it("legacy courseMaterials:true renders the My Courses section", () => {
    setupQueryDispatch(
      siteConfig({
        courseMaterials: true,
        bookingHistory: false,
        messaging: false,
        certificates: true,
      }),
    );
    setupActions();
    render(<PortalDashboard />);
    expect(screen.getByRole("button", { name: /my courses/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /certificates/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /my events/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /messages/i })).toBeNull();
  });

  it("production Corsair config shape (legacy keys) renders correctly", () => {
    // Exact production defect shape
    setupQueryDispatch(
      siteConfig({
        bookingHistory: true,
        certificates: true,
        courseMaterials: true,
        messaging: false,
      }),
    );
    setupActions();
    render(<PortalDashboard />);
    expect(screen.getByRole("button", { name: /my courses/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /my events/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /certificates/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /my documents/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /invoices/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /support/i })).toBeNull();
  });

  it("canonical false beats legacy alias true (explicit admin disable)", () => {
    setupQueryDispatch(siteConfig({ courses: false, courseMaterials: true }));
    setupActions();
    render(<PortalDashboard />);
    expect(screen.queryByRole("button", { name: /my courses/i })).toBeNull();
  });

  it("all seven features render when all enabled canonically", () => {
    setupQueryDispatch(
      siteConfig({
        courses: true,
        events: true,
        documents: true,
        messages: true,
        invoices: true,
        certificates: true,
        support: true,
      }),
    );
    setupActions();
    render(<PortalDashboard />);
    for (const label of [
      "My Courses",
      "My Events",
      "Documents",
      "Messages",
      "Invoices",
      "Certificates",
      "Support",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") })).toBeTruthy();
    }
  });
});

// ─── Section 3: Profile save ───────────────────────────────────────────────

describe("P5 FIX 1c — profile self-service", () => {
  it("saves trimmed first/last name via updateMyProfile action", async () => {
    setupQueryDispatch(siteConfig({}));
    const { profileAction } = setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /my profile/i }));

    const first = screen.getByLabelText(/first name/i);
    const last = screen.getByLabelText(/last name/i);
    fireEvent.change(first, { target: { value: "" } });
    fireEvent.change(first, { target: { value: "  Marie  " } });
    fireEvent.change(last, { target: { value: "" } });
    fireEvent.change(last, { target: { value: " Hernandez-Perez " } });

    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => {
      expect(profileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          token: TOKEN,
          firstName: "Marie",
          lastName: "Hernandez-Perez",
        }),
      );
    });
    expect(screen.getByText("Profile saved.")).toBeTruthy();
  });

  it("blocks empty first/last name with an error banner", async () => {
    setupQueryDispatch(siteConfig({}));
    const { profileAction } = setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /my profile/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    expect(
      screen.getByText("First and last name are required."),
    ).toBeTruthy();
    expect(profileAction).not.toHaveBeenCalled();
  });

  it("email is read-only (admin-controlled)", async () => {
    setupQueryDispatch(siteConfig({}));
    setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /my profile/i }));
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(email).toHaveProperty("readOnly", true);
    expect(email.value).toBe("maria@example.com");
  });
});

// ─── Section 4: Password change ────────────────────────────────────────────

describe("P5 FIX 1d — password self-service validation", () => {
  async function openPasswordSection() {
    setupQueryDispatch(siteConfig({}));
    const { passwordAction } = setupActions();
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /account settings/i }));
    return { passwordAction };
  }

  it("requires all three fields", async () => {
    const { passwordAction } = await openPasswordSection();
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(
      screen.getByText("All three password fields are required."),
    ).toBeTruthy();
    expect(passwordAction).not.toHaveBeenCalled();
  });

  it("requires 8+ character new password", async () => {
    const { passwordAction } = await openPasswordSection();
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "oldpass123" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(
      screen.getByText("New password must be at least 8 characters."),
    ).toBeTruthy();
    expect(passwordAction).not.toHaveBeenCalled();
  });

  it("requires confirmation to match", async () => {
    const { passwordAction } = await openPasswordSection();
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "oldpass123" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newpass456" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(
      screen.getByText("New password and confirmation do not match."),
    ).toBeTruthy();
    expect(passwordAction).not.toHaveBeenCalled();
  });

  it("valid change calls updateMyPassword with token + current + new", async () => {
    const { passwordAction } = await openPasswordSection();
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "oldpass123" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newpass456" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "newpass456" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => {
      expect(passwordAction).toHaveBeenCalledWith({
        token: TOKEN,
        currentPassword: "oldpass123",
        newPassword: "newpass456",
      });
    });
    expect(screen.getByText("Password updated.")).toBeTruthy();
  });

  it("surfaces a server-side error from the action", async () => {
    setupQueryDispatch(siteConfig({}));
    mockUseAction.mockImplementation((fnRef: unknown) => {
      const path = resolvePath(fnRef);
      if (path.includes("updateMyPassword"))
        return vi
          .fn()
          .mockResolvedValue({ success: false, error: "Your current password is incorrect." });
      return vi.fn();
    });
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /account settings/i }));
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "wrongpass1" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newpass456" } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "newpass456" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText("Your current password is incorrect.")).toBeTruthy();
    });
  });
});

// ─── Section 5: Sign out ───────────────────────────────────────────────────

describe("sign out", () => {
  it("logs out, clears localStorage session, redirects to portal login", async () => {
    setupQueryDispatch(siteConfig({}));
    const logoutMutation = vi.fn().mockResolvedValue(undefined);
    mockUseMutation.mockImplementation((fnRef: unknown) => {
      if (resolvePath(fnRef).includes("logout")) return logoutMutation;
      return vi.fn();
    });
    render(<PortalDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      expect(logoutMutation).toHaveBeenCalledWith({ token: TOKEN });
    });
    expect(
      window.localStorage.getItem(`portal_session_${SLUG}`),
    ).toBeNull();
    expect(mockSetLocation).toHaveBeenCalledWith(`/portal/${SLUG}/login`);
  });
});
