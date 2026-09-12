/**
 * CHAT B — Safe insertion zones (§6) + content-block validation.
 *
 * CANONICAL registry module (server-side). Pure library — no Convex ctx.
 *
 * THE ZONE CONTRACT (§6 verbatim): standardize allowed placement zones —
 * hero, content, article-feed, resource-grid, service-list, product-grid,
 * video-section, testimonial-list, faq-list, cta-stack, footer-content.
 * Each zone defines allowed content types. MATAYA/TAYA may add content
 * ONLY inside approved zones. No arbitrary React-source edits.
 *
 * Zone resolution is §5-role-driven: every zone (except the two ADDITIVE
 * page-level zones) binds to the §5 section role vocabulary that the
 * discovery extractor + editor annotator already share (sectionRoleFor in
 * convex/lib/discovery/html.ts — mirrored, DO NOT DRIFT, in
 * convex/lib/editorAnnotate.ts). A discovered section with role "services"
 * resolves to the service-list zone; the footer element resolves to
 * footer-content. The additive zones (video-section, cta-stack) append at
 * safe page anchors rather than requiring a matching discovered section.
 *
 * Zone membership is resolved server-side against the site's OWN content
 * map pages (never client-declared) so a tenant can only insert into
 * zones on pages it actually has.
 */

import type { SafeLinkResult } from "./safeLinks";
import { classifyLink } from "./safeLinks";
import { parseVideoUrl } from "./videoEmbeds";

// ─────────────────────────────────────────────────────────────────────────────
// Zone registry
// ─────────────────────────────────────────────────────────────────────────────

/** Insertion content kinds (§1 + §3 + §4 rich content). */
export type InsertKind =
  | "text"
  | "image"
  | "button"
  | "video"
  | "pdf"
  | "cta"
  | "faq_item"
  | "link";

/** The 11 approved insertion zones (§6). */
export type ZoneId =
  | "hero"
  | "content"
  | "article-feed"
  | "resource-grid"
  | "service-list"
  | "product-grid"
  | "video-section"
  | "testimonial-list"
  | "faq-list"
  | "cta-stack"
  | "footer-content";

/** Human label for each zone (client-safe vocabulary). */
export const ZONE_LABELS: Record<ZoneId, string> = {
  hero: "Hero area",
  content: "Content section",
  "article-feed": "Article feed",
  "resource-grid": "Resource grid",
  "service-list": "Service list",
  "product-grid": "Product grid",
  "video-section": "Video section",
  "testimonial-list": "Testimonial list",
  "faq-list": "FAQ list",
  "cta-stack": "Call-to-action stack",
  "footer-content": "Footer content",
};

/**
 * §5 section-role vocabulary that each zone binds to. Roles mirror
 * sectionRoleFor in discovery/html.ts: about, services, products, gallery,
 * contact, team, testimonials, faq, pricing, events, partners, hero (lead
 * on "/"), intro (lead on other pages), section{n} fallback.
 */
export const ZONE_SECTION_ROLES: Record<ZoneId, readonly string[]> = {
  hero: ["hero"],
  content: ["about", "intro", "gallery", "contact", "team", "pricing", "events", "partners"],
  "article-feed": ["articles", "blog", "resources"],
  "resource-grid": ["downloads", "resources"],
  "service-list": ["services"],
  "product-grid": ["products"],
  "video-section": [], // additive zone — no discovered role required
  "testimonial-list": ["testimonials"],
  "faq-list": ["faq"],
  "cta-stack": [], // additive zone
  "footer-content": ["footer"],
};

/** Allowed insertion kinds per zone (§6: each zone defines allowed types). */
export const ZONE_ALLOWED_KINDS: Record<ZoneId, readonly InsertKind[]> = {
  hero: ["text", "button", "video"],
  content: ["text", "image", "button", "video", "pdf"],
  "article-feed": ["text", "button", "pdf"],
  "resource-grid": ["text", "button", "pdf"],
  "service-list": ["text", "button", "pdf"],
  "product-grid": ["text", "button", "pdf"],
  "video-section": ["video", "text"],
  "testimonial-list": ["text", "button"],
  "faq-list": ["text", "faq_item", "button"],
  "cta-stack": ["cta", "text", "button", "video"],
  "footer-content": ["text", "button", "link"],
};

/** Zones that append at safe page anchors without a discovered section. */
export const ADDITIVE_ZONE_IDS: readonly ZoneId[] = ["video-section", "cta-stack"];

// ─────────────────────────────────────────────────────────────────────────────
// Caps (resource-honest limits; mirrors discovery MAX_* discipline)
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_BLOCKS_PER_ZONE = 24;
export const MAX_VIDEO_BLOCKS_PER_SITE = 8;
export const MAX_BLOCK_JSON_BYTES = 8192;
export const MAX_BLOCKS_PER_PAGE = 48;

