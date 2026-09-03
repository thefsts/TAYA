import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import {
  RefreshCw,
  Plus,
  Pencil,
  ShoppingBag,
  Receipt,
  Tag,
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
} from "lucide-react";

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    APPROVED: "bg-green-100 text-green-700",
    CANCELED: "bg-slate-100 text-slate-500",
    FAILED: "bg-red-100 text-red-600",
    PENDING: "bg-amber-100 text-amber-700",
    UNKNOWN: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}

/* ── Tab: Analytics ──────────────────────────────────────────────────────── */

function AnalyticsTab({ siteId }: { siteId: Id<"sites"> }) {
  const analytics = useQuery(api.square.getCommerceAnalytics, { siteId });

  if (analytics === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  if (!analytics) {
    return <p className="text-sm text-slate-500">Could not load analytics.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue MTD</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono">{formatCents(analytics.revenueMtdCents)}</div>
          <p className="text-xs text-slate-400 mt-1">Month to date</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 font-mono">{analytics.transactionCount}</div>
          <p className="text-xs text-slate-400 mt-1">Completed this month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Item</span>
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">{analytics.topItem ?? "—"}</div>
          <p className="text-xs text-slate-400 mt-1">Best-selling product</p>
        </div>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
        Analytics are computed from orders stored in FSTS. Use <strong>Sync Payments</strong> on the Payments tab to pull the latest Square transactions.
      </div>
    </div>
  );
}

/* ── Tab: Catalog ────────────────────────────────────────────────────────── */

type CatalogItemForm = { name: string; description: string; priceCents: string; category: string; imageUrl: string };
const emptyCatalogForm: CatalogItemForm = { name: "", description: "", priceCents: "", category: "", imageUrl: "" };

function CatalogTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const config = useQuery(api.square.getConfig, { siteId });
  const items = useQuery(api.square.listCatalogItems, { siteId });
  const syncCatalog = useAction(api.square.syncCatalog);
  const createCatalogItem = useAction(api.square.createCatalogItem);
  const updateCatalogItem = useAction(api.square.updateCatalogItem);

  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CatalogItemForm>(emptyCatalogForm);

  function openCreate() {
    setEditingItem(null);
    setForm(emptyCatalogForm);
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      priceCents: item.priceCents != null ? (item.priceCents / 100).toFixed(2) : "",
      category: item.category ?? "",
      imageUrl: item.imageUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncCatalog({ siteId });
      toast({ title: `Synced ${(result as any).synced} catalog items from Square` });
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(form.priceCents) * 100);
      if (isNaN(priceCents)) throw new Error("Price must be a valid number");
      if (editingItem) {
        await updateCatalogItem({
          siteId,
          squareItemId: editingItem.squareItemId,
          name: form.name,
          description: form.description || undefined,
          priceCents,
          category: form.category || undefined,
          imageUrl: form.imageUrl || undefined,
        });
        toast({ title: "Item updated in Square" });
      } else {
        await createCatalogItem({
          siteId,
          name: form.name,
          description: form.description || undefined,
          priceCents,
          category: form.category || undefined,
          imageUrl: form.imageUrl || undefined,
        });
        toast({ title: "Item created in Square and synced" });
      }
      setDialogOpen(false);
      setForm(emptyCatalogForm);
    } catch (err) {
      toast({ title: editingItem ? "Could not update item" : "Could not create item", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">
            {config?.lastCatalogSyncAt ? `Last synced ${formatDate(config.lastCatalogSyncAt)}` : "Never synced"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Item
          </Button>
        </div>
      </div>

      {items === undefined ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No catalog items yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Sync Now" to pull items from your Square catalog, or create a new item.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Square ID</th>
                <th className="px-4 py-2.5 font-medium">Last Synced</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(items as any[]).map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0" />
                      )}
                      <span className="font-medium text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{item.category ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-900">{item.priceCents != null ? formatCents(item.priceCents) : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{item.squareItemId}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(item.lastSyncedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button aria-label="Edit" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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
            <DialogTitle>{editingItem ? "Edit Catalog Item" : "Create Catalog Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input aria-label="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Basic Handgun Course" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input aria-label="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Price (USD)</Label>
              <Input aria-label="price cents" required type="number" min="0" step="0.01" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} placeholder="99.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input aria-label="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Optional — creates category in Square if new" />
            </div>
            <div className="space-y-1.5">
              <ImagePickerField
                siteId={siteId}
                label="Product Photo"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                initialPreset={SITE_PRESETS.find((p) => p.label === "Course/Event Thumb")}
                hint="Recommended: 800×450 px (16:9)."
              />
              <p className="text-xs text-slate-400">Displayed in the dashboard. To upload photos to Square, use your <a href="https://squareup.com/dashboard" target="_blank" rel="noreferrer" className="underline">Square Dashboard</a> and then sync.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? (editingItem ? "Saving…" : "Creating…") : (editingItem ? "Save Changes" : "Create in Square")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Tab: Payments ───────────────────────────────────────────────────────── */

function PaymentsTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const orders = useQuery(api.square.listOrders, { siteId });
  const syncOrders = useAction(api.square.syncOrders);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncOrders({ siteId });
      toast({ title: `Synced ${(result as any).synced} payments from Square` });
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Recent Square transactions. Click "Sync Payments" to pull the latest.</p>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync Payments"}
        </Button>
      </div>

      {orders === undefined ? (
        <Skeleton className="h-48" />
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No payments on record</p>
          <p className="text-xs text-slate-400 mt-1">Click "Sync Payments" to pull transactions from Square, or payments will appear here when the webhook receives events.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(orders as any[]).map((order) => (
                <tr key={order._id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{order.customerName ?? order.customerEmail ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{order.itemName ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{formatCents(order.amountCents)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-2.5">
                    {order.refundStatus ? (
                      <StatusBadge status={order.refundStatus} />
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3">To initiate a refund, go to your <a href="https://squareup.com/dashboard" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Square Dashboard</a>.</p>
    </div>
  );
}

/* ── Tab: Discounts ──────────────────────────────────────────────────────── */

function DiscountsTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const discounts = useQuery(api.square.listDiscounts, { siteId });
  const syncDiscounts = useAction(api.square.syncDiscounts);
  const createDiscount = useAction(api.square.createDiscount);

  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    discountType: "FIXED_AMOUNT" as "FIXED_AMOUNT" | "FIXED_PERCENTAGE",
    amount: "",
    percentage: "",
    expiresAt: "",
  });

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncDiscounts({ siteId });
      toast({ title: `Synced ${(result as any).synced} discount codes from Square` });
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDiscount({
        siteId,
        name: form.name,
        code: form.code || undefined,
        discountType: form.discountType,
        amount: form.discountType === "FIXED_AMOUNT" && form.amount ? Math.round(parseFloat(form.amount) * 100) : undefined,
        percentage: form.discountType === "FIXED_PERCENTAGE" && form.percentage ? parseFloat(form.percentage) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : undefined,
      });
      toast({ title: "Discount created in Square" });
      setDialogOpen(false);
      setForm({ name: "", code: "", discountType: "FIXED_AMOUNT", amount: "", percentage: "", expiresAt: "" });
    } catch (err) {
      toast({ title: "Could not create discount", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs text-slate-500 mb-4">
        Square catalog discounts are applied manually at the point of sale — they don't have standalone promo codes. The <strong>Reference Code</strong> column shows the discount's name as it appears in Square. To create promo codes that customers enter at checkout, use <a href="https://squareup.com/us/en/software/loyalty" target="_blank" rel="noreferrer" className="underline">Square Loyalty</a> in your Square Dashboard.
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Discounts synced from your Square catalog.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Discounts"}
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Discount
          </Button>
        </div>
      </div>

      {discounts === undefined ? (
        <Skeleton className="h-40" />
      ) : discounts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <Tag className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No discount codes</p>
          <p className="text-xs text-slate-400 mt-1">Create a discount or sync existing ones from your Square catalog.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Ref Code</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium">Expires</th>
                <th className="px-4 py-2.5 font-medium">Square ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(discounts as any[]).map((d) => (
                <tr key={d._id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{d.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{d.code ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{d.discountType === "FIXED_AMOUNT" ? "$ Fixed" : "% Off"}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-900">
                    {d.discountType === "FIXED_AMOUNT" && d.amount != null ? formatCents(d.amount) : d.percentage != null ? `${d.percentage}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {d.expiresAt ? formatDate(d.expiresAt) : <span className="text-slate-400 text-xs">No expiry</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.squareDiscountId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Discount Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input aria-label="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer Sale" />
            </div>
            <div className="space-y-1.5">
              <Label>Promo Code (optional)</Label>
              <Input aria-label="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER25" />
            </div>
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount ($)</SelectItem>
                  <SelectItem value="FIXED_PERCENTAGE">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discountType === "FIXED_AMOUNT" ? (
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <Input aria-label="amount" required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="25.00" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Percentage</Label>
                <Input aria-label="percentage" required type="number" min="0" max="100" step="0.1" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} placeholder="15" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Expiry Date <span className="text-slate-400 font-normal">(optional, stored in FSTS)</span></Label>
              <Input aria-label="expires at" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              <p className="text-xs text-slate-400">Square catalog discounts don't expire natively. Delete the discount in Square to disable it.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create in Square"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Main Commerce Page ──────────────────────────────────────────────────── */

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "catalog", label: "Catalog", icon: ShoppingBag },
  { id: "payments", label: "Payments", icon: Receipt },
  { id: "discounts", label: "Discounts", icon: Tag },
] as const;

type Tab = typeof TABS[number]["id"];

export default function Commerce({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const config = useQuery(api.square.getConfig, { siteId });
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Commerce</h1>
        <p className="text-sm text-slate-500">Square catalog, payment history, discount codes, and analytics for this site.</p>
        {config !== undefined && !config?.connected && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
            Square is not connected for this site. Configure credentials in{" "}
            <a href={`/app/sites/${params.siteId}/payments`} className="font-medium underline">Square Payments settings</a>.
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <AnalyticsTab siteId={siteId} />}
      {activeTab === "catalog" && <CatalogTab siteId={siteId} />}
      {activeTab === "payments" && <PaymentsTab siteId={siteId} />}
      {activeTab === "discounts" && <DiscountsTab siteId={siteId} />}
    </AppLayout>
  );
}
