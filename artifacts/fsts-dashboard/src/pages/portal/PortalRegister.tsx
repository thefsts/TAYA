import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation, useParams } from "wouter";
import { Loader2, UserPlus, CheckCircle } from "lucide-react";

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

export default function PortalRegister() {
  const params = useParams<{ siteSlug: string }>();
  const siteSlug = params.siteSlug ?? "";
  const [, setLocation] = useLocation();
  const siteConfig = useQuery(api.portal.getPublicSiteConfig, { siteSlug });
  const registerAction = useAction(api.portal.register);

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  if (siteConfig === undefined) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!siteConfig || !siteConfig.portalEnabled || !siteConfig.registrationOpen) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Registration Not Available</h1>
          <p className="text-slate-500 text-sm">Registration is not currently open for this portal.</p>
        </div>
      </div>
    );
  }

  const primaryColor = siteConfig.portalPrimaryColor ?? siteConfig.sitePrimaryColor ?? "#16a34a";
  const logoUrl = siteConfig.portalLogoUrl ?? siteConfig.siteLogoUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = await registerAction({
        siteSlug,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });
      if (result.success) {
        if (result.requiresApproval) {
          setPendingApproval(true);
        } else if (result.sessionToken) {
          localStorage.setItem(
            `portal_session_${siteSlug}`,
            JSON.stringify({ token: result.sessionToken, user: result.user }),
          );
          setLocation(`/portal/${siteSlug}/dashboard`);
        }
      } else {
        setError(result.error ?? "Registration failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <PortalPageShell logoUrl={logoUrl} siteName={siteConfig.siteName} primaryColor={primaryColor}>
        <div className="text-center py-4">
          <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: primaryColor }} />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Account Created!</h2>
          <p className="text-sm text-slate-600 mb-4">
            Your account is pending approval. You&apos;ll be able to sign in once an administrator approves your request.
          </p>
          <a
            href={`/portal/${siteSlug}/login`}
            className="text-sm font-semibold hover:underline"
            style={{ color: primaryColor }}
          >
            Back to sign in
          </a>
        </div>
      </PortalPageShell>
    );
  }

  return (
    <PortalPageShell logoUrl={logoUrl} siteName={siteConfig.siteName} primaryColor={primaryColor}>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Create your account</h2>
      <p className="text-sm text-slate-500 mb-6">
        Join the {siteConfig.siteName} client portal.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
              placeholder="Smith"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="regEmail">
            Email address
          </label>
          <input
            id="regEmail"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="regPassword">
            Password
          </label>
          <input
            id="regPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <a
          href={`/portal/${siteSlug}/login`}
          className="font-semibold hover:underline"
          style={{ color: primaryColor }}
        >
          Sign in
        </a>
      </p>
    </PortalPageShell>
  );
}
