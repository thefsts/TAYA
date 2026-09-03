import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Navigation, Pencil, Plus, Trash2, ChevronUp, ChevronDown, ExternalLink, Eye, EyeOff } from "lucide-react";
import { LockedField, DesignLockBanner } from "@/components/LockedField";
import { ClientEmptyState, ClientLoadingList, ClientPageHeader, ClientSection } from "@/components/ClientPage";

type NavFormState = { label: string; href: string; isVisible: boolean; openInNewTab: boolean };
const emptyForm: NavFormState = { label: "", href: "", isVisible: true, openInNewTab: false };

export default function NavigationManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const items = useQuery(api.navigation.list, { siteId });
  const create = useMutation(api.navigation.create);
  const update = useMutation(api.navigation.update);
  const remove = useMutation(api.navigation.remove);
  const reorder = useMutation(api.navigation.reorder);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<NavFormState>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(item: any) { setEditing(item.id); setForm({ label: item.label, href: item.href, isVisible: item.isVisible, openInNewTab: item.openInNewTab ?? false }); setDialogOpen(true); }

  async function handleSave() {
    if (!form.label.trim() || !form.href.trim()) { toast({ title: "Label and URL are required", variant: "destructive" }); return; }
    setIsPending(true);
    try {
      if (editing) { await update({ siteId, navItemId: editing as Id<"navigationItems">, ...form }); toast({ title: "Navigation item updated" }); }
      else { await create({ siteId, ...form }); toast({ title: "Navigation item added" }); }
      setDialogOpen(false);
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setIsPending(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await remove({ siteId, navItemId: deleteId as Id<"navigationItems"> }); toast({ title: "Navigation item deleted" }); }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setDeleteId(null); }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const newOrder = [...items];
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    await reorder({ siteId, orderedIds: newOrder.map((item: NonNullable<typeof items>[number]) => item.id as Id<"navigationItems">) });
  }

  if (items === undefined) return <AppLayout siteId={params.siteId}><ClientLoadingList rows={5} /></AppLayout>;
  const visibleCount = items.filter((item: NonNullable<typeof items>[number]) => item.isVisible).length;

  return (
    <AppLayout siteId={params.siteId}>
      <DesignLockBanner label="Navigation Structure" />
      <ClientPageHeader
        eyebrow="Website Structure"
        title="Navigation Manager"
        description="Review your website menu, visibility, destinations, and link order while FSTS protects the approved navigation structure."
        actions={<LockedField capabilityLabel="Navigation Structure"><Button onClick={openCreate} className="shadow-sm"><Plus className="mr-2 h-4 w-4" />Add Navigation Item</Button></LockedField>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Navigation className="h-3.5 w-3.5" />Total links</div><p className="mt-1 text-2xl font-semibold text-slate-900">{items.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><Eye className="h-3.5 w-3.5" />Visible</div><p className="mt-1 text-2xl font-semibold text-slate-900">{visibleCount}</p></div>
      </div>

      <ClientSection title="Website Menu" description="Use the arrows to change menu order. Hidden links stay saved but are not shown publicly.">
        {items.length === 0 ? (
          <ClientEmptyState icon={Navigation} title="No navigation links yet" description="Add your first website menu link to begin building the visitor navigation." action={<LockedField capabilityLabel="Navigation Structure"><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add First Link</Button></LockedField>} />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item: NonNullable<typeof items>[number], index: number) => (
              <div key={item.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:p-5">
                <LockedField capabilityLabel="Navigation Structure" className="flex gap-1 sm:flex-col">
                  <button aria-label="Move navigation item up" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button aria-label="Move navigation item down" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                </LockedField>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    {item.isVisible ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible</Badge> : <Badge variant="secondary"><EyeOff className="mr-1 h-3 w-3" />Hidden</Badge>}
                    {item.openInNewTab && <Badge variant="outline" className="text-slate-500"><ExternalLink className="mr-1 h-3 w-3" />New tab</Badge>}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">{item.href}</p>
                </div>
                <LockedField capabilityLabel="Navigation Structure" className="flex flex-shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button aria-label="Delete" size="sm" variant="ghost" className="text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </LockedField>
              </div>
            ))}
          </div>
        )}
      </ClientSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Navigation Item" : "New Navigation Item"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5"><Label>Label *</Label><Input aria-label="Label" value={form.label} onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))} placeholder="e.g. About Us" /></div>
            <div className="space-y-1.5"><Label>Destination URL *</Label><Input aria-label="Destination URL" value={form.href} onChange={(e) => setForm((current) => ({ ...current, href: e.target.value }))} placeholder="/about or https://…" /><p className="text-xs leading-5 text-slate-400">Use a website path for internal pages or a complete https:// URL for an external destination.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div><span className="block text-sm font-medium text-slate-900">Visible</span><span className="text-xs text-slate-500">Show in website menu</span></div><Switch checked={form.isVisible} onCheckedChange={(value) => setForm((current) => ({ ...current, isVisible: value }))} /></label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div><span className="block text-sm font-medium text-slate-900">New tab</span><span className="text-xs text-slate-500">Useful for external links</span></div><Switch checked={form.openInNewTab} onCheckedChange={(value) => setForm((current) => ({ ...current, openInNewTab: value }))} /></label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : editing ? "Save Changes" : "Add Item"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete navigation item?</AlertDialogTitle><AlertDialogDescription>This removes the link from the dashboard and website navigation. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete Item</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  );
}
