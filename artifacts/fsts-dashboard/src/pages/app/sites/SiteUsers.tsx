import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Users, Search, Shield, Mail, Trash2, Crown, UserCog } from "lucide-react";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "content_editor", label: "Content Editor" },
  { value: "course_manager", label: "Course Manager" },
  { value: "events_manager", label: "Events Manager" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finance" },
  { value: "support", label: "Support" },
  { value: "read_only", label: "Read Only" },
];

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  owner: "default",
  manager: "default",
  content_editor: "secondary",
  course_manager: "secondary",
  events_manager: "secondary",
  marketing: "secondary",
  finance: "outline",
  support: "outline",
  read_only: "outline",
};

function roleLabel(role: string | null): string {
  if (!role) return "No role";
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

export default function SiteUsers({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const me = useQuery(api.users.me);
  const users = useQuery(api.users.listForSite, { siteId });
  const updateSiteRole = useMutation(api.users.updateSiteRole);
  const removeSiteRole = useMutation(api.users.removeSiteRole);

  const [searchQuery, setSearchQuery] = useState("");
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isSuperAdmin = me?.isSuperAdmin ?? false;

  async function handleRoleChange(userId: Id<"users">, newRole: string) {
    if (!isSuperAdmin) {
      toast({ title: "Only SuperAdmins can change roles", variant: "destructive" });
      return;
    }
    try {
      await updateSiteRole({ userId, siteId, role: newRole });
      toast({ title: "Role updated" });
    } catch (err) {
      toast({
        title: "Couldn't update role",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function handleRemoveUser() {
    if (!removeTarget) return;
    setIsPending(true);
    try {
      await removeSiteRole({ userId: removeTarget._id, siteId });
      toast({ title: "User removed from site" });
    } catch (err) {
      toast({
        title: "Couldn't remove user",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
      setRemoveTarget(null);
    }
  }

  if (users === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <ClientLoadingList rows={4} />
      </AppLayout>
    );
  }

  if (users === null) {
    return (
      <AppLayout siteId={params.siteId}>
        <ModuleAccessDenied message="You don't have access to view users for this site." />
      </AppLayout>
    );
  }

  const filteredUsers = users.filter((u: any) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role ?? "").toLowerCase().includes(q)
    );
  });

  const roleCounts: Record<string, number> = {};
  for (const u of users) {
    const r = u.role ?? "none";
    roleCounts[r] = (roleCounts[r] ?? 0) + 1;
  }

  return (
    <AppLayout siteId={params.siteId}>
      <ClientPageHeader
        eyebrow="Site Management"
        title="Site Users"
        description="View and manage who has access to this site workspace. Only SuperAdmins can assign or change roles."
        actions={
          isSuperAdmin ? (
            <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/5 text-primary">
              <Shield className="h-3.5 w-3.5" /> SuperAdmin
            </Badge>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" />Total Users
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Crown className="h-3.5 w-3.5" />Owners
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{roleCounts["owner"] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <UserCog className="h-3.5 w-3.5" />Managers
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {(roleCounts["manager"] ?? 0) + (roleCounts["content_editor"] ?? 0) + (roleCounts["course_manager"] ?? 0) + (roleCounts["events_manager"] ?? 0)}
          </p>
        </div>
      </div>

      {users.length > 0 && (
        <div className="mb-5 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            aria-label="Search users"
            placeholder="Search by name, email, or role…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <ClientSection
        title="Assigned Users"
        description={
          isSuperAdmin
            ? "Change a user's role using the dropdown. Remove a user to revoke their access to this site."
            : "You can view who has access to this site. Contact a SuperAdmin to add or change roles."
        }
      >
        {filteredUsers.length === 0 && users.length > 0 ? (
          <ClientEmptyState
            icon={Search}
            title="No users match your search"
            description="Try a different name, email, or role."
            action={
              <Button variant="link" size="sm" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            }
          />
        ) : users.length === 0 ? (
          <ClientEmptyState
            icon={Users}
            title="No users assigned to this site"
            description="Users with roles on this site will appear here. Assign roles from the Platform Admin → User Management page."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u: any) => (
                  <tr key={u._id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{u.name}</span>
                        {u.isSuperAdmin && (
                          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
                            <Crown className="h-3 w-3" /> SuperAdmin
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate max-w-xs">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.isSuperAdmin ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          Platform-level
                        </Badge>
                      ) : isSuperAdmin ? (
                        <Select
                          value={u.role ?? "none"}
                          onValueChange={(v) => v !== "none" && handleRoleChange(u._id, v)}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={ROLE_BADGE_VARIANT[u.role ?? ""] ?? "outline"}>
                          {roleLabel(u.role)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.inviteStatus === "pending" ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          Invitation Pending
                        </Badge>
                      ) : u.inviteStatus === "accepted" || !u.inviteStatus ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">{u.inviteStatus}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuperAdmin && !u.isSuperAdmin && (
                        <Button
                          aria-label="Remove from site"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setRemoveTarget(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClientSection>

      {!isSuperAdmin && users.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            You're viewing this site's users in read-only mode. Role assignments and removals are managed by SuperAdmins from the Platform Admin dashboard.
          </p>
        </div>
      )}

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name} from this site?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes their access to this site's CMS workspace. They will no longer be able to view or edit content for this site. Their account and roles on other sites are not affected. This can be re-assigned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? "Removing…" : "Remove Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
