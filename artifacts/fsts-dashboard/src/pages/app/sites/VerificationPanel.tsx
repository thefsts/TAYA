import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateBridgeSnippet } from "@workspace/web-bridge";
import {
  ShieldCheck,
  Globe,
  Loader2,
  TriangleAlert,
  CheckCircle2,
  Copy,
  RefreshCw,
  ServerCog,
  FileCode2,
  History,
  ExternalLink,
} from "lucide-react";

/**
 * SITE VERIFICATION — /app/sites/:siteId/verification (spec §6, §7, §15).
 *
 * The ownership surface for a DISCOVERED_EXTERNAL site: the owner picks a
 * self-serve verification method (DNS TXT / HTML meta token), TAYA mints a
 * token, and once the token is visible on their domain a single "Check now"
 * runs the LIVE network check. Verified → the site flips to TAYA_CONNECTED
 * and publishing unblocks — server-side, from this same panel.
 *
 * The panel never "bypasses" anything: it renders the server's own verdict
 * (api.publishing.canPublish + api.ownershipVerification.getStatus) and
 * calls the server's own actions. The publish gate itself lives in
 * convex/publishing.ts and cannot be lifted from here.
 */

/* ── Convex HTTP base URL (for the bridge snippet) ───────────────────── */

const CONVEX_HTTP_URL = ((import.meta.env.VITE_CONVEX_URL as string) ?? "")
  .replace("convex.cloud", "convex.site");

/* ── Mode + state presentation ───────────────────────────────────────── */

