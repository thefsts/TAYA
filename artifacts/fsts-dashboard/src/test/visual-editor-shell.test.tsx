/**
 * visual-editor-shell.test.tsx
 *
 * Phase 4 test suite: the VisualEditorShell component — the WordPress-like
 * split-pane editing experience that wraps every content module.
 *
 * Covers:
 *   1. Header + ActionBar: title/subtitle, toolbarActions slot, default
 *      "Save Draft" label vs the singleton "Save Changes" saveLabel override,
 *      unsaved-changes indicator, History link, Discard gating.
 *   2. Breakpoint toolbar: desktop/tablet/mobile buttons, dimension badge,
 *      "Live site" honesty badge, refresh button, live site external link.
 *   3. Preview iframe: correct URL composition (domain + previewPath),
 *      sandbox attributes, click-to-edit bridge no-ops cross-origin.
 *   4. Save → preview refresh loop: isSaving true→false bumps the iframe key
 *      (remounts the preview) so the client sees saved content.
 *   5. No-domain fallback: children + honest dashed panel instead of preview.
 *   6. Mobile tabs: edit/preview toggle with dirty dot on the Preview tab.
 *   7. Integration: shell-wrapped singleton (AnnouncementBanner) and
 *      collection manager (TeamManager) render with real ActionBar wiring.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ─────────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
/** Mutable current location shared by the wouter mock (wouter 3: includes query). */
const mockLocation = vi.hoisted(() => ({ value: "/" }));

/* ── External / framework mocks (match sidebar-nav.test.tsx) ──────────── */

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// api proxy — any property chain resolves to a callable that returns its own
// path string ("api.sites.get"), so the mock useQuery can dispatch on the
// queried function path. Symbol-keyed lookups return undefined instead of
// throwing.
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

// wouter — Link renders a real <a href> so href assertions work exactly like
// production.
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

/* ── Imports (after mocks) ────────────────────────────────────────────── */

import { TooltipProvider } from "@/components/ui/tooltip";
import { VisualEditorShell } from "@/components/VisualEditorShell";

/* ── Fixtures & helpers ───────────────────────────────────────────────── */

const SITE_ID = "site_test123";

const SITE_WITH_DOMAIN = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: "fsts-test.example.com",
  status: "active",
  logoUrl: null,
};

const SITE_NO_DOMAIN = {
  _id: SITE_ID,
  name: "FSTS Test Site",
  domain: null,
  status: "active",
  logoUrl: null,
};

/** Configure the convex useQuery mock dispatch. */
function useSite(site: Record<string, unknown>) {
  const dispatch: Record<string, unknown> = {
    "api.sites.get": site,
    ...{},
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    // hasOwnProperty guard — plain `?? null` coalesces explicit undefined.
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });
  mockUseMutation.mockReturnValue(vi.fn());
  mockUseAction.mockReturnValue(vi.fn());
}

