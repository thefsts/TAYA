import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Briefcase, Pencil, Plus, Trash2, GripVertical } from "lucide-react";

type ServiceForm = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  imageUrl: string;
  price: string;
  duration: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  isVisible: boolean;
};

const emptyForm: ServiceForm = {
  title: "",
  slug: "",
  description: "",
  shortDescription: "",
  imageUrl: "",
  price: "",
  duration: "",
  category: "",
  ctaLabel: "",
  ctaUrl: "",
  isVisible: true,
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ServicesManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const items = useQuery(api.services.list, { siteId });
  const create = useMutation(api.services.create);
  const update = useMutation(api.services.update);
  const remove = useMutation(api.services.remove);
  const reorder = useMutation(api.services.reorder);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [isPending, setIsPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: any) {
    setEditing(s.id);
    setForm({
      title: s.title ?? "",
      slug: s.slug ?? "",
      description: s.description ?? "",
      shortDescription: s.shortDescription ?? "",
      imageUrl: s.imageUrl ?? "",
      price: s.price ?? "",
      duration: s.duration ?? "",
      category: s.category ?? "",
      ctaLabel: s.ctaLabel ?? "",
      ctaUrl: s.ctaUrl ?? "",
      isVisible: s.isVisible,
    });
    setDialogOpen(true);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: editing ? f.slug : slugify(title),
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!form.slug.trim()) {
      toast({ title: "Slug is required", variant: "destructive" });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const payload = {
        siteId,
        title: form.title,
        slug: form.slug,
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        imageUrl: form.imageUrl || undefined,
        price: form.price || undefined,
        duration: form.duration || undefined,
        category: form.category || undefined,
        ctaLabel: form.ctaLabel || undefined,
        ctaUrl: form.ctaUrl || undefined,
        isVisible: form.isVisible,
      };
      if (editing) {
        await update({ ...payload, serviceId: editing as Id<"siteServices"> });
        toast({ title: "Service updated" });
      } else {
        await create(payload);
        toast({ title: "Service added" });
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
      await remove({ siteId, serviceId: deleteId as Id<"siteServices"> });
      toast({ title: "Service removed" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex || !items) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setDragIndex(null);
    try {
      await reorder({ siteId, orderedIds: reordered.map((s: any) => s.id as Id<"siteServices">) });
    } catch (err) {
      toast({ title: "Reorder failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  if (items === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <Skeleton className="h-64" />
      </AppLayout>
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Services Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Add and manage the services shown on your Services page.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Service
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No services yet</p>
          <p className="text-slate-400 text-sm mt-1">Add the services you offer to showcase them on your website.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Your First Service
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((service: NonNullable<typeof items>[number], index: number) => (
            <div
              key={service.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4 items-start cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors"
            >
              <div className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab flex-shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>
              {service.imageUrl ? (
                <img
                  src={service.imageUrl}
                  alt={service.title}
                  className="h-16 w-16 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-900">{service.title}</p>
                    {service.category && (
                      <span className="text-xs text-slate-400 font-mono">{service.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(service.price || service.duration) && (
                      <div className="text-right">
                        {service.price && <p className="text-sm font-semibold text-primary">{service.price}</p>}
                        {service.duration && <p className="text-xs text-slate-400">{service.duration}</p>}
                      </div>
                    )}
                    {!service.isVisible && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                </div>
                {service.shortDescription ? (
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{service.shortDescription}</p>
                ) : (
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{service.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEdit(service)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => setDeleteId(service.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title *</Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Personal Training"
                />
              </div>
              <div>
                <Label>Slug *</Label>
                <Input
                  className="mt-1"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="personal-training"
                />
              </div>
            </div>
            <div>
              <Label>Short Description</Label>
              <Input
                className="mt-1"
                value={form.shortDescription}
                onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                placeholder="One-line summary shown on cards…"
              />
            </div>
            <div>
              <Label>Full Description *</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detailed description of this service…"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Price</Label>
                <Input
                  className="mt-1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="$99 / session"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Input
                  className="mt-1"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="60 minutes"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  className="mt-1"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Fitness"
                />
              </div>
            </div>
            <div>
              <Label>Image URL</Label>
              <Input
                className="mt-1"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CTA Button Label</Label>
                <Input
                  className="mt-1"
                  value={form.ctaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                  placeholder="Book Now"
                />
              </div>
              <div>
                <Label>CTA Button URL</Label>
                <Input
                  className="mt-1"
                  value={form.ctaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  placeholder="/contact"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isVisible}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))}
              />
              <Label>Visible on website</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove service?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
