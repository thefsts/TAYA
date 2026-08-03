import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Plus, Pencil, Trash2, Mail } from "lucide-react";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type Role,
} from "@/lib/roleCapabilities";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const label = ROLE_LABELS[role as Role] ?? role;
  const color = ROLE_BADGE_COLORS[role] ?? "bg-slate-100 text-slate-600";
  const description = ROLE_DESCRIPTIONS[role as Role];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-default ${color}`}>
          {label}
        </span>
      </TooltipTrigger>
      {description && (
        <TooltipContent side="top" className="max-w-xs text-xs">
          {description}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export default function AdminUsers() {
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.list);
  const sites = useQuery(api.sites.list);
  const { toast } = useToast();

  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const deleteUser = useMutation(api.users.remove);
  const previewEmail = useAction(api.email.previewDashboardWelcome);

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
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

  function openEdit(u: any) {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setIsSuperAdmin(u.isSuperAdmin);
    setIsActive(u.isActive);
    setAssignments((u.roleAssignments ?? []).map((r: any) => ({ siteId: String(r.siteId), role: r.role })));
    setDialogOpen(true);
  }

  async function handlePreview() {
    if (!name || !email) {
      toast({ title: "Enter a name and email first", variant: "destructive" });
      return;
    }
    setIsLoadingPreview(true);
    try {
      const result = await previewEmail({ recipientName: name, recipientEmail: email });
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
      setPreviewOpen(true);
    } catch (err) {
      toast({
        title: "Couldn't load preview",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const roleAssignments = assignments
      .filter((a) => a.siteId && a.role)
      .map((a) => ({ siteId: a.siteId as Id<"sites">, role: a.role }));

    setIsPending(true);
    try {
      if (editing) {
        await updateUser({ userId: editing._id, name, isSuperAdmin, isActive, roleAssignments });
        toast({ title: "User updated" });
      } else {
        await createUser({ name, email, isSuperAdmin, roleAssignments });
        toast({ title: "User created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
    } catch (err) {
      toast({
        title: "Couldn't remove user",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Dashboard users and their per-site role assignments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Invite User
        </Button>
      </div>

      {users === undefined ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Roles</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users ?? []).map((user: any) => (
                <tr key={user._id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isSuperAdmin ? (
                      <Badge variant="secondary">Super Admin</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(user.roleAssignments ?? []).length === 0 ? (
                          <span className="text-slate-400 text-xs">No sites</span>
                        ) : (
                          (user.roleAssignments ?? []).map((r: any) => (
                            <span key={r.siteId} className="inline-flex items-center gap-1 text-xs">
                              <span className="text-slate-500">{r.siteName}:</span>
                              <RolePill role={r.role} />
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">Deactivated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(user)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Invite User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input required type="email" disabled={!!editing} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex items-center justify-between py-1">
              <Label>Super Admin</Label>
              <Switch checked={isSuperAdmin} onCheckedChange={setIsSuperAdmin} />
            </div>
            {editing && (
              <div className="flex items-center justify-between py-1">
                <Label>Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}

            {!isSuperAdmin && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Site Role Assignments</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignments([...assignments, { siteId: "", role: "content_editor" }])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={a.siteId} onValueChange={(v) => {
                      const next = [...assignments];
                      next[i] = { ...a, siteId: v };
                      setAssignments(next);
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Site" /></SelectTrigger>
                      <SelectContent>
                        {sites?.map((s: any) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={a.role} onValueChange={(v) => {
                      const next = [...assignments];
                      next[i] = { ...a, role: v };
                      setAssignments(next);
                    }}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            <div>
                              <div className="font-medium text-sm">{ROLE_LABELS[r]}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAssignments(assignments.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                {assignments.length === 0 && (
                  <p className="text-xs text-slate-400">No site assignments yet. Add one above.</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {!editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isLoadingPreview || !name || !email}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isLoadingPreview ? "Loading…" : "Preview email"}
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This user will lose access to all sites. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email preview dialog — dry-run view of the welcome email before saving */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              Email preview
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This is the welcome email that will be sent to <strong>{email}</strong> when you save.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-slate-200 rounded-md overflow-hidden flex-1 min-h-0">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Subject: </span>{previewSubject}
            </div>
            <div className="overflow-auto p-4 bg-white h-full">
              {previewHtml && (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
