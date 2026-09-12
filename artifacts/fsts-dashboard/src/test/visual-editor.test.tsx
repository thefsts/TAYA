/**
 * visual-editor.test.tsx
 *
 * PHASE 3 — the client-facing VisualEditor page (/app/sites/:siteId/editor).
 *
 * Covers (spec §9–§11, §25–§26):
 *   1. Client-safe rendering: the page NEVER shows semantic keys, Convex
 *      ids, raw JSON, HTML, tokens, or role names. Human labels only.
 *   2. Frame bootstrap protocol (must match convex/lib/editorFrame.ts):
 *      element-click → control for the element's type; parent → frame
 *      apply-draft carries ONLY value/type; frame src = Convex site origin
 *      /api/editor/frame?token&path with a freshly minted token.
 *   3. Editing dispatch per type: text → textarea; image → ImagePickerField;
 *      button/link (list_item) → Label + .href companion Destination.
 *   4. Workflow states: unsaved on edit, Save Draft calls saveDraft with
 *      the local edits, Publish blocked shows the SERVER reason verbatim.
 *   5. Page navigator renders client-language page labels; navigate
 *      messages from the frame load a new page.
 *   6. No content map (discovery incomplete) → honest empty state, no fake
 *      editing surface.
 *   7. Repeatable items: persisted remove/restore/reorder (ordered XOR
 *      hidden) routed through §6 setStructuralOps — server-validated,
 *      never faked client-side.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ─────────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/" }));
/** wouter navigate spy (FormsPanel routes to FormBuilder — §5). */
const mockNavigate = vi.hoisted(() => vi.fn());
/** Captured postMessage messages sent to the frame (parent → frame). */
const postMessageToFrame = vi.hoisted(() => vi.fn());

/* ── External / framework mocks ───────────────────────────────────────── */

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

// AppLayout — render children directly so the editor is visible in tests.
vi.mock("@/pages/app/SiteDashboard", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/components/AIAssistant", () => ({ AIAssistant: () => null }));

// ImagePickerField — replace with a test double that records props and
// exposes the onChange callback so tests can simulate an image upload.
const imagePickerOnChange = vi.hoisted(() => vi.fn());
vi.mock("@/components/ImagePickerField", () => ({
  ImagePickerField: ({ siteId, label, value }: { siteId: string; label: string; value: string }) => (
    <div data-testid="image-picker" data-site={siteId} data-label={label} data-value={value} />
  ),
}));

/* ── Import (after mocks) ─────────────────────────────────────────────── */

import VisualEditor from "@/pages/app/sites/VisualEditor";

/* ── Fixtures ─────────────────────────────────────────────────────────── */

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
    "home.hero.heading": { type: "text", discovered: "Live Studio Heading", published: "Live Studio Heading" },
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

/**
 * §6 zone summaries fixture — zonesForPageKeys resolution of CONTENT_MAP's
 * pages ("/" → home keys: hero + about + services + gallery; "/about" →
 * about keys: intro) plus the additive zones (video-section, cta-stack).
 */
const ZONE_SUMMARIES = {
  connected: true,
  pages: [
    {
      path: "/",
      label: "Home",
      zones: [
        { zone: "hero", label: "Hero area", kinds: ["text", "button", "video"] },
        { zone: "content", label: "Content section", kinds: ["text", "image", "button", "video", "pdf"] },
        { zone: "service-list", label: "Service list", kinds: ["text", "button", "pdf"] },
        { zone: "video-section", label: "Video section", kinds: ["video", "text"] },
        { zone: "cta-stack", label: "Call-to-action stack", kinds: ["cta", "text", "button", "video"] },
      ],
    },
    {
      path: "/about",
      label: "About",
      zones: [
        { zone: "hero", label: "Hero area", kinds: ["text", "button", "video"] },
        { zone: "content", label: "Content section", kinds: ["text", "image", "button", "video", "pdf"] },
        { zone: "video-section", label: "Video section", kinds: ["video", "text"] },
        { zone: "cta-stack", label: "Call-to-action stack", kinds: ["cta", "text", "button", "video"] },
      ],
    },
  ],
};

/** §6 block rows (listZoneBlocks shape) — one published text block in hero. */
const ZONE_BLOCKS = [
  {
    id: "blk1",
    pagePath: "/",
    zone: "hero",
    kind: "text",
    order: 0,
    content: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
    published: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
    pendingDelete: false,
    updatedAt: 1735000000000,
  },
];

/** §6 structuralsFor rows — none for "/" (untouched). */
const STRUCTURALS: Array<Record<string, unknown>> = [];

const DOWNLOADS = [
  { id: "dl1", title: "Service Catalog", url: "https://cdn.example/catalog.pdf", format: "PDF", isActive: true },
];

const FORMS = [
  { id: "form1", name: "Contact us", status: "published" },
];

const AUTHORITY_OK = { canPublish: true, connectionMode: "external", reason: null };
const AUTHORITY_BLOCKED = {
  canPublish: false,
  connectionMode: null,
  reason: "Your website needs to be connected before publishing.",
};

/** Configure the convex useQuery/useMutation mocks for a scenario. */
function setup({
  contentMap = CONTENT_MAP,
  authority = AUTHORITY_OK,
  revisions = REVISIONS,
  zoneSummaries = ZONE_SUMMARIES,
  zoneBlocks = ZONE_BLOCKS,
  structurals = STRUCTURALS,
  downloads = DOWNLOADS,
  forms = FORMS,
}: {
  contentMap?: Record<string, unknown> | null;
  authority?: Record<string, unknown> | null;
  revisions?: Record<string, unknown>[] | null;
  zoneSummaries?: Record<string, unknown> | null;
  zoneBlocks?: Array<Record<string, unknown>> | null;
  structurals?: Array<Record<string, unknown>> | null;
  downloads?: Array<Record<string, unknown>> | null;
  forms?: Array<Record<string, unknown>> | null;
} = {}) {
  const dispatch: Record<string, unknown> = {
    "api.contentMap.get": contentMap,
    "api.publishing.canPublish": authority,
    "api.editor.editorRevisions": revisions,
    "api.editorZones.zoneSummaries": zoneSummaries,
    "api.editorZones.listZoneBlocks": zoneBlocks,
    "api.editorZones.structuralsFor": structurals,
    "api.downloads.list": downloads,
    "api.forms.list": forms,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(dispatch, path)) return dispatch[path];
    return null;
  });

  const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
  mockUseMutation.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (!mutations[path]) mutations[path] = vi.fn(async () => ({}));
    return mutations[path];
  });
  // createFrameToken returns a fresh token for every call (burn-first) and
  // echoes the server-normalized path back — the parent builds the frame URL
  // from the server's r.path, not its request.
  mutations["api.editor.createFrameToken"] = vi.fn(async (args: Record<string, unknown>) => ({
    token: `tok-${Math.random().toString(36).slice(2)}`,
    path: (args?.path as string) ?? "/",
    expiresAt: Date.now() + 300_000,
  }));
  return { mutations, dispatch };
}

