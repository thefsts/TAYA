import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Building2,
  User,
  Link2,
  Rocket,
  LogOut,
  CheckCircle2,
  TriangleAlert,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useClerk, useAuth } from "@clerk/react";

/**
 * CLIENT SELF-SERVICE ONBOARDING — /app/setup (spec §1, §13, §14).
 *
 * The zero-site dead-end ("Your website workspace has not been assigned
 * yet") is replaced by this guided setup: the client confirms who they are,
 * their business, and their website URL — ONE transaction provisions the
 * canonical site + binds their owner role — and they immediately land in
 * their own website workspace.
 *
 * Identity note (§2): the email is intentionally NOT asked for here. The
 * Clerk subject is the identity authority and is read server-side; the
 * account email was already verified through Clerk at sign-in.
 */

const WEBSITE_TYPES: Array<{ value: string; label: string }> = [
  { value: "business_website", label: "Business website" },
  { value: "professional_services", label: "Professional services" },
  { value: "ecommerce", label: "Online store / ecommerce" },
  { value: "restaurant", label: "Restaurant" },
  { value: "medical", label: "Medical / healthcare" },
  { value: "legal", label: "Legal" },
  { value: "construction", label: "Construction / trades" },
  { value: "real_estate", label: "Real estate" },
  { value: "property_management", label: "Property management" },
  { value: "church", label: "Church / ministry" },
  { value: "training_academy", label: "Training academy" },
  { value: "manufacturing", label: "Manufacturing" },
];

const SUPPORT_URL = "https://www.fstacktsolutions.com/";

