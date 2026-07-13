import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, Plus, Pencil, Trash2, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";

type DlForm = { title: string; description: string; url: string; format: string; sizeLabel: string; category: string; isActive: boolean };
const empty: DlForm = { title: "", description: "", url: "", format: "PDF", sizeLabel: "", category: "", isActive: true };

export default function DownloadsManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const items = useQuery(api.contentModules.listDownloads, { siteId });
  const create = useMutation(api.contentModules.createDownload);
  const update = useMutation(api.contentModules.updateDownload);
  const remove = useMutation(api.contentModules.removeDownload);
  const reorder = useMutation(api.contentModules.reorderDownloads);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<DlForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(empty); setDialogOpen(true); }
  function openEdit(item: any) {
    setEditing(item);
    setForm({ title: item.title, description: item.description ?? "", url: item.url, format: item.format ?? "PDF", sizeLabel: item.sizeLabel ?? "", category: item.category ?? "", isActive: item.isActive });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.url.trim()) { toast({ title: "Title and URL are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const fields = { title: form.title, description: form.description || undefined, url: form.url, format: form.format || undefined, sizeLabel: form.sizeLabel || undefined, category: form.category || undefined, isActive: form.isActive };
      if (editing) {
        await update({ siteId, downloadId: editing._id, ...fields });
        toast({ title: "Resource updated" });
      } else {
        await create({ siteId, ...fields });
        toast({ title: "Resource added" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove({ siteId, downloadId: deleteId as Id<"downloadableResources"> });
    toast({ title: "Resource removed" });
    setDeleteId(null);
  }

  async function move(i: number, dir: -1 | 1) {
    if (!items) return;
    const arr = [...items];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await reorder({ siteId, orderedIds: arr.map((x) => x._id as Id<"downloadableResources">) });
  }

  if (items === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Download className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Downloads Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage downloadable resources available on your site.</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Resource</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Download className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No downloadable resources yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item._id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center">
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{item.title}</span>
                  {item.format && <Badge variant="outline" className="text-xs">{item.format}</Badge>}
                  {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                  {!item.isActive && <Badge variant="secondary" className="text-xs text-slate-400">Hidden</Badge>}
                </div>
                {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline font-mono truncate max-w-xs">{item.url}</a>
                  <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
                {item.sizeLabel && <span className="text-xs text-slate-400">{item.sizeLabel}</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(item._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Resource" : "Add Downloadable Resource"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Download URL</Label><Input className="mt-1" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Format</Label><Input className="mt-1" value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} placeholder="PDF" /></div>
              <div><Label>Size</Label><Input className="mt-1" value={form.sizeLabel} onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))} placeholder="1.2 MB" /></div>
              <div><Label>Category</Label><Input className="mt-1" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Forms" /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Visible on website</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Resource"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove this resource?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
