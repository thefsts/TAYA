/**
 * Harness store — an in-memory implementation of the REAL Convex
 * function contracts used by the visual editor.
 *
 * It mirrors EXACTLY (same field names, same throw semantics, same client
 * responses) the production functions in convex/editor.ts, convex/publishing.ts,
 * convex/editorZones.ts, convex/contentMap.ts, convex/downloads.ts.
 * TENANT ISOLATION is real: per-site membership, checked on every call.
 *
 * The content map is seeded by the REAL crawler (crawlSite) over the REAL
 * test-site pages, so keys/values are genuinely discovered — not invented.
 */

import {
  validateBlock,
  zonesForPageKeys,
  MAX_BLOCKS_PER_ZONE,
  MAX_VIDEO_BLOCKS_PER_SITE,
  MAX_BLOCK_JSON_BYTES,
  buildPageMap,
  crawlSite,
  generateBridgeSnippet,
  pageKeySegment,
} from "./pipeline.mjs";

/* ────────────────────────────────────────────────────────────────────
 * Types (mirror production shapes)
 * ──────────────────────────────────────────────────────────────────── */

export interface StoreEntry {
  type: string;
  discovered: string;
  evidence?: string;
  published?: string;
  draft?: string;
}

export interface StoreSite {
  siteId: string;
  slug: string;
  domain: string;
  connectionMode: string;
  ownershipVerification: { token: string; method: string; state: string };
  members: string[];
  map: null | {
    version: 1;
    domain: string;
    pages: Array<{ path: string; label: string; title: string | null; keyCount: number }>;
    entries: Record<string, StoreEntry>;
    keyCount: number;
  };
  blocks: Array<{
    id: string; siteId: string; pagePath: string; zone: string; kind: string; order: number;
    content: any; published?: any; pendingDelete?: boolean;
    createdAt: number; updatedAt: number;
  }>;
  structurals: Array<{
    id: string; siteId: string; pagePath: string;
    itemOrder: string[] | null; publishedItemOrder: string[] | null;
    hiddenItems: string[] | null; publishedHiddenItems: string[] | null;
  }>;
  revisions: Array<{
    revisionId: string; siteId: string; entityType: string;
    publishedAt: number; publishedBy: string; keyCount: number;
    snapshotKeys: Record<string, string>;
  }>;
  tokens: Map<string, { siteId: string; clerkUserId: string; mintedAt: number }>;
  downloads: Array<{ id: string; siteId: string; title: string; label: string; filename: string }>;
}

export interface StoreUser {
  clerkUserId: string;
  name: string;
}

