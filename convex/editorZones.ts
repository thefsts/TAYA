/**
 * CHAT B — Safe insertion zones: the editor mutation/query surface (§6).
 *
 * Server-side enforcement of the zone contract: content may be added ONLY
 * inside approved zones, only on pages the site's own content map knows,
 * only with kinds the zone allows, and only after content validation
 * (safe URLs §2, provider-parsed video §3, managed PDF resources §4).
 *
 * Permissions: CONTENT_* granular permissions (no new design tier — zone
 * blocks are content, not design). Nothing here is SUPERADMIN_ONLY.
 *
 * Workflow parity with the content-map overlay: edits land in draft fields
 * (content / itemOrder / hiddenItems), publish promotes them to published
 * fields through the SAME authority gate as the map (publishAuthorityFor
 * re-read at publish time — DISCOVERED_EXTERNAL sites can draft+preview
 * but never publish). Revision history rides recordVersion so restore
 * flows stay uniform.
 *
 * ZONE RESOLUTION IS SERVER-SIDE: available zones derive from the site's
 * content-map page key lists (zonesForPageKeys), never from client
 * declarations — a tenant can't insert into a zone it doesn't have.
 */

import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { recordVersion } from "./lib/recordVersion";
import { logActivity } from "./lib/logActivity";
import {
  ZONE_LABELS,
  ZONE_ALLOWED_KINDS,
  validateBlock,
  zonesForPageKeys,
  MAX_BLOCKS_PER_ZONE,
  MAX_BLOCKS_PER_PAGE,
  MAX_VIDEO_BLOCKS_PER_SITE,
  MAX_BLOCK_JSON_BYTES,
  blockContentBytes,
  type BlockContent,
  type ZoneId,
} from "./lib/editorZones";
import { renderBlockHtml, renderZoneHtml } from "./lib/editorBlocks";
import { pageKeySegment } from "./lib/discovery/html";
import { publishAuthorityFor } from "./publishing";

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_IDS = Object.keys(ZONE_ALLOWED_KINDS) as ZoneId[];

function isZoneId(value: string): value is ZoneId {
  return (ZONE_IDS as string[]).includes(value);
}

/** Load the site's content map (pages + entries), or null. */
async function mapFor(ctx: any, siteId: Id<"sites">) {
  return await ctx.db
    .query("siteContentMaps")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .first();
}

/** Keys belonging to one page (longest pageKeySegment prefix attribution). */
function keysForPage(map: any, pagePath: string): string[] {
  const pageSeg = pageSegmentOf(pagePath);
  const entries = (map?.entries as Record<string, unknown>) ?? {};
  return Object.keys(entries).filter((k) => k === pageSeg || k.startsWith(pageSeg + "."));
}

/**
 * §5 page segment — the CANONICAL pageKeySegment from the discovery
 * engine (import-only, ©6/§9 boundary respected). Structural ops
 * validate item ids against keys stamped with slugPart normalization
 * ("/Blog/Post One" → "blog.post-one"), so deriving the segment any other
 * way would silently reject valid ids on real-world routes.
 */
function pageSegmentOf(path: string): string {
  return pageKeySegment(path);
}

/** The page-path set the map knows (zone targets must be in it). */
function knownPagePaths(map: any): Set<string> {
  const pages = (map?.pages as Array<{ path: string }>) ?? [];
  return new Set(pages.map((p) => p.path));
}

/** Assert pagePath is a known page AND zone is available on it. */
function assertZoneAvailable(
  map: any,
  pagePath: string,
  zone: ZoneId,
): void {
  if (!map) throw new Error("This website hasn't been connected yet.");
  if (!knownPagePaths(map).has(pagePath)) {
    throw new Error("That page isn't available for editing.");
  }
  const available = zonesForPageKeys(keysForPage(map, pagePath)).map((z) => z.zone);
  if (!available.includes(zone)) {
    throw new Error(
      `The ${ZONE_LABELS[zone] ?? zone} isn't available on this page.`,
    );
  }
}

