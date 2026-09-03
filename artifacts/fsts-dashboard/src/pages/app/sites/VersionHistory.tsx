import { useState, useMemo } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { History, RotateCcw, Search, Eye } from "lucide-react";

const ENTITY_LABELS: Record<string, string> = {
  article: "Article",
  course: "Course",
  event: "Event",
  product: "Product",
  testimonial: "Testimonial",
  faq: "FAQ",
  homepage: "Homepage",
  footer: "Footer",
  contact_info: "Contact Info",
  seo_setting: "SEO Setting",
  email_settings: "Email Settings",
  site_settings_identity: "Site Identity",
  site_settings_branding: "Branding",
  site_settings_contact: "Site Contact",
  site_settings_seo: "Site SEO",
  site_settings_legal: "Legal",
  site_settings_integrations: "Integrations",
  site_settings_events: "Events Display",
};

/**
 * Extract a human-readable title from a version snapshot so the list
 * is more useful than raw entity IDs.
 */
function snapshotTitle(snap: any): string | null {
  if (!snap || typeof snap !== "object") return null;
  return (
    snap.title ??
    snap.name ??
    snap.businessName ??
    snap.question ??
    snap.headline ??
    null
  );
}

export default function VersionHistory({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);

  const data = useQuery(api.versions.list, { siteId, entityType: entityFilter !== "all" ? entityFilter : undefined });
  const restoreVersion = useMutation(api.versions.restore);

  // Collect unique entity types from unfiltered data for the filter dropdown.
  // We fetch all when no filter is applied; otherwise derive from current results.
  const allData = useQuery(api.versions.list, { siteId });
  const entityTypes = useMemo(() => {
    if (!allData) return [];
    const types = new Set<string>();
    for (const v of allData as any[]) {
      types.add(v.entityType);
    }
    return Array.from(types).sort();
  }, [allData]);

  // Client-side search on top of server-filtered results
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data as any[];
    const q = searchQuery.toLowerCase();
    return (data as any[]).filter((v) => {
      const label = ENTITY_LABELS[v.entityType] ?? v.entityType;
      const title = snapshotTitle(v.snapshot) ?? "";
      return (
        label.toLowerCase().includes(q) ||
        v.entityType.toLowerCase().includes(q) ||
        v.entityId.toLowerCase().includes(q) ||
        v.createdByName.toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery]);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setIsPending(true);
    try {
      await restoreVersion({ siteId, versionId: restoreTarget._id as Id<"contentVersions"> });
      toast({ title: "Version restored", description: `${ENTITY_LABELS[restoreTarget.entityType] ?? restoreTarget.entityType} content has been restored.` });
      setRestoreTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't restore version",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Version History</h1>
      <p className="text-sm text-slate-500 mb-6">
        Snapshots of content saved before each change. Filter by type, search, view details, and restore a prior version if needed.
      </p>

      {/* Filter + Search bar */}
      {data !== undefined && data !== null && (data as any[]).length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, type, author, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {data === undefined ? (
        <Skeleton className="h-64" />
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Version History — you may not have access to this site." />
      ) : (data as any[]).length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <History className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No versions yet</h3>
          <p className="text-slate-500 mt-1">
            {entityFilter !== "all"
              ? `No ${ENTITY_LABELS[entityFilter] ?? entityFilter} versions found. Try a different filter.`
              : "Content snapshots will appear here as edits are made."}
          </p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No matching versions</h3>
          <p className="text-slate-500 mt-1 mb-4">No versions match your search "{searchQuery}".</p>
          <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>Clear search</Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Title / Name</th>
                <th className="px-4 py-2 font-medium">Saved By</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((v: any) => {
                const title = snapshotTitle(v.snapshot);
                return (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {ENTITY_LABELS[v.entityType] ?? v.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {title ? (
                        <div>
                          <div className="font-medium text-slate-800">{title}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{v.entityId.slice(0, 20)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">{v.entityId.slice(0, 24)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{v.createdByName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(v._creationTime).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewTarget(v)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(v)}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Restore
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current{" "}
              <strong>{restoreTarget ? ENTITY_LABELS[restoreTarget.entityType] ?? restoreTarget.entityType : ""}</strong>
              {snapshotTitle(restoreTarget?.snapshot) ? ` ("${snapshotTitle(restoreTarget.snapshot)}")` : ""} content
              with this saved snapshot from{" "}
              {restoreTarget ? new Date(restoreTarget._creationTime).toLocaleString() : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={isPending}>
              {isPending ? "Restoring…" : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {viewTarget ? ENTITY_LABELS[viewTarget.entityType] ?? viewTarget.entityType : ""} — Snapshot
            </DialogTitle>
          </DialogHeader>
          {viewTarget?.snapshot && (
            <div className="space-y-3">
              {snapshotTitle(viewTarget.snapshot) && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500 mb-0.5">Title</div>
                  <div className="font-medium text-slate-800">{snapshotTitle(viewTarget.snapshot)}</div>
                </div>
              )}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-0.5">Saved by</div>
                <div className="text-sm text-slate-700">{viewTarget?.createdByName}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-0.5">Date</div>
                <div className="text-sm text-slate-700">{viewTarget ? new Date(viewTarget._creationTime).toLocaleString() : ""}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Full snapshot data</div>
                <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs overflow-auto max-h-72">
                  {JSON.stringify(viewTarget?.snapshot, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
