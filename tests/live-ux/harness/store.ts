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
  /* convex/downloads.ts toResponse rows ({...doc, id}) — full DownloadRow
   * shape the VisualEditor PDF picker consumes: id/title/url/format/isActive. */
  downloads: Array<Record<string, any>>;
  /* convex/forms.ts toResponse rows ({...doc, id}) — the VisualEditor Forms
   * panel consumes id/name/status and routes to the EXISTING FormBuilder. */
  forms: Array<Record<string, any>>;
  /** mediaAssets rows (convex/media.ts buildResponse: {...doc, id, url}). */
  mediaAssets: Array<Record<string, any>>;
  /* ── Chat D owner-acceptance extensions (mirror convex tables) ── */
  /** seoSettings rows (convex/seo.ts toResponse shape: id + updatedAt ISO). */
  seoRows: Array<Record<string, any>>;
  /** siteSettings doc (convex/siteSettings.ts EMPTY defaults + analytics fields). */
  siteSettings: Record<string, any>;
  /** websiteHealthScans rows (schema: siteId, overallScore, status, categoryScores, scannedAt). */
  healthScans: Array<{
    id: string; siteId: string; overallScore: number; status: string;
    categoryScores: Record<string, { score: number; status: string; trend: string; issues: string[] }>;
    scannedAt: number;
  }>;
  /** healthNotifications rows (schema: siteId, type, severity, message, category?, readAt?, dismissedAt?). */
  healthNotifications: Array<{
    id: string; siteId: string; type: string; severity: string; message: string;
    category?: string; readAt?: number; dismissedAt?: number;
  }>;
  /** Per-site effective module map (production: flat Record<string, boolean>). */
  enabledModules: Record<string, boolean>;
}

