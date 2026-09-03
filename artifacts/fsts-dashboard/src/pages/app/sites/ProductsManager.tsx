import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
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
import { Package, Pencil, Plus, Trash2, Star, Eye, EyeOff, GripVertical, X, Sparkles } from "lucide-react";

type ProductFormState = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  imageUrl: string;
  priceCents: string;
  priceLabel: string;
  category: string;
  isVisible: boolean;
  isFeatured: boolean;
  ctaLabel: string;
  ctaUrl: string;
};

const emptyForm: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  shortDescription: "",
  imageUrl: "",
  priceCents: "",
  priceLabel: "",
  category: "",
  isVisible: true,
  isFeatured: false,
  ctaLabel: "",
  ctaUrl: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPrice(priceCents?: number, priceLabel?: string) {
  if (priceLabel) return priceLabel;
  if (priceCents != null) return `$${(priceCents / 100).toFixed(2)}`;
  return "—";
}

export default function ProductsManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const data = useQuery(api.products.list, { siteId });
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const deleteProduct = useMutation(api.products.remove);
  const reorderProducts = useMutation(api.products.reorder);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(product: any) {
    setEditing(product);
    setForm({
      title: product.title,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription ?? "",
      imageUrl: product.imageUrl ?? "",
      priceCents: product.priceCents != null ? String(product.priceCents) : "",
      priceLabel: product.priceLabel ?? "",
      category: product.category ?? "",
      isVisible: product.isVisible ?? true,
      isFeatured: product.isFeatured ?? false,
      ctaLabel: product.ctaLabel ?? "",
      ctaUrl: product.ctaUrl ?? "",
    });
    setDialogOpen(true);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      // Auto-fill slug only for new products
      ...(editing ? {} : { slug: slugify(title) }),
    }));
  }

  async function doSave() {
    setIsPending(true);
    try {
      const payload = {
        siteId,
        title: form.title,
        slug: form.slug,
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        imageUrl: form.imageUrl || undefined,
        priceCents: form.priceCents ? parseInt(form.priceCents, 10) : undefined,
        priceLabel: form.priceLabel || undefined,
        category: form.category || undefined,
        isVisible: form.isVisible,
        isFeatured: form.isFeatured,
        ctaLabel: form.ctaLabel || undefined,
        ctaUrl: form.ctaUrl || undefined,
      };

      if (editing) {
        await updateProduct({ ...payload, productId: editing._id });
        toast({ title: "Product updated" });
      } else {
        await createProduct(payload);
        toast({ title: "Product created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSave();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteProduct({ siteId, productId: deleteTarget._id });
      toast({ title: "Product deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete product",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleVisible(product: any) {
    try {
      await updateProduct({
        siteId,
        productId: product._id,
        isVisible: !product.isVisible,
      });
      toast({ title: product.isVisible ? "Product hidden" : "Product visible" });
    } catch (err) {
      toast({
        title: "Couldn't update product",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function handleToggleFeatured(product: any) {
    try {
      await updateProduct({
        siteId,
        productId: product._id,
        isFeatured: !product.isFeatured,
      });
    } catch (err) {
      toast({
        title: "Couldn't update product",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  // Drag-and-drop reorder
  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx || !data) return;
    const items = [...data].sort((a: any, b: any) => a.order - b.order);
    const moved = items.splice(dragIdx, 1)[0];
    items.splice(targetIdx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    try {
      await reorderProducts({
        siteId,
        orderedIds: items.map((p: any) => p._id),
      });
    } catch (err) {
      toast({
        title: "Couldn't reorder products",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  const sorted = data
    ? [...data].sort((a: any, b: any) => a.order - b.order)
    : null;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Showcase your offerings — drag to reorder, toggle to feature or hide.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Placeholder nudge banner — shown when every product is hidden */}
      {!nudgeDismissed &&
        sorted !== null &&
        sorted !== undefined &&
        sorted.length > 0 &&
        sorted.every((p: any) => !p.isVisible) && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1 text-sm text-amber-800">
              <span className="font-semibold">
                {sorted.length} starter {sorted.length === 1 ? "product" : "products"} ready to publish.
              </span>{" "}
              Edit each one to add your real details, then toggle the{" "}
              <Eye className="inline h-3.5 w-3.5 align-text-bottom" /> visibility switch to make it live on your site.
            </div>
            <button
              onClick={() => setNudgeDismissed(true)}
              className="ml-2 shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

      {data === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Products — you may not have access to this site." />
      ) : sorted!.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Package className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No products yet</h3>
          <p className="text-slate-500 mt-1">Add your first product or offering to get started.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-8" />
                <th className="px-4 py-3 text-left font-medium text-slate-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Price</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Featured</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">Visible</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted!.map((p: any, idx: number) => (
                <tr
                  key={p._id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  className={`hover:bg-slate-50 transition-colors ${dragOverIdx === idx && dragIdx !== idx ? "bg-primary/5 border-t-2 border-primary" : ""}`}
                >
                  <td className="px-3 py-3 text-slate-300 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="h-10 w-10 rounded object-cover border border-slate-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Package className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{p.title}</div>
                        {p.shortDescription && (
                          <div className="text-xs text-slate-500 truncate max-w-xs">{p.shortDescription}</div>
                        )}
                        {p.ctaUrl && (
                          <div className="text-xs text-primary truncate max-w-xs">{p.ctaLabel || p.ctaUrl}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.category ? (
                      <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                    {formatPrice(p.priceCents, p.priceLabel)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleFeatured(p)}
                      className="inline-flex items-center justify-center"
                      title={p.isFeatured ? "Remove featured" : "Mark featured"}
                    >
                      <Star
                        className={`h-4 w-4 transition-colors ${p.isFeatured ? "text-amber-400 fill-amber-400" : "text-slate-300"}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleVisible(p)}
                      className="inline-flex items-center justify-center"
                      title={p.isVisible ? "Hide product" : "Show product"}
                    >
                      {p.isVisible ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button aria-label="Edit" variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button aria-label="Delete" variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  aria-label="Title"
                  required
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Starter Package"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input
                  aria-label="Slug"
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="starter-package"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Short Description</Label>
              <Input
                aria-label="Short Description"
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                placeholder="One-line summary shown on cards"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Full Description *</Label>
              <Textarea
                aria-label="Full Description"
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description of what's included…"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Price (cents)</Label>
                <Input
                  aria-label="Price (cents)"
                  type="number"
                  min={0}
                  value={form.priceCents}
                  onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                  placeholder="e.g. 9900"
                />
                <p className="text-xs text-slate-400">e.g. 9900 = $99.00</p>
              </div>
              <div className="space-y-1.5">
                <Label>Price Label</Label>
                <Input
                  aria-label="Price Label"
                  value={form.priceLabel}
                  onChange={(e) => setForm({ ...form, priceLabel: e.target.value })}
                  placeholder="Starting at $99/mo"
                />
                <p className="text-xs text-slate-400">Overrides price display</p>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  aria-label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Consulting"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input
                aria-label="Image URL"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://…"
              />
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="mt-2 h-24 w-auto rounded border border-slate-200 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CTA Button Label</Label>
                <Input
                  aria-label="CTA Button Label"
                  value={form.ctaLabel}
                  onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                  placeholder="e.g. Get Started"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA Button URL</Label>
                <Input
                  aria-label="CTA Button URL"
                  value={form.ctaUrl}
                  onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                  placeholder="https://… or /contact"
                />
              </div>
            </div>

            <div className="flex items-center gap-8 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="isVisible"
                  checked={form.isVisible}
                  onCheckedChange={(v) => setForm({ ...form, isVisible: v })}
                />
                <Label htmlFor="isVisible" className="cursor-pointer">Visible on site</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isFeatured"
                  checked={form.isFeatured}
                  onCheckedChange={(v) => setForm({ ...form, isFeatured: v })}
                />
                <Label htmlFor="isFeatured" className="cursor-pointer">Featured</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This product will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
