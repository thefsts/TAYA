import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import {
  useListCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  CourseInputStatus,
  type Course,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";

type CourseFormState = {
  title: string;
  slug: string;
  status: CourseInputStatus;
  description: string;
  durationLabel: string;
  priceCents: string;
  imageUrl: string;
};

const emptyForm: CourseFormState = {
  title: "",
  slug: "",
  status: CourseInputStatus.draft,
  description: "",
  durationLabel: "",
  priceCents: "",
  imageUrl: "",
};

function statusVariant(status: string) {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

export default function CoursesList({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useListCourses(siteId);
  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();
  const deleteMutation = useDeleteCourse();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setForm({
      title: course.title,
      slug: course.slug,
      status: course.status as CourseInputStatus,
      description: course.description,
      durationLabel: course.durationLabel ?? "",
      priceCents: course.priceCents != null ? String(course.priceCents) : "",
      imageUrl: course.imageUrl ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      slug: form.slug,
      status: form.status,
      description: form.description,
      durationLabel: form.durationLabel || undefined,
      priceCents: form.priceCents ? parseInt(form.priceCents, 10) : undefined,
      imageUrl: form.imageUrl || undefined,
    };

    const onSuccess = () => {
      toast({ title: editing ? "Course updated" : "Course created" });
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
        { siteId, courseId: editing.id, data: payload },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate({ siteId, data: payload }, { onSuccess, onError });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { siteId, courseId: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Course deleted" });
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete course",
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
          <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage training courses offered on this site.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Course
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No courses yet</h3>
          <p className="text-slate-500 mt-1">Add your first course to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Price</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Updated</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.durationLabel || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.priceCents != null ? `$${(c.priceCents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
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
            <DialogTitle>{editing ? "Edit Course" : "New Course"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CourseInputStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CourseInputStatus.draft}>Draft</SelectItem>
                    <SelectItem value={CourseInputStatus.published}>Published</SelectItem>
                    <SelectItem value={CourseInputStatus.archived}>Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Input placeholder="e.g. 3 weeks" value={form.durationLabel} onChange={(e) => setForm({ ...form, durationLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (cents)</Label>
                <Input type="number" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
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
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
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
