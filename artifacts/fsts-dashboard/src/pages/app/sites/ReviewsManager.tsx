import { useState } from "react";
import { generateEmbedSnippet } from "@workspace/embed-widget";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  EyeOff,
  Pin,
  Tag,
  Globe,
  AlertTriangle,
  Settings2,
  Copy,
  Check,
  Code2,
  LayoutGrid,
  Zap,
} from "lucide-react";

/* ── Convex HTTP base URL (for embed snippets) ──────────────────────────── */

const CONVEX_HTTP_URL = ((import.meta.env.VITE_CONVEX_URL as string) ?? "")
  .replace("convex.cloud", "convex.site");

/* ── Provider metadata ──────────────────────────────────────────────────── */

const PROVIDERS = [
  {
    id: "google",
    label: "Google Business Profile",
    description: "Import reviews from your Google Business listing.",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    configFields: [
      { key: "placeId", label: "Place ID", placeholder: "ChIJN1t_tDeuEmsRUsoyG83frY4" },
      { key: "apiKey", label: "Google API Key", placeholder: "AIzaSy…" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Import recommendations from your Facebook Page.",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    configFields: [
      { key: "pageId", label: "Page ID", placeholder: "123456789012345" },
      { key: "accessToken", label: "Page Access Token", placeholder: "EAA…" },
    ],
  },
  {
    id: "yelp",
    label: "Yelp",
    description: "Import reviews from your Yelp business page.",
    color: "text-red-700",
    bgColor: "bg-orange-50 border-orange-200",
    configFields: [
      { key: "businessId", label: "Business ID / Alias", placeholder: "my-business-name-city" },
      { key: "apiKey", label: "Yelp API Key", placeholder: "your-yelp-api-key" },
    ],
  },
] as const;

type ProviderId = "google" | "facebook" | "yelp";

function providerMeta(id: string) {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/* ── Star display ───────────────────────────────────────────────────────── */

function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`}
        />
      ))}
    </div>
  );
}

/* ── Review status badge ────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
  if (status === "hidden") return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Hidden</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>;
}

/* ── Connect source dialog ──────────────────────────────────────────────── */

const REFRESH_INTERVAL_OPTIONS = [
  { label: "Every 6 hours",  value: 6 },
  { label: "Every 12 hours", value: 12 },
  { label: "Every 24 hours", value: 24 },
  { label: "Every 48 hours", value: 48 },
];

function ConnectDialog({
  open,
  provider,
  onClose,
  onConnect,
}: {
  open: boolean;
  provider: (typeof PROVIDERS)[number] | null;
  onClose: () => void;
  onConnect: (config: Record<string, string>, autoRefresh: boolean, refreshIntervalHours: number) => Promise<void>;
}) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(24);
  const [saving, setSaving] = useState(false);

  function handleField(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onConnect(config, autoRefresh, refreshIntervalHours);
      setConfig({});
      setAutoRefresh(true);
      setRefreshIntervalHours(24);
    } finally {
      setSaving(false);
    }
  }

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {provider.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {provider.configFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}</Label>
              <Input
                placeholder={field.placeholder}
                value={config[field.key] ?? ""}
                onChange={(e) => handleField(field.key, e.target.value)}
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="text-sm font-medium">Auto-refresh</Label>
              <p className="text-xs text-slate-500">Automatically pull new reviews on a schedule.</p>
            </div>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
          {autoRefresh && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Refresh interval</Label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={refreshIntervalHours}
                onChange={(e) => setRefreshIntervalHours(Number(e.target.value))}
              >
                {REFRESH_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Category tag dialog ────────────────────────────────────────────────── */

function CategoryDialog({
  open,
  currentCategory,
  onClose,
  onSave,
}: {
  open: boolean;
  currentCategory: string | null;
  onClose: () => void;
  onSave: (category: string | undefined) => Promise<void>;
}) {
  const [value, setValue] = useState(currentCategory ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(value.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tag Review</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Label>Category / Tag</Label>
          <Input
            className="mt-1.5"
            placeholder="e.g. Service, Quality, Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── CDN snippet generator ──────────────────────────────────────────────── */

function generateCdnSnippet(convexHttpUrl: string, slug: string): string {
  const src = `${convexHttpUrl}/widget/reviews.js?slug=${encodeURIComponent(slug)}`;
  return `<!-- FSTS Website Reviews Widget™ -->
<div id="fsts-reviews-widget"></div>
<script src="${src}" defer><\/script>`;
}

/* ── Copy button ────────────────────────────────────────────────────────── */

function CopyButton({ text, className, onCopy }: { text: string; className?: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    });
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

/* ── Live widget preview ─────────────────────────────────────────────────── */

const LAYOUT_CLASSES: Record<string, string> = {
  grid: "grid grid-cols-1 sm:grid-cols-2 gap-3",
  list: "flex flex-col gap-3",
  masonry: "columns-2 gap-3",
  carousel: "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory",
  slider: "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory",
};

const PROVIDER_BADGE_CLASSES: Record<string, string> = {
  google: "bg-red-50 text-red-600",
  facebook: "bg-blue-50 text-blue-600",
  yelp: "bg-orange-50 text-orange-700",
};

function WidgetPreviewCard({
  review,
  showBadge,
  layout,
}: {
  review: any;
  showBadge: boolean;
  layout: string;
}) {
  const isHorizontal = layout === "carousel" || layout === "slider";
  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5 shadow-sm${isHorizontal ? " flex-none w-64 snap-start" : ""}${layout === "masonry" ? " break-inside-avoid mb-3" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-slate-900 text-sm">{review.reviewerName}</span>
        {showBadge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PROVIDER_BADGE_CLASSES[review.provider] ?? "bg-slate-100 text-slate-600"}`}>
            {review.provider}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
        ))}
      </div>
      {review.text && (
        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{review.text}</p>
      )}
      <span className="text-[11px] text-slate-400">{new Date(review.reviewDate).toLocaleDateString()}</span>
    </div>
  );
}

