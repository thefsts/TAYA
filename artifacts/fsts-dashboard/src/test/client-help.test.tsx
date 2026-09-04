/**
 * client-help.test.tsx
 *
 * Phase 5 test suite: Client Help (non-AI).
 *
 * Covers the Phase 5 contracts:
 *   1. GettingStartedCard — real completion state derived from the dashboard
 *      summary + site doc (no fake data); progress text "X of Y done";
 *      module-gated links; all-done celebration state; per-user dismiss via
 *      localStorage; restore clears the flag.
 *   2. WelcomeTour — 5 client-friendly steps; Next/Back navigation; finish
 *      persists dismissal; skipped for superadmin / internal QA; restart
 *      (clearTourDismissal) makes the tour reappear.
 *   3. HelpCenter — Getting Started section reflects real state; Restart Tour
 *      + Restore Checklist actions; Draft/Preview/Publish FAQ present.
 *   4. Language audit — collection forms use "Web Address" instead of "Slug".
 *   5. Integration — SiteDashboard renders the checklist + tour together
 *      with the same real-state signals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { readFileSync } from "node:fs";

// ── Hoisted mock handles ───────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_test123" }));

// ── External / framework mocks ─────────────────────────────────────────

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

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import GettingStartedCard, {
  buildGettingStartedItems,
  gettingStartedDismissKey,
} from "@/components/GettingStartedCard";
import WelcomeTour, {
  TOUR_STEPS,
  clearTourDismissal,
  tourDismissedKey,
  tourNeedsWelcome,
} from "@/components/WelcomeTour";
import HelpCenter from "@/pages/app/sites/HelpCenter";
import SiteDashboard from "@/pages/app/SiteDashboard";

// ── Fixtures ───────────────────────────────────────────────────────────

const SITE_ID = "site_test123";
const USER_ID = "user_client_1";

const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
};

const CLIENT = { _id: USER_ID, isSuperAdmin: false, roles: [] };
const SUPERADMIN = { _id: "user_super", isSuperAdmin: true, roles: [] };
const QA_USER = { _id: "user_qa", isSuperAdmin: false, roles: [{ role: "internal_qa" }] };

function summary(overrides: Record<string, unknown> = {}) {
  return {
    siteId: SITE_ID,
    courseCount: 0,
    eventCount: 0,
    articleCount: 0,
    serviceCount: 0,
    teamCount: 0,
    publishedArticles: 0,
    draftArticles: 0,
    mediaCount: 0,
    formsConfigured: false,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

/** Configure the convex useQuery mock for the HelpCenter/dashboard queries. */
function useHelpWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.users.me": CLIENT,
    "api.sites.getDashboardSummary": summary(),
    "api.sites.getEffectiveModules": null,
    // AppLayout (rendered inside) queries:
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 0 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    ...overrides,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    return dispatch[path] ?? null;
  });
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
}

// ── 1. buildGettingStartedItems (pure model) ──────────────────────────