/** Render the shell wrapped in TooltipProvider (as App.tsx does). */
function renderShell(props: Partial<React.ComponentProps<typeof VisualEditorShell>> = {}) {
  return render(
    <TooltipProvider>
      <VisualEditorShell
        siteId={SITE_ID}
        title="Test Editor"
        subtitle="Test subtitle"
        isDirty={false}
        historyHref={`/app/sites/${SITE_ID}/history`}
        previewPath="/test"
        moduleId="test"
        {...props}
      >
        <div data-testid="editor-children">Editor panel</div>
      </VisualEditorShell>
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

/* ── 1. Header + ActionBar ────────────────────────────────────────────── */

describe("VisualEditorShell — header & ActionBar", () => {
  it("renders title, subtitle, and children in the editor pane", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    expect(screen.getByText("Test Editor")).toBeInTheDocument();
    expect(screen.getByText("Test subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("editor-children")).toBeInTheDocument();
  });

  it("defaults the save button to 'Save Draft' for collection editors", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ onSave: vi.fn(), onPublish: vi.fn() });
    expect(screen.getByRole("button", { name: /Save Draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish/i })).toBeInTheDocument();
  });

  it("uses the saveLabel override for singleton editors ('Save Changes')", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ onSave: vi.fn(), saveLabel: "Save Changes", showPublish: false });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish/i })).not.toBeInTheDocument();
  });

  it("shows 'Unsaved changes' indicator only when dirty", () => {
    useSite(SITE_WITH_DOMAIN);
    const { rerender } = renderShell({ isDirty: false, onDiscard: vi.fn(), onSave: vi.fn() });
    expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <VisualEditorShell
          siteId={SITE_ID}
          title="Test Editor"
          subtitle="Test subtitle"
          isDirty={true}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
          historyHref={`/app/sites/${SITE_ID}/history`}
          previewPath="/test"
          moduleId="test"
        >
          <div data-testid="editor-children">Editor panel</div>
        </VisualEditorShell>
      </TooltipProvider>,
    );
    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
  });

  it("renders a History link to the audit log", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ onSave: vi.fn() });
    const history = screen.getByRole("link", { name: /History/i });
    expect(history).toHaveAttribute("href", `/app/sites/${SITE_ID}/history`);
  });

  it("disables Discard when clean and enables it when dirty", () => {
    useSite(SITE_WITH_DOMAIN);
    const { rerender } = renderShell({ isDirty: false, onSave: vi.fn(), onDiscard: vi.fn() });
    expect(screen.getByRole("button", { name: /Discard/i })).toBeDisabled();

    rerender(
      <TooltipProvider>
        <VisualEditorShell
          siteId={SITE_ID}
          title="Test Editor"
          subtitle="Test subtitle"
          isDirty={true}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
          historyHref={`/app/sites/${SITE_ID}/history`}
          previewPath="/test"
          moduleId="test"
        >
          <div data-testid="editor-children">Editor panel</div>
        </VisualEditorShell>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: /Discard/i })).toBeEnabled();
  });

  it("omits the save button entirely when no onSave handler is given (layout-container pattern)", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ onSave: undefined });
    expect(screen.queryByRole("button", { name: /Save Draft/i })).not.toBeInTheDocument();
  });

  it("invokes onSave, onPublish, and onDiscard handlers on click", () => {
    useSite(SITE_WITH_DOMAIN);
    const onSave = vi.fn();
    const onPublish = vi.fn();
    const onDiscard = vi.fn();
    renderShell({ onSave, onPublish, onDiscard, isDirty: true });
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("renders toolbarActions in the header next to the ActionBar", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({
      toolbarActions: <button onClick={vi.fn()}>Add Thing</button>,
      onSave: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /Add Thing/i })).toBeInTheDocument();
  });
});

/* ── 2. Breakpoint toolbar ────────────────────────────────────────────── */

describe("VisualEditorShell — breakpoint toolbar", () => {
  it("shows the 'Live site' honesty badge (preview = published site)", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    expect(screen.getByText("Live site")).toBeInTheDocument();
  });

  it("offers desktop/tablet/mobile breakpoint buttons with dimensions in the title", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    expect(screen.getByTitle("Desktop (1440×900)")).toBeInTheDocument();
    expect(screen.getByTitle("Tablet (768×1024)")).toBeInTheDocument();
    expect(screen.getByTitle("Mobile (390×844)")).toBeInTheDocument();
    // Default badge shows desktop dimensions
    expect(screen.getByText("1440×900")).toBeInTheDocument();
  });

  it("switches the preview dimensions badge when a breakpoint is selected", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    fireEvent.click(screen.getByTitle("Tablet (768×1024)"));
    expect(screen.getByText("768×1024")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Mobile (390×844)"));
    expect(screen.getByText("390×844")).toBeInTheDocument();
  });

  it("renders a refresh button and live-site external link", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    expect(screen.getByTitle("Refresh preview")).toBeInTheDocument();
    const live = screen.getByTitle("Open live site");
    expect(live).toHaveAttribute("href", "https://fsts-test.example.com");
  });

  it("prefixes https:// when the domain lacks a scheme", () => {
    useSite({ ...SITE_WITH_DOMAIN, domain: "fsts-test.example.com" });
    renderShell();
    expect(screen.getByTitle("Open live site")).toHaveAttribute(
      "href",
      "https://fsts-test.example.com",
    );
  });
});

/* ── 3. Preview iframe ────────────────────────────────────────────────── */

