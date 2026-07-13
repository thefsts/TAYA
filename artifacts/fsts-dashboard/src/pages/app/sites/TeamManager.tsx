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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";

type MemberForm = { name: string; role: string; bio: string; photoUrl: string; credentialInput: string; credentials: string[]; isActive: boolean };
const empty: MemberForm = { name: "", role: "", bio: "", photoUrl: "", credentialInput: "", credentials: [], isActive: true };

export default function TeamManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const members = useQuery(api.contentModules.listTeamMembers, { siteId });
  const create = useMutation(api.contentModules.createTeamMember);
  const update = useMutation(api.contentModules.updateTeamMember);
  const remove = useMutation(api.contentModules.removeTeamMember);
  const reorder = useMutation(api.contentModules.reorderTeamMembers);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<MemberForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(empty); setDialogOpen(true); }
  function openEdit(m: any) {
    setEditing(m);
    setForm({ name: m.name, role: m.role, bio: m.bio ?? "", photoUrl: m.photoUrl ?? "", credentialInput: "", credentials: m.credentials ?? [], isActive: m.isActive });
    setDialogOpen(true);
  }

  function addCredential() {
    const c = form.credentialInput.trim();
    if (!c || form.credentials.includes(c)) return;
    setForm((f) => ({ ...f, credentials: [...f.credentials, c], credentialInput: "" }));
  }
  function removeCredential(c: string) {
    setForm((f) => ({ ...f, credentials: f.credentials.filter((x) => x !== c) }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.role.trim()) { toast({ title: "Name and role are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const fields = { name: form.name, role: form.role, bio: form.bio || undefined, photoUrl: form.photoUrl || undefined, credentials: form.credentials.length > 0 ? form.credentials : undefined, isActive: form.isActive };
      if (editing) {
        await update({ siteId, memberId: editing._id, ...fields });
        toast({ title: "Team member updated" });
      } else {
        await create({ siteId, ...fields });
        toast({ title: "Team member added" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove({ siteId, memberId: deleteId as Id<"teamMembers"> });
    toast({ title: "Team member removed" });
    setDeleteId(null);
  }

  async function move(i: number, dir: -1 | 1) {
    if (!members) return;
    const arr = [...members];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await reorder({ siteId, orderedIds: arr.map((x) => x._id as Id<"teamMembers">) });
  }

  if (members === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage instructor and staff profiles shown on your site.</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Member</Button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No team members yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={m._id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center">
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === members.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
              </div>
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-lg font-bold text-slate-400">{m.name[0]}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                  <span className="text-xs text-slate-500">{m.role}</span>
                  {!m.isActive && <Badge variant="secondary" className="text-xs text-slate-400">Hidden</Badge>}
                </div>
                {m.credentials && m.credentials.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {m.credentials.map((c: string) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(m._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Team Member" : "Add Team Member"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Role / Title</Label><Input className="mt-1" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Lead Instructor" /></div>
            </div>
            <div><Label>Bio <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Textarea className="mt-1" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></div>
            <div><Label>Photo URL <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1" value={form.photoUrl} onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))} placeholder="https://…" /></div>
            <div>
              <Label>Credentials / Certifications</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.credentialInput} onChange={(e) => setForm((f) => ({ ...f, credentialInput: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCredential())} placeholder="e.g. NRA Certified" />
                <Button type="button" variant="outline" onClick={addCredential}>Add</Button>
              </div>
              {form.credentials.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {form.credentials.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs flex items-center gap-1">{c}<button onClick={() => removeCredential(c)}><X className="w-3 h-3" /></button></Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Visible on website</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove this team member?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
