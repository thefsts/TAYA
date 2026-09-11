/**
 * PHASE 2 PR-2 — TAYA Web Bridge server surface (spec §5–§7, §9, §15–§16).
 *
 * The bridge is how an EXTERNAL (non-TAYA-hosted) site receives TAYA
 * content. It is strictly one-way: TAYA → the client's own website. The
 * client site embeds the standard snippet (lib/web-bridge), which fetches
 *
 *   GET /api/bridge/content?slug=<site-slug>   — PUBLISHED values only
 *   GET /api/bridge/draft?slug=<site-slug>&token=<verification-token>
 *                                                — published + draft overlay
 *                                                  (the token is the site's
 *                                                  OWN verification token;
 *                                                  it exists precisely so
 *                                                  the owner can preview)
 *   POST /api/bridge/click                      — click telemetry ingest
 *   POST /api/bridge/verify                     — ownership check ping:
 *                                                  the site serves
 *                                                  {token} at
 *                                                  /api/bridge/verify on
 *                                                  ITS OWN domain; TAYA's
 *                                                  checkBridgeToken fetches
 *                                                  it. This module's
 *                                                  verifyPing answers what
 *                                                  TAYA's endpoint expects,
 *                                                  so a bridge-token site
 *                                                  can round-trip through
 *                                                  the same JSON contract.
 *
 * PUBLISH NEVER LEAKS DRAFTS: content/draft are separate endpoints with
 * separate payloads; the published endpoint is filtered to published-only
 * at query time (publishing._publishedEntries). No endpoint ever returns
 * both worlds mixed for anonymous callers.
 *
 * Unknown slug → null → HTTP 404. No tenant data crosses sites: every
 * query resolves the site by slug FIRST, then scopes to that site row.
 *
 * TENANT ISOLATION (§22): these are INTERNAL functions called only by the
 * HTTP actions in http.ts. They take a slug (public identifier), resolve
 * it, and never accept a client-supplied siteId.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { TAYA_BRIDGE_VERSION } from "./lib/webBridgeContract";
import { renderBlockHtml, renderZoneHtml } from "./lib/editorBlocks";
import type { BlockContent, ZoneId } from "./lib/editorZones";

/** Resolve a site by public slug. */
async function siteBySlug(ctx: any, slug: string) {
  return ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
}

/** Resolve a site's durable content map. */
async function mapFor(ctx: any, siteId: any) {
  return ctx.db
    .query("siteContentMaps")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .first();
}

/** Published-only entries: published → published; else discovered. */
export function publishedValue(entry: any): string | null {
  if (!entry) return null;
  if (entry.published !== undefined && entry.published !== null) return entry.published;
  return entry.discovered ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bridge/content — manifest + PUBLISHED values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The public payload the bridge snippet renders from:
 *
 *   { version, bridgeVersion, domain, mode, pages, values: {key: value} }
 *
 * `values` carries ONLY published-or-discovered values — never drafts.
 * For a site with no published overlays yet, this equals the discovered
 * baseline (the crawl's read-only snapshot of the site's own content —
 * serving it back is not a leak; the site already renders it publicly).
 *
 * v2 additions (§6 safe insertion zones): `blocks` (rendered sanitized
 * HTML per zone per page, PUBLISHED only — never draft blocks) and
 * `structural` (published itemOrder/hiddenItems per page). v1 consumers
 * ignore unknown fields — the value surface is untouched.
 */
export const _content = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await siteBySlug(ctx, slug);
    if (!site) return null;

    const map = await mapFor(ctx, site._id);
    if (!map) return null;

    const entries: Record<string, any> = (map.entries as any) ?? {};
    const values: Record<string, string> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const value = publishedValue(entry);
      if (value !== null) values[key] = value;
    }

    return {
      version: map.version,
      bridgeVersion: TAYA_BRIDGE_VERSION,
      domain: map.domain,
      mode: (site as any).connectionMode ?? null,
      publishedAt: (map as any).refreshedAt ?? null,
      pages: map.pages ?? [],
      values,
      blocks: await publishedBlocksFor(ctx, site._id),
      structural: await publishedStructuralFor(ctx, site._id),
    };
  },
});

/**
 * PUBLISHED-ONLY zone blocks for the bridge payload: rendered sanitized
 * HTML per (page, zone), in editorial order. Drafts never reach this
 * payload (draft isolation for anonymous visitors). Mirrors the shape of
 * editorZones._publishedZones but re-rendered here (same lib) so the
 * bridge module owns its own payload assembly.
 */
