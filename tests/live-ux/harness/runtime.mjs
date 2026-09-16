/**
 * runtime.mjs — acting-user state + convex-API dispatcher + boot.
 *
 * Layers on the server core (server.mjs): the ACTING-USER switch (the login
 * layer production gets from Clerk — the harness exposes it as a control
 * endpoint for the tenant-isolation proof, flow 15), and the dispatcher
 * that routes string api paths ("editorZones.addBlock") to the SAME store
 * functions that mirror the production convex/*.ts contracts.
 *
 * Chat D owner-acceptance parity: the dispatcher now covers the full api.*
 * surface the four driver components (AppLayout/SiteDashboard,
 * VisualEditor, WebsiteSettings, HealthMonitor) consume — every query with
 * its production response shape, every mutation with its EXACT permission
 * gate (store.mustHavePermission + store.P.*), so the read_only forbidden
 * proof (§9) fails with the same "Forbidden: your role does not grant
 * '<permission>' on this site." message production throws.
 */
import https from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const dist = join(ROOT, "dist");

const core = await import("./server.mjs");
const bootCore = core.default;
const { CONVEX_ORIGIN, DASHBOARD_ORIGIN, SITE_DOMAIN, json, CORS } = core;
const { ensureCert, CERT_FILE, KEY_FILE } = await import(join(ROOT, "scripts/make-cert.mjs"));

/* Boot core FIRST: site listen -> REAL crawl/store -> convex listen. */
const booted = await bootCore();
const { siteServer, convexServer } = booted;

/* The store IS the free-function module + { users, sites } (see server.mjs
 * bootCore): one callable surface for the dispatcher below. */
const store = booted.store;

/* Public storage URLs (downloads/media rows) must point at THIS convex
 * origin — the same origin /harness/storage/:id serves from. */
store.setConvexOriginForStorage(CONVEX_ORIGIN);

/* Presentation names for sites.get/sites.list (production sites docs carry
 * the business name; the harness seeds only slugs). */
const SITE_NAMES = {
  harborview: "Harborview Dental",
  riverside: "Riverside Family Dental",
};

/* ══ Acting user (harness-only login layer) */
let actingUser = "user_alice"; // Alice — Harborview (flow 15 switches to Bob)

function requireAccess(siteId) {
  if (!store.userHasAccess(store.sites, actingUser, siteId)) {
    throw new Error("Forbidden: site access required");
  }
}

/* Production permission gate for the dispatcher-level mutations (the store
 * mirrors of publishing/editorZones only check site access — the convex
 * functions gate on requirePermission, so the dispatcher adds it here). */
function requirePermission(siteId, permission) {
  store.mustHavePermission(store.users, actingUser, siteId, permission);
}

/* Strip siteId (and undefined-valued keys — JSON never carries them, but a
 * direct dispatch call could) from a mutation arg object. */
