/**
 * mataya.test.tsx
 *
 * MATAYA™ by TAYA™ — production completion suite for the client assistant.
 *
 * This suite replaces the old reliance on `() => null` no-op mocks with real
 * behavioural coverage of the production AIAssistant component:
 *
 *   1. Launcher / panel — labelled toggle, dialog semantics, authority footer.
 *   2. Visibility gate — renders nothing while signed out, while site access
 *      is loading, or when the viewer has no access to the site.
 *   3. Provider states — configured (composer), unconfigured (friendly
 *      guidance, no composer), status-check failure (safe copy + retry).
 *   4. Chat — send/reply, request args (siteId, section, pageContext),
 *      thinking indicator, safe error mapping + retry, clear, empty-input
 *      guard, live-log semantics.
 *   5. Section context — route-derived chips (media → alt tool, seo → meta
 *      tool, services/faq → prefilled prompts) and the header section label.
 *   6. Alt-text tool — suggest → review → copy, args, safe errors + retry,
 *      disabled guard, and NO save/publish/apply affordances.
 *   7. Meta-description tool — suggest → review → copy, args, prefill from
 *      pageContext, safe errors + retry.
 *   8. Branding hygiene — MATAYA™ by TAYA™ only; the obsolete FSTS assistant
 *      names never surface.
 *   9. Keyboard — Escape closes, Enter sends / Shift+Enter doesn't, focus
 *      returns to the launcher on close.
 *  10. Authority boundary — the component never registers a Convex mutation
 *      and only ever subscribes to the site-access query. It is read-only by
 *      construction: suggestions only, the client applies everything.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

// ---- Hoisted mock handles -----------------------------------------------

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => ({ isAuthenticated: true }));
const mockLocation = vi.hoisted(() => ({ value: "/app/sites/site_test123" }));
const mockSetLocation = vi.hoisted(() => vi.fn());

// ---- External / framework mocks ------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
  useConvexAuth: () => ({ isAuthenticated: mockAuth.isAuthenticated, isLoading: false }),
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
  useLocation: () => [mockLocation.value, mockSetLocation],
  useSearch: () => "",
  useParams: () => ({}),
  useRoute: () => [false, {}],
  Link: ({ href, children, ...rest }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  Redirect: () => null,
}));

import AIAssistant from "@/components/AIAssistant";

// ---- Fixtures & helpers ----------------------------------------------------

const SITE_ID = "site_test123";

const SITE = {
  _id: "site_test123",
  name: "Ridgeline Guitar Studio",
  slug: "ridgeline-guitar-studio",
  status: "active",
};

function configuredStatus() {
  return { configured: true, model: "fixture-model" };
}

function dispatchQuery(handlers: Record<string, (args: unknown) => unknown>) {
  mockUseQuery.mockImplementation((query: unknown, args: unknown) => {
    const path = typeof query === "function" ? query() : String(query);
    const handler = handlers[path];
    if (!handler) throw new Error(`Unexpected query in test: ${path}`);
    return handler(args);
  });
}

/**
 * The component registers all four useAction hooks on every render, so the
 * mock must tolerate ANY registered path. Strictness is enforced at
 * invocation time instead: an unregistered action that is actually CALLED
 * throws, which is the real contract violation we care about.
 */
function dispatchActions(handlers: Record<string, (args: unknown) => unknown>) {
  mockUseAction.mockImplementation((action: unknown) => {
    const path = typeof action === "function" ? action() : String(action);
    const handler = handlers[path];
    if (handler) {
      return vi.fn(async (args: unknown) => handler(args));
    }
    return vi.fn(async () => {
      throw new Error(`Unexpected action invoked in test: ${path}`);
    });
  });
}

function renderAssistant(pageContext?: string) {
  return render(<AIAssistant siteId={SITE_ID} pageContext={pageContext} />);
}

async function openPanel() {
  const launcher = await screen.findByRole("button", { name: /open the mataya assistant/i });
  fireEvent.click(launcher);
  return screen.findByRole("dialog", { name: /mataya assistant/i });
}