/* ────────────────────────────────────────────────────────────────────
 * Seed — REAL crawl over the REAL test site
 * ──────────────────────────────────────────────────────────────────── */

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}_${(++idSeq).toString().padStart(4, "0")}`;

export async function createHarnessStore(siteDomain: string): Promise<{ users: StoreUser[]; sites: StoreSite[] }> {
  // The REAL crawler fetches the REAL test-site pages over HTTP and builds
  // the discovery snapshot; the REAL buildPageMap shapes it into the
  // durable page map stored in siteContentMaps.
  const crawl = await crawlSite(siteDomain);
  const pageMap = buildPageMap(crawl.snapshot);

  const users: StoreUser[] = [
    { clerkUserId: "user_alice", name: "Alice Harper" },
    { clerkUserId: "user_bob", name: "Bob Chen" },
  ];

  const harborview: StoreSite = {
    siteId: "site_harborview",
    slug: "harborview",
    domain: siteDomain,
    connectionMode: "BRIDGE",
    ownershipVerification: { token: "a1b2c3d4e5f6a7b8", method: "bridge_token", state: "verified" },
    members: ["user_alice"],
    map: {
      version: 1,
      domain: pageMap.domain,
      pages: pageMap.pages,
      entries: pageMap.entries as Record<string, StoreEntry>,
      keyCount: pageMap.keyCount,
    },
    blocks: [],
    structurals: [],
    revisions: [],
    tokens: new Map(),
    downloads: [
      {
        id: "dl_new_patient",
        siteId: "site_harborview",
        title: "New patient form",
        label: "New patient form",
        filename: "new-patient-form.pdf",
      },
    ],
  };

  const riverside: StoreSite = {
    siteId: "site_riverside",
    slug: "riverside",
    domain: siteDomain,
    connectionMode: "BRIDGE",
    ownershipVerification: { token: "b2c3d4e5f6a7b8c9", method: "bridge_token", state: "verified" },
    members: ["user_bob"],
    map: {
      version: 1,
      domain: pageMap.domain,
      pages: pageMap.pages,
      entries: pageMap.entries as Record<string, StoreEntry>,
      keyCount: pageMap.keyCount,
    },
    blocks: [],
    structurals: [],
    revisions: [],
    tokens: new Map(),
    downloads: [
      {
        id: "dl_riverside_brochure",
        siteId: "site_riverside",
        title: "Riverside brochure",
        label: "Riverside brochure",
        filename: "riverside-brochure.pdf",
      },
    ],
  };

  return { users, sites: [harborview, riverside] };
}

/* ────────────────────────────────────────────────────────────────────
 * Access control (mirror of checkSiteAccess — per-site membership)
 * ──────────────────────────────────────────────────────────────────── */

export function userHasAccess(sites: StoreSite[], clerkUserId: string, siteId: string): boolean {
  const site = sites.find((s) => s.siteId === siteId);
  if (!site) return false;
  return site.members.includes(clerkUserId);
}

function mustHaveSite(sites: StoreSite[], clerkUserId: string, siteId: string): StoreSite {
  if (!userHasAccess(sites, clerkUserId, siteId)) {
    throw new Error("Forbidden: site access required");
  }
  return sites.find((s) => s.siteId === siteId)!;
}

/* ────────────────────────────────────────────────────────────────────
 * api.contentMap.get
 * ──────────────────────────────────────────────────────────────────── */

export function getContentMap(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  if (!site.map) return null;
  const pageKeyCounts: Record<string, number> = {};
  for (const key of Object.keys(site.map.entries)) {
    for (const p of site.map.pages) {
      const seg = pageKeySegment(p.path);
      if (key === seg || key.startsWith(seg + ".")) {
        pageKeyCounts[p.path] = (pageKeyCounts[p.path] ?? 0) + 1;
      }
    }
  }
  return {
    siteId,
    mapId: `map_${siteId}`,
    domain: site.map.domain,
    pages: site.map.pages.map((p) => ({ ...p, keyCount: pageKeyCounts[p.path] ?? p.keyCount })),
    entries: site.map.entries,
    keyCount: site.map.keyCount,
  };
}

/* ────────────────────────────────────────────────────────────────────
 * api.publishing.saveDraft / discardDraft / publishContentMap
 * ──────────────────────────────────────────────────────────────────── */

export function saveDraft(sites: StoreSite[], clerkUserId: string, siteId: string, entries: Array<{ key: string; value: string }>) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  if (entries.length === 0) throw new Error("No draft entries provided.");
  if (!site.map) throw new Error("No content map for this site yet — discovery must complete first.");
  const applied: string[] = [];
  for (const e of entries) {
    if (!(e.key in site.map.entries)) continue;
    site.map.entries[e.key].draft = e.value;
    applied.push(e.key);
  }
  return { applied: applied.length, keys: applied };
}

export function discardDraft(sites: StoreSite[], clerkUserId: string, siteId: string, keys: string[]) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const cleared: string[] = [];
  for (const k of keys) {
    const entry = site.map?.entries[k];
    if (entry && entry.draft !== undefined) {
      delete entry.draft;
      cleared.push(k);
    }
  }
  return { applied: cleared.length, keys: cleared };
}

export function publishContentMap(sites: StoreSite[], clerkUserId: string, siteId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  if (site.connectionMode !== "BRIDGE") {
    throw new Error("Publishing is currently unavailable for this site.");
  }
  const entries = site.map?.entries ?? {};
  const targetKeys = Object.keys(entries).filter((k) => entries[k].draft !== undefined);
  if (targetKeys.length === 0) {
    throw new Error("Nothing to publish — no draft values are pending.");
  }
  const snapshotKeys: Record<string, string> = {};
  const user = sites === null ? "" : userNameFor(clerkUserId);
  for (const k of targetKeys) {
    const e = entries[k];
    const value = e.draft ?? e.published ?? e.discovered;
    e.published = value;
    delete e.draft;
    snapshotKeys[k] = value;
  }
  const publishedAt = Date.now();
  site.revisions.push({
    revisionId: nextId("rev"),
    siteId: site.siteId,
    entityType: "content_map_publish",
    publishedAt,
    publishedBy: user,
    keyCount: targetKeys.length,
    snapshotKeys,
  });
  return { published: targetKeys.length, publishedAt };
}

function userNameFor(clerkUserId: string): string {
  return clerkUserId === "user_bob" ? "Bob Chen" : "Alice Harper";
}

/* ────────────────────────────────────────────────────────────────────
 * api.editor.editorRevisions / restoreAsDraft / createFrameToken
 * ──────────────────────────────────────────────────────────────────── */

export function editorRevisions(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  return site.revisions
    .slice()
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .map((r) => ({
      revisionId: r.revisionId,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
      keyCount: r.keyCount,
      summary: `Published ${r.keyCount} value${r.keyCount === 1 ? "" : "s"} to the live website`,
    }));
}

export function restoreAsDraft(sites: StoreSite[], clerkUserId: string, siteId: string, revisionId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const revision = site.revisions.find((r) => r.revisionId === revisionId);
  if (!revision || revision.siteId !== site.siteId) {
    throw new Error("Forbidden: revision not found for this site");
  }
  if (revision.entityType !== "content_map_publish") {
    throw new Error("Only publish revisions can be restored");
  }
  const mapEntries = site.map?.entries ?? {};
  const entries = Object.entries(revision.snapshotKeys)
    .filter(([key, value]) => typeof value === "string" && key in mapEntries)
    .map(([key, value]) => ({ key, value }));
  if (entries.length === 0) throw new Error("Revision contains no restorable content");
  for (const e of entries) mapEntries[e.key].draft = e.value;
  return { restored: entries };
}

export function createFrameToken(sites: StoreSite[], clerkUserId: string, siteId: string, path: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) {
    throw new Error("Forbidden: site access required");
  }
  let routePath = typeof path === "string" && path.startsWith("/") ? path : "/";
  routePath = routePath.split(/[?#]/)[0];
  const token = `tok_${Math.random().toString(36).slice(2, 10)}`;
  const site = sites.find((s) => s.siteId === siteId)!;
  site.tokens.set(token, { siteId, clerkUserId, mintedAt: Date.now() });
  return { token, path: routePath, expiresAt: Date.now() + 10 * 60_000 };
}

export function burnFrameToken(sites: StoreSite[], token: string) {
  for (const site of sites) {
    const hit = site.tokens.get(token);
    if (hit) {
      site.tokens.delete(token);
      return hit;
    }
  }
  return null;
}

export function frameSite(sites: StoreSite[], tokenInfo: { siteId: string; clerkUserId: string }, path: string) {
  if (!userHasAccess(sites, tokenInfo.clerkUserId, tokenInfo.siteId)) return null;
  const site = sites.find((s) => s.siteId === tokenInfo.siteId)!;
  const route = (site.map?.pages ?? []).find((p) => p.path === path);
  if (!route) return null;
  return { siteId: site.siteId, slug: site.slug, domain: site.domain, path };
}

/* ────────────────────────────────────────────────────────────────────
 * api.editorZones.* (blocks + structural ops)
 * ──────────────────────────────────────────────────────────────────── */

export function listZoneBlocks(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  return site.blocks.map((b) => ({
    id: b.id,
    pagePath: b.pagePath,
    zone: b.zone,
    kind: b.kind,
    order: b.order,
    content: b.content,
    published: b.published,
    pendingDelete: b.pendingDelete ?? false,
  }));
}

export function zoneSummaries(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  const pages: Array<{ path: string; zones: Array<{ zone: string; label: string }> }> = [];
  for (const p of site.map?.pages ?? []) {
    const keys = Object.keys(site.map?.entries ?? {}).filter((k) => {
      const seg = pageKeySegment(p.path);
      return k === seg || k.startsWith(seg + ".");
    });
    const zones = zonesForPageKeys(keys);
    pages.push({ path: p.path, zones: zones.map((z) => ({ zone: z.zone, label: z.label })) });
  }
  return { pages };
}

export function structuralsFor(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  return site.structurals.map((r) => ({
    id: r.id,
    pagePath: r.pagePath,
    itemOrder: r.itemOrder,
    publishedItemOrder: r.publishedItemOrder,
    hiddenItems: r.hiddenItems,
    publishedHiddenItems: r.publishedHiddenItems,
  }));
}

export function addBlock(sites: StoreSite[], clerkUserId: string, siteId: string, pagePath: string, zone: string, content: unknown) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const validation = validateBlock(zone, content);
  if (!validation.ok) throw new Error(validation.reason);
  if (JSON.stringify(validation.content).length > MAX_BLOCK_JSON_BYTES) {
    throw new Error("That content block is too large.");
  }
  const existing = site.blocks.filter(
    (b) => b.siteId === site.siteId && b.pagePath === pagePath && b.zone === zone,
  );
  if (existing.length >= MAX_BLOCKS_PER_ZONE) {
    throw new Error(`The ${zone} is full (max ${MAX_BLOCKS_PER_ZONE} blocks).`);
  }
  if (validation.content.kind === "video") {
    const videoCount = site.blocks.filter(
      (b) => b.content?.kind === "video" || b.published?.kind === "video",
    ).length;
    if (videoCount >= MAX_VIDEO_BLOCKS_PER_SITE) {
      throw new Error(`This website already has the maximum of ${MAX_VIDEO_BLOCKS_PER_SITE} videos.`);
    }
  }
  const order = existing.length === 0 ? 0 : Math.max(...existing.map((b) => b.order)) + 1;
  const now = Date.now();
  const blockId = nextId("blk");
  site.blocks.push({
    id: blockId, siteId: site.siteId, pagePath, zone, kind: validation.content.kind,
    order, content: validation.content, createdAt: now, updatedAt: now,
  });
  return { ok: true as const, blockId };
}

export function updateBlock(sites: StoreSite[], clerkUserId: string, siteId: string, blockId: string, content: unknown) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const block = site.blocks.find((b) => b.id === blockId);
  if (!block || block.siteId !== site.siteId) throw new Error("Block not found.");
  const validation = validateBlock(block.zone, content);
  if (!validation.ok) throw new Error(validation.reason);
  block.content = validation.content;
  block.updatedAt = Date.now();
  return { ok: true as const };
}

export function removeBlock(sites: StoreSite[], clerkUserId: string, siteId: string, blockId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const block = site.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error("Block not found.");
  block.pendingDelete = true;
  block.updatedAt = Date.now();
  return { ok: true as const };
}

export function restoreBlock(sites: StoreSite[], clerkUserId: string, siteId: string, blockId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const block = site.blocks.find((b) => b.id === blockId);
  if (!block) throw new Error("Block not found.");
  delete block.pendingDelete;
  return { ok: true as const };
}

export function reorderBlock(sites: StoreSite[], clerkUserId: string, siteId: string, pagePath: string, zone: string, orderedIds: string[]) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  const siblings = site.blocks
    .filter((b) => b.siteId === site.siteId && b.pagePath === pagePath && b.zone === zone)
    .sort((a, b) => a.order - b.order);
  const byId = new Map(siblings.map((b) => [b.id, b]));
  // Production parity (convex/editorZones.ts): orderedIds must be exactly
  // the zone's current block ids - a stale submission is rejected with the
  // client-safe out-of-date message, never a partial reorder.
  if (orderedIds.length !== siblings.length) {
    throw new Error("That change is out of date \u2014 refresh and try again.");
  }
  for (const id of orderedIds) {
    if (!byId.has(id)) {
      throw new Error("That change is out of date \u2014 refresh and try again.");
    }
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const block = byId.get(orderedIds[i])!;
    block.order = i;
  }
  return { ok: true as const };
}

export function setStructuralOps(sites: StoreSite[], clerkUserId: string, siteId: string, pagePath: string, ops: { itemOrder?: string[]; hiddenItems?: string[] }) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  let row = site.structurals.find((r) => r.siteId === site.siteId && r.pagePath === pagePath);
  if (!row) {
    row = {
      id: nextId("struct"), siteId: site.siteId, pagePath,
      itemOrder: null, publishedItemOrder: null, hiddenItems: null, publishedHiddenItems: null,
    };
    site.structurals.push(row);
  }
  if (ops.itemOrder !== undefined) row.itemOrder = ops.itemOrder;
  if (ops.hiddenItems !== undefined) row.hiddenItems = ops.hiddenItems;
  return { ok: true as const };
}

export function publishBlocks(sites: StoreSite[], clerkUserId: string, siteId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  let publishedCount = 0;
  for (const b of [...site.blocks]) {
    if (b.pendingDelete) {
      site.blocks = site.blocks.filter((x) => x.id !== b.id);
      publishedCount++;
      continue;
    }
    if (JSON.stringify(b.content) !== JSON.stringify(b.published)) {
      b.published = b.content;
      publishedCount++;
    }
  }
  for (const r of site.structurals) {
    if (r.itemOrder !== r.publishedItemOrder || r.hiddenItems !== r.publishedHiddenItems) {
      r.publishedItemOrder = r.itemOrder;
      r.publishedHiddenItems = r.hiddenItems;
      publishedCount++;
    }
  }
  return { published: publishedCount, discarded: 0 };
}

export function discardBlocks(sites: StoreSite[], clerkUserId: string, siteId: string) {
  const site = mustHaveSite(sites, clerkUserId, siteId);
  for (const b of [...site.blocks]) {
    if (b.pendingDelete) {
      delete b.pendingDelete;
    } else if (b.published !== undefined) {
      b.content = b.published;
    } else {
      site.blocks = site.blocks.filter((x) => x.id !== b.id);
    }
  }
  for (const r of site.structurals) {
    r.itemOrder = r.publishedItemOrder;
    r.hiddenItems = r.publishedHiddenItems;
  }
  return { discarded: 0, published: 0 };
}

/* ────────────────────────────────────────────────────────────────────
 * api.downloads.list / api.publishing.canPublish
 * ──────────────────────────────────────────────────────────────────── */

export function listDownloads(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return []; // production parity (convex/downloads.ts list)
  const site = sites.find((s) => s.siteId === siteId)!;
  return site.downloads.map((d) => ({ id: d.id, label: d.label, title: d.title }));
}

export function canPublish(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId)!;
  if (site.connectionMode !== "BRIDGE") {
    return { canPublish: false, reason: "Publishing is currently unavailable for this site." };
  }
  return { canPublish: true, reason: null };
}

/* ────────────────────────────────────────────────────────────────────
 * Bridge payloads (mirror convex/bridge.ts shapes EXACTLY)
 * ──────────────────────────────────────────────────────────────────── */

function publishedValue(entry: StoreEntry): string | null {
  const v = entry.published ?? entry.discovered;
  return v === undefined ? null : v;
}

function blocksPayload(site: StoreSite, publishedOnly: boolean): Record<string, Array<{ zone: string; html: string }>> {
  const { renderBlockHtml, renderZoneHtml } = renderRef;
  const blocks: Record<string, Array<{ zone: string; html: string }>> = {};
  const byZone = new Map<string, Array<any>>();
  for (const b of site.blocks) {
    if (b.pendingDelete) continue;
    const content = publishedOnly ? b.published : b.content;
    if (!content) continue;
    const key = `${b.pagePath}\u0000${b.zone}`;
    if (!byZone.has(key)) byZone.set(key, []);
    byZone.get(key)!.push(b);
  }
  for (const [key, rows] of byZone) {
    const [pagePath, zone] = key.split("\u0000");
    const sorted = rows.sort((a, b) => a.order - b.order);
    const html = sorted
      .map((b) => renderBlockHtml(publishedOnly ? b.published : b.content))
      .filter((h: string) => h !== "");
    if (html.length > 0) {
      blocks[pagePath] = blocks[pagePath] ?? [];
      blocks[pagePath].push({ zone, html: renderZoneHtml(zone, html) });
    }
  }
  return blocks;
}

function structuralPayload(site: StoreSite): Record<string, { itemOrder?: string[]; hiddenItems?: string[] }> {
  const structural: Record<string, { itemOrder?: string[]; hiddenItems?: string[] }> = {};
  for (const s of site.structurals) {
    const page: { itemOrder?: string[]; hiddenItems?: string[] } = {};
    const draftOrder = s.itemOrder ?? s.publishedItemOrder;
    const draftHidden = s.hiddenItems ?? s.publishedHiddenItems;
    if (Array.isArray(draftOrder) && draftOrder.length > 0) page.itemOrder = draftOrder;
    if (Array.isArray(draftHidden) && draftHidden.length > 0) page.hiddenItems = draftHidden;
    if (Object.keys(page).length > 0) structural[s.pagePath] = page;
  }
  return structural;
}

/** internal.bridge._content (published only) */
export function bridgeContent(sites: StoreSite[], slug: string) {
  const site = sites.find((s) => s.slug === slug);
  if (!site || site.connectionMode === "TAYA_NATIVE") return null;
  const entries = site.map?.entries ?? {};
  const values: Record<string, string> = {};
  for (const [key, entry] of Object.entries(entries)) {
    const pub = publishedValue(entry);
    if (pub !== null) values[key] = pub;
  }
  return {
    version: 1 as const,
    bridgeVersion: "2",
    domain: site.domain,
    mode: site.connectionMode,
    publishedAt: null,
    pages: (site.map?.pages ?? []).map((p) => p.path),
    values,
    blocks: blocksPayload(site, true),
    structural: structuralPayload(site),
  };
}

/** internal.bridge._draft (token-gated draft overlay) */
export function bridgeDraft(sites: StoreSite[], slug: string, token: string) {
  const site = sites.find((s) => s.slug === slug);
  if (!site || site.connectionMode === "TAYA_NATIVE") return null;
  if (!site.ownershipVerification.token || site.ownershipVerification.token !== token) return null;
  const entries = site.map?.entries ?? {};
  const values: Record<string, string> = {};
  const drafts: Record<string, string> = {};
  for (const [key, entry] of Object.entries(entries)) {
    const pub = publishedValue(entry);
    if (pub !== null) values[key] = pub;
    if (entry.draft !== undefined) drafts[key] = entry.draft;
  }
  return {
    version: 1 as const,
    bridgeVersion: "2",
    domain: site.domain,
    mode: site.connectionMode,
    publishedAt: null,
    pages: (site.map?.pages ?? []).map((p) => p.path),
    values,
    drafts,
    blocks: blocksPayload(site, false),
    structural: structuralPayload(site),
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Bridge snippet (REAL generator) — export for the site page assembly
 * ──────────────────────────────────────────────────────────────────── */

export function bridgeSnippetFor(convexHttpUrl: string, slug: string): string {
  return generateBridgeSnippet({ convexHttpUrl, slug });
}

/* renderRef: late-bound to avoid import cycles in the bundle graph. */
import { renderBlockHtml, renderZoneHtml } from "./pipeline.mjs";
const renderRef = { renderBlockHtml, renderZoneHtml };
