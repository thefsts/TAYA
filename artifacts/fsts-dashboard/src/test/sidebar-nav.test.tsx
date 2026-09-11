/**
 * sidebar-nav.test.tsx
 *
 * Phase 6 test suite: honest capability-registry sidebar.
 *
 * Covers four layers:
 *   1. Pure model (src/lib/sidebarNav.ts): the 8 capability groups (7 in
 *      the sidebar \u2014 "overview" is the layout's flat Dashboard entry),
 *      registry-derived client-language labels, core-only fallback for
 *      unknown truth (PM decision 3: never guess an optional surface into
 *      existence), module gating, role gating, hide-empty groups,
 *      admin-scope (User Management), design-lock flags, deep-link hrefs
 *      (?filter=...), \u2122 product labels.
 *   2. Persistence hook (src/hooks/useSidebarUi.ts): per-user localStorage
 *      round-trip, hydration with legacy group-id FORWARD mapping
 *      (LEGACY_GROUP_ALIASES: "edit-website" \u2192 "website", "media" \u2192
 *      "content", "taya-managed" \u2192 "tools", \u2026), corrupted-JSON fallback,
 *      junk filtering.
 *   3. Component (src/components/SidebarNav.tsx): collapsible groups with
 *      aria-expanded, active item (aria-current="page") + parent group
 *      highlight, nested submenu expand/auto-expand with exact child match,
 *      design-locked affordance for clients, badge, compact icon rail,
 *      keyboard ArrowUp/ArrowDown navigation, collapsed-group active reveal.
 *   4. Integration (AppLayout in SiteDashboard.tsx): full client workspace
 *      chrome \u2014 Dashboard entry, site identity, bottom action area
 *      (View Live Site / Help / Account / Sign Out), compact rail toggle with
 *      persistence, mobile drawer open/close, media badge wiring \u2014 with the
 *      Phase 6 truthful viewer queries (api.sites.getEffectiveModules +
 *      api.accessControl.getMyPermissions) mocked like production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// \u2500\u2500 Hoisted mock handles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** Mutable current location shared by the wouter mock (wouter 3: includes query). */
const mockLocation = vi.hoisted(() => ({ value: "/" }));

// \u2500\u2500 External / framework mocks (match module-access-denied.test.tsx) \u2500\u2500\u2500\u2500\u2500\u2500\u2500

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy \u2014 any property chain resolves to a callable that returns its own
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

// wouter \u2014 Link renders a real <a href> so href assertions and keyboard focus
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

// \u2500\u2500 Imports (after mocks) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
import { ROLE_CAPABILITIES } from "@/lib/roleCapabilities";

// \u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const SITE_ID = "site_test123";

/**
 * Phase 6 truthful viewer defaults: an owner whose permission row comes from
 * the real role matrix (ROLE_CAPABILITIES.owner) and a decided module map
 * ({} = defaults, NOT "unknown"). Without either truth the model correctly
 * falls back to core-only and hides every optional surface \u2014 that behavior
 * is asserted explicitly below.
 */
function ctx(overrides: Partial<SidebarBuildContext> = {}): SidebarBuildContext {
  return {
    siteId: SITE_ID,
    enabledModules: {},
    rolePermissions: ROLE_CAPABILITIES.owner,
    isSuperAdmin: false,
    websiteType: null,
    ...overrides,
  };
}

