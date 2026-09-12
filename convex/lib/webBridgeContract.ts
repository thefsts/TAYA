/**
 * PHASE 2 PR-2 — THE TAYA WEB BRIDGE CONTRACT (canonical constants).
 *
 * This file is the single source of truth for the bridge wire contract:
 * version, attribute names, event names, endpoint paths, and payload
 * shapes. The dashboard package (lib/web-bridge) mirrors these constants
 * for its embed snippet; web-bridge-contract.test.ts locks the two in
 * step (a mismatch fails CI).
 *
 * THE CONTRACT IS UNIVERSAL: no customer names, no slugs, no domains, no
 * platform-specific branches. Any external site — regardless of who built
 * it — embeds the same snippet and speaks the same protocol.
 */

/** Bridge protocol version (bump on breaking changes). */
export const TAYA_BRIDGE_VERSION = 2;

/** Embed attribute carrying the §5 semantic key. */
export const BRIDGE_ATTR_KEY = "data-taya-edit";
/** Embed attribute carrying the entry type (text/image/button/link/…). */
export const BRIDGE_ATTR_TYPE = "data-taya-type";
/** Embed attribute carrying a human label. */
export const BRIDGE_ATTR_LABEL = "data-taya-label";
/** Embed attribute marking a repeatable section. */
export const BRIDGE_ATTR_REPEATABLE = "data-taya-repeatable";
/** Embed attribute carrying the owning page path (best-effort). */
export const BRIDGE_ATTR_PAGE = "data-taya-page";

/**
 * v2: embed attribute marking a SAFE INSERTION ZONE container (§6).
 * A zone container is any element the site marks with
 * data-taya-zone="<zoneId>" (e.g. data-taya-zone="video-section"). The
 * bridge appends published zone blocks inside it. Sites without zone
 * containers get the honest fallback placement (no silent dropping).
 */
export const BRIDGE_ATTR_ZONE = "data-taya-zone";

/** Entry types (§5 grammar — mirrors ContentEntryType in contentMap.ts). */
export const BRIDGE_ENTRY_TYPES = [
  "text",
  "image",
  "url",
  "list_item",
  "button",
  "link",
  "repeatable",
] as const;
export type BridgeEntryType = (typeof BRIDGE_ENTRY_TYPES)[number];

/** DOM events the snippet dispatches (all bubbles + composed). */
export const BRIDGE_EVENT_READY = "taya:bridge-ready";
export const BRIDGE_EVENT_CLICK = "taya:element-click";
export const BRIDGE_EVENT_PREVIEW_APPLIED = "taya:preview-applied";
/** v2: dispatched after published zone blocks are rendered/appended. */
export const BRIDGE_EVENT_BLOCKS_APPLIED = "taya:blocks-applied";
/** v2: dispatched after published structural ops (hide/reorder) are applied. */
export const BRIDGE_EVENT_STRUCTURAL_APPLIED = "taya:structural-applied";

/** HTTP endpoints (hosted on the Convex deployment's http actions). */
export const BRIDGE_PATH_CONTENT = "/api/bridge/content";
export const BRIDGE_PATH_DRAFT = "/api/bridge/draft";
export const BRIDGE_PATH_VERIFY = "/api/bridge/verify";
export const BRIDGE_PATH_CLICK = "/api/bridge/click";

/** Query/body params. */
export const BRIDGE_PARAM_SLUG = "slug";
export const BRIDGE_PARAM_TOKEN = "token";

/** Server response field names. */
export const BRIDGE_FIELD_VALUES = "values";
export const BRIDGE_FIELD_DRAFTS = "drafts";
export const BRIDGE_FIELD_PAGES = "pages";
export const BRIDGE_FIELD_MODE = "mode";
export const BRIDGE_FIELD_VERSION = "bridgeVersion";
/** v2: published zone-block HTML keyed by page path (bridge _content). */
export const BRIDGE_FIELD_BLOCKS = "blocks";
/** v2: published structural ops (itemOrder/hiddenItems) keyed by page path. */
export const BRIDGE_FIELD_STRUCTURAL = "structural";

/** The bridge snippet's required query param list (for validation). */
export const BRIDGE_SNIPPET_PARAMS = [BRIDGE_PARAM_SLUG] as const;

/**
 * Validate a semantic key against the §5 grammar: dot-separated segments,
 * each segment a lowercase identifier or `items[<index>]`/`items[<i>].<f>`
 * style index access. Used by the registry to reject malformed embeds
 * before they ever reach the server.
 */
const KEY_PATTERN =
  /^(?:[a-z][a-z0-9_]*)(?:\.(?:[a-z][a-z0-9_]*|items\[\d+\](?:\.[a-z][a-z0-9_]*)*))*$/;

export function isValidBridgeKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Manifest the dashboard renders for the editor's page navigator. */
export interface SiteManifest {
  bridgeVersion: number;
  siteSlug: string;
  domain: string | null;
  connectionMode: string | null;
  pages: Array<{ path: string; label: string; title: string | null; keyCount: number }>;
}