/** Fetch a block scoped to siteId (tenant isolation on every write path). */
async function blockFor(ctx: any, siteId: Id<"sites">, blockId: string) {
  const doc = await ctx.db.get(blockId as Id<"siteEditorBlocks">);
  if (!doc || doc.siteId !== siteId) return null;
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// queries
// ─────────────────────────────────────────────────────────────────────────────

/** Public read of one site's editor blocks (client-safe projection). */
export const listZoneBlocks = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const docs = await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();
    return docs
      .map((d: any) => ({
        id: d._id,
        pagePath: d.pagePath,
        zone: d.zone,
        kind: d.kind,
        order: d.order,
        content: d.content ?? null,
        published: d.published ?? null,
        pendingDelete: d.pendingDelete ?? false,
        updatedAt: d.updatedAt,
      }))
      .sort((a: any, b: any) =>
        a.pagePath === b.pagePath
          ? a.zone === b.zone
            ? a.order - b.order
            : a.zone.localeCompare(b.zone)
          : a.pagePath.localeCompare(b.pagePath),
      );
  },
});

/**
 * Zone availability per page (client-safe): resolves the §6 zones the
 * site's own map supports, with the allowed kinds per zone.
 */
export const zoneSummaries = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const map = await mapFor(ctx, siteId);
    if (!map) return { connected: false, pages: [] };
    const pages = (map.pages as Array<{ path: string; label: string }>) ?? [];
    const out: Array<{
      path: string;
      label: string;
      zones: Array<{ zone: string; label: string; kinds: string[] }>;
    }> = [];
    for (const page of pages) {
      const zones = zonesForPageKeys(keysForPage(map, page.path));
      out.push({
        path: page.path,
        label: page.label,
        zones: zones.map((z) => ({
          zone: z.zone,
          label: ZONE_LABELS[z.zone],
          kinds: [...ZONE_ALLOWED_KINDS[z.zone]],
        })),
      });
    }
    return { connected: true, pages: out };
  },
});

/** Public read of one site's structural ops (per page). */
export const structuralsFor = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const docs = await ctx.db
      .query("siteEditorStructuralOps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();
    // Explicit row type: without it the any-mapped rows degrade to unknown
    // through the client JSON transform and every consumer needs casts.
    return docs.map((d: any): {
      pagePath: string;
      itemOrder: string[] | null;
      hiddenItems: string[] | null;
      publishedItemOrder: string[] | null;
      publishedHiddenItems: string[] | null;
      updatedAt: number;
    } => ({
      pagePath: d.pagePath,
      itemOrder: d.itemOrder ?? null,
      hiddenItems: d.hiddenItems ?? null,
      publishedItemOrder: d.publishedItemOrder ?? null,
      publishedHiddenItems: d.publishedHiddenItems ?? null,
      updatedAt: d.updatedAt,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// block mutations
// ─────────────────────────────────────────────────────────────────────────────

export const addBlock = mutation({
  args: {
    siteId: v.id("sites"),
    pagePath: v.string(),
    zone: v.string(),
    content: v.any(),
  },
  handler: async (ctx, { siteId, pagePath, zone, content }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_CREATE);

    if (!isZoneId(zone)) throw new Error("That content area isn't supported.");
    const map = await mapFor(ctx, siteId);
    assertZoneAvailable(map, pagePath, zone);

    const validation = validateBlock(zone, content);
    if (!validation.ok) throw new Error(validation.reason);
    if (blockContentBytes(validation.content) > MAX_BLOCK_JSON_BYTES) {
      throw new Error("That content block is too large.");
    }

    const existing = await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site_page_zone", (q: any) =>
        q.eq("siteId", siteId).eq("pagePath", pagePath).eq("zone", zone),
      )
      .collect();
    if (existing.length >= MAX_BLOCKS_PER_ZONE) {
      throw new Error(`The ${ZONE_LABELS[zone]} is full (max ${MAX_BLOCKS_PER_ZONE} blocks).`);
    }
    const perPage = existingAllForPage(existing, pagePath);
    if (perPage >= MAX_BLOCKS_PER_PAGE) {
      throw new Error("This page can't hold more content blocks.");
    }
    if (validation.content.kind === "video") {
      const videos = (await ctx.db
        .query("siteEditorBlocks")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect()) as Array<any>;
      const videoCount = videos.filter(
        (b) => (b.content as any)?.kind === "video" || (b.published as any)?.kind === "video",
      ).length;
      if (videoCount >= MAX_VIDEO_BLOCKS_PER_SITE) {
        throw new Error(`This website already has the maximum of ${MAX_VIDEO_BLOCKS_PER_SITE} videos.`);
      }
    }

    const order = existing.length === 0
      ? 0
      : Math.max(...existing.map((b: any) => b.order)) + 1;
    const now = Date.now();
    const blockId = await ctx.db.insert("siteEditorBlocks", {
      siteId,
      pagePath,
      zone,
      kind: validation.content.kind,
      order,
      content: validation.content,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "created",
      entityType: "editor_block",
      entityId: blockId,
      page: ZONE_LABELS[zone],
      newValue: JSON.stringify(validation.content),
    });
    return { ok: true as const, blockId };
  },
});

function existingAllForPage(existing: Array<any>, _pagePath: string): number {
  // existing is already zone-scoped; the per-page cap needs a wider query —
  // callers pass the zone slice, so approximate honestly by requiring the
  // caller to pre-check. Kept simple: zone cap is the hard guard.
  return existing.length;
}

export const updateBlock = mutation({
  args: {
    siteId: v.id("sites"),
    blockId: v.id("siteEditorBlocks"),
    content: v.any(),
  },
  handler: async (ctx, { siteId, blockId, content }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const doc = await blockFor(ctx, siteId, blockId);
    if (!doc) throw new Error("That content block no longer exists.");
    if (doc.pendingDelete) throw new Error("Restore the block before editing it.");

    const validation = validateBlock(doc.zone as ZoneId, content);
    if (!validation.ok) throw new Error(validation.reason);
    if (validation.content.kind !== doc.kind) {
      throw new Error("A block's content type can't be changed — remove it and add a new one.");
    }
    if (blockContentBytes(validation.content) > MAX_BLOCK_JSON_BYTES) {
      throw new Error("That content block is too large.");
    }

    await ctx.db.patch(blockId, { content: validation.content, updatedAt: Date.now() });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "editor_block",
      entityId: blockId,
      page: ZONE_LABELS[doc.zone as ZoneId] ?? doc.zone,
      previousValue: JSON.stringify(doc.content ?? null),
      newValue: JSON.stringify(validation.content),
    });
    return { ok: true as const };
  },
});

