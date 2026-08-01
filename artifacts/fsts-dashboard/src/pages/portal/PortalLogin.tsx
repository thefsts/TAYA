import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation, useParams } from "wouter";
import { Loader2, LogIn, Lock } from "lucide-react";

function PortalPageShell({
  logoUrl,
  siteName,
  primaryColor,
  children,
}: {
  logoUrl: string | null;
  siteName: string;
  primaryColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-16 w-auto mx-auto mb-4 object-contain" />
          ) : (
            <div
              className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow"
              style={{ backgroundColor: primaryColor }}
            >
              {siteName.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{siteName}</h1>
          <p className="text-sm text-slate-500 mt-1">Client Portal</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {children}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.ceil(ms / 1_000);
  if (totalSecs < 60) return `${totalSecs} second${totalSecs !== 1 ? "s" : ""}`;
  const mins = Math.ceil(totalSecs / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""}`;
  const hours = Math.ceil(mins / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

export default function PortalLogin() {
  const params = useParams<{ siteSlug: string }>();
  const siteSlug = params.siteSlug ?? "";
  const [, setLocation] = useLocation();
  const siteConfig = useQuery(api.portal.getPublicSiteConfig, { siteSlug });
  const loginAction = useAction(api.portal.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  // Tick countdown while account is locked
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLockedUntil(null);
        setCountdown("");
        setError("");
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  if (siteConfig === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!siteConfig || !siteConfig.portalEnabled) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Portal Not Available</h1>
          <p className="text-slate-500 text-sm">This client portal is not currently available. Please contact the site administrator.</p>
        </div>
      </div>
    );
  }

  const primaryColor = siteConfig.portalPrimaryColor ?? siteConfig.sitePrimaryColor ?? "#16a34a";
  const logoUrl = siteConfig.portalLogoUrl ?? siteConfig.siteLogoUrl;
  const isLocked = lockedUntil !== null && lockedUntil > Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError("");
    setLoading(true);
    try {
      const result = await loginAction({ siteSlug, email, password });
      if (result.success && result.sessionToken) {
        localStorage.setItem(
          `portal_session_${siteSlug}`,
          JSON.stringify({ token: result.sessionToken, user: result.user }),
        );
        setLocation(`/portal/${siteSlug}/dashboard`);
      } else if (result.error === "AccountTemporarilyLocked" && result.lockedUntil) {
        setLockedUntil(result.lockedUntil);
      } else {
        setError(result.error ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalPageShell logoUrl={logoUrl} siteName={siteConfig.siteName} primaryColor={primaryColor}>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Sign in to your account</h2>
      <p className="text-sm text-slate-500 mb-6">
        {siteConfig.welcomeMessage}
      </p>

      {isLocked && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Too many failed attempts. Your account is temporarily locked.{" "}
            {countdown ? <>Please try again in <strong>{countdown}</strong>.</> : "Please wait."}
          </span>
        </div>
      )}

      {!isLocked && error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            disabled={isLocked}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ "--tw-ring-color": primaryColor } as React.CSSProperties}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={isLocked}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading || isLocked}
          className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {isLocked ? "Account locked" : "Sign in"}
        </button>
      </form>

      {siteConfig.registrationOpen && (
        <p className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <a
            href={`/portal/${siteSlug}/register`}
            className="font-semibold hover:underline"
            style={{ color: primaryColor }}
          >
            Create one
          </a>
        </p>
      )}
    </PortalPageShell>
  );
}