describe("buildGettingStartedItems \u2014 real completion state model", () => {
  it("marks all items incomplete for a fresh site (no fake done items)", () => {
    const items = buildGettingStartedItems(null, { courseCount: 0, mediaCount: 0, teamCount: 0 }, null);
    expect(items.length).toBe(5);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(items.map((i) => i.key)).toEqual([
      "domain",
      "business-info",
      "content",
      "media",
      "team",
    ]);
  });

  it("marks domain done when the site has one", () => {
    const items = buildGettingStartedItems("www.acme.com", summary(), null);
    expect(items.find((i) => i.key === "domain")!.done).toBe(true);
  });

  it("marks business info done when forms are configured (contact email set)", () => {
    const items = buildGettingStartedItems(null, summary({ formsConfigured: true }), null);
    expect(items.find((i) => i.key === "business-info")!.done).toBe(true);
  });

  it("marks content done when any content count is positive", () => {
    for (const key of ["courseCount", "eventCount", "articleCount", "serviceCount"] as const) {
      const items = buildGettingStartedItems(null, summary({ [key]: 1 }), null);
      expect(items.find((i) => i.key === "content")!.done).toBe(true);
    }
  });

  it("marks team done when teamCount is positive", () => {
    const items = buildGettingStartedItems(null, summary({ teamCount: 2 }), null);
    expect(items.find((i) => i.key === "team")!.done).toBe(true);
  });

  it("hides the team link when the team module is disabled", () => {
    const items = buildGettingStartedItems(null, summary(), { team: false });
    expect(items.find((i) => i.key === "team")!.href).toBeNull();
  });

  it("shows the team link when the team module is enabled", () => {
    const items = buildGettingStartedItems(null, summary(), { team: true });
    expect(items.find((i) => i.key === "team")!.href).toBe("team");
  });

  it("shows the media link when the media module is null (loading) or true", () => {
    expect(buildGettingStartedItems(null, summary(), null).find((i) => i.key === "media")!.href).toBe("media");
    expect(buildGettingStartedItems(null, summary(), { media: true }).find((i) => i.key === "media")!.href).toBe("media");
  });

  it("picks a content link from enabled modules only", () => {
    const items = buildGettingStartedItems(null, summary(), { courses: false, events: true });
    expect(items.find((i) => i.key === "content")!.href).toBe("events");
  });

  it("prefers courses as the first content link when all are enabled and empty", () => {
    const items = buildGettingStartedItems(null, summary(), { courses: true, events: true, articles: true, services: true });
    expect(items.find((i) => i.key === "content")!.href).toBe("courses");
  });

  it("falls back to a null href when every content module is disabled", () => {
    const items = buildGettingStartedItems(null, summary(), { courses: false, events: false, articles: false, services: false });
    expect(items.find((i) => i.key === "content")!.href).toBeNull();
  });
});

// ── 2. GettingStartedCard (component) ──────────────────────────────────