const MODE_META: Record<string, { label: string; hint: string; className: string }> = {
  TAYA_NATIVE: {
    label: "TAYA Native",
    hint: "Hosted by TAYA — publishing is direct and already enabled.",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  TAYA_CONNECTED: {
    label: "TAYA Connected",
    hint: "Ownership verified — publishing flows through the TAYA Web Bridge.",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  DISCOVERED_EXTERNAL: {
    label: "Discovered — External",
    hint: "Read-only crawl complete. Verify ownership to enable publishing.",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
};

const STATE_META: Record<string, { label: string; className: string }> = {
  unverified: { label: "Ownership unverified", className: "bg-red-100 text-red-800 border-red-300" },
  verification_pending: { label: "Verification pending", className: "bg-amber-100 text-amber-800 border-amber-300" },
  verified: { label: "Ownership verified", className: "bg-green-100 text-green-800 border-green-300" },
};

const METHODS: Array<{ value: string; label: string; icon: typeof Globe; blurb: string }> = [
  {
    value: "dns_txt",
    label: "DNS TXT record",
    icon: Globe,
    blurb: "Add a TXT record on your domain — works for every host and registrar.",
  },
  {
    value: "html_meta_token",
    label: "HTML meta tag",
    icon: FileCode2,
    blurb: "Paste one <meta> tag into your homepage <head> — no DNS access needed.",
  },
  {
    value: "bridge_token",
    label: "Bridge token",
    icon: ServerCog,
    blurb: "For sites already running the TAYA Web Bridge snippet.",
  },
];

function methodLabel(value: string | null): string {
  return METHODS.find((m) => m.value === value)?.label ?? (value ?? "—");
}

/* ── Copy affordance ─────────────────────────────────────────────────── */

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

/* ── Status header card ──────────────────────────────────────────────── */

function StatusCard({ status, canPublish }: { status: any; canPublish: any }) {
  const mode = MODE_META[status?.connectionMode ?? ""] ?? {
    label: status?.connectionMode ?? "Mode pending",
    hint: "Discovery has not confirmed a connection mode yet.",
    className: "bg-slate-100 text-slate-700 border-slate-300",
  };
  const state = STATE_META[status?.state ?? "unverified"];
  const publishing = canPublish ?? null;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold text-slate-900">Site Verification</CardTitle>
          {status?.connectionMode && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${mode.className}`}>
              {mode.label}
            </span>
          )}
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${state.className}`}>
            {state.label}
          </span>
        </div>
        <CardDescription className="text-xs text-slate-500">
          {mode.hint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Publishing</p>
            <p className={`mt-1 text-sm font-semibold ${publishing?.canPublish ? "text-green-700" : "text-amber-700"}`}>
              {publishing == null
                ? "Checking…"
                : publishing.canPublish
                  ? "Enabled — publishing is live"
                  : "Blocked — ownership not verified"}
            </p>
            {publishing?.reason && (
              <p className="mt-1 text-xs leading-5 text-slate-500">{publishing.reason}</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Verification method</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{methodLabel(status?.method)}</p>
            {status?.verifiedAt && (
              <p className="mt-1 text-xs text-slate-500">
                Verified {new Date(status.verifiedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Begin-verification card (method picker + token) ─────────────────── */

function BeginCard({
  siteId,
  status,
  onDone,
}: {
  siteId: Id<"sites">;
  status: any;
  onDone: () => void;
}) {
  const [method, setMethod] = useState("dns_txt");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const begin = useAction(api.ownershipVerification.beginVerification);

  if (status?.state === "verified" || status?.connectionMode === "TAYA_NATIVE") return null;

  const handleBegin = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await begin({ siteId, method: method as "dns_txt" | "html_meta_token" | "bridge_token" });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "TAYA could not start verification. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">Start verification</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Pick how you'll prove you control {status?.domain ?? "your domain"}. You can switch methods any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {METHODS.map((m) => {
            const active = method === m.value;
            const MethodIcon = m.icon;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <MethodIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${active ? "text-primary" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{m.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{m.blurb}</span>
                </span>
                <span
                  className={`mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                    active ? "border-primary bg-primary" : "border-slate-300 bg-white"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <Button
          onClick={handleBegin}
          disabled={submitting}
          className="h-10 w-full bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 text-white hover:opacity-90 sm:w-auto"
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          {submitting ? "Starting…" : "Start verification"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Pending card: instructions + token + Check now ──────────────────── */

function PendingCard({
  siteId,
  status,
  slug,
  onChecked,
}: {
  siteId: Id<"sites">;
  status: any;
  slug: string | null;
  onChecked: (result: any) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const check = useAction(api.ownershipVerification.checkVerification);

  if (status?.state !== "verification_pending") return null;

  const token = status?.token ?? "";
  const instructions: string[] = status?.instructions ?? [];
  const bridgeSnippet =
    slug && CONVEX_HTTP_URL
      ? generateBridgeSnippet({ convexHttpUrl: CONVEX_HTTP_URL, slug })
      : "";

  const handleCheck = async () => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    try {
      const res: any = await check({ siteId });
      if (res?.state === "verified") {
        setResult({ ok: true, message: "Ownership verified — your site is now TAYA Connected. Publishing is enabled." });
        onChecked(res);
      } else {
        setResult({
          ok: false,
          message: res?.failureReason ?? "The token was not found yet. DNS and page updates can take a few minutes — try again shortly.",
        });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message ?? "The check could not run. Please try again." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <History className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-base font-semibold text-slate-900">
            Finish verification — {methodLabel(status?.method)}
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500">
          Complete the step below on your side, then press "Check now". TAYA runs a live check against your domain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your verification token</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-slate-200 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 break-all">
              {token || "—"}
            </code>
            {token && <CopyButton text={token} label="Copy token" />}
          </div>
        </div>

        {/* Method instructions */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</p>
          <ol className="mt-1.5 space-y-1.5">
            {instructions.map((line, i) => (
              <li
                key={i}
                className={
                  line.startsWith("    ")
                    ? "rounded-md bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-800 break-all whitespace-pre-wrap"
                    : "text-sm leading-6 text-slate-700"
                }
              >
                {line}
              </li>
            ))}
          </ol>
        </div>

        {/* Bridge snippet (bridge_token method context + universal copy) */}
        {slug && bridgeSnippet && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              TAYA Web Bridge snippet (for published content)
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Paste this once in your site template. It serves published values and forwards edit clicks to TAYA.
              The token above is also accepted as <code className="bg-slate-100 px-1 rounded text-[11px]">data-taya-token</code> on the script tag.
            </p>
            <div className="relative mt-1.5">
              <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                <code>{bridgeSnippet}</code>
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={bridgeSnippet} label="Copy snippet" />
              </div>
            </div>
          </div>
        )}

        {/* Check now */}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCheck} disabled={checking} className="h-10">
              {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {checking ? "Checking your domain…" : "Check now"}
            </Button>
            {status?.attempts > 0 && (
              <span className="text-xs text-slate-400">
                {status.attempts} check{status.attempts === 1 ? "" : "s"} so far
                {status.lastCheckedAt ? ` · last ${new Date(status.lastCheckedAt).toLocaleString()}` : ""}
              </span>
            )}
          </div>

          {status?.lastFailureReason && !result && (
            <p className="text-xs leading-5 text-amber-700">Last check: {status.lastFailureReason}</p>
          )}

          {result && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                result.ok
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
              role={result.ok ? "status" : "alert"}
            >
              <div className="flex items-start gap-2">
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                )}
                <p>{result.message}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Verified card ───────────────────────────────────────────────────── */

function VerifiedCard({ status, slug }: { status: any; slug: string | null }) {
  if (status?.state !== "verified") return null;

  const contentUrl = slug && CONVEX_HTTP_URL
    ? `${CONVEX_HTTP_URL}/api/bridge/content?slug=${encodeURIComponent(slug)}`
    : null;

  return (
    <Card className="border-green-200 bg-green-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <CardTitle className="text-base font-semibold text-slate-900">Ownership verified — TAYA Connected</CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500">
          Your site publishes through the TAYA Web Bridge. Verified via {methodLabel(status?.method)}
          {status?.verifiedAt ? ` on ${new Date(status.verifiedAt).toLocaleString()}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contentUrl && (
          <div className="rounded-lg border border-green-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Published content endpoint
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              The bridge fetches your published values from this endpoint:
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-slate-200 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 break-all">
                {contentUrl}
              </code>
              <CopyButton text={contentUrl} label="Copy URL" />
              <a
                href={contentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Evidence log ────────────────────────────────────────────────────── */

function EvidenceCard({ evidence }: { evidence: any[] }) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <CardTitle className="text-base font-semibold text-slate-900">Verification history</CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500">
          Every check TAYA has run for this site — attempts, methods, and evidence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {evidence.map((row: any) => (
            <li key={row._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    row.result === "verified"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-red-100 text-red-800 border-red-300"
                  }`}
                >
                  {row.result === "verified" ? "VERIFIED" : "FAILED"}
                </span>
                <span className="text-xs font-semibold text-slate-700">{methodLabel(row.method)}</span>
                <span className="text-xs text-slate-400">
                  {row.checkedAt ? new Date(row.checkedAt).toLocaleString() : ""}
                </span>
              </div>
              {row.failureReason && (
                <p className="mt-1 text-xs leading-5 text-amber-700">{row.failureReason}</p>
              )}
              {row.evidence && (
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{row.evidence}</p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function VerificationPanel() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);

  const site = useQuery(api.sites.get, { siteId });
  const status = useQuery(api.ownershipVerification.getStatus, { siteId });
  const canPublish = useQuery(api.publishing.canPublish, { siteId });

  const slug = (site as any)?.slug ?? null;

  return (
    <AppLayout siteId={siteId} pageContext="Site Verification">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Site Verification</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Prove you control {(site as any)?.domain ?? "your site"} to unlock publishing. TAYA never publishes to a
          site it hasn't verified — this protects you and your visitors.
        </p>
      </div>

      {status === undefined || site === undefined ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl bg-slate-200" />
          <Skeleton className="h-64 rounded-2xl bg-slate-200" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          {checkNotice && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <p>{checkNotice}</p>
              </div>
            </div>
          )}

          <StatusCard status={status} canPublish={canPublish} />

          <BeginCard
            siteId={siteId}
            status={status}
            onDone={() => setRefreshKey((k) => k + 1)}
          />

          <PendingCard
            siteId={siteId}
            status={status}
            slug={slug}
            onChecked={(res) => {
              setCheckNotice(
                "Ownership verified — your site is now TAYA Connected and publishing is enabled.",
              );
              setRefreshKey((k) => k + 1);
            }}
          />

          <VerifiedCard status={status} slug={slug} />

          <EvidenceCard evidence={status?.evidence ?? []} />
        </div>
      )}
    </AppLayout>
  );
}
