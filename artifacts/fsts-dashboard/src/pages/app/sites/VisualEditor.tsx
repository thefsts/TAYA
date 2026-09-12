/**
 * PHASE 3 — CLIENT VISUAL WEBSITE EDITOR.
 *
 * Pages → click a real website element in the live preview → edit →
 * Save Draft → Preview → Publish → History/Restore. Clients see their
 * website, never keys/IDs/JSON/HTML/tokens (§16/§26).
 *
 * ARCHITECTURE (mirrors convex/lib/editorFrame.ts + convex/http.ts):
 *  - The iframe loads GET /api/editor/frame?token&path from the CONVEX
 *    SITE origin. Each load mints a fresh single-use token via
 *    api.editor.createFrameToken (burn-first: replays are dead).
 *  - The served frame is the customer's REAL page, editor-safe: scripts
 *    stripped, nav neutralized, §5 keys stamped as data-taya-edit.
 *  - DRAFTS NEVER enter the frame fetch. Draft values reach the frame
 *    only via postMessage from this authenticated parent. The live site
 *    only changes on Publish (server-side authority gate).
 *
 * PROTOCOL (must match the bootstrap in convex/lib/editorFrame.ts):
 *   parent → frame : {source:"taya-editor-parent", kind:"apply-draft",
 *                     entries:{key:{value,type}}}
 *                     {…, kind:"ping"}
 *   frame → parent : {source:"taya-editor", kind:"element-click" |
 *                     "navigate" | "ready" | "pong" | "preview-applied", …}
 *
 * HONEST-EDITING RULE: saveDraft is a VALUE overlay — text, images, and
 * link destinations are persisted. Structural item ops (remove/reorder)
 * are NOT persisted server-side, so this UI never pretends they are:
 * repeatable items are listed for click-to-edit of their fields only.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePickerField } from "@/components/ImagePickerField";
import {
  // §6 zone contract + §2/§3 validation — the CANONICAL pure libs the
  // server uses (same functions, same verdicts; the @convex alias maps to
  // ../../convex/*, so the dashboard and the mutations can never drift).
  ZONE_ALLOWED_KINDS, validateBlock,
  type ZoneId, type BlockContent, type InsertKind,
} from "@convex/lib/editorZones";
import { classifyLink } from "@convex/lib/safeLinks";
import { parseVideoUrl } from "@convex/lib/videoEmbeds";
import { renderBlockHtml, renderZoneHtml } from "@convex/lib/editorBlocks";
// Client language (never engine vocabulary in client copy).
import { ADD_ACTIONS, wherePhrase, kindHeader, unavailableSentence, pluralKind, areaName } from "@/lib/editorClientLanguage";
// §5 key grammar — the canonical page-segment derivation the crawl stamps
// (import-only use of the discovery engine, per the §9 boundary).
import { pageKeySegment } from "@convex/lib/discovery/html";
import {
  ExternalLink, Eye, History, Loader2, Lock,
  Monitor, Pencil, RefreshCw, Save, Send, Smartphone, Tablet,
  Undo2,
  Plus, Trash2, RotateCcw, ArrowUp, ArrowDown,
  Video, FileText, Type, Megaphone, HelpCircle, FileDown, Link2, ClipboardList,
} from "lucide-react";

// Convex site origin (convex.cloud → convex.site), same derivation as
// VerificationPanel (Phase 2 contract). Read at CALL time (not module
// scope) so the frame URL always derives from the active deployment env.
const convexSiteOrigin = () =>
  ((import.meta.env.VITE_CONVEX_URL as string) ?? "").replace("convex.cloud", "convex.site");

type EntryMap = Record<string, {
  type: string;
  discovered?: string;
  published?: string;
  draft?: string;
}>;

type ElementInfo = {
  key: string;
  type: string;
  label: string;
  alt: string | null;
  text: string | null;
  href: string | null;
  itemId: string | null;
  contentKind: string | null;
};

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

type WorkflowState =
  | "saved" | "unsaved" | "draft" | "publishing" | "published" | "blocked";

type PageSummary = { path: string; label: string; title: string; keyCount: number };

type RevisionSummary = {
  revisionId: string;
  publishedAt: number | null;
  publishedBy: string | undefined;
  keyCount: number;
  summary: string;
};

/** api.editorZones.listZoneBlocks row (client-safe projection).
 * content/published are the VALIDATED shapes the server stores
 * (validateBlock runs inside every write) — typed as BlockContent, not
 * loose records, so consumers never need dishonest round-trip casts. */
type ZoneBlockRow = {
  id: string;
  pagePath: string;
  zone: string;
  kind: string;
  order: number;
  content: BlockContent | null;
  published: Record<string, unknown> | null;
  pendingDelete: boolean;
  updatedAt: number;
};

/** api.editorZones.structuralsFor row. */
type StructuralRow = {
  pagePath: string;
  itemOrder: string[] | null;
  hiddenItems: string[] | null;
  publishedItemOrder: string[] | null;
  publishedHiddenItems: string[] | null;
  updatedAt: number;
};

/** api.editorZones.zoneSummaries page row. */
type ZonePageRow = {
  path: string;
  label: string;
  zones: Array<{ zone: string; label: string; kinds: string[] }>;
};

/** api.downloads.list row (PDF picker source, §4 managed resources). */
type DownloadRow = { id: string; title: string; url: string; format?: string; isActive: boolean };

/** api.forms.list row (§5 — routed to the EXISTING FormBuilder). */
type FormRow = { id: string; name: string; status: string };

const KIND_LABELS: Record<string, string> = {
  text: "Text", image: "Image", button: "Button", video: "Video",
  pdf: "PDF", cta: "Call to action", faq_item: "FAQ item", link: "Link",
};

const KIND_ICONS: Record<string, typeof Type> = {
  text: Type, image: FileText, button: Link2, video: Video,
  pdf: FileDown, cta: Megaphone, faq_item: HelpCircle, link: Link2,
};

