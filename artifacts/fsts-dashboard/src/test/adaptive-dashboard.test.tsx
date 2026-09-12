/**
 * adaptive-dashboard.test.tsx
 *
 * Phase 6 (Chat A) F3 — the ADAPTIVE DASHBOARD acceptance suite.
 *
 * This is the cross-cutting suite proving the PM-approved adaptive-dashboard
 * contract end to end:
 *
 *   - ONE registry, ONE derivation: useSiteCapabilities (card surfaces) and
 *     buildSidebarGroups (navigation) resolve from the same
 *     CAPABILITY_REGISTRY + the same truth sources and can never disagree.
 *   - UNKNOWN truth \u2192 CORE-ONLY (PM decision 3): while either
 *     api.sites.getEffectiveModules or api.accessControl.getMyPermissions is
 *     loading/failed, no optional surface is ever guessed into existence.
 *   - Explicit owner decisions (true/false) always beat business-fit
 *     de-clutter.
 *   - TERMINOLOGY IS PRESENTATION ONLY (labels never gate).
 *   - FUTURE/UNSUPPORTED workflows (Trips, Listings, Bookings, \u2026) are
 *     documented and can never resolve visible; no surface may alias them
 *     onto Courses/Events/Products.
 *   - Role-aware navigation: every affordance respects the viewer's
 *     truthful permission level.
 *   - Cross-tenant: two viewers on the same site get different models from
 *     per-viewer truth (getMyPermissions is viewer-scoped), never per-tenant
 *     memoization bugs.
 *   - Design-lock contract, legacy persistence compat, accessibility, and
 *     six business profiles (restaurant, real_estate, training_academy,
 *     security_company, professional_services, ecommerce).
 *
 * It complements (does not duplicate) sidebar-nav.test.tsx (nav structure),
 * site-dashboard.test.tsx (workspace cards/quick actions), and
 * client-help.test.tsx (client language audit).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen, within } from "@testing-library/react";
import React from "react";

// \u2500\u2500 Hoisted mock handles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** Mutable current location shared by the wouter mock (wouter 3: includes query). */
const mockLocation = vi.hoisted(() => ({ value: "/" }));

// \u2500\u2500 External / framework mocks (match sidebar-nav.test.tsx) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy \u2014 any property chain resolves to a callable that returns its own
// path string ("api.sites.get"), so the mock useQuery can dispatch on the
// queried function path.
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
  useParams: () => ({}),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  Redirect: () => null,
}));

// Only SidebarNav surfaces are rendered here (not full AppLayout), so
// clerk / AIAssistant mocks are not needed.

// \u2500\u2500 Imports (after mocks) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

import { TooltipProvider } from "@/components/ui/tooltip";
import { useSiteCapabilities, getSiteCapability, type MyPermissionsPayload } from "@/hooks/useSiteCapabilities";
import {
  CAPABILITY_REGISTRY,
  CAPABILITY_GROUP_IDS,
  CAPABILITY_GROUP_TITLES,
  LEGACY_GROUP_ALIASES,
  FUTURE_CAPABILITIES,
  FUTURE_CAPABILITY_KEYS,
  CAPABILITY_ROLE_MODULE_KEYS,
  assertRegistryInvariants,
  isFutureCapability,
} from "@/lib/capabilityRegistry";
import {
  TERMINOLOGY_PROFILES,
  resolveCapabilityLabel,
  isHiddenByBusinessFit,
  explainCapabilityLabel,
} from "@/lib/capabilityTerminology";
import { buildSidebarGroups } from "@/lib/sidebarNav";
import { ROLE_CAPABILITIES } from "@/lib/roleCapabilities";
import { SidebarNav } from "@/components/SidebarNav";
import { buildGettingStartedItems } from "@/components/GettingStartedCard";

// \u2500\u2500 Fixtures & helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const SITE_ID = "site_adapt1";

type RoleKey = keyof typeof ROLE_CAPABILITIES;

/** getMyPermissions success shape for a given role row. */
function permissionsFor(
  role: RoleKey,
  overrides: Record<string, "none" | "view" | "edit" | "manage"> = {},
): MyPermissionsPayload {
  return {
    isSuperAdmin: false,
    role: String(role),
    permissions: { ...ROLE_CAPABILITIES[role], ...overrides },
  };
}

const OWNER: MyPermissionsPayload = permissionsFor("owner");
const READ_ONLY: MyPermissionsPayload = permissionsFor("read_only");

/** Sidebar ctx type derived from the builder signature. */
type SidebarCtx = Parameters<typeof buildSidebarGroups>[0];