export interface StoreUser {
  clerkUserId: string;
  name: string;
  email?: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  /** Production user.roles shape: [{ siteId, role }]. */
  roles: Array<{ siteId: string; role: string }>;
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
    { clerkUserId: "user_alice", name: "Alice Harper", email: "alice@harborviewdental.com", isActive: true, isSuperAdmin: false, roles: [{ siteId: "site_harborview", role: "owner" }] },
    { clerkUserId: "user_bob", name: "Bob Chen", email: "bob@riversidefamily.com", isActive: true, isSuperAdmin: false, roles: [{ siteId: "site_riverside", role: "owner" }] },
    /* Read-only member on Riverside: the §9 forbidden-role proof (queries
     * return data; every CONTENT_* / MEDIA_UPLOAD mutation must throw
     * Forbidden). Kept OFF Harborview so flow 15's tenant-isolation
     * assertions (members == ["user_alice"]) stay intact. */
    { clerkUserId: "user_carol", name: "Carol Diaz", email: "carol@riversidefamily.com", isActive: true, isSuperAdmin: false, roles: [{ siteId: "site_riverside", role: "read_only" }] },
    /* Chat 2 §10 role matrix: a manager and a content_editor on Riverside
     * (both hold CONTENT_UPDATE, so both may edit ordinary content). Kept
     * OFF Harborview so flow 15's members == ["user_alice"] stays intact. */
    { clerkUserId: "user_dave", name: "Dave Ellis", email: "dave@riversidefamily.com", isActive: true, isSuperAdmin: false, roles: [{ siteId: "site_riverside", role: "manager" }] },
    { clerkUserId: "user_erin", name: "Erin Fox", email: "erin@riversidefamily.com", isActive: true, isSuperAdmin: false, roles: [{ siteId: "site_riverside", role: "content_editor" }] },
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
    /* Full convex/downloads.ts toResponse rows ({...doc, id}): the
     * VisualEditor PDF picker + frame cards consume id/title/url/format/
     * isActive (DownloadRow). URLs point at the harness storage origin so
     * seeded PDFs are actually downloadable (production: ctx.storage.getUrl). */
    downloads: [
      {
        id: "dl_new_patient",
        siteId: "site_harborview",
        title: "New patient form",
        label: "New patient form",
        description: "Everything we need before your first visit.",
        url: "https://127.0.0.1:7788/harness/storage/seed_new_patient",
        format: "PDF",
        sizeLabel: "2 pages",
        category: "Forms",
        isActive: true,
        order: 0,
        fileName: "new-patient-form.pdf",
        filename: "new-patient-form.pdf",
      },
    ],
    /* convex/forms.ts toResponse rows: the VisualEditor Forms panel lists
     * these and routes to the EXISTING FormBuilder (/forms/:formId). */
    forms: [
      {
        id: "form_contact",
        siteId: "site_harborview",
        name: "Contact us",
        slug: "contact-us",
        status: "published",
        fields: [],
        settings: {},
      },
      {
        id: "form_appointment",
        siteId: "site_harborview",
        name: "Appointment request",
        slug: "appointment-request",
        status: "draft",
        fields: [],
        settings: {},
      },
    ],
    /* mediaAssets rows (convex/media.ts buildResponse parity). Empty seed:
     * the SmartImageEditor upload flow populates it live (\u00a74). */
    mediaAssets: [],
    /* Chat D §5/§6/§8: seeded seoSettings (home row pre-created so the rail
     * panel exercises api.seo.update; other pages exercise create),
     * EMPTY-default siteSettings (analytics unset until the client saves),
     * one health scan (dashboard health card renders score/status/last-scan
     * + category issues), one unread health notification. */
    seoRows: [
      {
        id: "seo_hv_home",
        siteId: "site_harborview",
        pagePath: "/",
        title: "Harborview Dental | Gentle Family Dentistry in Harborview",
        description: "Welcoming new patients. Same-day appointments, gentle cleanings, and a team that actually listens.",
        ogImageUrl: null,
        canonicalUrl: null,
        noindex: false,
        ogTitle: null,
        ogDescription: null,
        twitterCardType: null,
        updatedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
      },
    ],
    /* Production parity (convex/siteSettings.ts EMPTY + toResponse
     * {...doc, id}): every field present, section timestamps null. */
    siteSettings: {
      id: "ss_harborview",
      siteId: "site_harborview",
      businessName: null, tagline: null, logoUrl: null, faviconUrl: null,
      websiteType: null, timezone: "America/New_York",
      brandColorPrimary: "#1d4ed8", brandColorSecondary: "#0f172a", brandColorAccent: "#7c3aed",
      fontHeading: "system", fontBody: "system",
      phone: null, email: null, address: null, businessHours: null, socialLinks: null,
      seoGlobalTitle: null, seoGlobalDescription: null, seoOgImageUrl: null,
      analyticsGa4: null, analyticsGtm: null, analyticsSearchConsole: null,
      analyticsPixel: null, analyticsUpdatedAt: null,
      cookieConsentEnabled: false, cookiePolicyUrl: null,
      privacyPolicyUrl: null, termsOfServiceUrl: null,
      identityUpdatedAt: null, brandingUpdatedAt: null, contactUpdatedAt: null,
      seoUpdatedAt: null, integrationsUpdatedAt: null, legalUpdatedAt: null,
      showCancelledEvents: false, eventsUpdatedAt: null,
    },
    healthScans: [
      {
        id: "scan_hv_1",
        siteId: "site_harborview",
        overallScore: 82,
        status: "pass",
        categoryScores: {
          performance: { score: 78, status: "warning", trend: "improving", issues: ["Hero image is 1.9 MB — consider optimizing to WebP."] },
          seo: { score: 88, status: "good", trend: "stable", issues: [] },
          accessibility: { score: 90, status: "good", trend: "stable", issues: [] },
          security: { score: 96, status: "good", trend: "stable", issues: [] },
          forms: { score: 85, status: "good", trend: "stable", issues: [] },
          email: { score: 60, status: "warning", trend: "stable", issues: ["No notification email is connected — form submissions only land in the inbox."] },
          media: { score: 84, status: "good", trend: "stable", issues: [] },
          content: { score: 92, status: "good", trend: "improving", issues: [] },
        },
        scannedAt: Date.now() - 2 * 24 * 3600 * 1000,
      },
    ],
    healthNotifications: [
      {
        id: "notif_hv_1",
        siteId: "site_harborview",
        type: "email_setup",
        severity: "warning",
        message: "Connect a notification email so form submissions reach your inbox.",
        category: "email",
      },
    ],
    enabledModules: {},
  };

  const riverside: StoreSite = {
    siteId: "site_riverside",
    slug: "riverside",
    domain: siteDomain,
    connectionMode: "BRIDGE",
    ownershipVerification: { token: "b2c3d4e5f6a7b8c9", method: "bridge_token", state: "verified" },
    members: ["user_bob", "user_carol", "user_dave", "user_erin"],
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
        description: undefined,
        url: "https://127.0.0.1:7788/harness/storage/seed_riverside_brochure",
        format: "PDF",
        sizeLabel: "1 page",
        category: undefined,
        isActive: true,
        order: 0,
        fileName: "riverside-brochure.pdf",
        filename: "riverside-brochure.pdf",
      },
    ],
    /* Riverside has no forms configured — the VisualEditor Forms panel must
     * render its empty state here (production parity with convex/forms.ts). */
    forms: [],
    mediaAssets: [],
    /* Riverside: owner (Bob) can edit; read_only (Carol) must be blocked on
     * every CONTENT_* / MEDIA_UPLOAD / seo / analytics mutation — the §9
     * forbidden-role proof runs here. */
    seoRows: [],
    siteSettings: {
      id: "ss_riverside",
      siteId: "site_riverside",
      businessName: null, tagline: null, logoUrl: null, faviconUrl: null,
      websiteType: null, timezone: "America/New_York",
      brandColorPrimary: "#1d4ed8", brandColorSecondary: "#0f172a", brandColorAccent: "#7c3aed",
      fontHeading: "system", fontBody: "system",
      phone: null, email: null, address: null, businessHours: null, socialLinks: null,
      seoGlobalTitle: null, seoGlobalDescription: null, seoOgImageUrl: null,
      analyticsGa4: null, analyticsGtm: null, analyticsSearchConsole: null,
      analyticsPixel: null, analyticsUpdatedAt: null,
      cookieConsentEnabled: false, cookiePolicyUrl: null,
      privacyPolicyUrl: null, termsOfServiceUrl: null,
      identityUpdatedAt: null, brandingUpdatedAt: null, contactUpdatedAt: null,
      seoUpdatedAt: null, integrationsUpdatedAt: null, legalUpdatedAt: null,
      showCancelledEvents: false, eventsUpdatedAt: null,
    },
    healthScans: [],
    healthNotifications: [],
    enabledModules: {},
  };

  /* Seed the storage blobs the seeded download URLs point at (production:
   * ctx.storage.getUrl over uploaded files). Minimal-but-valid PDFs so the
   * editor PDF pickers open real downloads and the /harness/storage/:id
   * route serves real bytes with a real content-type. */
  storageBlobs.set("seed_new_patient", {
    contentType: "application/pdf",
    bytes: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      "4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 72 720 Td (New patient form) Tj ET\nendstream\nendobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF",
      "utf-8",
    ),
    uploadedAt: Date.now(),
  });
  storageBlobs.set("seed_riverside_brochure", {
    contentType: "application/pdf",
    bytes: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      "4 0 obj<</Length 48>>stream\nBT /F1 18 Tf 72 720 Td (Riverside family brochure) Tj ET\nendstream\nendobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF",
      "utf-8",
    ),
    uploadedAt: Date.now(),
  });

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
  /* Production parity: sorted by order, full toResponse rows ({...doc, id}) —
   * the VisualEditor PDF picker consumes id/title/url/format/isActive. */
  return [...site.downloads]
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((d: any) => ({ ...d, id: d.id }));
}

