/**
 * PHASE 2 — Universal Website Adapter: HTML extraction engine (spec §4–§5).
 *
 * A zero-dependency extraction engine that converts a downloaded HTML
 * document into a structured page model with STABLE EDITING KEYS (§5):
 *
 *   home.hero.heading
 *   home.hero.subheading
 *   home.hero.image
 *   home.hero.primaryButton.label / .href
 *   about.intro.heading / .body
 *   services.items[0].title / .description / .image
 *
 * Spec §5 is explicit: "Do not expose raw DOM selectors as the permanent
 * content contract unless no better mapping exists." Keys are therefore
 * derived from PAGE + SECTION SEMANTICS (page slug, section role, element
 * role, list index) — never from CSS class names or nth-of-type selectors.
 *
 * Design constraints:
 *  - ZERO npm dependencies: runs inside a Convex action. No cheerio/jsdom —
 *    a defensive hand-rolled scanner. Malformed HTML must never crash
 *    discovery; unknown structures degrade to fewer keys, never to a failed
 *    crawl.
 *  - READ-ONLY (§16): this module parses bytes that were already fetched; it
 *    cannot write anything anywhere.
 *  - DETERMINISTIC: same HTML in → identical keys out (pinned by tests).
 *  - The crawl does not fabricate. When a section/element is not detected,
 *    it is simply absent from the map — the onboarding report says what was
 *    found, not what we wish were found (§14 discipline).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitive extraction helpers (all defensive, all zero-dep)
// ─────────────────────────────────────────────────────────────────────────────

/** Strip HTML tags from a text run and collapse whitespace. */
export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode the common HTML entities that appear in headings/copy. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        const cp = parseInt(code, 10);
        // Surrogate halves (0xD800–0xDFFF) have no meaning alone: if a page
        // carries them as raw entities (\&#55296;), String.fromCodePoint would
        // silently emit a LONE half — a string Convex's strict JSON parser
        // rejects ("unexpected end of hex escape"). Replace with U+FFFD.
        if (cp >= 0xd800 && cp <= 0xdfff) return "\ufffd";
        return String.fromCodePoint(cp);
      } catch {
        return " ";
      }
    });
}

/**
 * Replace UNPAIRED UTF-16 surrogates with U+FFFD, pair-aware.
 *
 * Extraction slices text at fixed widths (labels ≤80, descriptions ≤300,
 * headings ≤300…), which can cut a surrogate PAIR in half, leaving a dangling
 * high or low half in an extracted value. Convex's wire format rejects lone
 * surrogates in function arguments ("Received invalid json: unexpected end of
 * hex escape"), killing the whole discovery run. This walk keeps every VALID
 * pair (incl. emoji and zodiac grapheme pairs) and replaces only unpaired
 * halves — the same repair Node's WHATWG streams apply on invalid bytes.
 */
export function sanitizeUnicode(text: string): string {
  // Fast path: BMP-only and properly paired strings pass through untouched.
  let hasSurrogate = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdfff) {
      hasSurrogate = true;
      break;
    }
  }
  if (!hasSurrogate) return text;

  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : NaN;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out.push(text.slice(i, i + 2)); // valid pair — keep intact
        i++;
      } else {
        out.push("\ufffd"); // unpaired high half
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      out.push("\ufffd"); // unpaired low half
    } else {
      out.push(text[i]);
    }
  }
  return out.join("");
}

/** True when a string is present after entity decoding + trim. */
export function hasText(text: string | undefined | null): boolean {
  return typeof text === "string" && stripTags(text).length > 0;
}

/**
 * Find all matches of a regex WITHOUT the global-regex lastIndex hazard: each
 * call re-runs the regex fresh, so repeated calls are deterministic.
 */
function matchAll(html: string, regex: RegExp): RegExpExecArray[] {
  const global = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g",
  );
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = global.exec(html)) !== null) {
    out.push(m);
    if (m[0].length === 0) global.lastIndex++;
  }
  return out;
}