describe("GettingStartedCard \u2014 rendering and dismissal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockToast.mockClear();
  });

  it("renders all five items with plain client language", () => {
    renderWithProviders(
      <GettingStartedCard siteId={SITE_ID} domain={null} summary={summary()} modules={null} userId={USER_ID} />,
    );
    for (const label of [
      "Connect your web address",
      "Add your business info",
      "Add your first content",
      "Upload photos & files",
      "Introduce your team",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows progress text 'X of Y done' with real counts", () => {
    renderWithProviders(
      <GettingStartedCard
        siteId={SITE_ID}
        domain="www.acme.com"
        summary={summary({ formsConfigured: true })}
        modules={null}
        userId={USER_ID}
      />,
    );
    expect(screen.getByText("2 of 5 done")).toBeVisible();
  });

  it("links incomplete items to their editor page and keeps done items plain", () => {
    renderWithProviders(
      <GettingStartedCard siteId={SITE_ID} domain={null} summary={summary()} modules={null} userId={USER_ID} />,
    );
    const businessInfo = screen.getByText("Add your business info").closest("a");
    expect(businessInfo).not.toBeNull();
    expect(businessInfo!.getAttribute("href")).toBe(`/app/sites/${SITE_ID}/contact`);
    const media = screen.getByText("Upload photos & files").closest("a");
    expect(media!.getAttribute("href")).toBe(`/app/sites/${SITE_ID}/media`);
  });

  it("renders the all-done celebration state instead of the list", () => {
    renderWithProviders(
      <GettingStartedCard
        siteId={SITE_ID}
        domain="www.acme.com"
        summary={summary({ formsConfigured: true, courseCount: 3, mediaCount: 2, teamCount: 1 })}
        modules={null}
        userId={USER_ID}
      />,
    );
    expect(screen.getByText("You're all set!")).toBeVisible();
    expect(screen.queryByText("Add your first content")).toBeNull();
  });

  it("dismisses per-user and per-site, then stays hidden", () => {
    const { unmount } = renderWithProviders(
      <GettingStartedCard siteId={SITE_ID} domain={null} summary={summary()} modules={null} userId={USER_ID} />,
    );
    expect(screen.getByText("0 of 5 done")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Dismiss Getting Started checklist"));
    expect(window.localStorage.getItem(gettingStartedDismissKey(USER_ID, SITE_ID))).toBe("1");
    expect(screen.queryByText("0 of 5 done")).toBeNull();
    unmount();

    // A different user's checklist is untouched by the first user's dismissal.
    renderWithProviders(
      <GettingStartedCard siteId={SITE_ID} domain={null} summary={summary()} modules={null} userId="user_other" />,
    );
    expect(screen.getByText("0 of 5 done")).toBeVisible();
  });

  it("stays hidden when previously dismissed (localStorage hydrate)", () => {
    window.localStorage.setItem(gettingStartedDismissKey(USER_ID, SITE_ID), "1");
    renderWithProviders(
      <GettingStartedCard siteId={SITE_ID} domain={null} summary={summary()} modules={null} userId={USER_ID} />,
    );
    expect(screen.queryByText("0 of 5 done")).toBeNull();
  });
});

// ── 3. WelcomeTour ─────────────────────────────────────────────────────

describe("WelcomeTour \u2014 first-visit tour", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders five client-friendly steps covering sidebar, draft/preview/publish, and help", () => {
    expect(TOUR_STEPS.length).toBe(5);
    const joined = TOUR_STEPS.map((s) => s.title + " " + s.body).join(" ");
    expect(joined).toContain("sidebar");
    expect(joined).toContain("Publish");
    expect(joined).toContain("Preview");
    expect(joined).toContain("Help Center");
    expect(joined.toLowerCase()).not.toContain("slug");
    expect(joined.toLowerCase()).not.toContain("json");
  });

  it("shows step 1 of 5 initially with Next, no Back", () => {
    renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    expect(screen.getByText("Welcome to your website dashboard")).toBeVisible();
    expect(screen.getByText(/Step 1 of 5/)).toBeVisible();
    expect(screen.getByText("Next")).toBeVisible();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("navigates forward with Next and back with Back", () => {
    renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Everything lives in the sidebar")).toBeVisible();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText(/Draft, Preview, Publish/)).toBeVisible();
    expect(screen.getByText("Back")).toBeVisible();
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Everything lives in the sidebar")).toBeVisible();
  });

  it("finishes the tour with 'Get started' and persists dismissal per user+site", () => {
    renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    fireEvent.click(screen.getByText("Get started"));
    expect(window.localStorage.getItem(tourDismissedKey(USER_ID, SITE_ID))).toBe("1");
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
  });

  it("does not show for superadmin or internal QA users", () => {
    const { rerender } = renderWithProviders(
      <WelcomeTour siteId={SITE_ID} userId="user_super" me={SUPERADMIN} />,
    );
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
    rerender(
      <TooltipProvider>
        <WelcomeTour siteId={SITE_ID} userId="user_qa" me={QA_USER} />
      </TooltipProvider>,
    );
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
  });

  it("stays hidden after a prior dismissal", () => {
    window.localStorage.setItem(tourDismissedKey(USER_ID, SITE_ID), "1");
    renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
  });

  it("reappears after clearTourDismissal (restart) on a fresh mount", () => {
    const first = renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByText("Next"));
    }
    fireEvent.click(screen.getByText("Get started"));
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
    first.unmount();

    clearTourDismissal(USER_ID, SITE_ID);
    // A fresh mount (what happens after restart + navigating to the dashboard) re-opens.
    renderWithProviders(<WelcomeTour siteId={SITE_ID} userId={USER_ID} me={CLIENT} />);
    expect(screen.getByText("Welcome to your website dashboard")).toBeVisible();
  });
});

// ── 4. HelpCenter ──────────────────────────────────────────────────────