async function publishedBlocksFor(ctx: any, siteId: any) {
  const blocks: Record<string, Array<{ zone: string; html: string }>> = {};
  const rows = (await ctx.db
    .query("siteEditorBlocks")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .collect()) as Array<any>;
  const byZone = new Map<string, Array<any>>();
  for (const b of rows) {
    if (b.pendingDelete) continue;
    const published = b.published;
    if (!published || typeof published !== "object") continue;
    const key = `${b.pagePath}\u0000${b.zone}`;
    (byZone.get(key) ?? byZone.set(key, []).get(key)!).push(b);
  }
  for (const [key, zoneBlocks] of byZone) {
    const [pagePath, zone] = key.split("\u0000");
    const sorted = zoneBlocks.sort((a: any, b: any) => a.order - b.order);
    const html = sorted
      .map((b: any) => renderBlockHtmlSafe(publishedToBlockContent(b.published)))
      .filter((h: string) => h !== "");
    if (html.length > 0) {
      blocks[pagePath] = blocks[pagePath] ?? [];
      blocks[pagePath].push({ zone, html: renderZoneSafe(zone, html) });
    }
  }
  return blocks;
}

/** Type-narrow a stored published value to BlockContent for rendering. */
function publishedToBlockContent(published: unknown): BlockContent | null {
  if (!published || typeof published !== "object") return null;
  const candidate = published as { kind?: unknown };
  if (typeof candidate.kind !== "string") return null;
  return published as BlockContent;
}

/** Render + sanitize one block; empty string on any failure (fail closed). */
function renderBlockHtmlSafe(content: BlockContent | null): string {
  if (!content) return "";
  try {
    return renderBlockHtml(content);
  } catch {
    return "";
  }
}

/** Wrap a zone's block HTML in its container div; empty string on failure. */
function renderZoneSafe(zone: string, html: Array<string>): string {
  try {
    return renderZoneHtml(zone as ZoneId, html);
  } catch {
    return "";
  }
}

/**
 * PUBLISHED-ONLY structural ops per page (itemOrder/hiddenItems). Drafts
 * never reach this payload. Entries only exist for pages with published
 * structural changes — absent pages mean "site's own order" (no-op).
 */
