/**
 * reviews-embed-copy.test.tsx
 *
 * G-6 (Phase 5 UX closeout) regression suite: client-visible copy must never
 * leak internal architecture terminology. The Reviews Manager embed-widget
 * placeholder notice previously told clients "Convex URL not available — …",
 * exposing the backend stack by name. The fix keeps the behavior identical
 * (a soft amber notice telling the user to save site settings first) but
 * describes the missing thing as a "website connection" — a client-facing
 * concept, not an architecture detail. No architecture change.
 *
 * Contracts verified:
 *   1. When the embed snippet is a placeholder (no slug or no website
 *      connection), the amber notice shows client-facing wording
 *      ("website connection") and does NOT contain "Convex URL" anywhere.
 *   2. The notice keeps its actionable guidance ("save your site settings").
 *   3. The embed section still renders (title + copy/paste card) — the
 *      missing connection is explained, not hidden.
 *   4. When the site HAS a slug and a connection exists, no amber notice
 *      renders (no regression in the happy path).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ───────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

// ── External / framework mocks (match forms-module-parity.test.tsx) ───

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

// Embed-widget snippets are deterministic stubs — the suite tests copy, not
// snippet content, and stubbing removes the real dist bundle from the graph.
vi.mock("@workspace/embed-widget", () => ({
  generateEmbedSnippet: () => "<!-- stub snippet -->",
  generateCdnSnippet: () => "<script><!-- stub --></script>",
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import ReviewsManager from "@/pages/app/sites/ReviewsManager";

// ── Fixtures ───────────────────────────────────────────────────────────

const SITE_PARAMS = { siteId: "site_test123" };

/** A site with NO slug — the embed snippet is a placeholder. */
const SITE_NO_SLUG = {
  _id: "site_test123",
  name: "FSTS Test Site",
  slug: "" as string,
  status: "active",
};

/** A site WITH a slug — connection information is available. */
const SITE_WITH_SLUG = {
  ...SITE_NO_SLUG,
  slug: "fsts-test",
};

const DISPLAY_SETTINGS = { minRating: 4, featuredOnly: false, categoryFilter: "" };
const SOURCES = [];
const REVIEWS = [];

/** Dispatch for a fully-loaded page with the given site fixture. */
function workspace(dispatch: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    "api.sites.get": SITE_NO_SLUG,
    "api.reviews.listSources": SOURCES,
    "api.reviews.listReviews": REVIEWS,
    "api.reviews.getDisplaySettings": DISPLAY_SETTINGS,
    ...dispatch,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(base, path)) return base[path];
    return null;
  });
  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ ok: true }));
  mockUseAction.mockReturnValue(vi.fn());
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ ok: true }));
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── Suite: placeholder embed shows client-facing copy ──────────────────

describe("ReviewsManager Embed Widget — G-6 client-facing copy", () => {
  it("shows the amber notice with 'website connection' wording when the embed is a placeholder", () => {
    workspace();
    render(<ReviewsManager params={SITE_PARAMS} />);

    // The notice must use the client-facing concept…
    expect(screen.getByText(/website connection/i)).toBeInTheDocument();
    // …and must not expose the internal architecture name.
    expect(screen.queryByText(/Convex URL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/convex/i)).not.toBeInTheDocument();
    // Actionable guidance is preserved.
    expect(screen.getByText(/save your site settings/i)).toBeInTheDocument();
  });

  it("renders the embed section with its title (missing connection is explained, not hidden)", () => {
    workspace();
    render(<ReviewsManager params={SITE_PARAMS} />);

    expect(screen.getByRole("heading", { name: /embed widget/i })).toBeInTheDocument();
    expect(screen.getByText(/copy & paste into your website/i)).toBeInTheDocument();
  });

  it("does not show the amber notice when a slug and connection exist (no regression in the happy path)", async () => {
    // CONVEX_HTTP_URL is derived at module scope from
    // import.meta.env.VITE_CONVEX_URL, which is unset in the test
    // environment (so every snippet would be a placeholder regardless of
    // slug). Stub the env, reset the module registry, and re-import so the
    // happy path is exercised with a real connection value.
    vi.stubEnv("VITE_CONVEX_URL", "https://demo-a1b2c3.convex.cloud");
    vi.resetModules();
    const { default: ReviewsManagerFresh } = await import("@/pages/app/sites/ReviewsManager");
    try {
      workspace({ "api.sites.get": SITE_WITH_SLUG });
      render(<ReviewsManagerFresh params={SITE_PARAMS} />);

      expect(screen.queryByText(/not available/i)).not.toBeInTheDocument();
      // The embed card itself still renders with a real (stub) snippet.
      expect(screen.getByText(/copy & paste into your website/i)).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