// ─────────────────────────────────────────────────────────────────────────────
// Zone resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the insertion zone for a §5 content key.
 *
 * Keys are page-segmented (pageSeg.roleSeg.…): "home.hero.heading" → hero;
 * "home.services.items[0].title" → service-list; "about.about.heading" →
 * content; "home.footer.text" → footer-content. Dedicated pages hold
 * their section keys at page level ("faq.items[0].title" → faq-list via
 * the page segment). Returns null when the key doesn't resolve into any
 * approved zone (honest: not every key is in a zone — positional headings
 * etc. are overlay-editable but not zone hosts).
 */
export function zoneForKey(key: string): ZoneId | null {
  const segs = key.split(".");
  const pageSeg = segs[0] ?? "";
  if (pageSeg === "") return null;
  // Hero zone: the page's hero segment (pageSeg.hero.*).
  if (segs[1] === "hero") return "hero";
  // Footer zone: pageSeg.footer.*.
  if (segs[1] === "footer") return "footer-content";
  // Remaining keys live in role sections: pageSeg.roleSeg.… — find the
  // zone whose section-role list contains that segment.
  const roleSeg = segs[1] ?? "";
  if (roleSeg === "") return null;
  if (roleSeg === "headings" || roleSeg === "nav") return null; // positional/nav — not zone hosts
  for (const [zone, roles] of Object.entries(ZONE_SECTION_ROLES) as Array<[ZoneId, readonly string[]]>) {
    if (roles.includes(roleSeg)) return zone;
  }
  // section{n} fallback sections host generic content insertion.
  if (/^section[0-9]+$/.test(roleSeg)) return "content";
  // Dedicated-page sections: on a page that IS the section (/faq,
  // /services, /about), the section's keys sit directly under the page
  // segment ("faq.items[0].title") instead of a nested role segment
  // ("home.faq.items[0].title"). Fall back to the PAGE segment as the
  // section role, so the client's own FAQ page resolves the FAQ-list zone
  // exactly like the home page's FAQ section does. Positional and nav keys
  // ("headings", "nav") were already handled above and stay non-hosts.
  for (const [zone, roles] of Object.entries(ZONE_SECTION_ROLES) as Array<[ZoneId, readonly string[]]>) {
    if (roles.includes(pageSeg)) return zone;
  }
  return null;
}

/**
 * Resolve the zones available on a page from its §5 key list. A zone is
 * available when at least one of the page's keys resolves to it, or it is
 * an additive zone (available on every page the map knows).
 */
