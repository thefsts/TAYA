/**
 * TAYA Visual Editor Shell
 *
 * A reusable WordPress-Customizer-style shell that shows the client's
 * actual website alongside editing controls. Clients SEE their site
 * while they EDIT it.
 *
 * OWNER-APPROVED LAYOUT (Chat D — locked):
 *   Desktop  → compact editor rail (≈28–30% of usable width, left) +
 *              live preview consuming the remaining viewport (right).
 *              The preview FITS the workspace — it scales down large
 *              presets (1440×900) instead of clipping them at 1:1.
 *   Tablet   → resizable split, preview stays usable.
 *   Mobile   → tab toggle (Edit | Preview), never squeezed side-by-side.
 *
 * Features:
 *   - Live iframe preview of the actual client website (fit-to-workspace)
 *   - Responsive preview controls (desktop / tablet / mobile)
 *   - Refresh preview / open live site in new tab
 *   - Unsaved changes indicator
 *   - Save Draft / Publish / Discard action bar
 *   - Revision History link
 *   - postMessage click-to-edit bridge
 *
 * TAYA branding preserved: pink/magenta/violet surfaces.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Monitor, Tablet, Smartphone, RotateCw, ExternalLink,
  History, Save, Upload, X, Eye, Pencil, Loader2, Circle, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

/* ── Types ─────────────────────────────────────────────────────────── */

type BreakpointId = "desktop" | "tablet" | "mobile";

type Breakpoint = {
  id: BreakpointId;
  label: string;
  icon: typeof Monitor;
  width: number;
  height: number;
};

const BREAKPOINTS: Record<BreakpointId, Breakpoint> = {
  desktop: { id: "desktop", label: "Desktop", icon: Monitor, width: 1440, height: 900 },
  tablet: { id: "tablet", label: "Tablet", icon: Tablet, width: 768, height: 1024 },
  mobile: { id: "mobile", label: "Mobile", icon: Smartphone, width: 390, height: 844 },
};

/**
 * Props for the Visual Editor Shell.
 *
 * `children` is the editor controls panel (form fields, etc.).
 * `siteId` determines which website to preview.
 * `previewPath` is an optional path appended to the domain (e.g. "/services").
 * `isDirty` controls the unsaved-changes indicator.
 * `onSave` / `onPublish` / `onDiscard` are the action bar handlers.
 * `isSaving` disables buttons during async operations.
 * `historyHref` is the revision history link.
 * `moduleId` / `entityType` are used by the click-to-edit bridge to
 * identify which editor section a preview element maps to.
 */
type VisualEditorShellProps = {
  siteId: string;
  children: React.ReactNode;
  /** Path to append to the site domain for the preview URL */
  previewPath?: string;
  /** Page/module title shown in the shell header */
  title: string;
  /** Optional subtitle / description */
  subtitle?: string;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Save Draft handler */
  onSave?: () => void;
  /** Publish / Update handler */
  onPublish?: () => void;
  /** Discard / Cancel handler */
  onDiscard?: () => void;
  /** Whether a save/publish operation is in progress */
  isSaving?: boolean;
  /** Revision history route (e.g. "/app/sites/:siteId/history") */
  historyHref?: string;
  /** Whether to show the Publish button (some modules are draft-only) */
  showPublish?: boolean;
  /**
   * Label for the save button. Defaults to "Save Draft" (collection editors
   * with a draft stage). Singleton modules whose content is published to the
   * live site as soon as it is saved (e.g. Announcement, Popup, CTA, Policy)
   * should pass a label like "Save Changes".
   */
  saveLabel?: string;
  /** Module identifier for the click-to-edit bridge */
  moduleId?: string;
  /** Additional toolbar actions (e.g. "Add Service" button) */
  toolbarActions?: React.ReactNode;
};

/* ── Mobile detection hook ─────────────────────────────────────────── */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => setIsTablet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isTablet;
}

/* ── Fit-to-workspace preview sizing ───────────────────────────────── */

/**
 * OWNER-APPROVED (Chat D): the preview shows as much real website as the
 * workspace allows — never a 1:1 1440px sheet clipped into a narrow pane,
 * never tiny with dead margins around it.
 *
 * Strategy (fit, not 1:1):
 *   1. "Fit width" — the frame takes the full workspace width and the
 *      height follows the preset's aspect ratio (desktop 1440:900 = 16:10).
 *      This is the default for desktop/tablet presets and for the mobile
 *      preset on narrow screens.
 *   2. "Fit height" — when the workspace is wide and short, the frame is
 *      height-bound: height = workspace height, width = height × aspect,
 *      centered horizontally.
 * The frame always renders the FULL preset width inside a transform-scaled
 * wrapper, so the site keeps its real desktop/tablet/mobile layout (real
 * media queries fire) and simply scales to fit — zoom-out, never crop.
 */