/** The iframe's contentWindow.postMessage (parent → frame channel). */
function framePostMessageSpy() {
  const w = window;
  const orig = HTMLIFrameElement.prototype.contentWindow;
  return orig; // unused — spy installed via instance below
}

/** Render the editor and return helpers for driving the frame protocol. */
async function renderEditor() {
  const utils = render(<VisualEditor />);
  // Wait for the frame URL to be minted + set (default page "/").
  await waitFor(() => {
    const iframe = document.querySelector("iframe[title='Website preview']");
    expect(iframe).not.toBeNull();
  });
  const iframe = document.querySelector("iframe[title='Website preview']") as HTMLIFrameElement;
  return { ...utils, iframe };
}

/** Simulate the frame bootstrap posting a message to the parent. */
function frameSends(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

/** All messages the parent posted to the frame. */
function parentToFrameMessages() {
  return postMessageToFrame.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

beforeEach(() => {
  window.localStorage.clear();
  mockLocation.value = "/app/sites/site_test123/editor";
  // The frame URL derives from VITE_CONVEX_URL at call time (convex.cloud →
  // convex.site) — stub the build-time env so the src asserts the real shape.
  vi.stubEnv("VITE_CONVEX_URL", "https://uncommon-cobra-336.convex.cloud");
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn(async () => ({})));
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
  mockNavigate.mockReset();
  postMessageToFrame.mockReset();

  // iframe.contentWindow.postMessage — capture the parent→frame channel.
  // jsdom provides contentWindow; patch its postMessage to a spy.
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    get() {
      return { postMessage: postMessageToFrame };
    },
  });
});

/* ── 1. Client-safe rendering ─────────────────────────────────────────── */

describe("VisualEditor — client-safe rendering (§26)", () => {
  it("renders the editor with a human subtitle and the site domain", async () => {
    setup();
    await renderEditor();
    expect(screen.getByText("Visual Editor")).toBeInTheDocument();
    expect(
      screen.getByText(/Click any element on your website to edit it — www\.fstacktsolutions\.com/),
    ).toBeInTheDocument();
  });

  it("NEVER shows semantic keys, ids, or JSON on initial render", async () => {
    setup();
    await renderEditor();
    // Rendered TEXT must be client-safe. (The frame URL legitimately carries
    // the opaque frame token in the iframe src attribute — that's the
    // credential contract, invisible to the client, never rendered as text.)
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("home.hero.heading");
    expect(text).not.toContain("siteContentMaps");
    expect(text).not.toContain("data-taya-edit");
    expect(text).not.toContain("CONTENT_UPDATE");
    expect(document.body.innerHTML).not.toContain("id\":\"");
  });

  it("shows the honest 'not connected' empty state when there is no content map", async () => {
    setup({ contentMap: null });
    render(<VisualEditor />);
    expect(
      await screen.findByText("Your website hasn't been connected yet"),
    ).toBeInTheDocument();
    // No editing surface is faked.
    expect(document.querySelector("iframe[title='Website preview']")).toBeNull();
  });

  it("renders page navigator pills with client-language labels", async () => {
    setup();
    await renderEditor();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
    expect(screen.getByText("2 pages available")).toBeInTheDocument();
  });
});

/* ── 2. Frame protocol ────────────────────────────────────────────────── */

