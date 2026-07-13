import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation, useParams } from "wouter";
import { Loader2, LogOut, User, Home, Settings, Mail, FileText, BookOpen, Calendar } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";

interface StoredSession {
  token: string;
  user: {
    _id: Id<"portalUsers">;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
  };
}

function NavLink({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
        active
          ? "bg-white/20 text-white font-medium"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </div>
  );
}

export default function PortalDashboard() {
  const params = useParams<{ siteSlug: string }>();
  const siteSlug = params.siteSlug ?? "";
  const [, setLocation] = useLocation();

  const [storedSession, setStoredSession] = useState<StoredSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(`portal_session_${siteSlug}`);
    if (raw) {
      try {
        setStoredSession(JSON.parse(raw) as StoredSession);
      } catch {
        localStorage.removeItem(`portal_session_${siteSlug}`);
      }
    }
    setSessionLoaded(true);
  }, [siteSlug]);

  const token = storedSession?.token ?? "";
  const sessionData = useQuery(
    api.portal.validateSession,
    sessionLoaded && token ? { token } : "skip",
  );
  const siteConfig = useQuery(api.portal.getPublicSiteConfig, { siteSlug });
  const logoutMutation = useMutation(api.portal.logout);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!token) {
      setLocation(`/portal/${siteSlug}/login`);
      return;
    }
    if (sessionData === null) {
      localStorage.removeItem(`portal_session_${siteSlug}`);
      setLocation(`/portal/${siteSlug}/login`);
    }
  }, [sessionLoaded, token, sessionData, siteSlug, setLocation]);

  const handleLogout = async () => {
    if (token) {
      await logoutMutation({ token });
    }
    localStorage.removeItem(`portal_session_${siteSlug}`);
    setLocation(`/portal/${siteSlug}/login`);
  };

  if (!sessionLoaded || siteConfig === undefined || (token && sessionData === undefined)) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!siteConfig) return null;

  const user = sessionData?.user ?? storedSession?.user;
  if (!user) return null;

  const primaryColor = siteConfig.portalPrimaryColor ?? siteConfig.sitePrimaryColor ?? "#16a34a";
  const logoUrl = siteConfig.portalLogoUrl ?? siteConfig.siteLogoUrl;
  const features = siteConfig.enabledFeatures as Record<string, boolean>;

  return (
    <div className="min-h-dvh flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: primaryColor }}>
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={siteConfig.siteName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                {siteConfig.siteName.charAt(0)}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm truncate">{siteConfig.siteName}</p>
              <p className="text-white/60 text-xs">Client Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink icon={Home} label="Dashboard" active />
          <NavLink icon={User} label="My Profile" />
          {features?.courses && <NavLink icon={BookOpen} label="My Courses" />}
          {features?.events && <NavLink icon={Calendar} label="My Events" />}
          {features?.documents && <NavLink icon={FileText} label="Documents" />}
          {features?.messages && <NavLink icon={Mail} label="Messages" />}
          <NavLink icon={Settings} label="Account Settings" />
        </nav>

        <div className="p-3 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome, {user.firstName}!
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{siteConfig.welcomeMessage}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Account</p>
                  <p className="text-base font-semibold text-slate-900 capitalize">{user.role}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Status</p>
                  <p className="text-base font-semibold text-slate-900 capitalize">Active</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">Your account is active</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Home className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Portal</p>
                  <p className="text-base font-semibold text-slate-900 truncate">{siteConfig.siteName}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">Member portal</p>
            </div>
          </div>

          {Object.keys(features).filter((k) => features[k]).length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div
                className="h-14 w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor + "22" }}
              >
                <Home className="h-7 w-7" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Your Portal</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Welcome to your client portal. Contact your administrator to learn more about the features available to you.
              </p>
            </div>
          )}

          {features?.courses && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
                <h2 className="text-base font-semibold text-slate-900">My Courses</h2>
              </div>
              <p className="text-sm text-slate-500">Your enrolled courses will appear here.</p>
            </div>
          )}

          {features?.events && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
                <h2 className="text-base font-semibold text-slate-900">My Events</h2>
              </div>
              <p className="text-sm text-slate-500">Your registered events will appear here.</p>
            </div>
          )}

          {features?.documents && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-5 w-5" style={{ color: primaryColor }} />
                <h2 className="text-base font-semibold text-slate-900">Secure Documents</h2>
              </div>
              <p className="text-sm text-slate-500">Documents shared with you will appear here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
