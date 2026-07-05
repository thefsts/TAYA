import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useListContentVersions, useRestoreContentVersion, type ContentVersion } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useListContentVersions(siteId);
  const restoreMutation = useRestoreContentVersion();

  const [restoreTarget, setRestoreTarget] = useState<ContentVersion | null>(null);
  const [viewTarget, setViewTarget] = useState<ContentVersion | null>(null);

  function confirmRestore() {
    if (!restoreTarget) return;
    restoreMutation.mutate(
      { siteId, versionId: restoreTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Version restored" });
          setRestoreTarget(null);
        },
        onError: (err) =>
          toast({
            title: "Couldn't restore version",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Version History</h1>
      <p className="text-sm text-slate-500 mb-6">Snapshots of content saved before each change. Restore a prior version if needed.</p>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <History className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No versions yet</h3>
          <p className="text-slate-500 mt-1">Content snapshots will appear here as edits are made.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
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
              {data?.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 capitalize">{v.entityType}</td>
                  <td className="px-4 py-2">{v.entityId}</td>
                  <td className="px-4 py-2">{v.createdByName}</td>
                  <td className="px-4 py-2 text-slate-500">{new Date(v.createdAt).toLocaleString()}</td>
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

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current {restoreTarget?.entityType} content with this saved snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
