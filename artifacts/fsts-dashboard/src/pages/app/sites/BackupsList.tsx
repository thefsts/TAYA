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
import { useToast } from "@/hooks/use-toast";
import { Archive, RotateCcw } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function BackupsList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.backups.list, { siteId });
  const createBackup = useMutation(api.backups.create);
  const restoreBackup = useMutation(api.backups.restore);

  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  async function handleCreate() {
    setIsCreating(true);
    try {
      await createBackup({ siteId });
      toast({ title: "Backup created" });
    } catch (err) {
      toast({
        title: "Couldn't create backup",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setIsRestoring(true);
    try {
      await restoreBackup({ siteId, backupId: restoreTarget._id });
      toast({ title: "Site restored from backup" });
      setRestoreTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't restore backup",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backups</h1>
          <p className="text-sm text-slate-500 mt-0.5">Point-in-time snapshots of the entire site.</p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating…" : "Create Backup"}
        </Button>
      </div>
      {data === undefined ? (
        <Skeleton className="h-64" />
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Backups — you may not have access to this site or the backups module is disabled." />
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Archive className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No backups yet</h3>
          <p className="text-slate-500 mt-1">Create your first backup to protect this site's content.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
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
              {data.map((b: NonNullable<typeof data>[number]) => (
                <tr key={b._id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{b.label}</td>
                  <td className="px-4 py-3 text-slate-500">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(b._creationTime).toLocaleString()}</td>
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
            <AlertDialogAction onClick={confirmRestore} disabled={isRestoring} className="bg-red-600 hover:bg-red-700">Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
