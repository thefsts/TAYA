/**
 * visual-editor-degraded.test.tsx
 *
 * HOTFIX (production no-go, BLOCKER 2 §3) — degraded state for the zone-truth
 * queries on the Visual Editor page.
 *
 * Production shipped frontend 542d340 against Convex backend
 * 20260909T184550Z-5919c54edbed which PREDATES it — the editorZones
 * functions do not exist on that deployment. Plain useQuery throws on the
 * resulting server error and unmounts the entire app ("App failed to
 * start" + raw stack for every client). This suite pins the contract:
 *
 *   1. Zone-query error → plain-language "editor temporarily unavailable"
 *      card, Try again button, and NO iframe — the app shell (AppLayout)
 *      stays mounted; raw error text / [CONVEX …] identifiers NEVER render.
 *   2. Try again REMOUNTS the editor (parent `attempt` counter) and, once
 *      the backend has the functions (zoneFailures cleared), the normal
 *      editor mounts: iframe + working tree reappear.
 *   3. Each of the three zone queries alone triggers the degraded state —
 *      one missing function is enough; the editor never partially renders.
 *   4. Success path (no failures) is unchanged: normal editor mounts.
 *
 * Retry semantics are pinned by convex 1.42.1 source: remount fully deletes
 * the query subscriptions (react/client.js / browser/sync/local_state.js
 * removeSubscriber) and a fresh mount re-subscribes with pristine args —
 * a genuine re-fetch, not a cached stale error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ───────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** useQuery_experimental — powers useClientSafeQuery. */
const mockUseQueryExperimental = vi.hoisted(() => vi.fn());
/** Zone query paths forced to error — simulates the production drift window. */
const zoneFailures = vi.hoisted(() => new Set<string>());
const mockLocation = vi.hoisted(() => ({ value: "/" }));
const mockNavigate = vi.hoisted(() => vi.fn());
/** Captured postMessage messages sent to the frame (parent → frame). */
const postMessageToFrame = vi.hoisted(() => vi.fn());

/* ── External / framework mocks (mirrors visual-editor.test.tsx) ────── */

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useQuery_experimental: mockUseQueryExperimental,
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
  useLocation: () => [mockLocation.value, mockNavigate],
  useSearch: () => mockLocation.value.split("?")[1] ?? "",
  useParams: () => ({ siteId: "site_test123" }),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
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