export default function SetupOnboarding() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { sessionId } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteType, setWebsiteType] = useState("business_website");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = useQuery(api.selfServiceOnboarding.status);
  const provision = useMutation(api.selfServiceOnboarding.provisionSite);
  const runCertify = useAction(api.selfServiceOnboarding.certify);
  const [submitting, setSubmitting] = useState(false);
  const [certification, setCertification] = useState<{
    siteId: string;
    complete: boolean;
    error?: string;
    checks: Array<{ check: string; status: string; reason?: string }>;
  } | null>(null);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // Owner directive (00e6f90 "keep client sign-out inside TAYA"): never
    // expose Clerk's hosted Account Portal to clients — sign out back to the
    // D8-branded in-app sign-in page.
    try {
      await signOut({ sessionId: sessionId ?? undefined, redirectUrl: "/sign-in" });
    } catch (err) {
      console.error("TAYA sign-out failed", err);
      setSigningOut(false);
      window.alert("TAYA could not close the Clerk session. Please retry Sign Out.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const result = await provision({
        name: name.trim(),
        company: company.trim(),
        websiteUrl: websiteUrl.trim(),
        websiteType,
      });

      // §14: certify the invariants BEFORE declaring setup complete. When
      // every required check passes the client lands in their workspace
      // immediately (§1 step 9); otherwise the actionable checklist is shown
      // — TAYA never says "Setup Complete" over a failed invariant.
      let cert: Awaited<ReturnType<typeof runCertify>> | null = null;
      try {
        cert = await runCertify({ siteId: result.siteId });
      } catch (certError: any) {
        console.error("TAYA onboarding certification failed", certError);
      }
      if (cert && cert.complete) {
        setLocation(`/app/sites/${result.siteId}`, { replace: true });
        return;
      }

      setCertification({
        siteId: String(result.siteId),
        complete: cert?.complete ?? false,
        error: cert?.error,
        checks: (cert?.checks as any) ?? [],
      });
      if (result.outcome === "reused") {
        setNotice("Your workspace was already set up — verifying it now.");
      }
    } catch (err: any) {
      // Safe-stop errors (domain conflicts, validation) are actionable by
      // design — surface them verbatim (§3: never a silent failure).
      setError(err?.message ?? "TAYA could not complete your website setup. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // A client who already has sites never needs this page.
  useEffect(() => {
    if (status && status.hasSites) {
      setLocation("/app", { replace: true });
    }
  }, [status, setLocation]);

  if (status === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const lockedOut =
    status.isSuperAdmin ||
    (!status.canSelfProvision && !status.hasSites);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#071126] text-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400" />
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-white/5">
              <Rocket className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <div className="text-sm font-black tracking-[0.18em] bg-gradient-to-r from-pink-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">TAYA™</div>
              <div className="hidden text-[11px] text-slate-400 sm:block">Tools • Automation • Your Advantage</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled={signingOut} className="text-slate-300 hover:bg-slate-900 hover:text-white" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{signingOut ? "Signing Out…" : "Sign Out"}</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500">
              <Globe className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Complete your website setup
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
              Confirm a few details and TAYA will connect you to your website workspace right away —
              no waiting on a manual assignment.
            </p>
          </div>

          {status.hasSites && (
            <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <div>
                  <strong>Your website setup is already complete.</strong>
                  <p className="mt-1 text-green-800">Opening your website workspace…</p>
                </div>
              </div>
            </div>
          )}

          {lockedOut && !status.hasSites && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <strong>Your website setup is not complete.</strong>
                  <p className="mt-1 text-amber-800">
                    {status.isSuperAdmin
                      ? "Platform administrators onboard client sites through the admin tools."
                      : "Your account is not currently eligible for self-service setup. Contact FSTS support and we will connect you right away."}
                  </p>
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 font-semibold text-amber-900 underline decoration-amber-300 underline-offset-4 hover:text-amber-700"
                  >
                    Contact FSTS support
                  </a>
                </div>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="setup-name" className="text-sm font-semibold text-slate-900">
                  Your name
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="setup-name"
                    className="pl-10 h-11 bg-white"
                    placeholder="Jordan Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    disabled={lockedOut}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Shown as you in your workspace activity history.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-company" className="text-sm font-semibold text-slate-900">
                  Company / business name
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="setup-company"
                    className="pl-10 h-11 bg-white"
                    placeholder="Acme Dental Studio"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    autoComplete="organization"
                    required
                    disabled={lockedOut}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  This becomes your workspace name in TAYA.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="setup-url" className="text-sm font-semibold text-slate-900">
                  Your website URL
                </Label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="setup-url"
                    className="pl-10 h-11 bg-white"
                    placeholder="https://www.acmedental.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    inputMode="url"
                    autoComplete="url"
                    required
                    disabled={lockedOut}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  The website TAYA will manage for you. Copy it from your browser address bar.
                </p>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-semibold text-slate-900">
                  What kind of website is it?
                </Label>
                <Select
                  value={websiteType}
                  onValueChange={(v) => setWebsiteType(v)}
                  disabled={lockedOut}
                >
                  <SelectTrigger className="h-11 bg-white">
                    <SelectValue placeholder="Choose a website type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBSITE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  TAYA turns on the modules that fit your type. You can change these later.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                    <div>
                      <p>{error}</p>
                      <a
                        href={SUPPORT_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block font-semibold text-red-900 underline decoration-red-300 underline-offset-4 hover:text-red-700"
                      >
                        Contact FSTS support
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {notice && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <p>{notice}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  Your account is verified through your secure TAYA sign-in.
                </p>
                <Button
                  type="submit"
                  disabled={lockedOut || submitting}
                  className="h-11 w-full bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 text-white hover:opacity-90 sm:w-auto"
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  {submitting ? "Creating your workspace…" : "Create my website workspace"}
                </Button>
              </div>
            </div>
          </form>

          {certification && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-lg">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-slate-950">
                    {certification.complete
                      ? "Setup verified"
                      : "Almost there — a few checks did not finish"}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {certification.complete
                      ? "Your website workspace is connected. Opening it now."
                      : (certification.error ??
                        "Your workspace is created and bound to your account, but TAYA could not verify every setup check.")}
                  </p>
                  <ul className="mt-4 grid gap-1.5">
                    {certification.checks.map((c) => (
                      <li key={c.check} className="flex items-center gap-2 text-xs">
                        {c.status === "pass" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                        ) : c.status === "fail" ? (
                          <TriangleAlert className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-slate-400" />
                        )}
                        <span className="font-mono text-[11px] text-slate-700">{c.check}</span>
                        {c.reason && (
                          <span className="truncate text-slate-500">— {c.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      className="bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 text-white hover:opacity-90"
                      onClick={() =>
                        setLocation(`/app/sites/${certification.siteId}`, { replace: true })
                      }
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Open my workspace anyway
                    </Button>
                    <a
                      href={SUPPORT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Contact FSTS support
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            TAYA™ by Full Stack Tech Solutions — Tools • Automation • Your Advantage
          </p>
        </div>
      </main>
    </div>
  );
}
