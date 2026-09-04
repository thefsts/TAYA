/**
 * payment-webhook-url.test.tsx
 *
 * Regression test for the Phase 9 dead-UI audit finding: the Payment
 * Providers → Settings tab used to hardcode the payment webhook endpoint
 * as https://clean-marlin-94.convex.cloud/... — a dead, retired dev
 * deployment — instead of the deployment the client's dashboard actually
 * runs on. Any client who registered that URL in Square/Stripe's webhook
 * dashboard would silently receive no payment events.
 *
 * This suite verifies:
 *   1. The rendered webhook URL is derived from VITE_CONVEX_URL with the
 *      *.convex.cloud host swapped for *.convex.site (Convex HTTP actions
 *      are served from .convex.site; .convex.cloud 404s HTTP routes).
 *   2. No stale deployment host ever appears in the rendered output.
 *   3. Provider + slug are interpolated from live site/connector data,
 *      defaulting the provider to "square".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ─────────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

/* ── External / framework mocks (mirrors module-access-denied.test.tsx) ── */

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

// AppLayout — render children directly so page content is visible in tests
vi.mock("@/pages/app/SiteDashboard", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

/* ── Test data ────────────────────────────────────────────────────────── */

const SITE_PARAMS = { siteId: "site_test123" };

/** A connected square connector, as returned by api.paymentConnectors.getActiveConnector */
const CONNECTED_CONNECTOR = {
  _id: "connector_sq",
  provider: "square",
  status: "connected",
  checkoutEnabled: true,
  hasWebhookKey: true,
};

/** The site record, as returned by api.sites.get */
const SITE = {
  _id: "site_test123",
  slug: "corsair-tactical-solutions",
  name: "Corsair Tactical Solutions",
};

/**
 * Render the page with a stubbed build-time VITE_CONVEX_URL and activate
 * the Settings tab.
 *
 * vi.stubEnv + vi.resetModules + dynamic import are used because the page
 * reads import.meta.env.VITE_CONVEX_URL at module-evaluation time.
 * useQuery dispatches on the api path token (the api proxy passes its
 * resolved path string as the first argument).
 */
async function renderSettingsTab(convexUrl: string, connector: unknown) {
  vi.resetModules();
  vi.stubEnv("VITE_CONVEX_URL", convexUrl);
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockUseAction.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
  mockUseQuery.mockImplementation((apiPath: unknown) => {
    // The api proxy is a function whose apply() returns its resolved path
    // string (e.g. "api.paymentConnectors.listConnectors").
    let path = "";
    try {
      path = typeof apiPath === "function" ? String((apiPath as () => string)()) : "";
    } catch {
      path = "";
    }
    if (path.includes("paymentConnectors.getActiveConnector")) return connector;
    if (path.includes("paymentConnectors.listConnectors")) return []; // ProvidersTab
    if (path.includes("sites.get")) return SITE; // SettingsTab
    return undefined; // any other query stays loading
  });

  const Mod = await import("@/pages/app/sites/PaymentProviders");
  const { unmount } = render(<Mod.default params={SITE_PARAMS} />);

  // Settings is the 4th tab. Radix TabsTrigger activates on mousedown.
  const settingsTab = screen
    .getAllByRole("tab")
    .find((el) => el.textContent?.includes("Settings"));
  if (!settingsTab) throw new Error("Settings tab not found");
  fireEvent.mouseDown(settingsTab);
  await act(async () => { await Promise.resolve(); });

  return { unmount };
}

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockUseAction.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

/* ── Tests ────────────────────────────────────────────────────────────── */

describe("PaymentProviders — webhook endpoint URL (Phase 9 dead-UI regression)", () => {
  it("derives the webhook URL from VITE_CONVEX_URL and serves it from convex.site", async () => {
    const { unmount } = await renderSettingsTab(
      "https://uncommon-cobra-336.convex.cloud",
      CONNECTED_CONNECTOR
    );

    const urlBox = screen.getByText(/api\/payment\/webhook/);
    expect(urlBox.textContent).toBe(
      "https://uncommon-cobra-336.convex.site/api/payment/webhook?provider=square&slug=corsair-tactical-solutions"
    );
    // The retired deployment host must never appear.
    expect(urlBox.textContent).not.toContain("clean-marlin-94");
    unmount();
  });

  it("follows a custom dev deployment URL too (no hardcoded prod host)", async () => {
    const { unmount } = await renderSettingsTab(
      "https://dev-deployment-abc123.convex.cloud",
      CONNECTED_CONNECTOR
    );

    const urlBox = screen.getByText(/api\/payment\/webhook/);
    expect(urlBox.textContent).toContain(
      "https://dev-deployment-abc123.convex.site/api/payment/webhook?provider=square"
    );
    expect(urlBox.textContent).not.toContain("uncommon-cobra-336");
    expect(urlBox.textContent).not.toContain("clean-marlin-94");
    unmount();
  });

  it("defaults provider to square when the connector record lacks a provider", async () => {
    const connectorWithoutProvider = { ...CONNECTED_CONNECTOR, provider: undefined };
    const { unmount } = await renderSettingsTab(
      "https://uncommon-cobra-336.convex.cloud",
      connectorWithoutProvider
    );

    const urlBox = screen.getByText(/api\/payment\/webhook/);
    expect(urlBox.textContent).toContain("provider=square");
    expect(urlBox.textContent).toContain("slug=corsair-tactical-solutions");
    unmount();
  });
});