/** Capture-group helper: match group content or null. */
function group(match: RegExpExecArray | null, index: number): string | null {
  if (!match) return null;
  const value = match[index];
  return typeof value === "string" ? value : null;
}

/** Extract one attribute value from a raw tag string. */
export function tagAttr(tag: string, attr: string): string | null {
  const m = new RegExp(
    `\\s${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  ).exec(tag);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim() || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crawl budget — politeness (§16 read-only crawl is a polite visitor)
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_PAGES = 12;
export const MAX_SECTION_ELEMENTS = 24;
export const MAX_LIST_ITEMS = 12;
export const MAX_IMAGES = 24;
export const MAX_LINKS = 48;
export const MAX_HEADINGS = 32;
export const MAX_URL_LENGTH = 2048;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_HTML_BYTES = 2_000_000; // 2MB HTML budget per page

// ─────────────────────────────────────────────────────────────────────────────
// Semantic page model (§5 stable map) + route model (§4 page discovery)
// ─────────────────────────────────────────────────────────────────────────────

/** A discovered internal route, e.g. { path: "/about", source: "nav" }. */
export interface DiscoveredRoute {
  path: string;
  /** How TAYA found it: "nav" | "footer" | "sitemap" | "body". */
  source: "nav" | "footer" | "sitemap" | "body";
  label: string;
}

/** SEO/metadata block extracted from <head> (§4 "metadata/SEO"). */
export interface PageMeta {
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  canonical: string | null;
  generator: string | null;
}

/** Full structured model of ONE page (the per-page slice of the §5 map). */
export interface PageModel {
  path: string;
  url: string;
  meta: PageMeta;
  hero: {
    heading: string | null;
    subheading: string | null;
    image: string | null;
    primaryButton: { label: string | null; href: string | null } | null;
  };
  headings: Array<{ level: number; text: string; key: string }>;
  sections: Array<{
    /** Semantic section role: hero | about | services | gallery | contact... */
    role: string;
    heading: string | null;
    body: string | null;
    /** Repeated card-like items (§5: services.items[0].title …). */
    items: Array<{
      title: string | null;
      description: string | null;
      image: string | null;
    }>;
    keys: string[];
  }>;
  images: Array<{ src: string; alt: string; key: string }>;
  buttons: Array<{ label: string; href: string; key: string }>;
  links: Array<{ label: string; href: string; key: string }>;
  navItems: Array<{ label: string; href: string }>;
  footerText: string | null;
  forms: Array<{ action: string | null; method: string | null; fields: string[] }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route + path semantics (§4 "inspect homepage, discover pages")
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize an href against the crawled origin into an absolute URL. */
export function absoluteUrl(href: string, origin: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  // Skip javascript:, mailto:, tel:, data:, sms: (nothing to crawl).
  if (/^(javascript:|mailto:|tel:|sms:|data:)/i.test(trimmed)) return null;
  if (trimmed.startsWith("#")) return null;
  try {
    const url = new URL(trimmed, origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * True when an absolute URL belongs to the same registered domain.
 * Accepts the origin as either a bare domain ("acmedental.com") or a full
 * URL ("https://acmedental.com") — extractNavLinks passes the full origin.
 */
export function sameSite(url: string, originDomain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    let bare = originDomain.toLowerCase().trim();
    if (bare.includes("://")) {
      bare = new URL(bare).hostname;
    }
    bare = bare.replace(/^www\./, "");
    return host === bare || host.endsWith(`.${bare}`);
  } catch {
    return false;
  }
}

/**
 * Convert an absolute same-site URL to a normalized route path.
 * "/about", "/courses/", "/index.html" → canonical, extension-free, no hash.
 */
export function routePath(url: string, origin: string): string | null {
  try {
    const u = new URL(url);
    const o = new URL(origin);
    // Only same-origin paths become routes.
    if (u.hostname !== o.hostname) return null;
    let path = u.pathname;
    // Normalize directory-index files to the directory.
    path = path.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    // Drop common extensions (clean URLs are the norm; keep the stem).
    path = path.replace(/\.(html?|php|aspx?|jsp)$/i, "");
    // Ensure leading slash + strip trailing slash (except root).
    path = `/${path.replace(/^\/+|\/+$/g, "")}`;
    return path === "/" ? "/" : path;
  } catch {
    return null;
  }
}

/**
 * Derive the stable PAGE SEGMENT of a content key from a route path (§5).
 *   "/"       → "home"
 *   "/about"  → "about"
 *   "/training/classes" → "training.classes" (nested path → nested key)
 */
export function pageKeySegment(path: string): string {
  const parts = path
    .split("/")
    .filter((p) => p.length > 0)
    .map(slugPart);
  return parts.length === 0 ? "home" : parts.join(".");
}

/** Slugify one path segment for key use (stable, lowercase, dot-safe). */
function slugPart(part: string): string {
  const decoded = decodeEntities(part);
  const slug = decoded
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return slug || "p";
}

/**
 * The §5 key grammar for a section's key root — SINGLE SOURCE OF TRUTH,
 * shared by extractPageModel (section/element keys) and the crawl's
 * content-map folding, so the two can never disagree:
 *
 *   - every key is page-prefixed (home.hero.heading, about.intro.heading);
 *   - the page's NAMESAKE section elides its role so the key reads the way
 *     §5 writes it: a "services" section on /services → services.items[0].title
 *     (never services.services.items[0].title).
 */
export function sectionKeyRoot(path: string, role: string): string {
  const pageSeg = pageKeySegment(path);
  const lastSeg = pageSeg.split(".").pop()!;
  return role === lastSeg ? pageSeg : `${pageSeg}.${role}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// <head> metadata (§4 "metadata/SEO", §5 "structured content")
// ─────────────────────────────────────────────────────────────────────────────

export function extractMeta(html: string): PageMeta {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html;

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = hasText(group(titleMatch, 1)) ? stripTags(group(titleMatch, 1)!) : null;

  const metaContent = (name: string): string | null => {
    // <meta name="description" content="..."> and <meta property="og:title" content="...">
    const patterns = [
      new RegExp(`<meta[^>]+name\\s*=\\s*["']${name}["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+property\\s*=\\s*["']${name}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) {
      const tagMatch = pattern.exec(head);
      if (tagMatch) {
        const content = tagAttr(tagMatch[0], "content");
        if (content) return stripTags(content);
      }
    }
    return null;
  };

  const canonicalTag = /<link[^>]+rel\s*=\s*["']canonical["'][^>]*>/i.exec(head);
  const canonical = canonicalTag ? tagAttr(canonicalTag[0], "href") : null;

  return {
    title,
    description: metaContent("description"),
    ogTitle: metaContent("og:title"),
    ogDescription: metaContent("og:description"),
    ogImage: metaContent("og:image"),
    canonical,
    generator: metaContent("generator"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform detection (§4 "identify website technology if possible")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort platform detection from head hints. NEVER a hard claim — it
 * only reports when markers exist, so the onboarding report stays honest.
 */
export function detectPlatform(html: string, meta: PageMeta): string | null {
  const haystack = html.slice(0, 200_000).toLowerCase();
  const generator = (meta.generator ?? "").toLowerCase();
  if (/wordpress|wp-content|wp-includes/.test(haystack) || generator.includes("wordpress")) {
    return "wordpress";
  }
  if (/squarespace/.test(haystack) || generator.includes("squarespace")) {
    return "squarespace";
  }
  if (/wix\.com|wixstatic/.test(haystack) || generator.includes("wix")) {
    return "wix";
  }
  if (/shopify|cdn\.shopify/.test(haystack) || generator.includes("shopify")) {
    return "shopify";
  }
  if (/webflow/.test(haystack) || generator.includes("webflow")) {
    return "webflow";
  }
  if (/godaddy|godaddysites/.test(haystack) || generator.includes("godaddy")) {
    return "godaddy";
  }
  if (/weebly/.test(haystack) || generator.includes("weebly")) {
    return "weebly";
  }
  if (/_next\/static|__next/.test(haystack)) return "nextjs";
  if (/nuxt/.test(haystack)) return "nuxt";
  if (/gatsby/.test(haystack)) return "gatsby";
  if (/_reactroot|react-dom|data-reactroot/.test(haystack)) return "react";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Link + route discovery (§4 "discover pages"; §11 auto-register routes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all same-site navigation links (nav + footer), labeled by where
 * they were found, so discovered routes carry their evidence.
 */
export function extractNavLinks(html: string, origin: string): {
  navItems: Array<{ label: string; href: string }>;
  footerItems: Array<{ label: string; href: string }>;
  routes: DiscoveredRoute[];
} {
  const seenPaths = new Set<string>(["/"]);
  const routes: DiscoveredRoute[] = [];
  const navItems: Array<{ label: string; href: string }> = [];
  const footerItems: Array<{ label: string; href: string }> = [];

  const scanRegion = (
    regionHtml: string,
    source: DiscoveredRoute["source"],
    bucket: Array<{ label: string; href: string }>,
  ) => {
    const anchors = matchAll(
      regionHtml,
      /<a\s[^>]*href\s*=\s*("[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/a>/gi,
    );
    for (const a of anchors.slice(0, MAX_LINKS)) {
      const rawHref = decodeEntities(a[1].slice(1, -1)).trim();
      const label = stripTags(a[2]).slice(0, 80);
      const absolute = absoluteUrl(rawHref, origin);
      if (!absolute) continue;
      if (!sameSite(absolute, origin)) continue;
      const path = routePath(absolute, origin);
      if (!path) continue;
      bucket.push({ label, href: path });
      if (!seenPaths.has(path)) {
        seenPaths.add(path);
        routes.push({ path, source, label });
      }
    }
  };

  // <nav> regions first — the authoritative navigation source.
  const navRegions = matchAll(html, /<nav\b[^>]*>([\s\S]*?)<\/nav>/gi);
  for (const nav of navRegions.slice(0, 6)) {
    scanRegion(nav[1], "nav", navItems);
  }

  // <footer> regions — secondary navigation evidence.
  const footerRegions = matchAll(html, /<footer\b[^>]*>([\s\S]*?)<\/footer>/gi);
  for (const footer of footerRegions.slice(0, 4)) {
    scanRegion(footer[1], "footer", footerItems);
  }

  return {
    navItems: navItems.slice(0, MAX_LINKS),
    footerItems: footerItems.slice(0, MAX_LINKS),
    routes,
  };
}

/**
 * Parse sitemap.xml <loc> entries into route paths. Optional evidence —
 * failure or absence just means fewer routes.
 */
export function parseSitemap(xml: string): string[] {
  const paths: string[] = [];
  const locs = matchAll(xml, /<loc>\s*([^<\s]+)\s*<\/loc>/gi);
  for (const loc of locs.slice(0, 200)) {
    const url = decodeEntities(loc[1]);
    try {
      const u = new URL(url);
      const path = `/${u.pathname.replace(/^\/+|\/+$/g, "")}`;
      if (path && path !== "/") paths.push(path);
    } catch {
      /* skip unparseable loc entries */
    }
  }
  return paths;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero + element extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Filter out tracker pixels, spacers, and icon sprites. */
function isJunkImage(src: string): boolean {
  const s = src.toLowerCase();
  if (s.startsWith("data:")) return true;
  if (/(spacer|pixel|tracking|beacon|1x1|blank|favicon|sprite|gravatar)/.test(s)) {
    return true;
  }
  return false;
}

/**
 * Heuristic hero extraction (homepage): the first <h1> (falling back to the
 * first h2), the first substantial paragraph, first content image, and the
 * first button-styled control.
 */
function extractHero(bodyHtml: string): PageModel["hero"] {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(bodyHtml);
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(bodyHtml);
  const headingSource = h1 ? group(h1, 1) : group(h2, 1);
  const heading = hasText(headingSource) ? stripTags(headingSource!) : null;

  // Subheading: the first paragraph with ≥40 chars (hero ledes are longer
  // than stray labels). Deterministic and stable across crawls.
  let subheading: string | null = null;
  const paragraphs = matchAll(bodyHtml, /<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  for (const p of paragraphs.slice(0, 12)) {
    const text = stripTags(group(p, 1) ?? "");
    if (text.length >= 40) {
      subheading = text.slice(0, 300);
      break;
    }
  }

  // Primary button: first <a>/<button> with button-ish styling or an
  // action-word label.
  let primaryButton: PageModel["hero"]["primaryButton"] = null;
  const candidates = matchAll(
    bodyHtml,
    /<(a|button)\s[^>]*>((?:(?!<\/(a|button)>)[\s\S])*?)<\/\1>/gi,
  );
  for (const c of candidates.slice(0, 24)) {
    const tag = c[0].slice(0, c[0].indexOf(">") + 1);
    const label = stripTags(c[2]).slice(0, 60);
    if (!label) continue;
    const href = tagAttr(tag, "href");
    const looksLikeButton =
      /class\s*=\s*["'][^"']*\b(btn|button|cta|call-to-action|hero)\b/i.test(tag) ||
      /^(get started|contact us|learn more|book now|sign up|shop now|call now|explore|schedule|request)/i.test(
        label,
      );
    if (looksLikeButton) {
      primaryButton = { label, href };
      break;
    }
  }

  // Hero image: first non-junk content image in the body.
  let image: string | null = null;
  const imgs = matchAll(bodyHtml, /<img\b[^>]*>/gi);
  for (const img of imgs.slice(0, 24)) {
    const src = tagAttr(img[0], "src") ?? tagAttr(img[0], "data-src");
    if (!src) continue;
    if (isJunkImage(src)) continue;
    image = src;
    break;
  }

  return { heading, subheading, image, primaryButton };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section + element extraction → the stable content map (§5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section-role vocabulary: how a section's semantic identity is derived.
 * The lead block (content before the first <section>) is lead-scoped: it
 * becomes "hero" on the homepage and "intro" elsewhere — a lead H1 that
 * vocabulary-matches (e.g. "Our Services" on /services) must NOT steal the
 * namesake key root (§5 namesake elision).
 */
function sectionRoleFor(
  heading: string | null,
  index: number,
  path: string,
  leadIndex: number | null,
): string {
  const isLead = index === leadIndex;
  if (isLead) {
    return path === "/" ? "hero" : "intro";
  }
  const h = (heading ?? "").toLowerCase();
  // Vocabulary-first: common section identities on real marketing sites.
  if (/(^|\W)(about|who we are|our story|our mission)(\W|$)/.test(h)) return "about";
  if (/(^|\W)(services|what we do|what we offer|offerings|solutions)(\W|$)/.test(h)) {
    return "services";
  }
  if (/(^|\W)(products|shop|store|catalog)(\W|$)/.test(h)) return "products";
  if (/(^|\W)(courses|training|classes|programs)(\W|$)/.test(h)) return "services";
  if (/(^|\W)(gallery|photos|portfolio|our work)(\W|$)/.test(h)) return "gallery";
  if (/(^|\W)(contact|get in touch|reach us)(\W|$)/.test(h)) return "contact";
  if (/(^|\W)(team|our staff|instructors|people)(\W|$)/.test(h)) return "team";
  if (/(^|\W)(testimonials|reviews|what clients say)(\W|$)/.test(h)) return "testimonials";
  if (/(^|\W)(faq|questions)(\W|$)/.test(h)) return "faq";
  if (/(^|\W)(pricing|plans)(\W|$)/.test(h)) return "pricing";
  if (/(^|\W)(events|upcoming|calendar)(\W|$)/.test(h)) return "events";
  if (/(^|\W)(partners|clients|brands)(\W|$)/.test(h)) return "partners";
  // Real-world homepages whose hero lives inside the first <section> with
  // no lead content: the first block on the homepage is the hero.
  if (leadIndex === null && index === 0 && path === "/") return "hero";
  // Deterministic fallback: positional identity, stable across crawls.
  return `section${index + 1}`;
}

/** Stable key for a plain heading (positional + deterministic). */
function headingKey(path: string, ordinal: number): string {
  return `${pageKeySegment(path)}.headings[${ordinal}].text`;
}

/**
 * Detect repeated card-like items inside a section block (§5 "repeated
 * sections" → services.items[0].title / .description / .image).
 *
 * Heuristic: a repeating sibling structure (li / article / div-card) where
 * several siblings carry a small heading + a paragraph. Two or more siblings
 * with the same tag name = a repeated pattern.
 */
function extractRepeatableItems(block: string): PageModel["sections"][number]["items"] {
  const containers = matchAll(
    block,
    /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi,
  );
  for (const c of containers.slice(0, 3)) {
    const items = matchAll(c[2], /<li\b[^>]*>([\s\S]*?)<\/li>/gi);
    if (items.length >= 2) {
      const parsed = items
        .slice(0, MAX_LIST_ITEMS)
        .map((li) => parseCardish(li[1]))
        .filter((item) => item.title || item.description || item.image);
      if (parsed.length >= 2) return parsed;
    }
  }

  // <article>/card-div fallback: any block containing ≥2 articles.
  const articles = matchAll(block, /<article\b[^>]*>([\s\S]*?)<\/article>/gi);
  if (articles.length >= 2) {
    const parsed = articles
      .slice(0, MAX_LIST_ITEMS)
      .map((a) => parseCardish(a[1]))
      .filter((item) => item.title || item.description || item.image);
    if (parsed.length >= 2) return parsed;
  }
  return [];
}

/** Parse one card-like element into { title, description, image }. */
function parseCardish(inner: string): { title: string | null; description: string | null; image: string | null } {
  const headingMatch = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(inner);
  const title = hasText(group(headingMatch, 2)) ? stripTags(group(headingMatch, 2)!) : null;
  const paraMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(inner);
  const description = hasText(group(paraMatch, 1)) ? stripTags(group(paraMatch, 1)!).slice(0, 300) : null;
  const imgMatch = /<img\b[^>]*>/i.exec(inner);
  const imgTag = imgMatch ? imgMatch[0] : null;
  const image = imgTag ? tagAttr(imgTag, "src") ?? tagAttr(imgTag, "data-src") : null;
  return { title, description, image };
}

/**
 * Split the body into section blocks: <section> tags when present, otherwise
 * h2-delimited regions, otherwise one whole-body block. Content before the
 * first section is preserved as the LEAD block (§5: about.intro.* keys —
 * lead content before the first <section> must not be dropped), and its
 * position is returned so sectionRoleFor can scope it lead-only.
 */
function extractSectionBlocks(body: string): {
  blocks: string[];
  leadIndex: number | null;
} {
  const sectionTags = matchAll(body, /<section\b[^>]*>([\s\S]*?)<\/section>/gi);
  if (sectionTags.length > 0) {
    const blocks: string[] = [];
    let leadIndex: number | null = null;
    // Content before the first <section> is the lead block (§5 about.intro.*).
    const firstStart = sectionTags[0].index ?? 0;
    if (firstStart > 0) {
      const lead = stripPageChrome(body.slice(0, firstStart));
      if (hasText(stripTags(lead))) {
        blocks.push(lead);
        leadIndex = 0;
      }
    }
    const tagged = sectionTags.map((s) => s[1]);
    for (const s of tagged.slice(0, MAX_SECTION_ELEMENTS - blocks.length)) {
      blocks.push(s);
    }
    return { blocks, leadIndex };
  }
  // h2-delimited fallback: each h2 starts a new block.
  const h2Positions = matchAll(body, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi);
  if (h2Positions.length > 0) {
    const blocks: string[] = [];
    let leadIndex: number | null = null;
    const starts = h2Positions.map((m) => m.index);
    // Content before the first h2 becomes the lead block.
    if (starts[0] > 0) {
      const lead = stripPageChrome(body.slice(0, starts[0]));
      if (hasText(stripTags(lead))) {
        blocks.push(lead);
        leadIndex = 0;
      }
    }
    for (let i = 0; i < starts.length && blocks.length < MAX_SECTION_ELEMENTS; i++) {
      const end = i + 1 < starts.length ? starts[i + 1] : body.length;
      blocks.push(body.slice(starts[i], end));
    }
    return { blocks, leadIndex };
  }
  return { blocks: [body], leadIndex: 0 };
}

/**
 * Remove page chrome (nav/header/footer/script/style/template/noscript) from
 * a body fragment so the LEAD block carries only real content (§5): nav and
 * footer elements would otherwise pollute about.intro.* keys.
 */
function stripPageChrome(html: string): string {
  return html
    .replace(/<(nav|header|footer|script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|script|style|template|noscript)\b[^>]*\/>/gi, " ");
}

/** Footer text: <footer> content stripped (copyright line etc.). */
function footerTextOf(body: string): string | null {
  const footerRegions = matchAll(body, /<footer\b[^>]*>([\s\S]*?)<\/footer>/gi);
  for (const f of footerRegions.slice(0, 2)) {
    const text = stripTags(f[1]);
    if (text) return text.slice(0, 300);
  }
  return null;
}

/**
 * Extract the full page model for one page: hero, sections, headings,
 * images, buttons, links, forms, nav.
 */
export function extractPageModel(html: string, path: string, url: string): PageModel {
  const meta = extractMeta(html);
  const bodyStart = html.search(/<body\b[^>]*>/i);
  const body = bodyStart > 0 ? html.slice(bodyStart) : html;

  const { navItems } = extractNavLinks(html, url);
  const hero =
    path === "/"
      ? extractHero(body)
      : { heading: null, subheading: null, image: null, primaryButton: null };

  // ── Headings ────────────────────────────────────────────────────────────
  const headings: PageModel["headings"] = [];
  const headingMatches = matchAll(body, /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi);
  for (const h of headingMatches.slice(0, MAX_HEADINGS)) {
    const text = stripTags(group(h, 2) ?? "");
    if (!text) continue;
    headings.push({ level: parseInt(h[1], 10), text, key: headingKey(path, headings.length) });
  }

  // ── Sections + section-scoped elements ──────────────────────────────────
  const { blocks: sectionBlocks, leadIndex } = extractSectionBlocks(body);
  const sections: PageModel["sections"] = [];
  const images: PageModel["images"] = [];
  const buttons: PageModel["buttons"] = [];
  const links: PageModel["links"] = [];
  const forms: PageModel["forms"] = [];

  let imageOrdinal = 0;
  let buttonOrdinal = 0;
  let linkOrdinal = 0;
  // Role occurrence counts — the dedupe base for stable multi-section keys.
  const roleCounts = new Map<string, number>();

  sectionBlocks.forEach((block, blockIndex) => {
    const headingMatch = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(block);
    const sectionHeading = hasText(group(headingMatch, 2))
      ? stripTags(group(headingMatch, 2)!)
      : null;
    const baseRole = sectionRoleFor(sectionHeading, blockIndex, path, leadIndex);
    // Role deduplication: two "services" sections must not emit the same
    // role key (map keys would collide). Append a stable ordinal suffix.
    const roleCount = roleCounts.get(baseRole) ?? 0;
    roleCounts.set(baseRole, roleCount + 1);
    const role =
      roleCount === 0 ? baseRole : `${baseRole}${roleCount + 1}`;
    const roleSeg = sectionKeyRoot(path, role);

    // Repeated card items (§5 services.items[0].title …).
    const items = extractRepeatableItems(block);

    // Section body text: text content minus the heading (first 400 chars).
    const blockText = stripTags(block);
    const bodyText =
      sectionHeading && blockText.startsWith(sectionHeading)
        ? blockText.slice(sectionHeading.length).trim()
        : blockText;
    const trimmedBody = bodyText.slice(0, 400);

    const keys: string[] = [];
    // The homepage lead section duplicates the dedicated hero extraction
    // (extractHero owns the §5 canonical home.hero.heading/.subheading/.image/
    // .primaryButton keys) — the section contributes only its items.
    const isHomeHero = role === "hero" && path === "/";
    if (sectionHeading && !isHomeHero) keys.push(`${roleSeg}.heading`);
    if (trimmedBody && !isHomeHero) keys.push(`${roleSeg}.body`);
    items.forEach((_, i) => {
      keys.push(`${roleSeg}.items[${i}].title`);
      keys.push(`${roleSeg}.items[${i}].description`);
      keys.push(`${roleSeg}.items[${i}].image`);
    });
    sections.push({ role, heading: sectionHeading, body: trimmedBody || null, items, keys });

    // The homepage lead block is fully owned by extractHero (§5 canonical
    // home.hero.heading/.subheading/.image/.primaryButton) — collecting
    // array-scoped elements here too would emit redundant duplicates
    // (home.hero.images[0], home.hero.buttons[0], …). Skip to the next block.
    if (isHomeHero) return;

    // Images (stable list keys scoped to the section role).
    const sectionImages = matchAll(block, /<img\b[^>]*>/gi);
    for (const img of sectionImages.slice(0, MAX_SECTION_ELEMENTS)) {
      if (imageOrdinal >= MAX_IMAGES) break;
      const src = tagAttr(img[0], "src") ?? tagAttr(img[0], "data-src");
      if (!src || isJunkImage(src)) continue;
      images.push({ src, alt: tagAttr(img[0], "alt") ?? "", key: `${roleSeg}.images[${imageOrdinal++}]` });
    }

    // Buttons (button-styled anchors + <button>).
    const sectionButtons = matchAll(
      block,
      /<(a|button)\s[^>]*>((?:(?!<\/(a|button)>)[\s\S])*?)<\/\1>/gi,
    );
    for (const b of sectionButtons.slice(0, MAX_SECTION_ELEMENTS)) {
      if (buttonOrdinal >= MAX_SECTION_ELEMENTS) break;
      const tag = b[0].slice(0, b[0].indexOf(">") + 1);
      const label = stripTags(b[2]).slice(0, 60);
      if (!label) continue;
      const isButton =
        /class\s*=\s*["'][^"']*\b(btn|button|cta)\b/i.test(tag) ||
        b[1].toLowerCase() === "button";
      if (!isButton) continue;
      buttons.push({ label, href: tagAttr(tag, "href") ?? "", key: `${roleSeg}.buttons[${buttonOrdinal++}]` });
    }

    // Links (content links, not navigation).
    const sectionLinks = matchAll(
      block,
      /<a\s[^>]*href\s*=\s*("[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/a>/gi,
    );
    for (const a of sectionLinks.slice(0, MAX_LINKS)) {
      if (linkOrdinal >= MAX_LINKS) break;
      const rawHref = decodeEntities(a[1].slice(1, -1)).trim();
      const label = stripTags(a[2]).slice(0, 80);
      if (!label) continue;
      const absolute = absoluteUrl(rawHref, url);
      if (!absolute) continue;
      links.push({ label, href: absolute, key: `${roleSeg}.links[${linkOrdinal++}]` });
    }

    // Forms (where safely detectable, §5).
    const sectionForms = matchAll(block, /<form\b([^>]*)>([\s\S]*?)<\/form>/gi);
    for (const f of sectionForms.slice(0, 8)) {
      const tag = `<form${f[1]}>`;
      const fields: string[] = [];
      const inputs = matchAll(f[2], /<(input|textarea|select)\b[^>]*>/gi);
      for (const input of inputs.slice(0, 24)) {
        const name =
          tagAttr(input[0], "name") ??
          tagAttr(input[0], "type") ??
          tagAttr(input[0], "placeholder");
        if (name) fields.push(name);
      }
      forms.push({ action: tagAttr(tag, "action"), method: tagAttr(tag, "method"), fields });
    }
  });

  return {
    path,
    url,
    meta,
    hero,
    headings,
    sections,
    images,
    buttons,
    links,
    navItems,
    footerText: footerTextOf(body),
    forms,
  };
}