/** Kind-specific human summary of a block's content (never raw JSON). */
function blockSummary(b: ZoneBlockRow): string {
  const c = (b.content ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
  switch (b.kind) {
    case "text": return s("text").slice(0, 80);
    case "image": return s("alt") || "Image";
    case "button": return s("label");
    case "video": return s("caption") || `${s("provider")} video`;
    case "pdf": return s("title");
    case "cta": return s("heading");
    case "faq_item": return s("question");
    case "link": return s("label");
    default: return KIND_LABELS[b.kind] ?? b.kind;
  }
}

/** Human labels — §5 keys never reach the client UI. */
function friendlyName(key: string): string {
  const m = /^([a-z0-9-]+)\.([a-z0-9-]+)\.(.+)$/.exec(key);
  if (!m) return key;
  const page = m[1];
  const section = m[2];
  const rest = m[3].replace(/\[([0-9]+)\]/g, " $1").replace(/\./g, " ");
  const pageLabel = page === "home"
    ? "Homepage"
    : page.charAt(0).toUpperCase() + page.slice(1);
  return `${pageLabel} · ${section} · ${rest}`;
}

function entryValue(entries: EntryMap, key: string): string {
  const e = entries[key];
  return e?.draft ?? e?.published ?? e?.discovered ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-type control for the selected element.
//
// Dispatch mirrors the annotator (data-taya-type) + bootstrap applyValue:
//   image      → setAttribute("src", value)     — ImagePickerField uploads
//                                                 to the Media Library and
//                                                 returns a durable CDN URL.
//   url        → setAttribute("href", value)
//   list_item  → textContent (label) when it's an anchor, PLUS the ".href"
//                companion key (type "url") for the destination. If the
//                companion key doesn't exist in the map, the destination is
//                shown read-only — never faked as editable.
//   text/other → textContent.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §2 destination control for EVERY url/button/link field. Validates with
 * the CANONICAL classifyLink (the same function publishing.saveDraft's
 * href guard runs server-side — mirror parity is pinned by convex-unit
 * contract tests), so the verdict badge a client sees is the verdict the
 * server enforces on save. Rejects (javascript:, data:, malformed hosts,
 * protocol-relative //) show the exact server reason BEFORE save; the
 * server remains the enforcement point (client validation is UX only).
 */
function LinkField({ value, onChange, id }: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const verdict = value === "" ? null : classifyLink(value);
  const badge =
    verdict && verdict.ok
      ? {
          internal: "Page on this site",
          external: "Website link",
          phone: "Phone number",
          email: "Email link",
          anchor: "Section on this page",
        }[verdict.kind]
      : null;
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={id}>
        Destination
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… / /about / #pricing / tel: / mailto:"
        className="text-sm"
      />
      {verdict && !verdict.ok && (
        <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{verdict.reason}</p>
      )}
      {badge && (
        <p className="rounded-md bg-green-50 px-2 py-1.5 text-xs text-green-700">{badge}</p>
      )}
    </div>
  );
}

function EditControl({
  siteId,
  info,
  current,
  companionValue,
  onTextChange,
  onImageChange,
  onLinkChange,
}: {
  siteId: string;
  info: ElementInfo;
  current: string;
  companionValue: string | null;
  onTextChange: (value: string) => void;
  onImageChange: (value: string) => void;
  onLinkChange: (value: string) => void;
}) {
  const t = info.type;

  if (t === "image") {
    return (
      <ImagePickerField
        siteId={siteId}
        label="Image"
        value={current}
        onChange={onImageChange}
        hint="The preview updates immediately; the image goes live only when you publish."
      />
    );
  }

  if (t === "url") {
    return <LinkField value={current} onChange={onLinkChange} />;
  }

  // Buttons / links (hero CTA stamped "text", section buttons/links stamped
  // "list_item"; the label is the base key's text, the destination is the
  // sibling ".href" url key that rides the same element — applyOverlay sets
  // el.href when the entry carries one).
  if ((t === "list_item" || t === "text") && info.href != null) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Label
          </label>
          <Input value={current} onChange={(e) => onTextChange(e.target.value)} className="text-sm" />
        </div>
        {companionValue !== null ? (
          <LinkField value={companionValue} onChange={onLinkChange} />
        ) : (
          <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
            Current destination: {info.href.slice(0, 100)}
            <span className="mt-1 block text-slate-400">
              This link's destination can't be edited yet — only its label can.
            </span>
          </div>
        )}
      </div>
    );
  }

  // default: text
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Text
      </label>
      <textarea
        value={current}
        onChange={(e) => onTextChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

/**
 * §6 per-kind block draft form. ONE form per InsertKind, built from the
 * canonical field contract in convex/lib/editorZones.ts validateBlock:
 *   text      → text + style (paragraph | heading)
 *   image     → url (Media Library via ImagePickerField) + alt
 *   button    → label + href (§2 LinkField — validated destination)
 *   video     → url paste → parseVideoUrl → preview → caption (§3 flow)
 *   pdf       → managed resource picker (api.downloads.list) + title +
 *               description + buttonLabel (§4 — PDFs are MANAGED content)
 *   cta       → heading + body + button label + LinkField destination
 *   faq_item  → question + answer
 *   link      → label + LinkField destination
 *
 * Validation is the CANONICAL validateBlock (the exact function the
 * addBlock/updateBlock mutations run server-side), so the client reason
 * is the server reason — the server remains the enforcement point.
 */
function BlockForm({
  siteId, zone, kind, initial, downloads, busy, onSubmit, onCancel,
}: {
  siteId: string;
  zone: ZoneId;
  kind: InsertKind;
  initial: BlockContent | null;
  downloads: DownloadRow[] | undefined;
  busy: boolean;
  onSubmit: (content: BlockContent) => void;
  onCancel: () => void;
}) {
  const init = (initial ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof init[k] === "string" ? (init[k] as string) : "");

  const [text, setText] = useState(s("text"));
  const [style, setStyle] = useState<"paragraph" | "heading">(init.style === "heading" ? "heading" : "paragraph");
  const [imageUrl, setImageUrl] = useState(s("url"));
  const [alt, setAlt] = useState(s("alt"));
  const [label, setLabel] = useState(s("label"));
  const [href, setHref] = useState(s("href"));
  const [videoUrl, setVideoUrl] = useState(s("watchUrl"));
  const [caption, setCaption] = useState(s("caption"));
  const [resourceId, setResourceId] = useState(s("resourceId"));
  const [title, setTitle] = useState(s("title"));
  const [description, setDescription] = useState(s("description"));
  const [buttonLabel, setButtonLabel] = useState(s("buttonLabel"));
  const [heading, setHeading] = useState(s("heading"));
  const [body, setBody] = useState(s("body"));
  const [question, setQuestion] = useState(s("question"));
  const [answer, setAnswer] = useState(s("answer"));
  const [err, setErr] = useState<string | null>(null);

  // §3 live parse — the same canonical parseVideoUrl the mutation runs.
  const video = videoUrl.trim() !== "" ? parseVideoUrl(videoUrl) : null;

  const submit = () => {
    const draft: Record<string, unknown> = (() => {
      switch (kind) {
        case "text": return { kind: "text", text, style };
        case "image": return { kind: "image", url: imageUrl, alt };
        case "button": return { kind: "button", label, href, variant: "primary" };
        case "video": return { kind: "video", url: videoUrl, caption };
        case "pdf": return { kind: "pdf", resourceId, title, description, buttonLabel };
        case "cta": return { kind: "cta", heading, body, buttonLabel, buttonHref: href };
        case "faq_item": return { kind: "faq_item", question, answer };
        case "link": return { kind: "link", label, href };
        default: return { kind };
      }
    })();
    // validateBlock takes unknown and returns the VALIDATED shape —
    // submit it straight through, no round-trip casts.
    const v = validateBlock(zone, draft);
    if (!v.ok) { setErr(v.reason); return; }
    setErr(null);
    onSubmit(v.content);
  };

  const fieldLabel = "text-xs font-medium uppercase tracking-wide text-slate-500";
  const inputCls = "text-sm";
  // A11y: every label gets htmlFor + the control an id (deterministic,
  // kind-scoped so multiple forms never collide on one page).
  const fieldId = (field: string) => `taya-block-${kind}-${field}`;

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
        It will show up {wherePhrase(zone)} — it appears in the preview immediately and goes live only when you publish.
      </p>

      {kind === "text" && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("text")}>Text</label>
            <textarea id={fieldId("text")} value={text} onChange={(e) => setText(e.target.value)} rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            {(["paragraph", "heading"] as const).map((st) => (
              <button key={st} type="button" onClick={() => setStyle(st)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  style === st ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600"}`}>
                {st}
              </button>
            ))}
          </div>
        </>
      )}

      {kind === "image" && (
        <>
          <ImagePickerField siteId={siteId} label="Image" value={imageUrl} onChange={setImageUrl}
            hint="Upload or pick from your Media Library." />
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("alt")}>Alt text (optional)</label>
            <Input id={fieldId("alt")} value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} placeholder="Describe the image" />
          </div>
        </>
      )}

      {(kind === "button" || kind === "link") && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("label")}>{kind === "button" ? "Button label" : "Link label"}</label>
            <Input id={fieldId("label")} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
          </div>
          <LinkField value={href} onChange={setHref} />
        </>
      )}

      {kind === "video" && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("videoUrl")}>Video link (YouTube or Vimeo)</label>
            <Input id={fieldId("videoUrl")} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={inputCls}
              placeholder="https://www.youtube.com/watch?v=…" />
          </div>
          {video && !video.ok && (
            <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{video.reason}</p>
          )}
          {video && video.ok && (
            <div className="space-y-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-xs font-medium text-green-800 capitalize">{video.provider} video detected</p>
              <p className="truncate text-xs text-green-700">{video.watchUrl}</p>
              {/* §3 preview — the EXACT canonical card the live site renders */}
              <div className="rounded bg-white px-2 py-2"
                dangerouslySetInnerHTML={{ __html: renderBlockHtml({
                  kind: "video", url: video.watchUrl, provider: video.provider,
                  videoId: video.videoId, embedUrl: video.embedUrl, watchUrl: video.watchUrl,
                  caption: caption.trim() || undefined,
                }) }} />
            </div>
          )}
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("caption")}>Caption (optional)</label>
            <Input id={fieldId("caption")} value={caption} onChange={(e) => setCaption(e.target.value)} className={inputCls} />
          </div>
        </>
      )}

      {kind === "pdf" && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("resource")}>PDF resource</label>
            {downloads === undefined ? (
              <Skeleton className="h-9 w-full" />
            ) : !downloads || downloads.length === 0 ? (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                No PDF resources yet — add one under Content → Downloads first, then it will appear here.
              </p>
            ) : (
              <select id={fieldId("resource")} value={resourceId} onChange={(e) => setResourceId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">Pick a PDF…</option>
                {downloads.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}{d.format ? ` (${d.format})` : ""}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("title")}>Title</label>
            <Input id={fieldId("title")} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("description")}>Description (optional)</label>
            <Input id={fieldId("description")} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("buttonLabel")}>Button label (optional)</label>
            <Input id={fieldId("buttonLabel")} value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className={inputCls}
              placeholder="Download PDF" />
          </div>
        </>
      )}

      {kind === "cta" && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("heading")}>Headline</label>
            <Input id={fieldId("heading")} value={heading} onChange={(e) => setHeading(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("body")}>Body (optional)</label>
            <textarea id={fieldId("body")} value={body} onChange={(e) => setBody(e.target.value)} rows={2}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("buttonLabel")}>Button label</label>
            <Input id={fieldId("buttonLabel")} value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className={inputCls} />
          </div>
          <LinkField value={href} onChange={setHref} />
        </>
      )}

      {kind === "faq_item" && (
        <>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("question")}>Question</label>
            <Input id={fieldId("question")} value={question} onChange={(e) => setQuestion(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <label className={fieldLabel} htmlFor={fieldId("answer")}>Answer</label>
            <textarea id={fieldId("answer")} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </>
      )}

      {err && <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{err}</p>}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-2" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {initial ? "Save changes" : "Add to page"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Add content, what-first (§3/§2 client UX): pick WHAT you want to add
 * ("+ Add video"), then the panel shows only the areas of THIS page where
 * that kind of content is allowed — in plain language, never zone ids or
 * engine labels. Kinds with no allowed area on this page are greyed with an
 * honest explanation (flow 9), never hidden and never silently no-op.
 * Data source is still the server's zoneSummaries + the canonical
 * ZONE_ALLOWED_KINDS — no client-side policy.
 */
function AddBlockPanel({ siteId, pageZones, downloads, busy, onAdd }: {
  siteId: string;
  pageZones: Array<{ zone: string; label: string; kinds: string[] }> | undefined;
  downloads: DownloadRow[] | undefined;
  busy: boolean;
  onAdd: (zone: ZoneId, content: BlockContent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<InsertKind | null>(null);
  const [zone, setZone] = useState<ZoneId | null>(null);

  if (pageZones === undefined) return null; // map still loading
  if (pageZones.length === 0) return null;  // no allowed areas on this page

  const close = () => { setOpen(false); setKind(null); setZone(null); };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add content to this page
      </Button>
    );
  }

  // Where THIS kind is allowed on THIS page (server zones x canonical kinds).
  const allowedFor = (k: string) =>
    pageZones.filter((z) => (ZONE_ALLOWED_KINDS[z.zone as ZoneId] ?? []).includes(k as InsertKind));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Add content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!kind && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What would you like to add?</p>
            <div className="flex flex-wrap gap-2">
              {ADD_ACTIONS.map((a) => {
                const spots = allowedFor(a.kind);
                return (
                  <button key={a.kind} type="button" disabled={spots.length === 0}
                    onClick={() => { setKind(a.kind as InsertKind); setZone(null); }}
                    aria-disabled={spots.length === 0}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      spots.length === 0
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                        : "border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600"}`}>
                    {(() => { const I = KIND_ICONS[a.kind] ?? Type; return <I className="h-3.5 w-3.5" />; })()}
                    {a.label}
                  </button>
                );
              })}
            </div>
            {/* Flow 9: honest, plain-language explanation for unavailable kinds */}
            {(() => {
              const unavailable = ADD_ACTIONS
                .filter((a) => allowedFor(a.kind).length === 0)
                .map((a) => pluralKind(a.kind));
              return unavailable.length > 0 ? (
                <p className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                  {unavailableSentence(unavailable)}
                </p>
              ) : null;
            })()}
            <Button size="sm" variant="ghost" className="w-full text-slate-500" onClick={close}>Cancel</Button>
          </div>
        )}

        {kind && !zone && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Where should it go?</p>
            <div className="flex flex-wrap gap-2">
              {allowedFor(kind).map((z) => (
                <button key={z.zone} type="button" onClick={() => setZone(z.zone as ZoneId)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    zone === z.zone
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600"}`}>
                  {areaName(z.zone)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Content can only be added to these areas of the page — never to the layout itself.
            </p>
            <Button size="sm" variant="ghost" className="w-full text-slate-500" onClick={() => setKind(null)}>Back</Button>
          </div>
        )}

        {kind && zone && (
          <BlockForm siteId={siteId} zone={zone} kind={kind} initial={null} busy={busy} downloads={downloads}
            onSubmit={(content) => { onAdd(zone, content); close(); }} 
            onCancel={() => setZone(null)} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * §6 blocks list for the current page: per-zone rows with edit / remove /
 * restore / reorder. All drafts persist immediately via editorZones
 * mutations (the tables ARE the draft layer — content vs published);
 * publish promotes them, discard reverts them.
 */
function BlocksPanel({ siteId, blocks, downloads, busy, onEdit, onRemove, onRestore, onMove, editing, setEditing }: {
  siteId: string;
  blocks: ZoneBlockRow[];
  downloads: DownloadRow[] | undefined;
  busy: boolean;
  onEdit: (b: ZoneBlockRow, content: BlockContent) => void;
  onRemove: (b: ZoneBlockRow) => void;
  onRestore: (b: ZoneBlockRow) => void;
  onMove: (b: ZoneBlockRow, dir: -1 | 1) => void;
  editing: ZoneBlockRow | null;
  setEditing: (b: ZoneBlockRow | null) => void;
}) {
  if (blocks.length === 0) return null;

  const byZone = new Map<string, ZoneBlockRow[]>();
  for (const b of [...blocks].sort((a, b) => a.order - b.order)) {
    const list = byZone.get(b.zone) ?? [];
    list.push(b);
    byZone.set(b.zone, list);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Content blocks on this page</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...byZone.entries()].map(([zone, rows]) => (
          <div key={zone} className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400">{areaName(zone)}</p>
            {rows.map((b, i) => {
              const draft =
                b.pendingDelete || JSON.stringify(b.content ?? null) !== JSON.stringify(b.published ?? null);
              const Icon = KIND_ICONS[b.kind] ?? Type;
              if (editing?.id === b.id) {
                return (
                  <div key={b.id} className="rounded-md border border-blue-200 bg-blue-50/40 p-2">
                    <BlockForm siteId={siteId} zone={b.zone as ZoneId} kind={b.kind as InsertKind}
                      initial={b.content} busy={busy} downloads={downloads}
                      onSubmit={(content) => { onEdit(b, content); setEditing(null); }}
                      onCancel={() => setEditing(null)} />
                  </div>
                );
              }
              return (
                <div key={b.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
                  b.pendingDelete ? "border-red-200 bg-red-50/60" : draft ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className={`min-w-0 flex-1 truncate text-sm ${b.pendingDelete ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {blockSummary(b)}
                  </span>
                  {draft && !b.pendingDelete && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">draft</span>
                  )}
                  {b.pendingDelete ? (
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={busy}
                      aria-label={`Restore ${blockSummary(b)}`} onClick={() => onRestore(b)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restore
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={busy}
                        aria-label={`Edit ${blockSummary(b)}`} onClick={() => setEditing(b)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy || i === 0}
                        aria-label={`Move ${blockSummary(b)} up`} onClick={() => onMove(b, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy || i === rows.length - 1}
                        aria-label={`Move ${blockSummary(b)} down`} onClick={() => onMove(b, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-red-600 hover:text-red-700" disabled={busy}
                        aria-label={`Remove ${blockSummary(b)}`} onClick={() => onRemove(b)}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <p className="text-xs text-slate-400">
          Block changes save as drafts — they go live only when you publish.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * §5 forms panel: lists the site's forms and routes to the EXISTING
 * FormBuilder (/app/sites/:siteId/forms/:formId). The visual editor never
 * edits form internals itself — FormBuilder enforces the same CONTENT_*
 * permissions the direct route does; there is no bypass.
 */
function FormsPanel({ siteId, forms }: {
  siteId: string;
  forms: FormRow[] | undefined;
}) {
  const [, navigate] = useLocation();
  if (forms === undefined) return null; // still loading
  if (!forms || forms.length === 0) return null; // none / not available
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-blue-600" /> Forms on this site
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {forms.map((f) => (
          <button key={f.id} type="button"
            onClick={() => navigate(`/app/sites/${siteId}/forms/${f.id}`)}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-blue-400 hover:text-blue-600">
            <span className="min-w-0 truncate font-medium">{f.name}</span>
            <span className="flex items-center gap-2">
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                f.status === "published" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {f.status}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </span>
          </button>
        ))}
        <p className="text-xs text-slate-400">
          Form fields, settings, and routing are edited in the form builder.
        </p>
      </CardContent>
    </Card>
  );
}

function WorkflowBanner({ state, reason, canPublish }: {
  state: WorkflowState;
  reason?: string | null;
  canPublish?: boolean | null;
}) {
  const styles: Record<WorkflowState, string> = {
    saved: "bg-green-50 text-green-700 border-green-200",
    unsaved: "bg-amber-50 text-amber-700 border-amber-200",
    draft: "bg-blue-50 text-blue-700 border-blue-200",
    publishing: "bg-slate-100 text-slate-700 border-slate-200",
    published: "bg-green-50 text-green-700 border-green-200",
    blocked: "bg-red-50 text-red-700 border-red-200",
  };
  const label: Record<WorkflowState, string> = {
    saved: "All changes saved",
    unsaved: "Unsaved edits",
    draft: "Draft saved — preview or publish",
    publishing: "Publishing…",
    published: "Published to the live website",
    blocked: "Publishing unavailable",
  };
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${styles[state]}`}>
      <span className="flex items-center gap-2">
        {state === "publishing"
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <span className={`h-2 w-2 rounded-full ${state === "unsaved" ? "bg-amber-500" : state === "blocked" ? "bg-red-500" : "bg-green-500"}`} />}
        {label[state]}
      </span>
      {state === "blocked" && reason && <span className="font-normal text-red-600">{reason}</span>}
      {state === "draft" && canPublish === false && (
        <span className="font-normal text-amber-700">Publish blocked: {reason}</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* MAIN EDITOR — parent side of the bootstrap protocol                        */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function VisualEditor() {
  const { siteId } = useParams<{ siteId: string }>();
  return (
    <AppLayout siteId={siteId} pageContext="Visual Editor">
      <VisualEditorInner siteId={siteId} />
    </AppLayout>
  );
}

type FrameState = "loading" | "ready";

function VisualEditorInner({ siteId }: { siteId: string }) {
  const contentMap = useQuery(api.contentMap.get, { siteId: siteId as Id<"sites"> });
  const authority = useQuery(api.publishing.canPublish, { siteId: siteId as Id<"sites"> });
  const revisions = useQuery(api.editor.editorRevisions, { siteId: siteId as Id<"sites"> });
  const saveDraft = useMutation(api.publishing.saveDraft);
  const publish = useMutation(api.publishing.publishContentMap);
  const restore = useMutation(api.editor.restoreAsDraft);
  const mintToken = useMutation(api.editor.createFrameToken);
  const discardDraft = useMutation(api.publishing.discardDraft);
  // §6 zone blocks + structural ops, §4 PDF resources, §5 forms — all
  // server-read; the client projects them, it never invents state.
  const zoneBlocks = useQuery(api.editorZones.listZoneBlocks, { siteId: siteId as Id<"sites"> });
  const zoneSummaries = useQuery(api.editorZones.zoneSummaries, { siteId: siteId as Id<"sites"> });
  const structurals = useQuery(api.editorZones.structuralsFor, { siteId: siteId as Id<"sites"> });
  const downloads = useQuery(api.downloads.list, { siteId: siteId as Id<"sites"> });
  const forms = useQuery(api.forms.list, { siteId: siteId as Id<"sites"> });
  const addBlock = useMutation(api.editorZones.addBlock);
  const updateBlock = useMutation(api.editorZones.updateBlock);
  const removeBlock = useMutation(api.editorZones.removeBlock);
  const restoreBlock = useMutation(api.editorZones.restoreBlock);
  const reorderBlock = useMutation(api.editorZones.reorderBlock);
  const setStructuralOps = useMutation(api.editorZones.setStructuralOps);
  const publishBlocks = useMutation(api.editorZones.publishBlocks);
  const discardBlocks = useMutation(api.editorZones.discardBlocks);

  const [pagePath, setPagePath] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<ElementInfo | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ZoneBlockRow | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [workflow, setWorkflow] = useState<WorkflowState>("saved");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingDraftKeys, setPendingDraftKeys] = useState<string[]>([]);
  const [draftCount, setDraftCount] = useState(0); // re-render tick for ref-backed edits

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const localEditsRef = useRef<Map<string, string>>(new Map());
  const pagePathRef = useRef<string | null>(null);

  const entries = (contentMap?.entries ?? {}) as EntryMap;
  const pages = (contentMap?.pages ?? []) as PageSummary[];
  const siteDomain = (contentMap?.domain as string | undefined) ?? "";

  const blockedReason =
    authority && authority.canPublish === false ? authority.reason : null;

  /* ── load the frame: mint a fresh single-use token ─────────────────── */
  const loadFrame = useCallback(async (path: string) => {
    try {
      setBusy(true);
      const r = await mintToken({ siteId: siteId as Id<"sites">, path });
      setFrameUrl(
        `${convexSiteOrigin()}/api/editor/frame?token=${encodeURIComponent(r.token)}&path=${encodeURIComponent(r.path)}`,
      );
    } catch (e: any) {
      setNotice(e?.message ?? "The editor couldn't open. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [siteId, mintToken]);

  // default to the site's first discovered page once the map arrives
  useEffect(() => {
    if (pagePath === null && contentMap && pages.length > 0) {
      setPagePath(pages[0].path);
      void loadFrame(pages[0].path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentMap]);

  // ADOPTION: server-side drafts from a prior session (Save Draft, or a
  // restored revision not yet published) become the pending set exactly
  // once when the map arrives - the same honest pending state a fresh
  // saveDraft/restore creates in-session. Without this, a saved draft is
  // invisible (badge "All changes saved") and unpublishable (Publish gate
  // needs pendingDraftKeys) after the client reopens the editor.
  // Runs AFTER localEditsRef could have been seeded only in this session,
  // so adoption never clobbers a live editing session's fresher values.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current || !contentMap) return;
    adoptedRef.current = true;
    const draftKeys = Object.keys(entries)
      .filter((k) => typeof entries[k]?.draft === "string");
    if (draftKeys.length === 0) return;
    setPendingDraftKeys(draftKeys);
    setWorkflow("draft");
  }, [contentMap, entries]);

  /* ── parent → frame senders (exact bootstrap protocol) ─────────────── */
  const sendToFrame = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "taya-editor-parent", ...msg },
      "*",
    );
  }, []);

  const applyDraftPreview = useCallback(() => {
    // §5 grammar + bootstrap applyOverlay contract: companion destination
    // keys are deliberately NOT annotated on their own element — they ride
    // the base label key's entry as `href` (entries:{key:{value,type,href?}}).
    const payload: Record<string, { value: string; type: string; href?: string }> = {};
    const editAt = (k: string) =>
      localEditsRef.current.get(k) ?? entryValue(entries, k) ?? "";
    const baseOfCompanion = (ck: string): string | null => {
      const swapped = `${ck.slice(0, -".href".length)}.label`;
      if (swapped in entries) return swapped;
      const direct = ck.slice(0, -".href".length);
      return direct in entries ? direct : null;
    };
    const companionOfBase = (bk: string): string | null => {
      if (bk.endsWith(".label")) {
        const swapped = `${bk.slice(0, -".label".length)}.href`;
        if (swapped in entries) return swapped;
      }
      const direct = `${bk}.href`;
      return direct in entries ? direct : null;
    };
    // FULL OVERLAY: the frame route strips every site script (including
    // the bridge snippet that applies published values on the live site),
    // so the parent is the ONLY channel that carries the live state into
    // the preview. Send every annotated key's EFFECTIVE value - local
    // edit (freshest in-session intent), then server draft, then
    // published, then discovered (entryValue precedence). Without this a
    // client reopening the editor after publishing sees the pre-TAYA
    // discovered text and thinks the publish was lost.
    const pending = new Map<string, string>();
    for (const k of Object.keys(entries)) {
      const e = entries[k];
      const v = localEditsRef.current.get(k)
        ?? (e ? e.draft ?? e.published ?? e.discovered : undefined);
      // Empty strings are real intent (cleared text) and must preview;
      // only a key with NO value of any kind is skipped.
      if (v !== undefined) pending.set(k, v);
    }
    localEditsRef.current.forEach((value, key) => pending.set(key, value));
    pending.forEach((value, key) => {
      if (key.endsWith(".href")) {
        const base = baseOfCompanion(key);
        if (base) {
          payload[base] = { value: editAt(base), type: entries[base]?.type ?? "text", href: value };
          return;
        }
        // A destination with no annotated base element rides nothing.
        return;
      }
      const type = entries[key]?.type ?? "text";
      const ck = companionOfBase(key);
      payload[key] = ck && pending.has(ck)
        ? { value, type, href: pending.get(ck) }
        : { value, type };
    });
    sendToFrame({ kind: "apply-draft", entries: payload });
  }, [entries, sendToFrame]);

  /* ── derived: repeatable item blocks of the current page. Structural
      ops ARE persisted server-side now (§6 setStructuralOps), so the
      panel offers them honestly. The page segment uses the CANONICAL
      derivation the crawl stamps (pageKeySegment, imported from the
      discovery engine — never a client-side re-implementation). */
  const itemIdsOnPage = useMemo(() => {
    if (!pagePath || !contentMap) return [] as string[];
    const seg = pageKeySegment(pagePath);
    const ids = new Set<string>();
    for (const key of Object.keys(entries)) {
      const m = /^(.+items\[[0-9]+\])/.exec(key);
      if (m && key.startsWith(seg + ".")) ids.add(m[1]);
    }
    return [...ids].sort();
  }, [pagePath, contentMap, entries]);

  /* ── derived: §6 state for the current page (server projection) ──────── */
  const blocksOnPage = useMemo(() => {
    if (!pagePath || !zoneBlocks) return [] as ZoneBlockRow[];
    return zoneBlocks.filter((b) => b.pagePath === pagePath);
  }, [pagePath, zoneBlocks]);

  const pageZones = useMemo(() => {
    if (!zoneSummaries) return undefined;
    const row = zoneSummaries.pages.find((p) => p.path === pagePath);
    return row ? row.zones : [];
  }, [zoneSummaries, pagePath]);

  const structuralsOnPage = useMemo(
    () => (structurals ?? []).find((r) => r.pagePath === pagePath) ?? null,
    [structurals, pagePath],
  );

  // Draft structural state: draft wins, else published (null = untouched).
  const structuralOrder = useMemo(
    () => structuralsOnPage
      ? (structuralsOnPage.itemOrder ?? structuralsOnPage.publishedItemOrder ?? null)
      : null,
    [structuralsOnPage],
  );
  const structuralHidden = useMemo(
    () => structuralsOnPage
      ? (structuralsOnPage.hiddenItems ?? structuralsOnPage.publishedHiddenItems ?? null)
      : null,
    [structuralsOnPage],
  );

  // Zone draft COUNT (blocks + structurals) — drives Publish/Discard and
  // the honest count on the Discard button (map drafts + zone drafts).
  // While the queries load this stays 0, which is the honest state.
  const zoneDraftCount = useMemo(() => {
    const blockDrafts = (zoneBlocks ?? []).filter(
      (b) => b.pendingDelete || JSON.stringify(b.content) !== JSON.stringify(b.published),
    ).length;
    const structuralDrafts = (structurals ?? []).filter(
      (r) =>
        JSON.stringify(r.itemOrder) !== JSON.stringify(r.publishedItemOrder) ||
        JSON.stringify(r.hiddenItems) !== JSON.stringify(r.publishedHiddenItems),
    ).length;
    return blockDrafts + structuralDrafts;
  }, [zoneBlocks, structurals]);
  const hasZoneDrafts = zoneDraftCount > 0;

  /* ── §6 zone preview: rebuild every zone container from the DRAFT
      blocks (server-rendered by the CANONICAL editorBlocks renderer — the
      dashboard never builds block HTML). Pending-deleted blocks are
      skipped; zones with no visible blocks send "" so the frame clears
      stale preview containers. Stateless per pass — the parent re-sends
      the full state whenever it changes. */
  const sendZonePreview = useCallback(() => {
    if (!zoneBlocks || !pageZones) return;
    const zones: Array<{ zone: string; html: string }> = [];
    for (const z of pageZones) {
      const rows = (zoneBlocks as ZoneBlockRow[])
        .filter((b) => b.pagePath === pagePathRef.current && b.zone === z.zone && !b.pendingDelete)
        .sort((a, b) => a.order - b.order);
      zones.push({
        zone: z.zone,
        html: rows.length
          ? renderZoneHtml(z.zone, rows.map((r) => (r.content ? renderBlockHtml(r.content, r.id) : "")))
          : "",
      });
    }
    sendToFrame({ kind: "op", op: "zone-refresh", zones });
  }, [zoneBlocks, pageZones, sendToFrame]);

  /* ── §6 structural preview: mirror the DRAFT hide/order of the
      discovered repeatables (frame ops display:none / reorder). Fully
      stateless: every visible item gets a restore, every hidden item a
      remove — no reliance on the frame's prior preview state. */
  const sendStructuralPreview = useCallback(() => {
    if (itemIdsOnPage.length === 0) return;
    const hidden = new Set(structuralHidden ?? []);
    const order = structuralOrder ?? null;
    const ordered = order
      ? [...order, ...itemIdsOnPage.filter((id) => !order.includes(id) && !hidden.has(id))]
      : itemIdsOnPage.filter((id) => !hidden.has(id));
    for (const id of ordered) sendToFrame({ kind: "op", op: "restore", itemId: id });
    for (const id of hidden) sendToFrame({ kind: "op", op: "remove", itemId: id });
    if (ordered.length > 1) sendToFrame({ kind: "op", op: "reorder", itemIds: ordered });
  }, [itemIdsOnPage, structuralOrder, structuralHidden, sendToFrame]);

  /* Zone/structural queries may resolve AFTER the frame reported ready —
     re-send the previews whenever the draft state changes (postMessage to
     an unloaded frame is a harmless no-op). */
  useEffect(() => {
    sendZonePreview();
    sendStructuralPreview();
  }, [sendZonePreview, sendStructuralPreview]);

  /* ── §6 block ops — the mutation is the ONLY persistence path (the
      server re-validates zone + kind + caps + permission on every call);
      the auto-refreshed query then re-renders the preview via the effect
      above. Nothing is client-trusted. */
  const runBlockMutation = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      try {
        setBusy(true);
        await fn();
        setWorkflow("draft");
        setNotice(null);
      } catch (e: any) {
        setNotice(e?.message ?? `Couldn't ${label}. Please try again.`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onAddBlock = useCallback(
    (zone: ZoneId, content: BlockContent) => {
      if (!pagePathRef.current) return;
      void runBlockMutation("add that content", () =>
        addBlock({
          siteId: siteId as Id<"sites">,
          pagePath: pagePathRef.current!,
          zone,
          content,
        }),
      );
    },
    [siteId, addBlock, runBlockMutation],
  );

  const onEditBlock = useCallback(
    (b: ZoneBlockRow, content: BlockContent) => {
      void runBlockMutation("save that edit", () =>
        updateBlock({ siteId: siteId as Id<"sites">, blockId: b.id as Id<"siteEditorBlocks">, content }),
      );
    },
    [siteId, updateBlock, runBlockMutation],
  );

  const onRemoveBlock = useCallback(
    (b: ZoneBlockRow) => {
      void runBlockMutation("remove that content", () =>
        removeBlock({ siteId: siteId as Id<"sites">, blockId: b.id as Id<"siteEditorBlocks"> }),
      );
    },
    [siteId, removeBlock, runBlockMutation],
  );

  const onRestoreBlock = useCallback(
    (b: ZoneBlockRow) => {
      void runBlockMutation("restore that content", () =>
        restoreBlock({ siteId: siteId as Id<"sites">, blockId: b.id as Id<"siteEditorBlocks"> }),
      );
    },
    [siteId, restoreBlock, runBlockMutation],
  );

  const onMoveBlock = useCallback(
    (b: ZoneBlockRow, dir: -1 | 1) => {
      if (!zoneBlocks) return;
      // orderedIds must be EXACTLY the zone's current block ids — the
      // pending-deleted ones count too (they're still rows server-side).
      const rows = (zoneBlocks as ZoneBlockRow[])
        .filter((r) => r.pagePath === b.pagePath && r.zone === b.zone)
        .sort((a, z) => a.order - z.order);
      const i = rows.findIndex((r) => r.id === b.id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return;
      const next = [...rows];
      [next[i], next[j]] = [next[j], next[i]];
      void runBlockMutation("move that content", () =>
        reorderBlock({
          siteId: siteId as Id<"sites">,
          pagePath: b.pagePath,
          zone: b.zone,
          orderedIds: next.map((r) => r.id as Id<"siteEditorBlocks">),
        }),
      );
    },
    [siteId, zoneBlocks, reorderBlock, runBlockMutation],
  );

  /* ── §6 structural ops on the discovered repeatables — persisted via
      setStructuralOps (the server validates every id is a REAL item
      prefix of this page). Preview follows from the refreshed query. */
  const onStructural = useCallback(
    (next: { itemOrder?: string[]; hiddenItems?: string[] }) => {
      if (!pagePathRef.current) return;
      void runBlockMutation("update that section", () =>
        setStructuralOps({
          siteId: siteId as Id<"sites">,
          pagePath: pagePathRef.current!,
          ...next,
        }),
      );
    },
    [siteId, setStructuralOps, runBlockMutation],
  );

  const onItemRemove = useCallback(
    (id: string) => {
      const hidden = new Set(structuralHidden ?? []);
      const order = [...(structuralOrder ?? itemIdsOnPage)];
      hidden.add(id);
      // An item is ordered OR hidden — never both.
      const itemOrder = order.filter((x) => !hidden.has(x));
      onStructural({ itemOrder, hiddenItems: [...hidden] });
    },
    [structuralHidden, structuralOrder, itemIdsOnPage, onStructural],
  );

  const onItemRestore = useCallback(
    (id: string) => {
      const hidden = new Set(structuralHidden ?? []);
      if (!hidden.delete(id)) return;
      const order = [...(structuralOrder ?? itemIdsOnPage.filter((x) => !hidden.has(x)))];
      if (!order.includes(id)) order.push(id);
      onStructural({ itemOrder: order, hiddenItems: [...hidden] });
    },
    [structuralHidden, structuralOrder, itemIdsOnPage, onStructural],
  );

  const onItemMove = useCallback(
    (id: string, dir: -1 | 1) => {
      const hidden = new Set(structuralHidden ?? []);
      const order = [...(structuralOrder ?? itemIdsOnPage.filter((x) => !hidden.has(x)))];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      onStructural({ itemOrder: order, hiddenItems: [...hidden] });
    },
    [structuralHidden, structuralOrder, itemIdsOnPage, onStructural],
  );

  /* ── frame → parent listener (exact bootstrap protocol) ────────────── */
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const d = ev.data as any;
      if (!d || d.source !== "taya-editor") return;
      if (d.kind === "ready") {
        // Apply local edits AND any server-side drafts (union - see
        // applyDraftPreview) to the freshly loaded page. An empty union
        // sends an empty apply-draft, a harmless frame-side no-op
        // (applyOverlay({})), so the unconditional call is safe.
        applyDraftPreview();
        // §6 previews: zone blocks + structural ops mirror the DRAFT state
        // (the frame loads published markup only). If the zone queries are
        // still loading, the preview effect below re-sends when they land.
        sendZonePreview();
        sendStructuralPreview();
        return;
      }
      if (d.kind === "element-click") {
        setSelected({
          key: d.key,
          type: d.type ?? "text",
          contentKind: d.contentKind ?? null,
          label: d.label ?? d.key,
          alt: d.alt ?? null,
          text: d.text ?? null,
          href: d.href ?? null,
          itemId: d.itemId ?? null,
        });
        setMobileTab("edit");
        setLockedNotice(null);
        return;
      }
      if (d.kind === "block-click") {
        // A client clicked content they added earlier: open its edit
        // form in the content list (no ids or internals in copy).
        const rows = zoneBlocks as ZoneBlockRow[] | undefined;
        const row = rows ? rows.find((b) => b.id === d.blockId) : undefined;
        if (row) {
          setSelected(null);
          setEditing(row);
          setMobileTab("edit");
          setLockedNotice(null);
        } else {
          setLockedNotice("That content is still saving. Try again in a moment.");
        }
        return;
      }
      if (d.kind === "locked-click") {
        // Design-locked or off-limits area: never a silent no-op.
        setLockedNotice(
          d.external
            ? "Links to other websites open on the live site. To keep your edits safe, they are not followed inside the editor."
            : "That part of the page is managed by FSTS. Contact your TAYA representative to make changes.",
        );
        return;
      }
      if (d.kind === "selection-cleared") {
        setSelected(null);
        return;
      }
      if (d.kind === "navigate") {
        // Same-site link clicked inside the frame — parent navigates.
        if (typeof d.path === "string" && d.path !== pagePathRef.current) {
          const next = d.path.split("#")[0];
          const match = pages.find((p) => p.path === next);
          if (match) {
            setPagePath(next);
            setSelected(null);
            void loadFrame(next);
          }
        }
        return;
      }
      if (d.kind === "preview-applied") {
        if (d.applied && d.applied > 0) setNotice(null);
        return;
      }
      if (d.kind === "pong") { /* liveness confirmed */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyDraftPreview, sendZonePreview, sendStructuralPreview, loadFrame, pages]);

  useEffect(() => { pagePathRef.current = pagePath; }, [pagePath]);

  /* ── editing ───────────────────────────────────────────────────────── */
  /* Per-card Revert: drop this element's unsaved edit and re-preview
     the last saved value. Server-side drafts are discarded with the
     existing Discard control (honest scope, no fake un-save). */
  const revertEdit = useCallback(
    (key: string) => {
      if (!localEditsRef.current.delete(key)) return;
      setDraftCount((t) => (localEditsRef.current.size === 0 ? 0 : t + 1));
      if (localEditsRef.current.size === 0 && pendingDraftKeys.length === 0) setWorkflow("saved");
      applyDraftPreview();
    },
    [applyDraftPreview, pendingDraftKeys],
  );

  const setLocalEdit = useCallback((key: string, value: string) => {
    localEditsRef.current.set(key, value);
    // Tick (not map size): a second edit to the SAME key leaves the size
    // unchanged, and React would bail out of that re-render — leaving the
    // ref-backed derived state (companionValue badge, selectedDisplay)
    // stale mid-typing. A monotonic tick keeps every edit visible, and
    // every clear path resets to 0 so "0 = no local edits" gating on
    // Save Draft / Publish is preserved.
    setDraftCount((t) => t + 1);
    setWorkflow("unsaved");
    applyDraftPreview();
  }, [applyDraftPreview]);

  /* ── Save Draft (server) ───────────────────────────────────────────── */
  const onSaveDraft = useCallback(async () => {
    if (localEditsRef.current.size === 0) return;
    try {
      setBusy(true);
      const keys = [...localEditsRef.current.keys()];
      await saveDraft({
        siteId: siteId as Id<"sites">,
        entries: keys.map((key) => ({ key, value: localEditsRef.current.get(key)! })),
      });
      localEditsRef.current.clear();
      setDraftCount(0);
      // Union with any server-side drafts already pending (prior session /
      // restored revision): all pending drafts stay publishable together.
      setPendingDraftKeys((prev) => {
        const s = new Set(prev);
        for (const k of keys) s.add(k);
        return [...s];
      });
      setWorkflow("draft");
      setNotice(null);
    } catch (e: any) {
      setNotice(e?.message ?? "Couldn't save your draft. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [siteId, saveDraft]);

  /* ── Publish (server-side authority gate) ──────────────────────────── */
  const onPublish = useCallback(async () => {
    try {
      setWorkflow("publishing");
      setBusy(true);
      const hasMapDrafts = localEditsRef.current.size > 0 || pendingDraftKeys.length > 0;
      if (localEditsRef.current.size > 0) {
        await saveDraft({
          siteId: siteId as Id<"sites">,
          entries: [...localEditsRef.current.entries()].map(([key, value]) => ({ key, value })),
        });
        localEditsRef.current.clear();
        setDraftCount(0);
      }
      // Map publish THROWS when no map drafts are pending — call it only
      // when map drafts exist (restored or edited values).
      if (hasMapDrafts) {
        await publish({ siteId: siteId as Id<"sites"> });
      }
      // §6 blocks + structurals ride the same Publish press through their
      // own server-gated mutation (publishBlocks is graceful at 0 changes
      // and re-checks connection authority exactly like the map path).
      if (hasZoneDrafts) {
        await publishBlocks({ siteId: siteId as Id<"sites"> });
      }
      setWorkflow("published");
      setPendingDraftKeys([]);
      setNotice(null);
      // Reload the frame so the editor reflects the published values.
      if (pagePathRef.current) void loadFrame(pagePathRef.current);
    } catch (e: any) {
      setWorkflow("blocked");
      setNotice(e?.message ?? "Publishing is currently unavailable for this site.");
    } finally {
      setBusy(false);
    }
  }, [siteId, saveDraft, publish, publishBlocks, pendingDraftKeys, hasZoneDrafts, loadFrame]);

  /* ── History / restore-as-draft ────────────────────────────────────── */
  const onRestore = useCallback(async (revisionId: string) => {
    try {
      setBusy(true);
      const r = await restore({ siteId: siteId as Id<"sites">, revisionId: revisionId as Id<"contentVersions"> });
      // The server returns the EXACT keys+values it applied to the draft
      // overlay. Seed the pending state with precisely those keys — the
      // same contract as a freshly saved draft — so the editor honestly
      // reflects the restored revision:
      //   • pendingDraftKeys → Publish / Discard enable through the
      //     EXISTING gates (Publish still routes through the real
      //     publishContentMap server-authority gate — nothing is bypassed)
      //   • localEditsRef    → Preview rides the existing apply-draft
      //     channel, and the frame "ready" handler re-applies it after the
      //     reload below (§16: the frame never fetches drafts itself)
      // No restored entries → no fake publishable state; Publish stays
      // disabled, exactly as when there truly are no draft changes.
      const restored = ((r as { restored?: { key: string; value: string }[] } | null | undefined)?.restored ?? []) as {
        key: string;
        value: string;
      }[];
      localEditsRef.current.clear();
      for (const e of restored) localEditsRef.current.set(e.key, e.value);
      setDraftCount(restored.length);
      // Union with any server-side drafts already pending: restoring does
      // not discard other unpublished drafts the client may have.
      setPendingDraftKeys((prev) => {
        const s = new Set(prev);
        for (const e of restored) s.add(e.key);
        return [...s];
      });
      // Honest badge: a draft exists only when entries were actually
      // restored. (The real server throws on empty; this guards the
      // defensive path so the UI never fakes a pending draft.)
      setWorkflow(restored.length > 0 ? "draft" : "saved");
      setNotice(
        restored.length > 0
          ? "Previous version restored as a draft. Review it, then publish when ready."
          : "Nothing to restore from that version \u2014 no draft changes were created.",
      );
      if (pagePathRef.current) void loadFrame(pagePathRef.current);
    } catch (e: any) {
      setNotice(e?.message ?? "Couldn't restore that version.");
    } finally {
      setBusy(false);
    }
  }, [siteId, restore, loadFrame]);

  const onDiscardDrafts = useCallback(async () => {
    try {
      setBusy(true);
      if (pendingDraftKeys.length > 0) {
        await discardDraft({ siteId: siteId as Id<"sites">, keys: pendingDraftKeys });
      }
      // §6: block + structural drafts revert to published together.
      if (hasZoneDrafts) {
        await discardBlocks({ siteId: siteId as Id<"sites"> });
      }
      localEditsRef.current.clear();
      setDraftCount(0);
      setPendingDraftKeys([]);
      setWorkflow("saved");
      if (pagePathRef.current) void loadFrame(pagePathRef.current);
    } catch (e: any) {
      setNotice(e?.message ?? "Couldn't discard the draft.");
    } finally {
      setBusy(false);
    }
  }, [siteId, discardDraft, discardBlocks, pendingDraftKeys, hasZoneDrafts, loadFrame]);

  const selectedDisplay = useMemo(() => {
    if (!selected) return "";
    // Prefer the local draft, then the durable map, then the element's live
    // text from the click payload (elements annotated by the frame always
    // report their current rendered text — never show a wrong blank).
    return localEditsRef.current.get(selected.key)
      ?? (entryValue(entries, selected.key) || selected.text || "");
    // draftCount is the recompute tick for the ref-backed edit map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, entries, draftCount]);

  // Companion destination key — the §5 grammar's sibling url entry that
  // rides the same element as the label. Hero CTAs are stamped
  // "<…>.primaryButton.label" (type text) with sibling "<…>.primaryButton.href";
  // section buttons/links are stamped list_item with sibling "<key>.href" if
  // the map carries one. The sibling must EXIST in entries (never faked).
  const companionKey = useMemo(() => {
    if (!selected || selected.href == null) return null;
    if (selected.key.endsWith(".label")) {
      const swapped = `${selected.key.slice(0, -".label".length)}.href`;
      return swapped in entries ? swapped : null;
    }
    const direct = `${selected.key}.href`;
    return direct in entries ? direct : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, entries, draftCount]);

  const companionValue = useMemo(() => {
    if (!companionKey || !(companionKey in entries)) return null;
    return localEditsRef.current.get(companionKey)
      ?? entryValue(entries, companionKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionKey, entries, draftCount]);

  /* ── no content map yet (discovery incomplete) ─────────────────────── */
  if (contentMap === null || contentMap === undefined) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Visual Editor</CardTitle></CardHeader>
          <CardContent>
            {contentMap === undefined ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <EmptyState
                title="Your website hasn't been connected yet"
                body="The visual editor opens once your website has been discovered. Ask your account manager to finish connecting your site, or check the Connection page for the current status."
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      {/* header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Visual Editor</h1>
          <p className="text-sm text-slate-500">
            Click any element on your website to edit it{siteDomain ? ` — ${siteDomain}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)} className="gap-2">
            <History className="h-4 w-4" /> History
          </Button>
          {siteDomain && (
            <a href={`https://${siteDomain}${pagePath ?? ""}`} target="_blank" rel="noreferrer noopener">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" /> View live site
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* page navigator */}
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => {
              setPagePath(p.path);
              setSelected(null);
              void loadFrame(p.path);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              pagePath === p.path
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            {p.label || p.path}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {pages.length} page{pages.length === 1 ? "" : "s"} available
        </span>
      </div>

      {/* workflow banner */}
      <WorkflowBanner
        state={workflow}
        reason={blockedReason ?? notice}
        canPublish={authority?.canPublish ?? null}
      />
      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {notice}
        </div>
      )}
      {lockedNotice && !notice && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <span>{lockedNotice}</span>
        </div>
      )}

      {/* history panel */}
      {showHistory && (
        <RevisionHistory
          revisions={revisions as RevisionSummary[] | null}
          onRestore={onRestore}
          busy={busy}
        />
      )}

      {/* mobile tabs */}
      <div className="flex gap-2 lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMobileTab(t)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize ${
              mobileTab === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {t === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      {/* main split: controls (left) + preview (right) */}
      <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row">
        {/* controls */}
        <div className={`${mobileTab === "edit" ? "flex" : "hidden"} w-full flex-col gap-4 lg:flex lg:w-[380px] lg:flex-shrink-0`}>
          {selected ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  {kindHeader(selected.contentKind ?? selected.type)}
                </CardTitle>
                {selected.label && (
                  <p className="mt-1 truncate text-xs text-slate-500">{selected.label.slice(0, 90)}</p>
                )}
                <p className="mt-0.5 truncate text-xs text-slate-400">{friendlyName(selected.key)}</p>
              </CardHeader>
              <CardContent>
                <EditControl
                  siteId={siteId}
                  info={selected}
                  current={selectedDisplay}
                  companionValue={companionValue}
                  onTextChange={(v) => setLocalEdit(selected.key, v)}
                   onImageChange={(v) => setLocalEdit(selected.key, v)}
                  onLinkChange={(v) => {
                    if (companionKey) setLocalEdit(companionKey, v);
                    else setLocalEdit(selected.key, v);
                  }}
                />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5"
                    disabled={busy || draftCount === 0 || !localEditsRef.current.has(selected.key)}
                    onClick={() => void onSaveDraft()}>
                    <Save className="h-3.5 w-3.5" /> Save this change
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 gap-1.5 text-slate-500"
                    disabled={!localEditsRef.current.has(selected.key)}
                    onClick={() => revertEdit(selected.key)}>
                    <Undo2 className="h-3.5 w-3.5" /> Revert
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <Pencil className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">Click something to edit it</p>
                <p className="mt-1 text-xs text-slate-500">
                  Click any heading, paragraph, image, or button in the preview. Edits save as a draft first — nothing goes live until you press Publish.
                </p>
              </CardContent>
            </Card>
          )}

          {/* repeatable items on this page — click-to-edit + persisted
              structural ops (§6: remove / restore / reorder are saved as
              drafts and go live on Publish, exactly like every edit) */}
          {itemIdsOnPage.length > 0 && (() => {
            const hiddenSet = new Set(structuralHidden ?? []);
            const order = structuralOrder
              ? [...structuralOrder, ...itemIdsOnPage.filter((id) => !structuralOrder.includes(id) && !hiddenSet.has(id))]
              : itemIdsOnPage.filter((id) => !hiddenSet.has(id));
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sections with repeatable items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Click an item in the preview to edit its title, description, or image. Removing
                    or reordering an item here is saved as a draft — it goes live when you publish.
                  </p>
                  {order.map((id, idx) => {
                    const isHidden = hiddenSet.has(id);
                    return (
                      <div key={id} className={`rounded-md border px-3 py-2 ${isHidden ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`block truncate text-sm ${isHidden ? "text-slate-400 line-through" : "text-slate-700"}`}>
                            {friendlyName(id)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Move up"
                              disabled={busy || idx === 0}
                              onClick={() => onItemMove(id, -1)}
                              className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Move down"
                              disabled={busy || idx === order.length - 1}
                              onClick={() => onItemMove(id, 1)}
                              className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            {isHidden ? (
                              <button
                                type="button"
                                aria-label="Restore"
                                disabled={busy}
                                onClick={() => onItemRestore(id)}
                                className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label="Remove"
                                disabled={busy}
                                onClick={() => onItemRemove(id)}
                                className="rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

          {/* §4/§3/§1 add-content panel — safe insertion zones only */}
          <AddBlockPanel
            siteId={siteId}
            pageZones={pageZones}
            downloads={downloads as DownloadRow[] | undefined}
            busy={busy}
            onAdd={onAddBlock}
          />

          {/* §6 blocks on this page — edit / remove / restore / reorder */}
          <BlocksPanel
            siteId={siteId}
            blocks={blocksOnPage}
            downloads={downloads as DownloadRow[] | undefined}
            busy={busy}
            onEdit={onEditBlock}
            onRemove={onRemoveBlock}
            onRestore={onRestoreBlock}
            onMove={onMoveBlock}
            editing={editing}
            setEditing={setEditing}
          />

          {/* §5 forms — routed to the EXISTING form builder (no bypass) */}
          <FormsPanel siteId={siteId} forms={forms as FormRow[] | undefined} />

          {/* action bar */}
          <div className="mt-auto space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => { applyDraftPreview(); setMobileTab("preview"); }}
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2"
                disabled={busy || draftCount === 0}
                onClick={onSaveDraft}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full gap-2"
              disabled={busy || (draftCount === 0 && pendingDraftKeys.length === 0 && !hasZoneDrafts)}
              onClick={onPublish}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {blockedReason ? "Publish (blocked)" : "Publish"}
            </Button>
            {blockedReason && (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{blockedReason}</p>
            )}
            {(pendingDraftKeys.length > 0 || hasZoneDrafts) && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full gap-2 text-slate-500"
                disabled={busy}
                onClick={onDiscardDrafts}
              >
                <Undo2 className="h-4 w-4" /> Discard {pendingDraftKeys.length + zoneDraftCount} draft change{pendingDraftKeys.length + zoneDraftCount === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </div>

        {/* preview */}
        <div className={`${mobileTab === "preview" ? "flex" : "hidden"} min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-100 lg:flex`}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-1">
              {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([mode, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={mode}
                  onClick={() => setDevice(mode)}
                  className={`rounded-md p-1.5 ${device === mode ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{pagePath ?? ""}</span>
              <button
                type="button"
                aria-label="Reload preview"
                onClick={() => pagePath && void loadFrame(pagePath)}
                className="rounded p-1 hover:text-slate-600"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3">
            {frameUrl ? (
              <iframe
                ref={iframeRef}
                key={frameUrl}
                src={frameUrl}
                title="Website preview"
                className="rounded-lg border border-slate-300 bg-white shadow-sm"
                style={{ width: DEVICE_WIDTHS[device], height: "100%", minHeight: "480px" }}
                sandbox="allow-same-origin allow-scripts"
                referrerPolicy="no-referrer"
                onLoad={() => sendToFrame({ kind: "ping" })}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── subcomponents ─────────────────────────────────────────────────────── */

function RevisionHistory({ revisions, onRestore, busy }: {
  revisions: RevisionSummary[] | null | undefined;
  onRestore: (revisionId: string) => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Version history</CardTitle>
      </CardHeader>
      <CardContent>
        {revisions === undefined || revisions === null ? (
          <Skeleton className="h-16 w-full" />
        ) : revisions.length === 0 ? (
          <p className="text-sm text-slate-500">No published versions yet.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-auto">
            {revisions.map((r) => (
              <div key={r.revisionId} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {r.summary ?? "Published version"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : ""}
                    {r.publishedBy ? ` · by ${r.publishedBy}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={busy}
                  onClick={() => onRestore(r.revisionId)}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{body}</p>
    </div>
  );
}