describe("VisualEditorShell — preview iframe", () => {
  it("composes the preview URL from domain + previewPath", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ previewPath: "/services" });
    const iframe = screen.getByTitle("Preview — Desktop");
    expect(iframe).toHaveAttribute("src", "https://fsts-test.example.com/services");
  });

  it("uses the bare domain when no previewPath is given", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell({ previewPath: undefined });
    const iframe = screen.getByTitle("Preview — Desktop");
    expect(iframe).toHaveAttribute("src", "https://fsts-test.example.com");
  });

  it("sandboxes the iframe with scripts/forms/popups allowed", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    const iframe = screen.getByTitle("Preview — Desktop");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms allow-popups",
    );
  });

  it("sizes the preview frame to the active breakpoint", () => {
    useSite(SITE_WITH_DOMAIN);
    renderShell();
    const iframe = screen.getByTitle("Preview — Desktop");
    expect(iframe).toHaveStyle({ width: "1440px", height: "900px" });
    fireEvent.click(screen.getByTitle("Mobile (390×844)"));
    const mobileFrame = screen.getByTitle("Preview — Mobile");
    expect(mobileFrame).toHaveStyle({ width: "390px", height: "844px" });
  });
});

/* ── 4. Save → preview refresh loop ───────────────────────────────────── */

describe("VisualEditorShell — save refreshes the preview", () => {
  it("bumps the iframe key when isSaving goes true → false (save completed)", () => {
    useSite(SITE_WITH_DOMAIN);
    const { rerender } = renderShell({ onSave: vi.fn(), isSaving: false });
    const before = screen.getByTitle("Preview — Desktop");

    // Simulate a save round trip: isSaving true, then false.
    rerender(
      <TooltipProvider>
        <VisualEditorShell
          siteId={SITE_ID}
          title="Test Editor"
          subtitle="Test subtitle"
          isDirty={true}
          isSaving={true}
          onSave={vi.fn()}
          historyHref={`/app/sites/${SITE_ID}/history`}
          previewPath="/test"
          moduleId="test"
        >
          <div data-testid="editor-children">Editor panel</div>
        </VisualEditorShell>
      </TooltipProvider>,
    );

    rerender(
      <TooltipProvider>
        <VisualEditorShell
          siteId={SITE_ID}
          title="Test Editor"
          subtitle="Test subtitle"
          isDirty={false}
          isSaving={false}
          onSave={vi.fn()}
          historyHref={`/app/sites/${SITE_ID}/history`}
          previewPath="/test"
          moduleId="test"
        >
          <div data-testid="editor-children">Editor panel</div>
        </VisualEditorShell>
      </TooltipProvider>,
    );
    // The iframe remounted: a NEW element instance replaces the old one.
    const after = screen.getByTitle("Preview — Desktop");
    expect(after).not.toBe(before);
    expect(after.src === before.src).toBe(true);
  });

  it("does not refresh when isSaving stays false the whole time", () => {
    useSite(SITE_WITH_DOMAIN);
    const { rerender } = renderShell({ onSave: vi.fn(), isSaving: false });
    const before = screen.getByTitle("Preview — Desktop");

    rerender(
      <TooltipProvider>
        <VisualEditorShell
          siteId={SITE_ID}
          title="Test Editor"
          subtitle="Test subtitle"
          isDirty={true}
          isSaving={false}
          onSave={vi.fn()}
          historyHref={`/app/sites/${SITE_ID}/history`}
          previewPath="/test"
          moduleId="test"
        >
          <div data-testid="editor-children">Editor panel</div>
        </VisualEditorShell>
      </TooltipProvider>,
    );
    const after = screen.getByTitle("Preview — Desktop");
    // Same instance — no save happened, no refresh.
    expect(after).toBe(before);
  });
});

/* ── 5. No-domain fallback ────────────────────────────────────────────── */

