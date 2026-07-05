import { useLocation, useParams, Link } from "wouter";
import { useGetSite, useGetSiteDashboardSummary } from "@workspace/api-client-react";
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
  Phone
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
  const id = parseInt(siteId, 10);
  const { data: site, isLoading } = useGetSite(id);
  const [location] = useLocation();
  
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
          {isLoading ? (
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
                <div className="text-xs text-slate-500 font-mono truncate" title={site?.slug}>{site?.slug}</div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Content</div>
          <NavItem icon={Activity} label="Dashboard" href={`/app/sites/${siteId}`} />
          <NavItem icon={LayoutTemplate} label="Homepage" href={`/app/sites/${siteId}/homepage`} />
          <NavItem icon={BookOpen} label="Courses" href={`/app/sites/${siteId}/courses`} />
          <NavItem icon={Calendar} label="Events" href={`/app/sites/${siteId}/events`} />
          <NavItem icon={FileText} label="Articles" href={`/app/sites/${siteId}/articles`} />
          <NavItem icon={ImageIcon} label="Media Library" href={`/app/sites/${siteId}/media`} />
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">Configuration</div>
          <NavItem icon={Phone} label="Contact Info" href={`/app/sites/${siteId}/contact`} />
          <NavItem icon={LayoutTemplate} label="Footer" href={`/app/sites/${siteId}/footer`} />
          <NavItem icon={Search} label="SEO Settings" href={`/app/sites/${siteId}/seo`} />
          <NavItem icon={CreditCard} label="Square Payments" href={`/app/sites/${siteId}/payments`} />
          <NavItem icon={Mail} label="Email Config" href={`/app/sites/${siteId}/email`} />
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">System</div>
          <NavItem icon={History} label="Version History" href={`/app/sites/${siteId}/history`} />
          <NavItem icon={Activity} label="Activity Log" href={`/app/sites/${siteId}/activity`} />
          <NavItem icon={DatabaseBackup} label="Backups" href={`/app/sites/${siteId}/backups`} />
        </nav>
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
  const siteIdStr = params.siteId;
  const siteId = parseInt(siteIdStr || "0", 10);
  
  const { data: summary, isLoading } = useGetSiteDashboardSummary(siteId, {
    query: { enabled: !!siteId, queryKey: ['site-summary', siteId] }
  });

  return (
    <AppLayout siteId={siteIdStr!}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspace Overview</h1>
          <p className="text-slate-500">At-a-glance metrics and recent activity for this site.</p>
        </div>
      </div>

      {isLoading ? (
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
                      {summary.recentActivity.map(activity => (
                        <div key={activity.id} className="flex gap-4 text-sm">
                          <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          <div>
                            <p className="text-slate-900">
                              <span className="font-semibold">{activity.actorName}</span> {activity.action} {activity.entityType} {activity.details && <span className="text-slate-500">— {activity.details}</span>}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">
                              {new Date(activity.createdAt).toLocaleString()}
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
                  <CardTitle className="text-sm">System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Square Integration</span>
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
