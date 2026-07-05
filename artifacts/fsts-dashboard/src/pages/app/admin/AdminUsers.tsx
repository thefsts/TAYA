import { useState } from "react";
import {
  useGetMe,
  useListUsers,
  useListSites,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  Role,
  type DashboardUser,
} from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  client_admin: "Client Admin",
  editor: "Editor",
  marketing: "Marketing",
  training_manager: "Training Manager",
  read_only: "Read Only",
};

type RoleAssignmentForm = { siteId: string; role: string };

export default function AdminUsers() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: sites } = useListSites();
  const { toast } = useToast();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [assignments, setAssignments] = useState<RoleAssignmentForm[]>([]);

  if (meLoading) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (me && !me.isSuperAdmin) return <Redirect to="/app" />;

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setIsSuperAdmin(false);
    setIsActive(true);
    setAssignments([]);
    setDialogOpen(true);
  }

  function openEdit(u: DashboardUser) {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setIsSuperAdmin(u.isSuperAdmin);
    setIsActive(u.isActive);
    setAssignments(u.roleAssignments.map((r) => ({ siteId: String(r.siteId), role: r.role })));
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const roleAssignments = assignments
      .filter((a) => a.siteId && a.role)
      .map((a) => ({ siteId: parseInt(a.siteId, 10), role: a.role as (typeof Role)[keyof typeof Role] }));

    if (editing) {
      updateMutation.mutate(
        { userId: editing.id, data: { name, isSuperAdmin, isActive, roleAssignments } },
        {
          onSuccess: () => {
            toast({ title: "User updated" });
            setDialogOpen(false);
          },
          onError: (err) =>
            toast({
              title: "Something went wrong",
              description: err instanceof Error ? err.message : String(err),
              variant: "destructive",
            }),
        },
      );
    } else {
      createMutation.mutate(
        { data: { name, email, isSuperAdmin, roleAssignments } },
        {
          onSuccess: () => {
            toast({ title: "User created" });
            setDialogOpen(false);
          },
          onError: (err) =>
            toast({
              title: "Something went wrong",
              description: err instanceof Error ? err.message : String(err),
              variant: "destructive",
            }),
        },
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { userId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "User removed" });
          setDeleteTarget(null);
        },
        onError: (err) =>
          toast({
            title: "Couldn't remove user",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
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

      {usersLoading ? (
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
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isSuperAdmin ? (
                      <Badge variant="secondary">Super Admin</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roleAssignments.length === 0 ? (
                          <span className="text-slate-400 text-xs">No sites</span>
                        ) : (
                          user.roleAssignments.map((r) => (
                            <Badge key={r.siteId} variant="outline">
                              {r.siteName}: {ROLE_LABELS[r.role] ?? r.role}
                            </Badge>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{user.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(user)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
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
                    onClick={() => setAssignments([...assignments, { siteId: "", role: Role.editor }])}
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
                      <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
                      <SelectContent>
                        {sites?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={a.role} onValueChange={(v) => {
                      const next = [...assignments];
                      next[i] = { ...a, role: v };
                      setAssignments(next);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(Role).filter((r) => r !== Role.super_admin).map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAssignments(assignments.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving…" : "Save"}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
