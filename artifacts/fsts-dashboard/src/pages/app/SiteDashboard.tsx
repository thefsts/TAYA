import { useState, useRef, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, ShieldCheck, ShieldAlert, Mail as MailIcon, FileEdit, AlertTriangle } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  FlaskConical,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck as ShieldCheckIcon,
  User as UserIcon,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AIAssistant } from "@/components/AIAssistant";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNav } from "@/components/SidebarNav";
import { useSidebarUi } from "@/hooks/useSidebarUi";
import GettingStartedCard from "@/components/GettingStartedCard";
import WelcomeTour from "@/components/WelcomeTour";

function AccountMenu({ me, siteId }: { me: any; siteId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isSuperAdmin = me?.isSuperAdmin ?? false;
  const isInternalQa = !!me?.roles?.some((r: any) => r.role === "internal_qa");
  const clientRole = me?.roles?.find((r: any) => r.siteId === siteId)?.role;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : isInternalQa
      ? "Internal QA"
      : clientRole === "owner"
        ? "Owner"
        : clientRole === "client_admin"
          ? "Admin"
          : clientRole
            ? clientRole.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "User";

  const roleBadgeClass = isSuperAdmin
    ? "bg-violet-100 text-violet-700 border-violet-200"
    : isInternalQa
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : "bg-primary/10 text-primary border-primary/20";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 transition-colors hover:bg-slate-50"
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {me?.name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div className="hidden text-left sm:block">
          <div className="max-w-[120px] truncate text-xs font-semibold text-slate-800">{me?.name ?? "User"}</div>
          <div className="text-[10px] text-slate-400">{roleLabel}</div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="truncate text-sm font-semibold text-slate-800">{me?.name ?? "User"}</div>
            <div className="truncate text-xs text-slate-500">{me?.email ?? ""}</div>
            <span className={`mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleBadgeClass}`}>
              {isInternalQa && <FlaskConical className="mr-1 h-3 w-3" />}
              {roleLabel}
            </span>
          </div>
          <div className="py-1">
            <Link
              href={`/app/sites/${siteId}/permissions`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
              My Permissions
            </Link>
            <Link
              href={`/app/sites/${siteId}/help`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <HelpCircle className="h-4 w-4 text-slate-400" />
              Help Center
            </Link>
            <Link
              href="https://accounts.app.fstsclientsystem.com"
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserIcon className="h-4 w-4 text-slate-400" />
              Account Settings
            </Link>
            <div className="my-1 border-t border-slate-100" />
            <Link
              href="/app"
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <ArrowLeft className="h-4 w-4 text-slate-400" />
              {isSuperAdmin || isInternalQa ? "All Websites" : "My Websites"}
            </Link>
            <a
              href="https://accounts.app.fstsclientsystem.com/user/logout"
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children, siteId, pageContext }: { children: React.ReactNode, siteId: string, pageContext?: string }) {
  const site = useQuery(api.sites.get, { siteId: siteId as Id<"sites"> });
  const me = useQuery(api.users.me);
  const [location] = useLocation();
  const effectiveModules = useQuery(api.sites.getEffectiveModules, { siteId: siteId as Id<"sites"> });
  const unreadNotifications = useQuery(api.healthScans.getUnreadNotificationCount, { siteId: siteId as Id<"sites"> });
  const mediaHealth = useQuery(api.media.healthStats, { siteId: siteId as Id<"sites"> });
  const markAllRead = useMutation(api.healthScans.markAllNotificationsRead);
  const isSuperAdmin = me?.isSuperAdmin ?? false;
  const isInternalQa = !!me?.roles?.some((r: any) => r.role === "internal_qa");

  // WordPress-like sidebar state (collapsible groups + compact rail), persisted per user.
  const sidebarUi = useSidebarUi(me?._id ?? null);

  const agencyId = (site as any)?.agencyId as Id<"agencies"> | undefined;
  const agency = useQuery(
    api.agencies.get,
    agencyId ? { agencyId } : "skip",
  );
  const sites = useQuery(api.sites.list);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = location.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Dashboard";
  const siteStatus = site?.status ?? "active";
  const isArchived = siteStatus === "archived";
  const compactRail = sidebarUi.compact;

  return (
    <div className="relative flex min-h-screen bg-slate-50">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Responsive client workspace navigation (WordPress-like collapsible sidebar) */}
      <aside
        data-sidebar={compactRail ? "compact" : "full"}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl transition-[transform,width] duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          compactRail ? "lg:w-16" : "lg:w-72"
        } ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-slate-950 px-3 text-white lg:px-4">
          <Link href="/app" onClick={() => setMobileNavOpen(false)}>
            <Button variant="ghost" size="sm" className="-ml-2 text-slate-300 hover:bg-slate-900 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {!compactRail && "Websites"}
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`hidden h-9 w-9 p-0 text-slate-300 hover:bg-slate-900 hover:text-white lg:flex ${compactRail ? "justify-center" : ""}`}
              onClick={() => sidebarUi.toggleCompact()}
              aria-label={compactRail ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={compactRail}
              title={compactRail ? "Expand sidebar" : "Collapse sidebar"}
            >
              {compactRail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-slate-300 hover:bg-slate-900 hover:text-white lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {agency && (
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            {agency.logoUrl ? (
              <img src={agency.logoUrl} alt={agency.name} className="h-6 w-auto max-w-[120px] object-contain" />
            ) : (
              <div
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: agency.primaryColor }}
              >
                {agency.name.charAt(0)}
              </div>
            )}
            <span className="truncate text-[11px] font-medium text-slate-600">{agency.name}</span>
          </div>
        )}

        <div className={`border-b border-slate-200 ${compactRail ? "px-2 py-3" : "p-4"}`}>
          {site === undefined ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => sites && sites.length > 1 ? setSwitcherOpen((value) => !value) : undefined}
                className={`-m-1.5 flex w-full items-center rounded-xl p-1.5 text-left transition-colors ${compactRail ? "justify-center gap-0" : "gap-3"} ${sites && sites.length > 1 ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
                title={compactRail ? site?.name : undefined}
              >
                {site?.logoUrl ? (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <img src={site.logoUrl} alt={site.name} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 font-bold text-slate-500">
                    {site?.name?.charAt(0)}
                  </div>
                )}
                {!compactRail && (
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h2 className="truncate font-bold tracking-tight text-slate-950" title={site?.name}>{site?.name}</h2>
                    <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {agency ? `${agency.name} Dashboard` : "TAYA System\u2122"}
                    </div>
                  </div>
                )}
                {!compactRail && sites && sites.length > 1 && (
                  <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                )}
              </button>

              {/* Domain + status display under site name */}
              {site && !compactRail && (
                <div className="mt-2 flex items-center gap-2 px-1.5">
                  {site.domain && (
                    <a
                      href={`https://${site.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 truncate text-[11px] font-medium text-slate-500 hover:text-primary hover:underline"
                    >
                      <Globe className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{site.domain}</span>
                    </a>
                  )}
                  <span className={`inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isArchived ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"}`}>
                    {isArchived ? "Archived" : "Live"}
                  </span>
                </div>
              )}

              {switcherOpen && !compactRail && sites && sites.length > 1 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Switch Website</span>
                  </div>
                  {sites.map((listedSite: NonNullable<typeof sites>[number]) => (
                    <Link
                      key={listedSite._id}
                      href={`/app/sites/${listedSite._id}`}
                      onClick={() => {
                        setSwitcherOpen(false);
                        setMobileNavOpen(false);
                      }}
                      className={`flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-sm transition-colors last:border-0 ${listedSite._id === siteId ? "bg-primary/5 font-semibold text-primary" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      <Globe className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="flex-1 truncate">{listedSite.name}</span>
                      {listedSite._id === siteId && <span className="text-[10px] font-bold text-primary">\u25cf</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4" onClick={() => setMobileNavOpen(false)}>
          {/* Dashboard entry (always visible) */}
          <div className="mb-2 space-y-1">
            <Link href={`/app/sites/${siteId}`} onClick={() => setMobileNavOpen(false)}>
              <Button
                variant={location === `/app/sites/${siteId}` ? "secondary" : "ghost"}
                aria-current={location === `/app/sites/${siteId}` ? "page" : undefined}
                className={`h-10 w-full justify-start rounded-lg px-3 ${
                  location === `/app/sites/${siteId}`
                    ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
                    : "font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                } ${compactRail ? "justify-center px-2" : ""}`}
                title={compactRail ? "Dashboard" : undefined}
              >
                <LayoutDashboard className={`h-4 w-4 ${location === `/app/sites/${siteId}` ? "text-primary" : "text-slate-500"} ${compactRail ? "" : "mr-3"}`} />
                {!compactRail && <span className="flex-1 text-left">Dashboard</span>}
              </Button>
            </Link>
          </div>

          {/* WordPress-like collapsible groups (persisted per user) */}
          <SidebarNav
            siteId={String(siteId)}
            enabledModules={(effectiveModules ?? (site as any)?.enabledModules) as Record<string, boolean> | null | undefined}
            isSuperAdmin={isSuperAdmin}
            collapsedGroups={sidebarUi.collapsedGroups}
            onToggleGroup={sidebarUi.toggleGroup}
            badges={{ mediaBroken: mediaHealth?.broken ?? 0 }}
            compact={compactRail}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </nav>

        {/* Bottom action area: always-available client actions */}
        <div className="border-t border-slate-200 px-3 py-2">
          {site?.domain && (
            <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="block">
              <Button
                variant="ghost"
                className={`h-10 w-full justify-start rounded-lg px-3 font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-950 ${compactRail ? "justify-center px-2" : ""}`}
                title={compactRail ? "View Live Site" : undefined}
                aria-label="View live site (opens in a new tab)"
              >
                <ExternalLink className={`h-4 w-4 text-slate-500 ${compactRail ? "" : "mr-3"}`} />
                {!compactRail && <span className="flex-1 text-left">View Live Site</span>}
              </Button>
            </a>
          )}
          <Link href={`/app/sites/${siteId}/help`} onClick={() => setMobileNavOpen(false)} className="block">
            <Button
              variant="ghost"
              className={`h-10 w-full justify-start rounded-lg px-3 font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-950 ${compactRail ? "justify-center px-2" : ""}`}
              title={compactRail ? "Help Center" : undefined}
            >
              <LifeBuoy className={`h-4 w-4 text-slate-500 ${compactRail ? "" : "mr-3"}`} />
              {!compactRail && <span className="flex-1 text-left">Help</span>}
            </Button>
          </Link>
          <a href="https://accounts.app.fstsclientsystem.com" className="block">
            <Button
              variant="ghost"
              className={`h-10 w-full justify-start rounded-lg px-3 font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-950 ${compactRail ? "justify-center px-2" : ""}`}
              title={compactRail ? "Account Settings" : undefined}
            >
              <UserIcon className={`h-4 w-4 text-slate-500 ${compactRail ? "" : "mr-3"}`} />
              {!compactRail && <span className="flex-1 text-left">Account</span>}
            </Button>
          </a>
          <a href="https://accounts.app.fstsclientsystem.com/user/logout" className="block">
            <Button
              variant="ghost"
              className={`h-10 w-full justify-start rounded-lg px-3 font-normal text-slate-600 hover:bg-red-50 hover:text-red-600 ${compactRail ? "justify-center px-2" : ""}`}
              title={compactRail ? "Sign Out" : undefined}
            >
              <LogOut className={`h-4 w-4 text-slate-500 ${compactRail ? "" : "mr-3"}`} />
              {!compactRail && <span className="flex-1 text-left">Sign Out</span>}
            </Button>
          </a>
        </div>

        {(site?.poweredByFsts ?? true) && !agency && !compactRail && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[11px] leading-tight text-slate-400">
              Powered by <span className="font-semibold text-slate-600">Full Stack Tech Solutions</span>
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-400">TAYA System\u2122</p>
          </div>
        )}
        {agency && !compactRail && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[11px] leading-tight text-slate-400">
              Managed by <span className="font-semibold text-slate-600">{agency.name}</span>
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-2 h-9 w-9 flex-shrink-0 p-0 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Page title + domain/status context */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{pageTitle}</h1>
              {isInternalQa && (
                <span className="hidden items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 sm:inline-flex">
                  <FlaskConical className="h-3 w-3" />
                  QA Mode
                </span>
              )}
              {isArchived && (
                <span className="hidden items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 sm:inline-flex">
                  Archived
                </span>
              )}
            </div>
            <div className="hidden items-center gap-2 truncate text-[11px] text-slate-400 sm:flex">
              {site?.domain && (
                <a
                  href={`https://${site.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  <span className="truncate">{site.domain}</span>
                </a>
              )}
              {site?.domain && !isArchived && (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Live
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* SuperAdmin / Internal QA: Return to Platform Admin */}
            {(isSuperAdmin || isInternalQa) && (
              <Link href="/app" className="hidden md:block">
                <Button variant="outline" size="sm" className="h-9 bg-white text-slate-600">
                  <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                  Platform Admin
                </Button>
              </Link>
            )}

            {/* View Website (Preview/Live) */}
            {site?.domain && (
              <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="hidden sm:block">
                <Button variant="outline" size="sm" className="h-9 bg-white text-slate-600">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  View Website
                </Button>
              </a>
            )}

            {/* Health notification bell */}
            <Link href={`/app/sites/${siteId}/health`}>
              <Button
                variant="ghost"
                size="sm"
                className="relative h-9 w-9 p-0 text-slate-500 hover:bg-slate-100"
                title="Health Notifications"
                onClick={() => markAllRead({ siteId: siteId as Id<"sites"> })}
              >
                <Bell className="h-4 w-4" />
                {(unreadNotifications ?? 0) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </Link>

            {/* Account menu */}
            <AccountMenu me={me} siteId={siteId} />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
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
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-3xl font-bold text-slate-900">{value}</div>
        {label && <p className="mt-1 text-xs text-slate-500">{label}</p>}
      </CardContent>
    </Card>
  );
}

export default function SiteDashboard() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;

  const me = useQuery(api.users.me);
  const summary = useQuery(api.sites.getDashboardSummary, { siteId });
  const site = useQuery(api.sites.get, { siteId });
  const effectiveModules = useQuery(api.sites.getEffectiveModules, { siteId });
  const latestScan = useQuery(api.healthScans.getLatestScan, { siteId });
  const notifications = useQuery(api.healthScans.getNotifications, { siteId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionCourses = useQuery((api as any).courses.listActionRequired, { siteId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionEvents = useQuery((api as any).events.listActionRequired, { siteId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiringFlyers = useQuery((api as any).flyers.listExpiringSoon, { siteId });

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

  // Module visibility for Quick Edit (mirrors sidebar gating: null → show, false → hide).
  const moduleIsVisible = (key: string) => effectiveModules == null || effectiveModules[key] !== false;

  return (
    <AppLayout siteId={siteId}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Welcome back, {site?.name ?? "there"}</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">Your website activity, content status, and operational alerts in one place.</p>
          {site?.domain && (
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {site.domain} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {site?.domain && (
          <a href={`https://${site.domain}`} target="_blank" rel="noreferrer">
            <Button className="h-9 bg-primary text-white">
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              View Live Site
            </Button>
          </a>
        )}
      </div>

      <Link href={`/app/sites/${siteId}/health`}>
        <div className={`mb-6 cursor-pointer rounded-2xl border p-4 transition-shadow hover:shadow-md sm:p-5 ${healthBg}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex-shrink-0">
              {healthScore == null ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
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
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">Website Health Command Center\u2122</p>
                {activeNotifications.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {activeNotifications.length} alert{activeNotifications.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className={`mt-0.5 text-sm font-medium ${healthColor}`}>
                {healthScore == null
                  ? "No scan yet \u2014 click to run your first health scan"
                  : healthScore >= 75 ? "Excellent \u2014 your site is healthy"
                    : healthScore >= 50 ? "Needs attention \u2014 some issues detected"
                      : "Critical issues \u2014 immediate action recommended"
                }
              </p>
              {activeNotifications.length > 0 && (
                <p className="mt-1 truncate text-xs text-slate-500">
                  Latest: {activeNotifications[0]?.message}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 text-xs text-slate-400">
              {latestScan ? `Last scan ${new Date(latestScan.scannedAt).toLocaleDateString()}` : "Click to scan \u2192"}
            </div>
          </div>
        </div>
      </Link>

      {summary === undefined ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1,2,3,4].map((index) => <Skeleton key={index} className="h-28 rounded-2xl bg-slate-200" />)}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
            <Skeleton className="h-64 rounded-2xl bg-slate-200" />
            <Skeleton className="h-64 rounded-2xl bg-slate-200" />
            <Skeleton className="h-64 rounded-2xl bg-slate-200" />
          </div>
        </>
      ) : summary ? (
        <>
          {/* Phase 5: Getting Started checklist with real completion state */}
          <GettingStartedCard
            siteId={siteId as unknown as string}
            siteName={site?.name}
            domain={site?.domain}
            summary={summary as any}
            modules={effectiveModules as any}
            userId={me?._id}
          />

          {/* Content counts stat cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
            <StatCard title="Courses" value={summary.courseCount} label="Catalog items" />
            <StatCard title="Events" value={summary.eventCount} label="Scheduled" />
            <StatCard title="Articles" value={summary.articleCount} label="Total posts" />
            <StatCard title="Services" value={summary.serviceCount} label="Offerings" />
            <StatCard title="Published" value={summary.publishedArticles} label="Live articles" />
            <StatCard title="Drafts" value={summary.draftArticles} label="Pending" />
            <StatCard title="Media" value={summary.mediaCount} label="Assets" />
          </div>

          {(() => {
            const items: Array<{ key: string; label: string; href: string; reason: string }> = [];
            (actionCourses ?? []).forEach((course: any) => {
              if (course.nearlyFull) {
                items.push({ key: `c-full-${course._id}`, label: course.title, href: `/app/sites/${siteId}/courses`, reason: "Nearly full" });
              } else if (course.registrationClosingSoon) {
                items.push({ key: `c-reg-${course._id}`, label: course.title, href: `/app/sites/${siteId}/courses`, reason: "Registration closes in 24h" });
              }
            });
            (actionEvents ?? []).forEach((event: any) => {
              if (event.nearlyFull) {
                items.push({ key: `e-full-${event._id}`, label: event.title, href: `/app/sites/${siteId}/events`, reason: "Nearly full" });
              } else if (event.registrationClosingSoon) {
                items.push({ key: `e-reg-${event._id}`, label: event.title, href: `/app/sites/${siteId}/events`, reason: "Registration closes in 24h" });
              } else if (event.missingEndTime) {
                items.push({ key: `e-end-${event._id}`, label: event.title, href: `/app/sites/${siteId}/events`, reason: "Missing end time" });
              }
            });
            (expiringFlyers ?? []).forEach((flyer: any) => {
              items.push({
                key: `f-exp-${flyer._id}`,
                label: flyer.title,
                href: `/app/sites/${siteId}/flyers`,
                reason: `Flyer expires in ${flyer.daysLeft} ${flyer.daysLeft === 1 ? "day" : "days"}`,
              });
            });

            if (items.length === 0) return null;

            return (
              <Card className="mb-8 rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.key} className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white/55 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{item.label}</span>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{item.reason}</span>
                          <Link href={item.href}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary whitespace-nowrap">
                              View \u2192
                            </Button>
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })()}

          {/* Main dashboard grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
            {/* Left column: Recent activity + Upcoming */}
            <div className="space-y-6 xl:col-span-2">
              {/* Recent Activity */}
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>Recent Activity</span>
                    <Link href={`/app/sites/${siteId}/activity`}>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">
                        View all \u2192
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.recentActivity && summary.recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {summary.recentActivity.map((activity: any) => (
                        <div key={activity._id} className="flex gap-4 text-sm">
                          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          <div className="min-w-0">
                            <p className="text-slate-900">
                              <span className="font-semibold">{activity.actorName}</span> {activity.action} {activity.entityType} {activity.details && <span className="text-slate-500">\u2014 {activity.details}</span>}
                            </p>
                            <p className="mt-1 font-mono text-xs text-slate-400">
                              {new Date(activity._creationTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-sm text-slate-500">No recent activity recorded.</p>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Events */}
              {summary.upcomingEvents && (
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Upcoming Events
                      </span>
                      <Link href={`/app/sites/${siteId}/events`}>
                        <Button variant="ghost" size="sm" className="text-xs text-primary">
                          Manage →
                        </Button>
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.upcomingEvents.length > 0 ? (
                      <div className="space-y-3">
                        {summary.upcomingEvents.map((event: any) => (
                          <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">{event.title}</p>
                              {event.location && <p className="truncate text-xs text-slate-500">{event.location}</p>}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs font-semibold text-slate-700">{new Date(event.startAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                              <p className="text-[10px] text-slate-400">{new Date(event.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-slate-600">No upcoming events</p>
                        <p className="mt-1 text-xs text-slate-500">
                          When you schedule an event, it appears here so visitors can find it.{" "}
                          <Link href={`/app/sites/${siteId}/events`} className="font-medium text-primary hover:underline">
                            Schedule your first event
                          </Link>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Upcoming Courses */}
              {summary.upcomingCourses && (
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Upcoming Courses
                      </span>
                      <Link href={`/app/sites/${siteId}/courses`}>
                        <Button variant="ghost" size="sm" className="text-xs text-primary">
                          Manage →
                        </Button>
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.upcomingCourses.length > 0 ? (
                      <div className="space-y-3">
                        {summary.upcomingCourses.map((course: any) => (
                          <div key={course.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">{course.title}</p>
                            </div>
                            {course.startDateTime && (
                              <div className="flex-shrink-0 text-right">
                                <p className="text-xs font-semibold text-slate-700">{new Date(course.startDateTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-slate-600">No upcoming courses</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Courses and classes you schedule will show up here.{" "}
                          <Link href={`/app/sites/${siteId}/courses`} className="font-medium text-primary hover:underline">
                            Create your first course
                          </Link>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Media */}
              {summary.recentMedia && (
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        Recent Media
                      </span>
                      <Link href={`/app/sites/${siteId}/media`}>
                        <Button variant="ghost" size="sm" className="text-xs text-primary">
                          Library →
                        </Button>
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.recentMedia.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {summary.recentMedia.map((media: any) => (
                          <div key={media.id} className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            {(media.thumbnailUrl || media.url) ? (
                              <img src={media.thumbnailUrl || media.url} alt={media.altText || media.fileName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-slate-300" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-slate-600">No media yet</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Photos and files you upload appear here for quick reuse.{" "}
                          <Link href={`/app/sites/${siteId}/media`} className="font-medium text-primary hover:underline">
                            Upload your first image
                          </Link>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Inbox, Status, Quick Edit */}
            <div className="space-y-6">
              {/* Contact Inbox Summary */}
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-primary" />
                      Contact Inbox
                    </span>
                    {summary.unreadSubmissionCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {summary.unreadSubmissionCount} new
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.recentSubmissions && summary.recentSubmissions.length > 0 ? (
                    summary.recentSubmissions.slice(0, 4).map((sub: any) => (
                      <Link key={sub.id} href={`/app/sites/${siteId}/inbox`}>
                        <div className="cursor-pointer rounded-lg border border-slate-100 p-2.5 transition-colors hover:bg-slate-50">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm font-medium ${sub.readAt ? "text-slate-600" : "text-slate-900 font-semibold"}`}>{sub.submitterName || sub.submitterEmail || "Anonymous"}</span>
                            {!sub.readAt && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span className="truncate">{sub.formType}</span>
                            <span className="whitespace-nowrap">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-slate-500">No submissions yet.</p>
                  )}
                  <Link href={`/app/sites/${siteId}/inbox`}>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Open Inbox \u2192
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Website Status */}
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm">Website Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Website</span>
                    {summary.websiteOnline === null ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">No domain set</span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.websiteOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {summary.websiteOnline ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-1 text-slate-600">
                      {summary.sslActive ? <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />}
                      SSL
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.sslActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {summary.sslActive ? "Active" : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Performance</span>
                    <span className="font-mono text-xs text-slate-900">
                      {summary.responseTimeMs != null ? `${summary.responseTimeMs}ms` : "\u2014"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-1 text-slate-600"><MailIcon className="h-3.5 w-3.5" /> Email</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.emailConfigured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {summary.emailConfigured ? "Configured" : "Not Set Up"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-1 text-slate-600"><FileEdit className="h-3.5 w-3.5" /> Forms</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.formsConfigured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {summary.formsConfigured ? "Configured" : "Not Set Up"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Square</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.squareConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {summary.squareConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Last Backup</span>
                    <span className="font-mono text-xs text-slate-900">
                      {summary.lastBackupAt ? new Date(summary.lastBackupAt).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* SEO Health */}
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      SEO Health
                    </span>
                    <Link href={`/app/sites/${siteId}/seo`}>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">
                        Manage \u2192
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">Pages with SEO</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${summary.seoPagesConfigured > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {summary.seoPagesConfigured} configured
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {summary.seoPagesConfigured > 0
                      ? "Meta titles and descriptions are set for key pages."
                      : "No SEO settings configured. Set up page titles and descriptions to improve search visibility."}
                  </p>
                </CardContent>
              </Card>

              {/* Quick Edit */}
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm">Quick Edit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {moduleIsVisible("homepage") && (
                    <Link href={`/app/sites/${siteId}/homepage`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-slate-700 hover:bg-slate-50">
                        <LayoutTemplate className="mr-2 h-4 w-4 text-slate-400" />
                        Edit Homepage
                      </Button>
                    </Link>
                  )}
                  {moduleIsVisible("articles") && (
                    <Link href={`/app/sites/${siteId}/articles`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-slate-700 hover:bg-slate-50">
                        <FileText className="mr-2 h-4 w-4 text-slate-400" />
                        Write Article
                      </Button>
                    </Link>
                  )}
                  {moduleIsVisible("events") && (
                    <Link href={`/app/sites/${siteId}/events`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-slate-700 hover:bg-slate-50">
                        <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                        Add Event
                      </Button>
                    </Link>
                  )}
                  {moduleIsVisible("courses") && (
                    <Link href={`/app/sites/${siteId}/courses`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-slate-700 hover:bg-slate-50">
                        <BookOpen className="mr-2 h-4 w-4 text-slate-400" />
                        Add Course
                      </Button>
                    </Link>
                  )}
                  {moduleIsVisible("media") && (
                    <Link href={`/app/sites/${siteId}/media`}>
                      <Button variant="ghost" size="sm" className="w-full justify-start text-sm text-slate-700 hover:bg-slate-50">
                        <ImageIcon className="mr-2 h-4 w-4 text-slate-400" />
                        Upload Media
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500 shadow-sm">Failed to load dashboard summary.</div>
      )}
      <WelcomeTour siteId={siteId as unknown as string} userId={me?._id} me={me} />
    </AppLayout>
  );
}
