import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Image as ImageIcon, Plus, Trash2, Sparkles,
  CheckCircle2, AlertTriangle, BarChart3, XCircle, Upload,
  Search, X, Filter, Tag, FolderOpen, ChevronDown, ChevronUp,
  Archive, ArchiveRestore, RefreshCw, Layers, Edit2, Save,
  MapPin, FileImage,
} from "lucide-react";
import { SmartImageUploader } from "@/components/SmartImageUploader";
import { UploadQueue } from "@/components/UploadQueue";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import type { UploadItem } from "@/hooks/useUploadQueue";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

const SIZE_BRACKETS = [
  { label: "< 100 KB", min: 0, max: 100 * 1024 },
  { label: "100–500 KB", min: 100 * 1024, max: 500 * 1024 },
  { label: "500 KB – 2 MB", min: 500 * 1024, max: 2 * 1024 * 1024 },
  { label: "> 2 MB", min: 2 * 1024 * 1024, max: undefined },
];

// ---------------------------------------------------------------------------
// Background compression using requestIdleCallback
// ---------------------------------------------------------------------------

function compressToWebP(
  file: File,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const doWork = () => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const maxW = 2400;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Canvas compression failed")); return; }
            resolve({ blob, width: w, height: h });
          },
          "image/webp",
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("Image load failed")); };
      img.src = objUrl;
    };
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => doWork(), { timeout: 10_000 });
    } else {
      setTimeout(doWork, 0);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isBroken(m: any): boolean {
  return typeof m.url === "string" && m.url.startsWith("data:");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// UsageBadge
// ---------------------------------------------------------------------------

function UsageBadge({ siteId, asset }: { siteId: Id<"sites">; asset: any }) {
  const [open, setOpen] = useState(false);
  const usages = useQuery(
    api.media.getUsage,
    open ? { siteId, mediaAssetId: asset._id } : "skip"
  );
  // Use computedUsageCount from the list query (always accurate, computed server-side).
  // Fall back to the lazy-loaded usages when the popover is open for exact detail.
  const count = asset.computedUsageCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors ${
            count > 0
              ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <Layers className="h-2.5 w-2.5" />
          {count > 0 ? `${count} use${count !== 1 ? "s" : ""}` : "Unused"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold text-slate-800 mb-2">Used in</p>
        {usages === undefined ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : usages.length === 0 ? (
          <p className="text-xs text-slate-500">Not referenced in any content.</p>
        ) : (
          <ul className="space-y-1">
            {usages.map((u, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                <FileImage className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                {u.label}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// MediaFilterBar
// ---------------------------------------------------------------------------

interface FilterState {
  search: string;
  brokenOnly: boolean;
  unusedOnly: boolean;
  showArchived: boolean;
  category: string;
  tag: string;
  sizeBracket: string;
  dateFrom: string;
  dateTo: string;
}

function MediaFilterBar({
  filters,
  onChange,
  taxonomy,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  taxonomy?: { categories: string[]; tags: string[] };
}) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = [
    filters.brokenOnly,
    filters.unusedOnly,
    filters.showArchived,
    !!filters.category,
    !!filters.tag,
    !!filters.sizeBracket,
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="mb-5 space-y-3">
      {/* Search + toggle row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search by filename, alt text, tag…"
            className="pl-9 pr-8"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className={`gap-1.5 ${activeCount > 0 ? "border-primary text-primary" : ""}`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge className="ml-0.5 h-4 min-w-4 text-[10px] px-1 bg-primary text-white border-0">
              {activeCount}
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Quick-toggle chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "brokenOnly" as const, label: "Broken only", color: "red" },
          { key: "unusedOnly" as const, label: "Unused only", color: "amber" },
          { key: "showArchived" as const, label: "Archived", color: "slate" },
        ].map(({ key, label, color }) => {
          const active = filters[key];
          const colorMap: Record<string, string> = {
            red: active ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200 hover:bg-red-50",
            amber: active ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50",
            slate: active ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
          };
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ [key]: !active })}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${colorMap[color]}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Expanded: more filters */}
      {expanded && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600 flex items-center gap-1">
                <FolderOpen className="h-3 w-3" /> Category
              </Label>
              <div className="relative">
                <Input
                  value={filters.category}
                  onChange={(e) => onChange({ category: e.target.value })}
                  placeholder="Filter by category…"
                  list="category-suggestions"
                  className="text-sm"
                />
                <datalist id="category-suggestions">
                  {taxonomy?.categories.map((c) => <option key={c} value={c} />)}
                </datalist>
                {filters.category && (
                  <button type="button" onClick={() => onChange({ category: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tag
              </Label>
              <div className="relative">
                <Input
                  value={filters.tag}
                  onChange={(e) => onChange({ tag: e.target.value })}
                  placeholder="Filter by tag…"
                  list="tag-suggestions"
                  className="text-sm"
                />
                <datalist id="tag-suggestions">
                  {taxonomy?.tags.map((t) => <option key={t} value={t} />)}
                </datalist>
                {filters.tag && (
                  <button type="button" onClick={() => onChange({ tag: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Date from */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Uploaded after</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ dateFrom: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Date to */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Uploaded before</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ dateTo: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>

          {/* Size bracket */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">File size</Label>
            <div className="flex gap-2 flex-wrap">
              {SIZE_BRACKETS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => onChange({ sizeBracket: filters.sizeBracket === b.label ? "" : b.label })}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    filters.sizeBracket === b.label
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear all */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ brokenOnly: false, unusedOnly: false, showArchived: false, category: "", tag: "", sizeBracket: "", dateFrom: "", dateTo: "" })}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssetDetailPanel
// ---------------------------------------------------------------------------

function AssetDetailPanel({
  asset,
  siteId,
  onClose,
  onDelete,
  onArchive,
  onReplace,
  onSaved,
}: {
  asset: any;
  siteId: Id<"sites">;
  onClose: () => void;
  onDelete: (asset: any) => void;
  onArchive: (asset: any, archived: boolean) => void;
  onReplace: (asset: any) => void;
  onSaved: (updated: any) => void;
}) {
  const { toast } = useToast();
  const updateAsset = useMutation(api.media.updateAsset);
  const usages = useQuery(api.media.getUsage, { siteId, mediaAssetId: asset._id });
  const taxonomy = useQuery(api.media.listTaxonomy, { siteId });

  const [altText, setAltText] = useState(asset.altText ?? "");
  const [fileName, setFileName] = useState(asset.fileName ?? "");
  const [category, setCategory] = useState(asset.category ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(asset.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateAsset({ siteId, mediaAssetId: asset._id, altText: altText || undefined, fileName, tags, category: category || undefined });
      toast({ title: "Changes saved" });
      setDirty(false);
      onSaved(updated);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function addTag(t: string) {
    const trimmed = t.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      markDirty();
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
    markDirty();
  }

  const displaySrc = asset.thumbUrl ?? asset.thumbnailUrl ?? asset.url;
  const broken = isBroken(asset);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base truncate pr-4">{asset.fileName}</SheetTitle>
        </SheetHeader>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mb-4">
          {broken ? (
            <div className="w-full h-44 flex flex-col items-center justify-center gap-2 bg-red-50">
              <XCircle className="h-10 w-10 text-red-400" />
              <span className="text-xs text-red-500 font-medium">Cannot be previewed</span>
            </div>
          ) : (
            <img src={displaySrc} alt={asset.altText ?? asset.fileName} className="w-full object-contain max-h-44" />
          )}
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5 mb-4 text-xs text-slate-500">
          {asset.width && asset.height && (
            <span className="bg-slate-100 px-2 py-0.5 rounded">{asset.width}×{asset.height}</span>
          )}
          <span className="bg-slate-100 px-2 py-0.5 rounded">{formatBytes(asset.optimizedSizeBytes ?? asset.sizeBytes)}</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded">{asset.mimeType}</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded">{formatDate(asset.createdAt)}</span>
          {asset.archived && <Badge className="bg-slate-200 text-slate-600 border-0 text-[10px]">Archived</Badge>}
        </div>

        {/* Usage */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-700 mb-1.5">Usage</p>
          {usages === undefined ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : usages.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Not used in any content</p>
          ) : (
            <ul className="space-y-1">
              {usages.map((u, i) => (
                <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                  <FileImage className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  {u.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator className="my-4" />

        {/* Editable fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Filename</Label>
            <Input value={fileName} onChange={(e) => { setFileName(e.target.value); markDirty(); }} className="text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center justify-between">
              Alt Text
              {!altText && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Missing</Badge>}
            </Label>
            <Input
              value={altText}
              onChange={(e) => { setAltText(e.target.value); markDirty(); }}
              placeholder="Describe the image for accessibility…"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Category</Label>
            <div className="relative">
              <Input
                value={category}
                onChange={(e) => { setCategory(e.target.value); markDirty(); }}
                placeholder="e.g. Hero images, Team…"
                list="panel-category-suggestions"
                className="text-sm"
              />
              <datalist id="panel-category-suggestions">
                {taxonomy?.categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-blue-900">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Add tag, press Enter…"
                list="panel-tag-suggestions"
                className="text-sm"
              />
              <datalist id="panel-tag-suggestions">
                {taxonomy?.tags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}
              </datalist>
              <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</Button>
            </div>
          </div>

          {dirty && (
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>

        <Separator className="my-4" />

        {/* Actions */}
        <div className="space-y-2">
          {!broken && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => onReplace(asset)}
            >
              <RefreshCw className="h-4 w-4" /> Replace image
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => onArchive(asset, !asset.archived)}
          >
            {asset.archived
              ? <><ArchiveRestore className="h-4 w-4" /> Unarchive</>
              : <><Archive className="h-4 w-4" /> Archive</>
            }
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 border-red-200"
            onClick={() => onDelete(asset)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>

        {/* Image quality */}
        <div className="mt-4 bg-slate-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Image Quality</p>
          {[
            { label: "Format", good: asset.mimeType?.includes("webp"), goodText: "WebP ✓", badText: "Not WebP" },
            { label: "Alt Text", good: !!asset.altText, goodText: "Present ✓", badText: "Missing" },
            { label: "Size", good: (asset.optimizedSizeBytes ?? asset.sizeBytes) < 500 * 1024, goodText: "Under 500KB ✓", badText: formatBytes(asset.optimizedSizeBytes ?? asset.sizeBytes) },
            { label: "Derivatives", good: !!asset.thumbUrl, goodText: "Ready ✓", badText: "Pending…" },
          ].map(({ label, good, goodText, badText }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{label}</span>
              <span className={good ? "text-green-600 font-medium" : "text-amber-600"}>{good ? goodText : badText}</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// MediaLibrary
// ---------------------------------------------------------------------------

export default function MediaLibrary({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  // ---------------------------------------------------------------------------
  // Filter state — synced to URL search params for bookmarkability
  // ---------------------------------------------------------------------------

  function getFiltersFromUrl(): FilterState {
    const sp = new URLSearchParams(window.location.search);
    return {
      search: sp.get("q") ?? "",
      brokenOnly: sp.get("broken") === "1",
      unusedOnly: sp.get("unused") === "1",
      showArchived: sp.get("archived") === "1",
      category: sp.get("cat") ?? "",
      tag: sp.get("tag") ?? "",
      sizeBracket: sp.get("size") ?? "",
      dateFrom: sp.get("from") ?? "",
      dateTo: sp.get("to") ?? "",
    };
  }

  const [filters, setFilters] = useState<FilterState>(getFiltersFromUrl);

  function updateFilters(patch: Partial<FilterState>) {
    setFilters((prev) => {
      const merged = { ...prev, ...patch };
      // Sync to URL
      const sp = new URLSearchParams(window.location.search);
      const map: [keyof FilterState, string][] = [
        ["search", "q"], ["brokenOnly", "broken"], ["unusedOnly", "unused"],
        ["showArchived", "archived"], ["category", "cat"], ["tag", "tag"],
        ["sizeBracket", "size"], ["dateFrom", "from"], ["dateTo", "to"],
      ];
      for (const [key, param] of map) {
        const val = merged[key];
        if (val === false || val === "" || val === undefined) {
          sp.delete(param);
        } else if (val === true) {
          sp.set(param, "1");
        } else {
          sp.set(param, String(val));
        }
      }
      const qs = sp.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      return merged;
    });
  }

  // Resolve size bracket to bytes
  const bracket = filters.sizeBracket ? SIZE_BRACKETS.find((b) => b.label === filters.sizeBracket) : undefined;

  // Build query args
  const queryArgs = {
    siteId,
    search: filters.search || undefined,
    category: filters.category || undefined,
    tag: filters.tag || undefined,
    brokenOnly: filters.brokenOnly || undefined,
    unusedOnly: filters.unusedOnly || undefined,
    archived: filters.showArchived ? true : false,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo + "T23:59:59").getTime() : undefined,
    sizeMin: bracket?.min,
    sizeMax: bracket?.max,
  };

  const data = useQuery(api.media.list, queryArgs);
  const health = useQuery(api.media.healthStats, { siteId });
  const taxonomy = useQuery(api.media.listTaxonomy, { siteId });
  const createMediaAsset = useMutation(api.media.create);
  const deleteMediaAsset = useMutation(api.media.remove);
  const archiveAsset = useMutation(api.media.archive);
  const replaceAsset = useMutation(api.media.replace);
  const purgeDataUrls = useMutation(api.media.migrateDeleteDataUrls);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);

  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteUsages, setDeleteUsages] = useState<{ module: string; label: string }[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload queue
  const [queueItems, queueActions] = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queue executor ─────────────────────────────────────────────────────────
  const processingIds = useRef<Set<string>>(new Set());

  const processItem = useCallback(async (item: UploadItem) => {
    if (processingIds.current.has(item.id)) return;
    processingIds.current.add(item.id);

    try {
      const isSvg = item.file.type === "image/svg+xml";
      let uploadBlob: Blob;
      let uploadWidth: number | undefined;
      let uploadHeight: number | undefined;
      let uploadMime: string;
      let uploadName: string;

      if (isSvg) {
        uploadBlob = item.file;
        uploadMime = "image/svg+xml";
        uploadName = item.file.name;
        queueActions._setStatus(item.id, "uploading");
      } else {
        queueActions._setStatus(item.id, "compressing");
        queueActions._setProgress(item.id, 5);
        if (item.abortController.signal.aborted) { processingIds.current.delete(item.id); return; }
        const { blob, width, height } = await compressToWebP(item.file);
        if (item.abortController.signal.aborted) { processingIds.current.delete(item.id); return; }
        uploadBlob = blob;
        uploadWidth = width;
        uploadHeight = height;
        uploadMime = "image/webp";
        uploadName = item.file.name.replace(/\.[^.]+$/, ".webp");
        queueActions._setProgress(item.id, 30);
        queueActions._setStatus(item.id, "uploading");
      }

      const uploadUrl = await generateUploadUrl({ siteId, mimeType: uploadMime });
      if (item.abortController.signal.aborted) { processingIds.current.delete(item.id); return; }

      queueActions._setProgress(item.id, 40);
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadMime },
        body: uploadBlob,
        signal: item.abortController.signal,
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
      const { storageId } = await response.json() as { storageId: string };
      queueActions._setProgress(item.id, 85);

      queueActions._setStatus(item.id, "processing");
      await createMediaAsset({
        siteId,
        storageId: storageId as any,
        fileName: uploadName,
        mimeType: uploadMime,
        sizeBytes: item.file.size,
        optimizedSizeBytes: isSvg ? undefined : uploadBlob.size,
        width: uploadWidth,
        height: uploadHeight,
      });

      queueActions._setProgress(item.id, 100);
      queueActions._setStatus(item.id, "done");
    } catch (err: any) {
      if (err?.name === "AbortError" || item.abortController.signal.aborted) {
        queueActions._setStatus(item.id, "cancelled");
      } else {
        queueActions._setStatus(item.id, "failed", err instanceof Error ? err.message : String(err));
      }
    } finally {
      processingIds.current.delete(item.id);
    }
  }, [siteId, generateUploadUrl, createMediaAsset, queueActions]);

  useEffect(() => {
    const pending = queueItems.filter(
      (i) => i.status === "pending" && !processingIds.current.has(i.id)
    );
    for (const item of pending) { processItem(item); }
  }, [queueItems, processItem]);

  // ── Replace queue executor ─────────────────────────────────────────────────
  const replaceProcessingRef = useRef(false);
  const replaceQueueRef = useRef<{ item: UploadItem; target: any } | null>(null);
  const [replaceQueueItems, replaceQueueActions] = useUploadQueue();

  const processReplaceItem = useCallback(async (item: UploadItem, target: any) => {
    if (replaceProcessingRef.current) return;
    replaceProcessingRef.current = true;

    try {
      const isSvg = item.file.type === "image/svg+xml";
      let uploadBlob: Blob;
      let uploadWidth: number | undefined;
      let uploadHeight: number | undefined;
      let uploadMime: string;
      let uploadName: string;

      if (isSvg) {
        uploadBlob = item.file;
        uploadMime = "image/svg+xml";
        uploadName = item.file.name;
        replaceQueueActions._setStatus(item.id, "uploading");
      } else {
        replaceQueueActions._setStatus(item.id, "compressing");
        replaceQueueActions._setProgress(item.id, 5);
        if (item.abortController.signal.aborted) { replaceProcessingRef.current = false; return; }
        const { blob, width, height } = await compressToWebP(item.file);
        if (item.abortController.signal.aborted) { replaceProcessingRef.current = false; return; }
        uploadBlob = blob;
        uploadWidth = width;
        uploadHeight = height;
        uploadMime = "image/webp";
        uploadName = item.file.name.replace(/\.[^.]+$/, ".webp");
        replaceQueueActions._setProgress(item.id, 30);
        replaceQueueActions._setStatus(item.id, "uploading");
      }

      const uploadUrl = await generateUploadUrl({ siteId, mimeType: uploadMime });
      if (item.abortController.signal.aborted) { replaceProcessingRef.current = false; return; }

      replaceQueueActions._setProgress(item.id, 40);
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadMime },
        body: uploadBlob,
        signal: item.abortController.signal,
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
      const { storageId } = await response.json() as { storageId: string };
      replaceQueueActions._setProgress(item.id, 85);

      replaceQueueActions._setStatus(item.id, "processing");
      await replaceAsset({
        siteId,
        mediaAssetId: target._id,
        storageId: storageId as any,
        fileName: uploadName,
        mimeType: uploadMime,
        sizeBytes: item.file.size,
        optimizedSizeBytes: isSvg ? undefined : uploadBlob.size,
        width: uploadWidth,
        height: uploadHeight,
        altText: target.altText,
      });

      replaceQueueActions._setProgress(item.id, 100);
      replaceQueueActions._setStatus(item.id, "done");
      toast({
        title: "Image replaced",
        description: "This record now points to the new image. Any content already using the old URL will continue to show the previous version until that content is re-saved.",
      });
      setReplaceTarget(null);
    } catch (err: any) {
      if (err?.name === "AbortError" || item.abortController.signal.aborted) {
        replaceQueueActions._setStatus(item.id, "cancelled");
      } else {
        replaceQueueActions._setStatus(item.id, "failed", err instanceof Error ? err.message : String(err));
      }
    } finally {
      replaceProcessingRef.current = false;
    }
  }, [siteId, generateUploadUrl, replaceAsset, replaceQueueActions, toast]);

  useEffect(() => {
    if (!replaceTarget) return;
    const pending = replaceQueueItems.filter(
      (i) => i.status === "pending" && !replaceProcessingRef.current
    );
    for (const item of pending) {
      processReplaceItem(item, replaceTarget);
    }
  }, [replaceQueueItems, replaceTarget, processReplaceItem]);

  // ── File selection / drop ──────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({ title: `${f.name}: unsupported type`, variant: "destructive" });
        return false;
      }
      if (f.size > MAX_SIZE_BYTES) {
        toast({ title: `${f.name}: too large (max ${MAX_SIZE_MB}MB)`, variant: "destructive" });
        return false;
      }
      return true;
    });
    if (valid.length > 0) queueActions.enqueue(valid);
  }, [queueActions, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // ── Purge ──────────────────────────────────────────────────────────────────

  async function handlePurge() {
    setIsPurging(true);
    try {
      const result = await purgeDataUrls({ siteId });
      toast({
        title: `Cleaned up ${result.deleted} broken record${result.deleted !== 1 ? "s" : ""}`,
        description: "Legacy base64 images have been removed from your media library.",
      });
    } catch (err) {
      toast({ title: "Cleanup failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsPurging(false);
    }
  }

  // ── SmartImageUploader save (new asset) ───────────────────────────────────

  const handleSaveImage = async (imageData: {
    storageId?: string; url?: string; fileName: string; mimeType: string;
    sizeBytes: number; optimizedSizeBytes?: number; width?: number; height?: number;
    altText?: string; focalX?: number; focalY?: number;
  }) => {
    await createMediaAsset({
      siteId,
      ...(imageData.storageId ? { storageId: imageData.storageId as any } : {}),
      ...(imageData.url ? { url: imageData.url } : {}),
      fileName: imageData.fileName,
      mimeType: imageData.mimeType,
      sizeBytes: imageData.sizeBytes,
      optimizedSizeBytes: imageData.optimizedSizeBytes,
      width: imageData.width,
      height: imageData.height,
      altText: imageData.altText,
      focalX: imageData.focalX,
      focalY: imageData.focalY,
    });
    toast({ title: "Media asset added", description: `${imageData.fileName} uploaded and optimized.` });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  function initiateDelete(asset: any) {
    setDeleteTarget(asset);
    setDeleteUsages(null);
  }

  async function confirmDelete(force = false) {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMediaAsset({ siteId, mediaAssetId: deleteTarget._id, force });
      toast({ title: "Media asset deleted" });
      setDeleteTarget(null);
      setDeleteUsages(null);
      if (selected?._id === deleteTarget._id) setSelected(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Check for structured IN_USE error
      try {
        const parsed = JSON.parse(msg.replace(/^.*?(\{)/, "{").replace(/\}[^}]*$/, "}"));
        if (parsed?.code === "IN_USE") {
          setDeleteUsages(parsed.usages);
          setIsDeleting(false);
          return;
        }
      } catch { /* not JSON */ }
      // Also handle Convex error wrapping
      const jsonMatch = msg.match(/\{"code":"IN_USE"[^}]+\}|\{"code":"IN_USE".*?\}\}/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.usages) { setDeleteUsages(parsed.usages); setIsDeleting(false); return; }
        } catch { /* ignore */ }
      }
      toast({ title: "Couldn't delete asset", description: msg, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  async function handleArchive(asset: any, archived: boolean) {
    try {
      await archiveAsset({ siteId, mediaAssetId: asset._id, archived });
      toast({ title: archived ? "Asset archived" : "Asset unarchived", description: archived ? "Hidden from pickers; URL stays live." : "Now visible in all pickers." });
      if (selected?._id === asset._id) setSelected(null);
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  // ── Replace file input ────────────────────────────────────────────────────
  const replaceFileRef = useRef<HTMLInputElement>(null);

  function handleReplaceFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const valid = arr.filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({ title: `${f.name}: unsupported type`, variant: "destructive" });
        return false;
      }
      if (f.size > MAX_SIZE_BYTES) {
        toast({ title: `${f.name}: too large (max ${MAX_SIZE_MB}MB)`, variant: "destructive" });
        return false;
      }
      return true;
    });
    if (valid.length > 0) replaceQueueActions.enqueue([valid[0]]); // single file replace
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalSize = data?.reduce((s: number, m: any) => s + (m.optimizedSizeBytes ?? m.sizeBytes), 0) ?? 0;
  const missingAlt = data?.filter((m: any) => !m.altText && m.mimeType?.startsWith("image/")).length ?? 0;
  const webpCount = data?.filter((m: any) => m.mimeType?.includes("webp")).length ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            Smart Image Manager™
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-assisted optimization, search, tags, usage tracking, and asset management.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Quick Upload
          </Button>
          <Button onClick={() => setUploaderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Smart Upload
          </Button>
        </div>
      </div>

      {/* Hidden multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Hidden replace input */}
      <input
        ref={replaceFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleReplaceFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Multi-file drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-slate-200 hover:border-primary/40 hover:bg-slate-50"
        }`}
      >
        <Upload className={`h-6 w-6 mx-auto mb-2 transition-colors ${isDragOver ? "text-primary" : "text-slate-300"}`} />
        <p className="text-sm font-medium text-slate-600">
          Drop images here or click to browse — multiple files supported
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          JPG, PNG, WebP, GIF, SVG · max {MAX_SIZE_MB}MB per file · auto-converted to WebP
        </p>
      </div>

      {/* Upload queue panel */}
      {queueItems.length > 0 && (
        <UploadQueue items={queueItems} actions={queueActions} />
      )}

      {/* Replace queue panel */}
      {replaceTarget && replaceQueueItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Replacing "{replaceTarget.fileName}"…</p>
          <UploadQueue items={replaceQueueItems} actions={replaceQueueActions} />
        </div>
      )}

      {/* Stats */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6 mt-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-slate-900">{data.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Ready to Use
            </p>
            <p className="text-2xl font-bold text-green-600">{health?.healthy ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
              {missingAlt > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              Missing Alt Text
            </p>
            <p className={`text-2xl font-bold ${missingAlt > 0 ? "text-amber-600" : "text-green-600"}`}>{missingAlt}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">WebP Optimized</p>
            <p className="text-2xl font-bold text-slate-900">{data.length > 0 ? Math.round((webpCount / data.length) * 100) : 0}%</p>
          </div>
        </div>
      )}

      {/* Broken image health banner */}
      {health && health.broken > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">
              {health.broken} broken image record{health.broken > 1 ? "s" : ""} detected
            </p>
            <p className="text-red-700 text-xs mt-0.5">
              {health.broken} of your {health.total} assets {health.broken === 1 ? "is a" : "are"} legacy base64 record{health.broken > 1 ? "s" : ""} that cannot be served on your live site.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
            onClick={handlePurge}
            disabled={isPurging}
          >
            {isPurging ? "Cleaning…" : "Clean Up"}
          </Button>
        </div>
      )}

      {missingAlt > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">{missingAlt} image{missingAlt > 1 ? "s" : ""} missing alt text</p>
            <p className="text-amber-700 text-xs mt-0.5">Alt text is required for SEO and accessibility. Click an image to add it.</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <MediaFilterBar filters={filters} onChange={updateFilters} taxonomy={taxonomy} />

      {/* Grid */}
      {data === undefined ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : data === null ? (
        <ModuleAccessDenied message="Unable to load Media Library — you may not have access to this site or the media module is disabled." />
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <ImageIcon className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {Object.values(filters).some(Boolean) ? "No images match your filters" : "No media yet"}
          </h3>
          <p className="text-slate-500 text-sm mb-5">
            {Object.values(filters).some(Boolean)
              ? "Try adjusting or clearing your filters."
              : "Drop images above or use Smart Upload for detailed editing and alt text."}
          </p>
          {!Object.values(filters).some(Boolean) && (
            <Button onClick={() => setUploaderOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Smart Upload
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data.map((m: any) => {
            const displaySrc = m.thumbUrl ?? m.thumbnailUrl ?? m.url;
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => setSelected(selected?._id === m._id ? null : m)}
                className={`group relative bg-white border rounded-xl overflow-hidden text-left transition-all ${
                  selected?._id === m._id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-slate-200 hover:border-slate-300"
                } ${m.archived ? "opacity-60" : ""}`}
              >
                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                  {isBroken(m) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50">
                      <XCircle className="h-8 w-8 text-red-400" />
                      <span className="text-[10px] text-red-500 font-medium">Can't be served</span>
                    </div>
                  ) : m.mimeType?.startsWith("image/") ? (
                    <img src={displaySrc} alt={m.altText ?? m.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                  {isBroken(m) && (
                    <div className="absolute top-1.5 left-1.5">
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5">Broken</Badge>
                    </div>
                  )}
                  {m.archived && (
                    <div className="absolute top-1.5 left-1.5">
                      <Badge className="bg-slate-200 text-slate-600 border-0 text-[10px] px-1.5">Archived</Badge>
                    </div>
                  )}
                  {!isBroken(m) && !m.altText && m.mimeType?.startsWith("image/") && !m.archived && (
                    <div className="absolute top-1.5 left-1.5">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5">No alt</Badge>
                    </div>
                  )}
                  {!isBroken(m) && m.mimeType?.includes("webp") && (
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5">WebP</Badge>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-slate-900 truncate">{m.fileName}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-slate-400">{formatBytes(m.optimizedSizeBytes ?? m.sizeBytes)}</p>
                    <UsageBadge siteId={siteId} asset={m} />
                  </div>
                  {m.width && m.height && (
                    <p className="text-[10px] text-slate-400 font-mono">{m.width}×{m.height}</p>
                  )}
                  {(m.category || (m.tags?.length > 0)) && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {m.category && (
                        <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded">{m.category}</span>
                      )}
                      {m.tags?.slice(0, 2).map((t: string) => (
                        <span key={t} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                  {m.altText && <p className="text-[10px] text-slate-400 truncate mt-0.5" title={m.altText}>{m.altText}</p>}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); initiateDelete(m); }}
                  className="absolute bottom-1.5 right-1.5 bg-white/90 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </button>
            );
          })}
        </div>
      )}

      {/* Asset detail panel */}
      {selected && (
        <AssetDetailPanel
          asset={selected}
          siteId={siteId}
          onClose={() => setSelected(null)}
          onDelete={(a) => { initiateDelete(a); setSelected(null); }}
          onArchive={handleArchive}
          onReplace={(a) => { setReplaceTarget(a); setSelected(null); replaceFileRef.current?.click(); }}
          onSaved={(updated) => setSelected(updated)}
        />
      )}

      {/* Replace flow panel — shows when replaceTarget is set and file has been picked */}

      {/* Smart Image Editor (single-file with detailed edit) */}
      <SmartImageUploader
        siteId={siteId}
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSave={handleSaveImage}
        title="Smart Image Manager™"
        context="website media library"
      />

      {/* Delete confirmation (simple) */}
      {deleteTarget && !deleteUsages && (
        <AlertDialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.fileName}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Any pages using this image will show a broken image.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDelete(false)}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation — in-use warning */}
      {deleteTarget && deleteUsages && (
        <AlertDialog open onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteUsages(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                This image is in use
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    <strong>"{deleteTarget?.fileName}"</strong> is referenced in the following content. Deleting it will cause broken images on your live site.
                  </p>
                  <ul className="space-y-1 pl-3 border-l-2 border-red-200">
                    {deleteUsages.map((u, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <FileImage className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                        {u.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-600 font-medium">
                    Consider archiving instead — the file URL stays live, but the image is hidden from all pickers.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={async () => {
                  await handleArchive(deleteTarget, true);
                  setDeleteTarget(null);
                  setDeleteUsages(null);
                }}
              >
                <Archive className="h-4 w-4 mr-2" /> Archive instead
              </Button>
              <AlertDialogAction
                onClick={() => confirmDelete(true)}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting…" : "Force Delete Anyway"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AppLayout>
  );
}
