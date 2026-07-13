import { useState, useRef, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Laptop, Tablet, Smartphone, RotateCw, ZoomIn, ZoomOut, RefreshCw,
  Eye, EyeOff, Maximize2, Minimize2,
} from "lucide-react";

type Breakpoint = {
  id: string;
  label: string;
  icon: any;
  width: number;
  height: number;
};

const BREAKPOINTS: Breakpoint[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1920, height: 1080 },
  { id: "laptop", label: "Laptop", icon: Laptop, width: 1440, height: 900 },
  { id: "tablet-l", label: "Tablet", icon: Tablet, width: 1024, height: 768 },
  { id: "tablet-p", label: "Tablet ↑", icon: Tablet, width: 768, height: 1024 },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 390, height: 844 },
];

const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 1];

type Props = {
  siteId: string;
  children: React.ReactNode;
  section?: string;
};

export function LivePreviewPanel({ siteId, children, section }: Props) {
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });
  const [showPreview, setShowPreview] = useState(false);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(BREAKPOINTS[0]);
  const [zoom, setZoom] = useState(0.5);
  const [rotated, setRotated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const domain = site?.domain;
  const previewUrl = domain
    ? domain.startsWith("http")
      ? domain
      : `https://${domain}`
    : null;

  const w = rotated ? breakpoint.height : breakpoint.width;
  const h = rotated ? breakpoint.width : breakpoint.height;

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_LEVELS.indexOf(z);
      return ZOOM_LEVELS[Math.min(idx + 1, ZOOM_LEVELS.length - 1)];
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_LEVELS.indexOf(z);
      return ZOOM_LEVELS[Math.max(idx - 1, 0)];
    });
  }, []);

  const refresh = useCallback(() => setIframeKey((k) => k + 1), []);

  if (!showPreview) {
    return (
      <div className="space-y-0">
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Eye className="h-4 w-4" />
            Live Preview Studio™
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={expanded ? "fixed inset-0 z-50 bg-slate-900 flex flex-col" : "space-y-0"}>
      {/* Preview Toolbar */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${expanded ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200 rounded-t-lg mb-0"}`}>
        <span className={`text-xs font-semibold uppercase tracking-wide mr-2 ${expanded ? "text-slate-300" : "text-slate-500"}`}>
          Live Preview Studio™
        </span>

        <div className={`flex items-center gap-1 p-1 rounded-md ${expanded ? "bg-slate-700" : "bg-white border border-slate-200"}`}>
          {BREAKPOINTS.map((bp) => {
            const Icon = bp.icon;
            return (
              <button
                key={bp.id}
                onClick={() => { setBreakpoint(bp); setRotated(false); }}
                title={`${bp.label} (${bp.width}×${bp.height})`}
                className={`p-1.5 rounded transition-colors ${breakpoint.id === bp.id
                  ? "bg-primary text-white"
                  : expanded ? "text-slate-400 hover:text-white hover:bg-slate-600" : "text-slate-500 hover:bg-slate-100"
                  }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setRotated((r) => !r)}
          title="Rotate"
          className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className={`text-xs font-mono w-10 text-center ${expanded ? "text-slate-300" : "text-slate-600"}`}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}><ZoomIn className="h-3.5 w-3.5" /></button>
        </div>

        <button onClick={refresh} title="Refresh" className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}><RefreshCw className="h-3.5 w-3.5" /></button>

        <Badge variant="secondary" className="ml-1 text-[10px]">{breakpoint.label} {w}×{h}</Badge>

        <div className="flex-1" />

        <button
          onClick={() => setExpanded((e) => !e)}
          className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setShowPreview(false)}
          className={`p-1.5 rounded transition-colors ${expanded ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>

      {/* Split layout */}
      <div className={`flex ${expanded ? "flex-1 overflow-hidden" : "gap-6 mt-2"}`}>
        {/* Editor panel */}
        {!expanded && (
          <div className="flex-1 min-w-0">
            {children}
          </div>
        )}

        {/* Preview panel */}
        <div className={`${expanded ? "flex-1 bg-slate-900 overflow-auto p-6 flex items-start justify-center" : "w-96 flex-shrink-0"}`}>
          {!previewUrl ? (
            <div className="bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-8 text-center" style={{ minHeight: 300 }}>
              <div>
                <Eye className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No domain configured</p>
                <p className="text-xs text-slate-400 mt-1">Add your site domain in Site Settings to enable live preview</p>
              </div>
            </div>
          ) : (
            <div
              className="relative bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300"
              style={{
                width: Math.round(w * zoom),
                height: Math.round(h * zoom),
                flexShrink: 0,
              }}
            >
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                title={`Preview — ${breakpoint.label}`}
                style={{
                  width: w,
                  height: h,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  border: "none",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* If expanded, show editor at bottom */}
      {expanded && (
        <div className="h-80 bg-white border-t border-slate-700 overflow-y-auto p-6">
          {children}
        </div>
      )}
    </div>
  );
}
