/**
 * site-dashboard.test.tsx
 *
 * Phase 3 test suite (updated for Phase 6 adaptive dashboard): Simple Client
 * Dashboard body (SiteDashboard default export).
 *
 * Covers three Phase 3 contracts, recomposed through the Phase 6 single
 * capability model (useSiteCapabilities):
 *   1. Real-data stat cards — seven cards including the new Services card
 *      (serviceCount from getDashboardSummary), zero counts render as 0.
 *      Cards now render only when the capability model says the viewer can
 *      see them (owner fixture: full truthful permissions map).
 *   2. Permission-aware Quick Edit — links hidden when the capability model
 *      hides them (module false OR permission none), shown when enabled;
 *      unknown modules/permissions → CORE-ONLY (optional items hidden —
 *      PM Decision 3, never guess).
 *   3. Inviting empty states — Upcoming Events / Upcoming Courses / Recent
 *      Media sections render with a call-to-action when empty, instead of
 *      silently disappearing.
 *
 * Phase 6 fixture change (deliberate): the default workspace now mocks
 * api.accessControl.getMyPermissions with the truthful OWNER row from
 * src/lib/roleCapabilities.ts (the mirrored enforcement matrix). Old tests
 * relied on "modules null → show everything"; the adaptive model treats
 * unknown permissions as core-only, so a viewer truth must be supplied.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ───────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_test123" }));

// ── External / framework mocks ─────────────────────────────────────────────

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
  useLocation: () => [mockLocation.value, vi.fn()],
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

vi.mock("@/components/AIAssistant", () => ({ AIAssistant: () => null }));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import SiteDashboard from "@/pages/app/SiteDashboard";
import { ROLE_CAPABILITIES } from "@/lib/roleCapabilities";

// ── Fixtures ───────────────────────────────────────────────────────────────

const SITE_ID = "site_test123";

const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
};

/**
 * Truthful getMyPermissions payloads derived from the real enforcement
 * matrix (src/lib/roleCapabilities.ts — mirrored from convex). The dashboard
 * composes from the capability model, so tests must supply a viewer truth
 * instead of relying on the old "null modules shows everything" behavior.
 */
const OWNER_PERMISSIONS = {
  isSuperAdmin: false,
  role: "owner",
  permissions: ROLE_CAPABILITIES.owner,
};
const READ_ONLY_PERMISSIONS = {
  isSuperAdmin: false,
  role: "read_only",
  permissions: ROLE_CAPABILITIES.read_only,
};

function summary(overrides: Record<string, unknown> = {}) {
  return {
    siteId: SITE_ID,
    courseCount: 3,
    eventCount: 5,
    articleCount: 7,
    serviceCount: 2,
    publishedArticles: 4,
    draftArticles: 3,
    mediaCount: 9,
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
    ...overrides,
  };
}

/** Configure the convex useQuery mock for the SiteDashboard body queries. */
function dashboardWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.getDashboardSummary": summary(),
    "api.sites.get": SITE,
    // Phase 6 default: known module map with no explicit decisions — the
    // owner truth above makes optional capabilities visible. (The old null
    // default now means CORE-ONLY under the adaptive capability model.)
    "api.sites.getEffectiveModules": {},
    "api.healthScans.getLatestScan": null,
    "api.healthScans.getNotifications": null,
    "api.courses.listActionRequired": null,
    "api.events.listActionRequired": null,
    "api.flyers.listExpiringSoon": null,
    // AppLayout (rendered inside) queries:
    "api.users.me": { _id: "user_client_1", isSuperAdmin: false, roles: [] },
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 0 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    // Phase 6: truthful viewer permissions (owner row from the matrix).
    "api.accessControl.getMyPermissions": OWNER_PERMISSIONS,
    ...overrides,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    // Preserve explicitly-provided undefined (convex "loading"), fall back to
    // null only for paths the fixture did not configure.
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

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_test123";
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── 1. Real-data stat cards (incl. Services) ──────────────────────────────

/** Stat-card titles render inside a div with class "text-sm font-medium text-slate-500"
 *  (StatCard's CardTitle). Sidebar nav labels share the same text but render as
 *  spans inside buttons, so we scope by that class to avoid cross-matches. */
function statTitles(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("div.text-sm.font-medium.text-slate-500"))
    .map((el) => el.textContent?.trim() ?? "");
}

