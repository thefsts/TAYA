import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Link } from "wouter";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Activity, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, TrendingDown, Minus, Zap, Search, Eye, Shield,
  FileText, Mail, CreditCard, Image as ImageIcon, Monitor,
  Smartphone, Wifi, DatabaseBackup, ChevronDown, ChevronUp, Bell, BellOff,
  Gauge, BarChart3, ArrowRight, Building2, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: any; description: string; fixRoute?: string }> = {
  performance: { label: "Performance", icon: Gauge, description: "Page speed, response time, asset optimization", fixRoute: "media" },
  seo: { label: "SEO", icon: Search, description: "Meta tags, descriptions, Open Graph, alt text", fixRoute: "seo" },
  accessibility: { label: "Accessibility", icon: Eye, description: "Alt text, ARIA, headings, keyboard navigation", fixRoute: "media" },
  security: { label: "Security", icon: Shield, description: "HTTPS, SSL, security headers, mixed content" },
  forms: { label: "Forms", icon: FileText, description: "Contact forms, published status, submission tracking", fixRoute: "forms" },
  email: { label: "Email Delivery", icon: Mail, description: "Email configuration, from address, notifications", fixRoute: "email" },
  payments: { label: "Square Payments", icon: CreditCard, description: "Square connection status, checkout availability", fixRoute: "payments" },
  media: { label: "Media Optimization", icon: ImageIcon, description: "WebP/AVIF, file sizes, alt text coverage", fixRoute: "media" },
  content: { label: "Content Quality", icon: BarChart3, description: "Published courses, articles, images on items", fixRoute: "courses" },
  mobile: { label: "Mobile Experience", icon: Smartphone, description: "Mobile performance, image sizes, layout", fixRoute: "media" },
  uptime: { label: "Uptime", icon: Wifi, description: "Site availability, 24h uptime percentage" },
  backups: { label: "Backup Status", icon: DatabaseBackup, description: "Automated backup frequency and last run", fixRoute: "backups" },
};

function CrmStatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "up" || status === "connected" || status === "healthy") {
    return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
  }
  if (status === "down" || status === "not_connected") {
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Not Connected</Badge>;
  }
  return <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" />Unknown</Badge>;
}

function CrmHealthBadge({ apiHealth }: { apiHealth: string | null | undefined }) {
  if (apiHealth === "healthy") {
    return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Healthy</Badge>;
  }
  if (apiHealth === "unreachable" || apiHealth === "error") {
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Unreachable</Badge>;
  }
  return <Badge variant="secondary"><AlertTriangle className="w-3 h-3 mr-1" />Unknown</Badge>;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const stroke = size / 16;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold" style={{ fontSize: size / 4, color }}>{score}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "good" | "warning" | "critical" | string }) {
  if (status === "good") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Good</Badge>;
  if (status === "warning") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Needs Attention</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="w-3 h-3 mr-1" />Critical</Badge>;
}

function TrendBadge({ trend }: { trend: "improving" | "stable" | "declining" | string }) {
  if (trend === "improving") return <span className="inline-flex items-center gap-1 text-xs text-green-600"><TrendingUp className="h-3 w-3" />Improving</span>;
  if (trend === "declining") return <span className="inline-flex items-center gap-1 text-xs text-red-600"><TrendingDown className="h-3 w-3" />Declining</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus className="h-3 w-3" />Stable</span>;
}

