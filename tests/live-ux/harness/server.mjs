/**
 * Harness server - the section 5 LIVE UX PROOF rig.
 *
 * Three origins, exactly like production:
 *
 *   1. SITE origin   (https://127.0.0.1:4175) - the customer's live site:
 *      the REAL test-site HTML (Harborview Dental) with the REAL bridge
 *      snippet embedded, and elements pre-annotated with the keys the
 *      crawl of THIS site stamps (mirrors the deployment story: FSTS
 *      installs the bridge by annotating the site and embedding the
 *      snippet; annotatePage is idempotent over tagged HTML).
 *
 *   2. CONVEX origin (https://127.0.0.1:7788) - mirrors convex/http.ts:
 *      GET /api/editor/frame?token&path  - burn-first single-use token,
 *      scope re-check + discovered-route allowlist, REAL fetchPage of the
 *      live page, REAL annotatePage, REAL buildFrameDocument, served with
 *      CSP frame-ancestors = dashboard origin.
 *      GET /api/bridge/content?slug=     - manifest + PUBLISHED values.
 *      GET /api/bridge/draft?slug&token= - token-gated draft overlay.
 *      POST /api/bridge/verify           - ownership ping.
 *
 *   3. DASHBOARD origin (https://127.0.0.1:4173) - served by runtime.mjs:
 *      the parent driver page (REAL VisualEditor.tsx bundled with a
 *      store-backed convex/react shim over /harness/api) and the Playwright
 *      control API (acting-user switching for the tenant-isolation proof).
 *
 * Node fetch (crawl + frame fetchPage) trusts the self-signed cert via
 * NODE_EXTRA_CA_CERTS. Chromium trusts it via --ignore-certificate-errors.
 *
 * BOOT ORDER (bootCore): the crawl (createHarnessStore) fetches the SITE
 * origin over Node fetch, so the site server must be listening BEFORE the
 * store is created - but the site handler needs the store for the bridge
 * snippet. Resolution: the site server reads the store through a LATE-
 * BOUND reference (SiteStore()) that bootCore fills in after the crawl.
 */
import https from "node:https";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

/* Late-bound REAL pipeline (built by scripts/bundle.mjs). */
const pipe = await import(join(ROOT, "dist/pipeline.mjs"));
const storeMod = await import(join(ROOT, "dist/store.mjs"));
const { createHarnessStore, bridgeSnippetFor } = storeMod;

const SITE_PORT = 4175;
const CONVEX_PORT = 7788;
const DASHBOARD_PORT = 4173;
const SITE_DOMAIN = "127.0.0.1:4175";
const CONVEX_ORIGIN = `https://127.0.0.1:${CONVEX_PORT}`;
const DASHBOARD_ORIGIN = `https://127.0.0.1:${DASHBOARD_PORT}`;

/* Late-bound store for the SITE origin (filled by bootCore after crawl).
 * Unused while siteStore is null; kept for defensive future use. */
let siteStore = null;