/** Wrap in TooltipProvider like App.tsx does for the whole app. */
function renderSidebar(props: Partial<React.ComponentProps<typeof SidebarNav>> = {}) {
  const onToggleGroup = props.onToggleGroup ?? vi.fn();
  const onNavigate = props.onNavigate ?? vi.fn();
  const utils = render(
    <TooltipProvider>
      <SidebarNav
        siteId={SITE_ID}
        enabledModules={{}}
        rolePermissions={ROLE_CAPABILITIES.owner}
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

// Integration fixtures \u2014 the AppLayout query dispatch below returns these.
const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
  logoUrl: null,
};
const CLIENT = { _id: "user_client_1", id: "user_client_1", isSuperAdmin: false, roles: [] };

/** Phase 6: getMyPermissions success shape for a site owner (real matrix row). */
const OWNER_PERMISSIONS = {
  isSuperAdmin: false,
  role: "owner",
  permissions: ROLE_CAPABILITIES.owner,
};

/** Configure the convex useQuery mock for a signed-in owner on SITE. */
function useClientWorkspace(overrides: Record<string, unknown> = {}) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.users.me": CLIENT,
    // Phase 6 truthful viewer: decided defaults ({} \u2260 unknown) + owner row.
    "api.sites.getEffectiveModules": {},
    "api.accessControl.getMyPermissions": OWNER_PERMISSIONS,
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

// \u2500\u2500 1. Pure model: sidebarNav.ts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("sidebarNav model \u2014 registry groups & client language", () => {
  it("builds the seven capability groups in order (overview stays flat)", () => {
    const groups = buildSidebarGroups(ctx());
    expect(groups.map((g) => g.id)).toEqual([
      "website", "content", "business", "engagement", "growth", "tools", "account",
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Website", "Content", "Business", "Engagement", "Growth", "Tools", "Account",
    ]);
    // SIDEBAR_GROUP_IDS is the full registry list incl. the flat "overview".
    expect(SIDEBAR_GROUP_IDS).toEqual([
      "overview", "website", "content", "business", "engagement", "growth", "tools", "account",
    ] as const);
    // "overview" never renders as a sidebar group (Dashboard is the layout's
    // flat entry above the groups).
    expect(groups.map((g) => g.id)).not.toContain("overview");
  });

  it("uses client language labels, never raw table/module names", () => {
    const items = allItems(buildSidebarGroups(ctx())).map((i) => i.label);
    for (const label of [
      "All Pages", "Visual Editor", "Homepage", "Menu Builder", "Footer", "Website Settings",
      "Site Verification", "Blog & Articles", "FAQ", "Flyers", "Announcement Banner",
      "CTA Buttons", "Popup", "Policy Pages", "Media Library", "Services", "Products",
      "Courses & Classes", "Events", "Square Payments", "Commerce", "Forms", "Contact Inbox",
      "Team", "Careers", "Downloads", "SEO Settings", "Reviews", "Testimonials",
      "My Permissions", "Site Users", "Help Center",
    ]) {
      expect(items).toContain(label);
    }
    // No developer jargon leaked into the client sidebar.
    for (const label of items) {
      expect(label).not.toMatch(/_/);
      expect(label).not.toMatch(/^crm$|^nav$|^cms$/i);
    }
  });

  it("preserves \u2122 branding on TAYA products", () => {
    const items = allItems(buildSidebarGroups(ctx())).map((i) => i.label);
    expect(items).toContain("Automation Engine\u2122");
    expect(items).toContain("Portal Manager\u2122");
  });

  it("edit-website group exposes the Visual Editor entry (Edit Website group)", () => {
    const groups = buildSidebarGroups(ctx());
    const editWebsite = groups.find((g) => g.id === "edit-website");
    expect(editWebsite).toBeTruthy();
    const item = editWebsite!.items.find((i) => i.id === "visual-editor");
    expect(item).toBeTruthy();
    expect(item!.label).toBe("Visual Editor");
    expect(item!.href).toBe(`/app/sites/${SITE_ID}/editor`);
    // The editor is the primary client entry point: never design-locked away.
    expect(item!.isDesignLocked ?? false).toBe(false);
  });

  it("routes every site item under /app/sites/:siteId (User Management excepted)", () => {
    const groups = buildSidebarGroups(ctx({ isSuperAdmin: true }));    for (const item of allItems(groups)) {
      if (item.superAdminOnly) {
        expect(item.href).toBe("/app/admin/users");
      } else {
        expect(item.href.startsWith(`/app/sites/${SITE_ID}/`)).toBe(true);
      }
    }
  });

  it("creates deep-link submenu hrefs that honor ?filter= query params", () => {
    const groups = buildSidebarGroups(ctx());
    const articles = allItems(groups).find((i) => i.id === "articles");
    expect(articles?.children?.map((c) => c.href)).toEqual([
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

  it("tags exactly the design-locked set; core client surfaces never locked", () => {
    const groups = buildSidebarGroups(ctx());
    const lockedLabels = allItems(groups)
      .filter((i) => i.isDesignLocked === true)
      .map((i) => i.label);
    // The full locked set from the registry (Menu Builder, Footer, Square
    // Payments, Commerce, Marketing & CRM, Email Configuration, Payment
    // Providers, Health Monitor, Version History, Activity Log, Backups).
    expect(lockedLabels.sort()).toEqual([
      "Activity Log", "Backups", "Commerce", "Email Configuration", "Footer",
      "Health Monitor", "Marketing & CRM", "Menu Builder", "Payment Providers",
      "Square Payments", "Version History",
    ]);
    // P3 per-tab RBAC: Website Settings is a working client link (never
    // blanket design-locked; the page tiers each tab inside
    // WebsiteSettings.tsx). Core client-editable surfaces are never locked.
    const website = groups.find((g) => g.id === "website")!;
    expect(website.items.find((i) => i.id === "website-settings")?.isDesignLocked).toBeUndefined();
    const account = groups.find((g) => g.id === "account")!;
    expect(account.items.find((i) => i.id === "my-permissions")?.isDesignLocked).toBeUndefined();
  });
});

describe("sidebarNav model \u2014 gating, core-only & hide-empty", () => {
  it("isItemVisible: unknown modules hide module-gated items (core-only); explicit false hides", () => {
    const gated: SidebarNavItem = {
      id: "x", label: "X", href: "/x", icon: undefined as never, moduleKey: "articles",
    };
    // PM decision 3 \u2014 never guess an optional surface into existence:
    // null/undefined module truth hides module-gated items.
    expect(isItemVisible(gated, ctx({ enabledModules: null }))).toBe(false);
    expect(isItemVisible(gated, ctx({ enabledModules: undefined }))).toBe(false);
    // A decided map with the key missing \u2192 visible (defaults are a choice).
    expect(isItemVisible(gated, ctx({ enabledModules: {} }))).toBe(true);
    expect(isItemVisible(gated, ctx({ enabledModules: { articles: true } }))).toBe(true);
    expect(isItemVisible(gated, ctx({ enabledModules: { articles: false } }))).toBe(false);
    // Core-tier surfaces (no moduleKey) render even while truth is unknown.
    const core: SidebarNavItem = { id: "pages", label: "All Pages", href: "/pages", icon: undefined as never };
    expect(isItemVisible(core, ctx({ enabledModules: null }))).toBe(true);
  });

  it("isItemVisible: superAdminOnly items hidden from clients", () => {
    const item: SidebarNavItem = {
      id: "um", label: "User Management", href: "/app/admin/users", icon: undefined as never, superAdminOnly: true,
    };
    expect(isItemVisible(item, ctx({ isSuperAdmin: false }))).toBe(false);
    expect(isItemVisible(item, ctx({ isSuperAdmin: true }))).toBe(true);
  });

  it("core-only fallback: unknown truth (modules OR permissions null) hides optional surfaces", () => {
    // Modules unknown \u2192 optional groups drop, core groups survive.
    const modulesUnknown = buildSidebarGroups(ctx({ enabledModules: null }));
    expect(modulesUnknown.map((g) => g.id)).toEqual(["website", "account"]);
    // help is core-tier (with a roleModuleKey): core surfaces render even
    // while truth is unknown — only optional surfaces hide.
    expect(allItems(modulesUnknown).map((i) => i.id).sort()).toEqual([
      "help", "my-permissions", "pages", "site-users", "site-verification", "visual-editor", "website-settings",
    ]);
    // Permissions unknown \u2192 same honest fallback for optional surfaces.
    const permsUnknown = buildSidebarGroups(ctx({ rolePermissions: null }));
    expect(permsUnknown.map((g) => g.id)).toEqual(["website", "account"]);
    // Both unknown (fresh page load before queries resolve) \u2192 core-only.
    const bothUnknown = buildSidebarGroups(ctx({ enabledModules: null, rolePermissions: null }));
    expect(bothUnknown.map((g) => g.id)).toEqual(["website", "account"]);
  });

  it("role gating: read_only sees view-capable optional items, not manage-only dead ends", () => {
    const readOnly = buildSidebarGroups(ctx({ rolePermissions: ROLE_CAPABILITIES.read_only }));
    // read_only has view on the optional surfaces \u2192 they render.
    expect(readOnly.map((g) => g.id)).toContain("business");
    expect(readOnly.map((g) => g.id)).toContain("content");
    // A support-style role with none on business surfaces loses them.
    const noBusiness = buildSidebarGroups(
      ctx({ rolePermissions: { ...ROLE_CAPABILITIES.read_only, courses: "none", events: "none", services: "none", products: "none", payments: "none", commerce: "none" } }),
    );
    expect(noBusiness.map((g) => g.id)).not.toContain("business");
  });

  it("hides module-disabled items but keeps groups with other visible items", () => {
    const groups = buildSidebarGroups(ctx({ enabledModules: { articles: false, media: true } }));
    const content = groups.find((g) => g.id === "content")!;
    expect(content.items.some((i) => i.id === "articles")).toBe(false);
    const website = groups.find((g) => g.id === "website")!;
    expect(website.items.some((i) => i.id === "pages")).toBe(true); // core tier \u2192 never module-gated
  });

  it("drops groups whose items are all hidden (hide-empty)", () => {
    const groups = buildSidebarGroups(
      ctx({ enabledModules: {
        articles: false, faq: false, flyers: false, announcement: false, cta: false,
        popup: false, policy: false, media: false,
        forms: false, contact: false, team: false, careers: false, downloads: false, portal: false,
      } }),
    );
    expect(groups.map((g) => g.id)).not.toContain("content");
    expect(groups.map((g) => g.id)).not.toContain("engagement");
    // Groups with always-visible core items survive.
    expect(groups.map((g) => g.id)).toContain("website");
    expect(groups.map((g) => g.id)).toContain("account");
    expect(groups.map((g) => g.id)).toContain("tools");
  });

  it("drops a whole business group when every business module is disabled", () => {
    const groups = buildSidebarGroups(ctx({
      enabledModules: {
        services: false, products: false, courses: false, events: false,
        payments: false, commerce: false,
      },
    }));
    expect(groups.map((g) => g.id)).not.toContain("business");
  });

  it("hides superAdminOnly User Management from clients, shows it to superadmins", () => {
    const clientItems = allItems(buildSidebarGroups(ctx({ isSuperAdmin: false }))).map((i) => i.label);
    expect(clientItems).not.toContain("User Management");
    const adminItems = allItems(buildSidebarGroups(ctx({ isSuperAdmin: true }))).map((i) => i.label);
    expect(adminItems).toContain("User Management");
  });

  it("never renders FUTURE/UNSUPPORTED workflows (Trips, Listings, Menu-Items engine, \u2026)", () => {
    // They are not registry entries \u2014 no context can render them.
    const ids = allItems(buildSidebarGroups(ctx())).map((i) => i.id);
    for (const future of ["trips", "destinations", "bookings", "appointments", "reservations", "listings", "agents", "showings", "menu-items", "donations", "members", "plans", "travelers", "analytics"]) {
      expect(ids).not.toContain(future);
    }
    const labels = allItems(buildSidebarGroups(ctx())).map((i) => i.label);
    for (const future of ["Trips", "Destinations", "Bookings", "Reservations", "Listings", "Showings", "Donations", "Travelers"]) {
      expect(labels).not.toContain(future);
    }
  });
});

describe("sidebarNav model \u2014 findGroupOfHref", () => {
  const groups = buildSidebarGroups(ctx());

  it("maps routes to their owning group (parent highlight)", () => {
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/articles`)?.id).toBe("content");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/media`)?.id).toBe("content");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/inbox`)?.id).toBe("engagement");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/help`)?.id).toBe("account");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/backups`)?.id).toBe("tools");
  });

  it("matches query-string variants at path level (wouter 3 location includes ?)", () => {
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/articles?filter=draft`)?.id).toBe("content");
    expect(findGroupOfHref(groups, `/app/sites/${SITE_ID}/events?filter=all`)?.id).toBe("business");
  });

  it("returns null for unknown routes", () => {
    expect(findGroupOfHref(groups, "/app")).toBeNull();
    expect(findGroupOfHref(groups, "/sign-in")).toBeNull();
  });
});

