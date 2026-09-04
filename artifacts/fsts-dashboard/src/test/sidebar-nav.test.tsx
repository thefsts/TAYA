/**
 * sidebar-nav.test.tsx
 *
 * Phase 2 test suite: WordPress-like TAYA client sidebar.
 *
 * Covers four layers:
 *   1. Pure model (src/lib/sidebarNav.ts): group structure, client language,
 *      enabledModules gating, hide-empty groups, superAdminOnly, design-lock
 *      flags, deep-link hrefs (?filter=...), ™ product labels.
 *   2. Persistence hook (src/hooks/useSidebarUi.ts): per-user localStorage
 *      round-trip, hydration, corrupted-JSON fallback, junk filtering.
 *   3. Component (src/components/SidebarNav.tsx): collapsible groups with
 *      aria-expanded, active item (aria-current="page") + parent group
 *      highlight, nested submenu expand/auto-expand with exact child match,
 *      design-locked affordance for clients, badge, compact icon rail,
 *      keyboard ArrowUp/ArrowDown navigation, collapsed-group active reveal.
 *   4. Integration (AppLayout in SiteDashboard.tsx): full client workspace
 *      chrome — Dashboard entry, site identity, bottom action area
 *      (View Live Site / Help / Account / Sign Out), compact rail toggle with
 *      persistence, mobile drawer open/close, media badge wiring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** Mutable current location shared by the wouter mock (wouter 3: includes query). */
const mockLocation = vi.hoisted(() => ({ value: "/" }));

// ── External / framework mocks (match module-access-denied.test.tsx) ────────

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a callable that returns its own
// path string ("api.sites.get"), so the mock useQuery can dispatch on the
// queried function path. Symbol-keyed lookups (e.g. Symbol.toPrimitive when
// coerced) return undefined instead of throwing.
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

// wouter — Link renders a real <a href> so href assertions and keyboard focus
// traversal (a[href]) work exactly like production.
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

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildSidebarGroups,
  isItemVisible,
  SIDEBAR_GROUP_IDS,
  SIDEBAR_MODULE_KEYS,
  type SidebarBuildContext,
  type SidebarNavItem,
} from "@/lib/sidebarNav";
import { SidebarNav, findGroupOfHref } from "@/components/SidebarNav";
import { useSidebarUi } from "@/hooks/useSidebarUi";
import { AppLayout } from "@/pages/app/SiteDashboard";

// ── Helpers ─────────────────────────────────────────────────────────────────

const SITE_ID = "site_test123";

function ctx(overrides: Partial<SidebarBuildContext> = {}): SidebarBuildContext {
  return { siteId: SITE_ID, enabledModules: null, isSuperAdmin: false, ...overrides };
}

/** Wrap in TooltipProvider like App.tsx does for the whole app. */
function renderSidebar(props: Partial<React.ComponentProps<typeof SidebarNav>> = {}) {
  const onToggleGroup = props.onToggleGroup ?? vi.fn();
  const onNavigate = props.onNavigate ?? vi.fn();
  const utils = render(
    <TooltipProvider>
      <SidebarNav
        siteId={SITE_ID}
        enabledModules={null}
        isSuperAdmin={false}
        collapsedGroups={[]}
        onToggleGroup={onToggleGroup}
        onNavigate={onNavigate}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...utils, onToggleGroup, onNavigate };
}

function allItems(groups: ReturnType<typeof buildSidebarGroups>): SidebarNavItem[] {
  const out: SidebarNavItem[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      out.push(item);
      if (item.children) out.push(...item.children);
    }
  }
  return out;
}

// Integration fixtures — the AppLayout query dispatch below returns these.
const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
  logoUrl: null,
};
const CLIENT = { _id: "user_client_1", id: "user_client_1", isSuperAdmin: false, roles: [] };

