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
import { BookOpen, Pencil, Plus, Trash2, Users } from "lucide-react";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { PublishValidationModal } from "@/components/PublishValidationModal";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import { LifecycleAlertList } from "@/components/LifecycleAlert";
import type { LifecycleAlertType } from "@/components/LifecycleAlert";
import {
  ClientEmptyState,
  ClientLoadingList,
  ClientPageHeader,
  ClientSection,
  ClientToolbar,
} from "@/components/ClientPage";
import { NEARLY_FULL_THRESHOLD, LIFECYCLE_STATUS_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/formatPrice";

const COURSE_IMAGE_PRESET = SITE_PRESETS.find((p) => p.label === "Course/Event Thumb");

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

function filterCourses(data: any[], filter: FilterValue): any[] {
  switch (filter) {
    case "all":
      return data;
    case "upcoming":
      return data.filter(
        (c) =>
          c.status !== "archived" &&
          !["Completed", "Cancelled", "Archived"].includes(c.lifecycleStatus ?? ""),
      );
    case "open-registration":
      return data.filter((c) => c.lifecycleStatus === "RegistrationOpen");
    case "nearly-full":
      return data.filter((c) => c.lifecycleStatus === "NearlyFull");
    case "full":
      return data.filter((c) => c.lifecycleStatus === "Full");
    case "waitlist":
      return data.filter((c) => c.lifecycleStatus === "WaitlistOpen");
    case "in-progress":
      return data.filter((c) => c.lifecycleStatus === "InProgress");
    case "past":
      return data.filter((c) => c.lifecycleStatus === "Completed");
    case "cancelled":
      return data.filter((c) => c.lifecycleStatus === "Cancelled");
    case "draft":
      return data.filter((c) => c.status === "draft");
    case "archived":
      return data.filter(
        (c) => c.status === "archived" || c.lifecycleStatus === "Archived",
      );
    default:
      return data;
  }
}

type CourseStatus = "draft" | "published" | "archived";

type CourseFormState = {
  title: string;
  slug: string;
  status: CourseStatus;
  description: string;
  durationLabel: string;
  priceCents: string;
  imageUrl: string;
  squareItemId: string;
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

const emptyForm: CourseFormState = {
  title: "",
  slug: "",
  status: "draft",
  description: "",
  durationLabel: "",
  priceCents: "",
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

function CapacityBar({ entityId, siteId }: { entityId: string; siteId: Id<"sites"> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts = useQuery((api as any).registrations.getCount, {
    siteId,
    entityType: "course",
    entityId,
  });
  return counts ? (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <Users className="h-3 w-3" />
      {counts.confirmedCount}
      {counts.waitlistCount > 0 && <span className="font-medium text-amber-600">+{counts.waitlistCount}w</span>}
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
    entityType: "course",
    entityId,
  });

  if (!capacity) return null;
  if (!counts) return <Skeleton className="h-6 w-full" />;

  const { confirmedCount, waitlistCount } = counts;
  const pct = Math.min(100, (confirmedCount / capacity) * 100);
  const isNearlyFull = confirmedCount / capacity >= NEARLY_FULL_THRESHOLD;
  const isFull = confirmedCount >= capacity;

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
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

function CourseAlerts({ entity, siteId }: { entity: any; siteId: Id<"sites"> }) {
  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts = useQuery((api as any).registrations.getCount, {
    siteId,
    entityType: "course",
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
    closingSoon ? { type: "registration_closing_soon" } : null,
    counts && counts.waitlistCount > 0
      ? { type: "waitlist", count: counts.waitlistCount }
      : null,
  ];

  return <LifecycleAlertList alerts={alerts} />;
}

export default function CoursesList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.courses.list, { siteId });
  const catalogItems = useQuery(api.square.listCatalogItems, { siteId });
  const createCourse = useMutation(api.courses.create);
  const updateCourse = useMutation(api.courses.update);
  const deleteCourse = useMutation(api.courses.remove);

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
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(course: any) {
    setEditing(course);
    setForm({
      title: course.title,
      slug: course.slug,
      status: course.status as CourseStatus,
      description: course.description,
      durationLabel: course.durationLabel ?? "",
      priceCents: course.priceCents != null ? String(course.priceCents) : "",
      imageUrl: course.imageUrl ?? "",
      squareItemId: course.squareItemId ?? "",
      capacity: course.capacity != null ? String(course.capacity) : "",
      waitlistCapacity: course.waitlistCapacity != null ? String(course.waitlistCapacity) : "",
      startDateTime: toDatetimeLocal(course.startDateTime),
      endDateTime: toDatetimeLocal(course.endDateTime),
      registrationOpenAt: toDatetimeLocal(course.registrationOpenAt),
      registrationCloseAt: toDatetimeLocal(course.registrationCloseAt),
      timezone: course.timezone ?? "America/New_York",
      autoCloseRegistration: course.autoCloseRegistration ?? false,
      autoArchive: course.autoArchive ?? false,
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

      if (editing) {
        const updatePriceCents = form.priceCents !== "" ? parseInt(form.priceCents, 10) : null;
        await updateCourse({
          siteId,
          courseId: editing._id,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          durationLabel: form.durationLabel || undefined,
          priceCents: updatePriceCents,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
          ...capacityFields,
        });
        toast({ title: "Course updated" });
      } else {
        const createPriceCents = form.priceCents !== "" ? parseInt(form.priceCents, 10) : undefined;
        await createCourse({
          siteId,
          title: form.title,
          slug: form.slug,
          status: form.status,
          description: form.description,
          durationLabel: form.durationLabel || undefined,
          priceCents: createPriceCents,
          imageUrl: form.imageUrl || undefined,
          squareItemId: form.squareItemId || undefined,
          ...capacityFields,
        });
        toast({ title: "Course created" });
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
      await deleteCourse({ siteId, courseId: deleteTarget._id });
      toast({ title: "Course deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete course",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const courseValidationData = {
    title: form.title,
    imageUrl: form.imageUrl || undefined,
    description: form.description,
    slug: form.slug,
  };

  const filteredData = Array.isArray(data) ? filterCourses(data, activeFilter) : data;

  return (
    <AppLayout siteId={params.siteId} pageContext="Courses & Classes">
      <LivePreviewPanel siteId={siteId} section="courses">
        <ClientPageHeader
          eyebrow="Courses & Classes"
          title="Course Management"
          description="Create, publish, schedule, and monitor classes from one place. Capacity, waitlists, registration windows, and lifecycle automation stay connected to the live site."
          actions={(
            <Button onClick={openCreate} className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          )}
          meta={data && Array.isArray(data) ? (
            <>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                {data.length} total
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {data.filter((course: any) => course.status === "published").length} published
              </span>
            </>
          ) : undefined}
        />

        <ClientToolbar className="overflow-x-auto">
          <div className="flex min-w-max flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  activeFilter === tab.value
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </ClientToolbar>

        {data === undefined ? (
          <ClientLoadingList rows={5} />
        ) : data === null ? (
          <ModuleAccessDenied message="Unable to load Courses — you may not have access to this site or the courses module is disabled." />
        ) : filteredData!.length === 0 ? (
          <ClientSection>
            {data.length === 0 ? (
              <ClientEmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Create your first course or class. You can add capacity, scheduling, waitlist limits, and automatic registration rules during setup."
                action={(
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Course
                  </Button>
                )}
              />
            ) : (
              <ClientEmptyState
                icon={BookOpen}
                title="No courses match this filter"
                description="Try another lifecycle view or return to the complete course list."
                action={(
                  <Button variant="outline" onClick={() => setFilter("all")}>View All Courses</Button>
                )}
              />
            )}
          </ClientSection>
        ) : (
          <ClientSection
            title="Course Catalog"
            description={`${filteredData!.length} course${filteredData!.length === 1 ? "" : "s"} in this view`}
          >
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Lifecycle</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Registrations</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Price</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData!.map((course: any) => (
                    <tr key={course._id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{course.title}</div>
                        {course.slug && <div className="mt-0.5 text-xs text-slate-400">/{course.slug}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={statusVariant(course.status)} className="capitalize">{course.status}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        {course.lifecycleStatus ? (
                          <Badge variant={lifecycleBadgeVariant(course.lifecycleStatus)}>
                            {LIFECYCLE_STATUS_LABELS[course.lifecycleStatus] ?? course.lifecycleStatus}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {course.capacity ? (
                          <CapacityBar entityId={course._id} siteId={siteId} />
                        ) : (
                          <span className="text-xs text-slate-400">Unlimited</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-500">{course.durationLabel || "—"}</td>
                      <td className="px-4 py-4 font-medium text-slate-600">
                        {course.priceCents != null ? formatPrice(course.priceCents) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => openEdit(course)} title={`Edit ${course.title}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-red-50" onClick={() => setDeleteTarget(course)} title={`Delete ${course.title}`}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ClientSection>
        )}
      </LivePreviewPanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
            <DialogHeader>
              <DialogTitle className="text-xl tracking-tight">{editing ? "Edit Course" : "New Course"}</DialogTitle>
              <p className="text-sm text-slate-500">
                {editing ? "Update course content, registration rules, capacity, and schedule." : "Create a course and configure how registration behaves on the live website."}
              </p>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-5 pb-6 sm:px-6">
            {editing && <CourseAlerts entity={editing} siteId={siteId} />}

            {editing && editing.capacity && (
              <CapacityPanel
                entityId={editing._id}
                siteId={siteId}
                capacity={editing.capacity}
                waitlistCapacity={editing.waitlistCapacity}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input aria-label="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input aria-label="slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  aria-label="Description"
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CourseStatus })}>
                    <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration Label</Label>
                  <Input aria-label="6 weeks" placeholder="e.g. 6 weeks" value={form.durationLabel} onChange={(e) => setForm({ ...form, durationLabel: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Price (cents)</Label>
                  <Input aria-label="9900 for $99" type="number" placeholder="e.g. 9900 for $99" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                    <SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Schedule</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Start Date &amp; Time</Label>
                    <Input aria-label="start date time" type="datetime-local" value={form.startDateTime} onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Date &amp; Time</Label>
                    <Input aria-label="end date time" type="datetime-local" value={form.endDateTime} onChange={(e) => setForm({ ...form, endDateTime: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Registration Opens</Label>
                    <Input aria-label="registration open at" type="datetime-local" value={form.registrationOpenAt} onChange={(e) => setForm({ ...form, registrationOpenAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Registration Closes</Label>
                    <Input aria-label="registration close at" type="datetime-local" value={form.registrationCloseAt} onChange={(e) => setForm({ ...form, registrationCloseAt: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Capacity &amp; Automation</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Max Capacity <span className="font-normal text-slate-400">(blank = unlimited)</span></Label>
                    <Input aria-label="20" type="number" min={1} placeholder="e.g. 20" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Waitlist Capacity <span className="font-normal text-slate-400">(0 = none)</span></Label>
                    <Input aria-label="5" type="number" min={0} placeholder="e.g. 5" value={form.waitlistCapacity} onChange={(e) => setForm({ ...form, waitlistCapacity: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.autoCloseRegistration}
                      onChange={(e) => setForm({ ...form, autoCloseRegistration: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">Auto-close at capacity</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Stop new confirmed registrations automatically when the class is full.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.autoArchive}
                      onChange={(e) => setForm({ ...form, autoArchive: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      <span className="block font-medium text-slate-800">Auto-archive when completed</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">Move the course out of upcoming views after its lifecycle is complete.</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Media &amp; Integrations</h3>
                <div className="space-y-4">
                  <ImagePickerField
                    siteId={siteId}
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    initialPreset={COURSE_IMAGE_PRESET}
                    label="Course Image"
                  />
                  <div className="space-y-1.5">
                    <Label>Square Catalog Item <span className="font-normal text-slate-400">(for checkout pricing)</span></Label>
                    <Select value={form.squareItemId || "__none__"} onValueChange={(v) => setForm({ ...form, squareItemId: v === "__none__" ? "" : v })}>
                      <SelectTrigger aria-label="Square Catalog Item">
                        <SelectValue placeholder="Not linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not linked</SelectItem>
                        {(catalogItems ?? []).map((item: any) => (
                          <SelectItem key={item.squareItemId} value={item.squareItemId}>
                            {item.name}{item.priceCents != null ? ` — ${formatPrice(item.priceCents)}` : ""}
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

              <DialogFooter className="sticky bottom-0 border-t border-slate-200 bg-white pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save Course"}</Button>
              </DialogFooter>
            </form>
          </div>
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
        data={courseValidationData}
        title={editing ? `Course: ${form.title}` : "New Course"}
      />
    </AppLayout>
  );
}