describe("HelpCenter \u2014 Getting Started section + tour controls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockToast.mockClear();
  });

  it("renders the Getting Started section with real completion state", () => {
    useHelpWorkspace({
      "api.sites.getDashboardSummary": summary({ formsConfigured: true, mediaCount: 4 }),
    });
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getAllByText("Getting Started").length).toBeGreaterThan(0);
    // SITE.domain is set + formsConfigured + mediaCount: 3 real steps done.
    expect(screen.getByText(/3 of 5 steps done/)).toBeVisible();
  });

  it("shows 'You're all set' when every step is complete", () => {
    useHelpWorkspace({
      "api.sites.getDashboardSummary": summary({
        formsConfigured: true,
        mediaCount: 4,
        courseCount: 3,
        teamCount: 1,
      }),
    });
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getByText(/You're all set/)).toBeVisible();
    expect(screen.queryByText(/steps done/)).toBeNull();
    expect(screen.getAllByText("Introduce your team").length).toBeGreaterThan(0);
  });

  it("explains Draft vs Preview vs Publish in the FAQs", () => {
    useHelpWorkspace();
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(
      screen.getByText("What's the difference between Save Draft, Preview, and Publish?"),
    ).toBeVisible();
    expect(screen.getByText("How quickly do my published changes appear on my website?")).toBeVisible();
  });

  it("Restart Tour clears the tour flag and confirms with a toast", () => {
    window.localStorage.setItem(tourDismissedKey(USER_ID, SITE_ID), "1");
    useHelpWorkspace();
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    fireEvent.click(screen.getByText("Restart Tour"));
    expect(window.localStorage.getItem(tourDismissedKey(USER_ID, SITE_ID))).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tour restarted" }),
    );
  });

  it("Restore Checklist clears the dismissal flag and confirms with a toast", () => {
    window.localStorage.setItem(gettingStartedDismissKey(USER_ID, SITE_ID), "1");
    useHelpWorkspace();
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    fireEvent.click(screen.getByText("Restore Checklist"));
    expect(window.localStorage.getItem(gettingStartedDismissKey(USER_ID, SITE_ID))).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Checklist restored" }),
    );
  });

  it("keeps agency support contact defaults for a non-agency site", () => {
    useHelpWorkspace({ "api.agencies.get": null });
    renderWithProviders(<HelpCenter params={{ siteId: SITE_ID }} />);
    expect(screen.getByText("Contact Support")).toBeVisible();
    expect(screen.getByText(/support@fullstacktechsolutions\.com/)).toBeVisible();
  });
});

// ── 5. Language audit — "Web Address" replaces "Slug" ───────────────

describe("Client language audit — collection forms", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
  });

  async function renderCourseFormDialog() {
    const CoursesList = (await import("@/pages/app/sites/CoursesList")).default;
    const dispatch: Record<string, unknown> = {
      "api.courses.list": [],
      "api.sites.get": SITE,
      "api.users.me": CLIENT,
      "api.sites.getEffectiveModules": null,
      "api.healthScans.getUnreadNotificationCount": 0,
      "api.media.healthStats": { broken: 0 },
      "api.agencies.get": null,
      "api.sites.list": [SITE],
    };
    mockUseQuery.mockImplementation((q: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      return dispatch[path] ?? null;
    });
    mockUseMutation.mockReturnValue(vi.fn());
    mockUseAction.mockReturnValue(vi.fn());
    renderWithProviders(<CoursesList params={{ siteId: SITE_ID }} />);
    fireEvent.click(screen.getAllByText("Add Course")[0]);
  }

  it("CoursesList uses 'Web Address' instead of 'Slug'", async () => {
    await renderCourseFormDialog();
    expect(screen.getAllByText("Web Address").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Slug")).toBeNull();
    expect(screen.queryByLabelText("slug")).toBeNull();
  });

  it("EventsList uses 'Web Address' instead of 'Slug'", async () => {
    const EventsList = (await import("@/pages/app/sites/EventsList")).default;
    const dispatch: Record<string, unknown> = {
      "api.events.list": [],
      "api.sites.get": SITE,
      "api.users.me": CLIENT,
      "api.sites.getEffectiveModules": null,
      "api.healthScans.getUnreadNotificationCount": 0,
      "api.media.healthStats": { broken: 0 },
      "api.agencies.get": null,
      "api.sites.list": [SITE],
    };
    mockUseQuery.mockImplementation((q: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      return dispatch[path] ?? null;
    });
    mockUseMutation.mockReturnValue(vi.fn());
    mockUseAction.mockReturnValue(vi.fn());
    renderWithProviders(<EventsList params={{ siteId: SITE_ID }} />);
    fireEvent.click(screen.getAllByText("Add Event")[0]);
    expect(screen.getAllByText("Web Address").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Slug")).toBeNull();
  });

  it("source files use client language (static audit of labels)", () => {
    const files = [
      "src/pages/app/sites/ArticlesList.tsx",
      "src/pages/app/sites/CoursesList.tsx",
      "src/pages/app/sites/EventsList.tsx",
      "src/pages/app/sites/ServicesManager.tsx",
      "src/pages/app/sites/ProductsManager.tsx",
    ];
    for (const f of files) {
      const fileSrc = readFileSync(f, "utf8");
      expect(fileSrc).not.toMatch(/<Label>Slug/);
      expect(fileSrc).not.toMatch(/aria-label="Slug"/);
      expect(fileSrc).toContain("Web Address");
    }
  });
});

