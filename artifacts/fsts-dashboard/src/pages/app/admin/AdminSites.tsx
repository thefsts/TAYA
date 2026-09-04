import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  WEBSITE_TYPE_OPTIONS,
  WEBSITE_TYPE_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  defaultModulesForWebsiteType,
} from "@/lib/siteModules";
import { Redirect, Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
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
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus, UserRoundCheck, UserRoundX } from "lucide-react";

type SiteStatus = "active" | "staging" | "archived";
type WebsiteType = string;
type EnabledModules = Record<string, boolean>;

export default function AdminSites() {
  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.list);
  const clientAssignments = useQuery(api.sites.getClientAssignments);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const createSite = useMutation(api.sites.create);
  const updateSite = useMutation(api.sites.update);
  const deleteSite = useMutation(api.sites.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    status: "staging" as SiteStatus,
    domain: "",
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "business_website" as WebsiteType,
    enabledModules: defaultModulesForWebsiteType("business_website") as EnabledModules,
  });
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      status: "staging",
      domain: "",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: defaultModulesForWebsiteType("business_website"),
    });
    setDialogOpen(true);
  }

  function openEdit(s: any) {
    setEditing(s);
    setForm({
      name: s.name,
      slug: s.slug,
      status: s.status as SiteStatus,
      domain: s.domain ?? "",
      brandColorPrimary: s.brandColorPrimary,
      brandColorSecondary: s.brandColorSecondary,
      whiteLabelEnabled: s.whiteLabelEnabled ?? false,
      poweredByFsts: s.poweredByFsts ?? true,
      websiteType: s.websiteType,
      enabledModules: (s.enabledModules as EnabledModules) ?? defaultModulesForWebsiteType(s.websiteType),
    });
    setDialogOpen(true);
  }

  function handleWebsiteTypeChange(type: string) {
    setForm((f) => ({ ...f, websiteType: type, enabledModules: defaultModulesForWebsiteType(type) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    try {
      if (editing) {
        await updateSite({
          siteId: editing._id,
          name: form.name,
          status: form.status,
          domain: form.domain || undefined,
          brandColorPrimary: form.brandColorPrimary,
          brandColorSecondary: form.brandColorSecondary,
          whiteLabelEnabled: form.whiteLabelEnabled,
          poweredByFsts: form.poweredByFsts,
          websiteType: form.websiteType,
          enabledModules: form.enabledModules,
        });
        toast({ title: "Site updated" });
        setDialogOpen(false);
      } else {
        const site = await createSite({
          name: form.name,
          slug: form.slug,
          status: form.status,
          domain: form.domain || undefined,
          brandColorPrimary: form.brandColorPrimary,
          brandColorSecondary: form.brandColorSecondary,
          whiteLabelEnabled: form.whiteLabelEnabled,
          poweredByFsts: form.poweredByFsts,
          websiteType: form.websiteType,
          enabledModules: form.enabledModules,
        });
        toast({
          title: "Site created",
          description: "Next: assign the client owner so their Admin Login opens only this website.",
        });
        setDialogOpen(false);
        navigate(`/app/admin/users?invite=1&siteId=${encodeURIComponent(String(site._id))}`);
      }
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
      await deleteSite({ siteId: deleteTarget._id });
      toast({ title: "Site deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete site",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // Client assignment status per site — powers the "Client" column.
  const assignmentBySite = new Map<string, any>();
  for (const row of clientAssignments ?? []) {
    assignmentBySite.set(String(row.siteId), row.owner);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Global Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">Client sites managed on this platform.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Site
        </Button>
      </div>

      {sites === undefined ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : sites === null ? (
        <ModuleAccessDenied message="Unable to load sites list — you may not have sufficient access." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Slug</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Domain</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Client</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((site: any) => (
                <tr key={site._id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/app/sites/${site._id}`} className="hover:underline">{site.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{site.slug}</td>
                  <td className="px-4 py-3 text-slate-500">{WEBSITE_TYPE_LABELS[site.websiteType] ?? site.websiteType}</td>
                  <td className="px-4 py-3">
                    <Badge variant={site.status === "active" ? "default" : "secondary"}>{site.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{site.domain ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const owner = assignmentBySite.get(String(site._id));
                      if (!owner) {
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                              <UserRoundX className="mr-1 h-3 w-3" />Not assigned
                            </Badge>
                            <Button
                              aria-label={`Assign client to ${site.name}`}
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/app/admin/users?invite=1&siteId=${site._id}`)}
                            >
                              <UserPlus className="mr-1 h-3.5 w-3.5" />Assign Client
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            <UserRoundCheck className="mr-1 h-3 w-3" />
                            {owner.ownerConnected ? `${owner.ownerName} (owner)` : `${owner.ownerName} — invite ${owner.ownerEmail}`}
                          </Badge>
                          <Button
                            aria-label={`Manage client access for ${site.name}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/app/admin/users?invite=1&siteId=${site._id}`)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button aria-label="Edit" variant="ghost" size="sm" onClick={() => openEdit(site)}><Pencil className="h-4 w-4" /></Button>
                    <Button aria-label="Delete" variant="ghost" size="sm" onClick={() => setDeleteTarget(site)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {sites.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No sites found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-lg flex-col overflow-hidden p-0 sm:max-h-[calc(100vh-3rem)]">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-12">
            <DialogTitle>{editing ? "Edit Site" : "Create Site"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input aria-label="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input aria-label="slug" required disabled={!!editing} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SiteStatus })}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Input aria-label="example.com" placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Website Type</Label>
                <Select value={form.websiteType} onValueChange={handleWebsiteTypeChange}>
                  <SelectTrigger aria-label="Website Type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEBSITE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Sets sensible default modules below. You can still adjust each toggle.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Enabled Modules</Label>
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {MODULE_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-slate-700">{MODULE_LABELS[key]}</span>
                      <Switch
                        checked={form.enabledModules[key]}
                        onCheckedChange={(v) =>
                          setForm((f) => ({ ...f, enabledModules: { ...f.enabledModules, [key]: v } }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Primary Brand Color</Label>
                  <Input aria-label="brand color primary" type="color" value={form.brandColorPrimary} onChange={(e) => setForm({ ...form, brandColorPrimary: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Secondary Brand Color</Label>
                  <Input aria-label="brand color secondary" type="color" value={form.brandColorSecondary} onChange={(e) => setForm({ ...form, brandColorSecondary: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <Label>White Label Enabled</Label>
                <Switch checked={form.whiteLabelEnabled} onCheckedChange={(v) => setForm({ ...form, whiteLabelEnabled: v })} />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label>"Powered by FSTS" Badge</Label>
                <Switch checked={form.poweredByFsts} onCheckedChange={(v) => setForm({ ...form, poweredByFsts: v })} />
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Create Site & Assign Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>All content for this site will be permanently removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