/** Sidebar ctx identical to the hook's truth sources. */
function sidebarCtx(overrides: Partial<SidebarCtx> = {}): SidebarCtx {
  return {
    siteId: SITE_ID,
    enabledModules: {},
    rolePermissions: ROLE_CAPABILITIES.owner,
    isSuperAdmin: false,
    websiteType: null,
    ...overrides,
  };
}

/** Render the hook for a site with explicit truth sources. */
function renderCapabilities(
  modules: Record<string, boolean> | null,
  permissions: MyPermissionsPayload | null,
  options: { websiteType?: string | null } = {},
) {
  const dispatch: Record<string, unknown> = {
    "api.sites.getEffectiveModules": modules,
    "api.accessControl.getMyPermissions": permissions,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    return dispatch[path] ?? null;
  });
  return renderHook(() => useSiteCapabilities(SITE_ID, options));
}

/** Flat list of sidebar item ids across all groups. */
function sidebarItemIds(ctx: SidebarCtx): string[] {
  return buildSidebarGroups(ctx).flatMap((g) => g.items.map((i) => i.id));
}

function renderSidebarWith(props: Partial<React.ComponentProps<typeof SidebarNav>> = {}) {
  return render(
    <TooltipProvider>
      <SidebarNav
        siteId={SITE_ID}
        isSuperAdmin={false}
        collapsedGroups={[]}
        onToggleGroup={vi.fn()}
        {...props}
      />
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

// \u2500\u2500 1. Registry integrity \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("1. capability registry integrity", () => {
  it("has 44 entries \u2014 all native, unique keys/routes, valid groups", () => {
    expect(CAPABILITY_REGISTRY).toHaveLength(44);
    expect(assertRegistryInvariants()).toEqual({
      allNative: true,
      noFutureKeysInRegistry: true,
      uniqueKeys: true,
      groupsValid: true,
    });
    expect(new Set(CAPABILITY_REGISTRY.map((c) => c.route)).size).toBe(CAPABILITY_REGISTRY.length);
  });

  it("organizes into the 8 approved groups with titles", () => {
    expect(CAPABILITY_GROUP_IDS).toEqual([
      "overview", "website", "content", "business", "engagement", "growth", "tools", "account",
    ]);
    expect(CAPABILITY_GROUP_TITLES).toEqual({
      overview: "Overview", website: "Website", content: "Content",
      business: "Business", engagement: "Engagement", growth: "Growth",
      tools: "Tools", account: "Account",
    });
    for (const cap of CAPABILITY_REGISTRY) {
      expect(CAPABILITY_GROUP_IDS).toContain(cap.group);
    }
  });

  it("documents exactly 14 FUTURE workflows with real missing contracts", () => {
    expect(FUTURE_CAPABILITIES).toHaveLength(14);
    const registryKeys = CAPABILITY_REGISTRY.map((c) => c.key);
    for (const future of FUTURE_CAPABILITIES) {
      // Each entry explains exactly what is missing \u2014 not a one-liner.
      expect(future.missingContract.length).toBeGreaterThan(40);
      // Registry and future list are disjoint.
      expect(registryKeys).not.toContain(future.key);
    }
  });

  it("exposes role-capability keys as a cross-check for the matrix", () => {
    // 38 unique roleModuleKeys (35 sidebar modules + dashboard, site_users, help).
    expect(CAPABILITY_ROLE_MODULE_KEYS).toHaveLength(38);
    // The matrix covers every one of them.
    for (const key of CAPABILITY_ROLE_MODULE_KEYS) {
      expect(Object.keys(ROLE_CAPABILITIES.owner)).toContain(key);
    }
  });
});