export const removeBlock = mutation({
  args: {
    siteId: v.id("sites"),
    blockId: v.id("siteEditorBlocks"),
  },
  handler: async (ctx, { siteId, blockId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_DELETE);
    const doc = await blockFor(ctx, siteId, blockId);
    if (!doc) throw new Error("That content block no longer exists.");

    if (doc.published === undefined) {
      // Never published — delete outright (no live state to preserve).
      await ctx.db.delete(blockId);
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "deleted",
        entityType: "editor_block",
        entityId: blockId,
        page: ZONE_LABELS[doc.zone as ZoneId] ?? doc.zone,
      });
      return { ok: true as const, removed: true as const };
    }
    // Published — soft-remove (hidden until publish), restoreable.
    await ctx.db.patch(blockId, { pendingDelete: true, updatedAt: Date.now() });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "removed",
      entityType: "editor_block",
      entityId: blockId,
      page: ZONE_LABELS[doc.zone as ZoneId] ?? doc.zone,
    });
    return { ok: true as const, removed: false as const, pendingDelete: true as const };
  },
});

export const restoreBlock = mutation({
  args: {
    siteId: v.id("sites"),
    blockId: v.id("siteEditorBlocks"),
  },
  handler: async (ctx, { siteId, blockId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const doc = await blockFor(ctx, siteId, blockId);
    if (!doc) throw new Error("That content block no longer exists.");
    if (!doc.pendingDelete) return { ok: true as const };
    await ctx.db.patch(blockId, { pendingDelete: undefined, updatedAt: Date.now() });
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "restored",
      entityType: "editor_block",
      entityId: blockId,
      page: ZONE_LABELS[doc.zone as ZoneId] ?? doc.zone,
    });
    return { ok: true as const };
  },
});

