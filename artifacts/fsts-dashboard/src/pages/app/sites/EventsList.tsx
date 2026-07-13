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
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { PublishValidationModal } from "@/components/PublishValidationModal";

type EventStatus = "draft" | "published" | "archived";

type EventFormState = {
  title: string;
  slug: string;
  status: EventStatus;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
  imageUrl: string;
  squareItemId: string;
};

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm: EventFormState = {
  title: "",
  slug: "",
  status: "draft",
  description: "",
  startAt: "",
  endAt: "",
  location: "",
  imageUrl: "",
  squareItemId: "",
};

function statusVariant(status: string) {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

export default function EventsList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.events.list, { siteId });
  const catalogItems = useQuery(api.square.listCatalogItems, { siteId });
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const deleteEvent = useMutation(api.events.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(ev: any) {
    setEditing(ev);
    setForm({
      title: ev.title,
      slug: ev.slug,
      status: ev.status as EventStatus,
      description: ev.description,
      startAt: toLocalInput(ev.startAt),
      endAt: toLocalInput(ev.endAt),
      location: ev.location ?? "",
      imageUrl: ev.imageUrl ?? "",
      squareItemId: ev.squareItemId ?? "",
    });
    setDialogOpen(true);
  }

  async function doSave() {
    setIsPending(true);
    try {
      if (editing) {
        await updateEvent({
          siteId,
          eventId: editing._id,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          location: form.location || undefined,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
        });
        toast({ title: "Event updated" });
      } else {
        await createEvent({
          siteId,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          location: form.location || undefined,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
        });
        toast({ title: "Event created" });
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
    if (form.status === "published") {
      setValidationOpen(true);
      return;
    }
    await doSave();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEvent({ siteId, eventId: deleteTarget._id });
      toast({ title: "Event deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete event",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const eventValidationData = {
    title: form.title,
    imageUrl: form.imageUrl || undefined,
    description: form.description,
    slug: form.slug,
  };

  return (
    <AppLayout siteId={params.siteId}>
      <LivePreviewPanel siteId={siteId} section="events">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage upcoming events for this site.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {data === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No events yet</h3>
          <p className="text-slate-500 mt-1">Add your first event to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Starts</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Location</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((ev: any) => (
                <tr key={ev._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{ev.title}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(ev.status)}>{ev.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(ev.startAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">{ev.location || "—"}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(ev)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(ev)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </LivePreviewPanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Starts At</Label>
                <Input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Square Catalog Item <span className="text-slate-400 font-normal">(for paid registration)</span></Label>
              <Select value={form.squareItemId || "__none__"} onValueChange={(v) => setForm({ ...form, squareItemId: v === "__none__" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Free / not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Free / not linked</SelectItem>
                  {(catalogItems ?? []).map((item: any) => (
                    <SelectItem key={item.squareItemId} value={item.squareItemId}>
                      {item.name}{item.priceCents != null ? ` — $${(item.priceCents / 100).toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(catalogItems ?? []).length === 0 && (
                <p className="text-xs text-slate-400">No catalog items synced yet. Sync from Commerce → Catalog first.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
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
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PublishValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        onPublish={doSave}
        data={eventValidationData}
        title={editing ? `Event: ${form.title}` : "New Event"}
      />
    </AppLayout>
  );
}
