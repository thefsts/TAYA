import { useLocation, useParams, Link } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, ShieldCheck, ShieldAlert, Mail as MailIcon, FileEdit } from "lucide-react";
import {
  ArrowLeft,
  LayoutTemplate,
  BookOpen,
  Calendar,
  FileText,
  Image as ImageIcon,
  Search,
  Settings,
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function NavItem({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
  const [location] = useLocation();
  const isActive = location === href;

  return (
    <Link href={href}>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={`w-full justify-start h-10 px-3 ${isActive ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-normal'}`}
      >
        <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
        {label}
      </Button>
    </Link>
  );
}

export function AppLayout({ children, siteId }: { children: React.ReactNode, siteId: string }) {
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });
  const [location] = useLocation();
  const modules = site?.enabledModules as Record<string, boolean> | undefined;
  const isEnabled = (key: string) => modules?.[key] ?? true;

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
                <div className="text-[10px] text-slate-400 uppercase tracking-wide truncate">FSTS Website Operating System™</div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Content</div>
          <NavItem icon={Activity} label="Dashboard" href={`/app/sites/${siteId}`} />
          {isEnabled("homepage") && <NavItem icon={LayoutTemplate} label="Homepage" href={`/app/sites/${siteId}/homepage`} />}
          {isEnabled("courses") && <NavItem icon={BookOpen} label="Courses" href={`/app/sites/${siteId}/courses`} />}
          {isEnabled("events") && <NavItem icon={Calendar} label="Events" href={`/app/sites/${siteId}/events`} />}
          {isEnabled("articles") && <NavItem icon={FileText} label="Articles" href={`/app/sites/${siteId}/articles`} />}
          {isEnabled("media") && <NavItem icon={ImageIcon} label="Media Library" href={`/app/sites/${siteId}/media`} />}
          <NavItem icon={HelpCircle} label="FAQ" href={`/app/sites/${siteId}/faq`} />
          <NavItem icon={MessageSquareQuote} label="Testimonials" href={`/app/sites/${siteId}/testimonials`} />
          <NavItem icon={FormInput} label="Forms" href={`/app/sites/${siteId}/forms`} />
          <NavItem icon={Inbox} label="Contact Inbox" href={`/app/sites/${siteId}/inbox`} />

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Site Modules</div>
          {isEnabled("navigation") && <NavItem icon={Navigation} label="Navigation" href={`/app/sites/${siteId}/navigation`} />}
          {isEnabled("announcement") && <NavItem icon={Megaphone} label="Announcement Banner" href={`/app/sites/${siteId}/announcement`} />}
          {isEnabled("cta") && <NavItem icon={MousePointerClick} label="CTA Buttons" href={`/app/sites/${siteId}/cta`} />}
          {isEnabled("team") && <NavItem icon={Users} label="Team" href={`/app/sites/${siteId}/team`} />}
          {isEnabled("careers") && <NavItem icon={Briefcase} label="Careers" href={`/app/sites/${siteId}/careers`} />}
          {isEnabled("downloads") && <NavItem icon={Download} label="Downloads" href={`/app/sites/${siteId}/downloads`} />}
          {isEnabled("popup") && <NavItem icon={Bell} label="Popup" href={`/app/sites/${siteId}/popup`} />}
          {isEnabled("policy") && <NavItem icon={ScrollText} label="Policy Pages" href={`/app/sites/${siteId}/policy`} />}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Configuration</div>
          {isEnabled("contact") && <NavItem icon={Phone} label="Contact Info" href={`/app/sites/${siteId}/contact`} />}
          {isEnabled("footer") && <NavItem icon={LayoutTemplate} label="Footer" href={`/app/sites/${siteId}/footer`} />}
          {isEnabled("seo") && <NavItem icon={Search} label="SEO Settings" href={`/app/sites/${siteId}/seo`} />}
          {isEnabled("payments") && <NavItem icon={CreditCard} label="Square Payments" href={`/app/sites/${siteId}/payments`} />}
          {isEnabled("commerce") && <NavItem icon={ShoppingBag} label="Commerce" href={`/app/sites/${siteId}/commerce`} />}
          {isEnabled("email") && <NavItem icon={Mail} label="Email Config" href={`/app/sites/${siteId}/email`} />}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Marketing &amp; CRM</div>
          {isEnabled("crm") && <NavItem icon={Building2} label="Marketing & CRM" href={`/app/sites/${siteId}/crm`} />}

          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">System</div>
          <NavItem icon={HeartPulse} label="Health Monitor" href={`/app/sites/${siteId}/health`} />
          <NavItem icon={History} label="Version History" href={`/app/sites/${siteId}/history`} />
          <NavItem icon={Activity} label="Activity Log" href={`/app/sites/${siteId}/activity`} />
          <NavItem icon={DatabaseBackup} label="Backups" href={`/app/sites/${siteId}/backups`} />
          <NavItem icon={LifeBuoy} label="Help Center" href={`/app/sites/${siteId}/help`} />
        </nav>

        {(site?.poweredByFsts ?? true) && (
          <div className="px-4 py-3 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400 leading-tight">
              Powered by <span className="font-semibold text-slate-500">Full Stack Tech Solutions</span>
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">FSTS Website Operating System™ v1.0</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-10 shadow-sm">
          <h1 className="font-semibold text-slate-800">
            {location.split('/').pop()?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dashboard'}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
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

  return (
    <AppLayout siteId={siteId}>
      <div className="flex items-center justify-between mb-8">
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
