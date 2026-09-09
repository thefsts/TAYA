/**
 * onboarding-ai-card-disabled.test.tsx
 *
 * G-9 (Phase 5 UX closeout) regression suite: the "Generate AI starter content"
 * onboarding choice must look AND behave disabled. Previously the card rendered
 * as a normal selectable radio card but silently no-oped on click — a fake
 * clickable control. The fix: RadioCard accepts a `disabled` prop (aria-disabled,
 * muted styling, "Coming soon" badge, no onClick) and Step5 passes it for the
 * "ai" option. No AI functionality is built — the option remains a future
 * feature, just honestly presented.
 *
 * Contracts verified (reached by driving the real wizard from Step 0 to Step 5):
 *   1. The AI card renders with aria-disabled="true".
 *   2. The AI card shows a visible "Coming soon" badge.
 *   3. Clicking the AI card does NOT select it (the selected radio dot never
 *      appears for it, and contentSetup stays at its default "skip").
 *   4. The two real options remain clickable and select normally.
 *   5. The wizard still advances (Next works) — the disabled card cannot trap
 *      the flow.
 *   6. The other content-setup steps (4: Template) remain fully interactive
 *      (regression guard on the shared RadioCard component).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Hoisted mock handles ─────────────────────────────────────────────────────

const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseAction = vi.hoisted(() => vi.fn());

// ── External / framework mocks ───────────────────────────────────────────────

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
  useLocation: () => ["/app/onboard", vi.fn()],
  useSearch: () => "",
  useParams: () => ({}),
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/AIAssistant", () => ({
  AIAssistant: () => null,
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import OnboardingWizard from "@/pages/app/OnboardingWizard";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SUPERADMIN = { _id: "user_superadmin", isSuperAdmin: true, roles: [] };

function workspace(dispatch: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    "api.users.me": SUPERADMIN,
    "api.onboarding.getSession": { status: "fresh", stepData: {} },
    ...dispatch,
  };
  mockUseQuery.mockImplementation((q: unknown) => {
    const path = typeof q === "function" ? (q as () => string)() : (q as string);
    if (Object.prototype.hasOwnProperty.call(base, path)) return base[path];
    return null;
  });
  // saveStep/createSession/launch are callable mutation handles that resolve.
  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ ok: true }));
  mockUseAction.mockReturnValue(vi.fn());
}

beforeEach(() => {
  window.localStorage.clear();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(null);
  mockUseMutation.mockReset();
  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue({ ok: true }));
  mockUseAction.mockReset();
  mockUseAction.mockReturnValue(vi.fn());
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Step 0 (Business Info) has three required fields — fill them so Next enables. */
function fillBusinessInfo() {
  fireEvent.change(screen.getByLabelText("Business Name"), { target: { value: "Acme Corp" } });
  fireEvent.change(screen.getByLabelText("Website Name"), { target: { value: "Acme Website" } });
}

/** The wizard's Next button (currentStep < 10). */
function nextButton() {
  return screen.getByRole("button", { name: /^Next/i });
}

/** Drive the wizard to Step 5 (Content Setup).
 * Anchors use exact level-2 headings — body-text regexes (e.g. /brand/i) also
 * match the progress header ("Step 4 of 11 — Branding"), which breaks queries. */
async function goToStep5() {
  fillBusinessInfo();
  fireEvent.click(nextButton()); // 0 -> 1
  await screen.findByRole("heading", { level: 2, name: "Website Purpose" });
  // Step 1 REQUIRES at least one purpose selected before Next enables
  // (validation: purposes.length > 0). Check the first real checkbox.
  fireEvent.click(screen.getByLabelText("Generate leads"));
  fireEvent.click(nextButton()); // 1 -> 2
  await screen.findByRole("heading", { level: 2, name: "Website Structure" });
  fireEvent.click(nextButton()); // 2 -> 3
  await screen.findByRole("heading", { level: 2, name: "Branding" });
  fireEvent.click(nextButton()); // 3 -> 4
  await screen.findByRole("heading", { level: 2, name: "Template" });
  fireEvent.click(nextButton()); // 4 -> 5
  await screen.findByRole("heading", { level: 2, name: "Content Setup" });
}