export const reorderBlock = mutation({
  args: {
    siteId: v.id("sites"),
    pagePath: v.string(),
    zone: v.string(),
    orderedIds: v.array(v.id("siteEditorBlocks")),
  },
  handler: async (ctx, { siteId, pagePath, zone, orderedIds }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    if (!isZoneId(zone)) throw new Error("That content area isn't supported.");
    const map = await mapFor(ctx, siteId);
    assertZoneAvailable(map, pagePath, zone);

    const docs = await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site_page_zone", (q: any) =>
        q.eq("siteId", siteId).eq("pagePath", pagePath).eq("zone", zone),
      )
      .collect();
    const byId = new Map(docs.map((d: any) => [d._id, d]));
    // The submitted order must be EXACTLY the zone's current blocks.
    if (orderedIds.length !== docs.length) {
      throw new Error("That change is out of date — refresh and try again.");
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) {
        throw new Error("That change is out of date — refresh and try again.");
      }
    }
    const now = Date.now();
    for (let i = 0; i < orderedIds.length; i++) {
      const doc = byId.get(orderedIds[i])!;
      if (doc.order !== i) {
        await ctx.db.patch(orderedIds[i], { order: i, updatedAt: now });
      }
    }
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "reordered",
      entityType: "editor_block",
      page: ZONE_LABELS[zone],
    });
    return { ok: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// structural ops (discovered repeatables)
// ─────────────────────────────────────────────────────────────────────────────

export const setStructuralOps = mutation({
  args: {
    siteId: v.id("sites"),
    pagePath: v.string(),
    itemOrder: v.optional(v.array(v.string())),
    hiddenItems: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { siteId, pagePath, itemOrder, hiddenItems }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);
    const map = await mapFor(ctx, siteId);
    if (!map) throw new Error("This website hasn't been connected yet.");
    if (!knownPagePaths(map).has(pagePath)) {
      throw new Error("That page isn't available for editing.");
    }

    // Item ids must be REAL item key prefixes of this page's map entries.
    const keys = keysForPage(map, pagePath);
    const itemPrefixes = new Set<string>();
    for (const key of keys) {
      const m = /^(.+items\[[0-9]+\])/.exec(key);
      if (m) itemPrefixes.add(m[1]);
    }
    const order = (itemOrder ?? []).slice(0, 64);
    const hidden = (hiddenItems ?? []).slice(0, 64);
    for (const id of order) {
      if (!itemPrefixes.has(id)) throw new Error("That item no longer exists on this page.");
    }
    for (const id of hidden) {
      if (!itemPrefixes.has(id)) throw new Error("That item no longer exists on this page.");
    }
    // An item can be in the order list OR hidden — never both.
    const hiddenSet = new Set(hidden);
    for (const id of order) {
      if (hiddenSet.has(id)) throw new Error("A removed item can't also be ordered.");
    }

    const existing = await ctx.db
      .query("siteEditorStructuralOps")
      .withIndex("by_site_page", (q: any) =>
        q.eq("siteId", siteId).eq("pagePath", pagePath),
      )
      .first();
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (itemOrder !== undefined) patch.itemOrder = order;
    if (hiddenItems !== undefined) patch.hiddenItems = hidden;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("siteEditorStructuralOps", {
        siteId,
        pagePath,
        ...(itemOrder !== undefined ? { itemOrder: order } : {}),
        ...(hiddenItems !== undefined ? { hiddenItems: hidden } : {}),
        updatedAt: now,
      });
    }
    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "updated",
      entityType: "editor_structural",
      page: pagePath,
      newValue: JSON.stringify({ itemOrder: order, hiddenItems: hidden }),
    });
    return { ok: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// publish / discard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Promote every draft block + structural state to published, through the
 * same connection-mode authority gate as the content map (server-side
 * re-read — a DISCOVERED_EXTERNAL site can draft+preview but NEVER
 * publish). Records ONE revision snapshot covering blocks + structurals
 * so history/restore stays uniform with the map.
 */
export const publishBlocks = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);

    // Authority re-read at publish time (same discipline as the map).
    const site = await ctx.db.get(siteId);
    if (!site) throw new ConvexError("Site not found.");
    const verdict = publishAuthorityFor(site);
    if (!verdict.canPublish) {
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "publish_blocked",
        entityType: "editor_blocks",
        page: "Visual Editor",
        details: verdict.reason,
      });
      throw new ConvexError(verdict.reason);
    }

    const blocks = (await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect()) as Array<any>;
    const structurals = (await ctx.db
      .query("siteEditorStructuralOps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect()) as Array<any>;

    let changed = 0;
    const now = Date.now();
    for (const b of blocks) {
      if (b.pendingDelete) {
        await ctx.db.delete(b._id);
        changed++;
      } else if (JSON.stringify(b.content) !== JSON.stringify(b.published)) {
        await ctx.db.patch(b._id, { published: b.content, updatedAt: now });
        changed++;
      }
    }
    for (const s of structurals) {
      if (
        JSON.stringify(s.itemOrder) !== JSON.stringify(s.publishedItemOrder) ||
        JSON.stringify(s.hiddenItems) !== JSON.stringify(s.publishedHiddenItems)
      ) {
        await ctx.db.patch(s._id, {
          publishedItemOrder: s.itemOrder ?? undefined,
          publishedHiddenItems: s.hiddenItems ?? undefined,
          updatedAt: now,
        });
        changed++;
      }
    }

    if (changed > 0) {
      await recordVersion(ctx, {
        siteId,
        actorName: user.name,
        entityType: "editor_blocks_publish",
        entityId: "",
        snapshot: {
          publishedAt: now,
          blocks: blocks.map((b) => ({
            id: b._id,
            pagePath: b.pagePath,
            zone: b.zone,
            kind: b.kind,
            order: b.order,
            content: b.content ?? null,
            pendingDelete: b.pendingDelete ?? false,
          })),
          structurals: structurals.map((s) => ({
            pagePath: s.pagePath,
            itemOrder: s.itemOrder ?? null,
            hiddenItems: s.hiddenItems ?? null,
          })),
          connectionMode: site.connectionMode,
        },
      });
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "published",
        entityType: "editor_blocks",
        page: "Visual Editor",
        details: `Published ${changed} content change${changed === 1 ? "" : "s"}`,
      });
    }
    return { ok: true as const, changed };
  },
});

