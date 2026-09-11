/**
 * runtime.mjs — acting-user state + convex-API dispatcher + boot.
 *
 * Layers on the server core (server.mjs): the ACTING-USER switch (the login
 * layer production gets from Clerk — the harness exposes it as a control
 * endpoint for the tenant-isolation proof, flow 15), and the dispatcher
 * that routes string api paths ("editorZones.addBlock") to the SAME store
 * functions that mirror the production convex/*.ts contracts.
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

/* ══ Acting user (harness-only login layer) */
let actingUser = "user_alice"; // Alice — Harborview (flow 15 switches to Bob)

function requireAccess(siteId) {
  if (!store.userHasAccess(store.sites, actingUser, siteId)) {
    throw new Error("Forbidden: site access required");
  }
}

/* ══ Queries — each entry mirrors a production convex function */
/* Production parity: QUERIES return null/[] when the caller lacks site
 * access (checkSiteAccess in convex/contentMap.ts, publishing.ts,
 * editor.ts, editorZones.ts, downloads.ts); only MUTATIONS throw
 * Forbidden. The dispatcher therefore lets each store query apply its
 * own access check -- requireAccess is for mutations only. */
const queries = {
  "contentMap.get": (args) => store.getContentMap(store.sites, actingUser, args.siteId),
  "publishing.canPublish": (args) => store.canPublish(store.sites, actingUser, args.siteId),
  "editor.editorRevisions": (args) => store.editorRevisions(store.sites, actingUser, args.siteId),
  "editorZones.listZoneBlocks": (args) => store.listZoneBlocks(store.sites, actingUser, args.siteId),
  "editorZones.zoneSummaries": (args) => store.zoneSummaries(store.sites, actingUser, args.siteId),
  "editorZones.structuralsFor": (args) => store.structuralsFor(store.sites, actingUser, args.siteId),
  "downloads.list": (args) => store.listDownloads(store.sites, actingUser, args.siteId),
  "forms.list": () => [],
  "users.me": () => ({
    _id: actingUser,
    name: store.users.find((u) => u.clerkUserId === actingUser)?.name ?? actingUser,
    roles: [],
    isSuperAdmin: false,
  }),
  "sites.get": (args) => {
    if (!store.userHasAccess(store.sites, actingUser, args.siteId)) return null;
    const s = store.sites.find((x) => x.siteId === args.siteId);
    if (!s) return null;
    return {
      siteId: s.siteId,
      slug: s.slug,
      domain: s.domain,
      name: s.slug === "harborview" ? "Harborview Dental" : "Riverside Family Dental",
      status: "active",
    };
  },
  "sites.list": () =>
    store.sites
      .filter((s) => store.userHasAccess(store.sites, actingUser, s.siteId))
      .map((s) => ({ siteId: s.siteId, slug: s.slug, domain: s.domain, name: s.slug })),
  /* AppLayout chrome (REAL sidebar/SiteDashboard) */
  "sites.getEffectiveModules": (args) => {
    if (!store.userHasAccess(store.sites, actingUser, args.siteId)) return null;
    return { siteId: args.siteId, modules: [] };
  },
  "healthScans.getUnreadNotificationCount": () => 0,
  "media.healthStats": () => ({ totalAssets: 0, totalBytes: 0, untagged: 0, missingAlt: 0, broken: 0 }),
  "agencies.get": () => null,
};

/* ══ Mutations — every entry a REAL production contract mirror */
const mutations = {
  "publishing.saveDraft": (args) => {
    requireAccess(args.siteId);
    return store.saveDraft(store.sites, actingUser, args.siteId, args.entries);
  },
  "publishing.publishContentMap": (args) => {
    requireAccess(args.siteId);
    return store.publishContentMap(store.sites, actingUser, args.siteId);
  },
  "publishing.discardDraft": (args) => {
    requireAccess(args.siteId);
    return store.discardDraft(store.sites, actingUser, args.siteId, args.keys ?? []);
  },
  "editor.restoreAsDraft": (args) => {
    requireAccess(args.siteId);
    return store.restoreAsDraft(store.sites, actingUser, args.siteId, args.revisionId);
  },
  "editor.createFrameToken": (args) => {
    requireAccess(args.siteId);
    return store.createFrameToken(store.sites, actingUser, args.siteId, args.path ?? "/");
  },
  "editorZones.addBlock": (args) => {
    requireAccess(args.siteId);
    return store.addBlock(store.sites, actingUser, args.siteId, args.pagePath, args.zone, args.content);
  },
  "editorZones.updateBlock": (args) => {
    requireAccess(args.siteId);
    return store.updateBlock(store.sites, actingUser, args.siteId, args.blockId, args.content);
  },
  "editorZones.removeBlock": (args) => {
    requireAccess(args.siteId);
    return store.removeBlock(store.sites, actingUser, args.siteId, args.blockId);
  },
  "editorZones.restoreBlock": (args) => {
    requireAccess(args.siteId);
    return store.restoreBlock(store.sites, actingUser, args.siteId, args.blockId);
  },
  "editorZones.reorderBlock": (args) => {
    requireAccess(args.siteId);
    // Production parity (convex/editorZones.ts reorderBlock): the caller
    // sends {siteId, pagePath, zone, orderedIds} - an EXACT-SET reorder.
    return store.reorderBlock(store.sites, actingUser, args.siteId, args.pagePath, args.zone, args.orderedIds ?? []);
  },
  "editorZones.setStructuralOps": (args) => {
    requireAccess(args.siteId);
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
    return store.publishBlocks(store.sites, actingUser, args.siteId);
  },
  "editorZones.discardBlocks": (args) => {
    requireAccess(args.siteId);
    return store.discardBlocks(store.sites, actingUser, args.siteId);
  },
  "media.generateUploadUrl": () => ({ uploadUrl: `${CONVEX_ORIGIN}/harness/upload` }),
  "healthScans.markAllNotificationsRead": () => null,
  "media.create": (args) => {
    requireAccess(args.siteId);
    return {
      id: "media_" + (args.fileName ?? "image").replace(/[^a-z0-9]+/gi, "_").slice(0, 20),
      url: args.url ?? null,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes ?? 0,
      altText: args.altText ?? null,
      storageId: args.storageId ?? null,
    };
  },
};

/* ══ Actions */
const actions = {
  "ai.generateAltText": () => "A friendly dental office reception area.",
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

/* ══ Dashboard origin: driver page + Playwright control API ═════════════ */
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
     * REAL VisualEditor driver page. POST /harness/api { path, args, kind } */
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

    /* Driver page: the REAL VisualEditor component + convex/react shim */
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
/* ══ Boot ═════════════════════════════════════════════════════════════════ */
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
