/**
 * PHASE 2 PR-2 — §5 page/content map reads (spec §5, §7, §16).
 *
 * The durable siteContentMaps row is the single source of truth for what
 * TAYA knows about an external site's content: pages, and semantic-key
 * entries with discovered / draft / published overlays.
 *
 *   get     — the full page map + entries for the visual editor
 *             (site-scoped; includes drafts).
 *   listDraftEntries — the pending-draft view (Save/Publish bar).
 *
 * There is intentionally NO anonymous or cross-site read here: a content
 * map is tenant data. The PUBLIC read path (what an external site's own
 * pages render) is the bridge (bridge.ts / http.ts) and it serves
 * PUBLISHED values only — drafts never leak through it.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { pageKeySegment } from "./lib/discovery/html";

/**
 * Resolve a key's owning page using the §5 longest-page-segment rule —
 * the SAME attribution buildPageMap applies (pageKeySegment("/") → "home",
 * "/services" → "services", "/training/classes" → "training.classes"), so
 * the read layer can never disagree with the persisted per-page counts.
 */
function pageFor(paths: string[], key: string): string | null {
  let best: string | null = null;
  let bestSeg = "";
  for (const path of paths) {
    const seg = pageKeySegment(path);
    if (key === seg || key.startsWith(`${seg}.`)) {
      if (best === null || seg.length > bestSeg.length) {
        best = path;
        bestSeg = seg;
      }
    }
  }
  return best;
}

/**
 * Full page map + entries for a site member. Site-scoped: no access →
 * null. Returns pages (with per-page key attribution) and entries
 * (discovered/draft/published/stale/evidence per §5).
 */
export const get = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;

    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();
    if (!map) return null;

    const pages: Array<{ path: string; label: string; title: string; keyCount: number }> =
      (map.pages as any) ?? [];
    const entries: Record<string, any> = (map.entries as any) ?? {};

    // Attach each key to its owning page (longest §5 page-segment match)
    // so the editor's page navigator can render per-page counts.
    const pageKeyCounts: Record<string, number> = {};
    for (const key of Object.keys(entries)) {
      const owner = pageFor(pages.map((p) => p.path), key);
      if (owner) pageKeyCounts[owner] = (pageKeyCounts[owner] ?? 0) + 1;
    }

    return {
      siteId,
      mapId: map._id,
      version: map.version,
      domain: map.domain,
      keyCount: map.keyCount,
      conformed: map.conformed ?? false,
      builtFromSnapshotAt: map.builtFromSnapshotAt ?? null,
      refreshedAt: map.refreshedAt ?? null,
      pages: pages.map((p) => ({ ...p, keyCount: pageKeyCounts[p.path] ?? p.keyCount ?? 0 })),
      entries,
    };
  },
});

/**
 * Entries with pending drafts — the "unsaved/pending publish" view for the
 * editor's draft/publish bar. Site-scoped: no access → null.
 */
export const listDraftEntries = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;

    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();
    if (!map) return null;

    const entries: Record<string, any> = (map.entries as any) ?? {};
    const drafts = Object.keys(entries)
      .filter((k) => entries[k]?.draft !== undefined)
      .map((k) => ({
        key: k,
        type: entries[k].type,
        draft: entries[k].draft,
        discovered: entries[k].discovered,
        published: entries[k].published ?? null,
      }));

    return { siteId, mapId: map._id, count: drafts.length, drafts };
  },
});
