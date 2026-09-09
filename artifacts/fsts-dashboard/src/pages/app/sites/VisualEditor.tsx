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
import { useParams } from "wouter";
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
  ExternalLink, Eye, History, Loader2, Lock,
  Monitor, Pencil, RefreshCw, Save, Send, Smartphone, Tablet,
  Undo2,
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
};

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "834px",
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
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Destination
        </label>
        <Input
          value={current}
          onChange={(e) => onLinkChange(e.target.value)}
          placeholder="https://…"
          className="text-sm"
        />
      </div>
    );
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
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Destination
            </label>
            <Input
              value={companionValue}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder="https://…"
              className="text-sm"
            />
          </div>
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

  const [pagePath, setPagePath] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<ElementInfo | null>(null);
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
    // Union of local edits + SERVER-side drafts: a draft from a prior
    // session (or a restored revision still pending publish) must preview
    // too - the frame itself loads published values only (§16). Local
    // edits win where both exist (the freshest in-session intent).
    const pending = new Map<string, string>();
    for (const [k, e] of Object.entries(entries)) {
      if (e && typeof e.draft === "string") pending.set(k, e.draft);
    }
    localEditsRef.current.forEach((value, key) => pending.set(key, value));
    pending.forEach((value, key) => {
      if (key.endsWith(".href")) {
        const base = baseOfCompanion(key);
        if (base) {
          payload[base] = { value: editAt(base), type: entries[base]?.type ?? "text", href: value };
          return;
        }
      }
      const type = entries[key]?.type ?? "text";
      const ck = companionOfBase(key);
      payload[key] = ck && pending.has(ck)
        ? { value, type, href: pending.get(ck) }
        : { value, type };
    });
    sendToFrame({ kind: "apply-draft", entries: payload });
  }, [entries, sendToFrame]);

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
        return;
      }
      if (d.kind === "element-click") {
        setSelected({
          key: d.key,
          type: d.type ?? "text",
          label: d.label ?? d.key,
          alt: d.alt ?? null,
          text: d.text ?? null,
          href: d.href ?? null,
          itemId: d.itemId ?? null,
        });
        setMobileTab("edit");
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
  }, [applyDraftPreview, loadFrame, pages]);

  useEffect(() => { pagePathRef.current = pagePath; }, [pagePath]);

  /* ── editing ───────────────────────────────────────────────────────── */
  const setLocalEdit = useCallback((key: string, value: string) => {
    localEditsRef.current.set(key, value);
    setDraftCount(localEditsRef.current.size);
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
      if (localEditsRef.current.size > 0) {
        await saveDraft({
          siteId: siteId as Id<"sites">,
          entries: [...localEditsRef.current.entries()].map(([key, value]) => ({ key, value })),
        });
        localEditsRef.current.clear();
        setDraftCount(0);
      }
      await publish({ siteId: siteId as Id<"sites"> });
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
  }, [siteId, saveDraft, publish, loadFrame]);

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
      await discardDraft({ siteId: siteId as Id<"sites">, keys: pendingDraftKeys });
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
  }, [siteId, discardDraft, pendingDraftKeys, loadFrame]);

  /* ── derived: repeatable item blocks of the current page (click-to-edit
      list only — structural ops aren't persisted, so they aren't offered) */
  const itemIdsOnPage = useMemo(() => {
    if (!pagePath || !contentMap) return [] as string[];
    const seg = pagePath === "/"
      ? "home"
      : pagePath.split("/").filter(Boolean).join("-").replace(/[^a-z0-9-]/g, "");
    const ids = new Set<string>();
    for (const key of Object.keys(entries)) {
      const m = /^(.+items\[[0-9]+\])/.exec(key);
      if (m && key.startsWith(seg + ".")) ids.add(m[1]);
    }
    return [...ids].sort();
  }, [pagePath, contentMap, entries]);

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
                  {friendlyName(selected.key)}
                </CardTitle>
                {selected.label && (
                  <p className="mt-1 truncate text-xs text-slate-500">{selected.label.slice(0, 90)}</p>
                )}
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

          {/* repeatable items on this page — click-to-edit list */}
          {itemIdsOnPage.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sections with repeatable items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-slate-500">
                  Click an item in the preview to edit its title, description, or image.
                </p>
                {itemIdsOnPage.map((id) => (
                  <div key={id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <span className="block truncate text-sm text-slate-700">{friendlyName(id)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
              disabled={busy || (draftCount === 0 && pendingDraftKeys.length === 0)}
              onClick={onPublish}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {blockedReason ? "Publish (blocked)" : "Publish"}
            </Button>
            {blockedReason && (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{blockedReason}</p>
            )}
            {pendingDraftKeys.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full gap-2 text-slate-500"
                disabled={busy}
                onClick={onDiscardDrafts}
              >
                <Undo2 className="h-4 w-4" /> Discard {pendingDraftKeys.length} draft change{pendingDraftKeys.length === 1 ? "" : "s"}
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
