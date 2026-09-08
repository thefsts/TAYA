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
    };
  },
});

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

    return {
      version: map.version,
      bridgeVersion: TAYA_BRIDGE_VERSION,
      domain: map.domain,
      mode,
      pages: map.pages ?? [],
      values,
      drafts,
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
