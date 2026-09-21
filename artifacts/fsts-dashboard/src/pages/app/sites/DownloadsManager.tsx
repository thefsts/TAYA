import { useRef, useState } from "react";
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
import { Download, Eye, EyeOff, ExternalLink, FileText, Pencil, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";
import { VisualEditorShell } from "@/components/VisualEditorShell";

type DownloadForm = {
  title: string;
  description: string;
  url: string;
  format: string;
  sizeLabel: string;
  category: string;
  isActive: boolean;
};

/** Chat D — completed PDF upload staged in the create dialog. */
type StagedUpload = {
  storageId: Id<"_storage">;
  fileName: string;
  sizeBytes: number;
};

const emptyForm: DownloadForm = {
  title: "", description: "", url: "", format: "PDF", sizeLabel: "", category: "", isActive: true,
};

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

export default function DownloadsManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const items = useQuery(api.downloads.list, { siteId });
  const create = useMutation(api.downloads.create);
  const update = useMutation(api.downloads.update);
  const remove = useMutation(api.downloads.remove);
  const generateUploadUrl = useMutation(api.downloads.generateUploadUrl);
  const createFromStorage = useMutation(api.downloads.createFromStorage);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** Set when the record being edited is storage-backed (uploaded PDF). */
  const [editingStorageBacked, setEditingStorageBacked] = useState(false);
  const [upload, setUpload] = useState<StagedUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<DownloadForm>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setEditingStorageBacked(false); setUpload(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(item: any) {
    setEditing(item.id);
    setEditingStorageBacked(!!item.storageId);
    setUpload(null);
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

  async function handleFileSelected(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF files only", description: "Choose a file ending in .pdf to upload it here.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ siteId, mimeType: file.type });
      const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = await response.json();
      if (!storageId) throw new Error("Upload response did not include a storage ID.");
      setUpload({ storageId: storageId as Id<"_storage">, fileName: file.name, sizeBytes: file.size });
      if (!form.title.trim()) {
        // Pre-fill the title from the file name (owner can edit before saving).
        setForm((f) => ({ ...f, title: f.title || file.name.replace(/\.pdf$/i, "") }));
      }
      toast({ title: "PDF uploaded", description: `${file.name} (${formatSize(file.size)}) is ready to publish.` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    // New records need either an uploaded PDF or a manual URL.
    if (!editing && !upload && !form.url.trim()) {
      toast({ title: "Upload a PDF or enter a file URL", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      if (editing) {
        // Storage-backed records (uploaded PDFs) never send a url patch —
        // the backend rejects URL edits on uploaded files to avoid desync.
        const payload = {
          siteId,
          title: form.title,
          description: form.description || undefined,
          ...(editingStorageBacked ? {} : { url: form.url }),
          format: form.format || undefined,
          sizeLabel: form.sizeLabel || undefined,
          category: form.category || undefined,
          isActive: form.isActive,
        };
        await update({ ...payload, resourceId: editing as Id<"downloadableResources"> });
        toast({ title: "Resource updated" });
      } else if (upload) {
        await createFromStorage({
          siteId,
          storageId: upload.storageId,
          title: form.title,
          description: form.description || undefined,
          fileName: upload.fileName,
          sizeBytes: upload.sizeBytes,
          category: form.category || undefined,
          isActive: form.isActive,
        });
        toast({ title: "PDF published", description: `${upload.fileName} is now available to website visitors.` });
      } else {
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
      <VisualEditorShell
        siteId={siteId}
        title="Downloads & Resources"
        subtitle="Publish approved PDFs, guides, forms, and other downloadable resources for website visitors."
        isDirty={false}
        historyHref={`/app/sites/${params.siteId}/history`}
        moduleId="downloads"
        previewPath="/downloads"
        toolbarActions={<Button size="sm" onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add Resource</Button>}
      >
      <ClientPageHeader
        eyebrow="Website Resources"
        title="Downloads & Resources"
        description="Publish approved PDFs, guides, forms, and other downloadable resources for website visitors."
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
                  <Button aria-label="Delete" size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <div className="space-y-1.5"><Label>Title *</Label><Input aria-label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Safety Guidelines PDF" /></div>

            {/* Chat D — PDF upload. Upload-first for new resources; manual URL still available. */}
            <div className="space-y-1.5">
              <Label>PDF File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              {editingStorageBacked ? (
                <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  This resource uses an uploaded PDF file. Delete and re-add it to replace the file.
                </p>
              ) : upload ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-emerald-800">{upload.fileName}</p>
                      <p className="text-xs text-emerald-600">{formatSize(upload.sizeBytes)} — will be published with this resource</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" aria-label="Remove uploaded file" className="flex-shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setUpload(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full justify-start gap-2">
                  <UploadCloud className="h-4 w-4" />
                  {isUploading ? "Uploading PDF…" : "Upload PDF file"}
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{upload || editingStorageBacked ? "File URL (read-only)" : "File URL"}</Label>
              <Input aria-label="File URL" value={upload ? "Uploaded file — no URL needed" : form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} disabled={!!upload || editingStorageBacked} placeholder="https://…/file.pdf" />
              {(upload || editingStorageBacked) ? (
                <p className="text-xs leading-5 text-slate-400">Uploaded PDFs use their secure hosted file URL automatically.</p>
              ) : (
                <p className="text-xs leading-5 text-slate-400">Upload a PDF above, or paste the direct, approved URL where visitors can open or download this resource.</p>
              )}
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea aria-label="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description of the file" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Format</Label><Input aria-label="Format" value={upload ? "PDF" : form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} disabled={!!upload} placeholder="PDF" /></div>
              <div className="space-y-1.5"><Label>Size</Label><Input aria-label="Size" value={upload ? formatSize(upload.sizeBytes) : form.sizeLabel} onChange={(e) => setForm((f) => ({ ...f, sizeLabel: e.target.value }))} disabled={!!upload} placeholder="2.4 MB" /></div>
              <div className="space-y-1.5"><Label>Category</Label><Input aria-label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Safety" /></div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div><Label>Visible on website</Label><p className="mt-0.5 text-xs text-slate-500">Turn this off to keep the resource saved without displaying it publicly.</p></div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending || isUploading}>{isPending ? "Saving…" : upload ? "Publish PDF" : editing ? "Save Changes" : "Add Resource"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete resource?</AlertDialogTitle><AlertDialogDescription>This permanently removes the resource from the dashboard and website. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete Resource</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </VisualEditorShell>
    </AppLayout>
  );
}
