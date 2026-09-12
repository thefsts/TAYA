/**
 * PHASE 2 — Universal Website Adapter: discovery crawler orchestrator (§4–§5, §16).
 *
 * Server-side, READ-ONLY crawl of a site's public pages:
 *   normalize URL → fetch homepage → discover routes (nav/footer/sitemap)
 *   → fetch bounded pages → extract page models with stable keys
 *   → assemble the discovery snapshot + onboarding report.
 *
 * §16 discipline:
 *  - The crawl NEVER writes to the live site (read-only GET fetches only).
 *  - The result is an INITIAL DISCOVERY SNAPSHOT for review — never applied
 *    to live content automatically.
 *  - Failures are recorded explicitly (status "failed" + failureReason) —
 *    never a fabricated snapshot and never a silent pass.
 *
 * Politeness: bounded page count, per-fetch timeout, total HTML budget, and
 * junk-route filtering (no crawl traps).
 */

import {
  MAX_PAGES,
  FETCH_TIMEOUT_MS,
  MAX_HTML_BYTES,
  extractMeta,
  extractPageModel,
  detectPlatform,
  extractNavLinks,
  parseSitemap,
  pageKeySegment,
  sectionKeyRoot,
  sanitizeUnicode,
  type DiscoveredRoute,
  type PageModel,
} from "./html";

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot shape (persisted in discoverySnapshots.snapshot)
// ─────────────────────────────────────────────────────────────────────────────

/** One page in the snapshot: model + crawl trace. */
export interface SnapshotPage {
  path: string;
  url: string;
  status: "fetched" | "error";
  httpStatus: number | null;
  bytes: number | null;
  model: PageModel | null;
  error: string | null;
}

