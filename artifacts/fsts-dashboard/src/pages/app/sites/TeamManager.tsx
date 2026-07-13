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
import { Users, Pencil, Plus, Trash2 } from "lucide-react";

type MemberForm = {
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  credentials: string;
  isActive: boolean;
};

const emptyForm: MemberForm = {
  name: "", role: "", bio: "", photoUrl: "", credentials: "", isActive: true,
};

export default function TeamManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const items = useQuery(api.team.list, { siteId });
  const create = useMutation(api.team.create);
  const update = useMutation(api.team.update);
  const remove = useMutation(api.team.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(m: any) {
    setEditing(m.id);
    setForm({
      name: m.name ?? "",
      role: m.role ?? "",
      bio: m.bio ?? "",
      photoUrl: m.photoUrl ?? "",
      credentials: m.credentials ?? "",
      isActive: m.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const payload = {
        siteId,
        name: form.name,
        role: form.role || undefined,
        bio: form.bio || undefined,
        photoUrl: form.photoUrl || undefined,
        credentials: form.credentials || undefined,
        isActive: form.isActive,
      };
      if (editing) {
        await update({ ...payload, memberId: editing as Id<"teamMembers"> });
        toast({ title: "Team member updated" });
      } else {
        await create(payload);
        toast({ title: "Team member added" });
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
      await remove({ siteId, memberId: deleteId as Id<"teamMembers"> });
      toast({ title: "Team member removed" });
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
          <h1 className="text-2xl font-bold text-slate-900">Team Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage instructors and staff shown on your website.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Member
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No team members yet</p>
          <p className="text-slate-400 text-sm mt-1">Add instructors and staff to showcase your team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((member) => (
            <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex gap-3 mb-3">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.name} className="h-14 w-14 rounded-full object-cover border border-slate-100 flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                      {member.role && <p className="text-xs text-slate-500 mt-0.5">{member.role}</p>}
                    </div>
                    {!member.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                  {member.credentials && (
                    <p className="text-xs text-primary mt-1 font-medium">{member.credentials}</p>
                  )}
                </div>
              </div>
              {member.bio && (
                <p className="text-sm text-slate-600 line-clamp-2 mb-3">{member.bio}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(member)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(member.id)}>
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
            <DialogTitle>{editing ? "Edit Team Member" : "New Team Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <Label>Role / Title</Label>
                <Input className="mt-1" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Lead Instructor" />
              </div>
            </div>
            <div>
              <Label>Credentials</Label>
              <Input className="mt-1" value={form.credentials} onChange={(e) => setForm((f) => ({ ...f, credentials: e.target.value }))} placeholder="NRA Certified, 20+ years experience" />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea className="mt-1" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Brief biography…" />
            </div>
            <div>
              <Label>Photo URL</Label>
              <Input className="mt-1" value={form.photoUrl} onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Visible on website</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add Member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
