import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Download, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";

type DownloadForm = {
  title: string;
  description: string;
  url: string;
  format: string;
  sizeLabel: string;
  category: string;
  isActive: boolean;
};

const emptyForm: DownloadForm = {
  title: "", description: "", url: "", format: "PDF", sizeLabel: "", category: "", isActive: true,
};

export default function DownloadsManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const items = useQuery(api.downloads.list, { siteId });
  const create = useMutation(api.downloads.create);
  const update = useMutation(api.downloads.update);
  const remove = useMutation(api.downloads.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<DownloadForm>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item.id);
    setForm({
      title: item.title ?? "",
      description: item.description ?? "",
      url: item.url ?? "",
      format: item.format ?? "PDF",
      sizeLabel: item.sizeLabel ?? "",
      category: item.category ?? "",
      isActive: item.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.url.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const payload = {
        siteId,
        title: form.title,
        description: form.description || undefined,
        url: form.url,
        format: form.format || undefined,
        sizeLabel: form.sizeLabel || undefined,
        category: form.category || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await update({ ...payload, resourceId: editing as Id<"downloadableResources"> });
        toast({ title: "Resource updated" });
      } else {
        await create(payload);
        toast({ title: "Resource added" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await remove({ siteId, resourceId: deleteId as Id<"downloadableResources"> });
      toast({ title: "Resource deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  if (items === undefined) {
    return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Downloads & Resources</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage downloadable PDFs and documents available on your website.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Resource
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Download className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No resources yet</p>
          <p className="text-slate-400 text-sm mt-1">Add downloadable files to share with visitors.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4 items-center"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                  {item.format && <Badge variant="outline" className="text-xs">{item.format}</Badge>}
                  {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                  {!item.isActive && <Badge variant="secondary">Hidden</Badge>}
                </div>
                {item.description && (
                  <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View file
                  </a>
                  {item.sizeLabel && <span className="text-xs text-slate-400">{item.sizeLabel}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Resource" : "New Resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Safety Guidelines PDF" />
            </div>
            <div>
              <Label>File URL *</Label>
              <Input className="mt-1" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…/file.pdf" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the file" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Format</Label>
                <Input className="mt-1" value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} placeholder="PDF" />
              </div>
              <div>
                <Label>Size</Label>
                <Input className="mt-1" value={form.sizeLabel} onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))} placeholder="2.4 MB" />
              </div>
              <div>
                <Label>Category</Label>
                <Input className="mt-1" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Safety" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Visible on website</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add Resource"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
