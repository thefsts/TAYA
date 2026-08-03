import { useState } from "react";
import { useSearch, useLocation } from "wouter";
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
import { Progress } from "@/components/ui/progress";
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
import { CalendarDays, Pencil, Plus, Trash2, Users } from "lucide-react";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { PublishValidationModal } from "@/components/PublishValidationModal";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import { LifecycleAlertList } from "@/components/LifecycleAlert";
import type { LifecycleAlertType } from "@/components/LifecycleAlert";

// Course/Event Thumb preset (16:9, 800×450)
const EVENT_IMAGE_PRESET = SITE_PRESETS.find((p) => p.label === "Course/Event Thumb");
import { NEARLY_FULL_THRESHOLD, LIFECYCLE_STATUS_LABELS } from "@/lib/constants";

// Common IANA timezones for the picker
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "UTC",
];

// ── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "open-registration", label: "Open Registration" },
  { value: "nearly-full", label: "Nearly Full" },
  { value: "full", label: "Full" },
  { value: "waitlist", label: "Waitlist" },
  { value: "in-progress", label: "In Progress" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

type FilterValue = (typeof FILTER_TABS)[number]["value"];

function filterEvents(data: any[], filter: FilterValue): any[] {
  switch (filter) {
    case "all":
      return data;
    case "upcoming":
      return data.filter(
        (e) =>
          e.status !== "archived" &&
          !["Completed", "Cancelled", "Archived"].includes(e.lifecycleStatus ?? ""),
      );
    case "open-registration":
      return data.filter((e) => e.lifecycleStatus === "RegistrationOpen");
    case "nearly-full":
      return data.filter((e) => e.lifecycleStatus === "NearlyFull");
    case "full":
      return data.filter((e) => e.lifecycleStatus === "Full");
    case "waitlist":
      return data.filter((e) => e.lifecycleStatus === "WaitlistOpen");
    case "in-progress":
      return data.filter((e) => e.lifecycleStatus === "InProgress");
    case "past":
      return data.filter((e) => e.lifecycleStatus === "Completed");
    case "cancelled":
      return data.filter((e) => e.lifecycleStatus === "Cancelled");
    case "draft":
      return data.filter((e) => e.status === "draft");
    case "archived":
      return data.filter(
        (e) => e.status === "archived" || e.lifecycleStatus === "Archived",
      );
    default:
      return data;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  // Capacity & scheduling
  capacity: string;
  waitlistCapacity: string;
  startDateTime: string;
  endDateTime: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  timezone: string;
  autoCloseRegistration: boolean;
  autoArchive: boolean;
};

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeLocal(ts?: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string): number | undefined {
  if (!s) return undefined;
  return new Date(s).getTime();
}

/**
 * Convert a datetime-local string to a UTC ISO-8601 string.
 * The browser interprets an unzoned datetime-local value as *local* time, so
 * `new Date(s)` here (in the browser) produces the correct UTC epoch.
 * Sending the ISO string ensures the Convex server (which also calls
 * `new Date(str)`) gets an unambiguous UTC timestamp regardless of server TZ.
 */
function toIso(s: string): string | undefined {
  if (!s) return undefined;
  return new Date(s).toISOString();
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
  capacity: "",
  waitlistCapacity: "",
  startDateTime: "",
  endDateTime: "",
  registrationOpenAt: "",
  registrationCloseAt: "",
  timezone: "America/New_York",
  autoCloseRegistration: false,
  autoArchive: false,
};

function lifecycleBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "RegistrationOpen": return "default";
    case "NearlyFull": return "default";
    case "Full": return "destructive";
    case "WaitlistOpen": return "secondary";
    case "Cancelled":
    case "RegistrationClosed": return "destructive";
    case "Completed":
    case "Archived": return "secondary";
    default: return "outline";
  }
}