// \u2500\u2500 2. Core-only fallback (PM decision 3) \u2014 one derivation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("2. core-only fallback (PM decision 3) \u2014 one derivation", () => {
  it("modules unknown OR permissions unknown \u2192 optional hidden; core survives", () => {
    const both = renderCapabilities(null, null).result.current;
    expect(both.isCoreOnly).toBe(true);
    // Optional surfaces are never guessed into existence.
    for (const key of ["courses", "events", "products", "payments", "reviews", "crm"]) {
      expect(both.byKey[key].visible).toBe(false);
    }
    // Core surfaces stay reachable (ungated core).
    for (const key of ["pages", "visual-editor", "website-settings", "site-verification", "my-permissions"]) {
      expect(both.byKey[key].visible).toBe(true);
    }
    // Core-tier role-gated items are reachable too \u2014 "unknown" hides only
    // the optional tier, mirroring roleGateLevel() in sidebarNav.ts.
    for (const key of ["help", "site-users"]) {
      expect(both.byKey[key].visible).toBe(true);
    }

    // Single-unknown: permissions known but modules unknown \u2192 core-only.
    const modulesUnknown = renderCapabilities(null, OWNER).result.current;
    expect(modulesUnknown.isCoreOnly).toBe(true);
    expect(modulesUnknown.byKey.courses.visible).toBe(false);
    expect(modulesUnknown.byKey.pages.visible).toBe(true);

    // Single-unknown: modules known but permissions unknown \u2192 core-only.
    const permsUnknown = renderCapabilities({}, null).result.current;
    expect(permsUnknown.isCoreOnly).toBe(true);
    expect(permsUnknown.byKey.courses.visible).toBe(false);
    expect(permsUnknown.byKey.pages.visible).toBe(true);
  });

  it("the hook and the sidebar pipeline agree under core-only (one derivation)", () => {
    const hook = renderCapabilities(null, null).result.current;
    const sidebar = sidebarItemIds(sidebarCtx({ enabledModules: null, rolePermissions: null }));
    const hookVisible = hook.keys.filter((k) => {
      const cap = CAPABILITY_REGISTRY.find((c) => c.key === k);
      return hook.byKey[k].visible && cap && cap.inSidebar !== false && cap.scope !== "admin";
    });
    expect(hookVisible.sort()).toEqual([...sidebar].sort());
  });

  it("the hook and the sidebar pipeline agree under the happy path (owner)", () => {
    const hook = renderCapabilities({}, OWNER).result.current;
    const sidebar = sidebarItemIds(sidebarCtx());
    const hookVisible = hook.keys.filter((k) => {
      const cap = CAPABILITY_REGISTRY.find((c) => c.key === k);
      return hook.byKey[k].visible && cap && cap.inSidebar !== false && cap.scope !== "admin";
    });
    expect(hookVisible.sort()).toEqual([...sidebar].sort());
  });

  it("agreement holds for read_only and events_manager viewers", () => {
    const pairs: Array<{ permissions: MyPermissionsPayload; role: RoleKey }> = [
      { permissions: READ_ONLY, role: "read_only" },
      { permissions: permissionsFor("events_manager"), role: "events_manager" },
    ];
    for (const { permissions, role } of pairs) {
      const hook = renderCapabilities({}, permissions).result.current;
      const sidebar = sidebarItemIds(sidebarCtx({ rolePermissions: ROLE_CAPABILITIES[role] }));
      const hookVisible = hook.keys.filter((k) => {
        const cap = CAPABILITY_REGISTRY.find((c) => c.key === k);
        return hook.byKey[k].visible && cap && cap.inSidebar !== false && cap.scope !== "admin";
      });
      expect(hookVisible.sort()).toEqual([...sidebar].sort());
    }
  });
});

// \u2500\u2500 3. Module gating: explicit decisions, safe defaults \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("3. module gating \u2014 explicit owner decisions", () => {
  it("explicit false hides a locked optional module; explicit true beats business-fit de-clutter", () => {
    const model = renderCapabilities(
      { payments: false, services: true },
      OWNER,
      { websiteType: "restaurant" },
    ).result.current;

    // payments:false \u2014 owner disabled a locked module; the decision wins.
    expect(model.byKey.payments.visible).toBe(false);
    // services:true \u2014 explicit owner decision beats the restaurant
    // profile's hiddenByDefault (owner said yes \u2192 no de-clutter hiding).
    expect(model.byKey.services.visible).toBe(true);
    // products is unset here, but restaurant hides products by default
    // post-veto (PM VETO: products must NOT be presented as a restaurant
    // menu \u2014 see capabilityTerminology.ts restaurant profile). Safe
    // business-fit default \u2014 hidden unless explicitly enabled.
    expect(model.byKey.products.visible).toBe(false);
  });

  it("explicit true on products beats restaurant's hiddenByDefault (safe business-fit escape hatch)", () => {
    const model = renderCapabilities({ products: true }, OWNER, { websiteType: "restaurant" }).result.current;
    // Owner explicitly enabled Products as real commerce for this site \u2014
    // that decision always wins over the profile's default de-clutter.
    expect(model.byKey.products.visible).toBe(true);
    // Label stays the generic default \u2014 no restaurant alias exists.
    expect(model.byKey.products.label).toBe("Products");
  });

  it("unset module entries under a profile \u2192 hiddenByDefault de-clutter (restaurant)", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "restaurant" }).result.current;
    for (const key of ["services", "downloads", "articles", "policy", "testimonials", "products"]) {
      expect(model.byKey[key].visible).toBe(false);
    }
    // Other optional capabilities stay visible (unset = on by default).
    expect(model.byKey.courses.visible).toBe(true);
    expect(model.byKey.events.visible).toBe(true);
    expect(model.byKey.media.visible).toBe(true);
  });

  it("explicit false beats business-fit hiding even for hiddenByDefault keys (real_estate products)", () => {
    // real_estate hides products by default, but an explicit owner "true"
    // always wins.
    const explicit = renderCapabilities({ products: true }, OWNER, { websiteType: "real_estate" }).result.current;
    expect(explicit.byKey.products.visible).toBe(true);
    // And explicit false is hidden anyway.
    const off = renderCapabilities({ products: false }, OWNER, { websiteType: "real_estate" }).result.current;
    expect(off.byKey.products.visible).toBe(false);
    // Unset \u2192 business-fit hidden.
    const unset = renderCapabilities({}, OWNER, { websiteType: "real_estate" }).result.current;
    expect(unset.byKey.products.visible).toBe(false);
  });
});