/** Label wrapper for a content-setup option (RadioCard renders a <label data-value>). */
function optionCard(value: string) {
  const el = document.querySelector(`label[data-value="${value}"]`);
  if (!el) throw new Error(`RadioCard option "${value}" not rendered`);
  return el as HTMLElement;
}

// ── Suite: AI card looks disabled ────────────────────────────────────────────

describe("OnboardingWizard Step 5 — G-9 AI card disabled presentation", () => {
  it("renders the AI option with aria-disabled and a Coming soon badge", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    const ai = optionCard("ai");
    expect(ai.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("mutes the AI card styling (disabled classes), unlike enabled cards", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    const ai = optionCard("ai");
    const skip = optionCard("skip");
    expect(ai.className).toContain("cursor-not-allowed");
    expect(ai.className).toContain("opacity-70");
    expect(skip.className).toContain("cursor-pointer");
    expect(skip.className).not.toContain("cursor-not-allowed");
  });
});

// ── Suite: AI card behaves disabled ──────────────────────────────────────────

describe("OnboardingWizard Step 5 — G-9 AI card disabled behavior", () => {
  it("does not select the AI option when clicked (no silent no-op that looks selected)", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    const ai = optionCard("ai");
    fireEvent.click(ai);

    // The AI card must not gain the selected styling / radio dot.
    expect(ai.className).not.toContain("border-blue-500");
    const dot = ai.querySelector(".h-2.w-2.rounded-full.bg-blue-600");
    expect(dot).toBeNull();
  });

  it("keeps the default contentSetup (skip) selected after clicking the AI card", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    fireEvent.click(optionCard("ai"));

    // Advance to Step 6 and back — the review of selections must still show
    // the default plan, i.e. "ai" was never recorded. (contentSetup "skip"
    // maps to the Skip label on the review readiness list as "Content plan".)
    fireEvent.click(nextButton()); // 5 -> 6
    await screen.findByRole("heading", { level: 2, name: "Domain" });
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i })); // 6 -> 5
    await screen.findByRole("heading", { level: 2, name: "Content Setup" });

    const skip = optionCard("skip");
    expect(skip.className).toContain("border-blue-500"); // still selected
  });

  it("still allows the real options to be selected normally", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    const own = optionCard("own");
    fireEvent.click(own);
    expect(own.className).toContain("border-blue-500");

    const skip = optionCard("skip");
    fireEvent.click(skip);
    expect(skip.className).toContain("border-blue-500");
    expect(own.className).not.toContain("border-blue-500");
  });

  it("does not trap the wizard — Next still advances from Step 5", async () => {
    workspace();
    render(<OnboardingWizard />);
    await goToStep5();

    fireEvent.click(optionCard("ai")); // must be a harmless no-op
    fireEvent.click(nextButton()); // 5 -> 6
    await screen.findByRole("heading", { level: 2, name: "Domain" });
  });
});

// ── Suite: shared RadioCard regression (Step 4 Template step) ────────────────

describe("OnboardingWizard Step 4 — enabled RadioCards unaffected (regression)", () => {
  it("template cards remain clickable and select normally", async () => {
    workspace();
    render(<OnboardingWizard />);
    fillBusinessInfo();
    fireEvent.click(nextButton()); // 0 -> 1
    await screen.findByRole("heading", { level: 2, name: "Website Purpose" });
    fireEvent.click(screen.getByLabelText("Generate leads")); // required
    fireEvent.click(nextButton()); // 1 -> 2
    await screen.findByRole("heading", { level: 2, name: "Website Structure" });
    fireEvent.click(nextButton()); // 2 -> 3
    await screen.findByRole("heading", { level: 2, name: "Branding" });
    fireEvent.click(nextButton()); // 3 -> 4
    await screen.findByRole("heading", { level: 2, name: "Template" });

    const cards = Array.from(document.querySelectorAll("label[data-value]"));
    expect(cards.length).toBeGreaterThan(0);
    // None of the template cards is disabled.
    for (const card of cards) {
      expect(card.getAttribute("aria-disabled")).not.toBe("true");
    }
    const first = cards[0] as HTMLElement;
    const before = first.className;
    fireEvent.click(first);
    // Clicking selects it (border-blue-500 appears) — normal behavior intact.
    expect(first.className).toContain("border-blue-500");
    expect(before).toBeTruthy();
  });
});
