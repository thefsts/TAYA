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
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Account Deactivated</h1>
          <p className="text-slate-500 text-sm mb-6">
            Your account has been deactivated. Please contact your administrator for assistance.
          </p>
          <Button
            variant="outline"
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
      <header className="px-6 h-16 flex items-center justify-between border-b border-slate-200 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Logo" className="h-8 w-8 brightness-0 invert" />
          <span className="font-bold tracking-tight">FSTS Command</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
            {loadingMe ? (
              <Skeleton className="h-4 w-24 bg-slate-700" />
            ) : (
              <>
                <span className="font-medium text-white">{me?.name}</span>
                <span className="opacity-50">|</span>
                <span className="font-mono text-xs">{me?.isSuperAdmin ? 'SUPER_ADMIN' : 'USER'}</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || "/" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Sites</h1>
            <p className="text-slate-500 mt-1">Select a client site to enter its workspace.</p>
          </div>

          {me?.isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLocation("/app/admin/users")}>
                <Users className="h-4 w-4 mr-2 text-slate-500" />
                Manage Users
              </Button>
              <Button variant="outline" onClick={() => setLocation("/app/admin/access-control")}>
                <ShieldCheck className="h-4 w-4 mr-2 text-slate-500" />
                Access Control
              </Button>
              <Button variant="outline" onClick={() => setLocation("/app/admin/design-lock")}>
                <ShieldCheck className="h-4 w-4 mr-2 text-slate-500" />
                Design Lock™
              </Button>
              <Button variant="outline" onClick={() => setLocation("/app/admin/agencies")}>
                <Landmark className="h-4 w-4 mr-2 text-slate-500" />
                Agencies
              </Button>
              <Button variant="outline" onClick={() => setLocation("/app/admin/platform-controls")}>
                <SlidersHorizontal className="h-4 w-4 mr-2 text-slate-500" />
                Platform Controls
              </Button>
              <Button onClick={() => setLocation("/app/admin/sites")} className="bg-primary hover:bg-primary/90 text-white">
                <Settings className="h-4 w-4 mr-2" />
                Global Settings
              </Button>
            </div>
          )}
        </div>

        {loadingSites ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40 rounded-md bg-slate-200" />
            ))}
          </div>
        ) : sites?.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
            <Building2 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No sites available</h3>
            <p className="text-slate-500 mt-1">You don't have access to any client sites yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites?.map(site => (
              <Link
                key={site._id}
                href={`/app/sites/${site._id}`}
                className="group flex flex-col bg-white border border-slate-200 rounded-md shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 overflow-hidden"
              >
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: site.brandColorPrimary || 'hsl(84 65% 25%)' }}
                />
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {site.logoUrl ? (
                        <img src={site.logoUrl} alt={site.name} className="h-10 w-10 rounded object-contain border border-slate-100" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold">
                          {site.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors">{site.name}</h3>
                        <div className="flex items-center text-xs text-slate-500 mt-0.5">
                          <Globe className="h-3 w-3 mr-1" />
                          {site.domain || site.slug}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        site.status === 'active' ? 'bg-green-100 text-green-700' :
                        site.status === 'staging' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {site.status}
                      </span>
                    </div>
                    <div className="text-primary opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-200">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
