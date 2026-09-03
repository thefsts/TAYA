import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, Building2, Globe, Mail, Link as LinkIcon,
  ShieldCheck, Users, LayoutGrid,
} from "lucide-react";
import {
  AGENCY_FEATURE_FLAGS,
  AGENCY_FEATURE_FLAG_LABELS,
  AGENCY_FEATURE_FLAG_DESCRIPTIONS,
} from "@/lib/roleCapabilities";

export default function AdminAgencies() {
  const me = useQuery(api.users.me);
  const agencies = useQuery(api.agencies.list);
  const sites = useQuery(api.sites.list);
  const users = useQuery(api.users.list);
  const { toast } = useToast();

  const createAgency = useMutation(api.agencies.create);
  const updateAgency = useMutation(api.agencies.update);
  const removeAgency = useMutation(api.agencies.remove);
  const assignSite = useMutation(api.agencies.assignSite);
  const assignAdmin = useMutation(api.agencies.assignAdmin);
  const updateFlags = useMutation(api.agencies.updateFeatureFlags);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    primaryColor: "#1d4ed8",
    accentColor: "#0f172a",
    supportEmail: "",
    helpCenterUrl: "",
    billingNotes: "",
  });
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  function openCreate() {
    setEditing(null);
    setForm({ name: "", slug: "", logoUrl: "", primaryColor: "#1d4ed8", accentColor: "#0f172a", supportEmail: "", helpCenterUrl: "", billingNotes: "" });
    setFeatureFlags(Object.fromEntries(AGENCY_FEATURE_FLAGS.map((f) => [f, true])));
    setActiveTab("details");
    setDialogOpen(true);
  }

  function openEdit(agency: any) {
    setEditing(agency);
    setForm({
      name: agency.name,
      slug: agency.slug,
      logoUrl: agency.logoUrl ?? "",
      primaryColor: agency.primaryColor,
      accentColor: agency.accentColor,
      supportEmail: agency.supportEmail,
      helpCenterUrl: agency.helpCenterUrl ?? "",
      billingNotes: agency.billingNotes ?? "",
    });
    setFeatureFlags(agency.featureFlags ?? {});
    setActiveTab("details");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    try {
      if (editing) {
        await updateAgency({
          agencyId: editing._id,
          name: form.name,
          logoUrl: form.logoUrl || undefined,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          supportEmail: form.supportEmail,
          helpCenterUrl: form.helpCenterUrl || undefined,
          featureFlags,
          billingNotes: form.billingNotes || undefined,
        });
        toast({ title: "Agency updated" });
      } else {
        await createAgency({
          name: form.name,
          slug: form.slug,
          logoUrl: form.logoUrl || undefined,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          supportEmail: form.supportEmail,
          helpCenterUrl: form.helpCenterUrl || undefined,
          featureFlags,
          billingNotes: form.billingNotes || undefined,
        });
        toast({ title: "Agency created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeAgency({ agencyId: deleteTarget._id });
      toast({ title: "Agency deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  async function toggleSiteAssignment(siteId: string, currentAgencyId: string | undefined) {
    if (!selectedAgency) return;
    try {
      if (currentAgencyId === selectedAgency._id) {
        await assignSite({ siteId: siteId as Id<"sites">, agencyId: undefined });
        toast({ title: "Site unassigned from agency" });
      } else {
        await assignSite({ siteId: siteId as Id<"sites">, agencyId: selectedAgency._id });
        toast({ title: "Site assigned to agency" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function toggleUserAdmin(userId: string, currentAgencyId: string | undefined) {
    if (!selectedAgency) return;
    try {
      if (currentAgencyId === selectedAgency._id) {
        await assignAdmin({ userId: userId as Id<"users">, agencyId: undefined, isAgencyAdmin: false });
        toast({ title: "Agency admin removed" });
      } else {
        await assignAdmin({ userId: userId as Id<"users">, agencyId: selectedAgency._id, isAgencyAdmin: true });
        toast({ title: "Agency admin assigned" });
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/app" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Agencies</h1>
          <p className="text-sm text-slate-500 mt-0.5">White-label agency partners on the TAYA™ platform.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Agency
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agency list */}
        <div className="lg:col-span-1">
          {agencies === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
            </div>
          ) : agencies === null || agencies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-md p-8 text-center text-slate-500 text-sm">
              No agencies yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {agencies.map((agency: any) => (
                <button
                  key={agency._id}
                  onClick={() => setSelectedAgency(agency)}
                  className={`w-full text-left bg-white border rounded-md p-4 transition-colors ${
                    selectedAgency?._id === agency._id
                      ? "border-primary ring-1 ring-primary/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {agency.logoUrl ? (
                      <img src={agency.logoUrl} alt={agency.name} className="h-8 w-8 rounded object-contain border border-slate-100" />
                    ) : (
                      <div className="h-8 w-8 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: agency.primaryColor }}>
                        {agency.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{agency.name}</div>
                      <div className="text-xs text-slate-500 truncate">{agency.slug}</div>
                    </div>
                    <Badge variant={agency.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">
                      {agency.licensingStatus}
                    </Badge>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost" size="sm"
                      onClick={(e) => { e.stopPropagation(); openEdit(agency); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(agency); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Agency detail panel */}
        <div className="lg:col-span-2">
          {!selectedAgency ? (
            <div className="bg-white border border-slate-200 rounded-md p-12 text-center text-slate-400">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select an agency to view details, assign sites, and manage admins.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                {selectedAgency.logoUrl ? (
                  <img src={selectedAgency.logoUrl} alt={selectedAgency.name} className="h-10 w-10 rounded object-contain border border-slate-100" />
                ) : (
                  <div className="h-10 w-10 rounded flex items-center justify-center text-white font-bold" style={{ backgroundColor: selectedAgency.primaryColor }}>
                    {selectedAgency.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-slate-900">{selectedAgency.name}</h2>
                  <p className="text-xs text-slate-500">/{selectedAgency.slug}</p>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="p-5">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview"><Globe className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
                  <TabsTrigger value="sites"><LayoutGrid className="h-3.5 w-3.5 mr-1.5" />Sites</TabsTrigger>
                  <TabsTrigger value="admins"><Users className="h-3.5 w-3.5 mr-1.5" />Admins</TabsTrigger>
                  <TabsTrigger value="flags"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Features</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Support Email</div>
                      <a href={`mailto:${selectedAgency.supportEmail}`} className="text-primary hover:underline flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {selectedAgency.supportEmail}
                      </a>
                    </div>
                    {selectedAgency.helpCenterUrl && (
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">Help Center</div>
                        <a href={selectedAgency.helpCenterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3.5 w-3.5" /> View Help Center
                        </a>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Primary Color</div>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: selectedAgency.primaryColor }} />
                        <span className="font-mono text-xs">{selectedAgency.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Accent Color</div>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded border border-slate-200" style={{ backgroundColor: selectedAgency.accentColor }} />
                        <span className="font-mono text-xs">{selectedAgency.accentColor}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Licensing Status</div>
                      <Badge variant={selectedAgency.licensingStatus === "active" ? "default" : "destructive"}>
                        {selectedAgency.licensingStatus}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Active</div>
                      <Badge variant={selectedAgency.isActive ? "default" : "secondary"}>
                        {selectedAgency.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  {selectedAgency.billingNotes && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">Billing Notes</div>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded p-3 border border-slate-200">{selectedAgency.billingNotes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sites">
                  <div className="text-xs text-slate-500 mb-3">Toggle site assignment to this agency. Assigned sites are only visible to this agency's admins.</div>
                  {sites === undefined ? (
                    <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                      {(sites ?? []).map((site: any) => (
                        <div key={site._id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{site.name}</div>
                            <div className="text-xs text-slate-500">{site.slug}</div>
                          </div>
                          <Switch
                            checked={String(site.agencyId) === String(selectedAgency._id)}
                            onCheckedChange={() => toggleSiteAssignment(site._id, site.agencyId)}
                          />
                        </div>
                      ))}
                      {(sites ?? []).length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">No sites on this platform yet.</div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="admins">
                  <div className="text-xs text-slate-500 mb-3">Agency admins can log in and see only this agency's sites. They cannot access platform settings.</div>
                  {users === undefined ? (
                    <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                      {(users ?? []).filter((u: any) => !u.isSuperAdmin).map((user: any) => (
                        <div key={user._id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                          <Switch
                            checked={String(user.agencyId) === String(selectedAgency._id) && !!user.isAgencyAdmin}
                            onCheckedChange={() => toggleUserAdmin(user._id, user.agencyId)}
                          />
                        </div>
                      ))}
                      {(users ?? []).filter((u: any) => !u.isSuperAdmin).length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">No non-superadmin users yet.</div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="flags">
                  <div className="text-xs text-slate-500 mb-3">Platform features available to this agency's clients. Changes take effect immediately.</div>
                  <AgencyFeatureFlagsEditor
                    agencyId={selectedAgency._id}
                    featureFlags={selectedAgency.featureFlags ?? {}}
                    onUpdate={async (flags) => {
                      try {
                        await updateFlags({ agencyId: selectedAgency._id, featureFlags: flags });
                        toast({ title: "Feature flags updated" });
                      } catch (err) {
                        toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
                      }
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Agency" : "Create Agency"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="details" className="mt-2">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Agency Name *</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Digital Agency" />
                </div>
                {!editing && (
                  <div className="space-y-1.5">
                    <Label>Slug *</Label>
                    <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="acme-digital" />
                    <p className="text-xs text-slate-500">Used in subdomain routing (e.g. acme-digital.yourdomain.com). Cannot be changed later.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Support Email *</Label>
                  <Input required type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} placeholder="support@acme.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Help Center URL</Label>
                  <Input type="url" value={form.helpCenterUrl} onChange={(e) => setForm({ ...form, helpCenterUrl: e.target.value })} placeholder="https://help.acme.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Notes</Label>
                  <Textarea value={form.billingNotes} onChange={(e) => setForm({ ...form, billingNotes: e.target.value })} placeholder="Manual billing notes, contract details, renewal dates…" rows={3} />
                </div>
              </TabsContent>

              <TabsContent value="branding" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Logo URL</Label>
                  <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://cdn.acme.com/logo.png" />
                  <p className="text-xs text-slate-500">Shown in the dashboard header and login page for agency-assigned sites.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" className="w-12 h-9 p-1 cursor-pointer" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                      <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="font-mono text-sm flex-1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" className="w-12 h-9 p-1 cursor-pointer" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
                      <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="font-mono text-sm flex-1" />
                    </div>
                  </div>
                </div>
                {form.logoUrl && (
                  <div className="border border-slate-200 rounded-md p-4 bg-slate-50">
                    <p className="text-xs text-slate-500 mb-2">Logo preview</p>
                    <img src={form.logoUrl} alt="Logo preview" className="h-10 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="features" className="space-y-3">
                <p className="text-xs text-slate-500">Select which platform features are available to this agency's clients.</p>
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {AGENCY_FEATURE_FLAGS.map((flag) => (
                    <div key={flag} className="flex items-start justify-between px-4 py-3">
                      <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-slate-800">{AGENCY_FEATURE_FLAG_LABELS[flag]}</div>
                        <div className="text-xs text-slate-500">{AGENCY_FEATURE_FLAG_DESCRIPTIONS[flag]}</div>
                      </div>
                      <Switch
                        checked={featureFlags[flag] ?? false}
                        onCheckedChange={(v) => setFeatureFlags((f) => ({ ...f, [flag]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This agency record will be permanently removed. Assigned sites will be unlinked but not deleted.</AlertDialogDescription>
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

function AgencyFeatureFlagsEditor({
  agencyId,
  featureFlags,
  onUpdate,
}: {
  agencyId: string;
  featureFlags: Record<string, boolean>;
  onUpdate: (flags: Record<string, boolean>) => Promise<void>;
}) {
  const [local, setLocal] = useState<Record<string, boolean>>({ ...featureFlags });
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(local) !== JSON.stringify(featureFlags);

  return (
    <div className="space-y-3">
      <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
        {AGENCY_FEATURE_FLAGS.map((flag) => (
          <div key={flag} className="flex items-start justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <div className="text-sm font-medium text-slate-800">{AGENCY_FEATURE_FLAG_LABELS[flag]}</div>
              <div className="text-xs text-slate-500">{AGENCY_FEATURE_FLAG_DESCRIPTIONS[flag]}</div>
            </div>
            <Switch
              checked={local[flag] ?? false}
              onCheckedChange={(v) => setLocal((f) => ({ ...f, [flag]: v }))}
            />
          </div>
        ))}
      </div>
      {hasChanges && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onUpdate(local);
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save Feature Flags"}
          </Button>
        </div>
      )}
    </div>
  );
}