function ReviewsWidgetPreview({
  reviews,
  settings,
}: {
  reviews: any[];
  settings: any;
}) {
  const layout = settings?.layout ?? "grid";
  const minRating = settings?.minRating ?? 4;
  const maxCount = settings?.maxPerPage ?? 12;
  const showBadge = settings?.showProviderBadge ?? true;
  const featuredOnly = settings?.featuredOnly ?? false;
  const categoryFilter = (settings?.categoryFilter ?? "").trim();

  const visible = reviews
    .filter((r) => r.status === "approved")
    .filter((r) => r.rating >= minRating)
    .filter((r) => !featuredOnly || r.pinned)
    .filter((r) => !categoryFilter || r.category === categoryFilter)
    .slice(0, maxCount);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
        No approved reviews match the current settings.
      </div>
    );
  }

  const wrapClass = LAYOUT_CLASSES[layout] ?? LAYOUT_CLASSES.grid;

  return (
    <div className={layout === "masonry" ? "columns-2 gap-3" : wrapClass}>
      {visible.map((r: any) => (
        <WidgetPreviewCard key={r._id} review={r} showBadge={showBadge} layout={layout} />
      ))}
    </div>
  );
}

/* ── Embed widget section ────────────────────────────────────────────────── */

type EmbedTab = "cdn" | "inline";

