/**
 * SmartImageEditor — full-featured image editor with canvas crop,
 * focal point picker, aspect ratio presets, and responsive previews.
 *
 * `SmartImageUploader` is re-exported as an alias so existing call sites
 * don't need to change.
 */

import {
  useState, useRef, useCallback, useEffect, useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload, Image as ImageIcon, AlertTriangle, CheckCircle2, Sparkles,
  RotateCcw, FlipHorizontal, Sun, Contrast, Droplets, Crop, X,
  FileImage, Monitor, Tablet, Smartphone, Crosshair, Wand2,
  FlipVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ASPECT_PRESETS, SITE_PRESETS, type AspectPreset } from "@/config/imagePresets";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const WARN_SIZE_BYTES = 1 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function scoreResolution(w: number, h: number): { score: number; label: string } {
  const mp = (w * h) / 1_000_000;
  if (mp >= 2) return { score: 100, label: "Excellent" };
  if (mp >= 0.5) return { score: 75, label: "Good" };
  if (mp >= 0.1) return { score: 50, label: "Low" };
  return { score: 25, label: "Very low" };
}

// ---------------------------------------------------------------------------
// Crop descriptor
// ---------------------------------------------------------------------------

export type CropDescriptor = {
  /** Left edge in original-image pixels */
  x: number;
  /** Top edge in original-image pixels */
  y: number;
  /** Width in original-image pixels */
  width: number;
  /** Height in original-image pixels */
  height: number;
};

// ---------------------------------------------------------------------------
// Image processing
// ---------------------------------------------------------------------------