describe("SiteDashboard — stat cards", () => {
  it("renders all seven stat cards including Services", () => {
    dashboardWorkspace();
    renderDashboard();

    // Phase 6: stat-card titles come from the capability model's label
    // (registry default — the SAME source the sidebar derives from), so
    // Courses renders as "Courses & Classes" and articles as "Blog & Articles".
    const titles = statTitles();
    for (const title of ["Courses & Classes", "Events", "Blog & Articles", "Services", "Published", "Drafts", "Media"]) {
      expect(titles).toContain(title);
    }
    expect(titles.filter((t) => t === "Services").length).toBe(1);
  });

  it("shows the serviceCount value from the summary", () => {
    dashboardWorkspace({ "api.sites.getDashboardSummary": summary({ serviceCount: 6 }) });
    renderDashboard();

    const servicesValue = document.querySelector("div.text-3xl.font-bold")?.parentElement;
    // All stat values render as mono bold numbers; find the one next to the Services title.
    const values = Array.from(document.querySelectorAll<HTMLElement>("div.font-mono.text-3xl")).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(values).toContain("6");
    void servicesValue;
  });

  it("renders zero counts as 0 (no fake data)", () => {
    dashboardWorkspace({
      "api.sites.getDashboardSummary": summary({
        courseCount: 0, eventCount: 0, articleCount: 0, serviceCount: 0,
        publishedArticles: 0, draftArticles: 0, mediaCount: 0,
      }),
    });
    renderDashboard();

    const values = Array.from(document.querySelectorAll<HTMLElement>("div.font-mono.text-3xl")).map(
      (el) => el.textContent?.trim() ?? "",
    );
    expect(values.filter((v) => v === "0").length).toBe(7);
  });

  it("renders loading skeletons while the summary is loading", () => {
    dashboardWorkspace({ "api.sites.getDashboardSummary": undefined });
    renderDashboard();

    // No stat titles and no failure message while loading.
    expect(statTitles()).toEqual([]);
    expect(screen.queryByText("Failed to load dashboard summary.")).toBeNull();
    expect(containerSkeletons()).toBeGreaterThanOrEqual(4);
  });
});

// ── 2. Permission-aware Quick Edit ────────────────────────────────────────

describe("SiteDashboard — Quick Edit module gating", () => {
  const QUICK_EDIT_LABELS = ["Edit Homepage", "Write Article", "Add Event", "Add Course", "Upload Media"];

  it("shows all five quick actions when all modules are true (owner viewer)", () => {
    dashboardWorkspace({
      "api.sites.getEffectiveModules": {
        homepage: true, articles: true, events: true, courses: true, media: true,
      },
    });
    renderDashboard();

    for (const label of QUICK_EDIT_LABELS) {
      expect(screen.queryByText(label)).not.toBeNull();
    }
  });

  it("shows all five quick actions when modules are unset (owner defaults)", () => {
    dashboardWorkspace({ "api.sites.getEffectiveModules": {} });
    renderDashboard();

    for (const label of QUICK_EDIT_LABELS) {
      expect(screen.queryByText(label)).not.toBeNull();
    }
  });

  it("CORE-ONLY fallback: unknown permissions (null) hide optional quick actions (PM decision 3)", () => {
    dashboardWorkspace({ "api.accessControl.getMyPermissions": null });
    renderDashboard();

    // All five quick actions are optional-tier capabilities. While the
    // permission truth is loading/failed, none may be guessed into
    // existence — the workspace shows core-only affordances instead.
    for (const label of QUICK_EDIT_LABELS) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // Core sidebar surfaces remain reachable.
    expect(screen.queryByText("All Pages")).not.toBeNull();
  });

  it("hides Add Event and Add Course when events/courses modules are false", () => {
    dashboardWorkspace({
      "api.sites.getEffectiveModules": { events: false, courses: false },
    });
    renderDashboard();

    expect(screen.queryByText("Add Event")).toBeNull();
    expect(screen.queryByText("Add Course")).toBeNull();
    expect(screen.queryByText("Edit Homepage")).not.toBeNull();
    expect(screen.queryByText("Write Article")).not.toBeNull();
    expect(screen.queryByText("Upload Media")).not.toBeNull();
  });

  it("hides every quick action when every module is false", () => {
    dashboardWorkspace({
      "api.sites.getEffectiveModules": {
        homepage: false, articles: false, events: false, courses: false, media: false,
      },
    });
    renderDashboard();

    for (const label of QUICK_EDIT_LABELS) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // The Quick Edit card itself remains (empty card is fine; heading stays).
    expect(screen.queryByText("Quick Edit")).not.toBeNull();
  });
});

// ── 3. Inviting empty states ──────────────────────────────────────────────

describe("SiteDashboard — empty-state sections", () => {
  it("shows the Upcoming Events card with a call-to-action when there are no events", () => {
    dashboardWorkspace();
    renderDashboard();

    expect(screen.queryByText("Upcoming Events")).not.toBeNull();
    expect(screen.queryByText("No upcoming events")).not.toBeNull();
    expect(screen.queryByText("Schedule your first event")).not.toBeNull();
  });

  it("shows the Upcoming Courses card with a call-to-action when there are no courses", () => {
    dashboardWorkspace();
    renderDashboard();

    expect(screen.queryByText("Upcoming Courses")).not.toBeNull();
    expect(screen.queryByText("No upcoming courses")).not.toBeNull();
    expect(screen.queryByText("Create your first course")).not.toBeNull();
  });

  it("shows the Recent Media card with a call-to-action when the library is empty", () => {
    dashboardWorkspace();
    renderDashboard();
    expect(screen.queryByText("Recent Media")).not.toBeNull();
    expect(screen.queryByText("No media yet")).not.toBeNull();
    expect(screen.queryByText("Upload your first image")).not.toBeNull();
    expect(screen.queryByText("Photos and files you upload appear here for quick reuse.")).not.toBeNull();
  });
});

// ── helpers ────────────────────────────────────────────────────────────────

function containerSkeletons(): number {
  return document.querySelectorAll(".animate-pulse, [data-slot='skeleton']").length;
}

// Silence the not-an-image warning from uploads without url.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("Not found: No directive")) return;
  consoleError(...args);
};
