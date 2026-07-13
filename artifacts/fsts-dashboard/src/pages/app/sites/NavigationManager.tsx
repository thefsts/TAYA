import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Navigation, Pencil, Plus, Trash2, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";

type NavFormState = {
  label: string;
  href: string;
  isVisible: boolean;
  openInNewTab: boolean;
};

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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item.id);
    setForm({ label: item.label, href: item.href, isVisible: item.isVisible, openInNewTab: item.openInNewTab ?? false });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim() || !form.href.trim()) {
      toast({ title: "Label and URL are required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      if (editing) {
        await update({ siteId, navItemId: editing as Id<"navigationItems">, ...form });
        toast({ title: "Nav item updated" });
      } else {
        await create({ siteId, ...form });
        toast({ title: "Nav item added" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await remove({ siteId, navItemId: deleteId as Id<"navigationItems"> });
      toast({ title: "Nav item deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const newOrder = [...items];
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    await reorder({ siteId, orderedIds: newOrder.map((n) => n.id as Id<"navigationItems">) });
  }

  if (items === undefined) {
    return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Navigation Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your site header navigation links. Drag to reorder.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Nav Item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Navigation className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No nav items yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your first navigation link to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center"
            >
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 text-sm">{item.label}</p>
                  {!item.isVisible && <Badge variant="secondary">Hidden</Badge>}
                  {item.openInNewTab && (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{item.href}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Nav Item" : "New Nav Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Label *</Label>
              <Input className="mt-1" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. About Us" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input className="mt-1" value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="/about or https://…" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isVisible} onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))} />
              <Label>Visible on website</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.openInNewTab} onCheckedChange={(v) => setForm((f) => ({ ...f, openInNewTab: v }))} />
              <Label>Open in new tab</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete nav item?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
