import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { LockedField, DesignLockBanner } from "@/components/LockedField";

type SquareEnv = "sandbox" | "production";

export default function PaymentsConfig({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const config = useQuery(api.square.getConfig, { siteId });
  const updateSquareConfig = useMutation(api.square.updateConfig);

  const mappings = useQuery(api.square.listMappings, { siteId });
  const createSquareCatalogMapping = useMutation(api.square.createMapping);
  const updateSquareCatalogMapping = useMutation(api.square.updateMapping);
  const deleteSquareCatalogMapping = useMutation(api.square.removeMapping);

  const [environment, setEnvironment] = useState<SquareEnv>("sandbox");
  const [applicationId, setApplicationId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookSignatureKey, setWebhookSignatureKey] = useState("");
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (config) {
      setEnvironment((config.environment as SquareEnv) ?? "sandbox");
      setLocationId(config.locationId ?? "");
      setCheckoutEnabled(config.checkoutEnabled ?? false);
    }
  }, [config]);

  async function handleSaveConfig() {
    setIsSavingConfig(true);
    try {
      await updateSquareConfig({
        siteId,
        environment,
        applicationId: applicationId || undefined,
        locationId: locationId || undefined,
        accessToken: accessToken || undefined,
        webhookSignatureKey: webhookSignatureKey || undefined,
        checkoutEnabled,
      });
      toast({ title: "Square configuration saved" });
      setAccessToken("");
      setWebhookSignatureKey("");
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({
    entityType: "course" as "course" | "event",
    entityId: "",
    squareItemId: "",
    squareVariationId: "",
  });
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [isDeletingMapping, setIsDeletingMapping] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ entityType: "course", entityId: "", squareItemId: "", squareVariationId: "" });
    setDialogOpen(true);
  }

  function openEdit(m: any) {
    setEditing(m);
    setForm({
      entityType: m.entityType,
      entityId: String(m.entityId),
      squareItemId: m.squareItemId,
      squareVariationId: m.squareVariationId,
    });
    setDialogOpen(true);
  }

  async function handleMappingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingMapping(true);
    try {
      if (editing) {
        await updateSquareCatalogMapping({
          siteId,
          mappingId: editing._id,
          squareItemId: form.squareItemId,
          squareVariationId: form.squareVariationId,
        });
        toast({ title: "Mapping updated" });
      } else {
        await createSquareCatalogMapping({
          siteId,
          entityType: form.entityType,
          entityId: form.entityId,
          squareItemId: form.squareItemId,
          squareVariationId: form.squareVariationId,
        });
        toast({ title: "Mapping created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsSavingMapping(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeletingMapping(true);
    try {
      await deleteSquareCatalogMapping({ siteId, mappingId: deleteTarget._id });
      toast({ title: "Mapping deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete mapping",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeletingMapping(false);
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Payments</h1>
      <p className="text-sm text-slate-500 mb-6">Square connection and catalog mappings for courses and events.</p>
      <DesignLockBanner label="Square Payment Credentials" />

      {config === undefined ? (
        <Skeleton className="h-56 max-w-xl" />
      ) : (
        <LockedField capabilityLabel="Square Payment Credentials">
        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm max-w-xl mb-8 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-slate-400" />
            <h2 className="font-medium text-slate-900">Square Connection</h2>
            {config?.connected && (
              <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Environment</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as SquareEnv)}>
              <SelectTrigger aria-label="Environment"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Application ID {config?.applicationIdLast4 && <span className="text-slate-400">(current: …{config.applicationIdLast4})</span>}</Label>
            <Input aria-label="sq0idp-…" placeholder="sq0idp-…" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location ID</Label>
            <Input aria-label="location id" value={locationId} onChange={(e) => setLocationId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Access Token</Label>
            <Input aria-label="Leave blank to keep current" type="password" placeholder="Leave blank to keep current" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Webhook Signature Key</Label>
              {config?.hasWebhookSignatureKey ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Configured</span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Not set</span>
              )}
            </div>
            <Input aria-label="Enter to set or update" type="password" placeholder="Enter to set or update" value={webhookSignatureKey} onChange={(e) => setWebhookSignatureKey(e.target.value)} />
            <p className="text-xs text-slate-400">
              Found in your Square Developer Dashboard → Webhooks → signature key. Required for Square to accept webhook events.
            </p>
          </div>
          <div className="flex items-center justify-between py-1">
            <Label>Enable Checkout</Label>
            <Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} />
          </div>
          <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
            {isSavingConfig ? "Saving…" : "Save Configuration"}
          </Button>
        </div>
        </LockedField>
      )}

      <LockedField capabilityLabel="Square Payment Credentials">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-900">Catalog Mappings</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Mapping
        </Button>
      </div>

      {mappings === undefined ? (
        <Skeleton className="h-40" />
      ) : mappings === null ? (
        <ModuleAccessDenied message="Unable to load catalog mappings — you may not have access to this site or the payments module is disabled." />
      ) : mappings.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-md p-6 text-center">
          No catalog mappings yet. Link a course or event to a Square item.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Entity ID</th>
                <th className="px-4 py-2 font-medium">Square Item</th>
                <th className="px-4 py-2 font-medium">Square Variation</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map((m: any) => (
                <tr key={m._id}>
                  <td className="px-4 py-2 capitalize">{m.entityType}</td>
                  <td className="px-4 py-2">{m.entityId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.squareItemId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.squareVariationId}</td>
                  <td className="px-4 py-2 text-right">
                    <Button aria-label="Edit" variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button aria-label="Delete" variant="ghost" size="sm" onClick={() => setDeleteTarget(m)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </LockedField>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Mapping" : "Add Catalog Mapping"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMappingSubmit} className="space-y-4">
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>Entity Type</Label>
                  <Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v as "course" | "event" })}>
                    <SelectTrigger aria-label="Entity Type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entity ID</Label>
                  <Input aria-label="entity id" required value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Square Item ID</Label>
              <Input aria-label="square item id" required value={form.squareItemId} onChange={(e) => setForm({ ...form, squareItemId: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Square Variation ID</Label>
              <Input aria-label="square variation id" required value={form.squareVariationId} onChange={(e) => setForm({ ...form, squareVariationId: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSavingMapping}>
                {isSavingMapping ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this mapping?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeletingMapping} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