export function listForms(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return []; // production parity (convex/forms.ts list)
  const site = sites.find((s) => s.siteId === siteId)!;
  /* Production parity: convex/forms.ts toResponse rows ({...doc, id}) — the
   * VisualEditor Forms panel consumes id/name/status and routes to the
   * EXISTING FormBuilder (/app/sites/:siteId/forms/:formId). */
  return [...site.forms].map((f: any) => ({ ...f, id: f.id }));
}

export function getForm(sites: StoreSite[], clerkUserId: string, siteId: string, formId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null; // production parity (convex/forms.ts get)
  const site = sites.find((s) => s.siteId === siteId)!;
  const form = site.forms.find((f: any) => f.id === formId);
  if (!form) return null;
  return { ...form, id: form.id };
}

export function updateForm(
  sites: StoreSite[],
  clerkUserId: string,
  siteId: string,
  formId: string,
  patch: Record<string, any>,
) {
  const site = mustHaveSite(sites, clerkUserId, siteId); // throws Forbidden when no access
  const form = site.forms.find((f: any) => f.id === formId);
  if (!form) throw new Error("Form not found.");
  if (patch.name !== undefined) form.name = patch.name;
  if (patch.fields !== undefined) form.fields = patch.fields;
  if (patch.settings !== undefined) form.settings = patch.settings;
  if (patch.status !== undefined) form.status = patch.status;
  return { ...form, id: form.id };
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Chat D owner-acceptance extensions — RBAC + seo + siteSettings +
 * healthScans + dashboard summary (mirror convex/accessControl.ts,
 * convex/seo.ts, convex/siteSettings.ts, convex/healthScans.ts,
 * convex/sites.ts getDashboardSummary; same gates, same throws).
 * ────────────────────────────────────────────────────────────────────────── */

/* DASHBOARD_MODULES + ROLE_CAPABILITIES — the REAL production matrix from
 * convex/lib/roleCapabilities.ts (owner row + read_only row + internal_qa
 * row are the ones the harness exercises; the full set is mirrored verbatim
 * so role-level gating matches production for any future role). */
export const DASHBOARD_MODULES = [
  "dashboard", "homepage", "courses", "events", "articles", "media", "faq",
  "testimonials", "forms", "inbox", "navigation", "announcement", "cta", "team",
  "careers", "downloads", "popup", "policy", "contact", "footer", "seo",
  "payments", "commerce", "email", "crm", "health", "history", "activity",
  "backups", "help",
  "services", "products", "reviews", "flyers", "portal", "automation",
  "site_users", "payment_providers",
] as const;

type Level = "none" | "view" | "edit" | "manage";

const MANAGE_ALL: Record<string, Level> = Object.fromEntries(
  DASHBOARD_MODULES.map((m) => [m, m === "help" ? "view" : "manage"]),
);
const VIEW_ALL: Record<string, Level> = Object.fromEntries(
  DASHBOARD_MODULES.map((m) => [m, "view"]),
);

export const ROLE_CAPABILITIES: Record<string, Record<string, Level>> = {
  internal_qa: { ...MANAGE_ALL, reviews: "edit", site_users: "view", payment_providers: "view" },
  owner: { ...MANAGE_ALL, reviews: "edit", site_users: "view", payment_providers: "view" },
  manager: { ...MANAGE_ALL, payments: "view", commerce: "view", email: "view", health: "view", history: "view", activity: "view", backups: "view", help: "view", site_users: "view", payment_providers: "view" },
  marketing: { dashboard: "view", homepage: "edit", courses: "view", events: "view", articles: "edit", media: "edit", faq: "edit", testimonials: "edit", forms: "view", inbox: "view", navigation: "view", announcement: "edit", cta: "edit", team: "view", careers: "none", downloads: "none", popup: "edit", policy: "none", contact: "none", footer: "none", seo: "edit", payments: "none", commerce: "none", email: "none", crm: "manage", health: "none", history: "none", activity: "none", backups: "none", help: "view", services: "edit", products: "edit", reviews: "edit", flyers: "manage", portal: "view", automation: "edit", site_users: "view", payment_providers: "view" },
  content_editor: { dashboard: "view", homepage: "edit", courses: "edit", events: "edit", articles: "edit", media: "edit", faq: "edit", testimonials: "edit", forms: "view", inbox: "view", navigation: "none", announcement: "none", cta: "none", team: "edit", careers: "edit", downloads: "edit", popup: "none", policy: "edit", contact: "none", footer: "none", seo: "view", payments: "none", commerce: "none", email: "none", crm: "none", health: "none", history: "view", activity: "view", backups: "none", help: "view", services: "edit", products: "edit", reviews: "edit", flyers: "none", portal: "view", automation: "edit", site_users: "view", payment_providers: "view" },
  course_manager: { dashboard: "view", homepage: "none", courses: "manage", events: "none", articles: "none", media: "view", faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none", cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none", footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "none", health: "none", history: "none", activity: "none", backups: "none", help: "view", services: "view", products: "view", reviews: "view", flyers: "none", portal: "view", automation: "view", site_users: "view", payment_providers: "view" },
  events_manager: { dashboard: "view", homepage: "none", courses: "none", events: "manage", articles: "none", media: "view", faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none", cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none", footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "none", health: "none", history: "none", activity: "none", backups: "none", help: "view", services: "view", products: "view", reviews: "view", flyers: "none", portal: "view", automation: "view", site_users: "view", payment_providers: "view" },
  finance: { dashboard: "view", homepage: "none", courses: "view", events: "view", articles: "none", media: "none", faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none", cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none", footer: "none", seo: "none", payments: "manage", commerce: "manage", email: "none", crm: "none", health: "none", history: "view", activity: "view", backups: "none", help: "view", services: "view", products: "view", reviews: "view", flyers: "none", portal: "view", automation: "view", site_users: "view", payment_providers: "view" },
  support: { dashboard: "view", homepage: "none", courses: "view", events: "view", articles: "view", media: "none", faq: "view", testimonials: "view", forms: "view", inbox: "manage", navigation: "none", announcement: "none", cta: "none", team: "view", careers: "none", downloads: "none", popup: "none", policy: "view", contact: "view", footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "view", health: "view", history: "none", activity: "view", backups: "none", help: "view", services: "view", products: "view", reviews: "view", flyers: "none", portal: "view", automation: "view", site_users: "view", payment_providers: "view" },
  /* Read Only: view-everything EXCEPT Flyers (read gate requires
   * FLYERS_CREATE — convex/flyers.ts checkFlyerReadAccess). */
  read_only: { ...VIEW_ALL, flyers: "none" },
};

/* ROLE_PERMISSIONS — convex/lib/rolePermissions.ts verbatim (the named
 * PERMISSIONS the convex mutations actually enforce). */
export const P = {
  CONTENT_VIEW: "content.view",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",
  MEDIA_VIEW: "media.view",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  FLYERS_CREATE: "flyers.create",
  FLYERS_UPDATE: "flyers.update",
  FLYERS_PUBLISH: "flyers.publish",
  FLYERS_ARCHIVE: "flyers.archive",
  EVENTS_MANAGE: "events.manage",
  CLASSES_MANAGE: "classes.manage",
} as const;

const CONTENT_ALL = [P.CONTENT_VIEW, P.CONTENT_CREATE, P.CONTENT_UPDATE, P.CONTENT_DELETE];
const CONTENT_VIEW_ONLY = [P.CONTENT_VIEW];
const MEDIA_ALL = [P.MEDIA_VIEW, P.MEDIA_UPLOAD, P.MEDIA_DELETE];
const MEDIA_VIEW_ONLY = [P.MEDIA_VIEW];
const FLYERS_ALL = [P.FLYERS_CREATE, P.FLYERS_UPDATE, P.FLYERS_PUBLISH, P.FLYERS_ARCHIVE];

export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  internal_qa: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
  owner: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
  manager: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
  marketing: [P.CONTENT_VIEW, P.CONTENT_CREATE, P.CONTENT_UPDATE, P.MEDIA_VIEW, P.MEDIA_UPLOAD, ...FLYERS_ALL],
  content_editor: [...CONTENT_ALL, ...MEDIA_ALL],
  course_manager: [P.CONTENT_VIEW, P.MEDIA_VIEW, P.CLASSES_MANAGE],
  events_manager: [P.CONTENT_VIEW, P.MEDIA_VIEW, P.EVENTS_MANAGE],
  finance: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
  support: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
  read_only: [...CONTENT_VIEW_ONLY, ...MEDIA_VIEW_ONLY],
  /* Legacy role spellings (roleHasPermission fallback map). */
  client_admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
  site_admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
  admin: [...CONTENT_ALL, ...MEDIA_ALL, ...FLYERS_ALL, P.EVENTS_MANAGE, P.CLASSES_MANAGE],
};

