/**
 * CHAT B — client language for the visual editor (§2/§3 UX layer).
 *
 * The ONLY module allowed to translate the engine's area/kind vocabulary
 * into phrases a client understands. The area registry itself stays in
 * convex/lib/editorZones.ts (engine, server-canonical); this module is a
 * UI-layer lookup so engine names can never leak into client copy and
 * client copy can never drift back into the engine.
 *
 * Rule (ux-audit §D): no engine ids, no engine labels, no "zone"/"block"/
 * "key"/"vault"/"§5" in anything a client reads.
 */

/** "+ Add …" quick actions — the exact strings a client sees. */
export const ADD_ACTIONS: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: "text", label: "+ Add text" },
  { kind: "image", label: "+ Add image" },
  { kind: "video", label: "+ Add video" },
  { kind: "pdf", label: "+ Add resource" },
  { kind: "faq_item", label: "+ Add FAQ" },
  { kind: "cta", label: "+ Add CTA" },
  { kind: "button", label: "+ Add button" },
];

/** Plain-language WHERE phrases — never engine ids or engine labels. */
const WHERE_PHRASES: Record<string, string> = {
  hero: "at the top of the page",
  content: "in the main content area",
  "article-feed": "in the articles list",
  "resource-grid": "in the resources area",
  "service-list": "in the services list",
  "product-grid": "in the products list",
  "video-section": "in the video area",
  "testimonial-list": "in the testimonials list",
  "faq-list": "in the FAQ list",
  "cta-stack": "near the call to action",
  "footer-content": "in the footer",
};

/** Where a piece of content will appear, in client language. */
export function wherePhrase(zone: string): string {
  return WHERE_PHRASES[zone] ?? "on this page";
}

/** Area names for lists ("Top of the page", never engine ids or labels). */
const AREA_NAMES: Record<string, string> = {
  hero: "Top of the page",
  content: "Main content area",
  "article-feed": "Articles list",
  "resource-grid": "Resources area",
  "service-list": "Services list",
  "product-grid": "Products list",
  "video-section": "Video area",
  "testimonial-list": "Testimonials list",
  "faq-list": "FAQ list",
  "cta-stack": "Call-to-action area",
  "footer-content": "Footer",
};

/** Short area name for grouping lists of added content. */
export function areaName(zone: string): string {
  return AREA_NAMES[zone] ?? "This page";
}

/** Content-kind header for the selected element (§2 identification). */
const KIND_HEADERS: Record<string, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  button: "Button",
  link: "Link",
  list_item: "List item",
  text: "Text",
};

/** Header naming WHAT was clicked, in client language. */
export function kindHeader(kind: string | null | undefined): string {
  if (kind && KIND_HEADERS[kind]) return KIND_HEADERS[kind];
  return "Text";
}

/**
 * Honest explanation for a kind with nowhere to go on this page
 * (flow 9 — never a silent no-op, never a fake promise about other pages).
 */
const KIND_PLURAL: Record<string, string> = {
  text: "Text",
  image: "Images",
  button: "Buttons",
  video: "Videos",
  pdf: "PDF resources",
  cta: "Call-to-action blocks",
  faq_item: "FAQ items",
  link: "Links",
};

/** Plural client-language name for a content kind. */
export function pluralKind(kind: string): string {
  return KIND_PLURAL[kind] ?? "That content";
}

export function unavailableSentence(labels: string[]): string {
  if (labels.length === 0) return "";
  const list = labels.join(", ");
  return `${list} can't be added to this page — its set areas don't include a spot for ${labels.length === 1 ? "it" : "them"}.`;
}