// \u2500\u2500 4. Role-aware navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("4. role-aware navigation", () => {
  it("owner gets manage everywhere; read_only gets view everywhere except flyers", () => {
    const owner = renderCapabilities({}, OWNER).result.current;
    for (const key of ["courses", "events", "payments", "media"]) {
      expect(owner.byKey[key].level).toBe("manage");
      expect(owner.byKey[key].canManage).toBe(true);
    }

    const ro = renderCapabilities({}, READ_ONLY).result.current;
    for (const key of ["courses", "events", "media", "payments"]) {
      expect(ro.byKey[key].level).toBe("view");
      expect(ro.byKey[key].canEdit).toBe(false);
    }
    // flyers: none for read_only.
    expect(ro.byKey.flyers.level).toBe("none");
    expect(ro.byKey.flyers.visible).toBe(false);
  });

  it("events_manager sees the events lane, not the courses/payments/inbox lanes", () => {
    const em = renderCapabilities({}, permissionsFor("events_manager")).result.current;
    expect(em.byKey.events.level).toBe("manage");
    expect(em.byKey.courses.visible).toBe(false);
    expect(em.byKey.payments.visible).toBe(false);
    expect(em.byKey.inbox.visible).toBe(false);
    expect(em.byKey.reviews.visible).toBe(true);
    expect(em.byKey.media.visible).toBe(true);
  });

  it("content_editor sees the content lane with edit, not payments", () => {
    const ce = renderCapabilities({}, permissionsFor("content_editor")).result.current;
    expect(ce.byKey.courses.level).toBe("edit");
    expect(ce.byKey.articles.level).toBe("edit");
    expect(ce.byKey.payments.visible).toBe(false);
    expect(ce.byKey.inbox.level).toBe("view");
    expect(ce.byKey.flyers.level).toBe("none");
  });

  it("site-users gated by site_users:view; user-management is admin-scope only", () => {
    const ro = renderCapabilities({}, READ_ONLY).result.current;
    expect(ro.byKey["site-users"].level).toBe("view");
    expect(ro.byKey["site-users"].visible).toBe(true);
    // user-management never visible to a client viewer.
    expect(ro.byKey["user-management"].visible).toBe(false);
    expect(sidebarItemIds(sidebarCtx({ rolePermissions: ROLE_CAPABILITIES.read_only }))).not.toContain("user-management");
    // \u2026and superAdmin sees it.
    expect(sidebarItemIds(sidebarCtx({ isSuperAdmin: true }))).toContain("user-management");
  });

  it("superAdmin bypasses role gating (manage) but not module gating or business-fit", () => {
    const sa = renderCapabilities(
      { payments: false },
      { isSuperAdmin: true, role: null, permissions: {} },
    ).result.current;
    for (const key of ["courses", "events", "media"]) {
      expect(sa.byKey[key].level).toBe("manage");
    }
    // Module gating still applies (payments:false).
    expect(sa.byKey.payments.visible).toBe(false);
    // Admin-scope surfaces appear for superAdmins.
    expect(sa.byKey["user-management"].visible).toBe(true);
  });
});

