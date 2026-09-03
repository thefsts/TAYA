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
import { ChevronDown, ChevronUp, Eye, EyeOff, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type FaqFormState = { question: string; answer: string; isActive: boolean };
const emptyForm: FaqFormState = { question: "", answer: "", isActive: true };

export default function FaqManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const faqs = useQuery(api.faq.list, { siteId });
  const createFaq = useMutation(api.faq.create);
  const updateFaq = useMutation(api.faq.update);
  const removeFaq = useMutation(api.faq.remove);
  const reorderFaq = useMutation(api.faq.reorder);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FaqFormState>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(faq: any) { setEditing(faq.id); setForm({ question: faq.question, answer: faq.answer, isActive: faq.isActive }); setDialogOpen(true); }

  async function handleSave() {
    if (!form.question.trim() || !form.answer.trim()) { toast({ title: "Question and answer are required", variant: "destructive" }); return; }
    setIsPending(true);
    try {
      if (editing) { await updateFaq({ siteId, faqId: editing as Id<"faqs">, ...form }); toast({ title: "FAQ updated" }); }
      else { await createFaq({ siteId, ...form }); toast({ title: "FAQ created" }); }
      setDialogOpen(false);
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setIsPending(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await removeFaq({ siteId, faqId: deleteId as Id<"faqs"> }); toast({ title: "FAQ deleted" }); }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setDeleteId(null); }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!faqs) return;
    const newOrder = [...faqs]; const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    await reorderFaq({ siteId, orderedIds: newOrder.map((f) => f.id as Id<"faqs">) });
  }

  if (faqs === undefined) return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;
  const visibleCount = faqs.filter((faq: NonNullable<typeof faqs>[number]) => faq.isActive).length;

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader eyebrow="Website Content" title="Frequently Asked Questions" description="Answer common customer questions and control the order they appear on your website." actions={<Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add FAQ</Button>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><HelpCircle className="h-3.5 w-3.5" />Total questions</div><p className="mt-1 text-2xl font-semibold text-slate-900">{faqs.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Eye className="h-3.5 w-3.5" />Visible</div><p className="mt-1 text-2xl font-semibold text-slate-900">{visibleCount}</p></div>
      </div>

      <ClientSection title="Website FAQ Order" description="Use the arrows to arrange questions. Hidden questions stay saved but do not appear publicly.">
        {faqs.length === 0 ? (
          <ClientEmptyState icon={HelpCircle} title="No FAQs yet" description="Add your first frequently asked question to help visitors find answers faster." action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add First FAQ</Button>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {faqs.map((faq: NonNullable<typeof faqs>[number], i: number) => (
              <div key={faq.id} className="group flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-start sm:p-5">
                <div className="flex gap-1 sm:flex-col">
                  <button aria-label="Move FAQ up" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button aria-label="Move FAQ down" onClick={() => move(i, 1)} disabled={i === faqs.length - 1} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{faq.question}</p>{faq.isActive ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge> : <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>}</div>
                  <p className="text-sm leading-6 text-slate-600 line-clamp-3">{faq.answer}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(faq)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button aria-label="Delete" size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(faq.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit FAQ" : "Add FAQ"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5"><Label>Question</Label><Input aria-label="Question" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} placeholder="e.g. What areas do you serve?" /></div>
            <div className="space-y-1.5"><Label>Answer</Label><Textarea aria-label="Answer" rows={6} value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} placeholder="Provide a clear, helpful answer…" /></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div><Label>Visible on website</Label><p className="mt-0.5 text-xs text-slate-500">Turn this off to save the FAQ without showing it publicly.</p></div><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add FAQ"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this FAQ?</AlertDialogTitle><AlertDialogDescription>This permanently removes the question and answer from the dashboard and website. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete FAQ</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  );
}
