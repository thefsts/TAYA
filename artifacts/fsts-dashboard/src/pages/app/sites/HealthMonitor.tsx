import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Clock, Wifi, AlertTriangle } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "up") return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Up</Badge>;
  if (status === "down") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Down</Badge>;
  return <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" />Unknown</Badge>;
}

function UptimeBar({ logs }: { logs: any[] }) {
  if (!logs.length) return null;
  const last48 = logs.slice(0, 48).reverse();
  return (
    <div className="flex gap-0.5 items-end h-8">
      {last48.map((log) => (
        <div
          key={log.id}
          title={`${formatDate(log.checkedAt)} — ${log.isUp ? `${log.responseMs}ms` : log.error ?? "Down"}`}
          className={`flex-1 rounded-sm ${log.isUp ? "bg-green-400" : "bg-red-400"}`}
          style={{ height: log.isUp ? "100%" : "40%" }}
        />
      ))}
    </div>
  );
}

export default function HealthMonitor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const summary = useQuery(api.health.getSummary, { siteId });
  const logs = useQuery(api.health.getRecentLogs, { siteId, limit: 48 });

  if (summary === undefined || logs === undefined) {
    return <AppLayout siteId={params.siteId}><Skeleton className="h-64" /></AppLayout>;
  }

  const noData = summary === null || summary.status === "unknown";

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Website Health Monitor</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Automated checks run every hour. Up to 7 days of history.
        </p>
      </div>

      {noData ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <Wifi className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No health data yet</p>
          <p className="text-slate-400 text-sm mt-1">
            The first automated check runs at :05 past the next hour.
            Make sure the site has a domain configured in Site Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Current Status
              </p>
              <StatusBadge status={summary?.status} />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 24h Uptime
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.uptime24h != null ? `${summary.uptime24h}%` : "—"}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Avg Response
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.avgResponseMs != null ? `${summary.avgResponseMs}ms` : "—"}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1">Last Checked</p>
              <p className="text-sm font-medium text-slate-700">
                {summary?.lastCheckedAt ? formatDate(summary.lastCheckedAt) : "—"}
              </p>
            </div>
          </div>

          {/* Uptime Bar */}
          {logs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">Last 48 Checks</p>
              <UptimeBar logs={logs} />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-slate-400">{logs.length > 0 ? formatDate(logs[logs.length - 1].checkedAt) : ""}</span>
                <span className="text-xs text-slate-400">{logs.length > 0 ? formatDate(logs[0].checkedAt) : ""}</span>
              </div>
            </div>
          )}

          {/* Recent Checks Table */}
          {logs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Recent Checks</p>
              </div>
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.isUp ? "bg-green-400" : "bg-red-500"}`} />
                    <span className="text-slate-500 w-40 flex-shrink-0">{formatDate(log.checkedAt)}</span>
                    {log.isUp ? (
                      <>
                        <span className="text-green-600 font-medium">Online</span>
                        <span className="text-slate-400 ml-auto">{log.statusCode} · {log.responseMs}ms</span>
                      </>
                    ) : (
                      <>
                        <span className="text-red-600 font-medium">Down</span>
                        <span className="text-slate-400 ml-auto text-xs truncate max-w-xs">{log.error ?? `HTTP ${log.statusCode ?? "?"}`}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