/** Configure the convex useQuery mock for a signed-in client on SITE. */
function useClientWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.users.me": CLIENT,
    "api.sites.getEffectiveModules": null,
    "api.healthScans.getUnreadNotificationCount": 0,
    "api.media.healthStats": { broken: 2 },
    "api.agencies.get": null,
    "api.sites.list": [SITE],
    ...overrides,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    // The api proxy returns its own path ("api.sites.get") when called.
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    return dispatch[path] ?? null;
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
  mockLocation.value = "/";
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── 1. Pure model: sidebarNav.ts ────────────────────────────────────────────

describe("sidebarNav model — structure & client language", () => {
  it("builds the seven client-language groups in order", () => {
    const groups = buildSidebarGroups(ctx());
    expect(groups.map((g) => g.id)).toEqual([
      "edit-website", "media", "business", "communication", "marketing", "site", "taya-managed",
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Edit Website", "Media", "Business", "Communication", "Marketing", "Site", "TAYA Managed",
    ]);
    expect(SIDEBAR_GROUP_IDS).toEqual([
      "edit-website", "media", "business", "communication", "marketing", "site", "taya-managed",
    ] as const);
  });

  it("uses client language labels, never raw table/module names", () => {
    const items = allItems(buildSidebarGroups(ctx())).map((i) => i.label);
    for (const label of ["All Pages", "Homepage", "Blog & Articles", "Media Library", "Courses & Classes", "Contact Inbox", "SEO Settings", "Website Settings", "My Permissions", "Help Center", "Version History", "Menu Builder", "Footer Structure"]) {
      expect(items).toContain(label);
    }
    // No developer jargon leaked into the client sidebar.
    for (const label of items) {
      expect(label).not.toMatch(/_/);
      expect(label).not.toMatch(/^crm$|^nav$|^cms$/i);
    }
  });

  it("preserves ™ branding on TAYA products", () => {
    const items = allItems(buildSidebarGroups(ctx())).map((i) => i.label);
    expect(items).toContain("Automation Engine\u2122");
    expect(items).toContain("Portal Manager\u2122");
  });

  it("routes every site item under /app/sites/:siteId (User Management excepted)", () => {
    const groups = buildSidebarGroups(ctx({ isSuperAdmin: true }));
    for (const item of allItems(groups)) {
      if (item.superAdminOnly) {
        expect(item.href).toBe("/app/admin/users");
      } else {
        expect(item.href.startsWith(`/app/sites/${SITE_ID}/`)).toBe(true);
      }
    }
  });

  it("creates deep-link submenu hrefs that honor ?filter= query params", () => {
    const groups = buildSidebarGroups(ctx());
    const blog = allItems(groups).find((i) => i.id === "blog");
    expect(blog?.children?.map((c) => c.href)).toEqual([
      `/app/sites/${SITE_ID}/articles`,
      `/app/sites/${SITE_ID}/articles?filter=draft`,
      `/app/sites/${SITE_ID}/articles?filter=published`,
    ]);
    const events = allItems(groups).find((i) => i.id === "events");
    expect(events?.children?.map((c) => c.href)).toContain(`/app/sites/${SITE_ID}/events?filter=past`);
  });

  it("declares every moduleKey used by items in SIDEBAR_MODULE_KEYS", () => {
    const used = new Set(
      allItems(buildSidebarGroups(ctx()))
        .map((i) => i.moduleKey)
        .filter((k): k is string => !!k),
    );
    for (const key of used) expect(SIDEBAR_MODULE_KEYS).toContain(key);
  });

  it("tags design-tier destinations as isDesignLocked", () => {
    const groups = buildSidebarGroups(ctx());
    const tayaManaged = groups.find((g) => g.id === "taya-managed")!;
    expect(tayaManaged.items.every((i) => i.isDesignLocked === true)).toBe(true);
    const siteGroup = groups.find((g) => g.id === "site")!;
    expect(siteGroup.items.find((i) => i.id === "website-settings")?.isDesignLocked).toBe(true);
    // Client-editable items are never design-locked.
    expect(siteGroup.items.find((i) => i.id === "my-permissions")?.isDesignLocked).toBeUndefined();
  });
});

