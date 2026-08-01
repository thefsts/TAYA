import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Plus, Trash2, Sparkles, CheckCircle2, AlertTriangle, BarChart3 } from "lucide-react";
import { SmartImageUploader } from "@/components/SmartImageUploader";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function MediaLibrary({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.media.list, { siteId });
  const health = useQuery(api.media.healthStats, { siteId });
  const createMediaAsset = useMutation(api.media.create);
  const deleteMediaAsset = useMutation(api.media.remove);
  const purgeDataUrls = useMutation(api.media.migrateDeleteDataUrls);

  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  async function handlePurge() {
    setIsPurging(true);
    try {
      const result = await purgeDataUrls({ siteId });
      toast({
        title: `Cleaned up ${result.deleted} broken record${result.deleted !== 1 ? "s" : ""}`,
        description: "Legacy base64 images have been removed from your media library.",
      });
    } catch (err) {
      toast({
        title: "Cleanup failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPurging(false);
    }
  }

  const handleSaveImage = async (imageData: {
    storageId?: string;
    url?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    optimizedSizeBytes?: number;
    width?: number;
    height?: number;
    altText?: string;
  }) => {
    await createMediaAsset({
      siteId,
      ...(imageData.storageId ? { storageId: imageData.storageId as any } : {}),
      ...(imageData.url ? { url: imageData.url } : {}),
      fileName: imageData.fileName,
      mimeType: imageData.mimeType,
      sizeBytes: imageData.sizeBytes,
      optimizedSizeBytes: imageData.optimizedSizeBytes,
      width: imageData.width,
      height: imageData.height,
      altText: imageData.altText,
    });
    toast({ title: "Media asset added", description: `${imageData.fileName} uploaded and optimized.` });
  };

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMediaAsset({ siteId, mediaAssetId: deleteTarget._id });
      toast({ title: "Media asset deleted" });
      setDeleteTarget(null);
      if (selected?._id === deleteTarget._id) setSelected(null);
    } catch (err) {
      toast({
        title: "Couldn't delete asset",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const totalSize = data?.reduce((s: number, m: any) => s + (m.optimizedSizeBytes ?? m.sizeBytes), 0) ?? 0;
  const missingAlt = data?.filter((m: any) => !m.altText && m.mimeType?.startsWith("image/")).length ?? 0;
  const webpCount = data?.filter((m: any) => m.mimeType?.includes("webp")).length ?? 0;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            Smart Image Manager™
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-assisted optimization, automatic WebP conversion, and quality reporting.</p>
        </div>
        <Button onClick={() => setUploaderOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Image
        </Button>
      </div>

      {/* Stats */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-slate-900">{data.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Ready to Use
            </p>
            <p className="text-2xl font-bold text-green-600">{health?.healthy ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              {missingAlt > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              Missing Alt Text
            </p>
            <p className={`text-2xl font-bold ${missingAlt > 0 ? "text-amber-600" : "text-green-600"}`}>{missingAlt}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">WebP Optimized</p>
            <p className="text-2xl font-bold text-slate-900">{data.length > 0 ? Math.round((webpCount / data.length) * 100) : 0}%</p>
          </div>
        </div>
      )}

      {/* Broken image health banner */}
      {health && health.broken > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">
              {health.broken} broken image record{health.broken > 1 ? "s" : ""} detected
            </p>
            <p className="text-red-700 text-xs mt-0.5">
              {health.broken} of your {health.total} assets {health.broken === 1 ? "is a" : "are"} legacy base64 record{health.broken > 1 ? "s" : ""} that cannot be served on your live site. Clean them up to keep your media library accurate.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
            onClick={handlePurge}
            disabled={isPurging}
          >
            {isPurging ? "Cleaning…" : "Clean Up"}
          </Button>
        </div>
      )}

      {missingAlt > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">{missingAlt} image{missingAlt > 1 ? "s" : ""} missing alt text</p>
            <p className="text-amber-700 text-xs mt-0.5">Alt text is required for SEO and accessibility. Click an image to add it.</p>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          {data === undefined ? (
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
              <ImageIcon className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No media yet</h3>
              <p className="text-slate-500 text-sm mb-5">Upload images and the Smart Image Manager™ will automatically optimize them to WebP.</p>
              <Button onClick={() => setUploaderOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" /> Upload First Image
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {data.map((m: any) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => setSelected(selected?._id === m._id ? null : m)}
                  className={`group relative bg-white border rounded-xl overflow-hidden text-left transition-all ${selected?._id === m._id ? "border-primary ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {m.mimeType?.startsWith("image/") ? (
                      <img src={m.thumbnailUrl ?? m.url} alt={m.altText ?? m.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-slate-300" />
                    )}
                    {!m.altText && m.mimeType?.startsWith("image/") && (
                      <div className="absolute top-1.5 left-1.5">
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5">No alt</Badge>
                      </div>
                    )}
                    {m.mimeType?.includes("webp") && (
                      <div className="absolute top-1.5 right-1.5">
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5">WebP</Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-slate-900 truncate">{m.fileName}</p>
                    <p className="text-xs text-slate-400">{formatBytes(m.optimizedSizeBytes ?? m.sizeBytes)}</p>
                    {m.altText && <p className="text-[10px] text-slate-400 truncate mt-0.5" title={m.altText}>{m.altText}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                    className="absolute bottom-1.5 right-1.5 bg-white/90 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 self-start sticky top-4">
            <div className="rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
              <img src={selected.thumbnailUrl ?? selected.url} alt={selected.altText ?? selected.fileName} className="w-full object-contain max-h-48" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm truncate">{selected.fileName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{selected.mimeType}</p>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              {selected.width && selected.height && (
                <div className="flex justify-between"><span>Dimensions</span><span className="font-mono">{selected.width}×{selected.height}</span></div>
              )}
              <div className="flex justify-between"><span>Original size</span><span className="font-mono">{formatBytes(selected.sizeBytes)}</span></div>
              {selected.optimizedSizeBytes && (
                <div className="flex justify-between text-green-600"><span>WebP size</span><span className="font-mono">{formatBytes(selected.optimizedSizeBytes)}</span></div>
              )}
              {selected.optimizedSizeBytes && selected.sizeBytes > 0 && (
                <div className="flex justify-between font-medium"><span>Savings</span><span className="text-green-600">{Math.round(((selected.sizeBytes - selected.optimizedSizeBytes) / selected.sizeBytes) * 100)}%</span></div>
              )}
            </div>

            {/* Alt text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Alt Text</Label>
                {!selected.altText && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Missing</Badge>}
              </div>
              <p className="text-xs text-slate-600 italic">{selected.altText || "No alt text set"}</p>
            </div>

            {/* SEO Score */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Image Quality</p>
              {[
                { label: "Format", good: selected.mimeType?.includes("webp"), goodText: "WebP ✓", badText: "Not WebP" },
                { label: "Alt Text", good: !!selected.altText, goodText: "Present ✓", badText: "Missing" },
                { label: "Size", good: (selected.optimizedSizeBytes ?? selected.sizeBytes) < 500 * 1024, goodText: "Under 500KB ✓", badText: formatBytes(selected.optimizedSizeBytes ?? selected.sizeBytes) },
              ].map(({ label, good, goodText, badText }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className={good ? "text-green-600 font-medium" : "text-amber-600"}>{good ? goodText : badText}</span>
                </div>
              ))}
            </div>

            <Button size="sm" variant="outline" className="w-full" onClick={() => setDeleteTarget(selected)}>
              <Trash2 className="h-3.5 w-3.5 mr-2 text-red-500" /> Delete
            </Button>
          </div>
        )}
      </div>

      <SmartImageUploader
        siteId={siteId}
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSave={handleSaveImage}
        title="Smart Image Manager™"
        context="website media library"
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.fileName}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Any pages using this image will show a broken image.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