function fieldsOf(args) {
  const out = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (k === "siteId" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/* ══ Queries — each entry mirrors a production convex function */
/* Production parity: QUERIES return null/[] when the caller lacks site
 * access (checkSiteAccess in convex/contentMap.ts, publishing.ts,
 * editor.ts, editorZones.ts, downloads.ts); only MUTATIONS throw
 * Forbidden. The dispatcher therefore lets each store query apply its
 * own access check — requireAccess is for mutations only. */
const queries = {
  "contentMap.get": (args) => store.getContentMap(store.sites, actingUser, args.siteId),
  "publishing.canPublish": (args) => store.canPublish(store.sites, actingUser, args.siteId),
  "editor.editorRevisions": (args) => store.editorRevisions(store.sites, actingUser, args.siteId),
  "editorZones.listZoneBlocks": (args) => store.listZoneBlocks(store.sites, actingUser, args.siteId),
  "editorZones.zoneSummaries": (args) => store.zoneSummaries(store.sites, actingUser, args.siteId),
  "editorZones.structuralsFor": (args) => store.structuralsFor(store.sites, actingUser, args.siteId),
  "downloads.list": (args) => store.listDownloads(store.sites, actingUser, args.siteId),
  "forms.list": () => [],
  /* convex/users.ts me → toUserResponse (…spread + id/createdAt/
   * roleAssignments; the dashboard also reads _id/roles/email/isSuperAdmin). */
  "users.me": () => store.getMe(store.users, store.sites, actingUser),
  /* convex/sites.ts get → toSiteResponse (AppLayout chrome reads
   * name/logoUrl/status/domain/poweredByFsts; the connection-mode chip
   * reads connectionMode off the raw doc). */
  "sites.get": (args) => {
    if (!store.userHasAccess(store.sites, actingUser, args.siteId)) return null;
    const s = store.sites.find((x) => x.siteId === args.siteId);
    if (!s) return null;
    return {
      siteId: s.siteId,
      slug: s.slug,
      domain: s.domain,
      name: SITE_NAMES[s.slug] ?? s.slug,
      status: "active",
      logoUrl: null,
      faviconUrl: null,
      poweredByFsts: true,
      whiteLabelEnabled: false,
      connectionMode: s.connectionMode,
    };
  },
  "sites.list": () =>
    store.sites
      .filter((s) => store.userHasAccess(store.sites, actingUser, s.siteId))
      .map((s) => ({ siteId: s.siteId, slug: s.slug, domain: s.domain, name: SITE_NAMES[s.slug] ?? s.slug })),
  /* convex/sites.ts getEffectiveModules: FLAT Record<string, boolean>
   * (site.enabledModules ?? {}) — null when the caller lacks access. */
  "sites.getEffectiveModules": (args) => {
    if (!store.userHasAccess(store.sites, actingUser, args.siteId)) return null;
    const s = store.sites.find((x) => x.siteId === args.siteId);
    if (!s) return null;
    return { ...(s.enabledModules ?? {}) };
  },
  /* convex/sites.ts getDashboardSummary (zero-count seed + mediaCount +
   * recentMedia + seoPagesConfigured). */
  "sites.getDashboardSummary": (args) => store.getDashboardSummary(store.users, store.sites, actingUser, args.siteId),
  /* convex/accessControl.ts getMyPermissions ({isSuperAdmin, role,
   * permissions} over the dashboard modules). */
  "accessControl.getMyPermissions": (args) => store.getMyPermissions(store.users, store.sites, actingUser, args.siteId),
  /* convex/seo.ts list (seoSettings rows; gated on the seo module inside
   * the store mirror). */
  "seo.list": (args) => store.listSeo(store.users, store.sites, actingUser, args.siteId),
  /* convex/siteSettings.ts get (EMPTY defaults, {…doc, id}). */
  "siteSettings.get": (args) => store.getSiteSettings(store.users, store.sites, actingUser, args.siteId),
  /* convex/healthScans.ts */
  "healthScans.getLatestScan": (args) => store.getLatestScan(store.sites, actingUser, args.siteId),
  "healthScans.getScanHistory": (args) => store.getScanHistory(store.sites, actingUser, args.siteId, args.limit),
  "healthScans.getNotifications": (args) => store.getHealthNotifications(store.sites, actingUser, args.siteId),
  "healthScans.getUnreadNotificationCount": (args) => store.getUnreadNotificationCount(store.sites, actingUser, args.siteId),
  /* convex/media.ts healthStats ({total, healthy, broken}). */
  "media.healthStats": (args) => store.mediaHealthStats(store.sites, actingUser, args.siteId),
  /* Modules not enabled in the harness seeds (enabledModules {}): the
   * production queries return [] when checkModuleEnabled fails. */
  "courses.listActionRequired": () => [],
  "events.listActionRequired": () => [],
  "flyers.listExpiringSoon": () => [],
  /* convex/crm.ts getSyncStats: no crmConnections row → null (the health
   * page renders the "No Operon CRM connection configured" card). */
  "crm.getSyncStats": () => null,
  /* AppLayout only queries agencies.get when site.agencyId exists; the
   * harness seeds have no agency. Keep the mirror for completeness. */
  "agencies.get": () => null,
};

/* ══ Mutations — every entry a REAL production contract mirror */
const mutations = {
  "publishing.saveDraft": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.saveDraft(store.sites, actingUser, args.siteId, args.entries);
  },
  "publishing.publishContentMap": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.publishContentMap(store.sites, actingUser, args.siteId);
  },
  "publishing.discardDraft": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.discardDraft(store.sites, actingUser, args.siteId, args.keys ?? []);
  },
  "editor.restoreAsDraft": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.restoreAsDraft(store.sites, actingUser, args.siteId, args.revisionId);
  },
  /* convex/editor.ts createFrameToken: site-access ONLY (no permission) —
   * the frame link is the read path into the editor. */
  "editor.createFrameToken": (args) => {
    requireAccess(args.siteId);
    return store.createFrameToken(store.sites, actingUser, args.siteId, args.path ?? "/");
  },
  "editorZones.addBlock": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_CREATE);
    return store.addBlock(store.sites, actingUser, args.siteId, args.pagePath, args.zone, args.content);
  },
  "editorZones.updateBlock": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.updateBlock(store.sites, actingUser, args.siteId, args.blockId, args.content);
  },
  "editorZones.removeBlock": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_DELETE);
    return store.removeBlock(store.sites, actingUser, args.siteId, args.blockId);
  },
  "editorZones.restoreBlock": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.restoreBlock(store.sites, actingUser, args.siteId, args.blockId);
  },
  "editorZones.reorderBlock": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    // Production parity (convex/editorZones.ts reorderBlock): the caller
    // sends {siteId, pagePath, zone, orderedIds} - an EXACT-SET reorder.
    return store.reorderBlock(store.sites, actingUser, args.siteId, args.pagePath, args.zone, args.orderedIds ?? []);
  },
  "editorZones.setStructuralOps": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    // Production parity (convex/editorZones.ts setStructuralOps): FLAT
    // args {siteId, pagePath, itemOrder, hiddenItems} - never a nested
    // .ops object (undefined kills the store call, no preview fires).
    return store.setStructuralOps(store.sites, actingUser, args.siteId, args.pagePath, {
      itemOrder: args.itemOrder,
      hiddenItems: args.hiddenItems,
    });
  },
  "editorZones.publishBlocks": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.publishBlocks(store.sites, actingUser, args.siteId);
  },
  "editorZones.discardBlocks": (args) => {
    requireAccess(args.siteId);
    requirePermission(args.siteId, store.P.CONTENT_UPDATE);
    return store.discardBlocks(store.sites, actingUser, args.siteId);
  },
  /* convex/seo.ts create/update (CONTENT_CREATE/CONTENT_UPDATE + seo
   * module gate — inside the store mirror). */
  "seo.create": (args) =>
    store.createSeo(store.users, store.sites, actingUser, args.siteId, fieldsOf(args)),
  "seo.update": (args) =>
    store.updateSeo(store.users, store.sites, actingUser, args.siteId, {
      seoSettingId: args.seoSettingId,
      ...fieldsOf(args),
    }),
  /* convex/siteSettings.ts updateAnalytics (CONTENT_UPDATE — the Chat D
   * client-safe GA4/GTM/Search Console save). */
  "siteSettings.updateAnalytics": (args) =>
    store.updateAnalytics(store.users, store.sites, actingUser, args.siteId, fieldsOf(args)),
  /* convex/siteSettings.ts section mutations: identity/branding gate on
   * design.manage, integrations on integrations.manage (both SuperAdmin-
   * only in production), contact/seo/legal/events on content.update. The
   * gates live inside the store mirror (updateSiteSettingsSection). */
  "siteSettings.updateIdentity": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "identity", fieldsOf(args)),
  "siteSettings.updateBranding": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "branding", fieldsOf(args)),
  "siteSettings.updateContact": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "contact", fieldsOf(args)),
  "siteSettings.updateSeo": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "seo", fieldsOf(args)),
  "siteSettings.updateIntegrations": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "integrations", fieldsOf(args)),
  "siteSettings.updateLegal": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "legal", fieldsOf(args)),
  "siteSettings.updateEventDisplay": (args) =>
    store.updateSiteSettingsSection(store.users, store.sites, actingUser, args.siteId, "events", fieldsOf(args)),
  /* convex/sites.ts update: SuperAdmin ONLY ("Forbidden") — the Modules
   * tab design lock. Mirrors the production patch (enabledModules etc.). */
  "sites.update": (args) => {
    const user = store.users.find((u) => u.clerkUserId === actingUser);
    if (!user?.isSuperAdmin) throw new Error("Forbidden");
    const site = store.sites.find((s) => s.siteId === args.siteId);
    if (!site) throw new Error("Site not found");
    const fields = fieldsOf(args);
    Object.assign(site, fields);
    return { ...site, id: site.siteId };
  },
  /* convex/downloads.ts generateUploadUrl (CONTENT_CREATE + downloads
   * module + PDF-only) / createFromStorage (storageId must exist). */
  "downloads.generateUploadUrl": (args) =>
    store.generatePdfUploadUrl(store.users, store.sites, actingUser, args.siteId, args.mimeType, CONVEX_ORIGIN),
  "downloads.createFromStorage": (args) =>
    store.createDownloadFromStorage(store.users, store.sites, actingUser, args.siteId, fieldsOf(args)),
  /* convex/healthScans.ts dismiss/mark (DEPLOYMENT_MANAGE — SuperAdmin-
   * only in production; the harness owner will be Forbidden, which is the
   * production parity the health page's catch-and-ignore handlers expect). */
  "healthScans.dismissNotification": (args) =>
    store.dismissHealthNotification(store.users, store.sites, actingUser, args.notificationId),
  "healthScans.markNotificationRead": (args) =>
    store.markNotificationRead(store.users, store.sites, actingUser, args.notificationId),
  "healthScans.markAllNotificationsRead": (args) =>
    store.markAllNotificationsRead(store.users, store.sites, actingUser, args.siteId),
  /* convex/media.ts generateUploadUrl (MEDIA_UPLOAD + media module +
   * image/* only) / create (buildResponse parity). */
  "media.generateUploadUrl": (args) =>
    store.generateMediaUploadUrl(store.users, store.sites, actingUser, args.siteId, args.mimeType, CONVEX_ORIGIN),
  "media.create": (args) =>
    store.createMediaAsset(store.users, store.sites, actingUser, args.siteId, fieldsOf(args)),
};