async function typeAndSend(text: string) {
  const input = await screen.findByRole("textbox", { name: /ask mataya/i });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

// ---- Lifecycle -------------------------------------------------------------

beforeEach(() => {
  mockLocation.value = "/app/sites/site_test123";
  mockAuth.isAuthenticated = true;
  mockUseAction.mockReset();
  mockUseMutation.mockReset();
  mockUseMutation.mockReturnValue(vi.fn());
  dispatchQuery({ "api.sites.get": () => SITE });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---- 1. Launcher / panel -----------------------------------------------------

describe("MATAYA launcher and panel", () => {
  it("toggles the panel open and closed from an aria-labelled launcher", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    const launcher = await screen.findByRole("button", { name: /open the mataya assistant/i });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(launcher).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(launcher);
    const panel = await screen.findByRole("dialog", { name: /mataya assistant/i });
    expect(launcher).toHaveAttribute("aria-expanded", "true");
    expect(launcher).toHaveAttribute("aria-controls", "mataya-panel");
    expect(panel).toHaveAttribute("id", "mataya-panel");

    // Close through the launcher itself (its label flips while open).
    fireEvent.click(screen.getByRole("button", { name: /close the mataya assistant/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /open the mataya assistant/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("exposes non-modal dialog semantics with the authority footer always visible", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    const panel = await openPanel();
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAttribute("aria-modal", "false");
    expect(panel).toHaveAttribute("aria-label", "MATAYA assistant");
    expect(
      screen.getByText(
        /Suggestions only — MATAYA never saves, publishes, or changes your website without you/i,
      ),
    ).toBeTruthy();
  });

  it("brands the header MATAYA™ by TAYA™ with the current section label", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    await openPanel();
    expect(screen.getAllByText(/MATAYA™/).length).toBeGreaterThan(0);
    expect(screen.getByText(/by TAYA™ — Dashboard Home/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close MATAYA" })).toBeTruthy();
  });
});

// ---- 2. Visibility gate --------------------------------------------------------

describe("MATAYA visibility gate", () => {
  it("renders nothing while site access is still loading", () => {
    dispatchQuery({ "api.sites.get": () => undefined });
    const { container } = renderAssistant();
    expect(container).toBeEmptyDOMElement();
    expect(mockUseMutation).not.toHaveBeenCalled();
  });

  it("renders nothing when the viewer has no site access or is signed out", () => {
    dispatchQuery({ "api.sites.get": () => null });
    const first = renderAssistant();
    expect(first.container).toBeEmptyDOMElement();
    cleanup();

    mockAuth.isAuthenticated = false;
    const second = renderAssistant();
    expect(second.container).toBeEmptyDOMElement();
  });
});

// ---- 3. Provider states ---------------------------------------------------------

describe("MATAYA provider states", () => {
  it("configured: shows the welcome copy and an enabled composer", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    await openPanel();
    expect(await screen.findByText(/Hi, I'm MATAYA™ — your website assistant/i)).toBeTruthy();
    expect(
      screen.getByText(/I only make suggestions: you review everything and apply changes yourself/i),
    ).toBeTruthy();
    expect(await screen.findByRole("textbox", { name: /ask mataya/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
  });

  it("unconfigured: explains MATAYA isn't connected and hides the composer", async () => {
    dispatchActions({ "api.ai.status": () => ({ configured: false, model: "" }) });
    renderAssistant();

    await openPanel();
    expect(await screen.findByText(/MATAYA isn't connected yet/i)).toBeTruthy();
    expect(
      screen.getByText(/Your TAYA team hasn't connected the AI service for this dashboard yet/i),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /ask mataya/i })).toBeNull();
  });

  it("status failure: safe copy with a Try again that recovers", async () => {
    let statusCall = 0;
    dispatchActions({
      "api.ai.status": () => {
        statusCall += 1;
        if (statusCall === 1) throw new Error("backend unreachable");
        return configuredStatus();
      },
    });
    renderAssistant();

    await openPanel();
    expect(await screen.findByText(/MATAYA isn't available right now/i)).toBeTruthy();
    expect(screen.getByText(/Something went wrong while checking the assistant/i)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /ask mataya/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("textbox", { name: /ask mataya/i })).toBeTruthy();
  });
});

// ---- 4. Chat ---------------------------------------------------------------------

describe("MATAYA chat", () => {
  it("sends a message and renders the assistant reply", async () => {
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": () => ({ content: "Try a benefit-first headline, then one supporting line." }),
    });
    renderAssistant();

    await openPanel();
    await typeAndSend("How long should my homepage headline be?");
    expect(await screen.findByText("Try a benefit-first headline, then one supporting line.")).toBeTruthy();
  });

  it("sends siteId, the route-derived section, and page context with every request", async () => {
    const chatCalls: Array<Record<string, unknown>> = [];
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": (args) => {
        chatCalls.push(args as Record<string, unknown>);
        return { content: "Describe the outcome the client gets, then the process." };
      },
    });
    mockLocation.value = "/app/sites/site_test123/seo";
    renderAssistant("Page /about has title About Us");

    await openPanel();
    await typeAndSend("How should I describe my About page?");

    expect(chatCalls.length).toBe(1);
    const first = chatCalls[0] as {
      siteId?: string;
      section?: string;
      pageContext?: string;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(first.siteId).toBe(SITE_ID);
    expect(first.section).toBe("SEO Settings");
    expect(first.pageContext).toBe("Page /about has title About Us");
    expect(first.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "How should I describe my About page?" }),
      ]),
    );
  });

  it("shows a thinking indicator while the assistant replies", async () => {
    let resolveReply!: (value: { content: string }) => void;
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": () =>
        new Promise<{ content: string }>((resolve) => {
          resolveReply = resolve;
        }),
    });
    renderAssistant();

    await openPanel();
    await typeAndSend("How long should my homepage headline be?");
    expect(screen.getByText(/MATAYA is thinking/i)).toBeTruthy();

    resolveReply({ content: "Aim for six to ten words." });
    expect(await screen.findByText("Aim for six to ten words.")).toBeTruthy();
    expect(screen.queryByText(/MATAYA is thinking/i)).toBeNull();
  });

  it("maps provider failures to safe copy and retries successfully", async () => {
    let chatCall = 0;
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": () => {
        chatCall += 1;
        if (chatCall === 1) throw new Error("AI_PROVIDER_ERROR_503");
        return { content: "Second attempt worked." };
      },
    });
    renderAssistant();

    await openPanel();
    await typeAndSend("Give me a headline idea.");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/MATAYA couldn't reach the AI service/i);
    // The raw provider failure never leaks: no status codes, provider names,
    // or credential material in the surfaced copy.
    expect(alert.textContent).not.toMatch(/503|provider|openai|api[_ ]?key|bearer/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Second attempt worked.")).toBeTruthy();
  });

  it("clears the conversation from the header", async () => {
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": () => ({ content: "Short and specific beats long and vague." }),
    });
    renderAssistant();

    await openPanel();
    await typeAndSend("Any tips for service descriptions?");
    expect(await screen.findByText("Short and specific beats long and vague.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
    await waitFor(() => expect(screen.queryByText("Short and specific beats long and vague.")).toBeNull());
    expect(await screen.findByText(/Hi, I'm MATAYA™ — your website assistant/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear conversation" })).toBeNull();
  });

  it("does not send empty or whitespace-only input", async () => {
    const chatCalls: unknown[] = [];
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": (args) => {
        chatCalls.push(args);
        return { content: "should never happen" };
      },
    });
    renderAssistant();

    await openPanel();
    await typeAndSend("   ");
    expect(chatCalls.length).toBe(0);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.queryByText(/should never happen/i)).toBeNull();
  });

  it("exposes the conversation as a politely announced live log", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    await openPanel();
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-label", "MATAYA conversation");
    expect(log).toHaveAttribute("aria-live", "polite");
  });
});

// ---- 5. Section context --------------------------------------------------------

describe("MATAYA section context", () => {
  it("media route: offers the alt-text chip and opens the alt tool", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    await openPanel();
    expect(screen.getByText(/by TAYA™ — Media Library/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    expect(await screen.findByRole("heading", { name: "Image alt text" })).toBeTruthy();
  });

  it("seo route: offers the meta-description chip and opens the meta tool", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/seo";
    renderAssistant();

    await openPanel();
    expect(screen.getByText(/by TAYA™ — SEO Settings/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /suggest a meta description/i }));
    expect(await screen.findByRole("heading", { name: "SEO meta description" })).toBeTruthy();
  });

  it("services route: chip prefills a services prompt in the composer", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/services";
    renderAssistant();

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /help me write a service description/i }));
    const input = await screen.findByRole("textbox", { name: /ask mataya/i });
    expect(input).toHaveValue("Help me write a clear, friendly description for one of my services.");
  });

  it("faq route: chip prefills an FAQ prompt and the header shows the FAQ label", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/faq";
    renderAssistant();

    await openPanel();
    expect(await screen.findByText(/by TAYA™ — FAQ/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /write better faq answers/i }));
    const input = await screen.findByRole("textbox", { name: /ask mataya/i });
    expect(input).toHaveValue("Help me write clear answers to my customers' most common questions.");
  });
});