async function publishedStructuralFor(ctx: any, siteId: any) {
  const structural: Record<string, { itemOrder?: string[]; hiddenItems?: string[] }> = {};
  const rows = (await ctx.db
    .query("siteEditorStructuralOps")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .collect()) as Array<any>;
  for (const s of rows) {
    const page: { itemOrder?: string[]; hiddenItems?: string[] } = {};
    if (Array.isArray(s.publishedItemOrder) && s.publishedItemOrder.length > 0) {
      page.itemOrder = s.publishedItemOrder;
    }
    if (Array.isArray(s.publishedHiddenItems) && s.publishedHiddenItems.length > 0) {
      page.hiddenItems = s.publishedHiddenItems;
    }
    if (Object.keys(page).length > 0) structural[s.pagePath] = page;
  }
  return structural;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bridge/draft — token-gated draft overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The owner-preview payload: published values PLUS every pending draft.
 * Gated by the site's OWN verification token — the shared secret minted
 * at beginVerification. It is the owner's to use; an anonymous visitor
 * cannot guess it (32 hex chars), and a wrong token → null → 404.
 *
 * Mode gate: only DISCOVERED_EXTERNAL (draft-only world) and
 * TAYA_CONNECTED need previews. TAYA_NATIVE sites don't use the bridge.
 */
export const _draft = internalQuery({
  args: { slug: v.string(), token: v.string() },
  handler: async (ctx, { slug, token }) => {
    const site = await siteBySlug(ctx, slug);
    if (!site) return null;

    const ov = (site as any).ownershipVerification ?? {};
    const mode = (site as any).connectionMode;
    if (mode === "TAYA_NATIVE") return null;

    // Token gate — the site's own token, non-empty, exact match.
    if (!ov.token || ov.token !== token) return null;

    const map = await mapFor(ctx, site._id);
    if (!map) return null;

    const entries: Record<string, any> = (map.entries as any) ?? {};
    const values: Record<string, string> = {};
    const drafts: Record<string, string> = {};
    for (const [key, entry] of Object.entries(entries)) {
      const pub = publishedValue(entry);
      if (pub !== null) values[key] = pub;
      if (entry?.draft !== undefined) drafts[key] = entry.draft;
    }

    // v2: draft blocks + structural overlay for owner preview (§6). The
    // token gate above already restricted this payload to the owner —
    // drafts here are the OWNER'S OWN unpublished work, exactly like the
    // map drafts above.
    const blockRows = (await ctx.db
      .query("siteEditorBlocks")
      .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
      .collect()) as Array<any>;
    const blocksDraft: Record<string, Array<{ zone: string; html: string }>> = {};
    const byZone = new Map<string, Array<any>>();
    for (const b of blockRows) {
      if (b.pendingDelete) continue; // draft-removed → hide in preview
      // Draft preview renders the DRAFT content (b.content) — pending edits,
      // not the last published state. Never-published blocks (b.published
      // undefined) appear here too: they are owner drafts.
      const content = b.content as any;
      if (!content || typeof content !== "object") continue;
      const key = `${b.pagePath}\u0000${b.zone}`;
      (byZone.get(key) ?? byZone.set(key, []).get(key)!).push(b);
    }
    for (const [key, zoneBlocks] of byZone) {
      const [pagePath, zone] = key.split("\u0000");
      const sorted = zoneBlocks.sort((a: any, b: any) => a.order - b.order);
      const html = sorted
        .map((b: any) => renderBlockHtmlSafe(publishedToBlockContent(b.content)))
        .filter((h: string) => h !== "");
      if (html.length > 0) {
        blocksDraft[pagePath] = blocksDraft[pagePath] ?? [];
        blocksDraft[pagePath].push({ zone, html: renderZoneSafe(zone, html) });
      }
    }

    const structuralRows = (await ctx.db
      .query("siteEditorStructuralOps")
      .withIndex("by_site", (q: any) => q.eq("siteId", site._id))
      .collect()) as Array<any>;
    const structuralDraft: Record<string, { itemOrder?: string[]; hiddenItems?: string[] }> = {};
    for (const s of structuralRows) {
      const page: { itemOrder?: string[]; hiddenItems?: string[] } = {};
      const draftOrder = s.itemOrder ?? s.publishedItemOrder;
      const draftHidden = s.hiddenItems ?? s.publishedHiddenItems;
      if (Array.isArray(draftOrder) && draftOrder.length > 0) page.itemOrder = draftOrder;
      if (Array.isArray(draftHidden) && draftHidden.length > 0) page.hiddenItems = draftHidden;
      if (Object.keys(page).length > 0) structuralDraft[s.pagePath] = page;
    }

    return {
      version: map.version,
      bridgeVersion: TAYA_BRIDGE_VERSION,
      domain: map.domain,
      mode,
      pages: map.pages ?? [],
      values,
      drafts,
      blocks: blocksDraft,
      structural: structuralDraft,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bridge/verify — ownership verification ping (bridge_token method)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/bridge/verify on the CLIENT's domain answers { token } so
 * checkBridgeToken can match it. TAYA's own /api/bridge/verify accepts
 * {slug, token} and answers whether the pair matches the site's pending
 * verification — the same JSON contract both directions, so a
 * bridge-token site can use either side of the exchange.
 */
export const _verifyPing = internalQuery({
  args: { slug: v.string(), token: v.string() },
  handler: async (ctx, { slug, token }) => {
    const site = await siteBySlug(ctx, slug);
    if (!site) return null;

    const ov = (site as any).ownershipVerification ?? {};
    const expected = ov.token ?? "";
    const method = ov.method ?? null;
    const state = ov.state ?? "unverified";

    return {
      slug,
      matches: !!expected && expected === token,
      method,
      state,
      bridgeVersion: TAYA_BRIDGE_VERSION,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bridge/click — click telemetry ingest
// ─────────────────────────────────────────────────────────────────────────────

/** Click payload from the snippet: key + optional type/path. */
export const _recordClick = internalMutation({
  args: {
    slug: v.string(),
    key: v.string(),
    type: v.optional(v.string()),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const site = await siteBySlug(ctx, args.slug);
    if (!site) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("bridgeClicks")
      .withIndex("by_site_key", (q: any) => q.eq("siteId", site._id).eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        clicks: existing.clicks + 1,
        lastClickedAt: now,
        ...(args.path !== undefined ? { path: args.path } : {}),
      });
      return { ok: true, clicks: existing.clicks + 1 };
    }

    await ctx.db.insert("bridgeClicks", {
      siteId: site._id,
      key: args.key,
      ...(args.type ? { type: args.type } : {}),
      ...(args.path ? { path: args.path } : {}),
      clicks: 1,
      firstClickedAt: now,
      lastClickedAt: now,
    });
    return { ok: true, clicks: 1 };
  },
});
