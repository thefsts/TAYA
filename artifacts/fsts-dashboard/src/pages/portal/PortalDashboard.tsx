import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation, useParams } from "wouter";
import {
  Loader2, LogOut, User, Home, Settings, Mail, FileText, BookOpen,
  Calendar, Receipt, Award, LifeBuoy,
} from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { normalizeEnabledFeatures, type PortalFeatureKey } from "@convex/lib/portalFeatures";

interface SessionUser {
  _id: Id<"portalUsers">;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  profileData?: Record<string, unknown>;
}

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

type SectionKey = "dashboard" | "profile" | "settings" | PortalFeatureKey;

/** Sidebar + section metadata for every canonical portal feature. */
const FEATURE_META: Array<{
  key: PortalFeatureKey;
  navLabel: string;
  icon: any;
  title: string;
  blurb: string;
}> = [
  { key: "courses", navLabel: "My Courses", icon: BookOpen, title: "My Courses", blurb: "Your enrolled courses will appear here." },
  { key: "events", navLabel: "My Events", icon: Calendar, title: "My Events", blurb: "Your registered events will appear here." },
  { key: "documents", navLabel: "Documents", icon: FileText, title: "Secure Documents", blurb: "Documents shared with you will appear here." },
  { key: "messages", navLabel: "Messages", icon: Mail, title: "Messages", blurb: "Your messages will appear here." },
  { key: "invoices", navLabel: "Invoices", icon: Receipt, title: "Invoices & Receipts", blurb: "Your invoices and receipts will appear here." },
  { key: "certificates", navLabel: "Certificates", icon: Award, title: "Certificates", blurb: "Your earned certificates will appear here." },
  { key: "support", navLabel: "Support", icon: LifeBuoy, title: "Support Tickets", blurb: "Your support requests will appear here." },
];