function findUser(users: StoreUser[], clerkUserId: string): StoreUser | undefined {
  return users.find((u) => u.clerkUserId === clerkUserId);
}

function siteRoleOf(users: StoreUser[], clerkUserId: string, siteId: string): string | null {
  const user = findUser(users, clerkUserId);
  if (!user) return null;
  const r = user.roles.find((x: any) => x.siteId === siteId);
  return r ? r.role : null;
}

function roleHasPermission(role: string, permission: string): boolean {
  const map = ROLE_PERMISSIONS[role];
  if (map) return map.includes(permission);
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/**
 * Mirror of convex/lib/requirePermission.ts requirePermission:
 * superAdmin bypass; no site roles → Forbidden; any role covering the
 * permission → allowed; else `Forbidden: your role does not grant '<p>'...`.
 * Exported: the runtime.mjs dispatcher gates every production mutation
 * through this (production mutations call requirePermission directly).
 */
export function mustHavePermission(users: StoreUser[], clerkUserId: string, siteId: string, permission: string): StoreUser {
  const user = findUser(users, clerkUserId);
  if (!user) throw new Error("Forbidden: you do not have access to this site.");
  if (user.isSuperAdmin) return user;
  const siteRoles = user.roles.filter((r: any) => r.siteId === siteId);
  if (siteRoles.length === 0) throw new Error("Forbidden: you do not have access to this site.");
  for (const { role } of siteRoles) {
    if (roleHasPermission(role, permission)) return user;
  }
  throw new Error(`Forbidden: your role does not grant '${permission}' on this site.`);
}

/** Mirror of checkModuleEnabled: explicit false disables; else enabled. */
function moduleEnabled(site: StoreSite, moduleKey: string): boolean {
  return site.enabledModules?.[moduleKey] !== false;
}

function mustHaveModule(site: StoreSite, moduleKey: string) {
  if (!moduleEnabled(site, moduleKey)) {
    throw new Error(`Module '${moduleKey}' is disabled for this site.`);
  }
}

function mustHaveSiteOf(sites: StoreSite[], siteId: string): StoreSite {
  const site = sites.find((s) => s.siteId === siteId);
  if (!site) throw new Error("Site not found");
  return site;
}

/* ── api.seo.list / create / update (convex/seo.ts) ── */

function seoResponse(row: Record<string, any>) {
  return { ...row, id: row.id, siteId: row.siteId, updatedAt: row.updatedAt };
}

export function listSeo(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return [];
  const site = mustHaveSiteOf(sites, siteId);
  if (!moduleEnabled(site, "seo")) return [];
  return site.seoRows.map(seoResponse);
}

export function createSeo(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  fields: { pagePath: string; title: string; description: string; ogImageUrl?: string; canonicalUrl?: string; noindex?: boolean; ogTitle?: string; ogDescription?: string; twitterCardType?: string },
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.CONTENT_CREATE);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "seo");
  const existing = site.seoRows.find((r) => r.pagePath === fields.pagePath);
  if (existing) throw new Error("A search setting already exists for this page.");
  const row = {
    id: nextId("seo"),
    siteId,
    ...fields,
    updatedAt: new Date().toISOString(),
  };
  site.seoRows.push(row);
  return seoResponse(row);
}

