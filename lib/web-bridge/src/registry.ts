/**
 * Bridge registry — PURE descriptor tables for the embed surface.
 *
 * Given a §5 content-map manifest, produce the descriptors a page needs:
 * which elements are bridge-editable, with what key/type/label/page.
 * No DOM, no fetch, no customer-specific data.
 */

import {
  BRIDGE_ATTR_KEY,
  BRIDGE_ATTR_LABEL,
  BRIDGE_ATTR_PAGE,
  BRIDGE_ATTR_REPEATABLE,
  BRIDGE_ATTR_TYPE,
  isValidBridgeKey,
  type BridgeEntryType,
  type SiteManifest,
} from "./contract";

export interface BridgeDescriptor {
  key: string;
  type: BridgeEntryType | null;
  label: string | null;
  page: string | null;
  repeatable: boolean;
}

const REPEATABLE_HINTS = ["items", "list", "cards", "features", "testimonials"];

/**
 * Build the descriptor list from a manifest's pages + a key→type map.
 * Malformed keys (failing the §5 grammar) are rejected — the registry is
 * the allowlist enforcement point client-side.
 */
export function buildRegistry(
  manifest: Pick<SiteManifest, "pages">,
  entryTypes: Record<string, string>,
): BridgeDescriptor[] {
  const out: BridgeDescriptor[] = [];

  for (const page of manifest.pages) {
    for (const [key, rawType] of Object.entries(entryTypes)) {
      if (!isValidBridgeKey(key)) continue;
      if (!keyBelongsToPage(key, page.path)) continue;

      out.push({
        key,
        type: normalizeType(rawType),
        label: key,
        page: page.path,
        repeatable: REPEATABLE_HINTS.some((h) => key.includes(h)),
      });
    }
  }

  return out;
}

/** §5 attribution: key belongs to its longest matching page segment. */
export function keyBelongsToPage(key: string, pagePath: string): boolean {
  const seg = pageSegment(pagePath);
  return key === seg || key.startsWith(seg + ".");
}

/** "/" → "home"; "/services" → "services"; "/training/classes" → "training.classes". */
export function pageSegment(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "home";
  return trimmed.replace(/\//g, ".").toLowerCase();
}

function normalizeType(raw: string): BridgeEntryType | null {
  return (["text", "image", "url", "list_item", "button", "link", "repeatable"] as const).find(
    (t) => t === raw,
  ) ?? null;
}

/** Attribute names for embedding (re-exported for snippet generation). */
export const BRIDGE_ATTRS = {
  key: BRIDGE_ATTR_KEY,
  type: BRIDGE_ATTR_TYPE,
  label: BRIDGE_ATTR_LABEL,
  page: BRIDGE_ATTR_PAGE,
  repeatable: BRIDGE_ATTR_REPEATABLE,
} as const;
