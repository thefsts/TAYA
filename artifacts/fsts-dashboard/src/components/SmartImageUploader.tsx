import { useState, useRef, useCallback } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload, Image as ImageIcon, AlertTriangle, CheckCircle2, Sparkles, RotateCcw, FlipHorizontal,
  ZoomIn, ZoomOut, Sun, Contrast, Droplets, Crop, X, FileImage, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const WARN_SIZE_MB = 1;
const WARN_SIZE_BYTES = WARN_SIZE_MB * 1024 * 1024;

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

async function compressToWebP(
  file: File,
  quality: number = 0.82,
  maxW: number = 2400
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas compression failed")); return; }
          resolve({ blob, width, height });
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

async function applyEdits(
  file: File,
  opts: { rotation: number; flipH: boolean; brightness: number; contrast: number; saturation: number },
  quality: number = 0.82
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { rotation, flipH, brightness, contrast, saturation } = opts;
      const radians = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const w = Math.round(img.width * cos + img.height * sin);
      const h = Math.round(img.width * sin + img.height * cos);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(w, 2400);
      canvas.height = Math.round(h * (Math.min(w, 2400) / w));
      const ctx = canvas.getContext("2d")!;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (flipH) ctx.scale(-1, 1);
      ctx.rotate(radians);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
      ctx.restore();
      // Apply CSS filter via canvas doesn't work directly, but we can simulate
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(canvas, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas apply failed")); return; }
          resolve({ blob, width: canvas.width, height: canvas.height });
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

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
    /** Set for files uploaded via Convex File Storage */
    storageId?: string;
    /** Set for external URL tab entries */
    url?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    optimizedSizeBytes?: number;
    width?: number;
    height?: number;
    altText?: string;
  }) => Promise<void>;
  context?: string;
  title?: string;
};