export function updateSeo(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  args: { seoSettingId: string } & Partial<{ pagePath: string; title: string; description: string; ogImageUrl: string; canonicalUrl: string; noindex: boolean; ogTitle: string; ogDescription: string; twitterCardType: string }>,
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.CONTENT_UPDATE);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "seo");
  const row = site.seoRows.find((r) => r.id === args.seoSettingId);
  if (!row || row.siteId !== siteId) throw new Error("SEO setting not found");
  const { seoSettingId, ...fields } = args;
  Object.assign(row, fields);
  row.updatedAt = new Date().toISOString();
  return seoResponse(row);
}

/* ── api.siteSettings.get / updateAnalytics (convex/siteSettings.ts) ── */

export function getSiteSettings(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = mustHaveSiteOf(sites, siteId);
  return { ...site.siteSettings };
}

export function updateAnalytics(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  fields: { analyticsGa4?: string; analyticsGtm?: string; analyticsSearchConsole?: string },
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.CONTENT_UPDATE);
  const site = mustHaveSiteOf(sites, siteId);
  /* Production parity (convex/siteSettings.ts updateAnalytics): patch
   * {fields, analyticsUpdatedAt: Date.now()} — a NUMBER, not ISO. */
  Object.assign(site.siteSettings, { ...fields, analyticsUpdatedAt: Date.now() });
  return { ...site.siteSettings };
}

