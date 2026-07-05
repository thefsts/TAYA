import { useRef, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import {
  useListMediaAssets,
  useCreateMediaAsset,
  useDeleteMediaAsset,
  type MediaAsset,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function MediaLibrary({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useListMediaAssets(siteId);
  const createMutation = useCreateMediaAsset();
  const deleteMutation = useDeleteMediaAsset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState({ url: "", fileName: "", altText: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setForm({ url: "", fileName: "", altText: "" });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.url || !form.fileName) return;
    const ext = form.fileName.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = ext === "png" ? "image/png" : ext === "svg" ? "image/svg+xml" : ext === "webp" ? "image/webp" : "image/jpeg";

    createMutation.mutate(
      {
        siteId,
        data: {
          url: form.url,
          fileName: form.fileName,
          mimeType,
          sizeBytes: 0,
          altText: form.altText || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Media asset added" });
          setDialogOpen(false);
        },
        onError: (err) => {
          toast({
            title: "Something went wrong",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        },
      },
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { siteId, mediaAssetId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Media asset deleted" });
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete asset",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
          <p className="text-sm text-slate-500 mt-0.5">Images and files used across the site.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Media
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <ImageIcon className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No media yet</h3>
          <p className="text-slate-500 mt-1">Upload images to use them across your site.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {data?.map((m) => (
            <div key={m.id} className="group relative bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                {m.mimeType.startsWith("image/") ? (
                  <img src={m.thumbnailUrl ?? m.url} alt={m.altText ?? m.fileName} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-slate-900 truncate">{m.fileName}</p>
                <p className="text-xs text-slate-400">{formatBytes(m.optimizedSizeBytes ?? m.sizeBytes)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(m)}
                className="absolute top-1.5 right-1.5 bg-white/90 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Media Asset</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input required placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>File Name</Label>
              <Input required placeholder="hero.jpg" value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Alt Text</Label>
              <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} />
            </div>
            <input ref={fileInputRef} type="file" className="hidden" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.fileName}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