async function applyEdits(
  file: File,
  opts: {
    rotation: number;
    flipH: boolean;
    flipV: boolean;
    brightness: number;
    contrast: number;
    saturation: number;
    crop?: CropDescriptor | null;
  },
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { rotation, flipH, flipV, brightness, contrast, saturation, crop } = opts;

      // Source region (apply crop in original image space)
      const sx = crop ? Math.max(0, crop.x) : 0;
      const sy = crop ? Math.max(0, crop.y) : 0;
      const sw = crop ? Math.min(crop.width, img.width - sx) : img.width;
      const sh = crop ? Math.min(crop.height, img.height - sy) : img.height;

      const radians = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const rotW = Math.round(sw * cos + sh * sin);
      const rotH = Math.round(sw * sin + sh * cos);

      const maxW = 2400;
      const scale = Math.min(1, maxW / rotW);
      const canvasW = Math.round(rotW * scale);
      const canvasH = Math.round(rotH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d")!;

      // Draw cropped + rotated + flipped region
      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      if (flipH) ctx.scale(-1, 1);
      if (flipV) ctx.scale(1, -1);
      ctx.rotate(radians);
      const drawScale = Math.min(canvasW / sw, canvasH / sh);
      ctx.drawImage(img, sx, sy, sw, sh, (-sw * drawScale) / 2, (-sh * drawScale) / 2, sw * drawScale, sh * drawScale);
      ctx.restore();

      // Brightness/contrast/saturation via filter — apply on a second pass
      const out = document.createElement("canvas");
      out.width = canvasW;
      out.height = canvasH;
      const octx = out.getContext("2d")!;
      octx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      octx.drawImage(canvas, 0, 0);

      out.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas apply failed")); return; }
          resolve({ blob, width: canvasW, height: canvasH });
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

/** Convenience wrapper — compresses without any edits or crop. */
async function compressToWebP(
  file: File,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  return applyEdits(file, { rotation: 0, flipH: false, flipV: false, brightness: 100, contrast: 100, saturation: 100 }, quality);
}

// ---------------------------------------------------------------------------
// CropCanvas
// ---------------------------------------------------------------------------

type CropCanvasProps = {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  aspectRatio: number | null;
  onCropChange: (crop: CropDescriptor) => void;
  focalX: number;
  focalY: number;
  onFocalChange: (x: number, y: number) => void;
};

const CROP_MAX_H = 300;

function CropCanvas({
  src, naturalWidth, naturalHeight, aspectRatio,
  onCropChange, focalX, focalY, onFocalChange,
}: CropCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [availableW, setAvailableW] = useState(420);

  // Pan: offset of image top-left relative to container top-left, in CSS px
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  // Zoom: scale applied to the natural image
  const [zoom, setZoom] = useState(1);

  const dragRef = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null);
  const didDragRef = useRef(false);

  // Measure available width from the parent wrapper
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailableW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute frame dimensions that exactly match what will be rendered.
  // Rule: maintain the selected aspect ratio; cap height at CROP_MAX_H.
  // For portrait ratios that would exceed CROP_MAX_H, also reduce width.
  let frameW = availableW;
  let frameH = aspectRatio ? Math.round(frameW / aspectRatio) : CROP_MAX_H;
  if (frameH > CROP_MAX_H) {
    frameH = CROP_MAX_H;
    if (aspectRatio) frameW = Math.round(frameH * aspectRatio);
  }

  // Compute minimum zoom so image always covers the frame
  const minZoom = Math.max(frameW / naturalWidth, frameH / naturalHeight);

  // Clamp helper
  const clamp = useCallback((ox: number, oy: number, z: number) => {
    const imgW = naturalWidth * z;
    const imgH = naturalHeight * z;
    const minX = frameW - imgW;
    const minY = frameH - imgH;
    return {
      x: Math.min(0, Math.max(minX, ox)),
      y: Math.min(0, Math.max(minY, oy)),
    };
  }, [naturalWidth, naturalHeight, frameW, frameH]);

  // Initialize/reset zoom & centering when src or frame changes
  useEffect(() => {
    const z = Math.max(minZoom, 1);
    const imgW = naturalWidth * z;
    const imgH = naturalHeight * z;
    const ox = (frameW - imgW) / 2;
    const oy = (frameH - imgH) / 2;
    const clamped = clamp(ox, oy, z);
    setZoom(z);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  }, [src, frameW, frameH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit crop whenever transform changes
  useEffect(() => {
    const cropX = (-offsetX) / zoom;
    const cropY = (-offsetY) / zoom;
    const cropW = frameW / zoom;
    const cropH = frameH / zoom;
    onCropChange({
      x: Math.round(Math.max(0, cropX)),
      y: Math.round(Math.max(0, cropY)),
      width: Math.round(Math.min(cropW, naturalWidth - Math.max(0, cropX))),
      height: Math.round(Math.min(cropH, naturalHeight - Math.max(0, cropY))),
    });
  }, [offsetX, offsetY, zoom, frameW, frameH, naturalWidth, naturalHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer drag
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    didDragRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offsetX,
      startOffY: offsetY,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    const { x, y } = clamp(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, zoom);
    setOffsetX(x);
    setOffsetY(y);
  };

  const onPointerUp = () => { dragRef.current = null; };

  // Wheel zoom
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.max(minZoom, Math.min(4, zoom + delta * zoom));

    // Zoom toward cursor
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const newOffX = cx - (cx - offsetX) * (newZoom / zoom);
    const newOffY = cy - (cy - offsetY) * (newZoom / zoom);
    const { x, y } = clamp(newOffX, newOffY, newZoom);
    setZoom(newZoom);
    setOffsetX(x);
    setOffsetY(y);
  };

  // Click to set focal point — only when pointer didn't drag
  const onFocalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = (e.clientX - rect.left) / frameW;
    const py = (e.clientY - rect.top) / frameH;

    // Convert frame-relative position to original-image normalized position
    const cropX = (-offsetX) / zoom;
    const cropY = (-offsetY) / zoom;
    const cropW = frameW / zoom;
    const cropH = frameH / zoom;
    const imgNX = (cropX + px * cropW) / naturalWidth;
    const imgNY = (cropY + py * cropH) / naturalHeight;
    onFocalChange(Math.max(0, Math.min(1, imgNX)), Math.max(0, Math.min(1, imgNY)));
  };

  // Focal point position within the visible frame (0–1 of frame)
  const cropX = (-offsetX) / zoom;
  const cropY = (-offsetY) / zoom;
  const cropW = frameW / zoom;
  const cropH = frameH / zoom;
  const focalFrameX = ((focalX * naturalWidth) - cropX) / cropW;
  const focalFrameY = ((focalY * naturalHeight) - cropY) / cropH;
  const focalVisible = focalFrameX >= 0 && focalFrameX <= 1 && focalFrameY >= 0 && focalFrameY <= 1;

  return (
    // Outer wrapper: full-width, invisible — only used to measure available width
    <div ref={wrapperRef} className="w-full flex justify-center">
    <div
      style={{ width: frameW, height: frameH }}
      className="relative overflow-hidden rounded-lg border-2 border-primary/40 bg-slate-900 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onClick={onFocalClick}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: naturalWidth * zoom,
          height: naturalHeight * zoom,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      {/* Rule-of-thirds grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.3)" }}>
        {[1, 2].map((i) => (
          <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${(i / 3) * 100}%` }} />
        ))}
        {[1, 2].map((i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/20" style={{ top: `${(i / 3) * 100}%` }} />
        ))}
      </div>
      {/* Focal point crosshair */}
      {focalVisible && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${focalFrameX * 100}%`,
            top: `${focalFrameY * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="relative">
            <div className="absolute w-6 h-px bg-white/90 shadow" style={{ left: -12, top: 0 }} />
            <div className="absolute h-6 w-px bg-white/90 shadow" style={{ top: -12, left: 0 }} />
            <div className="w-3 h-3 rounded-full border-2 border-white/90 bg-primary/60 shadow" style={{ marginLeft: -6, marginTop: -6 }} />
          </div>
        </div>
      )}
      {/* Hint */}
      <div className="absolute bottom-1.5 right-2 text-[10px] text-white/50 pointer-events-none">
        drag to pan · scroll to zoom · click to set focal point
      </div>
    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsive preview strip
// ---------------------------------------------------------------------------

const PREVIEW_VIEWPORTS = [
  { label: "Desktop", icon: Monitor, width: 1200, displayW: 220 },
  { label: "Tablet",  icon: Tablet,  width: 768,  displayW: 160 },
  { label: "Mobile",  icon: Smartphone, width: 375, displayW: 100 },
] as const;

function ResponsivePreviewStrip({
  src, cropDescriptor, focalX, focalY, naturalWidth, naturalHeight,
}: {
  src: string;
  cropDescriptor: CropDescriptor | null;
  focalX: number;
  focalY: number;
  naturalWidth: number;
  naturalHeight: number;
}) {
  if (!src) return null;

  // Focal point in crop-relative coordinates (0-1 within the crop rect)
  let focalXInCrop = focalX;
  let focalYInCrop = focalY;
  if (cropDescriptor && naturalWidth && naturalHeight) {
    const { x, y, width, height } = cropDescriptor;
    focalXInCrop = Math.max(0, Math.min(1, (focalX * naturalWidth - x) / width));
    focalYInCrop = Math.max(0, Math.min(1, (focalY * naturalHeight - y) / height));
  }

  const objectPosition = `${Math.round(focalXInCrop * 100)}% ${Math.round(focalYInCrop * 100)}%`;

  // Crop background shorthand for showing the cropped region
  const cropAspect = cropDescriptor && cropDescriptor.height > 0
    ? cropDescriptor.width / cropDescriptor.height
    : naturalWidth / naturalHeight;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
        <Monitor className="h-3.5 w-3.5" /> Responsive Preview
      </p>
      <div className="flex gap-3 items-end">
        {PREVIEW_VIEWPORTS.map(({ label, icon: Icon, displayW }) => {
          const displayH = Math.round(displayW / cropAspect);
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className="rounded overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0"
                style={{ width: displayW, height: Math.min(displayH, 120) }}
              >
                <img
                  src={src}
                  alt={label}
                  className="w-full h-full object-cover"
                  style={{ objectPosition }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Icon className="h-3 w-3" /> {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImageQualityReport = {
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
  resolutionScore: number;
  resolutionLabel: string;
  compressionSavings: number;
  hasAltText: boolean;
  seoScore: number;
  performanceScore: number;
};

type Props = {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    storageId?: string;
    url?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    optimizedSizeBytes?: number;
    width?: number;
    height?: number;
    altText?: string;
    focalX?: number;
    focalY?: number;
  }) => Promise<void>;
  context?: string;
  title?: string;
  /** Pre-select an aspect-ratio preset when the editor opens */
  initialPreset?: AspectPreset;
  /** AI assist hook — currently a stub; will be wired in a future task */
  onAIAssist?: () => void;
};

// ---------------------------------------------------------------------------
// SmartImageEditor
// ---------------------------------------------------------------------------

export function SmartImageEditor({
  siteId, open, onClose, onSave, context, title = "Smart Image Manager™", initialPreset, onAIAssist,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateAltText = useAction(api.ai.generateAltText);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [altText, setAltText] = useState("");
  const [urlOverride, setUrlOverride] = useState("");
  const [tab, setTab] = useState<"upload" | "edit" | "report" | "url">("upload");
  const [isPending, setIsPending] = useState(false);
  const [isGeneratingAlt, setIsGeneratingAlt] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [quality, setQuality] = useState<"max" | "high" | "balanced">("high");

  // Editor state
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Crop + focal point
  const [cropDescriptor, setCropDescriptor] = useState<CropDescriptor | null>(null);
  const [focalX, setFocalX] = useState(0.5);
  const [focalY, setFocalY] = useState(0.5);

  // Aspect ratio
  const [activePreset, setActivePreset] = useState<AspectPreset>(initialPreset ?? ASPECT_PRESETS[0]);

  // Quality report
  const [report, setReport] = useState<ImageQualityReport | null>(null);
  const [optimizedBlob, setOptimizedBlob] = useState<Blob | null>(null);

  const qualityValue = quality === "max" ? 0.95 : quality === "high" ? 0.82 : 0.65;

  const resetEditorState = () => {
    setRotation(0); setFlipH(false); setFlipV(false);
    setBrightness(100); setContrast(100); setSaturation(100);
    setCropDescriptor(null); setFocalX(0.5); setFocalY(0.5);
    setActivePreset(initialPreset ?? ASPECT_PRESETS[0]);
  };

  const handleFileSelect = useCallback(async (f: File) => {
    if (f.size > MAX_SIZE_BYTES) {
      toast({ title: "File too large", description: `Maximum file size is ${MAX_SIZE_MB}MB. Please optimize it first.`, variant: "destructive" });
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    // Load natural dimensions
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;

    setTab("edit");
    resetEditorState();

    setIsOptimizing(true);
    try {
      const { blob, width, height } = await compressToWebP(f, qualityValue);
      setOptimizedBlob(blob);
      const res = scoreResolution(width, height);
      const savings = Math.round(((f.size - blob.size) / f.size) * 100);
      const seoScore = altText ? 90 : 60;
      const perfScore = blob.size < 200 * 1024 ? 95 : blob.size < 500 * 1024 ? 80 : blob.size < 1024 * 1024 ? 65 : 40;
      setReport({
        originalSize: f.size, optimizedSize: blob.size,
        width, height,
        resolutionScore: res.score, resolutionLabel: res.label,
        compressionSavings: savings,
        hasAltText: !!altText,
        seoScore, performanceScore: perfScore,
      });
    } catch (err) {
      toast({ title: "Optimization failed", description: String(err), variant: "destructive" });
    } finally {
      setIsOptimizing(false);
    }
  }, [qualityValue, altText, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleOptimize = async () => {
    if (!file) return;
    setIsOptimizing(true);
    try {
      const { blob, width, height } = await applyEdits(
        file,
        { rotation, flipH, flipV, brightness, contrast, saturation, crop: cropDescriptor },
        qualityValue,
      );
      setOptimizedBlob(blob);
      const res = scoreResolution(width, height);
      const savings = Math.round(((file.size - blob.size) / file.size) * 100);
      setReport((r) => r ? {
        ...r, optimizedSize: blob.size, width, height,
        resolutionScore: res.score, resolutionLabel: res.label,
        compressionSavings: savings,
      } : r);
      toast({ title: "Image optimized", description: `Compressed to WebP — ${formatBytes(blob.size)}` });
    } catch (err) {
      toast({ title: "Optimization failed", description: String(err), variant: "destructive" });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateAlt = async () => {
    if (!previewUrl && !urlOverride) return;
    setIsGeneratingAlt(true);
    try {
      const imageUrl = urlOverride || previewUrl || "";
      if (imageUrl.startsWith("blob:")) {
        toast({ title: "Alt text suggestion", description: "Describe what's in this image for accessibility and SEO." });
      } else {
        const { altText: generated } = await generateAltText({ siteId: siteId as Id<"sites">, imageUrl, context });
        setAltText(generated);
        toast({ title: "Alt text generated", description: "Review and adjust as needed." });
      }
    } catch {
      toast({ title: "Couldn't generate alt text", description: "Please write a description manually.", variant: "destructive" });
    } finally {
      setIsGeneratingAlt(false);
    }
  };

  const handleSave = async () => {
    if (!file && !urlOverride) return;
    setIsPending(true);
    try {
      if (urlOverride) {
        await onSave({
          url: urlOverride,
          fileName: urlOverride.split("/").pop() ?? "image",
          mimeType: "image/jpeg",
          sizeBytes: 0,
          altText: altText || undefined,
          focalX, focalY,
        });
      } else if (file && optimizedBlob) {
        const uploadUrl = await generateUploadUrl({ siteId: siteId as Id<"sites"> });
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: optimizedBlob,
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
        const { storageId } = await response.json() as { storageId: string };
        await onSave({
          storageId,
          fileName: file.name.replace(/\.[^.]+$/, ".webp"),
          mimeType: "image/webp",
          sizeBytes: file.size,
          optimizedSizeBytes: optimizedBlob.size,
          width: report?.width,
          height: report?.height,
          altText: altText || undefined,
          focalX, focalY,
        });
      }
      handleClose();
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleClose = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setOptimizedBlob(null); setReport(null);
    setAltText(""); setUrlOverride(""); setTab("upload");
    setNaturalSize({ w: 0, h: 0 });
    resetEditorState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 flex-shrink-0">
          {[
            { id: "upload", label: "Upload" },
            { id: "url",    label: "URL" },
            { id: "edit",   label: "Edit & Crop", disabled: !file },
            { id: "report", label: "Quality Report", disabled: !report },
          ].map(({ id, label, disabled }) => (
            <button
              key={id}
              disabled={disabled}
              onClick={() => !disabled && setTab(id as "upload" | "url" | "edit" | "report")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-0">

          {/* ── Upload tab ── */}
          {tab === "upload" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-700">Drop an image here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP, GIF — max {MAX_SIZE_MB}MB</p>
              <p className="text-xs text-slate-400">Will be auto-converted to optimized WebP</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              <Button size="sm" variant="outline" className="mt-4"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <FileImage className="h-4 w-4 mr-2" /> Choose File
              </Button>
            </div>
          )}

          {/* ── URL tab ── */}
          {tab === "url" && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input aria-label="Image URL" placeholder="https://example.com/image.jpg" value={urlOverride}
                  onChange={(e) => setUrlOverride(e.target.value)} />
              </div>
              {urlOverride && (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <img src={urlOverride} alt="Preview" className="max-h-60 max-w-full object-contain"
                    onError={() => toast({ title: "Invalid image URL", variant: "destructive" })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Alt Text</Label>
                <div className="flex gap-2">
                  <Input aria-label="Alt Text" placeholder="Describe the image…" value={altText} onChange={(e) => setAltText(e.target.value)} />
                  <Button type="button" size="sm" variant="outline"
                    onClick={handleGenerateAlt}
                    disabled={!urlOverride || isGeneratingAlt}
                    className="whitespace-nowrap">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isGeneratingAlt ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit tab ── */}
          {tab === "edit" && file && previewUrl && naturalSize.w > 0 && (
            <div className="space-y-4">

              {/* Aspect ratio presets */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Aspect Ratio</p>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setActivePreset(preset)}
                      className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${activePreset.label === preset.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SITE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setActivePreset(preset)}
                      className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${activePreset.label === preset.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {preset.label}
                      {preset.width && <span className="text-[9px] ml-1 opacity-60">{preset.width}×{preset.height}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crop canvas */}
              <CropCanvas
                src={previewUrl}
                naturalWidth={naturalSize.w}
                naturalHeight={naturalSize.h}
                aspectRatio={activePreset.ratio ?? null}
                onCropChange={setCropDescriptor}
                focalX={focalX}
                focalY={focalY}
                onFocalChange={(x, y) => { setFocalX(x); setFocalY(y); }}
              />

              {/* Focal point indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <Crosshair className="h-3.5 w-3.5 text-primary" />
                <span>Focal point: <span className="font-mono text-slate-700">{Math.round(focalX * 100)}% / {Math.round(focalY * 100)}%</span></span>
                <button
                  className="ml-auto text-slate-400 hover:text-slate-600 text-[10px]"
                  onClick={() => { setFocalX(0.5); setFocalY(0.5); }}>
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left: controls */}
                <div className="space-y-3">
                  {/* Rotation / flip */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rotate L
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5 scale-x-[-1]" /> Rotate R
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setFlipH((f) => !f)}>
                      <FlipHorizontal className="h-3.5 w-3.5 mr-1.5" /> {flipH ? "Unflip H" : "Flip H"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setFlipV((f) => !f)}>
                      <FlipVertical className="h-3.5 w-3.5 mr-1.5" /> {flipV ? "Unflip V" : "Flip V"}
                    </Button>
                    <Button size="sm" variant="outline" className="col-span-2"
                      onClick={() => { resetEditorState(); }}>
                      <X className="h-3.5 w-3.5 mr-1.5" /> Reset All
                    </Button>
                  </div>

                  {/* File info */}
                  {file && (
                    <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex justify-between"><span>Original:</span><span>{formatBytes(file.size)}</span></div>
                      {report && <div className="flex justify-between text-green-600">
                        <span>WebP:</span><span>{formatBytes(report.optimizedSize)} ({report.compressionSavings}% saved)</span>
                      </div>}
                      {cropDescriptor && (
                        <div className="flex justify-between">
                          <span>Crop:</span>
                          <span>{cropDescriptor.width}×{cropDescriptor.height}px</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: sliders */}
                <div className="space-y-4">
                  {[
                    { label: "Brightness", value: brightness, setter: setBrightness, icon: Sun },
                    { label: "Contrast",   value: contrast,   setter: setContrast,   icon: Contrast },
                    { label: "Saturation", value: saturation, setter: setSaturation, icon: Droplets },
                  ].map(({ label, value, setter, icon: Icon }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </label>
                        <span className="text-xs text-slate-500 font-mono">{value}%</span>
                      </div>
                      <input
                        type="range" min={50} max={150} value={value}
                        onChange={(e) => setter(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-primary"
                      />
                    </div>
                  ))}

                  {/* Quality */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">WebP Quality</label>
                    <div className="flex gap-2">
                      {(["max", "high", "balanced"] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuality(q)}
                          className={`flex-1 py-1 text-xs rounded border font-medium transition-colors capitalize ${quality === q
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alt text */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alt Text</Label>
                    <div className="flex gap-2">
                      <Input aria-label="Alt Text" placeholder="Describe the image…" value={altText}
                        onChange={(e) => setAltText(e.target.value)} className="text-xs" />
                      <Button type="button" size="sm" variant="outline"
                        onClick={handleGenerateAlt} disabled={isGeneratingAlt}
                        className="px-2" title="AI Generate">
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* AI Assist stub */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-slate-400 border-dashed"
                    disabled
                    onClick={onAIAssist}
                    title="Coming soon"
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    AI Assist <span className="ml-1 text-[10px] opacity-60">(coming soon)</span>
                  </Button>

                  {file && file.size > WARN_SIZE_BYTES && !optimizedBlob && (
                    <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 rounded-md p-2.5 border border-amber-100">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>Large image — click Apply & Optimize to reduce size before saving.</span>
                    </div>
                  )}

                  <Button size="sm" className="w-full" onClick={handleOptimize} disabled={isOptimizing}>
                    {isOptimizing
                      ? "Optimizing…"
                      : <><Crop className="h-3.5 w-3.5 mr-1.5" /> Apply & Optimize</>
                    }
                  </Button>
                </div>
              </div>

              {/* Responsive preview strip */}
              <div className="border-t border-slate-100 pt-4">
                <ResponsivePreviewStrip
                  src={previewUrl}
                  cropDescriptor={cropDescriptor}
                  focalX={focalX}
                  focalY={focalY}
                  naturalWidth={naturalSize.w}
                  naturalHeight={naturalSize.h}
                />
              </div>
            </div>
          )}

          {/* ── Quality Report tab ── */}
          {tab === "report" && report && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Resolution",  score: report.resolutionScore,  detail: `${report.width}×${report.height} (${report.resolutionLabel})` },
                  { label: "SEO",         score: altText ? 90 : 55,        detail: altText ? "Alt text present" : "Missing alt text" },
                  { label: "Performance", score: report.performanceScore,  detail: formatBytes(report.optimizedSize) },
                ].map(({ label, score, detail }) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold ${score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>{score}</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{detail}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <ScoreRow label="File size"   good={report.optimizedSize < 200 * 1024} goodText="Under 200KB"    badText={`${formatBytes(report.optimizedSize)} — consider lower quality`} />
                <ScoreRow label="Alt text"    good={!!altText}                          goodText="Present"        badText="Missing — hurts SEO & accessibility" />
                <ScoreRow label="Format"      good={true}                               goodText="WebP (optimal)" />
                <ScoreRow label="Compression" good={report.compressionSavings > 10}     goodText={`${report.compressionSavings}% saved`} badText="Minimal compression" />
                <ScoreRow label="Resolution"  good={report.resolutionScore >= 75}       goodText={`${report.width}×${report.height}`}    badText={`${report.width}×${report.height} — may appear blurry on retina`} />
                {cropDescriptor && (
                  <ScoreRow label="Crop" good={true} goodText={`${cropDescriptor.width}×${cropDescriptor.height}px crop applied`} />
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between"><span>Original size:</span><span>{formatBytes(report.originalSize)}</span></div>
                <div className="flex justify-between"><span>Optimized size:</span><span className="text-green-600">{formatBytes(report.optimizedSize)}</span></div>
                <div className="flex justify-between font-medium"><span>Savings:</span><span className="text-green-600">{report.compressionSavings}% ({formatBytes(report.originalSize - report.optimizedSize)})</span></div>
                <div className="flex justify-between"><span>Focal point:</span><span className="font-mono">{Math.round(focalX * 100)}% / {Math.round(focalY * 100)}%</span></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-4 flex-shrink-0">
          {isOptimizing && (
            <div className="flex-1 flex items-center gap-2 text-xs text-slate-500">
              <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
              Optimizing to WebP…
            </div>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || (!file && !urlOverride)}>
            {isPending ? "Saving…" : "Save Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Re-export alias so existing call sites don't break
// ---------------------------------------------------------------------------

/** @deprecated Use SmartImageEditor instead */
export const SmartImageUploader = SmartImageEditor;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ScoreRow({ label, good, goodText, badText }: { label: string; good: boolean; goodText: string; badText?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {good
        ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        : <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      }
      <span className="font-medium text-slate-700 w-28 flex-shrink-0">{label}</span>
      <span className={good ? "text-slate-600" : "text-amber-700"}>{good ? goodText : (badText ?? goodText)}</span>
    </div>
  );
}
