import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useClerk } from "@clerk/react";
import {
  Building2,
  Settings,
  Users,
  LogOut,
  ChevronRight,
  Globe,
  ShieldX,
  ShieldCheck,
  Landmark,
  SlidersHorizontal,
  Rocket,
  BookOpen,
  KeyRound,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function SitesList() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();

  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.list);

  const loadingMe = me === undefined;
  const loadingSites = sites === undefined;

  useEffect(() => {
    if (!loadingMe && !loadingSites && !me?.isSuperAdmin && sites?.length === 1) {
      setLocation(`/app/sites/${sites[0]._id}`, { replace: true });
    }
  }, [loadingMe, loadingSites, me?.isSuperAdmin, sites, setLocation]);

  if (!loadingMe && !loadingSites && !me?.isSuperAdmin && sites?.length === 1) {
    return null;
  }

  if (!loadingMe && me !== null && me?.isActive === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
            <ShieldX className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 mb-2">Account Deactivated</h1>
          <p className="text-slate-500 text-sm leading-6 mb-6">
            Your dashboard access is currently disabled. Please contact your FSTS administrator for assistance.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut({ redirectUrl: window.location.origin })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <LayoutDashboard className="h-4 w-4 text-lime-300" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">FSTS Website Operating System™</div>
              <div className="hidden text-[11px] text-slate-400 sm:block">Client management workspace</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 md:flex">
              {loadingMe ? (
                <Skeleton className="h-4 w-24 bg-slate-700" />
              ) : (
                <>
                  <span className="max-w-[180px] truncate font-medium text-white">{me?.name || "Account"}</span>
                  <span className="h-3 w-px bg-slate-700" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {me?.isSuperAdmin ? "FSTS Admin" : "Client"}
                  </span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-slate-900 hover:text-white"
              onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Website management made simple
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  {me?.isSuperAdmin ? "Website Operations" : "Your Website Workspace"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                  {me?.isSuperAdmin
                    ? "Manage client websites, onboard new sites, and open any workspace from one secure control center."
                    : "Manage your website content, classes, events, media, forms, and day-to-day updates from one place."}
                </p>
              </div>

              {me?.isSuperAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="bg-white"
                    onClick={() => setLocation("/app/admin/sites")}
                  >
                    <Settings className="h-4 w-4 mr-2 text-slate-500" />
                    Platform Settings
                  </Button>
                  <Button
                    onClick={() => setLocation("/app/onboard")}
                    className="bg-primary text-white shadow-sm hover:bg-primary/90"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Onboard New Site
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {me?.isSuperAdmin && (
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">FSTS Administration</h2>
                  <p className="mt-1 text-xs text-slate-500">Platform-only controls are separated from client website workspaces.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Admin only
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/users")}>
                  <Users className="h-4 w-4 mr-2 text-slate-500" />
                  Users
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/access-control")}>
                  <ShieldCheck className="h-4 w-4 mr-2 text-slate-500" />
                  Access Control
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/roles")}>
                  <KeyRound className="h-4 w-4 mr-2 text-slate-500" />
                  Roles
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/design-lock")}>
                  <ShieldCheck className="h-4 w-4 mr-2 text-slate-500" />
                  Design Lock™
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/agencies")}>
                  <Landmark className="h-4 w-4 mr-2 text-slate-500" />
                  Agencies
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/platform-controls")}>
                  <SlidersHorizontal className="h-4 w-4 mr-2 text-slate-500" />
                  Platform Controls
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/runbook")}>
                  <BookOpen className="h-4 w-4 mr-2 text-slate-500" />
                  Runbook
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setLocation("/app/admin/sites")}>
                  <Settings className="h-4 w-4 mr-2 text-slate-500" />
                  Site Administration
                </Button>
              </div>
            </section>
          )}

          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  {me?.isSuperAdmin ? "Client Websites" : "Your Websites"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {me?.isSuperAdmin ? "Open a website workspace to manage content and operations." : "Choose the website you want to manage."}
                </p>
              </div>
              {!loadingSites && sites && sites.length > 0 && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  {sites.length} {sites.length === 1 ? "site" : "sites"}
                </span>
              )}
            </div>

            {loadingSites ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Skeleton className="h-1.5 w-full rounded-none bg-slate-200" />
                    <div className="p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-xl bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-2/3 bg-slate-200" />
                          <Skeleton className="h-3 w-1/2 bg-slate-100" />
                        </div>
                      </div>
                      <Skeleton className="mt-6 h-10 w-full rounded-lg bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sites?.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Building2 className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No websites available yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {me?.isSuperAdmin
                    ? "Onboard a client website to create its workspace."
                    : "Your website workspace has not been assigned yet. Contact your FSTS representative for access."}
                </p>
                {me?.isSuperAdmin && (
                  <Button className="mt-5" onClick={() => setLocation("/app/onboard")}>
                    <Rocket className="h-4 w-4 mr-2" />
                    Onboard New Site
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sites?.map((site: NonNullable<typeof sites>[number]) => (
                  <Link
                    key={site._id}
                    href={`/app/sites/${site._id}`}
                    className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-slate-200/70"
                  >
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: site.brandColorPrimary || "hsl(84 65% 25%)" }}
                    />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start gap-4">
                        {site.logoUrl ? (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                            <img src={site.logoUrl} alt={site.name} className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-lg font-bold text-slate-500">
                            {site.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-lg font-bold tracking-tight text-slate-950 transition-colors group-hover:text-primary">
                            {site.name}
                          </h3>
                          <div className="mt-1 flex min-w-0 items-center text-xs text-slate-500">
                            <Globe className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{site.domain || site.slug}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                        <p className="text-xs leading-5 text-slate-500">
                          Open this workspace to manage website content, classes, events, media, forms, and available site tools.
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          site.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : site.status === "staging"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {site.status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          Open workspace
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