describe("sidebarNav model — gating & hide-empty", () => {
  it("isItemVisible: null/undefined modules show everything; === false hides", () => {
    const item: SidebarNavItem = {
      id: "x", label: "X", href: "/x", icon: undefined as never, moduleKey: "articles",
    };
    expect(isItemVisible(item, ctx({ enabledModules: null }))).toBe(true);
    expect(isItemVisible(item, ctx({ enabledModules: undefined }))).toBe(true);
    expect(isItemVisible(item, ctx({ enabledModules: {} }))).toBe(true); // missing key → visible
    expect(isItemVisible(item, ctx({ enabledModules: { articles: true } }))).toBe(true);
    expect(isItemVisible(item, ctx({ enabledModules: { articles: false } }))).toBe(false);
  });

  it("isItemVisible: superAdminOnly items hidden from clients", () => {
    const item: SidebarNavItem = {
      id: "um", label: "User Management", href: "/app/admin/users", icon: undefined as never, superAdminOnly: true,
    };
    expect(isItemVisible(item, ctx({ isSuperAdmin: false }))).toBe(false);
    expect(isItemVisible(item, ctx({ isSuperAdmin: true }))).toBe(true);
  });

  it("hides module-disabled items but keeps groups with other visible items", () => {
    const groups = buildSidebarGroups(ctx({ enabledModules: { articles: false, media: true } }));
    const editWebsite = groups.find((g) => g.id === "edit-website")!;
    expect(editWebsite.items.some((i) => i.id === "blog")).toBe(false);
    expect(editWebsite.items.some((i) => i.id === "pages")).toBe(true); // no moduleKey → always visible
  });

  it("drops groups whose items are all hidden (hide-empty)", () => {
    const groups = buildSidebarGroups(ctx({ enabledModules: { media: false, forms: false, contact: false } }));
    expect(groups.map((g) => g.id)).not.toContain("media");
    expect(groups.map((g) => g.id)).not.toContain("communication");
    // Groups with always-visible items survive.
    expect(groups.map((g) => g.id)).toContain("edit-website");
    expect(groups.map((g) => g.id)).toContain("site");
    expect(groups.map((g) => g.id)).toContain("taya-managed");
  });

  it("drops a whole business group when every business module is disabled", () => {
    const groups = buildSidebarGroups(ctx({
      enabledModules: { services: false, products: false, courses: false, events: false },
    }));
    expect(groups.map((g) => g.id)).not.toContain("business");
  });

  it("hides superAdminOnly User Management from clients, shows it to superadmins", () => {
    const clientItems = allItems(buildSidebarGroups(ctx({ isSuperAdmin: false }))).map((i) => i.label);
    expect(clientItems).not.toContain("User Management");
    const adminItems = allItems(buildSidebarGroups(ctx({ isSuperAdmin: true }))).map((i) => i.label);
    expect(adminItems).toContain("User Management");
  });
});

