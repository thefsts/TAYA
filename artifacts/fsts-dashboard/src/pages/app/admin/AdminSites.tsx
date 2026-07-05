import { useState } from "react";
import {
  useGetMe,
  useListSites,
  useCreateSite,
  useUpdateSite,
  useDeleteSite,
  SiteStatus,
  WebsiteType,
  type Site,
  type EnabledModules,
} from "@workspace/api-client-react";
import {
  WEBSITE_TYPE_OPTIONS,
  WEBSITE_TYPE_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  defaultModulesForWebsiteType,
} from "@/lib/siteModules";
import { Redirect, Link } from "wouter";
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

export default function AdminSites() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: sites, isLoading: sitesLoading } = useListSites();
  const { toast } = useToast();

  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();
  const deleteMutation = useDeleteSite();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    status: SiteStatus.staging as string,
    domain: "",
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: WebsiteType.business_website as string,
    enabledModules: defaultModulesForWebsiteType(WebsiteType.business_website) as EnabledModules,
  });

  if (meLoading) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (me && !me.isSuperAdmin) return <Redirect to="/app" />;

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      status: SiteStatus.staging,
      domain: "",
      brandColorPrimary: "#1d4ed8",
      brandColorSecondary: "#0f172a",
      whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: WebsiteType.business_website,
      enabledModules: defaultModulesForWebsiteType(WebsiteType.business_website),
    });
    setDialogOpen(true);
  }

  function openEdit(s: Site) {
    setEditing(s);
    setForm({
      name: s.name,
      slug: s.slug,
      status: s.status,
      domain: s.domain ?? "",
      brandColorPrimary: s.brandColorPrimary,
      brandColorSecondary: s.brandColorSecondary,
      whiteLabelEnabled: s.whiteLabelEnabled ?? false,
      poweredByFsts: s.poweredByFsts ?? true,
      websiteType: s.websiteType,
      enabledModules: s.enabledModules ?? defaultModulesForWebsiteType(s.websiteType),
    });
    setDialogOpen(true);
  }

  function handleWebsiteTypeChange(type: string) {
    setForm((f) => ({ ...f, websiteType: type, enabledModules: defaultModulesForWebsiteType(type) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate(
        {
          siteId: editing.id,
          data: {
            name: form.name,
            status: form.status as (typeof SiteStatus)[keyof typeof SiteStatus],
            domain: form.domain || undefined,
            brandColorPrimary: form.brandColorPrimary,
            brandColorSecondary: form.brandColorSecondary,
            whiteLabelEnabled: form.whiteLabelEnabled,
            poweredByFsts: form.poweredByFsts,
            websiteType: form.websiteType as (typeof WebsiteType)[keyof typeof WebsiteType],
            enabledModules: form.enabledModules,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Site updated" });
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
        {
          data: {
            name: form.name,
            slug: form.slug,
            status: form.status as (typeof SiteStatus)[keyof typeof SiteStatus],
            domain: form.domain || undefined,
            brandColorPrimary: form.brandColorPrimary,
            brandColorSecondary: form.brandColorSecondary,
            whiteLabelEnabled: form.whiteLabelEnabled,
            poweredByFsts: form.poweredByFsts,
            websiteType: form.websiteType as (typeof WebsiteType)[keyof typeof WebsiteType],
            enabledModules: form.enabledModules,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Site created" });
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
      { siteId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Site deleted" });
          setDeleteTarget(null);
        },
        onError: (err) =>
          toast({
            title: "Couldn't delete site",
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
          <h1 className="text-2xl font-bold text-slate-900">Global Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">Client sites managed on this platform.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Site
        </Button>
      </div>

      {sitesLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Slug</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-500">Domain</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites?.map((site) => (
                <tr key={site.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/app/sites/${site.id}`} className="hover:underline">{site.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{site.slug}</td>
                  <td className="px-4 py-3 text-slate-500">{WEBSITE_TYPE_LABELS[site.websiteType] ?? site.websiteType}</td>
                  <td className="px-4 py-3">
                    <Badge variant={site.status === "active" ? "default" : "secondary"}>{site.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{site.domain ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(site)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(site)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {sites?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No sites found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Site" : "Create Site"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input required disabled={!!editing} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SiteStatus.active}>Active</SelectItem>
                  <SelectItem value={SiteStatus.staging}>Staging</SelectItem>
                  <SelectItem value={SiteStatus.archived}>Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Input placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Website Type</Label>
              <Select value={form.websiteType} onValueChange={handleWebsiteTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input type="color" value={form.brandColorPrimary} onChange={(e) => setForm({ ...form, brandColorPrimary: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Brand Color</Label>
                <Input type="color" value={form.brandColorSecondary} onChange={(e) => setForm({ ...form, brandColorSecondary: e.target.value })} />
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
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>All content for this site will be permanently removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
