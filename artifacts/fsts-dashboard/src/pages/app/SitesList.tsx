import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth, useClerk } from "@clerk/react";
import { Building2, Settings, Users, LogOut, ChevronRight, Globe, ShieldX, ShieldCheck, Landmark, SlidersHorizontal, Rocket, BookOpen, KeyRound, LayoutDashboard, Sparkles, FlaskConical, RefreshCw, TriangleAlert, Search, HeartPulse, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const ACCOUNT_PORTAL = "https://accounts.app.fstsclientsystem.com";

export default function SitesList() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { sessionId } = useAuth();
  const { isAuthenticated: convexAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const me = useQuery(api.users.me);
  const sites = useQuery(api.sites.listWithHealth);
  const loadingMe = me === undefined;
  const loadingSites = sites === undefined;
  const isInternalQa = !!me?.roles?.some((role: any) => role.role === "internal_qa");

  useEffect(() => {
    if (convexAuthenticated) {
      setAuthTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [convexAuthenticated]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const returnTo = `${window.location.origin}/`;
    const hostedSignIn = `${ACCOUNT_PORTAL}/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;

    try {
      await signOut({ sessionId: sessionId ?? undefined, redirectUrl: hostedSignIn });
    } catch (error) {
      console.error("TAYA sign-out failed", error);
      setSigningOut(false);
      window.alert("TAYA could not close the Clerk session. Please retry Sign Out.");
    }
  };

  useEffect(() => {
    if (!loadingMe && !loadingSites && !me?.isSuperAdmin && !isInternalQa && sites?.length === 1) {
      setLocation(`/app/sites/${sites[0]._id}`, { replace: true });
    }
  }, [loadingMe, loadingSites, me?.isSuperAdmin, isInternalQa, sites, setLocation]);

  // Client-side search and filter
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    return sites.filter((site: any) => {
      const matchesSearch = !searchQuery ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (site.domain || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || site.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sites, searchQuery, statusFilter]);

  if (!loadingMe && !loadingSites && !me?.isSuperAdmin && !isInternalQa && sites?.length === 1) return null;

  if (authTimedOut && !convexAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="border-b border-slate-800/80 bg-[#071126] text-white">
          <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400" />
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div><div className="text-sm font-black tracking-[0.18em] bg-gradient-to-r from-pink-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">TAYA™</div><div className="text-[11px] text-slate-400">Tools • Automation • Your Advantage</div></div>
            <Button variant="ghost" size="sm" disabled={signingOut} className="text-slate-300 hover:bg-slate-900 hover:text-white" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />{signingOut ? "Signing Out…" : "Sign Out"}</Button>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50"><TriangleAlert className="h-6 w-6 text-amber-600" /></div>
            <h1 className="text-2xl font-bold text-slate-950">TAYA backend authentication is not connected yet</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your Clerk session is active, but Convex has not accepted the session token. Until that connection succeeds, TAYA cannot load your Platform Admin role or the Corsair workspace.</p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p><strong>Clerk:</strong> signed in</p>
              <p><strong>Convex:</strong> {convexAuthLoading ? "still checking authentication" : "not authenticated"}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4 mr-2" />Retry Connection</Button>
              <Button variant="outline" disabled={signingOut} onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />{signingOut ? "Signing Out…" : "Sign Out"}</Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!loadingMe && me !== null && me?.isActive === false) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4"><div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100"><ShieldX className="h-7 w-7 text-red-600" /></div><h1 className="text-2xl font-bold text-slate-950 mb-2">Account Deactivated</h1><p className="text-slate-500 text-sm mb-6">Your TAYA dashboard access is currently disabled. Please contact your administrator for assistance.</p><Button variant="outline" className="w-full" disabled={signingOut} onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />{signingOut ? "Signing Out…" : "Sign Out"}</Button></div></div>;
  }

  const workspaceTitle = me?.isSuperAdmin ? "Website Operations" : isInternalQa ? "TAYA QA Workspaces" : "Your Website Workspace";
  const workspaceDescription = me?.isSuperAdmin
    ? "Manage client websites, onboard new sites, and open any workspace from one secure control center."
    : isInternalQa
      ? "Select a client workspace to run controlled QA and support checks. You are not signed in as the client owner."
      : "Manage your website content, classes, events, media, forms, and day-to-day updates from one place.";

  function HealthBadge({ score }: { score: number | null }) {
    if (score == null) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400"><HeartPulse className="h-3 w-3" />No scan</span>;
    }
    const color = score >= 75 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}><HeartPulse className="h-3 w-3" />{score}</span>;
  }

  function formatRelativeTime(iso: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#071126] text-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400" />
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-white/5"><LayoutDashboard className="h-4 w-4 text-cyan-300" /></div><div><div className="text-sm font-black tracking-[0.18em] bg-gradient-to-r from-pink-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">TAYA™</div><div className="hidden text-[11px] text-slate-400 sm:block">Tools • Automation • Your Advantage</div></div></div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm md:flex">{loadingMe ? <Skeleton className="h-4 w-24 bg-slate-700" /> : <><span className="max-w-[180px] truncate font-medium text-white">{me?.name || "Account"}</span><span className="h-3 w-px bg-slate-700" /><span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isInternalQa ? "text-amber-300" : me?.isSuperAdmin ? "text-cyan-300" : "text-slate-400"}`}>{me?.isSuperAdmin ? "Platform Admin" : isInternalQa ? "Internal QA" : "Client"}</span></>}</div>
            <Button variant="ghost" size="sm" disabled={signingOut} className="text-slate-300 hover:bg-slate-900 hover:text-white" onClick={handleSignOut}><LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{signingOut ? "Signing Out…" : "Sign Out"}</span></Button>
          </div>
        </div>
      </header>

      {isInternalQa && <div className="border-b border-amber-300 bg-amber-50"><div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 text-sm text-amber-950 sm:px-6 lg:px-8"><FlaskConical className="h-4 w-4 flex-shrink-0" /><strong>TAYA Internal QA Mode</strong><span className="text-amber-800">Client workspaces are available for controlled testing and support. Your activity remains under your authorized internal identity.</span></div></div>}

      <main className="flex-1">
        <section className="border-b border-slate-200 bg-white"><div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${isInternalQa ? "border-amber-200 bg-amber-50 text-amber-800" : "border-violet-200 bg-violet-50 text-violet-800"}`}>{isInternalQa ? <FlaskConical className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{isInternalQa ? "Internal testing & support" : "Website management made simple"}</div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{workspaceTitle}</h1><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">{workspaceDescription}</p></div>{me?.isSuperAdmin && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setLocation("/app/admin/sites")}><Settings className="h-4 w-4 mr-2" />Platform Settings</Button><Button className="bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 text-white hover:opacity-90" onClick={() => setLocation("/app/onboard")}><Rocket className="h-4 w-4 mr-2" />Onboard New Site</Button></div>}</div></div></section>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {me?.isSuperAdmin && <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-sm font-semibold text-slate-900">TAYA Administration</h2><p className="mt-1 text-xs text-slate-500">Platform-only controls are separated from client website workspaces.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Button variant="outline" onClick={() => setLocation("/app/admin/users")}><Users className="h-4 w-4 mr-2" />Users</Button><Button variant="outline" onClick={() => setLocation("/app/admin/access-control")}><ShieldCheck className="h-4 w-4 mr-2" />Access Control</Button><Button variant="outline" onClick={() => setLocation("/app/admin/roles")}><KeyRound className="h-4 w-4 mr-2" />Roles</Button><Button variant="outline" onClick={() => setLocation("/app/admin/design-lock")}><ShieldCheck className="h-4 w-4 mr-2" />Design Lock™</Button><Button variant="outline" onClick={() => setLocation("/app/admin/agencies")}><Landmark className="h-4 w-4 mr-2" />Agencies</Button><Button variant="outline" onClick={() => setLocation("/app/admin/platform-controls")}><SlidersHorizontal className="h-4 w-4 mr-2" />Platform Controls</Button><Button variant="outline" onClick={() => setLocation("/app/admin/runbook")}><BookOpen className="h-4 w-4 mr-2" />Runbook</Button><Button variant="outline" onClick={() => setLocation("/app/admin/sites")}><Settings className="h-4 w-4 mr-2" />Site Administration</Button></div></section>}

          <section><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">{me?.isSuperAdmin || isInternalQa ? "Client Websites" : "Your Websites"}</h2>
              <p className="mt-1 text-sm text-slate-500">{isInternalQa ? "Choose the client workspace you are testing. Opening it does not impersonate the client." : me?.isSuperAdmin ? "Open a website workspace to manage content and operations." : "Choose the website you want to manage."}</p>
            </div>
            {!loadingSites && sites && sites.length > 0 && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">{filteredSites.length} of {sites.length} {sites.length === 1 ? "site" : "sites"}</span>}
          </div>

            {/* Search and filter bar */}
            {!loadingSites && sites && sites.length > 0 && (
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, domain, or slug…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 max-w-md bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {["all", "active", "archived"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${statusFilter === status ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingSites ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i => <div key={i} className="rounded-2xl border bg-white p-6"><Skeleton className="h-24 w-full" /></div>)}</div> : sites?.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Building2 className="mx-auto mb-4 h-6 w-6 text-slate-400" /><h3 className="text-lg font-semibold">No websites available yet</h3><p className="mt-2 text-sm text-slate-500">{isInternalQa ? "No client sites are currently assigned to Internal QA." : "Your website workspace has not been assigned yet."}</p></div> : filteredSites.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Search className="mx-auto mb-4 h-6 w-6 text-slate-400" /><h3 className="text-lg font-semibold">No matching websites</h3><p className="mt-2 text-sm text-slate-500">Try adjusting your search or filter.</p></div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filteredSites.map((site: any) => <Link key={site._id} href={`/app/sites/${site._id}`} className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl"><div className="h-1.5 w-full" style={{background:site.brandColorPrimary || "linear-gradient(90deg,#ff1493,#7c3cff,#246bfe,#00c8ff,#ff6b1a,#ffc928)"}}/><div className="flex flex-1 flex-col p-6"><div className="flex items-start gap-4">{site.logoUrl ? <div className="flex h-12 w-12 items-center justify-center rounded-xl border p-1.5"><img src={site.logoUrl} alt={site.name} className="h-full w-full object-contain" /></div> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 font-bold">{site.name.charAt(0)}</div>}<div className="min-w-0 flex-1"><h3 className="truncate text-lg font-bold text-slate-950">{site.name}</h3><div className="mt-1 flex items-center text-xs text-slate-500"><Globe className="mr-1.5 h-3.5 w-3.5"/><span className="truncate">{site.domain || site.slug}</span></div></div></div><div className="mt-4 flex items-center gap-2 flex-wrap"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${site.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{site.status}</span><HealthBadge score={site.healthScore} />{site.lastActivityAt && <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-3 w-3" />{formatRelativeTime(site.lastActivityAt)}</span>}</div><div className="mt-4 flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5"><p className="text-xs leading-5 text-slate-500">{isInternalQa ? "Open this client workspace in TAYA QA mode for controlled dashboard testing and support checks." : "Open this workspace to manage website content and available site tools."}</p></div><div className="mt-5 flex items-center justify-between border-t pt-4"><span className="text-[10px] font-medium text-slate-400">{site.lastScannedAt ? `Scanned ${formatRelativeTime(site.lastScannedAt)}` : ""}</span><span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600">{isInternalQa ? "Open QA workspace" : "Open workspace"}<ChevronRight className="h-4 w-4"/></span></div></div></Link>)}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