describe("sidebarNav model — findGroupOfHref", () => {
  const groups = buildSidebarGroups(ctx());

  it("maps routes to their owning group (parent highlight)", () => {
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/articles`)?.id).toBe("edit-website");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/media`)?.id).toBe("media");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/inbox`)?.id).toBe("communication");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/help`)?.id).toBe("site");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/backups`)?.id).toBe("taya-managed");
  });

  it("matches query-string variants at path level (wouter 3 location includes ?)", () => {
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/articles?filter=draft`)?.id).toBe("edit-website");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/events?filter=all`)?.id).toBe("business");
  });

  it("returns null for unknown routes", () => {
    expect(findGroupOfHref(groups, "/app")).toBeNull();
    expect(findGroupOfHref(groups, "/sign-in")).toBeNull();
  });
});

// ── 2. Persistence hook: useSidebarUi.ts ────────────────────────────────────

describe("useSidebarUi — per-user localStorage persistence", () => {
  it("returns defaults when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarUi("u1"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(result.current.compact).toBe(false);
  });

  it("toggleGroup adds, persists, then removes a group", () => {
    const { result } = renderHook(() => useSidebarUi("u1"));
    act(() => result.current.toggleGroup("media"));
    expect(result.current.collapsedGroups).toEqual(["media"]);
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.u1")!)).toEqual({
      collapsedGroups: ["media"],
      compact: false,
    });
    act(() => result.current.toggleGroup("media"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.u1")!).collapsedGroups).toEqual([]);
  });

  it("setCompact/toggleCompact persist compact mode", () => {
    const { result } = renderHook(() => useSidebarUi("u1"));
    act(() => result.current.setCompact(true));
    expect(result.current.compact).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.u1")!).compact).toBe(true);
    act(() => result.current.toggleCompact());
    expect(result.current.compact).toBe(false);
  });

  it("hydrates from the per-user key on mount", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1.u2",
      JSON.stringify({ collapsedGroups: ["site"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi("u2"));
    expect(result.current.collapsedGroups).toEqual(["site"]);
    expect(result.current.compact).toBe(true);
  });

  it("isolates users: another user's stored state does not leak", () => {
    window.localStorage.setItem(
      "taya.sidebar.v2",
      JSON.stringify({ collapsedGroups: ["site"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi("u1"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(result.current.compact).toBe(false);
  });

  it("falls back to the shared key when no user id is available", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1",
      JSON.stringify({ collapsedGroups: ["media"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi(null));
    expect(result.current.collapsedGroups).toEqual(["media"]);
    expect(result.current.compact).toBe(true);
  });

  it("silently falls back to defaults on corrupted JSON", () => {
    window.localStorage.setItem("taya.sidebar.v1.u3", "{not json at all");
    const { result } = renderHook(() => useSidebarUi("u3"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(result.current.compact).toBe(false);
  });

  it("filters junk entries (non-strings, non-boolean compact) from stored state", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1.u4",
      JSON.stringify({ collapsedGroups: [1, null, "x", true], compact: "yes" }),
    );
    const { result } = renderHook(() => useSidebarUi("u4"));
    expect(result.current.collapsedGroups).toEqual(["x"]);
    expect(result.current.compact).toBe(false);
  });
});

// ── 3. Component: SidebarNav.tsx ────────────────────────────────────────────

describe("SidebarNav — collapsible groups", () => {
  it("renders every group header as an aria-expanded toggle", () => {
    renderSidebar();
    for (const title of ["Edit Website", "Media", "Business", "Communication", "Marketing", "Site", "TAYA Managed"]) {
      const btn = screen.getByRole("button", { name: `Toggle ${title} section` });
      expect(btn).toHaveAttribute("aria-expanded", "true");
    }
    expect(screen.getByTestId("sidebar-nav")).toHaveAttribute("aria-label", "Website sections");
  });

  it("collapses a group via its toggle and reports the group id upward", () => {
    const { onToggleGroup } = renderSidebar({ collapsedGroups: ["media"] });
    expect(screen.getByRole("button", { name: "Toggle Media section" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Media Library")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Media section" }));
    expect(onToggleGroup).toHaveBeenCalledWith("media");
  });

  it("keeps showing the active item when its group is collapsed", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/articles`;
    renderSidebar({ collapsedGroups: ["edit-website"] });
    const header = screen.getByRole("button", { name: "Toggle Edit Website section" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    // Active item (and its nested children) stay visible under the rail.
    expect(screen.getByText("Blog & Articles")).toBeInTheDocument();
    expect(screen.getByText("Drafts")).toBeInTheDocument();
    // Inactive siblings are hidden with the group.
    expect(screen.queryByText("All Pages")).toBeNull();
    expect(screen.queryByText("Flyers")).toBeNull();
  });
});

