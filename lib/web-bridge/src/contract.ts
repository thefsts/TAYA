/**
 * THE TAYA WEB BRIDGE CONTRACT — dashboard-side mirror of
 * convex/lib/webBridgeContract.ts (the canonical constants).
 *
 * web-bridge-contract.test.ts locks every constant equal between the two
 * files, so a drift fails CI before it can break any embedded site.
 *
 * UNIVERSAL: no customer names, no slugs, no domains, no platform
 * branches. Any external site embeds the same snippet and speaks the
 * same protocol.
 */

export const TAYA_BRIDGE_VERSION = 2;

export const BRIDGE_ATTR_KEY = "data-taya-edit";
export const BRIDGE_ATTR_TYPE = "data-taya-type";
export const BRIDGE_ATTR_LABEL = "data-taya-label";
export const BRIDGE_ATTR_REPEATABLE = "data-taya-repeatable";
export const BRIDGE_ATTR_PAGE = "data-taya-page";

/** v2: embed attribute marking a safe insertion zone container (§6). */
export const BRIDGE_ATTR_ZONE = "data-taya-zone";

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

export const BRIDGE_EVENT_READY = "taya:bridge-ready";
export const BRIDGE_EVENT_CLICK = "taya:element-click";
export const BRIDGE_EVENT_PREVIEW_APPLIED = "taya:preview-applied";
/** v2: dispatched after published zone blocks are rendered/appended. */
export const BRIDGE_EVENT_BLOCKS_APPLIED = "taya:blocks-applied";
/** v2: dispatched after published structural ops (hide/reorder) are applied. */
export const BRIDGE_EVENT_STRUCTURAL_APPLIED = "taya:structural-applied";

export const BRIDGE_PATH_CONTENT = "/api/bridge/content";
export const BRIDGE_PATH_DRAFT = "/api/bridge/draft";
export const BRIDGE_PATH_VERIFY = "/api/bridge/verify";
export const BRIDGE_PATH_CLICK = "/api/bridge/click";

export const BRIDGE_PARAM_SLUG = "slug";
export const BRIDGE_PARAM_TOKEN = "token";

export const BRIDGE_FIELD_VALUES = "values";
export const BRIDGE_FIELD_DRAFTS = "drafts";
export const BRIDGE_FIELD_PAGES = "pages";
export const BRIDGE_FIELD_MODE = "mode";
export const BRIDGE_FIELD_VERSION = "bridgeVersion";
/** v2: published zone-block HTML keyed by page path (bridge _content). */
export const BRIDGE_FIELD_BLOCKS = "blocks";
/** v2: published structural ops (itemOrder/hiddenItems) keyed by page path. */
export const BRIDGE_FIELD_STRUCTURAL = "structural";

export const BRIDGE_SNIPPET_PARAMS = ["slug"] as const;

const KEY_PATTERN =
  /^(?:[a-z][a-z0-9_]*)(?:\.(?:[a-z][a-z0-9_]*|items\[\d+\](?:\.[a-z][a-z0-9_]*)*))*$/;

export function isValidBridgeKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export interface SiteManifest {
  bridgeVersion: number;
  siteSlug: string;
  domain: string | null;
  connectionMode: string | null;
  pages: Array<{ path: string; label: string; title: string | null; keyCount: number }>;
}