export function zonesForPageKeys(keys: string[]): Array<{ zone: ZoneId; label: string; roleSeg: string }> {
  const found = new Map<ZoneId, { zone: ZoneId; roleSeg: string }>();
  for (const key of keys) {
    const zone = zoneForKey(key);
    if (!zone) continue;
    const roleSeg = key.split(".")[1] ?? "";
    const existing = found.get(zone);
    // Keep the first concrete (non-hero/footer) roleSeg label for the zone.
    if (!existing) {
      found.set(zone, { zone, roleSeg });
    } else if ((existing.roleSeg === "hero" || existing.roleSeg === "footer") && roleSeg !== "hero" && roleSeg !== "footer") {
      found.set(zone, { zone, roleSeg });
    }
  }
  const out: Array<{ zone: ZoneId; label: string; roleSeg: string }> = [];
  for (const [zoneId, info] of found) {
    out.push({ zone: zoneId, label: ZONE_LABELS[zoneId], roleSeg: info.roleSeg });
  }
  // Additive zones are available on every page.
  for (const zoneId of ADDITIVE_ZONE_IDS) {
    if (!out.some((z) => z.zone === zoneId)) {
      out.push({ zone: zoneId, label: ZONE_LABELS[zoneId], roleSeg: "" });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block content validation
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockContentText { kind: "text"; text: string; style?: "paragraph" | "heading"; }
export interface BlockContentImage { kind: "image"; url: string; alt?: string; }
export interface BlockContentButton { kind: "button"; label: string; href: string; variant?: "primary" | "secondary"; }
export interface BlockContentVideo { kind: "video"; url: string; provider: "youtube" | "vimeo"; videoId: string; embedUrl: string; watchUrl: string; caption?: string; }
export interface BlockContentPdf { kind: "pdf"; resourceId: string; title: string; description?: string; buttonLabel?: string; }
export interface BlockContentCta { kind: "cta"; heading: string; body?: string; buttonLabel: string; buttonHref: string; }
export interface BlockContentFaq { kind: "faq_item"; question: string; answer: string; }
export interface BlockContentLink { kind: "link"; label: string; href: string; }

export type BlockContent =
  | BlockContentText
  | BlockContentImage
  | BlockContentButton
  | BlockContentVideo
  | BlockContentPdf
  | BlockContentCta
  | BlockContentFaq
  | BlockContentLink;

export type BlockValidation =
  | { ok: true; content: BlockContent }
  | { ok: false; reason: string };

/** Validate a proposed block for a zone (kind allowlist + field rules). */
export function validateBlock(zone: ZoneId, raw: unknown): BlockValidation {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "That content isn't formatted correctly." };
  }
  const c = raw as Record<string, unknown>;
  const kind = c.kind;
  if (typeof kind !== "string") return { ok: false, reason: "Content is missing its type." };

  const allowed = ZONE_ALLOWED_KINDS[zone];
  if (!allowed || !(allowed as readonly string[]).includes(kind)) {
    return { ok: false, reason: `That content type isn't allowed in the ${ZONE_LABELS[zone] ?? zone}.` };
  }

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  switch (kind) {
    case "text": {
      const text = clean(c.text);
      if (text === "") return { ok: false, reason: "Add some text for this block." };
      if (text.length > 2000) return { ok: false, reason: "Text blocks are limited to 2,000 characters." };
      const style = c.style === "heading" ? "heading" : "paragraph";
      return { ok: true, content: { kind: "text", text, style } };
    }
    case "image": {
      const url = clean(c.url);
      if (url === "") return { ok: false, reason: "Pick an image for this block." };
      const link = classifyLink(url);
      if (!link.ok || (link.kind !== "external" && link.kind !== "internal")) {
        return { ok: false, reason: "That image address can't be used." };
      }
      const alt = clean(c.alt).slice(0, 200);
      return { ok: true, content: { kind: "image", url: link.normalized, alt } };
    }
    case "button": {
      const label = clean(c.label);
      if (label === "") return { ok: false, reason: "Add a label for this button." };
      if (label.length > 120) return { ok: false, reason: "Button labels are limited to 120 characters." };
      const link = classifyLink(str(c.href));
      if (!link.ok) return { ok: false, reason: link.reason };
      if (link.normalized === "") return { ok: false, reason: "Add a destination for this button." };
      const variant = c.variant === "primary" || c.variant === "secondary" ? c.variant : "primary";
      return { ok: true, content: { kind: "button", label, href: link.normalized, variant } };
    }
    case "video": {
      const parsed = parseVideoUrl(str(c.url));
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      const caption = clean(c.caption).slice(0, 200);
      return { ok: true, content: { kind: "video", url: parsed.watchUrl, provider: parsed.provider, videoId: parsed.videoId, embedUrl: parsed.embedUrl, watchUrl: parsed.watchUrl, caption } };
    }
    case "pdf": {
      const resourceId = clean(c.resourceId);
      if (resourceId === "") return { ok: false, reason: "Pick a PDF resource for this block." };
      if (resourceId.length > 128) return { ok: false, reason: "That resource reference is invalid." };
      const title = clean(c.title);
      if (title === "") return { ok: false, reason: "Add a title for this PDF." };
      if (title.length > 200) return { ok: false, reason: "PDF titles are limited to 200 characters." };
      const description = clean(c.description).slice(0, 500);
      const buttonLabel = clean(c.buttonLabel).slice(0, 120);
      return { ok: true, content: { kind: "pdf", resourceId, title, description, buttonLabel } };
    }
    case "cta": {
      const heading = clean(c.heading);
      if (heading === "") return { ok: false, reason: "Add a headline for this call to action." };
      if (heading.length > 160) return { ok: false, reason: "Call-to-action headlines are limited to 160 characters." };
      const body = clean(c.body).slice(0, 500);
      const buttonLabel = clean(c.buttonLabel);
      if (buttonLabel === "") return { ok: false, reason: "Add a button label for this call to action." };
      if (buttonLabel.length > 120) return { ok: false, reason: "Button labels are limited to 120 characters." };
      const link = classifyLink(str(c.buttonHref));
      if (!link.ok) return { ok: false, reason: link.reason };
      if (link.normalized === "") return { ok: false, reason: "Add a destination for the button." };
      return { ok: true, content: { kind: "cta", heading, body, buttonLabel, buttonHref: link.normalized } };
    }
    case "faq_item": {
      const question = clean(c.question);
      if (question === "") return { ok: false, reason: "Add a question for this FAQ item." };
      if (question.length > 300) return { ok: false, reason: "FAQ questions are limited to 300 characters." };
      const answer = clean(c.answer);
      if (answer === "") return { ok: false, reason: "Add an answer for this FAQ item." };
      if (answer.length > 2000) return { ok: false, reason: "FAQ answers are limited to 2,000 characters." };
      return { ok: true, content: { kind: "faq_item", question, answer } };
    }
    case "link": {
      const label = clean(c.label);
      if (label === "") return { ok: false, reason: "Add a label for this link." };
      if (label.length > 120) return { ok: false, reason: "Link labels are limited to 120 characters." };
      const link = classifyLink(str(c.href));
      if (!link.ok) return { ok: false, reason: link.reason };
      if (link.normalized === "") return { ok: false, reason: "Add a destination for this link." };
      return { ok: true, content: { kind: "link", label, href: link.normalized } };
    }
    default:
      return { ok: false, reason: "That content type isn't supported." };
  }
}

/**
 * Serialize a validated block to its stored form (compact) and enforce the
 * stored-size cap. Returns null when over cap (caller rejects with a
 * client-safe reason).
 */
export function blockContentBytes(content: BlockContent): number {
  return JSON.stringify(content).length;
}