/* ══ Actions */
const actions = {
  /* convex/ai.ts actions — production return shapes ({altText},
   * {description}, {content}, {configured, model}). No AI provider in
   * this environment: status reports unconfigured (truthful), while the
   * generate actions return canned text so the editor UX flows work. */
  "ai.generateAltText": () => ({ altText: "A friendly dental office reception area with a warm welcome desk." }),
  "ai.generateMetaDescription": (args) => ({
    description: `Learn more about ${args.pageTitle ?? "our practice"} — friendly care, flexible scheduling, and a team that puts you first.`,
  }),
  "ai.chat": (args) => ({
    content:
      "I can help you edit this page. Try updating your headline, swapping the hero image, or changing a button's label — click any element in the preview to start.",
  }),
  "ai.status": () => ({ configured: false, model: null }),
  /* convex/healthScans.ts triggerScan: site-access only (an ACTION), runs
   * the scan, returns { success: true }. */
  "healthScans.triggerScan": (args) => store.triggerScan(store.sites, actingUser, args.siteId),
};

function setActingUser(userId) {
  const known = store.users.find((u) => u.clerkUserId === userId);
  if (!known) throw new Error("unknown user");
  actingUser = userId;
}

function getActingUser() {
  return actingUser;
}

const dispatch = { queries, mutations, actions };

