import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Inbox, Mail, MailOpen, Archive, Flag, Trash2, Eye } from "lucide-react";

type Status = "new" | "read" | "archived" | "spam";

const STATUS_LABELS: Record<Status, string> = {
  new: "New",
  read: "Read",
  archived: "Archived",
  spam: "Spam",
};

function statusVariant(status: Status): "default" | "secondary" | "outline" | "destructive" {
  if (status === "new") return "default";
  if (status === "spam") return "destructive";
  return "secondary";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function FormSubmissions({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Status | "all">("new");
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const submissions = useQuery(api.formSubmissions.list, {
    siteId,
    ...(activeTab !== "all" ? { status: activeTab } : {}),
  });
  const updateStatus = useMutation(api.formSubmissions.updateStatus);
  const remove = useMutation(api.formSubmissions.remove);

  type Submission = NonNullable<typeof submissions>[number];
  const viewing = submissions?.find((s: Submission) => s.id === viewId);

  async function markAs(id: string, status: Status) {
    try {
      await updateStatus({ siteId, submissionId: id as Id<"formSubmissions">, status });
      if (viewId === id && status !== "read") setViewId(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function openView(id: string) {
    setViewId(id);
    const sub = submissions?.find((s: Submission) => s.id === id);
    if (sub?.status === "new") {
      await markAs(id, "read");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await remove({ siteId, submissionId: deleteId as Id<"formSubmissions"> });
      toast({ title: "Submission deleted" });
      if (viewId === deleteId) setViewId(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contact Form Inbox</h1>
        <p className="text-sm text-slate-500 mt-0.5">All form submissions from your website.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="new"><Mail className="w-3.5 h-3.5 mr-1.5" /> New</TabsTrigger>
          <TabsTrigger value="read"><MailOpen className="w-3.5 h-3.5 mr-1.5" /> Read</TabsTrigger>
          <TabsTrigger value="archived"><Archive className="w-3.5 h-3.5 mr-1.5" /> Archived</TabsTrigger>
          <TabsTrigger value="spam"><Flag className="w-3.5 h-3.5 mr-1.5" /> Spam</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {submissions === undefined ? (
        <Skeleton className="h-64" />
      ) : submissions === null ? (
        <ModuleAccessDenied message="Unable to load Form Submissions — you may not have access to this site." />
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No submissions in this folder</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub: Submission) => (
            <div
              key={sub.id}
              className={`bg-white border rounded-xl p-4 flex gap-4 items-start cursor-pointer hover:border-slate-300 transition-colors ${sub.status === "new" ? "border-blue-200 bg-blue-50/30" : "border-slate-200"}`}
              onClick={() => openView(sub.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900 text-sm">
                    {sub.submitterName || "Anonymous"}
                  </span>
                  <Badge variant={statusVariant(sub.status as Status)} className="text-[10px]">
                    {STATUS_LABELS[sub.status as Status]}
                  </Badge>
                  <span className="text-xs text-slate-400 ml-auto">{formatDate(sub.submittedAt)}</span>
                </div>
                {sub.submitterEmail && (
                  <p className="text-xs text-slate-500 mb-1">{sub.submitterEmail}</p>
                )}
                <p className="text-sm text-slate-700 line-clamp-1">{sub.message || JSON.stringify(sub.data)}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {sub.status !== "archived" && (
                  <Button size="sm" variant="outline" title="Archive" onClick={() => markAs(sub.id, "archived")}>
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                )}
                {sub.status !== "spam" && (
                  <Button size="sm" variant="outline" title="Mark Spam" onClick={() => markAs(sub.id, "spam")}>
                    <Flag className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" title="Delete" onClick={() => setDeleteId(sub.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Name</p>
                  <p className="text-slate-900">{viewing.submitterName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Form Type</p>
                  <p className="text-slate-900 capitalize">{viewing.formType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Email</p>
                  <p className="text-slate-900">{viewing.submitterEmail || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Phone</p>
                  <p className="text-slate-900">{viewing.submitterPhone || "—"}</p>
                </div>
              </div>
              {viewing.message && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Message</p>
                  <p className="text-slate-900 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{viewing.message}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Submitted</p>
                <p className="text-slate-900">{formatDate(viewing.submittedAt)}</p>
              </div>
              <div className="flex gap-2 pt-2">
                {viewing.status !== "archived" && (
                  <Button size="sm" variant="outline" onClick={() => markAs(viewing.id, "archived")}>
                    <Archive className="w-3.5 h-3.5 mr-1.5" /> Archive
                  </Button>
                )}
                {viewing.status !== "spam" && (
                  <Button size="sm" variant="outline" onClick={() => markAs(viewing.id, "spam")}>
                    <Flag className="w-3.5 h-3.5 mr-1.5" /> Mark Spam
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-red-500 ml-auto" onClick={() => { setDeleteId(viewing.id); setViewId(null); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete submission?</AlertDialogTitle>
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
