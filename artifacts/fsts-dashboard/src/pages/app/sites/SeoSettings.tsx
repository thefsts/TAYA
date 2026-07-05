import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import {
  useListSeoSettings,
  useCreateSeoSetting,
  useUpdateSeoSetting,
  useDeleteSeoSetting,
  type SeoSetting,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

type SeoFormState = {
  pagePath: string;
  title: string;
  description: string;
  ogImageUrl: string;
  canonicalUrl: string;
};

const emptyForm: SeoFormState = {
  pagePath: "",
  title: "",
  description: "",
  ogImageUrl: "",
  canonicalUrl: "",
};

export default function SeoSettings({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useListSeoSettings(siteId);
  const createMutation = useCreateSeoSetting();
  const updateMutation = useUpdateSeoSetting();
  const deleteMutation = useDeleteSeoSetting();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeoSetting | null>(null);
  const [form, setForm] = useState<SeoFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SeoSetting | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: SeoSetting) {
    setEditing(s);
    setForm({
      pagePath: s.pagePath,
      title: s.title,
      description: s.description,
      ogImageUrl: s.ogImageUrl ?? "",
      canonicalUrl: s.canonicalUrl ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const onSuccess = () => {
      toast({ title: editing ? "SEO setting updated" : "SEO setting created" });
      setDialogOpen(false);
    };
    const onError = (err: unknown) => {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    };

    if (editing) {
      updateMutation.mutate(
        {
          siteId,
          seoSettingId: editing.id,
          data: {
            title: form.title,
            description: form.description,
            ogImageUrl: form.ogImageUrl || undefined,
            canonicalUrl: form.canonicalUrl || undefined,
          },
        },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        {
          siteId,
          data: {
            pagePath: form.pagePath,
            title: form.title,
            description: form.description,
            ogImageUrl: form.ogImageUrl || undefined,
            canonicalUrl: form.canonicalUrl || undefined,
          },
        },
        { onSuccess, onError },
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { siteId, seoSettingId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "SEO setting deleted" });
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete SEO setting",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        },
      },
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SEO Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Per-page meta titles, descriptions, and social previews.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Page
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No SEO settings yet</h3>
          <p className="text-slate-500 mt-1">Add meta tags for your pages.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Page Path</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Description</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.pagePath}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.title}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit SEO Setting" : "New SEO Setting"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Page Path</Label>
              <Input
                required
                disabled={!!editing}
                placeholder="/about"
                value={form.pagePath}
                onChange={(e) => setForm({ ...form, pagePath: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>OG Image URL</Label>
                <Input value={form.ogImageUrl} onChange={(e) => setForm({ ...form, ogImageUrl: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Canonical URL</Label>
                <Input value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.pagePath}"?</AlertDialogTitle>
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
