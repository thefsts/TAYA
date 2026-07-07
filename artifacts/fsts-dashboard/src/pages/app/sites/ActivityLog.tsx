import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActivityLog({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const data = useQuery(api.activityLog.list, { siteId });

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
        <p className="text-slate-500 text-sm">
          Full audit trail of every change made to this site — who, when, what, and the before/after values.
        </p>
      </div>
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Recent Changes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data === undefined ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">User</th>
                    <th className="text-left font-medium px-4 py-2">Date / Time</th>
                    <th className="text-left font-medium px-4 py-2">Action</th>
                    <th className="text-left font-medium px-4 py-2">Page</th>
                    <th className="text-left font-medium px-4 py-2">Previous Value</th>
                    <th className="text-left font-medium px-4 py-2">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.length > 0 ? (
                    data.map((log) => (
                      <tr key={log._id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{log.actorName}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                          {new Date(log._creationTime).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-700 capitalize">
                          {log.action}
                          {log.entityType ? ` ${log.entityType.replace(/_/g, " ")}` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{log.page ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={log.previousValue ?? undefined}>
                          {log.previousValue ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={log.newValue ?? undefined}>
                          {log.newValue ?? "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