/* Mirror of the other siteSettings section mutations. Production gates:
 *   updateIdentity/updateBranding → DESIGN_MANAGE (superAdmin-only)
 *   updateContact/updateSeo/updateLegal/updateEventDisplay → CONTENT_UPDATE
 *   updateIntegrations → INTEGRATIONS_MANAGE (superAdmin-only)
 * Each patches its fields + a `<section>UpdatedAt: Date.now()` number. */
export function updateSiteSettingsSection(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  section: "identity" | "branding" | "contact" | "seo" | "integrations" | "legal" | "events",
  fields: Record<string, unknown>,
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  const gate =
    section === "identity" || section === "branding" ? "design.manage"
    : section === "integrations" ? "integrations.manage"
    : P.CONTENT_UPDATE;
  mustHavePermission(users, clerkUserId, siteId, gate);
  const site = mustHaveSiteOf(sites, siteId);
  const stampKey = `${section === "events" ? "events" : section}UpdatedAt`;
  Object.assign(site.siteSettings, { ...fields, [stampKey]: Date.now() });
  return { ...site.siteSettings };
}

/* ── api.healthScans.* (convex/healthScans.ts) ── */

export function getLatestScan(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return null;
  const site = mustHaveSiteOf(sites, siteId);
  const sorted = [...site.healthScans].sort((a, b) => b.scannedAt - a.scannedAt);
  const s = sorted[0];
  return s ? { ...s } : null;
}

export function getScanHistory(sites: StoreSite[], clerkUserId: string, siteId: string, limit: number) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return [];
  const site = mustHaveSiteOf(sites, siteId);
  return [...site.healthScans]
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, limit ?? 30)
    .map((s) => ({ ...s }));
}

export function getHealthNotifications(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return [];
  const site = mustHaveSiteOf(sites, siteId);
  /* Production parity: getNotifications filters dismissedAt. */
  return site.healthNotifications.filter((n) => !n.dismissedAt).map((n) => ({ ...n }));
}

export function getUnreadNotificationCount(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return 0;
  const site = mustHaveSiteOf(sites, siteId);
  return site.healthNotifications.filter((n) => !n.readAt && !n.dismissedAt).length;
}

export function dismissHealthNotification(users: StoreUser[], sites: StoreSite[], clerkUserId: string, notificationId: string) {
  const site = sites.find((s) => s.healthNotifications.some((n) => n.id === notificationId));
  if (!site) throw new Error("Notification not found");
  /* Production parity: DEPLOYMENT_MANAGE is superAdmin-only — clients get
   * Forbidden and the HealthMonitor UI catches + ignores it. */
  mustHavePermission(users, clerkUserId, site.siteId, "deployment.manage");
  const n = site.healthNotifications.find((x) => x.id === notificationId)!;
  n.dismissedAt = Date.now();
  return null;
}

export function markAllNotificationsRead(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  const site = sites.find((s) => s.siteId === siteId);
  if (!site) throw new Error("Site not found");
  mustHavePermission(users, clerkUserId, siteId, "deployment.manage");
  const now = Date.now();
  for (const n of site.healthNotifications) {
    if (!n.readAt) n.readAt = now;
  }
  return null;
}

/* Mirror of convex/healthScans.ts markNotificationRead (DEPLOYMENT_MANAGE). */
export function markNotificationRead(users: StoreUser[], sites: StoreSite[], clerkUserId: string, notificationId: string) {
  const site = sites.find((s) => s.healthNotifications.some((n) => n.id === notificationId));
  if (!site) throw new Error("Notification not found");
  mustHavePermission(users, clerkUserId, site.siteId, "deployment.manage");
  const n = site.healthNotifications.find((x) => x.id === notificationId)!;
  n.readAt = Date.now();
  return null;
}

/* Mirror of convex/healthScans.ts triggerScan (an ACTION): gated by site
 * access only (no permission), runs the scan, returns { success: true }.
 * The scan run mirrors runScanForSite's effect: a fresh healthScans row
 * (site access re-verified) is recorded with a slightly refreshed score. */