// \u2500\u2500 5. Terminology: presentation only \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("5. terminology \u2014 presentation only", () => {
  it("restaurant labels change; levels and visibility do not", () => {
    const generic = renderCapabilities({}, OWNER, { websiteType: null }).result.current;
    const restaurant = renderCapabilities({}, OWNER, { websiteType: "restaurant" }).result.current;
    expect(generic.byKey.courses.label).toBe("Courses & Classes");
    expect(restaurant.byKey.courses.label).toBe("Culinary Classes");
    // PM VETO: products is NOT relabeled "Menu Items" \u2014 no restaurant
    // menu contract exists (sections, modifiers, availability, dietary,
    // ordering). Products keeps its generic default label everywhere.
    expect(restaurant.byKey.products.label).toBe("Products");
    expect(restaurant.byKey.events.label).toBe("Events & Specials");
    expect(restaurant.byKey.forms.label).toBe("Reservation Requests");
    expect(restaurant.byKey.team.label).toBe("Staff");
    // Presentation only: same levels, same visibility for renamed items.
    for (const key of ["courses", "events", "forms", "team"]) {
      expect(restaurant.byKey[key].level).toBe(generic.byKey[key].level);
      expect(restaurant.byKey[key].visible).toBe(generic.byKey[key].visible);
    }
    // products is the one deliberate exception: label AND visibility both
    // differ under the restaurant profile (safe business-fit hides it by
    // default; the generic/no-profile model does not), but the LEVEL
    // (role permission) is unaffected by terminology/business-fit \u2014
    // presentation-only still holds for permission level.
    expect(restaurant.byKey.products.level).toBe(generic.byKey.products.level);
    expect(restaurant.byKey.products.visible).toBe(false);
    expect(generic.byKey.products.visible).toBe(true);
  });

  it("site overrides beat the profile; explainCapabilityLabel reports the winner", () => {
    const model = renderCapabilities({}, OWNER).result.current;
    // Function-level checks: override wins over profile default.
    expect(
      resolveCapabilityLabel("courses", { websiteType: "restaurant", siteOverrides: { courses: "Chef Workshops" } }),
    ).toBe("Chef Workshops");
    expect(explainCapabilityLabel("courses", { websiteType: "restaurant" })).toEqual({
      label: "Culinary Classes",
      source: "profile",
    });
    expect(explainCapabilityLabel("courses", { websiteType: null })).toEqual({
      label: "Courses & Classes",
      source: "default",
    });
    expect(explainCapabilityLabel("courses", { websiteType: "restaurant", siteOverrides: { courses: "Chef Workshops" } })).toEqual({
      label: "Chef Workshops",
      source: "site-override",
    });
    // The model without overrides resolves the default.
    expect(model.byKey.courses.label).toBe("Courses & Classes");
  });

  it("non-profile types fall back to default labels honestly (nothing hidden)", () => {
    for (const wt of ["ecommerce", "professional_services", "business_website", "travel_agency", "construction", "custom_enterprise"]) {
      expect(resolveCapabilityLabel("courses", { websiteType: wt })).toBe("Courses & Classes");
      expect(resolveCapabilityLabel("products", { websiteType: wt })).toBe("Products");
      expect(isHiddenByBusinessFit("products", wt)).toBe(false);
      expect(isHiddenByBusinessFit("services", wt)).toBe(false);
    }
    expect(TERMINOLOGY_PROFILES["not-a-type"]).toBeUndefined();
  });
});

// \u2500\u2500 6. FUTURE capabilities: honest, documented, never renderable \u2500\u2500\u2500\u2500\u2500\u2500

describe("6. FUTURE capabilities \u2014 the critical product rule", () => {
  it("never resolve visible in the hook, for any role or business type", () => {
    const payloads: Array<MyPermissionsPayload> = [
      OWNER,
      READ_ONLY,
      permissionsFor("internal_qa"),
      { isSuperAdmin: true, role: null, permissions: {} },
    ];
    for (const payload of payloads) {
      const model = renderCapabilities({}, payload, { websiteType: "travel" }).result.current;
      for (const key of FUTURE_CAPABILITY_KEYS) {
        expect(model.byKey[key]).toBeUndefined();
      }
    }
  });

  it("never render in the sidebar for any business type", () => {
    for (const wt of ["travel", "restaurant", "real_estate", "church", "membership", "medical", "property_management"]) {
      const ids = sidebarItemIds(sidebarCtx({ websiteType: wt }));
      for (const key of FUTURE_CAPABILITY_KEYS) {
        expect(ids).not.toContain(key);
      }
      const labels = buildSidebarGroups(sidebarCtx({ websiteType: wt })).flatMap((g) => g.items.map((i) => i.label));
      for (const futureLabel of ["Trips", "Destinations", "Bookings", "Reservations", "Listings", "Agents", "Showings", "Menu Items", "Donations", "Members", "Plans", "Travelers"]) {
        // Menu Items is the restaurant SAFE ALIAS for products \u2014 only that
        // profile may present it (and it carries the PM veto flag). Other
        // types must never show it.
        if (wt === "restaurant" && futureLabel === "Menu Items") continue;
        expect(labels).not.toContain(futureLabel);
      }
    }
  });

  it("travel profile shows no fake Trips/Destinations/Travelers; native labels stay honest", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "travel" }).result.current;
    expect(model.byKey.courses.label).toBe("Courses & Classes");
    expect(model.byKey.products.label).toBe("Products");
    expect(model.byKey.events.label).toBe("Events");
    expect(model.byKey.products.visible).toBe(true);
    expect(model.byKey.courses.visible).toBe(true);
    expect(FUTURE_CAPABILITIES.find((c) => c.key === "trips")!.websiteTypes).toEqual(["travel"]);
    expect(isFutureCapability("trips")).toBe(true);
    expect(isFutureCapability("courses")).toBe(false);
  });

  it("documents the SAFE ALIAS boundaries and veto flags in missingContract", () => {
    // PM VETO (post-acceptance correction): products \u2192 "Menu Items" is no
    // longer a SAFE ALIAS \u2014 the missingContract now records the veto and
    // the required contract elements (sections, modifiers, availability,
    // dietary/allergen, pricing, images/descriptions, ordering relationship)
    // that must exist before any restaurant menu presentation ships.
    const menuItems = FUTURE_CAPABILITIES.find((c) => c.key === "menu-items")!;
    expect(menuItems.missingContract).toContain("VETOED");
    expect(menuItems.missingContract).toContain("must NOT be relabeled or presented as a restaurant menu");
    expect(menuItems.missingContract).toContain("menu sections/categories");
    expect(menuItems.missingContract).toContain("modifiers/options");
    expect(menuItems.missingContract).toContain("availability/sold-out state");
    expect(menuItems.missingContract).toContain("dietary/allergen");
    const agents = FUTURE_CAPABILITIES.find((c) => c.key === "agents")!;
    expect(agents.missingContract).toContain("SAFE ALIAS");
    expect(agents.missingContract).toContain("ROSTER");
    const listings = FUTURE_CAPABILITIES.find((c) => c.key === "listings")!;
    expect(listings.missingContract).toContain("must NOT be relabeled");
    const plans = FUTURE_CAPABILITIES.find((c) => c.key === "plans")!;
    expect(plans.missingContract).toContain("must NOT be relabeled");
  });
});

