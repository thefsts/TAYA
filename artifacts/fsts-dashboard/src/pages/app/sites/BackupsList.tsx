import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useListBackups, useCreateBackup, useRestoreBackup, type Backup } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { Archive, RotateCcw } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupsList({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { toast } = useToast();
  const { data, isLoading } = useListBackups(siteId);
  const createMutation = useCreateBackup();
  const restoreMutation = useRestoreBackup();

  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);

  function handleCreate() {
    createMutation.mutate(
      { siteId },
      {
        onSuccess: () => toast({ title: "Backup created" }),
        onError: (err) =>
          toast({
            title: "Couldn't create backup",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  function confirmRestore() {
    if (!restoreTarget) return;
    restoreMutation.mutate(
      { siteId, backupId: restoreTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Site restored from backup" });
          setRestoreTarget(null);
        },
        onError: (err) =>
          toast({
            title: "Couldn't restore backup",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backups</h1>
          <p className="text-sm text-slate-500 mt-0.5">Point-in-time snapshots of the entire site.</p>
        </div>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create Backup"}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : data?.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Archive className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No backups yet</h3>
          <p className="text-slate-500 mt-1">Create your first backup to protect this site's content.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Label</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Size</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{b.label}</td>
                  <td className="px-4 py-3 text-slate-500">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setRestoreTarget(b)}>
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
            <AlertDialogTitle>Restore "{restoreTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the site's current content with this backup. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} className="bg-red-600 hover:bg-red-700">Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