function CategoryCard({ catKey, data, siteId }: { catKey: string; data: any; siteId: string }) {
  const meta = CATEGORY_META[catKey] ?? { label: catKey, icon: Activity, description: "" };
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);

  const hasIssues = (data.issues?.length ?? 0) > 0;
  const fixPath = meta.fixRoute ? `/app/sites/${siteId}/${meta.fixRoute}` : null;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${data.status === "critical" ? "border-red-200" : data.status === "warning" ? "border-amber-200" : "border-slate-200"}`}>
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${data.status === "critical" ? "bg-red-100" : data.status === "warning" ? "bg-amber-100" : "bg-green-100"}`}>
          <Icon className={`h-5 w-5 ${data.status === "critical" ? "text-red-600" : data.status === "warning" ? "text-amber-600" : "text-green-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{meta.label}</span>
            <StatusBadge status={data.status} />
            <TrendBadge trend={data.trend} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ScoreRing score={data.score} size={48} />
          {fixPath && data.status !== "good" && (
            <Link
              href={fixPath}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Fix it <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {hasIssues
            ? (expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />)
            : <div className="w-4" />
          }
        </div>
      </div>

      {expanded && hasIssues && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {data.issues?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Issues Found</p>
              {data.issues.map((issue: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700">{issue}</span>
                </div>
              ))}
            </div>
          )}
          {data.actions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommended Actions</p>
              {data.actions.map((action: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  {fixPath ? (
                    <Link
                      href={fixPath}
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-700 hover:text-primary hover:underline"
                    >
                      {action}
                    </Link>
                  ) : (
                    <span className="text-slate-700">{action}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Last scanned: {new Date(data.lastScannedAt).toLocaleString()}
            </p>
            {fixPath && data.status !== "good" && (
              <Link href={fixPath} onClick={(e) => e.stopPropagation()}>
                <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                  Fix it <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification, siteId, onDismiss }: { notification: any; siteId: string; onDismiss: () => void }) {
  const fixRoute = notification.category ? CATEGORY_META[notification.category]?.fixRoute : undefined;
  const fixPath = fixRoute ? `/app/sites/${siteId}/${fixRoute}` : null;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${notification.severity === "critical" ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}>
      {notification.severity === "critical"
        ? <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
        : <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <p className={notification.severity === "critical" ? "text-red-800" : "text-amber-800"}>{notification.message}</p>
        {fixPath && (
          <Link href={fixPath} className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-primary hover:underline">
            Fix it <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-1">
        <XCircle className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function HealthMonitor({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const crmStats = useQuery(api.crm.getSyncStats, { siteId });

  const latestScan = useQuery(api.healthScans.getLatestScan, { siteId });
  const scanHistory = useQuery(api.healthScans.getScanHistory, { siteId, limit: 7 });
  const notifications = useQuery(api.healthScans.getNotifications, { siteId });
  const triggerScan = useAction(api.healthScans.triggerScan);
  const dismissNotification = useMutation(api.healthScans.dismissNotification);
  const markAllRead = useMutation(api.healthScans.markAllNotificationsRead);

  const [isScanning, setIsScanning] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await triggerScan({ siteId });
      toast({ title: "Health scan complete", description: "Your site has been analyzed and scores updated." });
    } catch (err) {
      toast({ title: "Scan failed", description: String(err), variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDismiss = async (id: Id<"healthNotifications">) => {
    try { await dismissNotification({ notificationId: id }); } catch { /* ignore */ }
  };

  const isLoading = latestScan === undefined;
  const scan = latestScan;
  const categories = scan?.categoryScores as Record<string, any> | undefined;

  const orderedCategories = [
    "performance", "seo", "accessibility", "security",
    "forms", "email", "payments", "media",
    "content", "mobile", "uptime", "backups",
  ];

  const filteredCategories = categories
    ? orderedCategories.filter((k) => {
      const cat = categories[k];
      if (!cat) return false;
      if (filter === "critical") return cat.status === "critical";
      if (filter === "warning") return cat.status === "warning" || cat.status === "critical";
      return true;
    })
    : [];

  const activeNotifications = notifications?.filter((n: any) => !n.readAt) ?? [];
  const unreadCount = activeNotifications.length;

  const overallStatus =
    !scan ? "No Data"
      : scan.overallScore >= 75 ? "Excellent"
        : scan.overallScore >= 50 ? "Needs Attention"
          : "Critical Issues";

  const overallColor =
    !scan ? "text-slate-500"
      : scan.overallScore >= 75 ? "text-green-600"
        : scan.overallScore >= 50 ? "text-amber-600"
          : "text-red-600";

  return (
    <AppLayout siteId={params.siteId}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Website Health Command Center™
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Comprehensive health analysis across 12 categories. Scans run daily at 4 AM UTC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowNotifications((s) => !s); if (unreadCount > 0) markAllRead({ siteId }); }}
              className="relative"
            >
              {unreadCount > 0 ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            {showNotifications && (notifications?.length ?? 0) > 0 && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-10 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notifications</p>
                {notifications?.slice(0, 5).map((n: any) => (
                  <NotificationItem key={n._id} notification={n} siteId={params.siteId} onDismiss={() => handleDismiss(n._id)} />
                ))}
              </div>
            )}
          </div>
          <Button size="sm" onClick={handleScan} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning…" : "Run Scan"}
          </Button>
        </div>
      </div>

      {/* ── CRM Health Card ── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" /> Operon CRM Connector™
        </h2>
        {crmStats === undefined ? (
          <Skeleton className="h-28" />
        ) : crmStats === null ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-center">
            <p className="text-sm text-slate-400">No Operon CRM connection configured for this site.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Connection
              </p>
              <CrmStatusBadge status={crmStats.connectionStatus} />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> API Health
              </p>
              <CrmHealthBadge apiHealth={crmStats.apiHealth} />
              {crmStats.lastHealthCheckAt && (
                <p className="text-[10px] text-slate-400 mt-1">{new Date(crmStats.lastHealthCheckAt).toLocaleString()}</p>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500" /> Syncs (last 50)
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-green-600">{crmStats.recentSuccessCount}</span>
                <span className="text-slate-400 text-xs">ok</span>
                <span className="text-lg font-bold text-red-500">{crmStats.recentFailedCount}</span>
                <span className="text-slate-400 text-xs">failed</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" /> Last Sync
              </p>
              <p className="text-sm font-medium text-slate-700 mt-1">
                {crmStats.lastSyncAt ? new Date(crmStats.lastSyncAt).toLocaleString() : "Never"}
              </p>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <div className="space-y-3">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      ) : !scan ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
          <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No health scan yet</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Run your first scan to get a comprehensive health report across performance, SEO, security, forms, payments, and more.
          </p>
          <Button onClick={handleScan} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning your site…" : "Run First Scan"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-6">
              <ScoreRing score={scan.overallScore} size={100} />
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold text-slate-900">{scan.overallScore}<span className="text-base font-normal text-slate-400">/100</span></h2>
                  <span className={`text-lg font-semibold ${overallColor}`}>{overallStatus}</span>
                </div>
                <p className="text-slate-500 text-sm mt-1">Overall Website Health Score</p>
                <p className="text-xs text-slate-400 mt-2">
                  Last scan: {new Date(scan.scannedAt).toLocaleString()} ·{" "}
                  {(scanHistory?.length ?? 0)} scans recorded
                </p>
              </div>

              {/* History sparkline */}
              {scanHistory && scanHistory.length > 1 && (
                <div className="ml-auto flex items-end gap-1 h-12">
                  {[...scanHistory].reverse().map((s: any, i: number) => (
                    <div
                      key={s._id}
                      title={`${new Date(s.scannedAt).toLocaleDateString()}: ${s.overallScore}`}
                      className="w-6 rounded-sm transition-all"
                      style={{
                        height: `${Math.max(8, (s.overallScore / 100) * 48)}px`,
                        background: s.overallScore >= 75 ? "#16a34a" : s.overallScore >= 50 ? "#d97706" : "#dc2626",
                        opacity: i === scanHistory.length - 1 ? 1 : 0.6,
                      }}
                    />
                  ))}
                  <span className="text-xs text-slate-400 ml-1 self-end">7d</span>
                </div>
              )}
            </div>

            {/* Mini category overview */}
            {categories && (
              <div className="mt-5 grid grid-cols-6 gap-2 pt-5 border-t border-slate-100">
                {orderedCategories.slice(0, 12).map((key) => {
                  const cat = categories[key];
                  if (!cat) return null;
                  const meta = CATEGORY_META[key];
                  const fixPath = meta?.fixRoute ? `/app/sites/${siteId}/${meta.fixRoute}` : null;
                  const scoreColor = cat.score >= 75 ? "text-green-600" : cat.score >= 50 ? "text-amber-600" : "text-red-600";
                  const inner = (
                    <>
                      <div className={`text-lg font-bold ${scoreColor}`}>{cat.score}</div>
                      <div className="text-[10px] text-slate-400 truncate">{meta?.label ?? key}</div>
                    </>
                  );
                  return fixPath ? (
                    <Link
                      key={key}
                      href={fixPath}
                      className="text-center rounded hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className={`text-lg font-bold ${scoreColor} group-hover:underline`}>{cat.score}</div>
                      <div className="text-[10px] text-slate-400 truncate group-hover:text-slate-600">{meta?.label ?? key}</div>
                    </Link>
                  ) : (
                    <div key={key} className="text-center">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Show:</span>
            {(["all", "critical", "warning"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {f === "all" ? "All Categories" : f === "critical" ? "Critical Only" : "Needs Attention"}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-auto">
              {filteredCategories.length} of {orderedCategories.length} categories
            </span>
          </div>

          {/* Category cards */}
          {categories && (
            <div className="space-y-3">
              {filteredCategories.length > 0
                ? filteredCategories.map((key) => (
                  <CategoryCard key={key} catKey={key} data={categories[key]} siteId={params.siteId} />
                ))
                : (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="font-medium text-slate-600">No issues in this category</p>
                  </div>
                )
              }
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