function useFitPreview(
  containerRef: React.RefObject<HTMLDivElement | null>,
  breakpoint: BreakpointId,
) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const bp = BREAKPOINTS[breakpoint];
  const aspect = bp.width / bp.height;

  if (!box || box.width <= 0 || box.height <= 0) {
    return { frameWidth: 0, frameHeight: 0, scale: 1 };
  }

  // Candidate A: fill the workspace width, height follows the aspect.
  const byWidth = { width: box.width, height: box.width / aspect };
  // Candidate B: fill the workspace height, width follows the aspect.
  const byHeight = { width: box.height * aspect, height: box.height };

  // Pick the candidate that fits BOTH dimensions (contain).
  const fit =
    byWidth.height <= box.height
      ? byWidth
      : byHeight;

  // Desktop (landscape) preset: scale fills the width; the frame's visual
  // height extends to the FULL workspace so the preview consumes all
  // available height — no dead band under a 16:10 preset in a taller
  // workspace (owner-approved layout, Chat D). Viewport WIDTH keeps the
  // preset exactly (width media queries stay desktop-true); the extended
  // height only shows more of the internally scrolling page.
  const frameHeight =
    breakpoint === "desktop" ? box.height : fit.height;

  const scale = fit.width / bp.width;
  return { frameWidth: fit.width, frameHeight, scale };
}

/* ── Preview iframe with postMessage bridge ────────────────────────── */

type PreviewIframeProps = {
  url: string;
  breakpoint: Breakpoint;
  iframeKey: number;
  onElementClick?: (elementType: string, elementId?: string) => void;
};

