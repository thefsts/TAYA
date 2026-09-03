import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileSearch, Image as ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type SeoFormState = {
  pagePath: string;
  title: string;
  description: string;
  ogImageUrl: string;
  canonicalUrl: string;
};

const emptyForm: SeoFormState = { pagePath: "", title: "", description: "", ogImageUrl: "", canonicalUrl: "" };

export default function SeoSettings({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.seo.list, { siteId });
  const createSeoSetting = useMutation(api.seo.create);
  const updateSeoSetting = useMutation(api.seo.update);
  const deleteSeoSetting = useMutation(api.seo.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<SeoFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(setting: any) {
    setEditing(setting);
    setForm({
      pagePath: setting.pagePath,
      title: setting.title,
      description: setting.description,
      ogImageUrl: setting.ogImageUrl ?? "",
      canonicalUrl: setting.canonicalUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsPending(true);
    try {
      if (editing) {
        await updateSeoSetting({
          siteId,
          seoSettingId: editing._id,
          title: form.title,
          description: form.description,
          ogImageUrl: form.ogImageUrl || undefined,
          canonicalUrl: form.canonicalUrl || undefined,
        });
        toast({ title: "SEO setting updated" });
      } else {
        await createSeoSetting({
          siteId,
          pagePath: form.pagePath,
          title: form.title,
          description: form.description,
          ogImageUrl: form.ogImageUrl || undefined,
          canonicalUrl: form.canonicalUrl || undefined,
        });
        toast({ title: "SEO setting created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSeoSetting({ siteId, seoSettingId: deleteTarget._id });
      toast({ title: "SEO setting deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: "Couldn't delete SEO setting", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  const pageContext = data && data !== null
    ? [
        "Page: SEO Settings",
        `Total SEO entries: ${data.length}`,
        ...(data.length > 0
          ? data.slice(0, 10).map((setting: any) =>
              `- Path: ${setting.pagePath} | Title: "${setting.title}" (${setting.title?.length ?? 0} chars) | Description: "${(setting.description ?? "").slice(0, 80)}${(setting.description?.length ?? 0) > 80 ? "…" : ""}" (${setting.description?.length ?? 0} chars)${setting.ogImageUrl ? " | OG image: set" : ""}${setting.canonicalUrl ? " | Canonical: set" : ""}`
            )
          : ["No SEO entries configured yet."]),
      ].join("\n")
    : undefined;

  if (data === undefined) return <AppLayout siteId={params.siteId} pageContext={pageContext}><ClientLoadingList rows={4} /></AppLayout>;
  if (data === null) return <AppLayout siteId={params.siteId} pageContext={pageContext}><ModuleAccessDenied message="Unable to load SEO Settings — you may not have access to this site or the SEO module is disabled." /></AppLayout>;

  const withImages = data.filter((setting: any) => Boolean(setting.ogImageUrl)).length;
  const withCanonical = data.filter((setting: any) => Boolean(setting.canonicalUrl)).length;

  return (
    <AppLayout siteId={params.siteId} pageContext={pageContext}>
      <ClientPageHeader
        eyebrow="Search Visibility"
        title="SEO Settings"
        description="Manage per-page search titles, descriptions, social preview images, and canonical URLs without changing page design."
        actions={<Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add Page</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><FileSearch className="h-3.5 w-3.5" />SEO pages</div><p className="mt-1 text-2xl font-semibold text-slate-900">{data.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><ImageIcon className="h-3.5 w-3.5" />Social images</div><p className="mt-1 text-2xl font-semibold text-slate-900">{withImages}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><ExternalLink className="h-3.5 w-3.5" />Canonical URLs</div><p className="mt-1 text-2xl font-semibold text-slate-900">{withCanonical}</p></div>
      </div>

      <ClientSection title="Page SEO" description="Each entry controls how a specific website page can appear in search engines and social sharing previews.">
        {data.length === 0 ? (
          <ClientEmptyState icon={Search} title="No SEO settings yet" description="Add your first page so you can control its title, description, and social preview information." action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add First Page</Button>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((setting: any) => (
              <div key={setting._id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-start sm:p-5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50"><Search className="h-4 w-4 text-slate-500" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs font-semibold text-primary">{setting.pagePath}</p>{setting.ogImageUrl && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">OG image</span>}{setting.canonicalUrl && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">Canonical</span>}</div>
                  <p className="mt-1 font-semibold text-slate-900">{setting.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{setting.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400"><span>{setting.title?.length ?? 0} title chars</span><span>{setting.description?.length ?? 0} description chars</span></div>
                </div>
                <div className="flex flex-shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(setting)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button aria-label="Delete" size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(setting)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
              </div>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit SEO Setting" : "New SEO Setting"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5"><Label>Page Path</Label><Input aria-label="Page Path" required disabled={!!editing} placeholder="/about" value={form.pagePath} onChange={(e) => setForm({ ...form, pagePath: e.target.value })} /><p className="text-xs leading-5 text-slate-400">Use the public website path, such as /about, /services, or /contact.</p></div>
            <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><Label>Meta Title</Label><span className={`text-xs ${form.title.length > 60 ? "text-amber-600" : "text-slate-400"}`}>{form.title.length}/60</span></div><Input aria-label="Meta Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Page title for search results" /></div>
            <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><Label>Meta Description</Label><span className={`text-xs ${form.description.length > 160 ? "text-amber-600" : "text-slate-400"}`}>{form.description.length}/160</span></div><Textarea aria-label="Meta Description" required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A concise description of this page for search engines." /></div>
            <ImagePickerField siteId={params.siteId} label="Social Preview Image" value={form.ogImageUrl} onChange={(url) => setForm({ ...form, ogImageUrl: url })} initialPreset={SITE_PRESETS.find((preset) => preset.label === "Article Thumbnail")} hint="Recommended: 1200×630 px (Open Graph)." />
            <div className="space-y-1.5"><Label>Canonical URL</Label><Input aria-label="Canonical URL" value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} placeholder="https://yourdomain.com/about" /><p className="text-xs leading-5 text-slate-400">Optional. Use this when search engines should treat one URL as the preferred version of the page.</p></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add SEO Page"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete SEO settings for “{deleteTarget?.pagePath}”?</AlertDialogTitle><AlertDialogDescription>This removes the saved metadata for this page. The website page itself is not deleted, but these SEO settings cannot be recovered.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">{isDeleting ? "Deleting…" : "Delete SEO Settings"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  );
}