export function triggerScan(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) {
    throw new Error("Forbidden: site access required");
  }
  const site = sites.find((s) => s.siteId === siteId)!;
  const last = [...site.healthScans].sort((a, b) => b.scannedAt - a.scannedAt)[0];
  const scannedAt = Date.now();
  site.healthScans.push({
    id: nextId("scan"),
    siteId,
    overallScore: last ? Math.min(100, last.overallScore + 1) : 88,
    status: "completed",
    categoryScores: last
      ? Object.fromEntries(Object.entries(last.categoryScores).map(([k, v]) => [k, { ...v }]))
      : {},
    scannedAt,
  });
  return { success: true };
}

/* ── api.accessControl.getMyPermissions (convex/accessControl.ts) ── */

export function getMyPermissions(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  const user = findUser(users, clerkUserId);
  if (!user || !user.isActive) return null;
  if (user.isSuperAdmin) {
    const full: Record<string, Level> = {};
    for (const mod of DASHBOARD_MODULES) full[mod] = "manage";
    return { isSuperAdmin: true, role: null, permissions: full };
  }
  const siteRole = user.roles.find((r: any) => r.siteId === siteId);
  if (!siteRole) return null;
  const defaults = ROLE_CAPABILITIES[siteRole.role] ?? {};
  const permissions: Record<string, Level> = {};
  for (const mod of DASHBOARD_MODULES) {
    permissions[mod] = (defaults[mod] ?? "none") as Level;
  }
  return { isSuperAdmin: false, role: siteRole.role, permissions };
}

/* ── api.users.me (convex/users.ts toUserResponse) ── */

export function getMe(users: StoreUser[], sites: StoreSite[], clerkUserId: string) {
  const user = findUser(users, clerkUserId);
  if (!user) return null;
  const sitesMap = new Map(sites.map((s) => [s.siteId, s.slug === "harborview" ? "Harborview Dental" : s.slug === "riverside" ? "Riverside Family Dental" : s.slug]));
  /* Production parity (convex/users.ts toUserResponse): {...user, id,
   * createdAt, roleAssignments}. The dashboard ALSO reads me._id (sidebar
   * hydration, WelcomeTour userId) and me.roles/[siteId,role] (WebsiteSettings
   * per-tab RBAC, AppLayout chrome) — include both spellings. */
  return {
    ...user,
    _id: user.clerkUserId,
    id: user.clerkUserId,
    createdAt: new Date().toISOString(),
    name: user.name,
    email: user.email ?? null,
    isSuperAdmin: user.isSuperAdmin,
    isActive: user.isActive,
    roles: user.roles,
    roleAssignments: user.roles.map((r: any) => ({
      siteId: r.siteId,
      siteName: sitesMap.get(r.siteId) ?? "Unknown site",
      role: r.role,
    })),
  };
}

/* ── api.sites.getDashboardSummary (convex/sites.ts, zero-count seed) ── */

export function getDashboardSummary(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  const user = findUser(users, clerkUserId);
  if (!user || !user.isActive) return null;
  if (!user.isSuperAdmin && !user.roles.some((r: any) => r.siteId === siteId)) return null;
  const site = sites.find((s) => s.siteId === siteId);
  if (!site) return null;
  return {
    siteId,
    courseCount: 0,
    eventCount: 0,
    articleCount: 0,
    serviceCount: 0,
    teamCount: 0,
    publishedArticles: 0,
    draftArticles: 0,
    mediaCount: site.mediaAssets.length,
    lastBackupAt: null,
    squareConnected: false,
    emailConfigured: false,
    formsConfigured: false,
    websiteOnline: null,
    sslActive: null,
    responseTimeMs: null,
    recentActivity: [],
    recentSubmissions: [],
    unreadSubmissionCount: 0,
    upcomingEvents: [],
    upcomingCourses: [],
    seoPagesConfigured: site.seoRows.filter((r) => r.title).length,
    recentMedia: [...site.mediaAssets]
      .sort((a: any, b: any) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0))
      .slice(0, 6)
      .map((m: any) => ({
        id: m.id,
        fileName: m.fileName,
        url: m.url ?? null,
        thumbnailUrl: null,
        altText: m.altText ?? null,
        createdAt: m.uploadedAt ? new Date(m.uploadedAt).toISOString() : null,
      })),
  };
}

/* ── api.downloads.generateUploadUrl / createFromStorage (convex/downloads.ts) ── */

export function generatePdfUploadUrl(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string, mimeType: string | undefined, convexOrigin: string) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.CONTENT_CREATE);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "downloads");
  if (mimeType !== undefined && mimeType !== "application/pdf") {
    throw new Error(`MIME type "${mimeType}" is not permitted for downloads uploads (PDF only)`);
  }
  /* Production parity (convex/downloads.ts): ctx.storage.generateUploadUrl()
   * resolves to a BARE URL STRING, not an object. The client does
   * `fetch(uploadUrl, {method:"PUT"})` directly. */
  return `${convexOrigin}/harness/upload`;
}

