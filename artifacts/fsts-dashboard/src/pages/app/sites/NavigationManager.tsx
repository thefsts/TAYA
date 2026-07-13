import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Navigation, Plus, Pencil, Trash2, ChevronUp, ChevronDown, ExternalLink } from "lucide-react";

type NavForm = { label: string; href: string; target: string; visible: boolean };
const emptyForm: NavForm = { label: "", href: "", target: "", visible: true };

export default function NavigationManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const items = useQuery(api.contentModules.listNavItems, { siteId });
  const createItem = useMutation(api.contentModules.createNavItem);
  const updateItem = useMutation(api.contentModules.updateNavItem);
  const removeItem = useMutation(api.contentModules.removeNavItem);
  const reorderItems = useMutation(api.contentModules.reorderNavItems);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<NavForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(item: any) {
    setEditing(item);
    setForm({ label: item.label, href: item.href, target: item.target ?? "", visible: item.visible });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim() || !form.href.trim()) {
      toast({ title: "Label and URL are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateItem({ siteId, itemId: editing._id, label: form.label, href: form.href, target: form.target || undefined, visible: form.visible });
        toast({ title: "Nav item updated" });
      } else {
        await createItem({ siteId, label: form.label, href: form.href, target: form.target || undefined, visible: form.visible });
        toast({ title: "Nav item created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await removeItem({ siteId, itemId: deleteId as Id<"navigationItems"> });
      toast({ title: "Nav item deleted" });
    } finally {
      setDeleteId(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const arr = [...items];
    const swap = index + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[index], arr[swap]] = [arr[swap], arr[index]];
    await reorderItems({ siteId, orderedIds: arr.map((i) => i._id as Id<"navigationItems">) });
  }

  if (items === undefined) return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Navigation className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Navigation Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">Control the links shown in your site header.</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Link</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Navigation className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No nav items yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item._id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-center">
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{item.label}</span>
                  {item.target === "_blank" && <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                  {!item.visible && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                </div>
                <span className="text-xs text-slate-500 font-mono">{item.href}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(item._id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Nav Item" : "Add Nav Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Label</Label><Input className="mt-1" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Courses" /></div>
            <div><Label>URL</Label><Input className="mt-1" value={form.href} onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} placeholder="/courses" /></div>
            <div><Label>Open in new tab? <span className="text-xs text-slate-400 font-normal">(leave blank for same tab)</span></Label>
              <div className="flex items-center gap-3 mt-1">
                <Switch checked={form.target === "_blank"} onCheckedChange={(v) => setForm((f) => ({ ...f, target: v ? "_blank" : "" }))} />
                <span className="text-sm text-slate-600">{form.target === "_blank" ? "Opens in new tab" : "Same tab"}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.visible} onCheckedChange={(v) => setForm((f) => ({ ...f, visible: v }))} />
              <Label>Visible on website</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove this nav item?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