// \u2500\u2500 7. Composition: Getting Started from the single model \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("7. composition \u2014 Getting Started from the single model", () => {
  it("resolver from useSiteCapabilities drives Getting Started", () => {
    const model = renderCapabilities({}, OWNER).result.current;
    const isVisible = (capabilityKey: string) =>
      getSiteCapability(model, capabilityKey)?.visible ?? false;
    const items = buildGettingStartedItems(null, { formsConfigured: false, mediaCount: 0 }, {}, isVisible);
    expect(items.find((i) => i.key === "content")?.href).toBe("courses");
    expect(items.find((i) => i.key === "media")?.href).toBe("media");
    expect(items.find((i) => i.key === "business-info")?.href).toBe("contact");
    expect(items.find((i) => i.key === "team")?.href).toBe("team");
  });

  it("resolver precedence: legacy map says enabled but resolver says hidden \u2192 hidden", () => {
    const model = renderCapabilities({}, permissionsFor("events_manager")).result.current;
    const isVisible = (key: string) => getSiteCapability(model, key)?.visible ?? false;
    // events_manager cannot see courses (level none) \u2192 content target
    // falls to the first visible lane: events.
    const items = buildGettingStartedItems(null, null, {}, isVisible);
    expect(items.find((i) => i.key === "content")?.href).toBe("events");
    // contact is roleModuleKey contact = none for events_manager \u2192 business-info href null.
    expect(items.find((i) => i.key === "business-info")?.href).toBeNull();
    // media: view for events_manager \u2192 still offered.
    expect(items.find((i) => i.key === "media")?.href).toBe("media");
    // team: none for events_manager \u2192 null.
    expect(items.find((i) => i.key === "team")?.href).toBeNull();
  });

  it("legacy callers without a resolver keep the exact old behavior", () => {
    const items = buildGettingStartedItems(null, null, {});
    expect(items.find((i) => i.key === "content")?.href).toBe("courses");
    const disabled = buildGettingStartedItems(null, null, { team: false, media: false, courses: false, events: false, articles: false, services: false, contact: false });
    for (const item of disabled) {
      if (item.key !== "domain") expect(item.href).toBeNull();
    }
  });
});

// \u2500\u2500 8. Cross-tenant: per-viewer truth \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("8. cross-tenant \u2014 per-viewer truth", () => {
  it("two viewers on the same site derive different models from getMyPermissions", () => {
    const ownerModel = renderCapabilities({}, OWNER).result.current;
    const readerModel = renderCapabilities({}, READ_ONLY).result.current;

    expect(ownerModel.byKey.payments.level).toBe("manage");
    expect(readerModel.byKey.payments.level).toBe("view");
    expect(ownerModel.byKey.flyers.canEdit).toBe(true);
    expect(readerModel.byKey.flyers.canEdit).toBe(false);
    // Same site, same modules \u2014 different viewer truth.
    expect(ownerModel.enabledModules).toEqual(readerModel.enabledModules);
  });

  it("passes siteId through to both truth queries", () => {
    const seen: Array<[string, unknown]> = [];
    mockUseQuery.mockImplementation((q: unknown, args: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      seen.push([path, (args as { siteId?: string } | undefined)?.siteId]);
      return path === "api.sites.getEffectiveModules" ? {} : OWNER;
    });
    renderHook(() => useSiteCapabilities(SITE_ID, {}));
    expect(seen.map((s) => s[0]).sort()).toEqual([
      "api.accessControl.getMyPermissions",
      "api.sites.getEffectiveModules",
    ]);
    expect(seen.every((s) => s[1] === SITE_ID)).toBe(true);
  });
});