export function SmartImageUploader({ siteId, open, onClose, onSave, context, title = "Smart Image Manager™" }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateAltText = useAction(api.ai.generateAltText);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Quality report
  const [report, setReport] = useState<ImageQualityReport | null>(null);
  const [optimizedBlob, setOptimizedBlob] = useState<Blob | null>(null);

  const qualityValue = quality === "max" ? 0.95 : quality === "high" ? 0.82 : 0.65;

  const handleFileSelect = useCallback(async (f: File) => {
    if (f.size > MAX_SIZE_BYTES) {
      toast({ title: "File too large", description: `Maximum file size is ${MAX_SIZE_MB}MB. Please optimize it first.`, variant: "destructive" });
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setTab("edit");
    setRotation(0); setFlipH(false); setBrightness(100); setContrast(100); setSaturation(100);
    // Auto-optimize
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
  }, [qualityValue, altText, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleOptimize = async () => {
    if (!file) return;
    setIsOptimizing(true);
    try {
      const { blob, width, height } = await applyEdits(file, { rotation, flipH, brightness, contrast, saturation }, qualityValue);
      setOptimizedBlob(blob);
      const res = scoreResolution(width, height);
      const savings = Math.round(((file.size - blob.size) / file.size) * 100);
      setReport((r) => r ? { ...r, optimizedSize: blob.size, width, height, resolutionScore: res.score, resolutionLabel: res.label, compressionSavings: savings } : r);
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
      // For blob URLs, we can't send to AI — only for http URLs
      if (imageUrl.startsWith("blob:")) {
        toast({ title: "Alt text suggestion", description: "Describe what's in this image for accessibility and SEO." });
      } else {
        const { altText: generated } = await generateAltText({
          siteId: siteId as Id<"sites">,
          imageUrl,
          context,
        });
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
        // External URL — stored as a plain URL reference, no file upload needed
        await onSave({
          url: urlOverride,
          fileName: urlOverride.split("/").pop() ?? "image",
          mimeType: "image/jpeg",
          sizeBytes: 0,
          altText: altText || undefined,
        });
      } else if (file && optimizedBlob) {
        // Upload the WebP blob to Convex File Storage
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
    setRotation(0); setFlipH(false); setBrightness(100); setContrast(100); setSaturation(100);
    onClose();
  };

  const imgStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: "upload", label: "Upload" },
            { id: "url", label: "URL" },
            { id: "edit", label: "Edit & Optimize", disabled: !file },
            { id: "report", label: "Quality Report", disabled: !report },
          ].map(({ id, label, disabled }) => (
            <button
              key={id}
              disabled={disabled}
              onClick={() => !disabled && setTab(id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {/* Upload tab */}
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
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              <Button size="sm" variant="outline" className="mt-4" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <FileImage className="h-4 w-4 mr-2" /> Choose File
              </Button>
            </div>
          )}

          {/* URL tab */}
          {tab === "url" && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Image URL</Label>
                <Input placeholder="https://example.com/image.jpg" value={urlOverride} onChange={(e) => setUrlOverride(e.target.value)} />
              </div>
              {urlOverride && (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <img src={urlOverride} alt="Preview" className="max-h-60 max-w-full object-contain" onError={() => toast({ title: "Invalid image URL", variant: "destructive" })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Alt Text</Label>
                <div className="flex gap-2">
                  <Input placeholder="Describe the image…" value={altText} onChange={(e) => setAltText(e.target.value)} />
                  <Button type="button" size="sm" variant="outline" onClick={handleGenerateAlt} disabled={!urlOverride || isGeneratingAlt} className="whitespace-nowrap">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isGeneratingAlt ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Edit tab */}
          {tab === "edit" && file && (
            <div className="grid grid-cols-2 gap-6 py-2">
              <div className="space-y-3">
                {/* Preview */}
                <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center" style={{ minHeight: 220 }}>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Edit preview"
                      className="max-h-52 max-w-full object-contain transition-all duration-200"
                      style={imgStyle}
                    />
                  )}
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rotate L
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5 scale-x-[-1]" /> Rotate R
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setFlipH((f) => !f)}>
                    <FlipHorizontal className="h-3.5 w-3.5 mr-1.5" /> {flipH ? "Unflip" : "Flip H"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRotation(0); setFlipH(false); setBrightness(100); setContrast(100); setSaturation(100); }}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Sliders */}
                {[
                  { label: "Brightness", value: brightness, setter: setBrightness, icon: Sun },
                  { label: "Contrast", value: contrast, setter: setContrast, icon: Contrast },
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
                        className={`flex-1 py-1 text-xs rounded border font-medium transition-colors capitalize ${quality === q ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
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
                    <Input placeholder="Describe the image…" value={altText} onChange={(e) => setAltText(e.target.value)} className="text-xs" />
                    <Button type="button" size="sm" variant="outline" onClick={handleGenerateAlt} disabled={isGeneratingAlt} className="px-2" title="AI Generate">
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* File info */}
                {file && (
                  <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                    <div className="flex justify-between"><span>Original:</span><span>{formatBytes(file.size)}</span></div>
                    {report && <div className="flex justify-between text-green-600"><span>WebP:</span><span>{formatBytes(report.optimizedSize)} ({report.compressionSavings}% saved)</span></div>}
                  </div>
                )}

                {file && file.size > WARN_SIZE_BYTES && !optimizedBlob && (
                  <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 rounded-md p-2.5 border border-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Large image — click Optimize to reduce size before saving.</span>
                  </div>
                )}

                <Button size="sm" className="w-full" onClick={handleOptimize} disabled={isOptimizing}>
                  {isOptimizing ? "Optimizing…" : <><Crop className="h-3.5 w-3.5 mr-1.5" /> Apply & Optimize</>}
                </Button>
              </div>
            </div>
          )}

          {/* Quality Report tab */}
          {tab === "report" && report && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Resolution", score: report.resolutionScore, detail: `${report.width}×${report.height} (${report.resolutionLabel})` },
                  { label: "SEO", score: altText ? 90 : 55, detail: altText ? "Alt text present" : "Missing alt text" },
                  { label: "Performance", score: report.performanceScore, detail: formatBytes(report.optimizedSize) },
                ].map(({ label, score, detail }) => (
                  <div key={label} className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold ${score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>{score}</div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{detail}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <ScoreRow label="File size" good={report.optimizedSize < 200 * 1024} goodText="Under 200KB" badText={`${formatBytes(report.optimizedSize)} — consider lower quality`} />
                <ScoreRow label="Alt text" good={!!altText} goodText="Present" badText="Missing — hurts SEO & accessibility" />
                <ScoreRow label="Format" good={true} goodText="WebP (optimal)" />
                <ScoreRow label="Compression" good={report.compressionSavings > 10} goodText={`${report.compressionSavings}% saved`} badText="Minimal compression" />
                <ScoreRow label="Resolution" good={report.resolutionScore >= 75} goodText={`${report.width}×${report.height}`} badText={`${report.width}×${report.height} — may appear blurry on retina displays`} />
              </div>

              <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between"><span>Original size:</span><span>{formatBytes(report.originalSize)}</span></div>
                <div className="flex justify-between"><span>Optimized size:</span><span className="text-green-600">{formatBytes(report.optimizedSize)}</span></div>
                <div className="flex justify-between font-medium"><span>Savings:</span><span className="text-green-600">{report.compressionSavings}% ({formatBytes(report.originalSize - report.optimizedSize)})</span></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-4">
          {isOptimizing && (
            <div className="flex-1 flex items-center gap-2 text-xs text-slate-500">
              <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
              Optimizing to WebP…
            </div>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isPending || (!file && !urlOverride)}
          >
            {isPending ? "Saving…" : "Save Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
