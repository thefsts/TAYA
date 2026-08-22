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
import { Eye, EyeOff, MessageSquareQuote, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type TestimonialFormState = {
  name: string;
  role: string;
  company: string;
  rating: string;
  text: string;
  avatarUrl: string;
  isActive: boolean;
};

const emptyForm: TestimonialFormState = {
  name: "", role: "", company: "", rating: "5", text: "", avatarUrl: "", isActive: true,
};

export default function TestimonialsManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const items = useQuery(api.testimonials.list, { siteId });
  const create = useMutation(api.testimonials.create);
  const update = useMutation(api.testimonials.update);
  const remove = useMutation(api.testimonials.remove);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<TestimonialFormState>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(t: any) {
    setEditing(t.id);
    setForm({ name: t.name ?? "", role: t.role ?? "", company: t.company ?? "", rating: String(t.rating ?? 5), text: t.text ?? "", avatarUrl: t.avatarUrl ?? "", isActive: t.isActive });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.text.trim()) { toast({ title: "Name and testimonial text are required", variant: "destructive" }); return; }
    setIsPending(true);
    const rating = parseInt(form.rating, 10);
    try {
      const payload = { siteId, name: form.name, role: form.role || undefined, company: form.company || undefined, rating: isNaN(rating) ? undefined : rating, text: form.text, avatarUrl: form.avatarUrl || undefined, isActive: form.isActive };
      if (editing) { await update({ ...payload, testimonialId: editing as Id<"testimonials"> }); toast({ title: "Testimonial updated" }); }
      else { await create(payload); toast({ title: "Testimonial added" }); }
      setDialogOpen(false);
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setIsPending(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await remove({ siteId, testimonialId: deleteId as Id<"testimonials"> }); toast({ title: "Testimonial deleted" }); }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setDeleteId(null); }
  }

  if (items === undefined) return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;
  const visibleCount = items.filter((item) => item.isActive).length;
  const averageRating = items.length ? (items.reduce((sum, item) => sum + (item.rating ?? 0), 0) / items.length).toFixed(1) : "—";

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Social Proof"
        title="Testimonials"
        description="Manage approved client feedback, ratings, and profile images shown across your website."
        actions={<Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add Testimonial</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" />Total</div><p className="mt-1 text-2xl font-semibold text-slate-900">{items.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Eye className="h-3.5 w-3.5" />Visible</div><p className="mt-1 text-2xl font-semibold text-slate-900">{visibleCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Star className="h-3.5 w-3.5" />Avg. rating</div><p className="mt-1 text-2xl font-semibold text-slate-900">{averageRating}</p></div>
      </div>

      <ClientSection title="Client Testimonials" description="Hidden testimonials remain saved in the dashboard but are not shown publicly.">
        {items.length === 0 ? (
          <ClientEmptyState icon={MessageSquareQuote} title="No testimonials yet" description="Add approved customer feedback to build trust and social proof on your website." action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add First Testimonial</Button>} />
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 sm:p-5">
            {items.map((item: NonNullable<typeof items>[number]) => (
              <article key={item.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  {item.avatarUrl ? <img src={item.avatarUrl} alt={item.name} className="h-11 w-11 rounded-full border border-slate-200 object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500">{item.name.charAt(0)}</div>}
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{item.name}</p>{item.isActive ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge> : <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>}</div>{(item.role || item.company) && <p className="mt-0.5 text-xs text-slate-500">{[item.role, item.company].filter(Boolean).join(" · ")}</p>}</div>
                </div>
                {item.rating != null && <div className="mt-4 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < item.rating! ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>}
                <blockquote className="mt-3 flex-1 text-sm leading-6 text-slate-600">“{item.text}”</blockquote>
                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
              </article>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" /></div><div className="space-y-1.5"><Label>Rating (1–5)</Label><Input type="number" min="1" max="5" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Role / Title</Label><Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Director of Security" /></div><div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" /></div></div>
            <div className="space-y-1.5"><Label>Testimonial Text *</Label><Textarea rows={5} value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} placeholder="What did this client say?" /></div>
            <ImagePickerField siteId={params.siteId} label="Avatar" value={form.avatarUrl} onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))} initialPreset={SITE_PRESETS.find((p) => p.label === "Testimonial Photo")} hint="Recommended: 200×200 px square." />
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div><Label>Visible on website</Label><p className="mt-0.5 text-xs text-slate-500">Turn this off to keep the testimonial saved without displaying it publicly.</p></div><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add Testimonial"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete testimonial?</AlertDialogTitle><AlertDialogDescription>This permanently removes the testimonial from the dashboard and website. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete Testimonial</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  );
}
