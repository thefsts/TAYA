/**
 * PHASE 3 — Visual editor HTML annotation (spec §9–§10, §26).
 *
 * PURE LIBRARY — no Convex ctx, no network, no per-customer logic.
 *
 * The editor preview frame cannot inject scripts into a cross-origin
 * iframe, so the /api/editor/frame HTTP action fetches the live page
 * SERVER-SIDE and serves it from the Convex site origin. This module
 * annotates that fetched HTML with `data-taya-edit="<§5 key>"` attributes
 * on exactly the elements the Phase 2 §5 extractor (html.ts
 * extractPageModel → crawl.ts foldIntoContentMap) matched when it built
 * the site's content map — the SAME grammar, the SAME ordinals, the SAME
 * namesake elision — so the click-to-edit surface can never disagree with
 * the durable map the editor drafts and publishes against.
 *
 * Mirroring rules (each pinned by editor-annotate.test.ts against the
 * REAL extractor + fold):
 *   - hero keys (home.hero.heading/.subheading/.image/.primaryButton.label)
 *     come from extractHero's exact heuristics (first h1 else first h2;
 *     first paragraph ≥40 chars; first non-junk image; first button-ish
 *     control) — homepage only;
 *   - section roles come from the verbatim sectionRoleFor vocabulary copy
 *     below, with role-occurrence dedupe and §5 namesake elision via
 *     sectionKeyRoot (imported from html.ts — single source of truth);
 *   - images/buttons/links ordinals are GLOBAL across blocks in document
 *     order (the extractor's counter discipline);
 *   - the homepage lead block is owned by the hero extraction and
 *     contributes no section-scoped element keys (isHomeHero);
 *   - headings not already carrying a semantic key get the positional
 *     pageSeg.headings[n].text keys.
 *   - elements already tagged with data-taya-edit by the site itself
 *     (the embedded TAYA Web Bridge tags) are NEVER double-annotated —
 *     their existing key wins.
 *
 * DELIBERATELY NOT annotated (no 1:1 DOM element; the extractor folds
 * them as aggregate text): section `.body` keys, `.footer.text`, and the
 * button/link `.href` companion keys (they ride the same element as
 * their label key — the editing control edits both, the bridge applies
 * both). They stay editable through the map's entry list; the editor
 * never fakes a binding.
 */

import {
  stripTags,
  tagAttr,
  decodeEntities,
  absoluteUrl,
  pageKeySegment,
  sectionKeyRoot,
  MAX_LIST_ITEMS,
  MAX_SECTION_ELEMENTS,
  MAX_IMAGES,
  MAX_LINKS,
  MAX_HEADINGS,
} from "./discovery/html";

// ── regex helpers (same semantics as html.ts matchAll) ──────────────────

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

function group(match: RegExpExecArray | null, index: number): string | null {
  if (!match) return null;
  const value = match[index];
  return typeof value === "string" ? value : null;
}

function hasText(text: string | undefined | null): boolean {
  return typeof text === "string" && stripTags(text).length > 0;
}

/**
 * Insertion point of an attribute inside a tag: directly after the tag
 * name ("<h1 class=…" → index of " class"). Handles self-closing and
 * newline-after-name shapes.
 */
function attrInsertAt(base: number, m: RegExpExecArray): number {
  const rest = m[0].slice(1); // after "<"
  const stop = rest.search(/[\s>\/]/);
  return base + m.index + 1 + (stop === -1 ? rest.length : stop);
}

/** Absolute offset where a match's captured inner content begins. */
function innerBase(base: number, m: RegExpExecArray): number {
  return base + m.index + m[0].indexOf(">") + 1;
}

// ── verbatim copy of html.ts sectionRoleFor (private there) ─────────────
// DO NOT DRIFT: editor-annotate.test.ts pins this against the extractor by
// key-set equality on shared fixtures. Any §5 vocabulary change must land
// in BOTH files (or be promoted to a shared export) in the same PR.

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
  if (leadIndex === null && index === 0 && path === "/") return "hero";
  return `section${index + 1}`;
}

// ── junk-image filter (verbatim semantics of html.ts isJunkImage) ───────