describe("SidebarNav — active state & nested submenus", () => {
  it("marks the active item with aria-current and highlights its parent group", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/articles`;
    renderSidebar();
    const blog = screen.getByText("Blog & Articles").closest("button");
    expect(blog).toHaveAttribute("aria-current", "page");
    // Parent-group highlight.
    const groupTitle = screen.getByText("Edit Website");
    expect(groupTitle.className).toContain("text-primary/80");
    // No other group's title is highlighted.
    expect(screen.getByText("Media").className).not.toContain("text-primary/80");
  });

  it("auto-expands the submenu whose child is active and matches that child exactly", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/articles?filter=published`;
    renderSidebar();
    // Submenu auto-opened without a manual click.
    expect(screen.getByRole("button", { name: "Toggle Blog & Articles submenu" })).toHaveAttribute("aria-expanded", "true");
    const children = screen.getAllByRole("link").filter((a) =>
      ["All Articles", "Drafts", "Published"].includes((a.textContent ?? "").trim()),
    );
    // Exactly one child (Published) is the current page.
    const current = children.filter((a) => a.querySelector('[aria-current="page"]') || a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent?.trim())).toEqual(["Published"]);
    // The parent is active too (path-level match).
    expect(screen.getByText("Blog & Articles").closest("button")).toHaveAttribute("aria-current", "page");
  });

  it("expands and collapses a submenu manually via its chevron button", () => {
    renderSidebar();
    const toggle = screen.getByRole("button", { name: "Toggle Blog & Articles submenu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Drafts")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Toggle Blog & Articles submenu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("preserves deep-link query strings in rendered submenu hrefs", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Blog & Articles submenu" }));
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/articles?filter=draft"]`)).not.toBeNull();
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/articles?filter=published"]`)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Events submenu" }));
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/events?filter=past"]`)).not.toBeNull();
  });
});

describe("SidebarNav — design lock, badges, module gating", () => {
  it("renders design-locked items as disabled affordances for clients (no navigation)", () => {
    renderSidebar({ isSuperAdmin: false });
    const locked = screen.getByText("Version History").closest('[aria-disabled="true"]');
    expect(locked).not.toBeNull();
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/history"]`)).toBeNull();
    // Every TAYA Managed destination is locked for clients.
    for (const label of ["Payment Providers", "Health Monitor", "Backups", "Menu Builder", "Footer Structure"]) {
      expect(screen.getByText(label).closest('[aria-disabled="true"]')).not.toBeNull();
    }
  });

  it("gives superadmins clickable links for design-locked destinations", () => {
    renderSidebar({ isSuperAdmin: true });
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/history"]`)).not.toBeNull();
    expect(screen.queryByText("User Management")).not.toBeNull();
  });

  it("hides User Management from clients", () => {
    renderSidebar({ isSuperAdmin: false });
    expect(screen.queryByText("User Management")).toBeNull();
  });

  it("renders the broken-media badge count on Media Library", () => {
    renderSidebar({ badges: { mediaBroken: 3 } });
    const media = screen.getByText("Media Library");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(media.closest("button")?.textContent).toContain("3");
  });

  it("omits the badge when nothing is broken", () => {
    renderSidebar({ badges: { mediaBroken: 0 } });
    expect(screen.queryByText("3")).toBeNull();
  });

  it("hides module-disabled groups and items (hide-empty in the component)", () => {
    renderSidebar({
      enabledModules: { media: false, payments: false, commerce: false },
    });
    expect(screen.queryByRole("button", { name: "Toggle Media section" })).toBeNull();
    expect(screen.queryByText("Media Library")).toBeNull();
    // Locked-but-moduleless items remain; module-gated locked items drop.
    expect(screen.getByText("Payment Providers")).toBeInTheDocument();
    expect(screen.queryByText("Square Payments")).toBeNull();
    expect(screen.queryByText("Commerce")).toBeNull();
  });
});

describe("SidebarNav — compact rail & keyboard navigation", () => {
  it("renders icon-only rail in compact mode: no visible labels, aria-labels intact", () => {
    renderSidebar({ compact: true });
    // Group titles are not rendered as text (tooltip only).
    expect(screen.queryByText("Edit Website")).toBeNull();
    expect(screen.queryByText("All Pages")).toBeNull();
    // Headers stay real toggles with accessible names.
    expect(screen.getByRole("button", { name: "Toggle Edit Website section" })).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus with ArrowDown/ArrowUp between visible nav controls", () => {
    renderSidebar();
    const nav = screen.getByTestId("sidebar-nav");
    const first = screen.getByRole("button", { name: "Toggle Edit Website section" });
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(nav, { key: "ArrowDown" });
    // Next focusable after the group header is the "All Pages" link.
    expect((document.activeElement as HTMLElement).textContent).toContain("All Pages");
    fireEvent.keyDown(nav, { key: "ArrowUp" });
    expect(document.activeElement).toBe(first);
  });

  it("calls onNavigate when a nav link is clicked (mobile drawer close)", () => {
    const { onNavigate } = renderSidebar();
    fireEvent.click(screen.getByText("All Pages"));
    expect(onNavigate).toHaveBeenCalled();
  });
});

