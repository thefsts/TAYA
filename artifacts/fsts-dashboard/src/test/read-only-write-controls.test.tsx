/**
 * read-only-write-controls.test.tsx — D5 certification.
 *
 * PM rule: a read_only viewer must NEVER see a write control the backend
 * (requirePermission) would reject. List/view stays available; Add / Edit /
 * Delete / reorder are hidden or replaced with an honest "View only" note.
 *
 * This suite renders each audited content manager twice:
 *   - read_only viewer  → no Add/Edit/Delete controls, "View only" shown
 *   - owner viewer      → the write controls are present
 *
 * The gate is the single capability model (useSiteCapabilities) via
 * useCanEditCapability, so the assertions pin the real derivation, not a
 * per-page role-string hack.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ─────────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

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
  useParams: () => ({ siteId: "site_test123" }),
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

/* ── Imports (after mocks) ────────────────────────────────────────────── */

import { TooltipProvider } from "@/components/ui/tooltip";
import { ROLE_CAPABILITIES } from "@/lib/roleCapabilities";
import type { MyPermissionsPayload } from "@/hooks/useSiteCapabilities";

import ArticlesList from "@/pages/app/sites/ArticlesList";
import ServicesManager from "@/pages/app/sites/ServicesManager";
import ProductsManager from "@/pages/app/sites/ProductsManager";
import TeamManager from "@/pages/app/sites/TeamManager";
import FaqManager from "@/pages/app/sites/FaqManager";
import TestimonialsManager from "@/pages/app/sites/TestimonialsManager";
import CareersManager from "@/pages/app/sites/CareersManager";

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const SITE_ID = "site_test123";

const SITE = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
  logoUrl: null,
};

function permissionsFor(role: keyof typeof ROLE_CAPABILITIES): MyPermissionsPayload {
  return {
    isSuperAdmin: false,
    role: String(role),
    permissions: { ...ROLE_CAPABILITIES[role] },
  };
}

const OWNER = permissionsFor("owner");
const READ_ONLY = permissionsFor("read_only");

/** All optional modules explicitly enabled so nothing is hidden by module truth. */
const ALL_MODULES_ON = {
  articles: true,
  services: true,
  products: true,
  team: true,
  faq: true,
  testimonials: true,
  careers: true,
};

function renderPage(
  node: React.ReactElement,
  permissions: MyPermissionsPayload,
  listPath: string,
  listData: unknown,
) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": SITE,
    "api.sites.getEffectiveModules": ALL_MODULES_ON,
    "api.accessControl.getMyPermissions": permissions,
    [listPath]: listData,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));
  mockUseAction.mockReturnValue(vi.fn().mockResolvedValue(undefined));
  return render(<TooltipProvider>{node}</TooltipProvider>);
}

/* ── Sample rows (non-empty so Edit/Delete render) ────────────────────── */

const ARTICLE = {
  id: "a1", _id: "a1", siteId: SITE_ID, title: "Hello", slug: "hello",
  excerpt: "", body: "body", status: "published", isPublished: true,
};
const SERVICE = {
  id: "s1", _id: "s1", siteId: SITE_ID, title: "Consulting", slug: "consulting",
  description: "desc", isActive: true,
};
const PRODUCT = {
  id: "p1", _id: "p1", siteId: SITE_ID, name: "Widget", slug: "widget",
  description: "desc", price: 10, isVisible: true, isFeatured: false,
};
const MEMBER = {
  id: "t1", _id: "t1", siteId: SITE_ID, name: "Jane Coach", role: "Head Coach",
  isActive: true,
};
const FAQ = {
  id: "f1", _id: "f1", siteId: SITE_ID, question: "Q?", answer: "A.",
  isPublished: true,
};
const TESTIMONIAL = {
  id: "m1", _id: "m1", siteId: SITE_ID, name: "Sam", text: "Great!",
  isActive: true,
};
const JOB = {
  id: "j1", _id: "j1", siteId: SITE_ID, title: "Coach", slug: "coach",
  description: "desc", isActive: true,
};

/* ── Suite ────────────────────────────────────────────────────────────── */

describe("D5 — read_only viewers never see write controls", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
  });

  const cases: Array<{
    name: string;
    node: React.ReactElement;
    listPath: string;
    row: unknown;
    addName: RegExp;
  }> = [
    {
      name: "ArticlesList",
      node: <ArticlesList params={{ siteId: SITE_ID }} />,
      listPath: "api.articles.list",
      row: ARTICLE,
      addName: /New Article/i,
    },
    {
      name: "ServicesManager",
      node: <ServicesManager params={{ siteId: SITE_ID }} />,
      listPath: "api.services.list",
      row: SERVICE,
      addName: /Add Service/i,
    },
    {
      name: "ProductsManager",
      node: <ProductsManager params={{ siteId: SITE_ID }} />,
      listPath: "api.products.list",
      row: PRODUCT,
      addName: /Add Product/i,
    },
    {
      name: "TeamManager",
      node: <TeamManager params={{ siteId: SITE_ID }} />,
      listPath: "api.team.list",
      row: MEMBER,
      addName: /Add Member/i,
    },
    {
      name: "FaqManager",
      node: <FaqManager params={{ siteId: SITE_ID }} />,
      listPath: "api.faq.list",
      row: FAQ,
      addName: /Add FAQ/i,
    },
    {
      name: "TestimonialsManager",
      node: <TestimonialsManager params={{ siteId: SITE_ID }} />,
      listPath: "api.testimonials.list",
      row: TESTIMONIAL,
      addName: /Add Testimonial/i,
    },
    {
      name: "CareersManager",
      node: <CareersManager params={{ siteId: SITE_ID }} />,
      listPath: "api.careers.list",
      row: JOB,
      addName: /Post Job/i,
    },
  ];

  for (const c of cases) {
    it(`${c.name}: read_only hides Add/Edit/Delete and shows "View only"`, () => {
      renderPage(c.node, READ_ONLY, c.listPath, [c.row]);
      // No create CTA.
      expect(screen.queryByRole("button", { name: c.addName })).toBeNull();
      // No edit/delete affordances.
      expect(screen.queryByRole("button", { name: /^Edit$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /Delete/i })).toBeNull();
      // Honest read-only indicator is present.
      expect(screen.getAllByText(/View only/i).length).toBeGreaterThan(0);
    });

    it(`${c.name}: owner sees the write controls`, () => {
      renderPage(c.node, OWNER, c.listPath, [c.row]);
      expect(screen.getByRole("button", { name: c.addName })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Edit$/i })).toBeInTheDocument();
    });
  }
});
