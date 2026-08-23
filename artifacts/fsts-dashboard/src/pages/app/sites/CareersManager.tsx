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
import { Briefcase, Eye, EyeOff, ExternalLink, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

const JOB_TYPES = ["Full-Time", "Part-Time", "Contract", "Internship", "Volunteer"];

type JobForm = {
  title: string;
  jobType: string;
  location: string;
  description: string;
  applyUrl: string;
  isActive: boolean;
};

const emptyForm: JobForm = {
  title: "", jobType: "Full-Time", location: "", description: "", applyUrl: "", isActive: true,
};

export default function CareersManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const items = useQuery(api.careers.list, { siteId });
  const create = useMutation(api.careers.create);
  const update = useMutation(api.careers.update);
  const remove = useMutation(api.careers.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(job: any) {
    setEditing(job.id);
    setForm({
      title: job.title ?? "",
      jobType: job.jobType ?? "Full-Time",
      location: job.location ?? "",
      description: job.description ?? "",
      applyUrl: job.applyUrl ?? "",
      isActive: job.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Title and description are required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const payload = {
        siteId,
        title: form.title,
        jobType: form.jobType,
        location: form.location || undefined,
        description: form.description,
        applyUrl: form.applyUrl || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await update({ ...payload, jobId: editing as Id<"jobPostings"> });
        toast({ title: "Job posting updated" });
      } else {
        await create(payload);
        toast({ title: "Job posting created" });
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
      await remove({ siteId, jobId: deleteId as Id<"jobPostings"> });
      toast({ title: "Job posting deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  if (items === undefined) {
    return <AppLayout siteId={params.siteId}><ClientLoadingList rows={4} /></AppLayout>;
  }

  const activeCount = items.filter((job) => job.isActive).length;
  const typeCount = new Set(items.map((job) => job.jobType).filter(Boolean)).size;

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Hiring"
        title="Careers"
        description="Manage open positions and job postings shown on your public website."
        actions={<Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Post Job</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Briefcase className="h-3.5 w-3.5" />Total postings</div><p className="mt-1 text-2xl font-semibold text-slate-900">{items.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Eye className="h-3.5 w-3.5" />Visible</div><p className="mt-1 text-2xl font-semibold text-slate-900">{activeCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" />Job types</div><p className="mt-1 text-2xl font-semibold text-slate-900">{typeCount}</p></div>
      </div>

      <ClientSection title="Open Positions" description="Inactive positions remain saved in the dashboard but are not shown to website visitors.">
        {items.length === 0 ? (
          <ClientEmptyState
            icon={Briefcase}
            title="No job postings yet"
            description="Post your first open position when you are ready to recruit candidates."
            action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Post First Job</Button>}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((job: NonNullable<typeof items>[number]) => (
              <article key={job.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-start sm:p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                  <Briefcase className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{job.title}</p>
                    <Badge variant="outline" className="text-xs">{job.jobType}</Badge>
                    {job.isActive ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge>
                    ) : (
                      <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>
                    )}
                  </div>
                  {job.location && <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{job.location}</div>}
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p>
                  {job.applyUrl && (
                    <a href={job.applyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />Open application destination
                    </a>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(job)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(job.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Job Posting" : "New Job Posting"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5"><Label>Job Title *</Label><Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="e.g. Security Officer" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Type</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" value={form.jobType} onChange={(e) => setForm((current) => ({ ...current, jobType: e.target.value }))}>{JOB_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="e.g. Dallas, TX" /></div>
            </div>
            <div className="space-y-1.5"><Label>Description *</Label><Textarea rows={6} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Role overview, responsibilities, qualifications, and next steps…" /></div>
            <div className="space-y-1.5"><Label>Application URL</Label><Input value={form.applyUrl} onChange={(e) => setForm((current) => ({ ...current, applyUrl: e.target.value }))} placeholder="https://…/apply or mailto:hr@example.com" /><p className="text-xs leading-5 text-slate-400">Optional. Add the approved application page or recruiting email destination.</p></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div><Label>Visible on website</Label><p className="mt-0.5 text-xs text-slate-500">Turn this off to keep the posting saved without showing it publicly.</p></div><Switch checked={form.isActive} onCheckedChange={(value) => setForm((current) => ({ ...current, isActive: value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Post Job"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete job posting?</AlertDialogTitle><AlertDialogDescription>This permanently removes the posting from the dashboard and website. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete Posting</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