function isJunkImage(src: string): boolean {
  const s = src.toLowerCase();
  if (s.startsWith("data:")) return true;
  if (/(spacer|pixel|tracking|beacon|1x1|blank|favicon|sprite|gravatar)/.test(s)) {
    return true;
  }
  return false;
}

// ── chrome stripping (offset-preserving) ─────────────────────────────────
// The extractor strips nav/header/footer/script/… from the LEAD block
// before scanning. To reproduce the same element sequence while keeping
// absolute offsets into the ORIGINAL html, we record the chrome ranges
// and skip candidate matches that start inside them.

const CHROME_RE =
  /<(nav|header|footer|script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;
const CHROME_SELF_CLOSING_RE =
  /<(nav|header|footer|script|style|template|noscript)\b[^>]*\/>/gi;

function chromeRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of matchAll(html, CHROME_RE)) ranges.push([m.index, m.index + m[0].length]);
  for (const m of matchAll(html, CHROME_SELF_CLOSING_RE))
    ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function inRanges(ranges: Array<[number, number]>, i: number): boolean {
  return ranges.some(([s, e]) => i >= s && i < e);
}

function stripPageChromeText(html: string): string {
  return html.replace(CHROME_RE, " ").replace(CHROME_SELF_CLOSING_RE, " ");
}

// ── public surface ───────────────────────────────────────────────────────

/** One editable element binding produced by the annotation pass. */
export interface ElementBinding {
  /** §5 semantic content key (identical grammar to the durable map). */
  key: string;
  /** Map entry type: text | image | url | list_item. */
  type: "text" | "image" | "url" | "list_item";
  /** Absolute offset (into the ORIGINAL html) where the attribute goes. */
  at: number;
}

/** Tags already carrying a data-taya-edit attribute (site-embedded). */
function protectedTagRanges(html: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of matchAll(html, /<[a-zA-Z][^>]*>/g)) {
    if (/data-taya-edit\s*=\s*["'][^"']+["']/i.test(m[0])) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  return ranges;
}

function tagContainsProtected(ranges: Array<[number, number]>, at: number): boolean {
  // `at` is inside the tag's opening bracket region; any protected tag
  // whose range contains the insertion point means the element is tagged.
  return inRanges(ranges, at);
}

/**
 * Compute the §5 element bindings for a page WITHOUT mutating the HTML.
 * Pure: same (html, path, url) in → identical bindings out.
 */