// ── 4. Integration: AppLayout client workspace chrome ───────────────────────

describe("AppLayout — Phase 2 client workspace integration", () => {
  it("renders site identity, Dashboard entry and the full sidebar", () => {
    useClientWorkspace();
    mockLocation.value = `/app/sites/${SITE_ID}`;
    renderAppLayout();
    // Site identity — name + domain, never raw ids.
    expect(screen.getByText("FSTS Test Site")).toBeInTheDocument();
    expect(screen.getAllByText("fsts-test.example.com").length).toBeGreaterThan(0);
    expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument();
    // Dashboard entry links to the site workspace root.
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}"]`)).not.toBeNull();
    // Sidebar content: groups + module-gated items all present (modules null).
    expect(screen.getByRole("button", { name: "Toggle Edit Website section" })).toBeInTheDocument();
    expect(screen.getByText("Media Library")).toBeInTheDocument();
    expect(screen.getByText("Blog & Articles")).toBeInTheDocument();
    // Client affordances: locked design tier + no User Management.
    expect(screen.getByText("Version History").closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
    // Media broken badge wired from api.media.healthStats.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the bottom action area: View Live Site / Help / Account / Sign Out", () => {
    useClientWorkspace();
    renderAppLayout();
    expect(document.querySelector('a[href="https://fsts-test.example.com"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "View live site (opens in a new tab)" })).toBeInTheDocument();
    expect(document.querySelector('a[href="/app/sites/site_test123/help"]')).not.toBeNull();
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(document.querySelector('a[href="https://accounts.app.fstsclientsystem.com"]')).not.toBeNull();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(document.querySelector('a[href="https://accounts.app.fstsclientsystem.com/user/logout"]')).not.toBeNull();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("toggles the compact rail and persists it per user", () => {
    useClientWorkspace();
    renderAppLayout();
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapse).toHaveAttribute("aria-pressed", "false");
    const aside = document.querySelector("aside[data-sidebar]") as HTMLElement;
    expect(aside.getAttribute("data-sidebar")).toBe("full");

    fireEvent.click(collapse);
    // Toggle flips and the aside enters compact mode.
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-pressed", "true");
    expect(aside.getAttribute("data-sidebar")).toBe("compact");
    // Labels collapse to icons; site name stays accessible via title.
    expect(screen.queryByText("View Live Site")).toBeNull();
    expect(screen.queryByText("Websites")).toBeNull();
    expect(screen.getByRole("button", { name: "View live site (opens in a new tab)" })).toBeInTheDocument();
    // Persisted under the per-user key.
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.user_client_1")!).compact).toBe(true);
  });

  it("collapses sidebar groups through the layout and persists them", () => {
    useClientWorkspace();
    renderAppLayout();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Media section" }));
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.user_client_1")!).collapsedGroups).toEqual(["media"]);
    // The group is collapsed: its items disappear.
    expect(screen.queryByText("Media Library")).toBeNull();
  });

  it("opens and closes the mobile drawer", () => {
    useClientWorkspace();
    renderAppLayout();
    const aside = document.querySelector("aside[data-sidebar]") as HTMLElement;
    expect(aside.className).toContain("-translate-x-full");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(aside.className).not.toContain("-translate-x-full");
    // Drawer open: the overlay + the sidebar X both offer "Close navigation".
    expect(screen.getAllByRole("button", { name: "Close navigation" }).length).toBeGreaterThanOrEqual(1);
    // Clicking a nav link closes the drawer (onNavigate wiring).
    fireEvent.click(screen.getByText("All Pages"));
    expect(aside.className).toContain("-translate-x-full");
  });
});
