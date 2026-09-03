import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { History, RotateCcw } from "lucide-react";

export default function VersionHistory({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.versions.list, { siteId });
  const restoreVersion = useMutation(api.versions.restore);

  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setIsPending(true);
    try {
      await restoreVersion({ siteId, versionId: restoreTarget._id as Id<"contentVersions"> });
      toast({ title: "Version restored", description: `${restoreTarget.entityType} content has been restored.` });
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
      <p className="text-sm text-slate-500 mb-6">Snapshots of content saved before each change. Restore a prior version if needed.</p>

      {data === undefined ? (
        <Skeleton className="h-64" />
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Version History — you may not have access to this site." />
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <History className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No versions yet</h3>
          <p className="text-slate-500 mt-1">Content snapshots will appear here as edits are made.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Entity ID</th>
                <th className="px-4 py-2 font-medium">Saved By</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v: any) => (
                <tr key={v._id}>
                  <td className="px-4 py-2 capitalize">{v.entityType}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{v.entityId}</td>
                  <td className="px-4 py-2">{v.createdByName}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(v._creationTime).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewTarget(v)}>View</Button>
                    <Button variant="ghost" size="sm" onClick={() => setRestoreTarget(v)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current <strong>{restoreTarget?.entityType}</strong> content with this saved snapshot from {restoreTarget ? new Date(restoreTarget._creationTime).toLocaleString() : ""}.
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
            <DialogTitle>Snapshot — {viewTarget?.entityType} #{viewTarget?.entityId}</DialogTitle>
          </DialogHeader>
          <pre className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs overflow-auto max-h-96">
            {JSON.stringify(viewTarget?.snapshot, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