function PreviewIframe({ url, breakpoint, iframeKey, onElementClick }: PreviewIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const { frameWidth, frameHeight, scale } = useFitPreview(stageRef, breakpoint.id);
  const bp = BREAKPOINTS[breakpoint.id];
  // Desktop preset extends its logical height to fill the workspace (see
  // useFitPreview) — the iframe renders that taller viewport instead of the
  // 16:10 preset height.
  const logicalHeight =
    breakpoint.id === "desktop" && frameWidth > 0
      ? Math.round((frameHeight / frameWidth) * bp.width)
      : bp.height;

  // Listen for postMessage from the iframe (click-to-edit bridge)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from the same origin (the preview URL)
      try {
        const origin = new URL(url).origin;
        if (event.origin !== origin) return;
      } catch {
        return;
      }
      if (event.data?.type === "taya:element-click" && onElementClick) {
        onElementClick(event.data.elementType, event.data.elementId);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [url, onElementClick]);

  // Inject the click-to-edit bridge script once the iframe loads.
  // This adds hover highlights and sends postMessage on click.
  // It's safe: only runs same-origin, only highlights elements with
  // data-taya-edit attributes, and is non-destructive.
  const handleLoad = useCallback(() => {
    setLoaded(true);
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return; // cross-origin — can't inject, preview still works
      // Inject minimal bridge script
      const script = doc.createElement("script");
      script.textContent = BRIDGE_SCRIPT;
      doc.body.appendChild(script);
      // Inject highlight styles
      const style = doc.createElement("style");
      style.textContent = BRIDGE_STYLES;
      doc.head.appendChild(style);
    } catch {
      // Cross-origin — preview still renders, just no click-to-edit
    }
  }, []);

  return (
    <div
      ref={stageRef}
      className="flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-slate-100"
    >
      <div
        className="relative bg-white shadow-2xl ring-1 ring-slate-300 overflow-hidden"
        style={{
          width: frameWidth || "100%",
          height: frameHeight || (frameWidth || 0) / (bp.width / bp.height),
          flexShrink: 0,
        }}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">Loading preview…</span>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={url}
          onLoad={handleLoad}
          title={`Preview — ${bp.label}`}
          className="block border-0 origin-top-left"
          style={{
            width: bp.width,
            height: logicalHeight,
            transform: `scale(${scale || 1})`,
          }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

/* ── Bridge script injected into the preview iframe ────────────────── */
// This script runs inside the client website's iframe. It:
// 1. Finds elements with [data-taya-edit] attributes
// 2. Adds hover highlight
// 3. On click, sends a postMessage to the parent (editor) with the element type/ID
// 4. Prevents navigation (so clicks don't leave the preview)
const BRIDGE_SCRIPT = `
(function() {
  "use strict";
  function send(type, id) {
    try {
      window.parent.postMessage({ type: "taya:element-click", elementType: type, elementId: id }, "*");
    } catch(e) {}
  }
  document.addEventListener("click", function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      var attr = el.getAttribute && el.getAttribute("data-taya-edit");
      if (attr) {
        e.preventDefault();
        e.stopPropagation();
        var id = el.getAttribute("data-taya-id") || "";
        send(attr, id);
        el.classList.add("taya-edit-flash");
        setTimeout(function() { el.classList.remove("taya-edit-flash"); }, 600);
        return;
      }
      el = el.parentElement;
    }
  }, true);
  document.addEventListener("mouseover", function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-taya-edit")) {
        el.classList.add("taya-edit-hover");
        break;
      }
      el = el.parentElement;
    }
  });
  document.addEventListener("mouseout", function(e) {
    var el = e.target;
    while (el && el !== document.body) {
      if ( el.getAttribute && el.getAttribute("data-taya-edit")) {
        el.classList.remove("taya-edit-hover");
        break;
      }
      el = el.parentElement;
    }
  });
})();
`;

const BRIDGE_STYLES = `
[data-taya-edit] { cursor: pointer !important; position: relative; }
.taya-edit-hover { outline: 2px solid #ec4899 !important; outline-offset: 2px !important; }
.taya-edit-flash { outline: 3px solid #8b5cf6 !important; outline-offset: 2px !important; }
`;

/* ── Action bar ────────────────────────────────────────────────────── */

type ActionBarProps = {
  isDirty: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onPublish?: () => void;
  onDiscard?: () => void;
  showPublish?: boolean;
  saveLabel?: string;
  historyHref?: string;
};

function ActionBar({ isDirty, isSaving, onSave, onPublish, onDiscard, showPublish, saveLabel, historyHref }: ActionBarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Unsaved changes indicator */}
      {isDirty && (
        <div className="flex items-center gap-1.5 mr-2 text-amber-600">
          <Circle className="h-2.5 w-2.5 fill-amber-500 text-amber-500 animate-pulse" />
          <span className="text-xs font-medium">Unsaved changes</span>
        </div>
      )}

      {historyHref && (
        <Link href={historyHref}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <History className="mr-1.5 h-4 w-4" />
            History
          </Button>
        </Link>
      )}

      {onDiscard && (
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!isDirty || isSaving}>
          <X className="mr-1.5 h-4 w-4" />
          Discard
        </Button>
      )}

      {onSave && (
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {saveLabel ?? "Save Draft"}
        </Button>
      )}

      {showPublish && onPublish && (
        <Button size="sm" onClick={onPublish} disabled={isSaving} className="bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-700 hover:to-violet-700 text-white">
          {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          Publish
        </Button>
      )}
    </div>
  );
}

/* ── Compact single-row toolbar (owner-approved) ───────────────────── */

type PreviewToolbarProps = {
  breakpoint: BreakpointId;
  onBreakpointChange: (bp: BreakpointId) => void;
  onRefresh: () => void;
  liveUrl: string | null;
  /** Back-to-dashboard href (owner-approved chrome, first control) */
  backHref?: string;
  /** Editor context label (e.g. "Website Editor") */
  editorContext?: string;
};

