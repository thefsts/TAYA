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
 *   7. Honest editing: no remove/reorder buttons for repeatable items
 *      (structural ops aren't persisted server-side — never faked).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

/* ── Hoisted mock handles ─────────────────────────────────────────────── */

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockLocation = vi.hoisted(() => ({ value: "/" }));
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
  useLocation: () => [mockLocation.value, vi.fn()],
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
}: {
  contentMap?: Record<string, unknown> | null;
  authority?: Record<string, unknown> | null;
  revisions?: Record<string, unknown>[] | null;
} = {}) {
  const dispatch: Record<string, unknown> = {
    "api.contentMap.get": contentMap,
    "api.publishing.canPublish": authority,
    "api.editor.editorRevisions": revisions,
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
      label: "h1: Live Studio Heading",
      alt: null, text: "Live Studio Heading", href: null, itemId: null,
    });
    expect(await screen.findByText(/Homepage · hero · heading/)).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
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
  it("lists repeatable items for click-to-edit but offers NO remove/reorder buttons", async () => {
    setup();
    await renderEditor();
    expect(screen.getByText("Sections with repeatable items")).toBeInTheDocument();
    expect(screen.getByText(/Homepage · services · items 0/)).toBeInTheDocument();
    expect(screen.getByText(/Homepage · services · items 1/)).toBeInTheDocument();
    // Structural ops are not persisted server-side — the UI must not offer them.
    expect(screen.queryByRole("button", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move down" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
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