function EmbedWidgetSection({
  convexHttpUrl,
  slug,
  settings,
  reviews,
  cdnMigrated,
  inlineEverUsed,
  onMarkMigrated,
  onInlineCopied,
}: {
  convexHttpUrl: string;
  slug: string;
  settings: any;
  reviews: any[];
  cdnMigrated: boolean;
  inlineEverUsed: boolean;
  onMarkMigrated: () => void;
  onInlineCopied: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<EmbedTab>("cdn");

  const cdnSnippet = generateCdnSnippet(convexHttpUrl, slug);
  const inlineSnippet = generateEmbedSnippet(convexHttpUrl, slug, settings ?? {});
  const isPlaceholder = !slug || !convexHttpUrl;

  const minRating = settings?.minRating ?? 4;
  const featuredOnly = settings?.featuredOnly ?? false;
  const categoryFilter = (settings?.categoryFilter ?? "").trim();
  const approvedCount = reviews
    .filter((r) => r.status === "approved")
    .filter((r) => r.rating >= minRating)
    .filter((r) => !featuredOnly || r.pinned)
    .filter((r) => !categoryFilter || r.category === categoryFilter)
    .length;

  const activeSnippet = activeTab === "cdn" ? cdnSnippet : inlineSnippet;

  return (
    <section>
      <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <Code2 className="h-4 w-4 text-slate-400" />
        Embed Widget
      </h2>
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800">Copy &amp; paste into your website</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Drop the snippet anywhere in your page HTML. No build step or framework required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPlaceholder && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Site slug or Convex URL not available — save your site settings first.
            </div>
          )}

          {/* CDN upgrade notice — only shown for sites that have copied the inline snippet and haven't migrated yet */}
          {inlineEverUsed && !cdnMigrated && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2.5">
              <Zap className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">Upgrade to the CDN script for automatic updates</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Sites using the old inline snippet won't pick up display-setting changes automatically.
                  Swap in the <strong>CDN script</strong> tab's one-liner and you'll never need to re-paste.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                onClick={onMarkMigrated}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Mark as upgraded
              </Button>
            </div>
          )}

          {!isPlaceholder && approvedCount === 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>0 approved reviews</strong> match the current display settings — the widget will be invisible on your website.{" "}
                <a
                  href="#review-moderation"
                  className="underline underline-offset-2 hover:text-amber-900 font-medium"
                >
                  Approve reviews below
                </a>{" "}
                to make the widget visible.
              </span>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-md w-fit">
            <button
              onClick={() => setActiveTab("cdn")}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === "cdn"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              CDN script
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                recommended
              </span>
              {!cdnMigrated && (
                <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  new
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("inline")}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === "inline"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Inline snippet
            </button>
          </div>

          {/* Tab description */}
          {activeTab === "cdn" ? (
            <p className="text-xs text-slate-500 -mt-1">
              A single stable{" "}
              <code className="bg-slate-100 px-1 rounded text-[11px]">&lt;script src&gt;</code>{" "}
              tag. Layout, rating filter, and count changes update automatically — no re-paste needed.
            </p>
          ) : (
            <p className="text-xs text-slate-500 -mt-1">
              The full widget code baked into one block. Re-copy whenever you change display settings.
            </p>
          )}

          {/* Snippet code block */}
          <div className="relative">
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
              <code>{activeSnippet}</code>
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton
                text={activeSnippet}
                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                onCopy={activeTab === "inline" ? onInlineCopied : undefined}
              />
            </div>
          </div>

          {/* Config summary (shown for both tabs) */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5">
              Layout: <strong>{settings?.layout ?? "grid"}</strong>
            </span>
            <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5">
              Min rating: <strong>{settings?.minRating ?? 4}★</strong>
            </span>
            <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5">
              Max: <strong>{settings?.maxPerPage ?? 12} reviews</strong>
            </span>
            {settings?.showProviderBadge !== false && (
              <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5">Provider badges: <strong>on</strong></span>
            )}
            {settings?.featuredOnly && (
              <span className="bg-amber-100 text-amber-700 rounded px-2 py-0.5">Featured only</span>
            )}
            {settings?.categoryFilter && (
              <span className="bg-violet-100 text-violet-700 rounded px-2 py-0.5">
                Category: <strong>{settings.categoryFilter}</strong>
              </span>
            )}
          </div>

          {/* Live preview toggle */}
          <div className="border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowPreview((v) => !v)}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              {showPreview ? "Hide preview" : "Preview widget layout"}
            </Button>
          </div>

          {showPreview && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-xs text-slate-500 mb-3">
                Showing approved reviews with current display settings — this is how they will look on your website.
              </p>
              <ReviewsWidgetPreview reviews={reviews} settings={settings} />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function ReviewsManager({ params: routeParams }: { params?: { siteId: string } }) {
  const wouter = useParams<{ siteId: string }>();
  const siteId = (routeParams?.siteId ?? wouter.siteId) as Id<"sites">;
  const { toast } = useToast();

  const site = useQuery(api.sites.get, { siteId });
  const sources = useQuery(api.reviews.listSources, { siteId });
  const reviews = useQuery(api.reviews.listReviews, { siteId });
  const displaySettings = useQuery(api.reviews.getDisplaySettings, { siteId });

  const addSource = useMutation(api.reviews.addSource);
  const removeSource = useMutation(api.reviews.removeSource);
  const approveReview = useMutation(api.reviews.approveReview);
  const hideReview = useMutation(api.reviews.hideReview);
  const pinReview = useMutation(api.reviews.pinReview);
  const setCategory = useMutation(api.reviews.setCategory);
  const updateDisplaySettings = useMutation(api.reviews.updateDisplaySettings);
  const triggerSync = useMutation(api.reviews.triggerSync);
  const markCdnMigrated = useMutation(api.sites.markReviewsWidgetCdnMigrated);
  const markInlineUsed = useMutation(api.sites.markReviewsWidgetInlineUsed);

  const [connectProvider, setConnectProvider] = useState<(typeof PROVIDERS)[number] | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [categoryReviewId, setCategoryReviewId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const connectedProviderIds = new Set((sources ?? []).map((s: any) => s.provider));

  async function handleConnect(config: Record<string, string>, autoRefresh: boolean, refreshIntervalHours: number) {
    if (!connectProvider) return;
    try {
      await addSource({ siteId, provider: connectProvider.id, config, autoRefresh, refreshIntervalHours });
      toast({ title: `${connectProvider.label} connected` });
      setConnectProvider(null);
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDisconnect() {
    if (!disconnectId) return;
    try {
      await removeSource({ siteId, sourceId: disconnectId as Id<"reviewSources"> });
      toast({ title: "Source disconnected" });
      setDisconnectId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync({ siteId });
      toast({ title: "Sync scheduled", description: "Reviews will refresh in a few seconds." });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove(reviewId: string) {
    try {
      await approveReview({ siteId, reviewId: reviewId as Id<"importedReviews"> });
      toast({ title: "Review approved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleHide(reviewId: string) {
    try {
      await hideReview({ siteId, reviewId: reviewId as Id<"importedReviews"> });
      toast({ title: "Review hidden" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handlePin(reviewId: string, pinned: boolean) {
    try {
      await pinReview({ siteId, reviewId: reviewId as Id<"importedReviews">, pinned });
      toast({ title: pinned ? "Review pinned" : "Review unpinned" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleSetCategory(category: string | undefined) {
    if (!categoryReviewId) return;
    try {
      await setCategory({ siteId, reviewId: categoryReviewId as Id<"importedReviews">, category });
      toast({ title: "Category updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDisplaySetting(key: string, value: unknown) {
    try {
      await updateDisplaySettings({ siteId, [key]: value } as any);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filteredReviews = (reviews ?? []).filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (providerFilter !== "all" && r.provider !== providerFilter) return false;
    return true;
  });

  const categoryReview = reviews?.find((r: any) => r._id === categoryReviewId);

  return (
    <AppLayout siteId={siteId} pageContext="reviews">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website Reviews Module™</h1>
          <p className="text-slate-500 mt-1">
            Import and display reviews from Google, Facebook, and Yelp on your website.
            <span className="ml-1 text-xs text-slate-400">(Display only — review responses belong in Operon CRM™)</span>
          </p>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={syncing || (sources ?? []).length === 0}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          Sync Now
        </Button>
      </div>

      <div className="space-y-8">
        {/* Connected Sources */}
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Review Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PROVIDERS.map((p) => {
              const connected = connectedProviderIds.has(p.id);
              const source = (sources ?? []).find((s: any) => s.provider === p.id);
              return (
                <Card key={p.id} className={`border ${connected ? p.bgColor : "border-slate-200"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className={`text-sm font-semibold ${connected ? p.color : "text-slate-700"}`}>
                          {p.label}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{p.description}</CardDescription>
                      </div>
                      {connected && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Connected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {connected && source ? (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-500">
                          {source.lastSyncedAt
                            ? `Last synced ${new Date(source.lastSyncedAt).toLocaleDateString()}`
                            : "Not yet synced"}
                        </div>
                        {source.status !== "error" && source.lastSyncStats && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {source.lastSyncStats.inserted > 0 && (
                              <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                +{source.lastSyncStats.inserted} new
                              </span>
                            )}
                            {source.lastSyncStats.updated > 0 && (
                              <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                                {source.lastSyncStats.updated} updated
                              </span>
                            )}
                            {source.lastSyncStats.removed > 0 && (
                              <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                                −{source.lastSyncStats.removed} removed
                              </span>
                            )}
                            {source.lastSyncStats.inserted === 0 && source.lastSyncStats.updated === 0 && source.lastSyncStats.removed === 0 && (
                              <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                No changes
                              </span>
                            )}
                          </div>
                        )}
                        {source.status === "error" && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {source.errorMessage ?? "Sync error"}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setDisconnectId(source._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        variant="outline"
                        onClick={() => setConnectProvider(p)}
                        disabled={sources === undefined}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Display Settings */}
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-400" />
            Display Settings
          </h2>
          {displaySettings === undefined ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : (
            <Card className="border-slate-200">
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Layout</Label>
                    <Select
                      value={(displaySettings as any).layout ?? "grid"}
                      onValueChange={(v) => handleDisplaySetting("layout", v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["carousel", "grid", "masonry", "slider", "list"].map((l) => (
                          <SelectItem key={l} value={l} className="capitalize">{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Minimum Star Rating</Label>
                    <Select
                      value={String((displaySettings as any).minRating ?? 4)}
                      onValueChange={(v) => handleDisplaySetting("minRating", Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} star{n !== 1 ? "s" : ""} & up</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Max Reviews Per Page</Label>
                    <Select
                      value={String((displaySettings as any).maxPerPage ?? 12)}
                      onValueChange={(v) => handleDisplaySetting("maxPerPage", Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[6, 9, 12, 18, 24].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500">Featured only</Label>
                      <Switch
                        checked={(displaySettings as any).featuredOnly ?? false}
                        onCheckedChange={(v) => handleDisplaySetting("featuredOnly", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500">Show provider badge</Label>
                      <Switch
                        checked={(displaySettings as any).showProviderBadge ?? true}
                        onCheckedChange={(v) => handleDisplaySetting("showProviderBadge", v)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                    <Label className="text-xs text-slate-500">Category filter <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Input
                      className="h-9 text-sm max-w-sm"
                      placeholder="e.g. Service, Quality, Value"
                      value={(displaySettings as any).categoryFilter ?? ""}
                      onChange={(e) => handleDisplaySetting("categoryFilter", e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Leave blank to show all categories. When set, the embed widget will only show reviews tagged with this exact category.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Review List */}
        <section id="review-moderation">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">Imported Reviews</h2>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="yelp">Yelp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {reviews === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : filteredReviews.length === 0 ? (
            <Card className="border-slate-200 border-dashed">
              <CardContent className="py-12 text-center">
                <Globe className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No reviews imported yet</p>
                <p className="text-slate-400 text-sm mt-1">
                  {connectedProviderIds.size === 0
                    ? "Connect a review source above, then click Sync Now."
                    : "Click Sync Now to import reviews from your connected sources."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((review: any) => {
                const meta = providerMeta(review.provider);
                return (
                  <Card key={review._id} className={`border-slate-200 ${review.pinned ? "ring-1 ring-primary/20" : ""}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-slate-900 text-sm">{review.reviewerName}</span>
                            <Stars rating={review.rating} />
                            <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                            {review.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                            {review.category && (
                              <Badge variant="outline" className="text-[10px] h-5">{review.category}</Badge>
                            )}
                            <StatusBadge status={review.status} />
                          </div>
                          {review.text && (
                            <p className="text-sm text-slate-600 line-clamp-3">{review.text}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1.5">
                            {new Date(review.reviewDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {review.status !== "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Approve"
                              onClick={() => handleApprove(review._id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {review.status !== "hidden" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                              title="Hide"
                              onClick={() => handleHide(review._id)}
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 ${review.pinned ? "text-primary" : "text-slate-400 hover:text-slate-600"}`}
                            title={review.pinned ? "Unpin" : "Pin"}
                            onClick={() => handlePin(review._id, !review.pinned)}
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                            title="Tag"
                            onClick={() => setCategoryReviewId(review._id)}
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Embed Widget */}
        {displaySettings !== undefined && site !== undefined ? (
          <EmbedWidgetSection
            convexHttpUrl={CONVEX_HTTP_URL}
            slug={(site as any)?.slug ?? ""}
            settings={displaySettings}
            reviews={reviews ?? []}
            cdnMigrated={(site as any)?.reviewsWidgetCdnMigrated === true}
            inlineEverUsed={(site as any)?.reviewsWidgetInlineEverUsed === true}
            onMarkMigrated={async () => {
              try {
                await markCdnMigrated({ siteId });
                toast({ title: "Marked as upgraded", description: "The upgrade notice won't appear again for this site." });
              } catch (err: any) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
              }
            }}
            onInlineCopied={async () => {
              try {
                await markInlineUsed({ siteId });
              } catch {
              }
            }}
          />
        ) : (
          <Skeleton className="h-48 rounded-lg" />
        )}
      </div>

      {/* Dialogs */}
      <ConnectDialog
        open={!!connectProvider}
        provider={connectProvider}
        onClose={() => setConnectProvider(null)}
        onConnect={handleConnect}
      />

      <AlertDialog open={!!disconnectId} onOpenChange={(v) => !v && setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the source and delete all imported reviews from this provider. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDisconnect}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryDialog
        open={!!categoryReviewId}
        currentCategory={categoryReview?.category ?? null}
        onClose={() => setCategoryReviewId(null)}
        onSave={handleSetCategory}
      />
    </AppLayout>
  );
}
