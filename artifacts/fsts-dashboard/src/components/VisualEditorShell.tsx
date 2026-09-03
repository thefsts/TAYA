/**
 * TAYA Visual Editor Shell
 *
 * A reusable WordPress-Customizer-style shell that shows the client's
 * actual website alongside editing controls. Clients SEE their site
 * while they EDIT it.
 *
 * Layout:
 *   Desktop  → split-pane (editor left | live preview right)
 *   Tablet   → resizable split-pane
 *   Mobile   → tab toggle (Edit | Preview)
 *
 * Features:
 *   - Live iframe preview of the actual client website
 *   - Responsive preview controls (desktop / tablet / mobile)
 *   - Refresh preview
 *   - Open live site in new tab
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
  History, Save, Upload, X, Eye, Pencil, Loader2, Circle,
} from "lucide-react";
import { Link } from "wouter";

/* ── Types ──────────────────────────────────────────────── */

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
 *   identify which editor section a preview element maps to.
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
  /** Module identifier for the click-to-edit bridge */
  moduleId?: string;
  /** Additional toolbar actions (e.g. "Add Service" button) */
  toolbarActions?: React.ReactNode;
};

/* ── Mobile detection hook ──────────────────────────────── */

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

/* ── Preview iframe with postMessage bridge ─────────────── */

type PreviewIframeProps = {
  url: string;
  breakpoint: Breakpoint;
  iframeKey: number;
  onElementClick?: (elementType: string, elementId?: string) => void;
};

function PreviewIframe({ url, breakpoint, iframeKey, onElementClick }: PreviewIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

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

  const bp = breakpoint;

  return (
    <div className="flex h-full items-start justify-center overflow-auto bg-slate-100 p-4">
      <div
        className="relative bg-white shadow-2xl ring-1 ring-slate-300 overflow-hidden transition-all duration-200"
        style={{
          width: bp.width,
          height: bp.height,
          maxWidth: "100%",
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
          className="block border-0"
          style={{ width: bp.width, height: bp.height }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

/* ── Bridge script injected into the preview iframe ─────── */
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
      if (el.getAttribute && el.getAttribute("data-taya-edit")) {
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

/* ── Action bar ─────────────────────────────────────────── */

type ActionBarProps = {
  isDirty: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onPublish?: () => void;
  onDiscard?: () => void;
  showPublish?: boolean;
  historyHref?: string;
};

function ActionBar({ isDirty, isSaving, onSave, onPublish, onDiscard, showPublish, historyHref }: ActionBarProps) {
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
          Save Draft
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

/* ── Preview toolbar ────────────────────────────────────── */

type PreviewToolbarProps = {
  breakpoint: BreakpointId;
  onBreakpointChange: (bp: BreakpointId) => void;
  onRefresh: () => void;
  liveUrl: string | null;
};

function PreviewToolbar({ breakpoint, onBreakpointChange, onRefresh, liveUrl }: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</span>

      {/* Breakpoint controls */}
      <div className="flex items-center gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200">
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

/* ── Main Visual Editor Shell ───────────────────────────── */

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

  const handleElementClick = useCallback((elementType: string, _elementId?: string) => {
    // In the future, this can scroll to / open the relevant editor section.
    // For now, we dispatch a custom event that editor pages can listen for.
    window.dispatchEvent(
      new CustomEvent("taya:edit-element", { detail: { elementType, moduleId } })
    );
  }, [moduleId]);

  /* ── Header ── */
  const header = (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
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
      <div className="flex flex-col">
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
          <div className="flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
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

  /* ── Desktop / Tablet: split-pane ── */
  return (
    <div className="flex flex-col">
      {header}
      <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-140px)]">
        {/* Editor panel */}
        <ResizablePanel defaultSize={isTablet ? 45 : 40} minSize={25} maxSize={70}>
          <div className="h-full overflow-y-auto bg-slate-50 p-4">
            {children}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Preview panel */}
        <ResizablePanel defaultSize={isTablet ? 55 : 60} minSize={30}>
          <div className="flex h-full flex-col">
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