export function createDownloadFromStorage(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  args: { storageId: string; title: string; description?: string; fileName: string; sizeBytes: number; category?: string; isActive?: boolean },
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.CONTENT_CREATE);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "downloads");
  const stored = storageBlobs.get(args.storageId);
  if (!stored) throw new Error("Uploaded file could not be found — try again.");
  const id = nextId("dl");
  const sizeLabel = formatSizeLabel(args.sizeBytes);
  const row = {
    id,
    siteId,
    storageId: args.storageId,
    url: `${convexOriginPublic}/harness/storage/${args.storageId}`,
    title: args.title,
    description: args.description ?? undefined,
    format: "PDF",
    sizeLabel: sizeLabel || undefined,
    category: args.category,
    isActive: args.isActive ?? true,
    order: site.downloads.length,
    fileName: args.fileName,
    label: args.title,
    filename: args.fileName,
  };
  site.downloads.push(row as any);
  return { ...row, id };
}

function formatSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/* Upload blob registry — /harness/upload PUT writes here, storage URLs
 * read from here. Convex storage parity: opaque storageId, content-type
 * preserved, served from the convex origin. */
export const storageBlobs = new Map<string, { contentType: string; bytes: Buffer; uploadedAt: number }>();
/* Filled by runtime.mjs at boot (server origin for public storage URLs). */
export let convexOriginPublic = "https://127.0.0.1:7788";
export function setConvexOriginForStorage(origin: string) {
  convexOriginPublic = origin;
}

/* ── api.media.generateUploadUrl parity (image uploads: MEDIA_UPLOAD + image/* only) ── */

export function generateMediaUploadUrl(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string, mimeType: string | undefined, convexOrigin: string) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.MEDIA_UPLOAD);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "media");
  if (mimeType && !mimeType.startsWith("image/")) {
    throw new Error(`MIME type "${mimeType}" is not permitted for media uploads`);
  }
  /* Production parity (convex/media.ts): ctx.storage.generateUploadUrl()
   * resolves to a BARE URL STRING. */
  return `${convexOrigin}/harness/upload`;
}

/* ── api.media.create / healthStats parity (convex/media.ts) ── */

export function createMediaAsset(
  users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string,
  args: { storageId?: string; url?: string; fileName: string; mimeType: string; sizeBytes: number;
          optimizedSizeBytes?: number; width?: number; height?: number; altText?: string; focalX?: number; focalY?: number },
) {
  requireAccessStore(users, sites, clerkUserId, siteId);
  mustHavePermission(users, clerkUserId, siteId, P.MEDIA_UPLOAD);
  const site = mustHaveSiteOf(sites, siteId);
  mustHaveModule(site, "media");
  if (!args.storageId && !args.url) throw new Error("Either storageId or url is required");
  /* Production parity (buildResponse): storageId → ctx.storage.getUrl. */
  const url = args.storageId
    ? (storageBlobs.has(args.storageId) ? `${convexOriginPublic}/harness/storage/${args.storageId}` : null)
    : (args.url ?? null);
  const row = {
    id: nextId("media"),
    siteId,
    ...(args.storageId ? { storageId: args.storageId } : {}),
    ...(args.url ? { url: args.url } : {}),
    url,
    fileName: args.fileName,
    mimeType: args.mimeType,
    sizeBytes: args.sizeBytes,
    uploadedAt: Date.now(),
    ...(args.optimizedSizeBytes !== undefined ? { optimizedSizeBytes: args.optimizedSizeBytes } : {}),
    ...(args.width !== undefined ? { width: args.width } : {}),
    ...(args.height !== undefined ? { height: args.height } : {}),
    ...(args.altText ? { altText: args.altText } : {}),
    ...(args.focalX !== undefined ? { focalX: args.focalX } : {}),
    ...(args.focalY !== undefined ? { focalY: args.focalY } : {}),
  };
  site.mediaAssets.push(row);
  return { ...row };
}

export function mediaHealthStats(sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) return { total: 0, healthy: 0, broken: 0 };
  const site = mustHaveSiteOf(sites, siteId);
  if (!moduleEnabled(site, "media")) return { total: 0, healthy: 0, broken: 0 };
  let broken = 0;
  for (const doc of site.mediaAssets) {
    if (!doc.storageId && typeof doc.url === "string" && doc.url.startsWith("data:")) broken++;
  }
  return { total: site.mediaAssets.length, healthy: site.mediaAssets.length - broken, broken };
}

/* Shared requireAccess mirror for the extended functions (store-level). */
function requireAccessStore(users: StoreUser[], sites: StoreSite[], clerkUserId: string, siteId: string) {
  if (!userHasAccess(sites, clerkUserId, siteId)) {
    throw new Error("Forbidden: site access required");
  }
}

/* renderRef: late-bound to avoid import cycles in the bundle graph. */
import { renderBlockHtml, renderZoneHtml } from "./pipeline.mjs";
const renderRef = { renderBlockHtml, renderZoneHtml };
