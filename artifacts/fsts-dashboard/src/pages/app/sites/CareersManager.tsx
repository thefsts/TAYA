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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Pencil, Trash2, MapPin, ExternalLink } from "lucide-react";

type JobForm = { title: string; type: string; location: string; description: string; applyUrl: string; isActive: boolean };
const empty: JobForm = { title: "", type: "Full-Time", location: "", description: "", applyUrl: "", isActive: true };
const JOB_TYPES = ["Full-Time", "Part-Time", "Contract", "Volunteer", "Internship"];

export default function CareersManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const jobs = useQuery(api.contentModules.listJobs, { siteId });
  const create = useMutation(api.contentModules.createJob);
  const update = useMutation(api.contentModules.updateJob);
  const remove = useMutation(api.contentModules.removeJob);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<JobForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(empty); setDialogOpen(true); }
  function openEdit(j: any) {
    setEditing(j);
    setForm({ title: j.title, type: j.type, location: j.location ?? "", description: j.description, applyUrl: j.applyUrl ?? "", isActive: j.isActive });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) { toast({ title: "Title and description are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const fields = { title: form.title, type: form.type, location: form.location || undefined, description: form.description, applyUrl: form.applyUrl || undefined, isActive: form.isActive };
      if (editing) {
        await update({ siteId, jobId: editing._id, ...fields });
        toast({ title: "Job posting updated" });
      } else {
        await create({ siteId, ...fields });
        toast({ title: "Job posting created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove({ siteId, jobId: deleteId as Id<"jobPostings"> });
    toast({ title: "Job posting deleted" });
    setDeleteId(null);
  }

  if (jobs === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Careers Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage job postings shown on your site's Careers page.</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Post a Job</Button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No job postings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job._id} className="bg-white border border-slate-200 rounded-xl p-5 flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{job.title}</span>
                  <Badge variant="outline" className="text-xs">{job.type}</Badge>
                  {!job.isActive && <Badge variant="secondary" className="text-xs text-slate-400">Hidden</Badge>}
                </div>
                {job.location && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                    <MapPin className="w-3 h-3" />{job.location}
                  </div>
                )}
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{job.description}</p>
                {job.applyUrl && (
                  <a href={job.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1">Apply URL <ExternalLink className="w-3 h-3" /></a>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(job)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(job._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Job Posting" : "Post a New Job"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Job Title</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Lead Firearms Instructor" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employment Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Location <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Phoenix, AZ or Remote" /></div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1" rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the role, requirements, and what to expect…" /></div>
            <div><Label>Apply URL <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={form.applyUrl} onChange={(e) => setForm((f) => ({ ...f, applyUrl: e.target.value }))} placeholder="https://…" /></div>
            <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Visible on website</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Post Job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this job posting?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
