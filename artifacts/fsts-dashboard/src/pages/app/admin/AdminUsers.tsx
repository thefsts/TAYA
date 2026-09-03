import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Redirect, Link } from "wouter";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Pencil, Plus, ShieldCheck, Trash2, UserRoundCheck } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roleCapabilities";

type RoleAssignmentForm = { siteId: string; role: string };

const ROLE_BADGE_COLORS: Partial<Record<string, string>> = {
  owner: "bg-green-100 text-green-800",
  manager: "bg-blue-100 text-blue-800",
  marketing: "bg-purple-100 text-purple-800",
  content_editor: "bg-amber-100 text-amber-800",
  course_manager: "bg-indigo-100 text-indigo-800",
  events_manager: "bg-pink-100 text-pink-800",
  finance: "bg-teal-100 text-teal-800",
  support: "bg-orange-100 text-orange-800",
  read_only: "bg-slate-100 text-slate-600",
};

function RolePill({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[role] ?? "bg-slate-100 text-slate-600"}`}>
      {ROLE_LABELS[role as Role] ?? role}
    </span>
  );
}

function InviteStatus({ user }: { user: any }) {
  if (!user.clerkUserId?.startsWith("pending:")) {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><UserRoundCheck className="mr-1 h-3 w-3" />Connected</Badge>;
  }
  if (user.inviteStatus === "failed") {
    return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Invite failed</Badge>;
  }
  if (user.inviteStatus === "existing_user") {
    return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Existing Clerk user</Badge>;
  }
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Mail className="mr-1 h-3 w-3" />Invite pending</Badge>;
}

export default function AdminUsers() {
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.list);
  const sites = useQuery(api.sites.list);
  const { toast } = useToast();

  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const deleteUser = useMutation(api.users.remove);
  const markInvite = useMutation(api.invitationState.mark);
  const sendClerkInvite = useAction(api.clerkInvitations.invite);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [assignments, setAssignments] = useState<RoleAssignmentForm[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (me === undefined) return <div className="p-8"><Skeleton className="mb-6 h-10 w-48" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setIsSuperAdmin(false);
    setIsActive(true);
    setAssignments([]);
    setDialogOpen(true);
  }

  function openEdit(user: any) {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setIsSuperAdmin(user.isSuperAdmin);
    setIsActive(user.isActive);
    setAssignments((user.roleAssignments ?? []).map((role: any) => ({ siteId: String(role.siteId), role: role.role })));
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const roleAssignments = assignments
      .filter((assignment) => assignment.siteId && assignment.role)
      .map((assignment) => ({ siteId: assignment.siteId as Id<"sites">, role: assignment.role }));

    if (!isSuperAdmin && roleAssignments.length === 0) {
      toast({ title: "Assign at least one website role", description: "Client users need a site-scoped role before an invitation is sent.", variant: "destructive" });
      return;
    }

    setIsPending(true);
    try {
      if (editing) {
        await updateUser({ userId: editing._id, name, isSuperAdmin, isActive, roleAssignments });
        toast({ title: "User updated" });
        setDialogOpen(false);
        return;
      }

      await createUser({ name, email, isSuperAdmin, roleAssignments });

      try {
        const invite = await sendClerkInvite({ email });
        if (invite.status === "invited") {
          await markInvite({ email, status: "invited", clerkInvitationId: invite.invitationId });
          toast({ title: "Invitation sent", description: `${email} can now accept the Clerk invitation and sign in.` });
        } else {
          await markInvite({ email, status: "existing_user" });
          toast({ title: "User already has Clerk access", description: `The dashboard role is ready. ${email} can sign in at fstsclientsystem.com/sign-in.` });
        }
      } catch (inviteError) {
        const message = inviteError instanceof Error ? inviteError.message : String(inviteError);
        await markInvite({ email, status: "failed", error: message }).catch(() => undefined);
        toast({
          title: "Dashboard user created, but Clerk invitation failed",
          description: `${message}. The site role is saved and the invitation can be retried after configuration is corrected.`,
          variant: "destructive",
        });
      }

      setDialogOpen(false);
    } catch (error) {
      toast({ title: "Something went wrong", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteUser({ userId: deleteTarget._id });
      toast({ title: "User removed" });
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Couldn't remove user", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  const clientUsers = (users ?? []).filter((user: any) => !user.isSuperAdmin);
  const connectedUsers = clientUsers.filter((user: any) => !user.clerkUserId?.startsWith("pending:")).length;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Platform Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="mt-1 text-sm text-slate-500">Create client access, assign site-scoped roles, and issue secure Clerk invitations.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Invite User</Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Client users</p><p className="mt-1 text-2xl font-semibold text-slate-900">{clientUsers.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Clerk connected</p><p className="mt-1 text-2xl font-semibold text-slate-900">{connectedUsers}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sites available</p><p className="mt-1 text-2xl font-semibold text-slate-900">{sites?.length ?? 0}</p></div>
      </div>

      {users === undefined ? (
        <div className="space-y-3">{[1, 2, 3].map((row) => <Skeleton key={row} className="h-20 w-full" />)}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Access</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(users ?? []).map((user: any) => (
                  <tr key={user._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4"><p className="font-medium text-slate-900">{user.name}</p><p className="mt-0.5 text-xs text-slate-500">{user.email}</p></td>
                    <td className="px-4 py-4">
                      {user.isSuperAdmin ? <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" />Super Admin</Badge> : (
                        <div className="flex flex-wrap gap-1.5">{(user.roleAssignments ?? []).length === 0 ? <span className="text-xs text-slate-400">No sites</span> : (user.roleAssignments ?? []).map((role: any) => <span key={role.siteId} className="inline-flex items-center gap-1 text-xs"><span className="text-slate-400">{role.siteName}:</span><RolePill role={role.role} /></span>)}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">{user.isSuperAdmin ? <Badge variant="outline">Platform access</Badge> : <InviteStatus user={user} />}</td>
                    <td className="px-4 py-4">{user.isActive ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge> : <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Deactivated</Badge>}</td>
                    <td className="px-4 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => openEdit(user)} aria-label={`Edit ${user.name}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget(user)} aria-label={`Remove ${user.name}`}><Trash2 className="h-4 w-4 text-red-500" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit User" : "Invite Dashboard User"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(event) => setName(event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input required type="email" disabled={!!editing} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"><div><Label>Super Admin</Label><p className="mt-0.5 text-xs text-slate-500">Platform-wide FSTS access. Do not enable for client users.</p></div><Switch checked={isSuperAdmin} onCheckedChange={setIsSuperAdmin} /></div>
            {editing && <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><Label>Active</Label><p className="mt-0.5 text-xs text-slate-500">Deactivate to immediately block dashboard access.</p></div><Switch checked={isActive} onCheckedChange={setIsActive} /></div>}

            {!isSuperAdmin && (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><div><Label>Site Role Assignments</Label><p className="mt-0.5 text-xs text-slate-500">Client access stays limited to the selected website.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setAssignments([...assignments, { siteId: "", role: "content_editor" }])}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
                {assignments.map((assignment, index) => (
                  <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <Select value={assignment.siteId} onValueChange={(value) => { const next = [...assignments]; next[index] = { ...assignment, siteId: value }; setAssignments(next); }}><SelectTrigger className="bg-white"><SelectValue placeholder="Choose website" /></SelectTrigger><SelectContent>{sites?.map((site: any) => <SelectItem key={site._id} value={site._id}>{site.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={assignment.role} onValueChange={(value) => { const next = [...assignments]; next[index] = { ...assignment, role: value }; setAssignments(next); }}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent></Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAssignments(assignments.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                {assignments.length === 0 && <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">Add a website role before inviting a client. For Corsair testing, select Corsair and assign the Owner role.</div>}
              </div>
            )}

            {!editing && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">Saving creates the site-scoped Convex account first, then sends the Clerk invitation. If Clerk delivery fails, the role remains safely saved and the user stays pending.</div>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? (editing ? "Saving…" : "Creating & inviting…") : editing ? "Save Changes" : "Create & Send Invite"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove “{deleteTarget?.name}”?</AlertDialogTitle><AlertDialogDescription>This removes the dashboard user and all site role assignments. It does not delete their Clerk identity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">{isDeleting ? "Removing…" : "Remove User"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
