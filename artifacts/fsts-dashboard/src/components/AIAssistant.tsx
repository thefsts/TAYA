/**
 * MATAYA™ by TAYA™ — the TAYA client assistant.
 *
 * A floating, site-scoped assistant for authenticated clients. MATAYA only
 * makes suggestions: it never saves, publishes, or changes anything on the
 * client's website. Alt-text and meta-description suggestions are offered
 * for review, and the client applies them through the existing dashboard
 * forms themselves.
 *
 * This component mounts once inside AppLayout (SiteDashboard.tsx), so it is
 * present on every authenticated site page and never on public, sign-in, or
 * admin pages. It renders nothing while unauthenticated, while site access
 * is loading, or when the viewer has no access to the site.
 *
 * Backend: convex/ai.ts (status / chat / generateAltText /
 * generateMetaDescription) — every call is gated server-side by
 * requireSiteAccess, so a client can never read or submit AI work for
 * another tenant's site.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, X, Send, Loader2, Trash2, Copy, Check, ArrowLeft,
  Image as ImageIcon, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  siteId: string;
  pageContext?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type ProviderStatus = { configured: boolean; model: string };
type ToolMode = "chat" | "alt" | "meta";

// ─── Section context ────────────────────────────────────────────────────
// Derived from the current route so MATAYA's guidance matches the page the
// client is actually viewing.

const SECTION_LABELS: Record<string, string> = {
  pages: "Pages",
  editor: "Visual Editor",
  homepage: "Homepage Editor",
  courses: "Courses & Classes",
  events: "Events",
  articles: "Articles",
  seo: "SEO Settings",
  media: "Media Library",
  footer: "Footer",
  contact: "Contact Info",
  payments: "Payments",
  commerce: "Commerce",
  email: "Email",
  crm: "CRM",
  faq: "FAQ",
  testimonials: "Testimonials",
  inbox: "Inbox",
  health: "Site Health",
  policies: "Policies",
  nav: "Navigation",
  announcement: "Announcement Banner",
  cta: "Call to Action",
  downloads: "Downloads",
  team: "Team",
  services: "Services",
  careers: "Careers",
  popup: "Popups",
  history: "Version History",
  activity: "Activity Log",
  users: "Site Users",
  backups: "Backups",
  help: "Help Center",
  verification: "Site Verification",
  settings: "Website Settings",
  forms: "Forms",
  permissions: "My Permissions",
  "payment-providers": "Payment Providers",
  automation: "Automation",
  reviews: "Reviews",
  portal: "Portal Manager",
  products: "Products",
  flyers: "Flyers",
};

function segmentFromLocation(path: string): string | null {
  const match = /^\/app\/sites\/[^/]+\/([^/?#]+)/.exec(path);
  return match ? match[1] : null;
}

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sectionLabelFor(path: string): string {
  const segment = segmentFromLocation(path);
  if (!segment) return "Dashboard Home";
  return SECTION_LABELS[segment] ?? titleCaseSegment(segment);
}

// ─── Safe error mapping ──────────────────────────────────────────────────
// Raw backend/provider errors are never surfaced. Only friendly, non-technical
// copy that reveals nothing about the provider, credentials, or architecture.

function safeAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("AI_NOT_CONFIGURED")) {
    return "MATAYA isn't set up yet. Your TAYA team needs to connect the AI service before chat is available.";
  }
  if (raw.includes("AI_EMPTY_RESPONSE")) {
    return "MATAYA returned an empty reply. Try rephrasing your question.";
  }
  if (/AI_PROVIDER_ERROR_\d+/.test(raw)) {
    return "MATAYA couldn't reach the AI service. Please try again in a moment.";
  }
  if (raw.includes("Forbidden")) {
    return "You don't have access to this website's assistant.";
  }
  if (raw.includes("Unauthenticated")) {
    return "Your session has expired. Please sign in again.";
  }
  return "Something went wrong while MATAYA was replying. Please try again.";
}

// ─── Clipboard helper ────────────────────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand("copy");
    helper.remove();
    return ok;
  } catch {
    return false;
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export function AIAssistant({ siteId, pageContext }: Props) {
  const { isAuthenticated } = useConvexAuth();
  const [location] = useLocation();

  // Site access gate — the assistant is hidden entirely when the viewer has
  // no access to this site (sites.get returns null) or while it loads.
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });

  const statusAction = useAction(api.ai.status);
  const chatAction = useAction(api.ai.chat);
  const altAction = useAction(api.ai.generateAltText);
  const metaAction = useAction(api.ai.generateMetaDescription);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ToolMode>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusInfo, setStatusInfo] = useState<ProviderStatus | null>(null);
  const [, setCheckingStatus] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);

  // Alt-text tool state
  const [imageUrl, setImageUrl] = useState("");
  const [imageContext, setImageContext] = useState("");
  const [altThinking, setAltThinking] = useState(false);
  const [altResult, setAltResult] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);
  const [altCopied, setAltCopied] = useState(false);

  // Meta-description tool state
  const [pageTitle, setPageTitle] = useState("");
  const [pageContent, setPageContent] = useState(pageContext ?? "");
  const [metaThinking, setMetaThinking] = useState(false);
  const [metaResult, setMetaResult] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaCopied, setMetaCopied] = useState(false);

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const statusRequestedRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);
  const metaTouchedRef = useRef(false);

  const sectionLabel = useMemo(() => sectionLabelFor(location), [location]);
  const segment = segmentFromLocation(location);

  // Derived provider state (declared before the effects below so effect
  // dependency arrays can reference it safely).
  const providerConfigured = statusInfo?.configured === true;

  // Provider status is checked once, when the panel is first opened. It is an
  // action (not a subscription), and its result is cached for the session.
  const runStatusCheck = useCallback(() => {
    setStatusFailed(false);
    setCheckingStatus(true);
    statusAction({ siteId: siteId as Id<"sites"> })
      .then((info: ProviderStatus) => setStatusInfo(info))
      .catch(() => setStatusFailed(true))
      .finally(() => setCheckingStatus(false));
  }, [statusAction, siteId]);

  useEffect(() => {
    if (open && !statusRequestedRef.current) {
      statusRequestedRef.current = true;
      runStatusCheck();
    }
  }, [open, runStatusCheck]);

  // Focus management: focus the input when the panel opens (or the panel
  // container when the composer is unavailable); return focus to the
  // launcher when it closes.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      // Let the panel mount before focusing. When the composer is still
      // loading the provider status, the input is disabled — focus the
      // panel container instead so keyboard users land inside the dialog.
      const timer = window.setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        } else {
          panelRef.current?.focus();
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      launcherRef.current?.focus();
    }
    // No cleanup needed on the close path — return undefined explicitly so
    // every code path of this effect returns a value (TS7030).
    return undefined;
  }, [open]);

  // Once the provider status resolves and the composer mounts, move focus
  // into it (only if focus is currently inside the panel).
  useEffect(() => {
    if (open && providerConfigured && inputRef.current) {
      const active = document.activeElement;
      const insidePanel = active && panelRef.current?.contains(active);
      if (insidePanel && active !== inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [open, providerConfigured]);

  // Keep the meta tool's page content pre-filled from the pageContext prop
  // unless the client has already typed their own content.
  useEffect(() => {
    if (metaTouchedRef.current) return;
    setPageContent(pageContext ?? "");
  }, [pageContext]);

  // Auto-scroll the conversation to the latest message.
  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ block: "nearest" });
      } catch {
        // no-op in environments without layout (tests)
      }
    }
  }, [messages, thinking, error, mode, altResult, metaResult]);

  // Clear pending clipboard timers on unmount.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // ── Chat ───────────────────────────────────────────────────────────────

  const runChat = useCallback(
    async (outgoing: ChatMessage[]) => {
      setThinking(true);
      setError(null);
      try {
        const result = await chatAction({
          siteId: siteId as Id<"sites">,
          messages: outgoing,
          section: sectionLabel,
          pageContext,
        });
        setMessages([...outgoing, { role: "assistant", content: result.content }]);
      } catch (err) {
        setMessages(outgoing);
        setError(safeAIError(err));
      } finally {
        setThinking(false);
      }
    },
    [chatAction, siteId, sectionLabel, pageContext],
  );

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || thinking || !providerConfigured) return;
    const outgoing: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(outgoing);
    setInput("");
    void runChat(outgoing);
  }, [input, thinking, providerConfigured, messages, runChat]);

  const retryChat = useCallback(() => {
    if (thinking || messages.length === 0) return;
    const outgoing = messages[messages.length - 1].role === "user" ? messages : messages.slice(0, -1);
    void runChat(outgoing);
  }, [thinking, messages, runChat]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setMode("chat");
  }, []);

  // ── Alt-text tool (Media Library context) ──────────────────────────────
  // Suggest → review → the client pastes it into the existing Alt Text field.
  // MATAYA never writes to the media library.

  const suggestAltText = useCallback(async () => {
    const url = imageUrl.trim();
    if (!url || altThinking) return;
    setAltThinking(true);
    setAltError(null);
    setAltResult(null);
    setAltCopied(false);
    try {
      const result = await altAction({
        siteId: siteId as Id<"sites">,
        imageUrl: url,
        context: imageContext.trim() || undefined,
      });
      setAltResult(result.altText);
    } catch (err) {
      setAltError(safeAIError(err));
    } finally {
      setAltThinking(false);
    }
  }, [imageUrl, imageContext, altThinking, altAction, siteId]);

  const copyAlt = useCallback(async () => {
    if (!altResult) return;
    const ok = await copyText(altResult);
    if (ok) {
      setAltCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setAltCopied(false), 2000);
    }
  }, [altResult]);

  // ── Meta-description tool (SEO Settings context) ───────────────────────
  // Suggest → review → the client pastes it into the existing Meta Description
  // field and saves it themselves. MATAYA never publishes anything.

  const suggestMetaDescription = useCallback(async () => {
    const title = pageTitle.trim();
    const content = pageContent.trim();
    if ((!title || !content) || metaThinking) return;
    setMetaThinking(true);
    setMetaError(null);
    setMetaResult(null);
    setMetaCopied(false);
    try {
      const result = await metaAction({
        siteId: siteId as Id<"sites">,
        pageTitle: title,
        pageContent: content,
      });
      setMetaResult(result.description);
    } catch (err) {
      setMetaError(safeAIError(err));
    } finally {
      setMetaThinking(false);
    }
  }, [pageTitle, pageContent, metaThinking, metaAction, siteId]);

  const copyMeta = useCallback(async () => {
    if (!metaResult) return;
    const ok = await copyText(metaResult);
    if (ok) {
      setMetaCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setMetaCopied(false), 2000);
    }
  }, [metaResult]);

  // ── Visibility gate (after all hooks) ──────────────────────────────────

  if (!isAuthenticated) return null;
  if (site === undefined || site === null) return null;

  // ── Keyboard ───────────────────────────────────────────────────────────

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ── Welcome suggestions per section ────────────────────────────────────

  const welcomeChips: { label: string; onClick: () => void }[] = [];
  if (segment === "media") {
    welcomeChips.push({ label: "Suggest image alt text", onClick: () => setMode("alt") });
  }
  if (segment === "seo") {
    welcomeChips.push({ label: "Suggest a meta description", onClick: () => setMode("meta") });
  }
  if (segment === "services") {
    welcomeChips.push({
      label: "Help me write a service description",
      onClick: () => {
        setMode("chat");
        setInput("Help me write a clear, friendly description for one of my services.");
        inputRef.current?.focus();
      },
    });
  }
  if (segment === "testimonials") {
    welcomeChips.push({
      label: "Improve my testimonial copy",
      onClick: () => {
        setMode("chat");
        setInput("Help me improve the testimonials on my website.");
        inputRef.current?.focus();
      },
    });
  }
  if (segment === "faq") {
    welcomeChips.push({
      label: "Write better FAQ answers",
      onClick: () => {
        setMode("chat");
        setInput("Help me write clear answers to my customers' most common questions.");
        inputRef.current?.focus();
      },
    });
  }
  if (welcomeChips.length === 0) {
    welcomeChips.push({
      label: "What can you help me with?",
      onClick: () => {
        setMode("chat");
        setInput("What can you help me with?");
        inputRef.current?.focus();
      },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Launcher — fixed bottom-right, above content, below toasts. */}
      <Button
        ref={launcherRef}
        type="button"
        variant="default"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="mataya-panel"
        aria-label={open ? "Close the MATAYA assistant" : "Open the MATAYA assistant"}
        className="fixed bottom-4 right-4 z-40 h-11 gap-2 rounded-full px-4 shadow-lg"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">MATAYA</span>
      </Button>

      {/* Panel — responsive: capped width that fits 390px screens, capped
          height with an internal scroll area. Non-modal dialog: the client can
          still read their page while chatting. */}
      {open && (
        <div
          id="mataya-panel"
          ref={panelRef}
          role="dialog"
          aria-label="MATAYA assistant"
          aria-modal="false"
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className="fixed bottom-20 right-4 z-40 flex max-h-[min(70vh,32rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  MATAYA<span className="align-super text-[0.6em]">™</span>
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  by TAYA™ — {sectionLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearConversation}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close MATAYA"
                title="Close MATAYA"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Body */}
          {mode === "chat" && (
            <div
              role="log"
              aria-live="polite"
              aria-label="MATAYA conversation"
              aria-busy={thinking}
              className="flex min-h-[12rem] flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
            >
              {messages.length === 0 && !error && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Hi, I'm MATAYA™ — your website assistant.</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      I can help you write and improve your content — headings, service
                      descriptions, FAQs, testimonials, course and event descriptions — and
                      suggest alt text for images and SEO meta descriptions. I only make
                      suggestions: you review everything and apply changes yourself.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {welcomeChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={chip.onClick}
                        className="rounded-full border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                    message.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-muted text-foreground",
                  )}
                >
                  {message.content}
                </div>
              ))}

              {thinking && (
                <div className="flex items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  MATAYA is thinking…
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="space-y-2 self-start rounded-lg border border-destructive-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <p>{error}</p>
                  <Button type="button" variant="outline" size="sm" onClick={retryChat}>
                    Retry
                  </Button>
                </div>
              )}

              <div ref={endRef} aria-hidden="true" />
            </div>
          )}

          {mode === "alt" && (
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("chat")}
                className="-ml-2 gap-1 px-2 text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to chat
              </Button>
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Image alt text</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Paste an image URL from your Media Library. MATAYA will suggest alt text
                for you to review and paste into the image's Alt Text field. Nothing is
                saved or changed automatically.
              </p>
              <Input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/photo.jpg"
                aria-label="Image URL"
              />
              <Input
                value={imageContext}
                onChange={(event) => setImageContext(event.target.value)}
                placeholder="Where the image is used (optional)"
                aria-label="How the image is used (optional)"
              />
              <Button
                type="button"
                onClick={suggestAltText}
                disabled={!imageUrl.trim() || altThinking}
                className="w-full gap-1.5"
              >
                {altThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {altThinking ? "Generating…" : "Suggest alt text"}
              </Button>
              {altError && (
                <div role="alert" className="rounded-lg border border-destructive-border bg-background px-3 py-2 text-sm">
                  <p>{altError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={suggestAltText}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {altResult && (
                <div className="space-y-2 rounded-lg border bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground">Suggested alt text</p>
                  <p data-testid="alt-suggestion" className="text-sm leading-relaxed">
                    {altResult}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={copyAlt} className="gap-1.5">
                      {altCopied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {altCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Review this suggestion, then paste it into the image's Alt Text field
                    in your Media Library. MATAYA won't save or change anything for you.
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === "meta" && (
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("chat")}
                className="-ml-2 gap-1 px-2 text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to chat
              </Button>
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">SEO meta description</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tell MATAYA about the page, and it will suggest a meta description for you
                to review. You paste it into this page's Meta Description field and save it
                yourself — MATAYA never publishes anything for you.
              </p>
              <Input
                value={pageTitle}
                onChange={(event) => setPageTitle(event.target.value)}
                placeholder="Page title (e.g. About Us)"
                aria-label="Page title"
              />
              <div>
                <Textarea
                  value={pageContent}
                  onChange={(event) => {
                    metaTouchedRef.current = true;
                    setPageContent(event.target.value);
                  }}
                  placeholder="Paste the page's text here (headings, paragraphs)"
                  aria-label="Page content"
                  rows={4}
                  className="resize-none"
                />
                {pageContext ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pre-filled from this page's settings — edit freely.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={suggestMetaDescription}
                disabled={!pageTitle.trim() || !pageContent.trim() || metaThinking}
                className="w-full gap-1.5"
              >
                {metaThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {metaThinking ? "Generating…" : "Suggest meta description"}
              </Button>
              {metaError && (
                <div role="alert" className="rounded-lg border border-destructive-border bg-background px-3 py-2 text-sm">
                  <p>{metaError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={suggestMetaDescription}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {metaResult && (
                <div className="space-y-2 rounded-lg border bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground">Suggested meta description</p>
                  <p data-testid="meta-suggestion" className="text-sm leading-relaxed">
                    {metaResult}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={copyMeta} className="gap-1.5">
                      {metaCopied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {metaCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Review this suggestion, then paste it into this page's Meta Description
                    field and save it yourself. MATAYA never publishes or saves anything
                    for you.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Composer / provider states */}
          {mode === "chat" && statusFailed && (
            <div className="border-t p-3">
              <p className="text-sm">MATAYA isn't available right now.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Something went wrong while checking the assistant. Please try again.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={runStatusCheck} className="mt-2">
                Try again
              </Button>
            </div>
          )}

          {mode === "chat" && !statusFailed && statusInfo === null && (
            <div
              role="status"
              className="flex items-center gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking MATAYA availability…
            </div>
          )}

          {mode === "chat" && !statusFailed && statusInfo !== null && !providerConfigured && (
            <div className="border-t p-3">
              <p className="text-sm font-medium">MATAYA isn't connected yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Your TAYA team hasn't connected the AI service for this dashboard yet.
                Nothing is broken — contact your support team and they can set it up.
              </p>
            </div>
          )}

          {mode === "chat" && providerConfigured && (
            <form
              className="flex items-end gap-2 border-t p-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onInputKeyDown}
                aria-label="Ask MATAYA"
                placeholder="Ask MATAYA for help with your website…"
                rows={2}
                className="max-h-32 flex-1 resize-none"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={thinking || !input.trim()}
              >
                {thinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </form>
          )}

          {/* Authority boundary — always visible. */}
          <p className="border-t px-3 py-1.5 text-[10px] leading-snug text-muted-foreground">
            Suggestions only — MATAYA never saves, publishes, or changes your website
            without you.
          </p>
        </div>
      )}
    </>
  );
}

export default AIAssistant;