describe("VisualEditor — frame bootstrap protocol", () => {
  it("loads the frame from the Convex site origin with a minted token", async () => {
    setup();
    const { iframe } = await renderEditor();
    const src = iframe.getAttribute("src") ?? "";
    // Convex site origin (convex.cloud → convex.site, Phase 2 contract),
    // fresh opaque token, requested path, exact sandbox policy.
    expect(src).toMatch(/^https:\/\/.*\.convex\.site\/api\/editor\/frame\?token=/);
    expect(src).toContain("path=%2F");
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin allow-scripts");
    expect(iframe.getAttribute("referrerPolicy")).toBe("no-referrer");
  });

  it("re-mints the token on reload (fresh single-use credential per load)", async () => {
    const { mutations } = setup();
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));
    await waitFor(() => {
      expect(mutations["api.editor.createFrameToken"].mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("element-click from the frame selects the element and shows a text control", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      contentKind: "heading",
      label: "h1: Live Studio Heading",
      alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    expect(await screen.findByText(/Homepage · hero · heading/)).toBeInTheDocument();
    expect(screen.getByText("Heading")).toBeInTheDocument();
    const ta = screen.getByRole("textbox");
    expect(ta).toBeInTheDocument();
  });

  it("element-click for an image shows the image picker (no raw file input)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.image",
      type: "image",
      label: "img: hero",
      alt: "Team at work", text: null, href: null, itemId: null,
    });
    expect(await screen.findByTestId("image-picker")).toBeInTheDocument();
    expect(screen.queryByText("Replace image")).not.toBeInTheDocument();
  });

  it("element-click for a hero button shows Label + Destination (the .href sibling)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      // Hero CTA grammar: "<…>.primaryButton.label" (stamped type text) with
      // sibling "<…>.primaryButton.href" (type url) in the map.
      key: "home.hero.primaryButton.label",
      type: "text",
      label: "a: Book Now",
      alt: null, text: "Book Now",
      href: "https://www.fstacktsolutions.com/contact",
      itemId: null,
    });
    expect(await screen.findByText("Label")).toBeInTheDocument();
    expect(screen.getByText("Destination")).toBeInTheDocument();
    // Two inputs: label + destination.
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBe(2);
    expect((inputs[0] as HTMLInputElement).value).toBe("Book Now");
    expect((inputs[1] as HTMLInputElement).value).toBe(
      "https://www.fstacktsolutions.com/contact",
    );
  });

  it("section button without a .href sibling shows the destination read-only, never faked editable", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      // Section buttons are stamped list_item ("<role>.buttons[n]") and the
      // fold carries NO sibling url key for them — the destination is shown
      // read-only (honest: there is no persistable key for it yet).
      key: "about.intro.buttons[0]",
      type: "list_item",
      label: "a: About FSTS",
      alt: null, text: "About FSTS",
      href: "https://www.fstacktsolutions.com/about",
      itemId: null,
    });
    expect(await screen.findByText("Label")).toBeInTheDocument();
    expect(screen.getByText(/This link's destination can't be edited yet/)).toBeInTheDocument();
    // Only the label input.
    expect(screen.getAllByRole("textbox").length).toBe(1);
  });

  it("editing posts apply-draft to the frame with only value+type (never ids/tokens)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    const ta = await screen.findByRole("textbox");
    fireEvent.change(ta, { target: { value: "New Heading Draft" } });
    const msgs = parentToFrameMessages().filter((m) => m.kind === "apply-draft");
    expect(msgs.length).toBeGreaterThan(0);
    const entries = (msgs[msgs.length - 1] as any).entries as Record<string, unknown>;
    expect(entries["home.hero.heading"]).toEqual({
      value: "New Heading Draft",
      type: "text",
    });
    expect(JSON.stringify(entries)).not.toContain("token");
    expect(JSON.stringify(entries)).not.toContain("siteId");
  });

  it("editing a hero button's label AND destination rides ONE entry (href on the base key)", async () => {
    const { mutations } = setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.primaryButton.label",
      type: "text",
      label: "a: Book Now",
      alt: null, text: "Book Now",
      href: "https://www.fstacktsolutions.com/contact",
      itemId: null,
    });
    const inputs = await screen.findAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Free Consultation" } });
    fireEvent.change(inputs[1], { target: { value: "https://www.fstacktsolutions.com/booking" } });
    const msgs = parentToFrameMessages().filter((m) => m.kind === "apply-draft");
    const last = (msgs[msgs.length - 1] as any).entries as Record<string, any>;
    // Bootstrap applyOverlay contract: the sibling .href key is NOT annotated
    // on its own element — its destination edit rides the base label entry.
    expect(last["home.hero.primaryButton.label"]).toEqual({
      value: "Free Consultation",
      type: "text",
      href: "https://www.fstacktsolutions.com/booking",
    });
    expect(last["home.hero.primaryButton.href"]).toBeUndefined();
    // Save Draft persists BOTH keys (saveDraft's value overlay covers each).
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/ }));
    await waitFor(() => {
      expect(mutations["api.publishing.saveDraft"]).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: SITE_ID,
          entries: expect.arrayContaining([
            { key: "home.hero.primaryButton.label", value: "Free Consultation" },
            { key: "home.hero.primaryButton.href", value: "https://www.fstacktsolutions.com/booking" },
          ]),
        }),
      );
    });
  });

  it("ready from the frame re-applies local edits to a freshly loaded page", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Draft value" } });
    const before = parentToFrameMessages().filter((m) => m.kind === "apply-draft").length;
    frameSends({ source: "taya-editor", kind: "ready", path: "/", slug: "test" });
    const after = parentToFrameMessages().filter((m) => m.kind === "apply-draft").length;
    expect(after).toBe(before + 1);
  });

  it("navigate from the frame loads a matching discovered page", async () => {
    const { mutations } = setup();
    await renderEditor();
    frameSends({ source: "taya-editor", kind: "navigate", path: "/about" });
    await waitFor(() => {
      const iframe = document.querySelector("iframe[title='Website preview']") as HTMLIFrameElement;
      expect(iframe.getAttribute("src")).toContain("path=%2Fabout");
    });
    expect(mutations["api.editor.createFrameToken"].mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores messages from other sources and kinds (protocol hygiene)", async () => {
    setup();
    await renderEditor();
    frameSends({ source: "something-else", kind: "element-click", key: "home.hero.heading" });
    expect(screen.queryByText(/Homepage · hero · heading/)).not.toBeInTheDocument();
    frameSends({ source: "taya-editor", kind: "unknown-kind" });
    expect(screen.queryByText(/Homepage · hero · heading/)).not.toBeInTheDocument();
  });

  it("locked-click shows the FSTS-managed notice (never silent)", async () => {
    setup();
    await renderEditor();
    frameSends({ source: "taya-editor", kind: "locked-click", label: "Site header", external: false });
    expect(
      await screen.findByText(/managed by FSTS/i),
    ).toBeInTheDocument();
    // The notice is announced (role=status) — screen readers hear it.
    expect(document.querySelector('[role="status"]')).not.toBeNull();
  });

  it("locked-click for an off-site link explains why it is not followed", async () => {
    setup();
    await renderEditor();
    frameSends({ source: "taya-editor", kind: "locked-click", label: "External", external: true });
    expect(
      await screen.findByText(/not followed inside the editor/i),
    ).toBeInTheDocument();
  });

  it("block-click opens the added content's edit form (no ids in copy)", async () => {
    setup();
    await renderEditor();
    // The content list shows the existing block (fixture: one text block in hero).
    expect(await screen.findByText("Trusted since 2010")).toBeInTheDocument();
    frameSends({ source: "taya-editor", kind: "block-click", blockId: "blk1", zone: "hero", label: "Trusted since 2010" });
    // The edit form for that block opens (client-language save button).
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    // No block id / zone id leaks into the client copy.
    expect(document.body.innerHTML).not.toContain("blk1");
    expect(document.body.innerHTML).not.toContain(">hero<");
  });

  it("block-click for an unknown id degrades to an honest message, never a crash", async () => {
    setup();
    await renderEditor();
    frameSends({ source: "taya-editor", kind: "block-click", blockId: "ghost", zone: "hero", label: "x" });
    expect(await screen.findByText(/still saving/i)).toBeInTheDocument();
  });

  it("selection-cleared (Escape in the frame) clears the selection card", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      contentKind: "heading",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    expect(await screen.findByText(/Homepage · hero · heading/)).toBeInTheDocument();
    frameSends({ source: "taya-editor", kind: "selection-cleared" });
    await waitFor(() => {
      expect(screen.queryByText(/Homepage · hero · heading/)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Click something to edit it/)).toBeInTheDocument();
  });

  it("contentKind drives the card header (Image identified as Image)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.about.image",
      type: "image",
      contentKind: "image",
      label: "img", alt: "Studio photo", text: null, href: null, itemId: null,
    });
    expect(await screen.findByText("Image")).toBeInTheDocument();
    expect(screen.queryByText("Heading")).not.toBeInTheDocument();
  });

  it("per-card Save this change persists ONLY this element (obvious Save in context)", async () => {
    const { mutations } = setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      contentKind: "heading",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Fresh Title" } });
    const saveBtn = await screen.findByRole("button", { name: "Save this change" });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mutations["api.publishing.saveDraft"]).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [{ key: "home.hero.heading", value: "Fresh Title" }],
        }),
      );
    });
  });

  it("per-card Revert drops this element's unsaved edit (Cancel in context)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      contentKind: "heading",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Revert Me" } });
    expect(await screen.findByText(/Unsaved edits/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Revert" }));
    // Unsaved state clears without touching the server.
    await waitFor(() => {
      expect(screen.queryByText(/Unsaved edits/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Revert" })).toBeDisabled();
  });
});

/* ── 3. Workflow: save draft / publish / history ──────────────────────── */

describe("VisualEditor — workflow states", () => {
  it("shows Unsaved edits after a local edit, then Save Draft persists via saveDraft", async () => {
    const { mutations } = setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Drafted!" } });
    expect(await screen.findByText(/Unsaved edits/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Draft/ }));
    await waitFor(() => {
      expect(mutations["api.publishing.saveDraft"]).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: SITE_ID,
          entries: [{ key: "home.hero.heading", value: "Drafted!" }],
        }),
      );
    });
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
  });

  it("Save Draft is disabled until there is a local edit", async () => {
    setup();
    await renderEditor();
    expect(screen.getByRole("button", { name: /Save Draft/ })).toBeDisabled();
  });

  it("publishes local edits (saveDraft then publishContentMap)", async () => {
    const { mutations } = setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Go live" } });
    fireEvent.click(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ }));
    await waitFor(() => {
      expect(mutations["api.publishing.saveDraft"]).toHaveBeenCalled();
      expect(mutations["api.publishing.publishContentMap"]).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_ID }),
      );
    });
    expect(await screen.findByText(/Published to the live website/)).toBeInTheDocument();
  });

  it("blocked publish shows the SERVER reason verbatim — never faked success", async () => {
    setup({ authority: AUTHORITY_BLOCKED });
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.heading",
      type: "text",
      label: "h1", alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "x" } });
    expect(screen.getByText(/Your website needs to be connected before publishing\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish \(blocked\)/ })).toBeInTheDocument();
  });

  const RESTORED_ENTRIES = [
    { key: "home.hero.heading", value: "Live Studio Heading" },
    { key: "home.about.body", value: "About this studio." },
  ];

  async function restoreRevision(mutations: Record<string, ReturnType<typeof vi.fn>>, restored: unknown) {
    mutations["api.editor.restoreAsDraft"].mockResolvedValue({
      ok: true,
      restoredKeys: Array.isArray(restored) ? restored.length : 0,
      restored,
    });
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Restore/ }));
  }


  it("restore from history calls restoreAsDraft and reloads the frame", async () => {
    const { mutations } = setup();
    await renderEditor();
    await restoreRevision(mutations, RESTORED_ENTRIES);
    await waitFor(() => {
      expect(mutations["api.editor.restoreAsDraft"]).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_ID, revisionId: "rev1" }),
      );
    });
    expect(await screen.findByText(/restored as a draft/)).toBeInTheDocument();
    // The restore reloads the frame (fresh single-use token per load).
    await waitFor(() => {
      expect(mutations["api.editor.createFrameToken"].mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });


  /* ── Bug #1 regression: History → Restore must leave Publish usable ── */

  it("Bug #1: restore-as-draft populates publishable pending state — Publish and Discard become available", async () => {
    const { mutations } = setup();
    await renderEditor();
    // Baseline: no draft changes anywhere → Publish disabled (regression guard).
    expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeDisabled();

    await restoreRevision(mutations, RESTORED_ENTRIES);

    // The pending set is seeded → Publish is ENABLED through the existing gate.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });
    // Draft state is honestly surfaced (badge + Discard with exact count).
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Discard 2 draft changes/ })).toBeInTheDocument();
  });

  it("Bug #1: restored keys are the exact restored revision keys — publish routes the exact entries through the server", async () => {
    const { mutations } = setup();
    await renderEditor();
    await restoreRevision(mutations, RESTORED_ENTRIES);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ }));
    // The restored entries are saved as drafts first (exact keys+values)…
    await waitFor(() => {
      expect(mutations["api.publishing.saveDraft"]).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: SITE_ID,
          entries: RESTORED_ENTRIES,
        }),
      );
    });
    // …then publishContentMap is called through the REAL server authority
    // gate — no keys subset, the server publishes every drafted entry.
    await waitFor(() => {
      expect(mutations["api.publishing.publishContentMap"]).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_ID }),
      );
    });
    expect(await screen.findByText(/Published to the live website/)).toBeInTheDocument();
  });

  it("Bug #1: Preview shows the restored draft BEFORE publish — apply-draft carries the restored values, nothing published", async () => {
    const { mutations } = setup();
    await renderEditor();
    await restoreRevision(mutations, RESTORED_ENTRIES);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });

    // The frame reloads after restore; its "ready" handshake re-applies the
    // seeded local edits over the apply-draft channel (§16: drafts never
    // enter an HTTP response — only this postMessage channel).
    frameSends({ source: "taya-editor", kind: "ready", path: "/", slug: "test" });
    const applyDraft = parentToFrameMessages().filter((m) => m.kind === "apply-draft");
    expect(applyDraft.length).toBeGreaterThan(0);
    const entries = (applyDraft[applyDraft.length - 1] as { entries: Record<string, { value: string; type: string }> }).entries;
    expect(entries["home.hero.heading"]).toEqual({ value: "Live Studio Heading", type: "text" });
    expect(entries["home.about.body"]).toEqual({ value: "About this studio.", type: "text" });

    // Preview button also pushes the restored draft. Two "Preview" buttons
    // exist (mobile tab + action bar); only the ACTION-BAR one applies the
    // draft overlay — the mobile tab just switches the visible pane.
    const before = parentToFrameMessages().filter((m) => m.kind === "apply-draft").length;
    const previewButtons = screen.getAllByRole("button", { name: "Preview" });
    fireEvent.click(previewButtons[previewButtons.length - 1]);
    expect(parentToFrameMessages().filter((m) => m.kind === "apply-draft").length).toBe(before + 1);

    // Nothing has been published yet — Preview is purely the draft channel.
    expect(mutations["api.publishing.publishContentMap"]).not.toHaveBeenCalled();
  });

  it("Bug #1: Publish remains DISABLED when there truly are no draft changes (empty restore, honest notice)", async () => {
    const { mutations } = setup();
    await renderEditor();
    // Restore returns nothing restorable → no fake pending state, and the
    // UI says so honestly instead of claiming a draft was created.
    await restoreRevision(mutations, []);
    await waitFor(() => {
      expect(screen.getByText(/Nothing to restore from that version/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save Draft/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Discard/ })).not.toBeInTheDocument();
    expect(mutations["api.publishing.publishContentMap"]).not.toHaveBeenCalled();
  });

  it("history shows client-safe summaries (no raw snapshot JSON)", async () => {
    setup();
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(await screen.findByText(/Published 3 values to the live website/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("revisionId");
  });
});

/* ── 4. Honest editing ────────────────────────────────────────────────── */

describe("VisualEditor — honest editing (no faked capabilities)", () => {
  it("lists repeatable items with PERSISTED remove/reorder buttons (§6 structural ops)", async () => {
    const { mutations } = setup();
    await renderEditor();
    expect(screen.getByText("Sections with repeatable items")).toBeInTheDocument();
    expect(screen.getByText(/Homepage · services · items 0/)).toBeInTheDocument();
    expect(screen.getByText(/Homepage · services · items 1/)).toBeInTheDocument();
    // Structural ops ARE persisted server-side now (§6 setStructuralOps) —
    // the UI offers them honestly and routes every op through the server.
    expect(screen.getAllByRole("button", { name: "Move up" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Move down" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Remove" }).length).toBe(2);
    // Removing item 0: ordered XOR hidden — it leaves itemOrder and lands
    // in hiddenItems, saved as a draft via the server mutation.
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await waitFor(() => {
      expect(mutations["api.editorZones.setStructuralOps"]).toHaveBeenCalledWith({
        siteId: SITE_ID,
        pagePath: "/",
        itemOrder: ["home.services.items[1]"],
        hiddenItems: ["home.services.items[0]"],
      });
    });
  });
});

/* ── 5b. §1–§6 rich content: safe zones, video, PDF, forms ─────────── */

describe("VisualEditor — rich content (§1–§6)", () => {
  /** Add flow helper (what-first): open panel → pick WHAT → pick WHERE → form appears. */
  async function addFlow(kindLabel: string, areaLabel: string) {
    fireEvent.click(screen.getByRole("button", { name: /Add content to this page/ }));
    fireEvent.click(await screen.findByRole("button", { name: kindLabel }));
    await screen.findByText(/Where should it go/);
    fireEvent.click(await screen.findByRole("button", { name: areaLabel }));
    await screen.findByText(/It will show up/);
  }

  it("§2 unsafe destinations are REJECTED inline — javascript: never accepted", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.primaryButton.label",
      type: "text",
      label: "a", alt: null, text: "Book Now", href: "https://www.fstacktsolutions.com/contact", itemId: null,
    });
    const dest = await screen.findByPlaceholderText("https://… / /about / #pricing / tel: / mailto:");
    fireEvent.change(dest, { target: { value: "javascript:alert(document.cookie)" } });
    expect(await screen.findByText("That link type isn't allowed for safety.")).toBeInTheDocument();
    expect(screen.queryByText(/video detected/i)).not.toBeInTheDocument();
  });

  it("§2 valid destinations classify inline (badge shows the kind)", async () => {
    setup();
    await renderEditor();
    frameSends({
      source: "taya-editor",
      kind: "element-click",
      key: "home.hero.primaryButton.label",
      type: "text",
      label: "a", alt: null, text: "Book Now", href: "https://www.fstacktsolutions.com/contact", itemId: null,
    });
    const dest = await screen.findByPlaceholderText("https://… / /about / #pricing / tel: / mailto:");
    fireEvent.change(dest, { target: { value: "/about" } });
    expect(await screen.findByText("Page on this site")).toBeInTheDocument();
    fireEvent.change(dest, { target: { value: "tel:+15551234567" } });
    expect(await screen.findByText("Phone number")).toBeInTheDocument();
    fireEvent.change(dest, { target: { value: "mailto:studio@example.com" } });
    expect(await screen.findByText("Email link")).toBeInTheDocument();
    fireEvent.change(dest, { target: { value: "https://example.com/pricing" } });
    expect(await screen.findByText("Website link")).toBeInTheDocument();
    fireEvent.change(dest, { target: { value: "#gallery" } });
    expect(await screen.findByText("Section on this page")).toBeInTheDocument();
  });

  it("§3 video: YouTube link parses → provider preview → addBlock with canonical video content", async () => {
    const { mutations } = setup();
    await renderEditor();
    await addFlow("+ Add video", "Video area");
    const input = screen.getByPlaceholderText("https://www.youtube.com/watch?v=…");
    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } });
    expect(await screen.findByText(/youtube video detected/i)).toBeInTheDocument();
    expect(screen.getByText("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    await waitFor(() => {
      expect(mutations["api.editorZones.addBlock"]).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: SITE_ID,
          pagePath: "/",
          zone: "video-section",
          content: {
            kind: "video",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            provider: "youtube",
            videoId: "dQw4w9WgXcQ",
            embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            caption: "",
          },
        }),
      );
    });
  });

  it("§3 video: Vimeo unlisted link (vimeo.com/ID/HASH) preserves the privacy hash", async () => {
    const { mutations } = setup();
    await renderEditor();
    await addFlow("+ Add video", "Video area");
    const input = screen.getByPlaceholderText("https://www.youtube.com/watch?v=…");
    fireEvent.change(input, { target: { value: "https://vimeo.com/76979871/2ff2a25d4c" } });
    expect(await screen.findByText(/vimeo video detected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    await waitFor(() => {
      expect(mutations["api.editorZones.addBlock"]).toHaveBeenCalledWith(
        expect.objectContaining({
          zone: "video-section",
          content: expect.objectContaining({
            kind: "video",
            provider: "vimeo",
            videoId: "76979871",
            embedUrl: "https://player.vimeo.com/video/76979871?h=2ff2a25d4c",
          }),
        }),
      );
    });
  });

  it("§3 NO arbitrary embed HTML — iframe/script paste is rejected with the canonical reason", async () => {
    setup();
    await renderEditor();
    await addFlow("+ Add video", "Video area");
    const input = screen.getByPlaceholderText("https://www.youtube.com/watch?v=…");
    fireEvent.change(input, { target: { value: '<iframe src="https://evil.example"></iframe>' } });
    expect(
      await screen.findByText("Paste the video's share link — embed code isn't allowed."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/video detected/i)).not.toBeInTheDocument();
  });

  it("§4 PDF: managed-resource picker → addBlock with resourceId (never a raw URL field)", async () => {
    const { mutations } = setup();
    await renderEditor();
    await addFlow("+ Add resource", "Main content area");
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "dl1" } });
    // The pdf form's textboxes are [title, description, buttonLabel] in order.
    const titleInput = screen.getAllByRole("textbox")[0];
    fireEvent.change(titleInput, { target: { value: "Our Service Catalog" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to page" }));
    await waitFor(() => {
      expect(mutations["api.editorZones.addBlock"]).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: SITE_ID,
          pagePath: "/",
          zone: "content",
          content: {
            kind: "pdf",
            resourceId: "dl1",
            title: "Our Service Catalog",
            description: "",
            buttonLabel: "",
          },
        }),
      );
    });
  });

  it("§5 forms panel routes to the EXISTING FormBuilder — no inline form editing", async () => {
    setup();
    await renderEditor();
    const formRow = await screen.findByText("Contact us");
    fireEvent.click(formRow);
    expect(mockNavigate).toHaveBeenCalledWith("/app/sites/site_test123/forms/form1");
    expect(document.body.innerHTML).not.toContain("formSchema");
  });

  it("§6 AddBlockPanel (what-first) offers only areas the server's zoneSummaries list for the picked kind", async () => {
    setup();
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Add content to this page/ }));
    // Pick WHAT: video.
    fireEvent.click(await screen.findByRole("button", { name: "+ Add video" }));
    // WHERE step lists only areas where video is allowed on this page.
    expect(await screen.findByRole("button", { name: "Top of the page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Main content area" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video area" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call-to-action area" })).toBeInTheDocument();
    // Areas NOT on this page's map (footer/FAQ) are never offered.
    expect(screen.queryByRole("button", { name: "Footer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "FAQ list" })).not.toBeInTheDocument();
  });

  it("§6 kinds are filtered by ZONE_ALLOWED_KINDS — unavailable kinds show an honest explanation (flow 9)", async () => {
    setup();
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Add content to this page/ }));
    // On this fixture, PDF is allowed in content/service-list, so it stays enabled;
    // FAQ is allowed nowhere on this page — disabled + honest explanation (never hidden).
    expect(await screen.findByRole("button", { name: "+ Add resource" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add FAQ" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "+ Add image" })).toBeInTheDocument();
    expect(
      await screen.findByText(/FAQ items can.t be added to this page/),
    ).toBeInTheDocument();
  });

  it("§6 existing block rows render with persisted edit/remove/reorder controls", async () => {
    const { mutations } = setup();
    await renderEditor();
    expect(await screen.findByText("Trusted since 2010")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Trusted since 2010" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Trusted since 2010" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Trusted since 2010 up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Trusted since 2010 down" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Trusted since 2010" }));
    await waitFor(() => {
      expect(mutations["api.editorZones.removeBlock"]).toHaveBeenCalledWith({
        siteId: SITE_ID,
        blockId: "blk1",
      });
    });
  });

  it("§6 zone drafts gate Publish/Discard exactly like map drafts", async () => {
    // Baseline: content === published → Publish disabled (honest state).
    setup();
    const first = await renderEditor();
    expect(await screen.findByText("Trusted since 2010")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish/ })).toBeDisabled();
    first.unmount();
    // A zone draft (content ≠ published) flips both gates.
    const { mutations } = setup({
      zoneBlocks: [
        {
          id: "blk1",
          pagePath: "/",
          zone: "hero",
          kind: "text",
          order: 0,
          content: { kind: "text", text: "Trusted since 2020", style: "paragraph" },
          published: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
          pendingDelete: false,
          updatedAt: 1735000000000,
        },
      ],
    });
    await renderEditor();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Publish/ })).toBeEnabled();
    });
    expect(await screen.findByText(/Discard 1 draft change/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Discard 1 draft change/ }));
    await waitFor(() => {
      expect(mutations["api.editorZones.discardBlocks"]).toHaveBeenCalledWith({
        siteId: SITE_ID,
      });
    });
  });

  it("§6 zone-refresh preview ops reach the frame when zone blocks change", async () => {
    setup();
    await renderEditor();
    // Production contract: previews ride the frame's "ready" handshake
    // (the mount-time effect pass no-ops — the iframe doesn't exist yet).
    frameSends({ source: "taya-editor", kind: "ready", path: "/", slug: "test" });
    const msgs = parentToFrameMessages();
    const zoneRefresh = msgs.find(
      (m) => m.kind === "op" && (m as { op?: string }).op === "zone-refresh",
    );
    expect(zoneRefresh).toBeDefined();
    if (zoneRefresh) {
      const zones = (zoneRefresh as { zones?: Array<{ zone: string; html: string }> }).zones ?? [];
      expect(zones.some((z) => z.zone === "hero" && z.html.includes("Trusted since 2010"))).toBe(true);
      expect(zones.some((z) => z.zone === "video-section" && z.html === "")).toBe(true);
    }
  });

  it("§6 zone drafts go live through publishBlocks on the same Publish press", async () => {
    const { mutations } = setup({
      zoneBlocks: [
        {
          id: "blk1",
          pagePath: "/",
          zone: "hero",
          kind: "text",
          order: 0,
          content: { kind: "text", text: "Trusted since 2020", style: "paragraph" },
          published: { kind: "text", text: "Trusted since 2010", style: "paragraph" },
          pendingDelete: false,
          updatedAt: 1735000000000,
        },
      ],
    });
    await renderEditor();
    expect(await screen.findByText(/Discard 1 draft change/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Publish/ }));
    await waitFor(() => {
      expect(mutations["api.editorZones.publishBlocks"]).toHaveBeenCalledWith({ siteId: SITE_ID });
      expect(mutations["api.publishing.publishContentMap"]).not.toHaveBeenCalled();
    });
  });
});