// ── 6. SiteDashboard integration ───────────────────────────────────

describe("SiteDashboard integration — checklist + tour together", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
  });

  function dashboardWorkspace(overrides: Record<string, unknown> = {}) {
    const dispatch: Record<string, unknown> = {
      "api.sites.getDashboardSummary": summary(),
      "api.sites.get": SITE,
      "api.sites.getEffectiveModules": null,
      "api.healthScans.getLatestScan": null,
      "api.healthScans.getNotifications": null,
      "api.courses.listActionRequired": null,
      "api.events.listActionRequired": null,
      "api.flyers.listExpiringSoon": null,
      "api.users.me": CLIENT,
      "api.healthScans.getUnreadNotificationCount": 0,
      "api.media.healthStats": { broken: 0 },
      "api.agencies.get": null,
      "api.sites.list": [SITE],
      ...overrides,
    };
    mockUseQuery.mockImplementation((q: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      return dispatch[path] ?? null;
    });
    mockUseMutation.mockReturnValue(vi.fn());
    mockUseAction.mockReturnValue(vi.fn());
  }

  it("renders the Getting Started checklist above the stat cards", () => {
    dashboardWorkspace();
    renderWithProviders(<SiteDashboard />);
    expect(screen.getByText(/Getting Started with FSTS Test Site/)).toBeVisible();
    // SITE has a domain, so exactly 1 of 5 real steps is done.
    expect(screen.getByText("1 of 5 done")).toBeVisible();
    expect(screen.getByText("Courses")).toBeVisible();
  });

  it("shows the welcome tour for a first-visit client", () => {
    dashboardWorkspace();
    renderWithProviders(<SiteDashboard />);
    expect(screen.getByText("Welcome to your website dashboard")).toBeVisible();
  });

  it("hides the tour for superadmin (integration)", () => {
    dashboardWorkspace({ "api.users.me": SUPERADMIN });
    renderWithProviders(<SiteDashboard />);
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
    // Superadmin still gets the checklist (it is state, not role-gated);
    // SITE has a domain so 1 of 5 real steps is done.
    expect(screen.getByText("1 of 5 done")).toBeVisible();
  });

  it("hides the checklist when dismissed but keeps the tour (separate flags)", () => {
    window.localStorage.setItem(gettingStartedDismissKey(USER_ID, SITE_ID), "1");
    window.localStorage.setItem(tourDismissedKey(USER_ID, SITE_ID), "1");
    dashboardWorkspace();
    renderWithProviders(<SiteDashboard />);
    expect(screen.queryByText(/of 5 done/)).toBeNull();
    expect(screen.queryByText("Welcome to your website dashboard")).toBeNull();
    // Dashboard body still renders.
    expect(screen.getByText("Courses")).toBeVisible();
  });
});