export function collectBindings(html: string, path: string, url: string): ElementBinding[] {
  const bodyStart = html.search(/<body\b[^>]*>/i);
  const bodyOff = bodyStart > 0 ? bodyStart : 0;
  const body = html.slice(bodyOff);
  const pageSeg = pageKeySegment(path);

  const protectedRanges = protectedTagRanges(html);
  const bindings: ElementBinding[] = [];
  const taken = new Set<number>(); // insertion offsets already carrying a key

  const add = (at: number, key: string, type: ElementBinding["type"]) => {
    if (taken.has(at)) return; // first (semantic) key wins on a shared tag
    if (tagContainsProtected(protectedRanges, at)) return; // site's own tag wins
    taken.add(at);
    bindings.push({ key, type, at });
  };

  // ── Hero (homepage only) — mirrors extractHero ────────────────────────
  if (path === "/") {
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(body);
    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(body);
    const headingSource = h1 ? group(h1, 1) : group(h2, 1);
    const headingMatch = h1 ?? h2;
    if (headingMatch && hasText(headingSource)) {
      add(attrInsertAt(bodyOff, headingMatch), `${pageSeg}.hero.heading`, "text");
    }

    const paragraphs = matchAll(body, /<p\b[^>]*>([\s\S]*?)<\/p>/gi);
    for (const p of paragraphs.slice(0, 12)) {
      const text = stripTags(group(p, 1) ?? "");
      if (text.length >= 40) {
        add(attrInsertAt(bodyOff, p), `${pageSeg}.hero.subheading`, "text");
        break;
      }
    }

    const imgs = matchAll(body, /<img\b[^>]*>/gi);
    for (const img of imgs.slice(0, 24)) {
      const src = tagAttr(img[0], "src") ?? tagAttr(img[0], "data-src");
      if (!src || isJunkImage(src)) continue;
      add(attrInsertAt(bodyOff, img), `${pageSeg}.hero.image`, "image");
      break;
    }

    const candidates = matchAll(
      body,
      /<(a|button)\s[^>]*>((?:(?!<\/(a|button)>)[\s\S])*?)<\/\1>/gi,
    );
    for (const c of candidates.slice(0, 24)) {
      const tag = c[0].slice(0, c[0].indexOf(">") + 1);
      const label = stripTags(c[2]).slice(0, 60);
      if (!label) continue;
      const looksLikeButton =
        /class\s*=\s*["'][^"']*\b(btn|button|cta|call-to-action|hero)\b/i.test(tag) ||
        /^(get started|contact us|learn more|book now|sign up|shop now|call now|explore|schedule|request)/i.test(
          label,
        );
      if (looksLikeButton) {
        add(attrInsertAt(bodyOff, c), `${pageSeg}.hero.primaryButton.label`, "text");
        break;
      }
    }
  }

  // ── Section blocks (mirrors extractSectionBlocks, offset-preserving) ──
  interface Block {
    start: number; // offset in body
    end: number;
    lead: boolean;
  }
  const blocks: Block[] = [];
  let leadIndex: number | null = null;

  const sectionTags = matchAll(body, /<section\b[^>]*>([\s\S]*?)<\/section>/gi);
  if (sectionTags.length > 0) {
    const firstStart = sectionTags[0].index ?? 0;
    if (firstStart > 0) {
      const lead = body.slice(0, firstStart);
      if (hasText(stripTags(stripPageChromeText(lead)))) {
        blocks.push({ start: 0, end: firstStart, lead: true });
        leadIndex = 0;
      }
    }
    for (const s of sectionTags.slice(0, MAX_SECTION_ELEMENTS - blocks.length)) {
      const base = innerBase(bodyOff, s);
      blocks.push({ start: base - bodyOff, end: base - bodyOff + s[1].length, lead: false });
    }
  } else {
    const h2Positions = matchAll(body, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi);
    if (h2Positions.length > 0) {
      const starts = h2Positions.map((m) => m.index);
      if (starts[0] > 0) {
        const lead = body.slice(0, starts[0]);
        if (hasText(stripTags(stripPageChromeText(lead)))) {
          blocks.push({ start: 0, end: starts[0], lead: true });
          leadIndex = 0;
        }
      }
      for (let i = 0; i < starts.length && blocks.length < MAX_SECTION_ELEMENTS; i++) {
        const end = i + 1 < starts.length ? starts[i + 1] : body.length;
        blocks.push({ start: starts[i], end, lead: false });
      }
    } else {
      blocks.push({ start: 0, end: body.length, lead: true });
      leadIndex = 0;
    }
  }

  // Chrome ranges (body coordinates) for LEAD blocks only — the extractor
  // strips chrome from the lead before scanning it.
  const leadChrome: Array<[number, number]> = [];
  for (const b of blocks) {
    if (!b.lead) continue;
    for (const [s, e] of chromeRanges(body.slice(b.start, b.end))) {
      leadChrome.push([s + b.start, e + b.start]);
    }
  }

  let imageOrdinal = 0;
  let buttonOrdinal = 0;
  let linkOrdinal = 0;
  const roleCounts = new Map<string, number>();

  blocks.forEach((block, blockIndex) => {
    const content = body.slice(block.start, block.end);
    const contentAbs = bodyOff + block.start; // absolute base of `content`
    const chrome = block.lead
      ? leadChrome.filter(([s]) => s >= block.start && s < block.end)
      : [];
    const skip = (relIndex: number) => inRanges(chrome, block.start + relIndex);

    const headingMatch = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(content);
    const sectionHeading =
      headingMatch && !skip(headingMatch.index) && hasText(group(headingMatch, 2))
        ? stripTags(group(headingMatch, 2)!)
        : null;

    const baseRole = sectionRoleFor(sectionHeading, blockIndex, path, leadIndex);
    const roleCount = roleCounts.get(baseRole) ?? 0;
    roleCounts.set(baseRole, roleCount + 1);
    const role = roleCount === 0 ? baseRole : `${baseRole}${roleCount + 1}`;
    const roleSeg = sectionKeyRoot(path, role);
    const isHomeHero = role === "hero" && path === "/";

    // Repeated card items → roleSeg.items[i].title/.description/.image.
    if (!isHomeHero) {
      const containers = matchAll(content, /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi);
      let items: Array<{
        titleAt: number | null;
        titleText: string | null;
        descAt: number | null;
        descText: string | null;
        imageAt: number | null;
      }> | null = null;
      for (const c of containers.slice(0, 3)) {
        if (skip(c.index)) continue;
        const lis = matchAll(c[2], /<li\b[^>]*>([\s\S]*?)<\/li>/gi);
        if (lis.length < 2) continue;
        const c2Base = innerBase(contentAbs, c);
        const parsed = lis.slice(0, MAX_LIST_ITEMS).map((li) => {
          const liInnerBase = c2Base + li.index + li[0].indexOf(">") + 1;
          return parseCardishAt(li[1], liInnerBase);
        });
        if (parsed.filter((p) => p.titleText || p.descText || p.imageAt !== null).length >= 2) {
          items = parsed;
          break;
        }
      }
      if (!items) {
        const articles = matchAll(content, /<article\b[^>]*>([\s\S]*?)<\/article>/gi);
        if (articles.length >= 2) {
          const parsed = articles.slice(0, MAX_LIST_ITEMS).map((a) =>
            parseCardishAt(a[1], innerBase(contentAbs, a)),
          );
          if (parsed.filter((p) => p.titleText || p.descText || p.imageAt !== null).length >= 2) {
            items = parsed;
          }
        }
      }
      if (items) {
        items.forEach((item, i) => {
          if (item.titleAt !== null && item.titleText) {
            add(item.titleAt, `${roleSeg}.items[${i}].title`, "text");
          }
          if (item.descAt !== null && item.descText) {
            add(item.descAt, `${roleSeg}.items[${i}].description`, "text");
          }
          if (item.imageAt !== null) {
            add(item.imageAt, `${roleSeg}.items[${i}].image`, "image");
          }
        });
      }
    }

    if (!isHomeHero && sectionHeading && headingMatch) {
      add(attrInsertAt(contentAbs, headingMatch), `${roleSeg}.heading`, "text");
    }

    // Section body (§5 roleSeg.body): an HONEST 1:1 binding only — the
    // fold computes body text from the whole block, so the frame stamps it
    // solely when that text lives in ONE paragraph element outside item
    // containers and chrome. Sections whose body is list/scattered text
    // have no single element to edit and stay unannotated (§26: never fake
    // an editable binding).
    if (!isHomeHero) {
      const blockText = stripTags(block.lead ? stripPageChromeText(content) : content);
      const bodyText =
        sectionHeading && blockText.startsWith(sectionHeading)
          ? blockText.slice(sectionHeading.length).trim()
          : blockText;
      if (bodyText) {
        const containerRanges = matchAll(content, /<(ul|ol|article)\b[^>]*>[\s\S]*?<\/\1>/gi).map(
          (c) => [(c.index ?? 0), (c.index ?? 0) + c[0].length] as [number, number],
        );
        const paragraphs = matchAll(content, /<p\b[^>]*>([\s\S]*?)<\/p>/gi).filter(
          (p) =>
            !inRanges(containerRanges, p.index ?? 0) &&
            !skip(p.index ?? 0) &&
            hasText(group(p, 1)),
        );
        if (paragraphs.length === 1) {
          add(attrInsertAt(contentAbs, paragraphs[0]), `${roleSeg}.body`, "text");
        }
      }
    }

    if (isHomeHero) return; // hero owns the homepage lead (mirror)

    // Images (global ordinal discipline).
    const sectionImages = matchAll(content, /<img\b[^>]*>/gi);
    for (const img of sectionImages.slice(0, MAX_SECTION_ELEMENTS)) {
      if (skip(img.index)) continue;
      if (imageOrdinal >= MAX_IMAGES) break;
      const src = tagAttr(img[0], "src") ?? tagAttr(img[0], "data-src");
      if (!src || isJunkImage(src)) continue;
      add(attrInsertAt(contentAbs, img), `${roleSeg}.images[${imageOrdinal++}]`, "image");
    }

    // Buttons.
    const sectionButtons = matchAll(
      content,
      /<(a|button)\s[^>]*>((?:(?!<\/(a|button)>)[\s\S])*?)<\/\1>/gi,
    );
    for (const b of sectionButtons.slice(0, MAX_SECTION_ELEMENTS)) {
      if (skip(b.index)) continue;
      if (buttonOrdinal >= MAX_SECTION_ELEMENTS) break;
      const tag = b[0].slice(0, b[0].indexOf(">") + 1);
      const label = stripTags(b[2]).slice(0, 60);
      if (!label) continue;
      const isButton =
        /class\s*=\s*["'][^"']*\b(btn|button|cta)\b/i.test(tag) ||
        b[1].toLowerCase() === "button";
      if (!isButton) continue;
      add(attrInsertAt(contentAbs, b), `${roleSeg}.buttons[${buttonOrdinal++}]`, "list_item");
    }

    // Links.
    const sectionLinks = matchAll(
      content,
      /<a\s[^>]*href\s*=\s*("[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/a>/gi,
    );
    for (const a of sectionLinks.slice(0, MAX_LINKS)) {
      if (skip(a.index)) continue;
      if (linkOrdinal >= MAX_LINKS) break;
      const rawHref = decodeEntities(a[1].slice(1, -1)).trim();
      const label = stripTags(a[2]).slice(0, 80);
      if (!label) continue;
      const absolute = absoluteUrl(rawHref, url);
      if (!absolute) continue;
      add(attrInsertAt(contentAbs, a), `${roleSeg}.links[${linkOrdinal++}]`, "list_item");
    }
  });

  // ── Footer text (mirrors footerTextOf): stamped on the <footer> element
  // itself. The bridge applies footer.text via textContent on this exact
  // element, so the frame binding matches publish-apply semantics 1:1.
  {
    const footerRegions = matchAll(body, /<footer\b[^>]*>([\s\S]*?)<\/footer>/gi);
    for (const f of footerRegions.slice(0, 2)) {
      if (stripTags(f[1] ?? "")) {
        add(attrInsertAt(bodyOff, f), `${pageSeg}.footer.text`, "text");
        break;
      }
    }
  }

  // ── Positional headings (pageSeg.headings[n].text) for tags that did
  // not receive a semantic key. Ordinal = n-th non-empty heading in the
  // whole body (the extractor's headings[] discipline — chrome included).
  const headingMatches = matchAll(body, /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi);
  let headingOrdinal = 0;
  for (const h of headingMatches.slice(0, MAX_HEADINGS)) {
    const text = stripTags(group(h, 2) ?? "");
    if (!text) continue;
    const at = attrInsertAt(bodyOff, h);
    add(at, `${pageSeg}.headings[${headingOrdinal}].text`, "text");
    headingOrdinal++;
  }

  return bindings;
}

/** parseCardish with absolute offsets (mirrors html.ts parseCardish). */
function parseCardishAt(inner: string, base: number): {
  titleAt: number | null;
  titleText: string | null;
  descAt: number | null;
  descText: string | null;
  imageAt: number | null;
} {
  const headingMatch = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(inner);
  const titleText = headingMatch && hasText(group(headingMatch, 2))
    ? stripTags(group(headingMatch, 2)!)
    : null;
  const paraMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(inner);
  const descText = paraMatch && hasText(group(paraMatch, 1))
    ? stripTags(group(paraMatch, 1)!).slice(0, 300)
    : null;
  const imgMatch = /<img\b[^>]*>/i.exec(inner);
  return {
    titleAt: titleText ? attrInsertAt(base, headingMatch!) : null,
    titleText,
    descAt: descText ? attrInsertAt(base, paraMatch!) : null,
    descText,
    imageAt: imgMatch ? attrInsertAt(base, imgMatch) : null,
  };
}

/**
 * Annotate the HTML: insert `data-taya-edit`/`data-taya-type` attributes at
 * every binding position. Pure — same input → identical output string.
 * Elements already tagged by the site keep their own attributes.
 */
export function annotatePage(html: string, path: string, url: string): string {
  const bindings = collectBindings(html, path, url);
  const edits = bindings
    .map((b) => ({
      pos: b.at,
      text: ` data-taya-edit="${b.key}" data-taya-type="${b.type}"`,
    }))
    .sort((a, b) => b.pos - a.pos);
  let out = html;
  for (const e of edits) {
    out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  }
  return out;
}