// ---- 6. Alt-text tool ------------------------------------------------------------

describe("MATAYA alt-text tool", () => {
  it("suggests alt text for review, with copy affordance and review guidance", async () => {
    const altCalls: Array<Record<string, unknown>> = [];
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.generateAltText": (args) => {
        altCalls.push(args as Record<string, unknown>);
        return { altText: "A guitar teacher helping a young student tune an acoustic guitar." };
      },
    });
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    const urlInput = await screen.findByRole("textbox", { name: "Image URL" });
    fireEvent.change(urlInput, { target: { value: "https://example.com/lesson-room.jpg" } });
    fireEvent.change(screen.getByRole("textbox", { name: /how the image is used/i }), {
      target: { value: "Homepage hero image" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest alt text" }));

    expect(await screen.findByTestId("alt-suggestion")).toHaveTextContent(
      "A guitar teacher helping a young student tune an acoustic guitar.",
    );
    expect(altCalls.length).toBe(1);
    expect(altCalls[0]).toEqual(
      expect.objectContaining({
        siteId: SITE_ID,
        imageUrl: "https://example.com/lesson-room.jpg",
        context: "Homepage hero image",
      }),
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByText(/MATAYA won't save or change anything for you/i)).toBeTruthy();
  });

  it("maps alt failures to safe copy and retries successfully", async () => {
    let altCall = 0;
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.generateAltText": () => {
        altCall += 1;
        if (altCall === 1) throw new Error("AI_PROVIDER_ERROR_503");
        return { altText: "A cozy teaching studio with two guitars on stands." };
      },
    });
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://example.com/studio.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest alt text" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/MATAYA couldn't reach the AI service/i);
    expect(alert.textContent).not.toMatch(/503|provider|openai|api[_ ]?key|bearer/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("alt-suggestion")).toHaveTextContent(
      "A cozy teaching studio with two guitars on stands.",
    );
  });

  it("keeps Suggest disabled until an image URL is entered", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    const suggest = await screen.findByRole("button", { name: "Suggest alt text" });
    expect(suggest).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://example.com/photo.jpg" },
    });
    expect(screen.getByRole("button", { name: "Suggest alt text" })).toBeEnabled();
  });

  it("offers no save, publish, or apply affordances in the alt tool", async () => {
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.generateAltText": () => ({ altText: "A student practicing chord shapes." }),
    });
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://example.com/chords.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest alt text" }));
    expect(await screen.findByTestId("alt-suggestion")).toBeTruthy();

    expect(screen.queryByRole("button", { name: /save|publish|apply|update|write to/i })).toBeNull();
  });
});