function PreviewToolbar({ breakpoint, onBreakpointChange, onRefresh, liveUrl, backHref, editorContext }: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
      {backHref && (
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </Link>
      )}
      {editorContext && (
        <span className="hidden truncate text-sm font-semibold text-slate-900 sm:block">
          {editorContext}
        </span>
      )}

      <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Preview</span>
      {/* Honest label: the preview pane shows the LIVE published site. */}
      <Badge variant="outline" className="border-green-200 bg-green-50 text-[10px] font-medium text-green-700">
        Live site
      </Badge>

      {/* Breakpoint controls */}
      <div className="flex items-center gap-0.5 rounded-md bg-slate-50 p-0.5 ring-1 ring-slate-200">
        {(Object.keys(BREAKPOINTS) as BreakpointId[]).map((id) => {
          const bp = BREAKPOINTS[id];
          const Icon = bp.icon;
          return (
            <button
              key={id}
              onClick={() => onBreakpointChange(id)}
              title={`${bp.label} (${bp.width}×${bp.height})`}
              className={`rounded p-1.5 transition-colors ${
                breakpoint === id
                  ? "bg-pink-600 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>

      <Badge variant="secondary" className="ml-1 text-[10px] tabular-nums">
        {BREAKPOINTS[breakpoint].width}×{BREAKPOINTS[breakpoint].height}
      </Badge>

      <div className="flex-1" />

      <button
        onClick={onRefresh}
        title="Refresh preview"
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </button>

      {liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open live site"
          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/* ── Main Visual Editor Shell ──────────────────────────────────────── */

export function VisualEditorShell({
  siteId,
  children,
  previewPath,
  title,
  subtitle,
  isDirty,
  onSave,
  onPublish,
  onDiscard,
  isSaving,
  historyHref,
  showPublish = true,
  saveLabel,
  moduleId,
  toolbarActions,
}: VisualEditorShellProps) {
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const [breakpoint, setBreakpoint] = useState<BreakpointId>("desktop");
  const [iframeKey, setIframeKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  // Build the preview URL from the site domain + optional path
  const domain = site?.domain;
  const baseUrl = useMemo(() => {
    if (!domain) return null;
    const base = domain.startsWith("http") ? domain : `https://${domain}`;
    return base;
  }, [domain]);

  const previewUrl = useMemo(() => {
    if (!baseUrl) return null;
    if (previewPath) return `${baseUrl}${previewPath}`;
    return baseUrl;
  }, [baseUrl, previewPath]);

  const refresh = useCallback(() => setIframeKey((k) => k + 1), []);

  // A completed save should be reflected in the preview. Clients expect the
  // WordPress-Customizer loop: edit → Save Draft → the preview updates. The
  // preview shows the live published site, so after a save completes we bump
  // the iframe key to force a fresh load (same-origin external sites may also
  // cache aggressively). We detect "save finished" by watching isSaving go
  // true → false.
  const wasSavingRef = useRef(false);
  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      // A save just completed — refresh the preview so the client sees it.
      refresh();
    }
    wasSavingRef.current = !!isSaving;
  }, [isSaving, refresh]);

  const handleElementClick = useCallback((elementType: string, _elementId?: string) => {
    // In the future, this can scroll to / open the relevant editor section.
    // For now, we dispatch a custom event that editor pages can listen for.
    window.dispatchEvent(
      new CustomEvent("taya:edit-element", { detail: { elementType, moduleId } })
    );
  }, [moduleId]);

  /* ── Header (compact, single row — title + actions only) ── */
  const header = (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {toolbarActions}
        <ActionBar
          isDirty={isDirty}
          isSaving={isSaving}
          onSave={onSave}
          onPublish={onPublish}
          onDiscard={onDiscard}
          showPublish={showPublish}
          saveLabel={saveLabel}
          historyHref={historyHref}
        />
      </div>
    </div>
  );

  /* ── No domain fallback ── */
  if (!previewUrl) {
    return (
      <div className="space-y-0">
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">{children}</div>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <div>
              <Eye className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No domain configured</p>
              <p className="mt-1 text-xs text-slate-400">
                Add your site domain in Site Settings to enable the live visual preview.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Mobile: tab toggle ── */
  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "edit" | "preview")}>
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-slate-200 bg-white">
            <TabsTrigger value="edit" className="flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Preview
              {isDirty && <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mobileTab === "edit" ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {children}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <PreviewToolbar
              breakpoint={breakpoint}
              onBreakpointChange={setBreakpoint}
              onRefresh={refresh}
              liveUrl={baseUrl}
            />
            <PreviewIframe
              url={previewUrl}
              breakpoint={BREAKPOINTS[breakpoint]}
              iframeKey={iframeKey}
              onElementClick={handleElementClick}
            />
          </div>
        )}
      </div>
    );
  }

  /* ── Desktop / Tablet: split-pane (owner-approved: rail ≈28–30%, preview fills the rest) ── */
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        {/* Editor panel — compact rail */}
        <ResizablePanel defaultSize={isTablet ? 42 : 29} minSize={22} maxSize={55}>
          <div className="h-full overflow-y-auto bg-slate-50 p-3">
            {children}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Preview panel — consumes the remaining viewport */}
        <ResizablePanel defaultSize={isTablet ? 58 : 71} minSize={38}>
          <div className="flex h-full min-h-0 flex-col">
            <PreviewToolbar
              breakpoint={breakpoint}
              onBreakpointChange={setBreakpoint}
              onRefresh={refresh}
              liveUrl={baseUrl}
            />
            <PreviewIframe
              url={previewUrl}
              breakpoint={BREAKPOINTS[breakpoint]}
              iframeKey={iframeKey}
              onElementClick={handleElementClick}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default VisualEditorShell;