/* -- helpers -- */
function json(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const CORS = {
  "Access-Control-Allow-Origin": DASHBOARD_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* Bridge endpoints are fetched by the snippet on the CUSTOMER's site
 * origin, not the dashboard - production http.ts sends
 * Access-Control-Allow-Origin "*" for exactly this reason. Mirror it. */
const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function bridgeErr(res, status, error) {
  json(res, status, { error }, PUBLIC_CORS);
}

function bridgeOk(res, data) {
  json(res, 200, data, PUBLIC_CORS);
}

function certPem() {
  return readFileSync(join(ROOT, "certs", "cert.pem"));
}
function keyPem() {
  return readFileSync(join(ROOT, "certs", "key.pem"));
}

/* -- 1 -- SITE origin: the customer's live website -- */
function sitePageHtml(path) {
  const page = pipe.SITE_PAGES[path] ? pipe.SITE_PAGES[path]() : null;
  if (!page) return null;
  const annotated = pipe.annotatePage(page, path, `https://${SITE_DOMAIN}${path}`);
  /* During the initial crawl the store does not exist yet - serve the
   * annotated page WITHOUT the snippet (the crawl only needs the HTML).
   * All post-boot requests get the REAL bridge snippet injected. */
  if (!siteStore) return annotated;
  const snippet = bridgeSnippetFor(CONVEX_ORIGIN, "harborview");
  return annotated.replace("</body>", snippet + "</body>");
}

function makeSiteServer() {
  return https.createServer(
    { key: keyPem(), cert: certPem() },
    (req, res) => {
      const url = new URL(req.url, `https://${SITE_DOMAIN}`);
      let path = url.pathname;
      if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
      const html = sitePageHtml(path);
      if (!html) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
    },
  );
}

/* -- 2 -- CONVEX origin: mirrors convex/http.ts routes -- */
function makeConvexServer(store) {
  return https.createServer(
    { key: keyPem(), cert: certPem() },
    async (req, res) => {
      const url = new URL(req.url, CONVEX_ORIGIN);
      const p = url.searchParams;

      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        res.end();
        return;
      }

      /* -- GET /api/editor/frame - mirrors http.ts frame route -- */
      if (req.method === "GET" && url.pathname === "/api/editor/frame") {
        const token = p.get("token") ?? "";
        const routePath = p.get("path") ?? "/";
        if (!token) return json(res, 400, { error: "token required" }, CORS);

        // 1 - burn first: single-use, race-safe.
        const burn = store.burnFrameToken(store.sites, token);
        if (!burn) {
          return json(res, 401, { error: "This editor link has expired. Reopen the editor to continue." }, CORS);
        }

        // 2 - scope re-check + discovered-route allowlist.
        const site = store.frameSite(store.sites, burn, routePath);
        if (!site) {
          return json(res, 404, { error: "This page isn't available in the editor." }, CORS);
        }

        // 3 - bounded fetch of the live page (same caps as discovery).
        const origin = `https://${site.domain}`;
        const outcome = await pipe.fetchPage(`${origin}${site.path}`);
        if (!outcome.ok || !outcome.html) {
          return json(res, 502, { error: "The website couldn't be reached. Try again shortly." }, CORS);
        }

        // 4 - annotate + editor-safe document.
        const annotated = pipe.annotatePage(outcome.html, site.path, `${origin}${site.path}`);
        const doc = pipe.buildFrameDocument(annotated, {
          origin,
          path: site.path,
          slug: site.slug,
          dashboardOrigin: DASHBOARD_ORIGIN,
        });
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": `frame-ancestors ${DASHBOARD_ORIGIN}`,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(doc);
        return;
      }

      /* -- GET /api/bridge/content?slug= -- */
      if (req.method === "GET" && url.pathname === "/api/bridge/content") {
        const slug = p.get("slug") ?? "";
        if (!slug) return bridgeErr(res, 404, "slug required");
        const data = store.bridgeContent(store.sites, slug);
        if (!data) return bridgeErr(res, 404, "site not found");
        return bridgeOk(res, data);
      }

      /* -- GET /api/bridge/draft?slug&token= -- */
      if (req.method === "GET" && url.pathname === "/api/bridge/draft") {
        const slug = p.get("slug") ?? "";
        const token = p.get("token") ?? "";
        if (!slug || !token) return bridgeErr(res, 404, "slug and token params required");
        const data = store.bridgeDraft(store.sites, slug, token);
        if (!data) return bridgeErr(res, 404, "site not found or token invalid");
        return bridgeOk(res, data);
      }

      /* -- POST /api/bridge/verify -- */
      if (req.method === "POST" && url.pathname === "/api/bridge/verify") {
        let body = "";
        req.on("data", (c) => (body += c));
        await new Promise((r) => req.on("end", r));
        try {
          const b = JSON.parse(body);
          const slug = b?.slug ?? "";
          const token = b?.token ?? "";
          if (!slug || !token) return bridgeErr(res, 400, "slug and token required");
          const site = store.sites.find((s) => s.slug === slug);
          if (!site) return bridgeErr(res, 404, "site not found");
          const ov = site.ownershipVerification ?? {};
          return bridgeOk(res, {
            slug,
            matches: !!ov.token && ov.token === token,
            method: ov.method ?? null,
            state: ov.state ?? "unverified",
            bridgeVersion: "2",
          });
        } catch {
          return bridgeErr(res, 400, "invalid JSON body");
        }
      }

      /* -- GET /api/bridge/click -- */
      if (req.method === "GET" && url.pathname === "/api/bridge/click") {
        res.writeHead(204, CORS);
        res.end();
        return;
      }

      json(res, 404, { error: "not found" }, CORS);
    },
  );
}

/* -- 3 -- bootCore factory -- */
async function bootCore() {
  const { ensureCert } = await import(join(ROOT, "scripts/make-cert.mjs"));
  ensureCert();

  const siteServer = makeSiteServer();
  await new Promise((r) => siteServer.listen(SITE_PORT, "127.0.0.1", r));

  /* Crawl NOW (site origin is up): REAL crawlSite over the REAL pages.
   * createHarnessStore returns { users, sites } only - the behavior lives
   * in the module's free functions, so spread the module over the result
   * to give the convex + dashboard layers one callable surface. */
  const base = await createHarnessStore(SITE_DOMAIN);
  const store = { ...storeMod, ...base };
  siteStore = store;

  const convexServer = makeConvexServer(store);
  await new Promise((r) => convexServer.listen(CONVEX_PORT, "127.0.0.1", r));

  return {
    store,
    siteServer,
    convexServer,
    SITE_PORT,
    CONVEX_PORT,
    DASHBOARD_PORT,
    CONVEX_ORIGIN,
    DASHBOARD_ORIGIN,
    SITE_DOMAIN,
    json,
    CORS,
    bridgeErr,
    bridgeOk,
  };
}

export default bootCore;
export { CONVEX_ORIGIN, DASHBOARD_ORIGIN, SITE_DOMAIN, json, CORS, bridgeErr, bridgeOk };