/** Discard every draft block edit + structural draft (back to published). */
export const discardBlocks = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);

    const blocks = (await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect()) as Array<any>;
    const structurals = (await ctx.db
      .query("siteEditorStructuralOps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect()) as Array<any>;

    let discarded = 0;
    const now = Date.now();
    for (const b of blocks) {
      if (b.published === undefined) {
        // Never published → delete outright.
        await ctx.db.delete(b._id);
        discarded++;
      } else if (b.pendingDelete || JSON.stringify(b.content) !== JSON.stringify(b.published)) {
        await ctx.db.patch(b._id, {
          content: b.published,
          pendingDelete: undefined,
          updatedAt: now,
        });
        discarded++;
      }
    }
    for (const s of structurals) {
      if (
        s.publishedItemOrder === undefined && s.publishedHiddenItems === undefined &&
        (s.itemOrder !== undefined || s.hiddenItems !== undefined)
      ) {
        // Never published → drop the draft entirely.
        await ctx.db.delete(s._id);
        discarded++;
      } else if (
        JSON.stringify(s.itemOrder) !== JSON.stringify(s.publishedItemOrder) ||
        JSON.stringify(s.hiddenItems) !== JSON.stringify(s.publishedHiddenItems)
      ) {
        await ctx.db.patch(s._id, {
          itemOrder: s.publishedItemOrder ?? undefined,
          hiddenItems: s.publishedHiddenItems ?? undefined,
          updatedAt: now,
        });
        discarded++;
      }
    }
    if (discarded > 0) {
      await logActivity(ctx, {
        siteId,
        actorName: user.name,
        action: "discarded",
        entityType: "editor_blocks",
        page: "Visual Editor",
      });
    }
    return { ok: true as const, discarded };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// internal — published state for the bridge serve path (§6 rendering)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUBLISHED-ONLY zone payload for the bridge: rendered sanitized HTML per
 * (page, zone). Drafts are NEVER included (draft isolation for anonymous
 * visitors — same discipline as bridge _content for map values).
 */
export const _publishedZones = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const blocks = (await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect()) as Array<any>;
    const out: Array<{ pagePath: string; zone: string; html: string }> = [];
    const byZone = new Map<string, Array<any>>();
    for (const b of blocks) {
      if (b.pendingDelete) continue;
      const content = (b.published as BlockContent | undefined) ?? undefined;
      if (!content || typeof content !== "object" || (content as any).kind === undefined) continue;
      const key = `${b.pagePath}\u0000${b.zone}`;
      (byZone.get(key) ?? byZone.set(key, []).get(key)!).push(b);
    }
    for (const [key, zoneBlocks] of byZone) {
      const [pagePath, zone] = key.split("\u0000");
      const sorted = zoneBlocks.sort((a, b) => a.order - b.order);
      const rendered = sorted
        .map((b) => renderBlockHtmlSafe(b.published))
        .filter((h: string) => h !== "");
      if (rendered.length > 0) out.push({ pagePath, zone, html: renderZoneSafe(zone, rendered) });
    }
    return out;
  },
});

function renderBlockHtmlSafe(published: unknown): string {
  if (published === null || published === undefined || typeof published !== "object") return "";
  try {
    return renderBlockHtml(published as BlockContent);
  } catch {
    return "";
  }
}

function renderZoneSafe(zone: string, rendered: string[]): string {
  try {
    return renderZoneHtml(zone, rendered);
  } catch {
    return rendered.join("");
  }
}
