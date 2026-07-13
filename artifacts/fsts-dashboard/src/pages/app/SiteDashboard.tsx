import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, ShieldCheck, ShieldAlert, Mail as MailIcon, FileEdit, Lock } from "lucide-react";
import {
  ArrowLeft,
  LayoutTemplate,
  BookOpen,
  Calendar,
  FileText,
  Image as ImageIcon,
  Search,
  CreditCard,
  Mail,
  History,
  Activity,
  DatabaseBackup,
  Phone,
  Building2,
  LifeBuoy,
  HelpCircle,
  MessageSquareQuote,
  Inbox,
  HeartPulse,
  Navigation,
  Megaphone,
  MousePointerClick,
  Download,
  Users,
  Briefcase,
  Bell,
  ShoppingBag,
  ScrollText,
  FormInput,
  ShieldCheck as ShieldCheckIcon,
  Settings,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIAssistant } from "@/components/AIAssistant";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function NavItem({ icon: Icon, label, href, isDesignLocked, isSuperAdmin }: {
  icon: any;
  label: string;
  href: string;
  isDesignLocked?: boolean;
  isSuperAdmin?: boolean;
}) {
  const [location] = useLocation();
  const isActive = location === href;
  const locked = isDesignLocked && !isSuperAdmin;

  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center w-full h-10 px-3 rounded-md text-slate-400 cursor-not-allowed opacity-60 select-none">
            <Icon className="mr-3 h-4 w-4 text-slate-400" />
            <span className="flex-1 text-sm text-left font-normal">{label}</span>
            <Lock className="h-3 w-3 text-slate-400 ml-1" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-xs">
          <div className="flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{label}</strong> is managed by FSTS administrators.
              Contact your FSTS representative to make changes.
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href={href}>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={`w-full justify-start h-10 px-3 ${isActive ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-normal'}`}
      >
        <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
        <span className="flex-1">{label}</span>
        {isDesignLocked && isSuperAdmin && (
          <Lock className="h-3 w-3 text-slate-300 ml-1 flex-shrink-0" />
        )}
      </Button>
    </Link>
  );
}

