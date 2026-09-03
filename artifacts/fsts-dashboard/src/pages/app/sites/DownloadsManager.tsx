import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, EyeOff, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

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

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
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
    return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;
  }

  const visibleCount = items.filter((item: NonNullable<typeof items>[number]) => item.isActive).length;
  const categoryCount = new Set(items.map((item: NonNullable<typeof items>[number]) => item.category).filter(Boolean)).size;

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Website Resources"
        title="Downloads & Resources"
        description="Publish approved PDFs, guides, forms, and other downloadable resources for website visitors."
        actions={<Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add Resource</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><FileText className="h-3.5 w-3.5" />Total resources</div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Eye className="h-3.5 w-3.5" />Visible</div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{visibleCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Download className="h-3.5 w-3.5" />Categories</div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{categoryCount}</p>
        </div>
      </div>

      <ClientSection title="Published Resources" description="Hidden resources remain saved in the dashboard but are not shown to website visitors.">
        {items.length === 0 ? (
          <ClientEmptyState
            icon={Download}
            title="No resources yet"
            description="Add a downloadable file or document to make it available from your website."
            action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add First Resource</Button>}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item: NonNullable<typeof items>[number]) => (
              <div key={item.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  <Download className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    {item.format && <Badge variant="outline" className="text-xs">{item.format}</Badge>}
                    {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                    {item.isActive ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge>
                    ) : (
                      <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>
                    )}
                  </div>
                  {item.description && <p className="line-clamp-2 text-sm leading-5 text-slate-500">{item.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />Open resource
                    </a>
                    {item.sizeLabel && <span className="text-xs text-slate-400">{item.sizeLabel}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-2 sm:justify-end">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Resource" : "Add Resource"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Safety Guidelines PDF" /></div>
            <div className="space-y-1.5"><Label>File URL *</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…/file.pdf" /><p className="text-xs leading-5 text-slate-400">Use the direct, approved URL where visitors can open or download this resource.</p></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the file" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Format</Label><Input value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} placeholder="PDF" /></div>
              <div className="space-y-1.5"><Label>Size</Label><Input value={form.sizeLabel} onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))} placeholder="2.4 MB" /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Safety" /></div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div><Label>Visible on website</Label><p className="mt-0.5 text-xs text-slate-500">Turn this off to keep the resource saved without displaying it publicly.</p></div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add Resource"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete resource?</AlertDialogTitle><AlertDialogDescription>This permanently removes the resource from the dashboard and website. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete Resource</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