/* ══ Dashboard origin: driver page + Playwright control API ════════════ */
const dashboardServer = https.createServer(
  { key: readFileSync(KEY_FILE), cert: readFileSync(CERT_FILE) },
  async (req, res) => {
    const url = new URL(req.url, DASHBOARD_ORIGIN);
    const p = url.searchParams;

    /* Playwright control: switch acting user (tenant isolation, flow 15) */
    if (url.pathname === "/harness/acting-user") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        await new Promise((r) => req.on("end", r));
        try {
          const { userId } = JSON.parse(body || "{}");
          setActingUser(userId);
          return json(res, 201, { actingUser: userId });
        } catch (e) {
          return json(res, 400, { error: e?.message ?? "unknown user" });
        }
      }
      return json(res, 200, { actingUser: getActingUser() });
    }

    /* Playwright control: reset both sites to pristine (between flows) */
    if (url.pathname === "/harness/reset") {
      if (req.method === "POST") {
        /* Re-crawl the live site origin (still listening) - pristine maps,
         * no drafts, no revisions, no tokens. Same function bootCore ran. */
        const base = await store.createHarnessStore(SITE_DOMAIN);
        store.users = base.users;
        store.sites.length = 0;
        store.sites.push(...base.sites);
        return json(res, 201, { ok: true });
      }
      return json(res, 405, { error: "POST only" });
    }

    /* Store debug snapshot (assertion aid; read-only) */
    if (url.pathname === "/harness/state") {
      return json(res, 200, {
        actingUser: getActingUser(),
        sites: store.sites.map((s) => ({
          siteId: s.siteId,
          slug: s.slug,
          members: s.members,
          keyCount: s.map.keyCount,
          drafts: Object.keys(s.map.entries).filter((k) => s.map.entries[k].draft !== undefined),
          pendingBlocks: s.blocks.filter((b) => !b.published).length,
          revisions: s.revisions.map((r) => r.revisionId),
        })),
      });
    }

    /* Convex-API dispatcher for the store-backed convex/react shim in the
     * REAL dashboard driver page. POST /harness/api { path, args, kind } */
    if (url.pathname === "/harness/api" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      await new Promise((r) => req.on("end", r));
      let req_;
      try {
        req_ = JSON.parse(body || "{}");
      } catch {
        return json(res, 400, { error: "invalid JSON body" });
      }
      const kind = req_.kind ?? "query";
      // shim paths arrive as "api.contentMap.get"; strip the api root.
      const path = (req_.path ?? "").replace(/^api\./, "");
      const args = req_.args ?? {};
      const table = kind === "query" ? dispatch.queries : kind === "mutation" ? dispatch.mutations : kind === "action" ? dispatch.actions : null;
      const fn = table ? table[path] : undefined;
      if (!fn) return json(res, 404, { error: `unknown function: ${kind} ${path}` });
      try {
        const result = fn(args);
        return json(res, 200, { ok: true, data: result === undefined ? null : result });
      } catch (e) {
        return json(res, 200, { ok: false, error: e?.message ?? String(e) });
      }
    }

    /* Driver page: the REAL dashboard components + convex/react shim */
    if (url.pathname === "/" || url.pathname === "/index.html"
        || url.pathname.startsWith("/app/")) {
      const html = readFileSync(join(dist, "parent.html"), "utf-8")
        .replace(/<script src="https:\/\/sites\.super\.myninja\.ai[^"]*"><\/script>/g, "");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(html);
      return;
    }
    if (url.pathname === "/parent.js" || url.pathname === "/app.js"
        || url.pathname === "/parent.js.map" || url.pathname === "/app.js.map") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      res.end(readFileSync(join(dist, "parent.js"), "utf-8"));
      return;
    }
    if (url.pathname.startsWith("/assets/")) {
      const file = join(dist, url.pathname);
      if (existsSync(file)) {
        const css = url.pathname.endsWith(".css");
        res.writeHead(200, {
          "Content-Type": css ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(readFileSync(file));
        return;
      }
    }

    json(res, 404, { error: "not found" });
  },
);
/* ══ Boot ══════════════════════════════════════════════════════════════ */
/* Boot: site+convex already listening via bootCore(); dashboard here. */
const DASHBOARD_PORT = 4173;
await new Promise((r) => dashboardServer.listen(DASHBOARD_PORT, "127.0.0.1", r));

console.log(`[harness] site      https://127.0.0.1:4175`);
console.log(`[harness] convex    https://127.0.0.1:7788`);
console.log(`[harness] dashboard https://127.0.0.1:${DASHBOARD_PORT}`);
console.log(`[harness] acting user: ${getActingUser()}`);
process.stdout.write(`[harness] ready\n`);

/* Keep alive; webServer teardown uses SIGTERM. */
setInterval(() => {}, 1 << 30);

export { dispatch, requireAccess, json, CORS, CONVEX_ORIGIN, DASHBOARD_ORIGIN, SITE_DOMAIN, store };