export function AppLayout({ children, siteId, pageContext }: { children: React.ReactNode, siteId: string, pageContext?: string }) {
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });
  const me = useQuery(api.users.me);
  const [location] = useLocation();
  const modules = site?.enabledModules as Record<string, boolean> | undefined;
  const isEnabled = (key: string) => modules?.[key] ?? true;
  const unreadNotifications = useQuery(api.healthScans.getUnreadNotificationCount, { siteId: siteId as Id<"sites"> });
  const markAllRead = useMutation(api.healthScans.markAllNotificationsRead);
  const isSuperAdmin = me?.isSuperAdmin ?? false;

  const agencyId = (site as any)?.agencyId as Id<"agencies"> | undefined;
  const agency = useQuery(
    api.agencies.get,
    agencyId ? { agencyId } : "skip",
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-4 border-b border-slate-200">
          <Link href="/app">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Agency branding bar — shown when site belongs to an agency */}
        {agency && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            {agency.logoUrl ? (
              <img src={agency.logoUrl} alt={agency.name} className="h-6 w-auto max-w-[120px] object-contain" />
            ) : (
              <div
                className="h-5 w-5 rounded text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: agency.primaryColor }}
              >
                {agency.name.charAt(0)}
              </div>
            )}
            <span className="text-[11px] font-medium text-slate-600 truncate">{agency.name}</span>
          </div>
        )}

        <div className="p-4 border-b border-slate-200">
          {site === undefined ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {site?.logoUrl ? (
                <img src={site.logoUrl} alt={site.name} className="h-10 w-10 rounded object-contain border border-slate-100" />
              ) : (
                <div className="h-10 w-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                  {site?.name?.charAt(0)}
                </div>
              )}
              <div className="overflow-hidden">
                <h2 className="font-bold text-slate-900 truncate" title={site?.name}>{site?.name}</h2>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide truncate">
                  {agency ? `${agency.name} Dashboard` : "FSTS Website Operating System™"}
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Content</div>
          <NavItem icon={Activity} label="Dashboard" href={`/app/sites/${siteId}`} isSuperAdmin={isSuperAdmin} />
          {isEnabled("homepage") && <NavItem icon={LayoutTemplate} label="Homepage" href={`/app/sites/${siteId}/homepage`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("courses") && <NavItem icon={BookOpen} label="Courses" href={`/app/sites/${siteId}/courses`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("events") && <NavItem icon={Calendar} label="Events" href={`/app/sites/${siteId}/events`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("articles") && <NavItem icon={FileText} label="Articles" href={`/app/sites/${siteId}/articles`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("media") && <NavItem icon={ImageIcon} label="Media Library" href={`/app/sites/${siteId}/media`} isSuperAdmin={isSuperAdmin} />}
          <NavItem icon={HelpCircle} label="FAQ" href={`/app/sites/${siteId}/faq`} isSuperAdmin={isSuperAdmin} />
          <NavItem icon={MessageSquareQuote} label="Testimonials" href={`/app/sites/${siteId}/testimonials`} isSuperAdmin={isSuperAdmin} />
          <NavItem icon={FormInput} label="Forms" href={`/app/sites/${siteId}/forms`} isSuperAdmin={isSuperAdmin} />
          <NavItem icon={Inbox} label="Contact Inbox" href={`/app/sites/${siteId}/inbox`} isSuperAdmin={isSuperAdmin} />

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Site Modules</div>
          {isEnabled("navigation") && (
            <NavItem icon={Navigation} label="Navigation" href={`/app/sites/${siteId}/nav`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}
          {isEnabled("announcement") && <NavItem icon={Megaphone} label="Announcement Banner" href={`/app/sites/${siteId}/announcement`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("cta") && <NavItem icon={MousePointerClick} label="CTA Buttons" href={`/app/sites/${siteId}/cta`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("team") && <NavItem icon={Users} label="Team" href={`/app/sites/${siteId}/team`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("careers") && <NavItem icon={Briefcase} label="Careers" href={`/app/sites/${siteId}/careers`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("downloads") && <NavItem icon={Download} label="Downloads" href={`/app/sites/${siteId}/downloads`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("popup") && <NavItem icon={Bell} label="Popup" href={`/app/sites/${siteId}/popup`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("policy") && <NavItem icon={ScrollText} label="Policy Pages" href={`/app/sites/${siteId}/policies`} isSuperAdmin={isSuperAdmin} />}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Configuration</div>
          <NavItem icon={Settings} label="Website Settings" href={`/app/sites/${siteId}/settings`} isSuperAdmin={isSuperAdmin} />
          {isEnabled("contact") && <NavItem icon={Phone} label="Contact Info" href={`/app/sites/${siteId}/contact`} isSuperAdmin={isSuperAdmin} />}
          {isEnabled("footer") && (
            <NavItem icon={LayoutTemplate} label="Footer" href={`/app/sites/${siteId}/footer`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}
          {isEnabled("seo") && <NavItem icon={Search} label="SEO Settings" href={`/app/sites/${siteId}/seo`} isSuperAdmin={isSuperAdmin} />}
          <NavItem icon={CreditCard} label="Payment Providers" href={`/app/sites/${siteId}/payment-providers`} isSuperAdmin={isSuperAdmin} />
          {isEnabled("payments") && (
            <NavItem icon={CreditCard} label="Square Payments" href={`/app/sites/${siteId}/payments`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}
          {isEnabled("commerce") && (
            <NavItem icon={ShoppingBag} label="Commerce" href={`/app/sites/${siteId}/commerce`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}
          {isEnabled("email") && (
            <NavItem icon={Mail} label="Email Config" href={`/app/sites/${siteId}/email`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Marketing &amp; CRM</div>
          {isEnabled("crm") && (
            <NavItem icon={Building2} label="Marketing & CRM" href={`/app/sites/${siteId}/crm`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          )}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Automation</div>
          <NavItem icon={Zap} label="Automation Engine™" href={`/app/sites/${siteId}/automation`} isSuperAdmin={isSuperAdmin} />

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">System</div>
          <NavItem icon={HeartPulse} label="Health Monitor" href={`/app/sites/${siteId}/health`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          <NavItem icon={History} label="Version History" href={`/app/sites/${siteId}/history`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          <NavItem icon={Activity} label="Activity Log" href={`/app/sites/${siteId}/activity`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          <NavItem icon={DatabaseBackup} label="Backups" href={`/app/sites/${siteId}/backups`} isDesignLocked isSuperAdmin={isSuperAdmin} />
          <NavItem icon={LifeBuoy} label="Help Center" href={`/app/sites/${siteId}/help`} isSuperAdmin={isSuperAdmin} />
          <NavItem icon={ShieldCheckIcon} label="My Permissions" href={`/app/sites/${siteId}/permissions`} isSuperAdmin={isSuperAdmin} />
        </nav>

        {(site?.poweredByFsts ?? true) && !agency && (
          <div className="px-4 py-3 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 leading-tight">
              Powered by <span className="font-semibold text-slate-500">Full Stack Tech Solutions</span>
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">FSTS Website Operating System™ v1.0</p>
          </div>
        )}
        {agency && (
          <div className="px-4 py-3 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 leading-tight">
              Managed by <span className="font-semibold text-slate-500">{agency.name}</span>
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-10 shadow-sm">
          <h1 className="font-semibold text-slate-800 flex-1">
            {location.split('/').pop()?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-2">
            <Link href={`/app/sites/${siteId}/health`}>
              <Button
                variant="ghost"
                size="sm"
                className="relative text-slate-500"
                title="Health Notifications"
                onClick={() => markAllRead({ siteId: siteId as Id<"sites"> })}
              >
                <Bell className="h-4 w-4" />
                {(unreadNotifications ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      <AIAssistant siteId={siteId} pageContext={pageContext} />
    </div>
  );
}

function StatCard({ title, value, label }: { title: string, value: string | number, label?: string }) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono text-slate-900">{value}</div>
        {label && <p className="text-xs text-slate-500 mt-1">{label}</p>}
      </CardContent>
    </Card>
  );
}

export default function SiteDashboard() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;

  const summary = useQuery(api.sites.getDashboardSummary, { siteId });
  const site = useQuery(api.sites.get, { siteId });
  const latestScan = useQuery(api.healthScans.getLatestScan, { siteId });
  const notifications = useQuery(api.healthScans.getNotifications, { siteId });

  const healthScore = latestScan?.overallScore;
  const healthColor = healthScore == null ? "text-slate-400"
    : healthScore >= 75 ? "text-green-600"
      : healthScore >= 50 ? "text-amber-600"
        : "text-red-600";
  const healthBg = healthScore == null ? "bg-slate-50 border-slate-200"
    : healthScore >= 75 ? "bg-green-50 border-green-200"
      : healthScore >= 50 ? "bg-amber-50 border-amber-200"
        : "bg-red-50 border-red-200";
  const activeNotifications = notifications?.filter((n: any) => !n.readAt && !n.dismissedAt) ?? [];

  return (
    <AppLayout siteId={siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {site?.name ?? "there"}</h1>
          <p className="text-slate-500">At-a-glance metrics and recent activity for this site.</p>
          {site?.domain && (
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
            >
              {site.domain} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Health Score Banner */}
      <Link href={`/app/sites/${siteId}/health`}>
        <div className={`rounded-2xl border p-5 mb-6 cursor-pointer hover:shadow-md transition-shadow ${healthBg}`}>
          <div className="flex items-center gap-5">
            <div className="flex-shrink-0">
              {healthScore == null ? (
                <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center">
                  <Activity className="h-7 w-7 text-slate-400" />
                </div>
              ) : (
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 48 48" className="h-16 w-16 -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke={healthScore >= 75 ? "#bbf7d0" : healthScore >= 50 ? "#fde68a" : "#fecaca"} strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={healthScore >= 75 ? "#16a34a" : healthScore >= 50 ? "#d97706" : "#dc2626"}
                      strokeWidth="4"
                      strokeDasharray={`${(healthScore / 100) * 125.7} 125.7`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-bold ${healthColor}`}>{healthScore}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900 text-lg">Website Health Command Center™</p>
                {activeNotifications.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                    {activeNotifications.length} alert{activeNotifications.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className={`text-sm font-medium mt-0.5 ${healthColor}`}>
                {healthScore == null
                  ? "No scan yet — click to run your first health scan"
                  : healthScore >= 75 ? "Excellent — your site is healthy"
                    : healthScore >= 50 ? "Needs attention — some issues detected"
                      : "Critical issues — immediate action recommended"
                }
              </p>
              {activeNotifications.length > 0 && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  Latest: {activeNotifications[0]?.message}
                </p>
              )}
            </div>
            <div className="text-xs text-slate-400 flex-shrink-0">
              {latestScan ? `Last scan ${new Date(latestScan.scannedAt).toLocaleDateString()}` : "Click to scan →"}
            </div>
          </div>
        </div>
      </Link>

      {summary === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl bg-slate-200" />)}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Courses" value={summary.courseCount} label="Active catalog items" />
            <StatCard title="Events" value={summary.eventCount} label="Scheduled events" />
            <StatCard title="Articles" value={summary.articleCount} label="Published posts" />
            <StatCard title="Media Assets" value={summary.mediaCount} label="Files in library" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.recentActivity && summary.recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {summary.recentActivity.map((activity: any) => (
                        <div key={activity._id} className="flex gap-4 text-sm">
                          <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          <div>
                            <p className="text-slate-900">
                              <span className="font-semibold">{activity.actorName}</span> {activity.action} {activity.entityType} {activity.details && <span className="text-slate-500">— {activity.details}</span>}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">
                              {new Date(activity._creationTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 py-4">No recent activity recorded.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm">Website Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Website</span>
                    {summary.websiteOnline === null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">No domain set</span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${summary.websiteOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {summary.websiteOnline ? 'Online' : 'Offline'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1">
                      {summary.sslActive ? <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />}
                      SSL
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${summary.sslActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {summary.sslActive ? 'Active' : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Performance</span>
                    <span className="text-slate-900 font-mono text-xs">
                      {summary.responseTimeMs != null ? `${summary.responseTimeMs}ms` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1"><MailIcon className="h-3.5 w-3.5" /> Email</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${summary.emailConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {summary.emailConfigured ? 'Configured' : 'Not Set Up'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1"><FileEdit className="h-3.5 w-3.5" /> Forms</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${summary.formsConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {summary.formsConfigured ? 'Configured' : 'Not Set Up'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Square</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${summary.squareConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {summary.squareConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Last Backup</span>
                    <span className="text-slate-900 font-mono text-xs">
                      {summary.lastBackupAt ? new Date(summary.lastBackupAt).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">Failed to load dashboard summary.</div>
      )}
    </AppLayout>
  );
}