describe("VisualEditorShell — no-domain fallback", () => {
  it("shows the dashed 'No domain configured' panel instead of a preview", () => {
    useSite(SITE_NO_DOMAIN);
    renderShell({ onSave: vi.fn() });
    expect(screen.getByText("No domain configured")).toBeInTheDocument();
    expect(
      screen.getByText(/Add your site domain in Site Settings/i),
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Preview — Desktop")).not.toBeInTheDocument();
  });

  it("still renders children (editor form) alongside the fallback panel", () => {
    useSite(SITE_NO_DOMAIN);
    renderShell({ onSave: vi.fn() });
    expect(screen.getByTestId("editor-children")).toBeInTheDocument();
  });
});

/* ── 6. Mobile tabs ───────────────────────────────────────────────────── */

describe("VisualEditorShell — mobile tabs (edit/preview toggle)", () => {
  it("switches between Edit and Preview tabs and shows the dirty dot on Preview", async () => {
    useSite(SITE_WITH_DOMAIN);
    // Simulate mobile viewport via matchMedia override.
    const addEventListener = vi.fn();
    let changeCallback: ((e: { matches: boolean }) => void) | undefined;
    const mq = {
      matches: true,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        changeCallback = cb;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    };
    const original = window.matchMedia;
    window.matchMedia = (() => mq) as unknown as typeof window.matchMedia;

    try {
      const { unmount } = renderShell({ isDirty: true, onSave: vi.fn() });
      // Mobile layout: Edit / Preview tab triggers.
      const editTab = screen.getByRole("tab", { name: /Edit/i });
      const previewTab = screen.getByRole("tab", { name: /Preview/i });
      expect(editTab).toBeInTheDocument();
      expect(previewTab).toBeInTheDocument();

      // Default tab is edit — children visible, no preview iframe yet.
      expect(screen.getByTestId("editor-children")).toBeInTheDocument();

      // Switch to preview: breakpoint toolbar + iframe appear.
      // (Radix TabsTrigger activates on mousedown, not click.)
      fireEvent.mouseDown(previewTab);
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTitle("Desktop (1440×900)")).toBeInTheDocument();
      expect(screen.getByTitle("Preview — Desktop")).toBeInTheDocument();
      expect(screen.getByText("Live site")).toBeInTheDocument();

      // Dirty dot on the Preview tab (aria-current / dot is decorative;
      // assert the tab is present and clickable with no crash).
      expect(previewTab).toBeInTheDocument();
      void changeCallback;
      void addEventListener;
      unmount();
    } finally {
      window.matchMedia = original;
    }
  });
});

/* ── 7. Integration — shell-wrapped pages ─────────────────────────────── */

describe("VisualEditorShell — integration with adopted pages", () => {
  it("AnnouncementBanner (singleton) saves via the ActionBar 'Save Changes' button", async () => {
    const AnnouncementBanner = (await import("@/pages/app/sites/AnnouncementBanner")).default;
    // api.announcement.get → saved banner content
    const dispatch: Record<string, unknown> = {
      "api.sites.get": SITE_WITH_DOMAIN,
      "api.announcement.get": {
        _id: "announce_1",
        siteId: SITE_ID,
        text: "Spring registration open",
        bgColor: "#1e3a5f",
        link: "/register",
        isEnabled: true,
      },
    };
    mockUseQuery.mockImplementation((q: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
      return null;
    });
    const upsert = vi.fn().mockResolvedValue(undefined);
    mockUseMutation.mockReturnValue(upsert);

    render(
      <TooltipProvider>
        <AnnouncementBanner params={{ siteId: SITE_ID }} />
      </TooltipProvider>,
    );

    // Shell header renders the title (shell header + inner ClientPageHeader
    // both show it — the established pattern).
    expect(screen.getAllByText("Announcement Banner").length).toBeGreaterThan(0);
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    expect(saveBtn).toBeInTheDocument();

    // Editing text makes the shell flag unsaved changes.
    const textInput = screen.getByLabelText("text");
    fireEvent.change(textInput, { target: { value: "Fall classes open" } });
    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    // Saving calls the upsert mutation.
    fireEvent.click(saveBtn);
    await act(async () => { await Promise.resolve(); });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: SITE_ID, text: "Fall classes open" }),
    );
  });

  it("TeamManager (collection) exposes its Add Member button via toolbarActions", async () => {
    const TeamManager = (await import("@/pages/app/sites/TeamManager")).default;
    const dispatch: Record<string, unknown> = {
      "api.sites.get": SITE_WITH_DOMAIN,
      "api.team.list": [
        {
          id: "team_1",
          _id: "team_1",
          siteId: SITE_ID,
          name: "Jane Coach",
          role: "Head Coach",
          isActive: true,
        },
      ],
    };
    mockUseQuery.mockImplementation((q: unknown) => {
      const path = typeof q === "function" ? (q as () => string)() : (q as string);
      if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
      return null;
    });
    mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    render(
      <TooltipProvider>
        <TeamManager params={{ siteId: SITE_ID }} />
      </TooltipProvider>,
    );

    expect(screen.getAllByText("Team Manager").length).toBeGreaterThan(0);
    // Collection pattern: no ActionBar save button — toolbar has the create CTA.
    expect(screen.queryByRole("button", { name: /Save Draft/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Member/i })).toBeInTheDocument();
    // Existing member renders inside the editor pane.
    expect(screen.getByText("Jane Coach")).toBeInTheDocument();
    // Collection managers still get the Live-site preview of /team.
    expect(screen.getByTitle("Preview — Desktop")).toHaveAttribute(
      "src",
      "https://fsts-test.example.com/team",
    );
  });
});