// AppLayout — render children directly; its presence (data-testid) is the
// assertion target: the app shell NEVER unmounts on zone-query errors.
vi.mock("@/pages/app/SiteDashboard", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/components/AIAssistant", () => ({ AIAssistant: () => null }));

vi.mock("@/components/ImagePickerField", () => ({
  ImagePickerField: (props: Record<string, unknown>) => (
    <div data-testid="image-picker" {...props} />
  ),
}));

/* ── Import (after mocks) ───────────────────────────────────────────── */

import VisualEditor from "@/pages/app/sites/VisualEditor";

/* ── Fixtures (happy-path shapes from visual-editor.test.tsx) ───────── */

const SITE_ID = "site_test123";

const CONTENT_MAP = {
  siteId: SITE_ID,
  domain: "www.fstacktsolutions.com",
  keyCount: 27,
  conformed: true,
  pages: [
    { path: "/", label: "Home", title: "Home", keyCount: 27 },
    { path: "/about", label: "About", title: "About", keyCount: 13 },
  ],
  entries: {
    "home.hero.heading": { type: "text", discovered: "Live Studio Heading" },
    "home.hero.image": { type: "image", discovered: "https://img.example/hero.jpg" },
    "home.about.body": { type: "text", discovered: "About this studio." },
    "home.hero.primaryButton.label": { type: "text", discovered: "Book Now" },
    "home.hero.primaryButton.href": { type: "url", discovered: "https://www.fstacktsolutions.com/contact" },
    "home.gallery.images[2]": { type: "image", discovered: "https://img.example/g2.jpg" },
    "home.services.items[0].title": { type: "text", discovered: "Consulting" },
    "home.services.items[0].description": { type: "text", discovered: "Strategy sessions." },
    "home.services.items[1].title": { type: "text", discovered: "Training" },
    "about.intro.heading": { type: "text", discovered: "About FSTS" },
    "about.intro.buttons[0]": { type: "list_item", discovered: "About FSTS" },
  },
};

const REVISIONS = [
  {
    revisionId: "rev1",
    publishedAt: 1735000000000,
    publishedBy: "Client User",
    keyCount: 3,
    summary: "Published 3 values to the live website",
  },
];

const ZONE_SUMMARIES = {
  connected: true,
  pages: [
    {
      path: "/",
      label: "Home",
      zones: [
        { zone: "hero", label: "Hero area", kinds: ["text", "button", "video"] },
        { zone: "content", label: "Content section", kinds: ["text", "image", "button", "video", "pdf"] },
      ],
    },
    {
      path: "/about",
      label: "About",
      zones: [
        { zone: "hero", label: "Hero area", kinds: ["text", "button", "video"] },
      ],
    },
  ],
};

const ZONE_BLOCKS = [
  {
    id: "blk1",
    pagePath: "/",
    zone: "hero",
    kind: "text",
    order:  0,
    content: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
    published: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
    pendingDelete: false,
    updatedAt: 1735000000000,
  },
];

const STRUCTURALS: Array<Record<string, unknown>> = [];

const DOWNLOADS = [
  { id: "dl1", title: "Service Catalog", url: "https://cdn.example/catalog.pdf", format: "PDF", isActive: true },
];

const FORMS = [{ id: "form1", name: "Contact us", status: "published" }];

const AUTHORITY_OK = { canPublish: true, connectionMode: "external", reason: null };

/** Zone-truth query paths as dispatched by the mock. */
const ZONE_PATHS = [
  "api.editorZones.listZoneBlocks",
  "api.editorZones.zoneSummaries",
  "api.editorZones.structuralsFor",
] as const;

/** Configure the convex useQuery/useMutation mocks for a scenario. */
function setup() {
  const dispatch: Record<string, unknown> = {
    "api.contentMap.get": CONTENT_MAP,
    "api.publishing.canPublish": AUTHORITY_OK,
    "api.editor.editorRevisions": REVISIONS,
    "api.editorZones.zoneSummaries": ZONE_SUMMARIES,
    "api.editorZones.listZoneBlocks": ZONE_BLOCKS,
    "api.editorZones.structuralsFor": STRUCTURALS,
    "api.downloads.list": DOWNLOADS,
    "api.forms.list": FORMS,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseQueryExperimental.mockImplementation(
    (opts: { query: unknown; args?: Record<string, unknown> }) => {
      const path =
        typeof opts.query === "function" ? (opts.query as () => string)() : (opts.query as string);
      if (zoneFailures.has(path)) {
        return {
          status: "error",
          error: new Error(
            `[CONVEX Q(${path.replace("api.", "")})] Server Error \u2014 function not found on the deployment`,
          ),
        };
      }
      if (Object.prototype.hasOwnProperty.call(dispatch, path)) {
        return { status: "success", data: dispatch[path] };
      }
      return { status: "pending" };
    },
  );
  const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
  mockUseMutation.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (!mutations[path]) mutations[path] = vi.fn(async () => ({}));
    return mutations[path];
  });
  mutations["api.editor.createFrameToken"] = vi.fn(async (args: Record<string, unknown>) => ({
    token: `tok-${Math.random().toString(36).slice(2)}`,
    path: (args?.path as string) ?? "/",
    expiresAt: Date.now() + 300_000,
  }));
  return { mutations, dispatch };
}

/** Render the editor, waiting for whichever of the frame / degraded card appears. */
async function renderEditor() {
  const utils = render(<VisualEditor />);
  await waitFor(() => {
    const iframe = document.querySelector("iframe[title='Website preview']");
    const degraded = screen.queryByText("The editor is temporarily unavailable");
    expect(iframe !== null || degraded !== null).toBe(true);
  });
  return utils;
}