// ---- 7. Meta-description tool -----------------------------------------------------

describe("MATAYA meta-description tool", () => {
  const PAGE_CONTEXT =
    "Homepage hero: Welcome to Ridgeline Guitar Studio. Acoustic and electric lessons for all ages and levels.";

  it("suggests a meta description for review, with copy affordance and guidance", async () => {
    const metaCalls: Array<Record<string, unknown>> = [];
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.generateMetaDescription": (args) => {
        metaCalls.push(args as Record<string, unknown>);
        return { description: "Friendly guitar lessons for every age and level in Ridgeline." };
      },
    });
    mockLocation.value = "/app/sites/site_test123/seo";
    renderAssistant(PAGE_CONTEXT);

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest a meta description/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "About Us" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest meta description" }));

    expect(await screen.findByTestId("meta-suggestion")).toHaveTextContent(
      "Friendly guitar lessons for every age and level in Ridgeline.",
    );
    expect(metaCalls.length).toBe(1);
    expect(metaCalls[0]).toEqual(
      expect.objectContaining({
        siteId: SITE_ID,
        pageTitle: "About Us",
        pageContent: PAGE_CONTEXT,
      }),
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByText(/MATAYA never publishes or saves anything for you/i)).toBeTruthy();
  });

  it("maps meta failures to safe copy and retries successfully", async () => {
    let metaCall = 0;
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.generateMetaDescription": () => {
        metaCall += 1;
        if (metaCall === 1) throw new Error("AI_PROVIDER_ERROR_500");
        return { description: "Patient, personalised guitar lessons for kids and adults." };
      },
    });
    mockLocation.value = "/app/sites/site_test123/seo";
    renderAssistant(PAGE_CONTEXT);

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest a meta description/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), {
      target: { value: "Lessons" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest meta description" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/MATAYA couldn't reach the AI service/i);
    expect(alert.textContent).not.toMatch(/500|provider|openai|api[_ ]?key|bearer/i);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("meta-suggestion")).toHaveTextContent(
      "Patient, personalised guitar lessons for kids and adults.",
    );
  });

  it("pre-fills the page content from the page context for the client to edit", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    mockLocation.value = "/app/sites/site_test123/seo";
    renderAssistant(PAGE_CONTEXT);

    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest a meta description/i }));
    const content = await screen.findByRole("textbox", { name: "Page content" });
    expect(content).toHaveValue(PAGE_CONTEXT);
    expect(screen.getByText(/Pre-filled from this page's settings — edit freely/i)).toBeTruthy();
  });
});