/* ── 5. Responsive classes ────────────────────────────────────────────── */

describe("VisualEditor — responsive structure", () => {
  it("has the desktop split (controls + preview) and mobile tabs markup", async () => {
    setup();
    await renderEditor();
    // Edit/Preview tabs exist (mobile), hidden on lg screens via classes.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    // Both the mobile Preview tab and the action-bar Preview button exist.
    expect(screen.getAllByRole("button", { name: "Preview" }).length).toBe(2);
    // Device toggles for the preview.
    expect(screen.getByRole("button", { name: "desktop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tablet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mobile" })).toBeInTheDocument();
  });
});

/* ── 6. Bug #2 regression: reopen with server-side drafts ──────── */

describe("VisualEditor — reopen with server-side drafts (Bug #2)", () => {
  // A draft saved in a PRIOR session lives server-side on the entry
  // ({draft}). Bug #2: reopening the editor showed "All changes saved",
  // kept Publish/Discard gated, and Previewed published values — the draft
  // was invisible and unpublishable until re-edited. The adoption effect +
  // preview union make the reopened editor honest about pending drafts.
  const CONTENT_MAP_WITH_DRAFTS = {
    ...CONTENT_MAP,
    entries: {
      ...CONTENT_MAP.entries,
      "home.about.body": { type: "text", discovered: "About this studio.", published: "About this studio.", draft: "Prior Session Draft Body" },
      "about.intro.heading": { type: "text", discovered: "About FSTS", published: "About FSTS", draft: "Prior Session Draft Heading" },
    },
  };

  // Local mirror of the history-block helper (block-scoped there).
  async function restoreRevisionLocal(
    mutations: Record<string, ReturnType<typeof vi.fn>>,
    restored: unknown,
  ) {
    mutations["api.editor.restoreAsDraft"].mockResolvedValue({
      ok: true,
      restoredKeys: Array.isArray(restored) ? restored.length : 0,
      restored,
    });
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Restore/ }));
  }

  it("Bug #2: adopts server-side drafts on open — Draft badge, Discard count, Publish enabled", async () => {
    setup({ contentMap: CONTENT_MAP_WITH_DRAFTS });
    await renderEditor();
    // The badge honestly reports the pending draft state...
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
    // ...Publish is publishable through the EXISTING gate...
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });
    // ...and Discard can clear exactly the adopted server drafts.
    expect(await screen.findByRole("button", { name: /Discard 2 draft changes/ })).toBeInTheDocument();
  });

  it("Bug #2: publishing a prior-session draft routes through the real server gate (no fake local save)", async () => {
    const { mutations } = setup({ contentMap: CONTENT_MAP_WITH_DRAFTS });
    await renderEditor();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ }));
    // The drafts already live server-side — no redundant saveDraft...
    expect(mutations["api.publishing.saveDraft"]).not.toHaveBeenCalled();
    // ...publish goes through the REAL authority gate.
    await waitFor(() => {
      expect(mutations["api.publishing.publishContentMap"]).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: SITE_ID }),
      );
    });
    expect(await screen.findByText(/Published to the live website/)).toBeInTheDocument();
  });

  it("Bug #2: frame ready applies server-side drafts to the preview (drafts reach the frame only via postMessage)", async () => {
    setup({ contentMap: CONTENT_MAP_WITH_DRAFTS });
    await renderEditor();
    frameSends({ source: "taya-editor", kind: "ready", path: "/", slug: "test" });
    const applyDraft = parentToFrameMessages().filter((m) => m.kind === "apply-draft");
    expect(applyDraft.length).toBeGreaterThan(0);
    const entries = (applyDraft[applyDraft.length - 1] as { entries: Record<string, { value: string; type: string }> }).entries;
    // Server-side drafts ride the apply-draft channel (§16)...
    expect(entries["home.about.body"]).toEqual({ value: "Prior Session Draft Body", type: "text" });
    expect(entries["about.intro.heading"]).toEqual({ value: "Prior Session Draft Heading", type: "text" });
    // ...and keys with no draft or local edit still carry their LIVE value
    // through the full overlay - the frame route strips every site script
    // (including the bridge that applies published values), so the parent's
    // apply-draft is the only channel that keeps a reopened editor showing
    // the PUBLISHED site instead of pre-TAYA discovered text.
    expect(entries["home.hero.heading"]).toEqual({ value: "Live Studio Heading", type: "text" });
  });

  it("Bug #2: a local edit wins over the server draft; Save Draft UNIONS pending keys (adopted drafts are never dropped)", async () => {
    const { mutations } = setup({ contentMap: CONTENT_MAP_WITH_DRAFTS });
    await renderEditor();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Discard 2 draft changes/ })).toBeInTheDocument();
    });
    // Fresh session edit on a key with NO server draft.
    frameSends({ source: "taya-editor", kind: "element-click", key: "home.hero.heading" });
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Fresh Session Edit" } });
    // Preview pushes the union: the local edit + both server drafts.
    const previewButtons = screen.getAllByRole("button", { name: "Preview" });
    fireEvent.click(previewButtons[previewButtons.length - 1]);
    const applyDraft = parentToFrameMessages().filter((m) => m.kind === "apply-draft");
    const entries = (applyDraft[applyDraft.length - 1] as { entries: Record<string, { value: string; type: string }> }).entries;
    expect(entries["home.hero.heading"]).toEqual({ value: "Fresh Session Edit", type: "text" });
    expect(entries["home.about.body"]).toEqual({ value: "Prior Session Draft Body", type: "text" });
    // Save Draft unions: adopted server keys survive alongside the new key.
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/ }));
    expect(await screen.findByRole("button", { name: /Discard 3 draft changes/ })).toBeInTheDocument();
  });

  it("Bug #2: restore unions with adopted server drafts (restoring must not drop other pending drafts)", async () => {
    const { mutations } = setup({ contentMap: CONTENT_MAP_WITH_DRAFTS });
    await renderEditor();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Discard 2 draft changes/ })).toBeInTheDocument();
    });
    await restoreRevisionLocal(mutations, [{ key: "home.hero.heading", value: "Restored Heading" }]);
    // 2 adopted server drafts + 1 restored key = 3 pending keys.
    expect(await screen.findByRole("button", { name: /Discard 3 draft changes/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeEnabled();
    });
  });

  it("Bug #2: no server drafts → no fake pending state (honest baseline preserved)", async () => {
    setup();
    await renderEditor();
    expect(screen.getByText(/All changes saved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /draft change/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Publish$|^Publish \(blocked\)$| Publish$/ })).toBeDisabled();
  });
});