/** The full discovery snapshot (§4 steps 5–9, §16 initial snapshot). */
export interface DiscoverySnapshot {
  domain: string;
  origin: string;
  crawlStartedAt: number;
  crawlCompletedAt: number;
  /** Best-effort platform identification (§4 "identify website technology"). */
  platform: string | null;
  /** The stable content map (§5): semantic keys → discovered values. */
  contentMap: Record<string, { type: string; value: string; evidence: string }>;
  /** Total key count (report stat). */
  keyCount: number;
  pages: SnapshotPage[];
  routes: DiscoveredRoute[];
  /** SEO/metadata from the homepage (report section). */
  siteMeta: ReturnType<typeof extractMeta>;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL + fetch primitives
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchOutcome {
  ok: boolean;
  httpStatus: number | null;
  html: string | null;
  error: string | null;
}

/**
 * Fetch one page (read-only, polite, timeout-bounded). `allowXml` widens the
 * content-type gate for the sitemap fetch (§4: sitemaps are served as
 * application/xml — a strict HTML-only gate would make them a dead
 * discovery source).
 */
export async function fetchPage(url: string, allowXml = false): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        // Identify the crawler honestly (§16 politeness).
        "User-Agent": "TAYA-Discovery-Bot/1.0 (+https://app.fstsclientsystem.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const httpStatus = res.status;
    if (!res.ok) {
      return { ok: false, httpStatus, html: null, error: `HTTP ${httpStatus}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType &&
      !/html/i.test(contentType) &&
      !(allowXml && /(xml|text\/plain)/i.test(contentType))
    ) {
      return {
        ok: false,
        httpStatus,
        html: null,
        error: `Non-HTML content-type: ${contentType}`,
      };
    }
    // Cap the HTML we are willing to read (politeness + memory).
    const text = await res.text();
    const html = text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
    return { ok: true, httpStatus, html, error: null };
  } catch (error: any) {
    return {
      ok: false,
      httpStatus: null,
      html: null,
      error: error?.message?.slice(0, 200) ?? "fetch failed",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot wire-safety (\u00a716 review artifact integrity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deep, pair-aware replacement of UNPAIRED UTF-16 surrogates with U+FFFD
 * across the whole snapshot, applied before the snapshot crosses the
 * action \u2192 mutation wire (ctx.runMutation). Convex's wire format rejects
 * lone surrogates inside function arguments ("Received invalid json:
 * unexpected end of hex escape") \u2014 one half-emoji anywhere in the payload
 * kills the entire crawl, leaving ZERO persisted rows and no reason (\u00a714
 * violation). Extraction can produce halves two ways: fixed-width .slice()
 * cuts that split an emoji pair, and raw &#55296;–&#57343; entities. This walk
 * covers every path at once, regardless of what the remote vantage served.
 */
function sanitizeSnapshotUnicode<T>(value: T): T {
  if (typeof value === "string") return sanitizeUnicode(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeSnapshotUnicode(item)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[sanitizeUnicode(k)] = sanitizeSnapshotUnicode(v);
    }
    return out as unknown as T;
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route selection (bounded, junk-filtered, nav-prioritized)
// ─────────────────────────────────────────────────────────────────────────────

/** Crawl-trap and junk route filters. */
function isCrawlableRoute(path: string): boolean {
  // No query strings, no fragments, no file routes.
  if (path.includes("?") || path.includes("#")) return false;
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|ico|css|js|json|xml|zip|mp4|mp3|woff2?|ttf)$/i.test(path)) {
    return false;
  }
  const JUNK = [
    "/wp-admin", "/wp-login", "/wp-content", "/wp-includes", "/wp-json",
    "/cdn-cgi", "/cart", "/checkout", "/login", "/signin", "/signup",
    "/register", "/account", "/my-account", "/admin", "/dashboard",
    "/feed", "/comments", "/tag/", "/author/", "/page/", "/search",
    "/sitemap", "/xmlrpc", "/cgi-bin", "/.well-known",
  ];
  const lower = path.toLowerCase();
  if (JUNK.some((j) => lower.startsWith(j))) return false;
  return true;
}

/** Priority-order a route list (nav > footer > sitemap > body). */
function prioritizeRoutes(routes: DiscoveredRoute[]): DiscoveredRoute[] {
  const priority: Record<string, number> = { nav: 0, footer: 1, sitemap: 2, body: 3 };
  return [...routes].sort(
    (a, b) => priority[a.source] - priority[b.source] || a.path.localeCompare(b.path),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content-map folding (PageModel → flat key/value map, §5)
// ─────────────────────────────────────────────────────────────────────────────

function foldIntoContentMap(
  map: Record<string, { type: string; value: string; evidence: string }>,
  model: PageModel,
): void {
  const pageSeg = pageKeySegment(model.path);

  // Hero block keys (the §5 canonical example set).
  if (model.hero.heading) {
    map[`${pageSeg}.hero.heading`] = {
      type: "text",
      value: model.hero.heading,
      evidence: "first h1 (or first h2) on the page",
    };
  }
  if (model.hero.subheading) {
    map[`${pageSeg}.hero.subheading`] = {
      type: "text",
      value: model.hero.subheading,
      evidence: "first substantial paragraph (≥40 chars)",
    };
  }
  if (model.hero.image) {
    map[`${pageSeg}.hero.image`] = {
      type: "image",
      value: model.hero.image,
      evidence: "first content image",
    };
  }
  if (model.hero.primaryButton?.label) {
    map[`${pageSeg}.hero.primaryButton.label`] = {
      type: "text",
      value: model.hero.primaryButton.label,
      evidence: "first button-styled control",
    };
  }
  if (model.hero.primaryButton?.href) {
    map[`${pageSeg}.hero.primaryButton.href`] = {
      type: "url",
      value: model.hero.primaryButton.href,
      evidence: "first button-styled control",
    };
  }

  // Section keys (heading/body) + section-scoped element keys.
  for (const section of model.sections) {
    // Same grammar as extractPageModel's section.keys (§5 single source of
    // truth): page-prefixed, namesake-elided (services.items[0].title, not
    // services.services.items[0].title).
    const roleSeg = sectionKeyRoot(model.path, section.role);
    // The homepage lead section duplicates the dedicated hero extraction —
    // extractHero is the authority for home.hero.heading/.subheading/.image/
    // .primaryButton (§5 canonical). The section folds only its items.
    const isHomeHero = section.role === "hero" && model.path === "/";
    if (section.heading && !isHomeHero) {
      map[`${roleSeg}.heading`] = { type: "text", value: section.heading, evidence: "section heading" };
    }
    if (section.body && !isHomeHero) {
      map[`${roleSeg}.body`] = { type: "text", value: section.body, evidence: "section body text" };
    }
    // Repeated items → services.items[0].title / .description / .image / .price (§5).
    section.items.forEach((item, i) => {
      if (item.title) {
        map[`${roleSeg}.items[${i}].title`] = {
          type: "text",
          value: item.title,
          evidence: `item heading in "${section.role}" list`,
        };
      }
      if (item.description) {
        map[`${roleSeg}.items[${i}].description`] = {
          type: "text",
          value: item.description,
          evidence: `item paragraph in "${section.role}" list`,
        };
      }
      if (item.image) {
        map[`${roleSeg}.items[${i}].image`] = {
          type: "image",
          value: item.image,
          evidence: `item image in "${section.role}" list`,
        };
      }
      if (item.price) {
        map[`${roleSeg}.items[${i}].price`] = {
          type: "text",
          value: item.price,
          evidence: `price-like value in "${section.role}" list item`,
        };
      }
    });
    for (const image of model.images) {
      if (image.key.startsWith(`${roleSeg}.`)) {
        map[image.key] = {
          type: "image",
          value: image.src,
          evidence: image.alt ? `img alt="${image.alt}"` : "img",
        };
      }
    }
    for (const button of model.buttons) {
      if (button.key.startsWith(`${roleSeg}.`)) {
        map[button.key] = {
          type: "list_item",
          value: button.label,
          evidence: `button to ${button.href || "(no href)"}`,
        };
      }
    }
    for (const link of model.links) {
      if (link.key.startsWith(`${roleSeg}.`)) {
        map[link.key] = {
          type: "list_item",
          value: link.label,
          evidence: `link to ${link.href}`,
        };
      }
    }
  }

  // Headings not already captured by sections.
  for (const h of model.headings) {
    if (!(h.key in map)) {
      map[h.key] = { type: "text", value: h.text, evidence: `h${h.level} text` };
    }
  }

  // Videos (§1 media signal — third-party embeds/files, page-scoped keys).
  for (const video of model.videos ?? []) {
    map[video.key] = {
      type: "video",
      value: video.src,
      evidence: `${video.source} video${video.title ? ` "${video.title}"` : ""}`,
    };
  }

  // Downloads (§1 downloadable-asset signal — pdf/doc/zip/csv links).
  for (const download of model.downloads ?? []) {
    map[download.key] = {
      type: "download",
      value: download.href,
      evidence: `download link (${download.fileType}) "${download.label}"`,
    };
  }

  // Footer text (the site-wide footer appears on every page; keep homepage's).
  if (model.footerText && !(map[`${pageSeg}.footer.text`] )) {
    map[`${pageSeg}.footer.text`] = { type: "text", value: model.footerText, evidence: "<footer> text" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The crawl (§4 steps 4–9)
// ─────────────────────────────────────────────────────────────────────────────

export interface CrawlResult {
  snapshot: DiscoverySnapshot | null;
  failureReason: string | null;
}

/**
 * Run the read-only discovery crawl for a bare domain.
 *
 * @param domain bare domain (e.g. "acmedental.com" — as stored on the site)
 * @returns the snapshot when at least the homepage fetched, else an explicit
 *          failure reason (never a fabricated snapshot).
 */
export async function crawlSite(domain: string): Promise<CrawlResult> {
  const origin = `https://${domain}`;
  const crawlStartedAt = Date.now();

  // ── 1. Homepage fetch ──────────────────────────────────────────────────
  const home = await fetchPage(origin);
  if (!home.ok || !home.html) {
    return {
      snapshot: null,
      failureReason: `Could not fetch https://${domain}: ${home.error ?? "unknown error"}`,
    };
  }

  // ── 2. Route discovery (nav + footer + sitemap) ─────────────────────────
  const { routes: navRoutes } = extractNavLinks(home.html, origin);
  const allRoutes: DiscoveredRoute[] = [...navRoutes];
  try {
    const sitemapRes = await fetchPage(`${origin}/sitemap.xml`, true);
    if (sitemapRes.ok && sitemapRes.html) {
      for (const p of parseSitemap(sitemapRes.html)) {
        if (!allRoutes.some((r) => r.path === p)) {
          allRoutes.push({ path: p, source: "sitemap", label: "" });
        }
      }
    }
  } catch {
    /* sitemap is optional evidence */
  }

  const crawlable = prioritizeRoutes(allRoutes.filter((r) => isCrawlableRoute(r.path)));
  const pagesToVisit = ["/", ...crawlable.map((r) => r.path)]
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .slice(0, MAX_PAGES);

  // ── 3. Page-by-page extraction (homepage already in hand) ───────────────
  const pages: SnapshotPage[] = [];
  const contentMap: Record<string, { type: string; value: string; evidence: string }> = {};

  const recordPage = (html: string, path: string, url: string, httpStatus: number) => {
    const model = extractPageModel(html, path, url);
    pages.push({ path, url, status: "fetched", httpStatus, bytes: html.length, model, error: null });
    foldIntoContentMap(contentMap, model);
    return model;
  };

  const homeModel = recordPage(home.html, "/", origin, home.httpStatus!);
  const siteMeta = homeModel.meta;
  const platform = detectPlatform(home.html, siteMeta);

  for (const path of pagesToVisit.slice(1)) {
    const url = `${origin}${path}`;
    const outcome = await fetchPage(url);
    if (!outcome.ok || !outcome.html) {
      pages.push({
        path,
        url,
        status: "error",
        httpStatus: outcome.httpStatus,
        bytes: null,
        model: null,
        error: outcome.error,
      });
      continue;
    }
    recordPage(outcome.html, path, url, outcome.httpStatus!);
  }

  // ── 4. Assemble the snapshot ────────────────────────────────────────────
  const crawlCompletedAt = Date.now();

  return {
    snapshot: sanitizeSnapshotUnicode({
      domain,
      origin,
      crawlStartedAt,
      crawlCompletedAt,
      platform,
      contentMap,
      keyCount: Object.keys(contentMap).length,
      pages,
      routes: crawlable,
      siteMeta,
    }),
    failureReason: null,
  };
}
