/**
 * CHAT B — Server-rendered sanitized block HTML (§6 rendering).
 *
 * PURE LIBRARY — no Convex ctx. The ONLY place insertion-block HTML is
 * ever built. Blocks render from validated content fields (never from
 * client-supplied HTML), so the output is safe by construction; the
 * allowlist discipline below is defense-in-depth for the bridge serve
 * path (published blocks) and the editor frame preview payload.
 *
 * Rendered classes intentionally reuse neutral, theme-agnostic classes
 * (taya-block …) so external sites can style or override without the
 * design system leaking. Videos render as a link-card (title/caption +
 * watch link) — NO <iframe> is emitted for external serve: iframe
 * injection on third-party sites is out of scope v1 (known limitation,
 * reported honestly).
 */

import type { BlockContent } from "./editorZones";

/** Class fragment shared by every rendered block wrapper. */
const WRAP = "taya-block";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render ONE validated block to sanitized HTML.
 * Returns "" for unrecognized content (honest no-op, never an error page).
 *
 * blockId (optional): stamps data-taya-block-id on the wrapper so the editor
 * frame can report which added block was clicked. Id values come from the
 * server (Convex ids), never client input, so no escaping surface changes.
 */
export function renderBlockHtml(content: BlockContent, blockId?: string): string {
  const idAttr = blockId ? ` data-taya-block-id="${esc(blockId)}"` : "";
  switch (content.kind) {
    case "text":
      return content.style === "heading"
        ? `<h3 class="${WRAP} taya-block-heading"${idAttr}>${esc(content.text)}</h3>`
        : `<p class="${WRAP} taya-block-text"${idAttr}>${esc(content.text)}</p>`;

    case "image":
      return `<figure class="${WRAP} taya-block-image"${idAttr}><img src="${esc(content.url)}" alt="${esc(content.alt ?? "")}" loading="lazy" /></figure>`;

    case "button":
      return `<div class="${WRAP} taya-block-button"${idAttr}><a class="taya-btn" href="${esc(content.href)}" target="_blank" rel="noopener noreferrer">${esc(content.label)}</a></div>`;

    case "video":
      return `<figure class="${WRAP} taya-block-video"${idAttr} data-taya-video="${esc(content.videoId)}" data-taya-video-provider="${esc(content.provider)}">` +
        `<a class="taya-video-card" href="${esc(content.watchUrl)}" target="_blank" rel="noopener noreferrer">` +
        `<span class="taya-video-icon" aria-hidden="true">▶</span>` +
        `<span class="taya-video-label">Watch video</span>` +
        (content.caption ? `<span class="taya-video-caption">${esc(content.caption)}</span>` : "") +
        `</a></figure>`;

    case "pdf":
      return `<div class="${WRAP} taya-block-pdf"${idAttr}>` +
        `<a class="taya-pdf-card" href="#" data-taya-resource="${esc(content.resourceId)}">` +
        `<span class="taya-pdf-label">${esc(content.title)}</span>` +
        (content.description ? `<span class="taya-pdf-desc">${esc(content.description)}</span>` : "") +
        `<span class="taya-pdf-action">${esc(content.buttonLabel || "Download PDF")}</span>` +
        `</a></div>`;

    case "cta":
      return `<div class="${WRAP} taya-block-cta"${idAttr}>` +
        `<span class="taya-cta-heading">${esc(content.heading)}</span>` +
        (content.body ? `<span class="taya-cta-body">${esc(content.body)}</span>` : "") +
        `<a class="taya-btn" href="${esc(content.buttonHref)}" target="_blank" rel="noopener noreferrer">${esc(content.buttonLabel)}</a>` +
        `</div>`;

    case "faq_item":
      return `<div class="${WRAP} taya-block-faq"${idAttr}>` +
        `<span class="taya-faq-q">${esc(content.question)}</span>` +
        `<span class="taya-faq-a">${esc(content.answer)}</span>` +
        `</div>`;

    case "link":
      return `<a class="${WRAP} taya-block-link"${idAttr} href="${esc(content.href)}" target="_blank" rel="noopener noreferrer">${esc(content.label)}</a>`;

    default:
      return "";
  }
}

/**
 * Zone container markup for the bridge serve path: a wrapper the snippet
 * can find ([data-taya-zone]) plus rendered children. Additive zones get
 * their own section wrapper; discovered zones wrap in a plain div so the
 * page's own layout flow is respected.
 */
export function renderZoneHtml(zone: string, blocksHtml: string[]): string {
  const inner = blocksHtml.join("");
  if (zone === "video-section" || zone === "cta-stack") {
    return `<section class="taya-zone taya-zone-${esc(zone)}" data-taya-zone="${esc(zone)}">${inner}</section>`;
  }
  return `<div class="taya-zone taya-zone-${esc(zone)}" data-taya-zone="${esc(zone)}">${inner}</div>`;
}