// \u2500\u2500 9. Design lock contract \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("9. design lock contract", () => {
  it("locks exactly the approved 11 optional capabilities; core never locked", () => {
    const locked = CAPABILITY_REGISTRY.filter((c) => c.designLocked).map((c) => c.key).sort();
    expect(locked).toEqual([
      "activity", "backups", "commerce", "crm", "email", "footer", "health",
      "history", "navigation", "payment-providers", "payments",
    ]);
    for (const cap of CAPABILITY_REGISTRY) {
      if (cap.designLocked) expect(cap.tier).toBe("optional");
    }
    // Core client surfaces are never locked.
    for (const key of ["pages", "visual-editor", "website-settings", "my-permissions", "site-users", "help"]) {
      expect(CAPABILITY_REGISTRY.find((c) => c.key === key)?.designLocked).toBeUndefined();
    }
  });

  it("a disabled locked module drops its item (owner decision wins over lock)", () => {
    const groups = buildSidebarGroups(sidebarCtx({ enabledModules: { payments: false, commerce: false } }));
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Square Payments");
    expect(labels).not.toContain("Commerce");
    // A different moduleKey is unaffected.
    expect(labels).toContain("Payment Providers");
    expect(labels).toContain("Version History");
    expect(labels).toContain("Health Monitor");
  });

  it("renders the locked affordance (aria-disabled) for a non-superAdmin client", () => {
    renderSidebarWith({
      enabledModules: {},
      rolePermissions: ROLE_CAPABILITIES.owner,
      websiteType: null,
    });
    const history = screen.getByText("Version History").closest("[role='button']");
    expect(history).not.toBeNull();
    expect(history?.getAttribute("aria-disabled")).toBe("true");
  });
});

// \u2500\u2500 10. Persistence compat (legacy group ids) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("10. persistence compat \u2014 legacy group ids", () => {
  it("LEGACY_GROUP_ALIASES maps the six Phase-2 ids to Phase-6 groups", () => {
    expect(LEGACY_GROUP_ALIASES).toEqual({
      "edit-website": "website",
      media: "content",
      communication: "engagement",
      marketing: "growth",
      site: "website",
      "taya-managed": "tools",
    });
    // Every alias target is a real Phase-6 group.
    for (const target of Object.values(LEGACY_GROUP_ALIASES)) {
      expect(CAPABILITY_GROUP_IDS).toContain(target);
    }
  });
});

// \u2500\u2500 11. Accessibility spot checks (full a11y in sidebar-nav.test.tsx) \u2500\u2500\u2500