// \u2500\u2500 2. Persistence hook: useSidebarUi.ts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("useSidebarUi \u2014 per-user localStorage persistence", () => {
  it("returns defaults when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarUi("u1"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(result.current.compact).toBe(false);
  });

  it("toggleGroup adds, persists, then removes a group", () => {
    const { result } = renderHook(() => useSidebarUi("u1"));
    act(() => result.current.toggleGroup("content"));
    expect(result.current.collapsedGroups).toEqual(["content"]);
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.u1")!)).toEqual({
      collapsedGroups: ["content"],
      compact: false,
    });
    act(() => result.current.toggleGroup("content"));
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

  it("hydrates current group ids from the per-user key on mount", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1.u2",
      JSON.stringify({ collapsedGroups: ["growth"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi("u2"));
    expect(result.current.collapsedGroups).toEqual(["growth"]);
    expect(result.current.compact).toBe(true);
  });

  it("maps legacy 7-group ids FORWARD to the 8-group layout (Phase 2 \u2192 Phase 6)", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1.u5",
      JSON.stringify({ collapsedGroups: ["edit-website", "media", "communication", "marketing", "site", "taya-managed"], compact: false }),
    );
    const { result } = renderHook(() => useSidebarUi("u5"));
    expect(result.current.collapsedGroups).toEqual(["website", "content", "engagement", "growth", "tools"]);
  });

  it("de-duplicates aliases that collapse onto the same group (edit-website + site \u2192 website)", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1.u6",
      JSON.stringify({ collapsedGroups: ["edit-website", "site"], compact: false }),
    );
    const { result } = renderHook(() => useSidebarUi("u6"));
    expect(result.current.collapsedGroups).toEqual(["website"]);
  });

  it("isolates users: another user's stored state does not leak", () => {
    window.localStorage.setItem(
      "taya.sidebar.v2",
      JSON.stringify({ collapsedGroups: ["account"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi("u1"));
    expect(result.current.collapsedGroups).toEqual([]);
    expect(result.current.compact).toBe(false);
  });

  it("falls back to the shared key when no user id is available (legacy ids still mapped)", () => {
    window.localStorage.setItem(
      "taya.sidebar.v1",
      JSON.stringify({ collapsedGroups: ["media"], compact: true }),
    );
    const { result } = renderHook(() => useSidebarUi(null));
    expect(result.current.collapsedGroups).toEqual(["content"]);
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

// \u2500\u2500 3. Component: SidebarNav.tsx \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("SidebarNav \u2014 collapsible groups", () => {
  it("renders every group header as an aria-expanded toggle", () => {
    renderSidebar();
    for (const title of ["Website", "Content", "Business", "Engagement", "Growth", "Tools", "Account"]) {
      const btn = screen.getByRole("button", { name: `Toggle ${title} section` });
      expect(btn).toHaveAttribute("aria-expanded", "true");
    }
    expect(screen.getByTestId("sidebar-nav")).toHaveAttribute("aria-label", "Website sections");
  });

  it("renders core-only for a client while truth is unknown (never a blank sidebar)", () => {
    // enabledModules null + rolePermissions null \u2192 core-only (Decision 3).
    renderSidebar({ enabledModules: null, rolePermissions: null });
    expect(screen.getByRole("button", { name: "Toggle Website section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Account section" })).toBeInTheDocument();
    // Optional surfaces are NOT guessed into existence.
    expect(screen.queryByRole("button", { name: "Toggle Content section" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle Business section" })).toBeNull();
    expect(screen.queryByText("Blog & Articles")).toBeNull();
    expect(screen.queryByText("Courses & Classes")).toBeNull();
    // Core client surfaces still render.
    expect(screen.getByText("All Pages")).toBeInTheDocument();
    expect(screen.getByText("Website Settings")).toBeInTheDocument();
    expect(screen.getByText("My Permissions")).toBeInTheDocument();
  });

  it("collapses a group via its toggle and reports the group id upward", () => {
    const { onToggleGroup } = renderSidebar({ collapsedGroups: ["content"] });
    expect(screen.getByRole("button", { name: "Toggle Content section" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Media Library")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Content section" }));
    expect(onToggleGroup).toHaveBeenCalledWith("content");
  });

  it("keeps showing the active item when its group is collapsed", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/articles`;
    renderSidebar({ collapsedGroups: ["content"] });
    const header = screen.getByRole("button", { name: "Toggle Content section" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    // Active item (and its nested children) stay visible under the rail.
    expect(screen.getByText("Blog & Articles")).toBeInTheDocument();
    expect(screen.getByText("Drafts")).toBeInTheDocument();
    // Inactive siblings inside the collapsed Content group are hidden.
    expect(screen.queryByText("Media Library")).toBeNull();
    expect(screen.queryByText("Flyers")).toBeNull();
    // The Website group is NOT collapsed — its items stay visible.
    expect(screen.getByText("All Pages")).toBeInTheDocument();
  });
});

describe("SidebarNav \u2014 active state & nested submenus", () => {
  it("marks the active item with aria-current and highlights its parent group", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/articles`;
    renderSidebar();
    const articles = screen.getByText("Blog & Articles").closest("button");
    expect(articles).toHaveAttribute("aria-current", "page");
    // Parent-group highlight (articles lives in the Content group).
    const groupTitle = screen.getByText("Content");
    expect(groupTitle.className).toContain("text-primary/80");
    // No other group's title is highlighted.
    expect(screen.getByText("Website").className).not.toContain("text-primary/80");
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

describe("SidebarNav \u2014 design lock, badges, module gating", () => {
  it("renders design-locked items as disabled affordances for clients (no navigation)", () => {
    renderSidebar({ isSuperAdmin: false });
    const locked = screen.getByText("Version History").closest('[aria-disabled="true"]');
    expect(locked).not.toBeNull();
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}/history"]`)).toBeNull();
    // Every locked destination is a disabled affordance for clients.
    for (const label of [
      "Menu Builder", "Footer", "Square Payments", "Commerce", "Marketing & CRM",
      "Email Configuration", "Payment Providers", "Health Monitor", "Backups",
    ]) {
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

  it("hides module-disabled items (hide-empty in the component); explicit false beats lock", () => {
    renderSidebar({
      enabledModules: { media: false, payments: false, commerce: false },
    });
    // Media is one of eight Content items \u2014 the item drops, the group stays.
    expect(screen.queryByText("Media Library")).toBeNull();
    expect(screen.getByRole("button", { name: "Toggle Content section" })).toBeInTheDocument();
    expect(screen.getByText("Blog & Articles")).toBeInTheDocument();
    // Explicitly disabled modules drop even their locked items.
    expect(screen.queryByText("Square Payments")).toBeNull();
    expect(screen.queryByText("Commerce")).toBeNull();
    // Payment Providers (payment_providers key) is a different module \u2014 stays.
    expect(screen.getByText("Payment Providers")).toBeInTheDocument();
  });
});

describe("SidebarNav \u2014 compact rail & keyboard navigation", () => {
  it("renders icon-only rail in compact mode: no visible labels, aria-labels intact", () => {
    renderSidebar({ compact: true });
    // Group titles are not rendered as text (tooltip only).
    expect(screen.queryByText("Website")).toBeNull();
    expect(screen.queryByText("All Pages")).toBeNull();
    // Headers stay real toggles with accessible names.
    expect(screen.getByRole("button", { name: "Toggle Website section" })).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus with ArrowDown/ArrowUp between visible nav controls", () => {
    renderSidebar();
    const nav = screen.getByTestId("sidebar-nav");
    const first = screen.getByRole("button", { name: "Toggle Website section" });
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

// \u2500\u2500 4. Integration: AppLayout client workspace chrome \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("AppLayout \u2014 Phase 6 client workspace integration", () => {
  it("renders site identity, Dashboard entry and the full sidebar", () => {
    useClientWorkspace();
    mockLocation.value = `/app/sites/${SITE_ID}`;
    renderAppLayout();
    // Site identity \u2014 name + domain, never raw ids.
    expect(screen.getByText("FSTS Test Site")).toBeInTheDocument();
    expect(screen.getAllByText("fsts-test.example.com").length).toBeGreaterThan(0);
    expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument();
    // Dashboard entry links to the site workspace root.
    expect(document.querySelector(`a[href="/app/sites/${SITE_ID}"]`)).not.toBeNull();
    // Sidebar content: capability groups + optional items present (truthful
    // owner viewer \u2014 decided module defaults + owner permission row).
    expect(screen.getByRole("button", { name: "Toggle Website section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Content section" })).toBeInTheDocument();
    expect(screen.getByText("Media Library")).toBeInTheDocument();
    expect(screen.getByText("Blog & Articles")).toBeInTheDocument();
    // Client affordances: locked design tier + no User Management.
    expect(screen.getByText("Version History").closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.queryByText("User Management")).toBeNull();
    // Media broken badge wired from api.media.healthStats.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("falls back to core-only chrome while the viewer truth is loading", () => {
    // Simulate queries not yet resolved: dispatch leaves the two Phase 6
    // queries unmocked \u2192 null \u2192 core-only for optional surfaces.
    useClientWorkspace({
      "api.sites.getEffectiveModules": null,
      "api.accessControl.getMyPermissions": null,
    });
    renderAppLayout();
    expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument();
    // Core groups + flat Dashboard entry still render \u2014 never a blank sidebar.
    expect(screen.getByRole("button", { name: "Toggle Website section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Account section" })).toBeInTheDocument();
    expect(screen.getByText("All Pages")).toBeInTheDocument();
    // Optional surfaces are hidden until the truth is known (never guessed).
    expect(screen.queryByText("Media Library")).toBeNull();
    expect(screen.queryByText("Blog & Articles")).toBeNull();
    // Bottom action area is unconditional chrome \u2014 stays available.
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("renders the bottom action area: View Live Site / Help / Account / Sign Out", () => {
    useClientWorkspace();
    renderAppLayout();
    expect(document.querySelector('a[href="https://fsts-test.example.com"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "View live site (opens in a new tab)" })).toBeInTheDocument();
    expect(document.querySelector('a[href="/app/sites/site_test123/help"]')).not.toBeNull();
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(document.querySelector('a[href="https://accounts.app.fstsclientsystem.com"]')).not.toBeNull();
    // "Account" matches both the sidebar's Account group header and the
    // bottom-action link — assert at least one bottom action renders it.
    expect(screen.getAllByText("Account").length).toBeGreaterThanOrEqual(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Toggle Content section" }));
    expect(JSON.parse(window.localStorage.getItem("taya.sidebar.v1.user_client_1")!).collapsedGroups).toEqual(["content"]);
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