/** Assert the degraded card is fully client-safe (the §3 contract). */
function expectDegradedCard() {
  expect(screen.getByText("The editor is temporarily unavailable")).toBeInTheDocument();
  expect(
    screen.getByText(/We're updating the website editor right now and it will be back shortly\./),
  ).toBeInTheDocument();
  expect(screen.getByText(/Your website and your saved work are safe/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  // The app shell never unmounts — the whole point of §3.
  expect(screen.getByTestId("app-layout")).toBeInTheDocument();
}

/** Assert no raw error text of ANY kind reached the DOM. */
function expectNoRawError() {
  expect(screen.queryByText(/\[CONVEX/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Server Error/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/function not found/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/App failed to start/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
}

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_test123/editor";
  vi.stubEnv("VITE_CONVEX_URL", "https://uncommon-cobra-336.convex.cloud");
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseQueryExperimental.mockReset();
  mockUseQueryExperimental.mockReturnValue({ status: "pending" });
  zoneFailures.clear();
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn(async () => ({})));
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
  mockNavigate.mockReset();
  postMessageToFrame.mockReset();

  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    get() {
      return { postMessage: postMessageToFrame };
    },
  });
});

/* ── 1. Zone-query error → client-safe degraded card ───────────────── */

describe("VisualEditor degraded — zone query error (BLOCKER 2 §3)", () => {
  it("shows the plain-language unavailable card — no iframe, shell stays mounted", async () => {
    setup();
    zoneFailures.add("api.editorZones.listZoneBlocks");
    await renderEditor();

    expectDegradedCard();
    expectNoRawError();
    // The frame must NOT mount on a degraded zone query.
    expect(document.querySelector("iframe[title='Website preview']")).toBeNull();
  });

  it("Try again remounts and, once the backend has the function, the normal editor mounts", async () => {
    setup();
    zoneFailures.add("api.editorZones.zoneSummaries");
    await renderEditor();

    expectDegradedCard();
    expectNoRawError();

    // Recovery: backend deploy lands (failure cleared) → user presses Try again.
    zoneFailures.clear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    });
    await waitFor(() => {
      expect(document.querySelector("iframe[title='Website preview']")).not.toBeNull();
    });
    expect(screen.queryByText("The editor is temporarily unavailable")).not.toBeInTheDocument();
    expectNoRawError();
  });

  it.each(ZONE_PATHS)(
    "one missing function (%s) alone degrades the whole editor — never a partial render",
    async (path) => {
      setup();
      zoneFailures.add(path);
      await renderEditor();

      expectDegradedCard();
      expectNoRawError();
      expect(document.querySelector("iframe[title='Website preview']")).toBeNull();
    },
  );

  it("retry is NOT a page reload — in-place remount preserves the app shell node", async () => {
    setup();
    zoneFailures.add("api.editorZones.structuralsFor");
    await renderEditor();

    expectDegradedCard();
    const shellBefore = screen.getByTestId("app-layout");
    const firstCard = screen.getByText("The editor is temporarily unavailable");

    zoneFailures.clear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    });
    await waitFor(() => {
      expect(document.querySelector("iframe[title='Website preview']")).not.toBeNull();
    });

    // The shell is the SAME DOM node — we remounted the editor, not the app.
    const shellAfter = screen.getByTestId("app-layout");
    expect(shellAfter).toBe(shellBefore);
    expect(screen.queryByText("The editor is temporarily unavailable")).not.toBeInTheDocument();
    // The degraded card node is really gone (old node, not a duplicate).
    expect(document.body.contains(firstCard)).toBe(false);
  });

  it("a persistent backend error keeps the degraded card client-safe across retries", async () => {
    setup();
    zoneFailures.add("api.editorZones.listZoneBlocks");
    await renderEditor();

    expectDegradedCard();
    // Retry WITHOUT clearing the failure — backend still missing the function.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("The editor is temporarily unavailable")).toBeInTheDocument();
    });
    expectNoRawError();
    expect(document.querySelector("iframe[title='Website preview']")).toBeNull();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

/* ── 2. Success path unchanged ──────────────────────────────────────── */

describe("VisualEditor degraded — success path is unchanged", () => {
  it("no failures → normal editor mounts with the iframe", async () => {
    setup();
    await renderEditor();

    expect(screen.queryByText("The editor is temporarily unavailable")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector("iframe[title='Website preview']")).not.toBeNull();
    });
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    expectNoRawError();
  });

  it("zone data pending (not error) waits for data — does not show the degraded card", async () => {
    setup();
    // listZoneBlocks stays pending forever: dispatch key present but failure
    // NOT set — the mock only errors when the path is in zoneFailures; a
    // pending query means the dispatch lookup returns pending only when
    // the path is missing from dispatch. To force pending, remove the key.
    // Simplest honest approach: leave zone queries returning pending by
    // overriding the implementation for these three paths.
    mockUseQueryExperimental.mockImplementation(
      (opts: { query: unknown; args?: Record<string, unknown> }) => {
        const path =
          typeof opts.query === "function" ? (opts.query as () => string)() : (opts.query as string);
        if (ZONE_PATHS.includes(path as (typeof ZONE_PATHS)[number])) {
          return { status: "pending" };
        }
        if (path === "api.contentMap.get") return { status: "success", data: CONTENT_MAP };
        if (path === "api.publishing.canPublish") return { status: "success", data: AUTHORITY_OK };
        if (path === "api.editor.editorRevisions") return { status: "success", data: REVISIONS };
        return { status: "pending" };
      },
    );
    await renderEditor();

    expect(screen.queryByText("The editor is temporarily unavailable")).not.toBeInTheDocument();
    expectNoRawError();
    // Still the normal editor chrome (no iframe yet — zone truth pending),
    // but crucially NOT the error card.
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
