import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import {
  useGetSquareConfig,
  useUpdateSquareConfig,
  useListSquareCatalogMappings,
  useCreateSquareCatalogMapping,
  useUpdateSquareCatalogMapping,
  useDeleteSquareCatalogMapping,
  SquareConfigInputEnvironment,
  type SquareCatalogMapping,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function PaymentsConfig({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();

  const { data: config, isLoading: configLoading } = useGetSquareConfig(siteId);
  const updateConfigMutation = useUpdateSquareConfig();

  const { data: mappings, isLoading: mappingsLoading } = useListSquareCatalogMappings(siteId);
  const createMappingMutation = useCreateSquareCatalogMapping();
  const updateMappingMutation = useUpdateSquareCatalogMapping();
  const deleteMappingMutation = useDeleteSquareCatalogMapping();

  const [environment, setEnvironment] = useState<SquareConfigInputEnvironment>(SquareConfigInputEnvironment.sandbox);
  const [applicationId, setApplicationId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);

  useEffect(() => {
    if (config) {
      setEnvironment(config.environment as SquareConfigInputEnvironment);
      setLocationId(config.locationId ?? "");
      setCheckoutEnabled(config.checkoutEnabled ?? false);
    }
  }, [config]);

  function handleSaveConfig() {
    updateConfigMutation.mutate(
      {
        siteId,
        data: {
          environment,
          applicationId: applicationId || undefined,
          locationId: locationId || undefined,
          accessToken: accessToken || undefined,
          checkoutEnabled,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Square configuration saved" });
          setAccessToken("");
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SquareCatalogMapping | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SquareCatalogMapping | null>(null);
  const [form, setForm] = useState({
    entityType: "course" as "course" | "event",
    entityId: "",
    squareItemId: "",
    squareVariationId: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({ entityType: "course", entityId: "", squareItemId: "", squareVariationId: "" });
    setDialogOpen(true);
  }

  function openEdit(m: SquareCatalogMapping) {
    setEditing(m);
    setForm({
      entityType: m.entityType,
      entityId: String(m.entityId),
      squareItemId: m.squareItemId,
      squareVariationId: m.squareVariationId,
    });
    setDialogOpen(true);
  }

  function handleMappingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMappingMutation.mutate(
        {
          siteId,
          mappingId: editing.id,
          data: { squareItemId: form.squareItemId, squareVariationId: form.squareVariationId },
        },
        {
          onSuccess: () => {
            toast({ title: "Mapping updated" });
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
      createMappingMutation.mutate(
        {
          siteId,
          data: {
            entityType: form.entityType,
            entityId: parseInt(form.entityId, 10),
            squareItemId: form.squareItemId,
            squareVariationId: form.squareVariationId,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Mapping created" });
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
    deleteMappingMutation.mutate(
      { siteId, mappingId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Mapping deleted" });
          setDeleteTarget(null);
        },
        onError: (err) =>
          toast({
            title: "Couldn't delete mapping",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Payments</h1>
      <p className="text-sm text-slate-500 mb-6">Square connection and catalog mappings for courses and events.</p>

      {configLoading ? (
        <Skeleton className="h-56 max-w-xl" />
      ) : (
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
            <Select value={environment} onValueChange={(v) => setEnvironment(v as SquareConfigInputEnvironment)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SquareConfigInputEnvironment.sandbox}>Sandbox</SelectItem>
                <SelectItem value={SquareConfigInputEnvironment.production}>Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Application ID {config?.applicationIdLast4 && <span className="text-slate-400">(current: …{config.applicationIdLast4})</span>}</Label>
            <Input placeholder="sq0idp-…" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location ID</Label>
            <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Access Token</Label>
            <Input type="password" placeholder="Leave blank to keep current" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label>Enable Checkout</Label>
            <Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} />
          </div>
          <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
            {updateConfigMutation.isPending ? "Saving…" : "Save Configuration"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-900">Catalog Mappings</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Mapping
        </Button>
      </div>

      {mappingsLoading ? (
        <Skeleton className="h-40" />
      ) : mappings?.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-md p-6 text-center">
          No catalog mappings yet. Link a course or event to a Square item.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
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
              {mappings?.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 capitalize">{m.entityType}</td>
                  <td className="px-4 py-2">{m.entityId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.squareItemId}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.squareVariationId}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(m)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Course</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entity ID</Label>
                  <Input required type="number" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Square Item ID</Label>
              <Input required value={form.squareItemId} onChange={(e) => setForm({ ...form, squareItemId: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Square Variation ID</Label>
              <Input required value={form.squareVariationId} onChange={(e) => setForm({ ...form, squareVariationId: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMappingMutation.isPending || updateMappingMutation.isPending}>
                {createMappingMutation.isPending || updateMappingMutation.isPending ? "Saving…" : "Save"}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