describe("11. accessibility", () => {
  it("restaurant Culinary Classes (a real SAFE ALIAS) carries aria-current when active", () => {
    // products \u2192 "Menu Items" was PM-vetoed (no restaurant menu contract);
    // courses \u2192 "Culinary Classes" remains a genuine SAFE ALIAS (the
    // course catalog fields fit a class listing), so it stays the a11y
    // proof target for renamed-and-active nav items.
    mockLocation.value = `/app/sites/${SITE_ID}/courses`;
    renderSidebarWith({
      enabledModules: {},
      rolePermissions: ROLE_CAPABILITIES.owner,
      websiteType: "restaurant",
    });
    const culinaryClasses = within(screen.getByRole("navigation", { name: "Website sections" }))
      .getByText("Culinary Classes")
      .closest("button");
    expect(culinaryClasses).not.toBeNull();
    expect(culinaryClasses?.getAttribute("aria-current")).toBe("page");
  });

  it("restaurant Products (generic label, veto\u2019d alias) does not render unless explicitly enabled", () => {
    renderSidebarWith({
      enabledModules: {},
      rolePermissions: ROLE_CAPABILITIES.owner,
      websiteType: "restaurant",
    });
    const nav = screen.getByRole("navigation", { name: "Website sections" });
    expect(within(nav).queryByText("Menu Items")).toBeNull();
    expect(within(nav).queryByText("Products")).toBeNull();
  });

  it("group toggle carries aria-expanded; nav is labelled", () => {
    renderSidebarWith({
      enabledModules: {},
      rolePermissions: ROLE_CAPABILITIES.owner,
      websiteType: null,
    });
    const toggle = screen.getByRole("button", { name: /Toggle Business section/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const nav = screen.getByRole("navigation", { name: "Website sections" });
    expect(nav).not.toBeNull();
  });

  it("aria-current on the active page (All Pages)", () => {
    mockLocation.value = `/app/sites/${SITE_ID}/pages`;
    renderSidebarWith({
      enabledModules: {},
      rolePermissions: ROLE_CAPABILITIES.owner,
      websiteType: null,
    });
    const pages = within(screen.getByRole("navigation", { name: "Website sections" }))
      .getByText("All Pages")
      .closest("button");
    expect(pages?.getAttribute("aria-current")).toBe("page");
  });
});

// \u2500\u2500 12. Business profiles (the six adaptive dashboard stories) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("12. business profiles", () => {
  it("training_academy: Training Programs/Sessions/Enrollment/Instructors; nothing hidden", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "training_academy" }).result.current;
    expect(model.byKey.courses.label).toBe("Training Programs");
    expect(model.byKey.events.label).toBe("Sessions");
    expect(model.byKey.forms.label).toBe("Enrollment");
    expect(model.byKey.team.label).toBe("Instructors");
    expect(model.byKey.articles.label).toBe("Industry Articles");
    expect(model.byKey.products.label).toBe("Equipment & Gear");
    // No hiddenByDefault \u2192 all optional capabilities visible by default.
    for (const key of ["services", "products", "articles", "testimonials", "reviews"]) {
      expect(model.byKey[key].visible).toBe(true);
    }
  });

  it("security_company: Guard Services/Instructors & Guards/Service Inquiry", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "security_company" }).result.current;
    expect(model.byKey.services.label).toBe("Guard Services");
    expect(model.byKey.team.label).toBe("Instructors & Guards");
    expect(model.byKey.forms.label).toBe("Service Inquiry");
    expect(model.byKey.courses.label).toBe("Training Programs");
    expect(model.byKey.events.label).toBe("Sessions");
  });

  it("professional_services: default labels; appointments/bookings are FUTURE", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "professional_services" }).result.current;
    expect(model.byKey.courses.label).toBe("Courses & Classes");
    expect(model.byKey.services.label).toBe("Services");
    expect(isHiddenByBusinessFit("products", "professional_services")).toBe(false);
    const futures = FUTURE_CAPABILITIES.filter((c) => c.websiteTypes.includes("professional_services")).map((c) => c.key);
    expect(futures.sort()).toEqual(["appointments", "bookings"]);
  });

  it("ecommerce: native Products+Commerce, no fake Orders/Plans", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "ecommerce" }).result.current;
    expect(model.byKey.products.label).toBe("Products");
    expect(model.byKey.commerce.visible).toBe(true);
    expect(model.byKey.products.visible).toBe(true);
    expect(model.byKey.plans).toBeUndefined();
    expect(isFutureCapability("plans")).toBe(true);
  });

  it("restaurant: products hidden by default (Menu Items alias PM-vetoed); reservations FUTURE and undefined in the model", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "restaurant" }).result.current;
    // PM VETO (post-acceptance correction): products must NOT be presented
    // as "Menu Items" \u2014 no restaurant menu contract exists. Safe
    // business-fit default: hidden unless the owner explicitly enables it.
    expect(model.byKey.products.label).toBe("Products");
    expect(model.byKey.products.visible).toBe(false);
    // Owner can still explicitly opt in as real commerce for this site.
    const explicit = renderCapabilities({ products: true }, OWNER, { websiteType: "restaurant" }).result.current;
    expect(explicit.byKey.products.visible).toBe(true);
    expect(explicit.byKey.products.label).toBe("Products");
    expect(model.byKey.reservations).toBeUndefined();
    expect(isFutureCapability("reservations")).toBe(true);
    expect(FUTURE_CAPABILITIES.find((c) => c.key === "reservations")!.websiteTypes).toEqual(["restaurant"]);
    // menu-items stays FUTURE/UNSUPPORTED and is never in the live registry.
    expect(model.byKey["menu-items" as keyof typeof model.byKey]).toBeUndefined();
    expect(isFutureCapability("menu-items")).toBe(true);
  });

  it("real_estate: Agents & Brokers roster (SAFE ALIAS); products hidden; listings/showings FUTURE", () => {
    const model = renderCapabilities({}, OWNER, { websiteType: "real_estate" }).result.current;
    expect(model.byKey.team.label).toBe("Agents & Brokers");
    expect(model.byKey.team.visible).toBe(true);
    // products hidden by default (Listings must NOT be a relabel).
    expect(model.byKey.products.visible).toBe(false);
    expect(model.byKey.products.label).toBe("Products");
    expect(model.byKey.listings).toBeUndefined();
    expect(model.byKey.showings).toBeUndefined();
    expect(isFutureCapability("listings")).toBe(true);
    expect(isFutureCapability("showings")).toBe(true);
  });
});
