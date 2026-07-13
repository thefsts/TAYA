import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, RefreshCw, DollarSign, Tag, Package, TrendingUp, Plus, Trash2, Clock } from "lucide-react";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ siteId }: { siteId: Id<"sites"> }) {
  const analytics = useQuery(api.squareOrders.getOrdersAnalytics, { siteId });
  const config = useQuery(api.square.getConfig, { siteId });

  if (analytics === undefined || config === undefined) return <Skeleton className="h-48 mt-4" />;

  const cards = [
    { icon: DollarSign, label: "Revenue MTD", value: analytics ? fmt(analytics.revenueMtdCents) : "—", sub: "month to date" },
    { icon: ShoppingCart, label: "Orders MTD", value: analytics?.transactionCountMtd ?? 0, sub: "completed orders" },
    { icon: TrendingUp, label: "Total Orders", value: analytics?.totalOrders ?? 0, sub: "all time" },
    { icon: Package, label: "Top Item", value: analytics?.topItem ?? "—", sub: "by order count" },
  ];

  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{c.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">{c.value}</div>
            <div className="text-xs text-slate-400 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Square Connection</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Status</span><span className={config?.connected ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{config?.connected ? "Connected" : "Disconnected"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Environment</span><span className="text-slate-900 capitalize">{config?.environment ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Checkout</span><span className={config?.checkoutEnabled ? "text-green-600" : "text-slate-400"}>{config?.checkoutEnabled ? "Enabled" : "Disabled"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Application ID</span><span className="font-mono text-slate-700">{config?.applicationIdLast4 ? `…${config.applicationIdLast4}` : "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Catalog Tab ───────────────────────────────────────────────────────────────
function CatalogTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const items = useQuery(api.squareOrders.listCatalogItems, { siteId });
  const config = useQuery(api.square.getConfig, { siteId });
  const syncCatalog = useAction(api.squareOrders.syncCatalog);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncCatalog({ siteId });
      if (result.error) {
        toast({ title: "Sync failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: `Synced ${result.synced} catalog items` });
      }
    } catch (err) {
      toast({ title: "Sync error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSyncing(false); }
  }

  if (items === undefined) return <Skeleton className="h-48 mt-4" />;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">{items.length} items synced from Square catalog</p>
          {(config as any)?.lastCatalogSyncAt && (
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Last sync: {new Date((config as any).lastCatalogSyncAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button onClick={handleSync} disabled={syncing || !config?.connected} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      {!config?.connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Square is not connected. Configure your credentials in <strong>Payments</strong> to enable sync.
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No catalog items synced yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Sync Now" to pull items from your Square catalog</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Square ID</th>
                <th className="px-4 py-3 font-medium">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any) => (
                <tr key={item._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{item.type ?? "ITEM"}</Badge></td>
                  <td className="px-4 py-3 font-mono">{item.priceCents != null ? fmt(item.priceCents) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.squareItemId}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(item.syncedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab({ siteId }: { siteId: Id<"sites"> }) {
  const orders = useQuery(api.squareOrders.listOrders, { siteId, limit: 100 });

  if (orders === undefined) return <Skeleton className="h-48 mt-4" />;

  const statusColor: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    CANCELED: "bg-red-100 text-red-700",
    OPEN: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="mt-4">
      {orders.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No orders recorded yet</p>
          <p className="text-sm text-slate-400 mt-1">Orders will appear here as Square processes payments via webhook</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o: any) => (
                <tr key={o._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{o.customerName ?? "—"}</div>
                    {o.customerEmail && <div className="text-xs text-slate-400">{o.customerEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{o.itemName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono font-medium">{fmt(o.amountCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] ?? "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {o.refundStatus ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">{o.refundStatus}</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Discounts Tab ─────────────────────────────────────────────────────────────
type DiscountForm = { name: string; code: string; discountType: string; amountCents: string; percentage: string; expiresAt: string };
const emptyDiscount: DiscountForm = { name: "", code: "", discountType: "FIXED_PERCENTAGE", amountCents: "", percentage: "", expiresAt: "" };

function DiscountsTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const discounts = useQuery(api.squareOrders.listDiscounts, { siteId });
  const create = useMutation(api.squareOrders.createDiscount);
  const update = useMutation(api.squareOrders.updateDiscount);
  const remove = useMutation(api.squareOrders.removeDiscount);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DiscountForm>(emptyDiscount);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setForm(emptyDiscount); setDialogOpen(true); }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await create({
        siteId,
        squareDiscountId: `local_${Date.now()}`,
        name: form.name,
        code: form.code || undefined,
        discountType: form.discountType,
        amount: form.discountType === "FIXED_AMOUNT" && form.amountCents ? Math.round(parseFloat(form.amountCents) * 100) : undefined,
        percentage: form.discountType === "FIXED_PERCENTAGE" && form.percentage ? form.percentage : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : undefined,
      });
      toast({ title: "Discount created" });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await remove({ siteId, discountId: deleteId as Id<"squareDiscounts"> });
    toast({ title: "Discount deleted" });
    setDeleteId(null);
  }

  if (discounts === undefined) return <Skeleton className="h-48 mt-4" />;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Discount</Button>
      </div>

      {discounts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No discounts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.map((d: any) => (
            <div key={d._id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <Tag className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{d.name}</span>
                  {d.code && <Badge variant="outline" className="font-mono text-xs">{d.code}</Badge>}
                  <Badge variant={d.isActive ? "default" : "secondary"} className="text-xs">{d.isActive ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {d.discountType === "FIXED_PERCENTAGE" ? `${d.percentage}% off` : d.amountCents != null ? `${fmt(d.amountCents)} off` : "—"}
                  {d.expiresAt && ` • Expires ${new Date(d.expiresAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(d._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Discount</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Spring Sale" /></div>
            <div><Label>Code <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input className="mt-1 font-mono uppercase" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SPRING25" /></div>
            <div>
              <Label>Discount Type</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm((f) => ({ ...f, discountType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED_PERCENTAGE">Percentage Off</SelectItem>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discountType === "FIXED_PERCENTAGE" ? (
              <div><Label>Percentage (%)</Label><Input type="number" className="mt-1" value={form.percentage} onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))} placeholder="10" /></div>
            ) : (
              <div><Label>Amount ($)</Label><Input type="number" className="mt-1" step="0.01" value={form.amountCents} onChange={(e) => setForm((f) => ({ ...f, amountCents: e.target.value }))} placeholder="25.00" /></div>
            )}
            <div><Label>Expiration Date <span className="text-slate-400 text-xs font-normal">(optional)</span></Label><Input type="date" className="mt-1" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create Discount"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this discount?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SquareCommerce({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Square Commerce</h1>
          <p className="text-sm text-slate-500 mt-0.5">Catalog sync, payment history, and discount management.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="orders">Payment History</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab siteId={siteId} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab siteId={siteId} /></TabsContent>
        <TabsContent value="orders"><OrdersTab siteId={siteId} /></TabsContent>
        <TabsContent value="discounts"><DiscountsTab siteId={siteId} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