function NavLink({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
        active
          ? "bg-white/20 text-white font-medium"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300";

// Shared primary-action button style (module scope so ProfileSection and
// PasswordSection can use it — they are separate components outside the
// PortalDashboard function body).
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50";

function Banner({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        tone === "success"
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      {children}
    </div>
  );
}

export default function PortalDashboard() {
  const params = useParams<{ siteSlug: string }>();
  const siteSlug = params.siteSlug ?? "";
  const [, setLocation] = useLocation();

  const [storedSession, setStoredSession] = useState<StoredSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [section, setSection] = useState<SectionKey>("dashboard");

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
  const updateProfileAction = useAction(api.portal.updateMyProfile);
  const updatePasswordAction = useAction(api.portal.updateMyPassword);

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

  const user: SessionUser | undefined = sessionData?.user ?? storedSession?.user;
  if (!user) return null;

  const primaryColor = siteConfig.portalPrimaryColor ?? siteConfig.sitePrimaryColor ?? "#16a34a";  const logoUrl = siteConfig.portalLogoUrl ?? siteConfig.siteLogoUrl;
  // Defense-in-depth: the backend already normalizes, but normalizing here too
  // means the UI can never regress to the legacy-key mismatch even if a config
  // document is written by an older code path.
  const features = normalizeEnabledFeatures(
    siteConfig.enabledFeatures as Record<string, unknown> | undefined,
  );
  const enabledFeatures = FEATURE_META.filter((f) => features[f.key]);
  const activeSection: SectionKey =
    section !== "dashboard" && section !== "profile" && section !== "settings" && !features[section]
      ? "dashboard"
      : section;

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
          <NavLink icon={Home} label="Dashboard" active={activeSection === "dashboard"} onClick={() => setSection("dashboard")} />
          <NavLink icon={User} label="My Profile" active={activeSection === "profile"} onClick={() => setSection("profile")} />
          {enabledFeatures.map((f) => (
            <NavLink
              key={f.key}
              icon={f.icon}
              label={f.navLabel}
              active={activeSection === f.key}
              onClick={() => setSection(f.key)}
            />
          ))}
          <NavLink icon={Settings} label="Account Settings" active={activeSection === "settings"} onClick={() => setSection("settings")} />
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
          {activeSection === "dashboard" && (
            <DashboardSection
              user={user}
              siteName={siteConfig.siteName}
              primaryColor={primaryColor}
              enabledFeatures={enabledFeatures}
            />
          )}
          {activeSection === "profile" && (
            <ProfileSection
              user={user}
              token={token}
              siteSlug={siteSlug}
              primaryColor={primaryColor}
              updateProfileAction={updateProfileAction}
              onSessionUserUpdated={(patch) => {
                if (storedSession) {
                  const next = {
                    ...storedSession,
                    user: { ...storedSession.user, ...patch },
                  };
                  setStoredSession(next);
                  localStorage.setItem(`portal_session_${siteSlug}`, JSON.stringify(next));
                }
              }}
            />
          )}
          {activeSection === "settings" && (
            <PasswordSection
              token={token}
              primaryColor={primaryColor}
              updatePasswordAction={updatePasswordAction}
            />
          )}
          {FEATURE_META.map(
            (f) =>
              activeSection === f.key &&
              features[f.key] && (
                <div key={f.key} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <f.icon className="h-5 w-5" style={{ color: primaryColor }} />
                    <h2 className="text-base font-semibold text-slate-900">{f.title}</h2>
                  </div>
                  <p className="text-sm text-slate-500">{f.blurb}</p>
                </div>
              ),
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardSection({
  user,
  siteName,
  primaryColor,
  enabledFeatures,
}: {
  user: SessionUser;
  siteName: string;
  primaryColor: string;
  enabledFeatures: typeof FEATURE_META;
}) {
  return (
    <>
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
              <p className="text-base font-semibold text-slate-900 capitalize">{user.status}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Your account is {user.status === "active" ? "active" : user.status}</p>
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
              <p className="text-base font-semibold text-slate-900 truncate">{siteName}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Member portal</p>
        </div>
      </div>

      {enabledFeatures.length === 0 && (
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

      {enabledFeatures.map((f) => (
        <div key={f.key} className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <f.icon className="h-5 w-5" style={{ color: primaryColor }} />
            <h2 className="text-base font-semibold text-slate-900">{f.title}</h2>
          </div>
          <p className="text-sm text-slate-500">{f.blurb}</p>
        </div>
      ))}
    </>
  );
}

function ProfileSection({
  user,
  token,
  siteSlug,
  primaryColor,
  updateProfileAction,
  onSessionUserUpdated,
}: {
  user: SessionUser;
  token: string;
  siteSlug: string;
  primaryColor: string;
  updateProfileAction: (args: {
    token: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onSessionUserUpdated: (patch: { firstName?: string; lastName?: string }) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(
    typeof user.profileData?.phone === "string" ? (user.profileData.phone as string) : "",
  );
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(typeof user.profileData?.phone === "string" ? (user.profileData.phone as string) : "");
  }, [user._id, user.firstName, user.lastName]);

  const handleSave = async () => {
    if (saving) return;
    setBanner(null);
    if (!firstName.trim() || !lastName.trim()) {
      setBanner({ tone: "error", text: "First and last name are required." });
      return;
    }
    setSaving(true);
    try {
      const result = await updateProfileAction({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone,
      });
      if (result.success) {
        onSessionUserUpdated({ firstName: firstName.trim(), lastName: lastName.trim() });
        setBanner({ tone: "success", text: "Profile saved." });
      } else {
        setBanner({ tone: "error", text: result.error ?? "Could not save your profile." });
      }
    } catch {
      setBanner({ tone: "error", text: "Could not save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xl" data-testid="portal-profile-section">
      <div className="flex items-center gap-3 mb-6">
        <User className="h-5 w-5" style={{ color: primaryColor }} />
        <h2 className="text-base font-semibold text-slate-900">My Profile</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-first-name">
            First name
          </label>
          <input
            id="portal-first-name"
            className={inputClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-last-name">
            Last name
          </label>
          <input
            id="portal-last-name"
            className={inputClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-email">
            Email
          </label>
          <input id="portal-email" className={`${inputClass} bg-slate-50 text-slate-500`} value={user.email} readOnly />
          <p className="text-xs text-slate-400 mt-1">
            Contact your administrator to change the email on your account.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-phone">
            Phone (optional)
          </label>
          <input
            id="portal-phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-123-4567"
          />
        </div>
        {banner && <Banner tone={banner.tone}>{banner.text}</Banner>}
        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={primaryButtonClass}
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-6">
        Portal: {siteSlug ? siteSlug : "—"}
      </p>
    </div>
  );
}

function PasswordSection({
  token,
  primaryColor,
  updatePasswordAction,
}: {
  token: string;
  primaryColor: string;
  updatePasswordAction: (args: {
    token: string;
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setBanner(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setBanner({ tone: "error", text: "All three password fields are required." });
      return;
    }
    if (newPassword.length < 8) {
      setBanner({ tone: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setBanner({ tone: "error", text: "New password and confirmation do not match." });
      return;
    }
    setSaving(true);
    try {
      const result = await updatePasswordAction({ token, currentPassword, newPassword });
      if (result.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setBanner({ tone: "success", text: "Password updated." });
      } else {
        setBanner({ tone: "error", text: result.error ?? "Could not update your password." });
      }
    } catch {
      setBanner({ tone: "error", text: "Could not update your password. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xl" data-testid="portal-password-section">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-5 w-5" style={{ color: primaryColor }} />
        <h2 className="text-base font-semibold text-slate-900">Account Settings</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-current-password">
            Current password
          </label>
          <input
            id="portal-current-password"
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-new-password">
            New password
          </label>
          <input
            id="portal-new-password"
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="portal-confirm-password">
            Confirm new password
          </label>
          <input
            id="portal-confirm-password"
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {banner && <Banner tone={banner.tone}>{banner.text}</Banner>}
        <div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={primaryButtonClass}
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}
