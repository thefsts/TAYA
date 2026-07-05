import { AppLayout } from "@/pages/app/SiteDashboard";
import { useListActivityLog } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLog({ params }: { params: { siteId: string } }) {
  const siteId = parseInt(params.siteId, 10);
  const { data, isLoading } = useListActivityLog(siteId);

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold mb-6">Activity Log</h1>
      {isLoading ? <Skeleton className="h-64" /> : (
        <div className="bg-white border rounded shadow-sm">
          <div className="divide-y">
            {data?.map(log => (
              <div key={log.id} className="p-4">
                <p className="text-sm">
                  <span className="font-semibold">{log.actorName}</span> {log.action} {log.entityType}
                  {log.details && <span className="text-slate-500"> - {log.details}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