// ---- 8. Branding hygiene ----------------------------------------------------------

describe("MATAYA branding hygiene", () => {
  it("presents MATAYA™ by TAYA™ and never the obsolete FSTS assistant names", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    const { container } = renderAssistant();

    await openPanel();
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toMatch(/fsts-wos|fsts ai dashboard assistant|fsts website operating system/);
    expect(screen.getAllByText(/mataya/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/taya/i).length).toBeGreaterThan(0);
  });

  it("always frames MATAYA as suggestions-only", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    await openPanel();
    expect(
      screen.getByText(/I only make suggestions: you review everything and apply changes yourself/i),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Suggestions only — MATAYA never saves, publishes, or changes your website without you/i,
      ),
    ).toBeTruthy();
  });
});

// ---- 9. Keyboard -------------------------------------------------------------------

describe("MATAYA keyboard support", () => {
  it("closes the panel with Escape", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    const panel = await openPanel();
    fireEvent.keyDown(panel, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Enter sends the message; Shift+Enter inserts a newline instead", async () => {
    const chatCalls: unknown[] = [];
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": (args) => {
        chatCalls.push(args);
        return { content: "Got it." };
      },
    });
    renderAssistant();

    await openPanel();
    const input = await screen.findByRole("textbox", { name: /ask mataya/i });
    fireEvent.change(input, { target: { value: "First question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Got it.")).toBeTruthy();
    expect(chatCalls.length).toBe(1);

    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(chatCalls.length).toBe(1);
  });

  it("returns focus to the launcher when the panel closes", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();

    const launcher = await screen.findByRole("button", { name: /open the mataya assistant/i });
    fireEvent.click(launcher);
    await screen.findByRole("dialog", { name: /mataya assistant/i });
    fireEvent.click(screen.getByRole("button", { name: "Close MATAYA" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(launcher);
  });
});

// ---- 10. Authority boundary ----------------------------------------------------------

describe("MATAYA authority boundary", () => {
  it("never registers a Convex mutation across every interaction", async () => {
    dispatchActions({
      "api.ai.status": () => configuredStatus(),
      "api.ai.chat": () => ({ content: "Suggestion only." }),
      "api.ai.generateAltText": () => ({ altText: "Suggested alt text." }),
    });
    // Start on the media route so the alt tool is reachable, then exercise
    // chat too — all without the component ever registering a mutation.
    mockLocation.value = "/app/sites/site_test123/media";
    renderAssistant();

    // Alt tool interaction.
    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: /suggest image alt text/i }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Image URL" }), {
      target: { value: "https://example.com/a.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest alt text" }));
    expect(await screen.findByTestId("alt-suggestion")).toBeTruthy();

    // Back to chat, then a chat interaction.
    fireEvent.click(screen.getByRole("button", { name: /back to chat/i }));
    await typeAndSend("Hello");
    expect(await screen.findByText("Suggestion only.")).toBeTruthy();

    // The assistant is read-only by construction: no mutation hooks at all.
    expect(mockUseMutation).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /save|publish|apply|update|write to/i }),
    ).toBeNull();
  });

  it("only ever subscribes to the site-access query", async () => {
    dispatchActions({ "api.ai.status": () => configuredStatus() });
    renderAssistant();
    await openPanel();

    expect(mockUseQuery.mock.calls.length).toBeGreaterThan(0);
    const paths = mockUseQuery.mock.calls.map((call) => {
      const query = call[0];
      return typeof query === "function" ? query() : String(query);
    });
    expect(paths.every((path) => path === "api.sites.get")).toBe(true);
  });
});