function statusVariant(status: string) {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

// ── Capacity components ───────────────────────────────────────────────────────

function CapacityBar({ entityId, siteId }: { entityId: string; siteId: Id<"sites"> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts = useQuery((api as any).registrations.getCount, {
    siteId,
    entityType: "event",
    entityId,
  });
  return counts ? (
    <span className="text-xs text-slate-500 flex items-center gap-1">
      <Users className="h-3 w-3" />
      {counts.confirmedCount}
      {counts.waitlistCount > 0 && <span className="text-amber-600">+{counts.waitlistCount}w</span>}
    </span>
  ) : null;
}

function CapacityPanel({
  entityId,
  siteId,
  capacity,
  waitlistCapacity,
}: {
  entityId: string;
  siteId: Id<"sites">;
  capacity?: number;
  waitlistCapacity?: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts = useQuery((api as any).registrations.getCount, {
    siteId,
    entityType: "event",
    entityId,
  });

  if (!capacity) return null;
  if (!counts) return <Skeleton className="h-6 w-full" />;

  const { confirmedCount, waitlistCount } = counts;
  const pct = Math.min(100, (confirmedCount / capacity) * 100);
  const isNearlyFull = confirmedCount / capacity >= NEARLY_FULL_THRESHOLD;
  const isFull = confirmedCount >= capacity;

  return (
    <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-200">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Registrations</span>
        <span className={`font-semibold ${isFull ? "text-red-600" : isNearlyFull ? "text-amber-600" : "text-slate-700"}`}>
          {confirmedCount} / {capacity}
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-2 ${isFull ? "[&>div]:bg-red-500" : isNearlyFull ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
      />
      {waitlistCapacity && waitlistCapacity > 0 && (
        <p className="text-xs text-slate-500">
          Waitlist: {waitlistCount} / {waitlistCapacity}
        </p>
      )}
    </div>
  );
}

// ── Lifecycle alerts for the edit dialog ─────────────────────────────────────

function EventAlerts({ entity, siteId }: { entity: any; siteId: Id<"sites"> }) {
  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts = useQuery((api as any).registrations.getCount, {
    siteId,
    entityType: "event",
    entityId: entity._id,
  });

  const closingSoon =
    entity.registrationCloseAt != null &&
    entity.registrationCloseAt > now &&
    entity.registrationCloseAt <= now + 24 * 60 * 60 * 1000;

  const alerts: Array<{ type: LifecycleAlertType; count?: number } | null> = [
    entity.lifecycleStatus === "Full" ? { type: "at_capacity" } : null,
    entity.lifecycleStatus === "NearlyFull" ? { type: "nearly_full" } : null,
    entity.lifecycleStatus === "RegistrationClosed" ? { type: "registration_closed" } : null,
    entity.lifecycleStatus === "Completed" ? { type: "event_passed" } : null,
    !entity.endDateTime ? { type: "missing_end_time" } : null,
    closingSoon ? { type: "registration_closing_soon" } : null,
    counts && counts.waitlistCount > 0
      ? { type: "waitlist", count: counts.waitlistCount }
      : null,
  ];

  return <LifecycleAlertList alerts={alerts} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventsList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.events.list, { siteId });
  const catalogItems = useQuery(api.square.listCatalogItems, { siteId });
  const createEvent = useMutation(api.events.create);
  const updateEvent = useMutation(api.events.update);
  const deleteEvent = useMutation(api.events.remove);

  // ── Filter state (URL-persisted) ─────────────────────────────────────────
  const search = useSearch();
  const [location, navigate] = useLocation();
  const activeFilter = (new URLSearchParams(search).get("filter") ?? "upcoming") as FilterValue;

  function setFilter(f: FilterValue) {
    const sp = new URLSearchParams(search);
    if (f === "upcoming") {
      sp.delete("filter");
    } else {
      sp.set("filter", f);
    }
    const qs = sp.toString();
    navigate(location + (qs ? `?${qs}` : ""), { replace: true } as any);
  }

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
      capacity: ev.capacity != null ? String(ev.capacity) : "",
      waitlistCapacity: ev.waitlistCapacity != null ? String(ev.waitlistCapacity) : "",
      startDateTime: toDatetimeLocal(ev.startDateTime),
      endDateTime: toDatetimeLocal(ev.endDateTime),
      registrationOpenAt: toDatetimeLocal(ev.registrationOpenAt),
      registrationCloseAt: toDatetimeLocal(ev.registrationCloseAt),
      timezone: ev.timezone ?? "America/New_York",
      autoCloseRegistration: ev.autoCloseRegistration ?? false,
      autoArchive: ev.autoArchive ?? false,
    });
    setDialogOpen(true);
  }

  async function doSave() {
    setIsPending(true);
    try {
      const capacityFields = {
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        waitlistCapacity: form.waitlistCapacity ? parseInt(form.waitlistCapacity, 10) : undefined,
        startDateTime: fromDatetimeLocal(form.startDateTime),
        endDateTime: fromDatetimeLocal(form.endDateTime),
        registrationOpenAt: fromDatetimeLocal(form.registrationOpenAt),
        registrationCloseAt: fromDatetimeLocal(form.registrationCloseAt),
        timezone: form.timezone || undefined,
        autoCloseRegistration: form.autoCloseRegistration,
        autoArchive: form.autoArchive,
      };

      // Convert datetime-local strings to UTC ISO before sending to the backend.
      // new Date(datetimeLocalStr) in the browser interprets the value as local
      // time; .toISOString() produces unambiguous UTC for the Convex server.
      const startAtIso = toIso(form.startAt);
      const endAtIso = toIso(form.endAt);

      if (editing) {
        await updateEvent({
          siteId,
          eventId: editing._id,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          startAt: startAtIso,
          endAt: endAtIso,
          location: form.location || undefined,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
          ...capacityFields,
        });
        toast({ title: "Event updated" });
      } else {
        await createEvent({
          siteId,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          startAt: startAtIso ?? form.startAt,
          endAt: endAtIso,
          location: form.location || undefined,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
          ...capacityFields,
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

  const filteredData = Array.isArray(data) ? filterEvents(data, activeFilter) : data;

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

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              activeFilter === tab.value
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Events — you may not have access to this site or the events module is disabled." />
      ) : filteredData!.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          {data.length === 0 ? (
            <>
              <h3 className="text-lg font-medium text-slate-900">No events yet</h3>
              <p className="text-slate-500 mt-1">Add your first event to get started.</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-slate-900">No events match this filter</h3>
              <p className="text-slate-500 mt-1">
                <button onClick={() => setFilter("all")} className="text-primary underline">View all events</button>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Lifecycle</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Registrations</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Starts</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Location</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData!.map((ev: any) => (
                <tr key={ev._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{ev.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(ev.status)}>{ev.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {ev.lifecycleStatus ? (
                      <Badge variant={lifecycleBadgeVariant(ev.lifecycleStatus)}>
                        {LIFECYCLE_STATUS_LABELS[ev.lifecycleStatus] ?? ev.lifecycleStatus}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {ev.capacity ? (
                      <CapacityBar entityId={ev._id} siteId={siteId} />
                    ) : (
                      <span className="text-slate-400 text-xs">Unlimited</span>
                    )}
                  </td>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>

          {/* Lifecycle alerts when editing an existing event */}
          {editing && <EventAlerts entity={editing} siteId={siteId} />}

          {/* Live capacity panel when editing */}
          {editing && editing.capacity && (
            <CapacityPanel
              entityId={editing._id}
              siteId={siteId}
              capacity={editing.capacity}
              waitlistCapacity={editing.waitlistCapacity}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Basic Info ── */}
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
              <Textarea
                required
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
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
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="e.g. Main Studio" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>

            {/* ── Event Date/Time ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Event Date &amp; Time</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── Registration Window ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Registration Window</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Registration Opens</Label>
                  <Input type="datetime-local" value={form.registrationOpenAt} onChange={(e) => setForm({ ...form, registrationOpenAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Registration Closes</Label>
                  <Input type="datetime-local" value={form.registrationCloseAt} onChange={(e) => setForm({ ...form, registrationCloseAt: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── Capacity ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Capacity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Max Capacity <span className="text-slate-400 font-normal">(leave blank for unlimited)</span></Label>
                  <Input type="number" min={1} placeholder="e.g. 50" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Waitlist Capacity <span className="text-slate-400 font-normal">(0 = no waitlist)</span></Label>
                  <Input type="number" min={0} placeholder="e.g. 10" value={form.waitlistCapacity} onChange={(e) => setForm({ ...form, waitlistCapacity: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-6 mt-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoCloseRegistration}
                    onChange={(e) => setForm({ ...form, autoCloseRegistration: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Auto-close registration at capacity
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoArchive}
                    onChange={(e) => setForm({ ...form, autoArchive: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Auto-archive when completed
                </label>
              </div>
            </div>

            {/* ── Media ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Media &amp; Integrations</h3>
              <div className="space-y-4">
                <ImagePickerField
                  siteId={siteId}
                  value={form.imageUrl}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  initialPreset={EVENT_IMAGE_PRESET}
                  label="Event Image"
                />
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
              </div>
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
