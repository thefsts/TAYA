import { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Plus,
  Pencil,
  Archive,
  MoreVertical,
  Megaphone,
  Send,
  Eye,
  CalendarDays,
  Link as LinkIcon,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { ImagePickerField } from "@/components/ImagePickerField";
import { PERMISSIONS } from "@/lib/permissions";
import { roleHasPermission } from "@/lib/roleCapabilities";

// ── Types ────────────────────────────────────────────────────────────────────

type FlyerStatus = "draft" | "scheduled" | "published" | "archived";
type EntityType = "class" | "event" | "service" | "general";

type FlyerFormState = {
  title: string;
  description: string;
  imageUrl: string;
  buttonLabel: string;
  buttonDestination: string;
  startDate: string;       // ISO date string for <input type="date">
  expirationDate: string;
  associatedEntityType: EntityType | "";
  associatedEntityId: string;
};

const emptyForm: FlyerFormState = {
  title: "",
  description: "",
  imageUrl: "",
  buttonLabel: "",
  buttonDestination: "",
  startDate: "",
  expirationDate: "",
  associatedEntityType: "",
  associatedEntityId: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEpoch(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d.getTime();
}

function fromEpoch(epoch?: number | null): string {
  if (epoch == null) return "";
  const d = new Date(epoch);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusVariant(status: FlyerStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "published": return "default";
    case "scheduled": return "secondary";
    case "archived": return "secondary";
    default: return "outline";
  }
}

function statusLabel(status: FlyerStatus): string {
  switch (status) {
    case "published": return "Published";
    case "scheduled": return "Scheduled";
    case "archived": return "Archived";
    default: return "Draft";
  }
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function FlyerPreview({
  form,
  primaryColor,
}: {
  form: FlyerFormState;
  primaryColor: string;
}) {
  if (!form.title && !form.imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
        <Megaphone className="h-8 w-8 mb-2 opacity-40" />
        <p>Fill in the form to see a preview</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Preview badge */}
      <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        Preview — appearance may vary by website template
      </div>

      {/* Flyer card */}
      <div className="bg-white">
        {form.imageUrl && (
          <div className="aspect-[16/7] overflow-hidden">
            <img
              src={form.imageUrl}
              alt={form.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4 space-y-2">
          {form.title && (
            <h3 className="font-bold text-slate-900 text-lg leading-tight">{form.title}</h3>
          )}
          {form.description && (
            <p className="text-slate-600 text-sm leading-relaxed">{form.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {form.startDate && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                From {new Date(form.startDate).toLocaleDateString()}
                {form.expirationDate && ` – ${new Date(form.expirationDate).toLocaleDateString()}`}
              </span>
            )}
          </div>
          {form.buttonLabel && (
            <div className="pt-2">
              <span
                className="inline-block px-4 py-2 rounded-md text-sm font-medium text-white"
                style={{ backgroundColor: primaryColor || "#1e3a5f" }}
              >
                {form.buttonLabel}
              </span>
              {form.buttonDestination && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  {form.buttonDestination}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FlyerManager({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FlyerFormState>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<any | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const me = useQuery(api.users.me);
  const site = useQuery(api.sites.get, { siteId });
  const flyers = useQuery(
    api.flyers.list,
    activeTab === "all"
      ? { siteId }
      : { siteId, status: activeTab },
  );
  const courses = useQuery(api.courses.list, { siteId });
  const events = useQuery(api.events.list, { siteId });
  const services = useQuery(api.services.list, { siteId });

  const createFlyer = useMutation(api.flyers.create);
  const updateFlyer = useMutation(api.flyers.update);
  const publishFlyer = useMutation(api.flyers.publish);
  const scheduleFlyer = useMutation(api.flyers.schedule);
  const archiveFlyer = useMutation(api.flyers.archive);

  const isSuperAdmin = me?.isSuperAdmin ?? false;
  // Use the canonical RBAC permission map — never hard-code role strings here.
  const canManage =
    isSuperAdmin ||
    (me?.roles ?? []).some(
      (r: any) =>
        r.siteId === siteId &&
        roleHasPermission(r.role, PERMISSIONS.FLYERS_CREATE),
    );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(flyer: any) {
    setEditing(flyer);
    setForm({
      title: flyer.title ?? "",
      description: flyer.description ?? "",
      imageUrl: flyer.imageUrl ?? "",
      buttonLabel: flyer.buttonLabel ?? "",
      buttonDestination: flyer.buttonDestination ?? "",
      startDate: fromEpoch(flyer.startDate),
      expirationDate: fromEpoch(flyer.expirationDate),
      associatedEntityType: (flyer.associatedEntityType as EntityType) ?? "",
      associatedEntityId: flyer.associatedEntityId ?? "",
    });
    setDialogOpen(true);
  }

  async function doSave() {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const payload = {
        siteId,
        title: form.title.trim(),
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        buttonLabel: form.buttonLabel || undefined,
        buttonDestination: form.buttonDestination || undefined,
        startDate: toEpoch(form.startDate),
        expirationDate: toEpoch(form.expirationDate),
        associatedEntityType: (form.associatedEntityType as EntityType) || undefined,
        associatedEntityId: form.associatedEntityId || undefined,
      };

      if (editing) {
        await updateFlyer({ flyerId: editing._id, ...payload });
        toast({ title: "Flyer updated" });
      } else {
        await createFlyer(payload);
        toast({ title: "Flyer created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function doPublish(flyer: any) {
    try {
      await publishFlyer({ siteId, flyerId: flyer._id });
      toast({ title: "Flyer published" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function doSchedule() {
    if (!scheduleTarget || !scheduleDate) return;
    setIsScheduling(true);
    try {
      const epoch = toEpoch(scheduleDate);
      if (!epoch) {
        toast({ title: "Pick a valid start date to schedule", variant: "destructive" });
        return;
      }
      await scheduleFlyer({ siteId, flyerId: scheduleTarget._id, startDate: epoch });
      toast({ title: "Flyer scheduled" });
      setScheduleTarget(null);
      setScheduleDate("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setIsArchiving(true);
    try {
      await archiveFlyer({ siteId, flyerId: archiveTarget._id, archivedReason: "manual" });
      toast({ title: "Flyer archived" });
      setArchiveTarget(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  }

  // ── Associated entity options ───────────────────────────────────────────
  const entityOptions = (() => {
    if (!form.associatedEntityType) return [];
    if (form.associatedEntityType === "class") {
      return (courses ?? []).map((c: any) => ({ id: c._id, label: c.title }));
    }
    if (form.associatedEntityType === "event") {
      return (events ?? []).map((e: any) => ({ id: e._id, label: e.title }));
    }
    if (form.associatedEntityType === "service") {
      return (services ?? []).map((s: any) => ({ id: s._id, label: s.title }));
    }
    return [];
  })();

  // ── Loading / access guard ──────────────────────────────────────────────
  if (flyers === undefined || me === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  // Access-denied guard — required convention for all site pages.
  if (me === null || !canManage) {
    return (
      <AppLayout siteId={params.siteId}>
        <ModuleAccessDenied message="You need flyer management permissions to access this page." />
      </AppLayout>
    );
  }

  const primaryColor = (site as any)?.brandColorPrimary ?? "#1e3a5f";

  const TABS = [
    { value: "all", label: "All" },
    { value: "published", label: "Published" },
    { value: "scheduled", label: "Scheduled" },
    { value: "draft", label: "Drafts" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <AppLayout siteId={params.siteId}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-2">
          <Megaphone className="w-6 h-6 text-slate-500 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Flyer Manager</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create and publish promotional flyers for your website.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          New Flyer
        </Button>
      </div>

      {/* Status tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Flyer list */}
      {flyers.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No flyers yet</p>
          <p className="text-sm mt-1">Click "New Flyer" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flyers.map((flyer: any) => (
            <Card key={flyer._id} className="border-slate-200 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  {flyer.imageUrl ? (
                    <div className="w-16 h-12 rounded-md overflow-hidden flex-shrink-0 bg-slate-100">
                      <img
                        src={flyer.imageUrl}
                        alt={flyer.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-md flex-shrink-0 bg-slate-100 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-slate-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">{flyer.title}</span>
                      <Badge variant={statusVariant(flyer.status as FlyerStatus)}>
                        {statusLabel(flyer.status as FlyerStatus)}
                      </Badge>
                      {/* Expiry-warning badge — flyers expiring within 7 days */}
                      {flyer.status !== "archived" &&
                        flyer.expirationDate != null &&
                        flyer.expirationDate > Date.now() &&
                        flyer.expirationDate <= Date.now() + 7 * 24 * 60 * 60 * 1000 && (() => {
                          const daysLeft = Math.ceil(
                            (flyer.expirationDate - Date.now()) / (24 * 60 * 60 * 1000),
                          );
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              Expires in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                            </span>
                          );
                        })()}
                      {/* Archived-reason labels */}
                      {flyer.status === "archived" && flyer.archivedReason === "expired" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Info className="h-3 w-3" />
                          Expired — archived automatically.
                        </span>
                      )}
                      {flyer.status === "archived" && flyer.archivedReason === "associated_entity_ended" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Info className="h-3 w-3" />
                          Associated event was cancelled.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      {flyer.startDate && (
                        <span className="flex items-center gap-0.5">
                          <CalendarDays className="h-3 w-3" />
                          From {new Date(flyer.startDate).toLocaleDateString()}
                        </span>
                      )}
                      {flyer.expirationDate && (
                        <span>Expires {new Date(flyer.expirationDate).toLocaleDateString()}</span>
                      )}
                      {flyer.associatedEntityType && flyer.associatedEntityType !== "general" && (
                        <span className="capitalize">{flyer.associatedEntityType} link</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(flyer)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {flyer.status !== "published" && flyer.status !== "archived" && (
                        <DropdownMenuItem onClick={() => doPublish(flyer)}>
                          <Send className="h-4 w-4 mr-2" /> Publish Now
                        </DropdownMenuItem>
                      )}
                      {flyer.status === "draft" && (
                        <DropdownMenuItem
                          onClick={() => {
                            setScheduleTarget(flyer);
                            setScheduleDate(fromEpoch(flyer.startDate) || "");
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" /> Schedule
                        </DropdownMenuItem>
                      )}
                      {flyer.status !== "archived" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setArchiveTarget(flyer)}
                          >
                            <Archive className="h-4 w-4 mr-2" /> Archive
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Flyer: ${editing.title}` : "New Flyer"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Summer Sale — 20% Off All Classes"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short promotional copy that appears below the title…"
                />
              </div>

              <ImagePickerField
                label="Flyer Image"
                value={form.imageUrl}
                onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                siteId={siteId}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Button Label</Label>
                  <Input
                    className="mt-1"
                    value={form.buttonLabel}
                    onChange={(e) => setForm((f) => ({ ...f, buttonLabel: e.target.value }))}
                    placeholder="Register Now"
                  />
                </div>
                <div>
                  <Label>Button URL</Label>
                  <Input
                    className="mt-1"
                    value={form.buttonDestination}
                    onChange={(e) => setForm((f) => ({ ...f, buttonDestination: e.target.value }))}
                    placeholder="/register"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Expiration Date</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.expirationDate}
                    onChange={(e) => setForm((f) => ({ ...f, expirationDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Associated Entity Type</Label>
                <Select
                  value={form.associatedEntityType || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      associatedEntityType: v === "__none__" ? "" : (v as EntityType),
                      associatedEntityId: "",
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="None / General" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None / General</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="class">Class / Course</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.associatedEntityType &&
                form.associatedEntityType !== "general" &&
                entityOptions.length > 0 && (
                  <div>
                    <Label>
                      Associated{" "}
                      {form.associatedEntityType === "class"
                        ? "Class"
                        : form.associatedEntityType === "event"
                          ? "Event"
                          : "Service"}
                    </Label>
                    <Select
                      value={form.associatedEntityId || "__none__"}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          associatedEntityId: v === "__none__" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— none —</SelectItem>
                        {entityOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
            </div>

            {/* Right: Preview */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-700">Live Preview</p>
              <FlyerPreview form={form} primaryColor={primaryColor} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Flyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <AlertDialog open={!!scheduleTarget} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule "{scheduleTarget?.title}"</AlertDialogTitle>
            <AlertDialogDescription>
              The flyer will appear as <strong>Scheduled</strong> until the start date arrives,
              then become active once published. You can publish it immediately instead using
              "Publish Now".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Start Date *</Label>
            <Input
              type="date"
              className="mt-1"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSchedule} disabled={isScheduling || !scheduleDate}>
              {isScheduling ? "Scheduling…" : "Schedule Flyer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{archiveTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived flyers are no longer shown on the website. They are never deleted and can
              be viewed in the Archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={isArchiving}
              className="bg-red-600 hover:bg-red-700"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
