/**
 * Harness pipeline entry — re-export the REAL engine modules.
 *
 * This file exists ONLY to give esbuild a single entry point. Every
 * export below is the real, production implementation the dashboard and
 * Convex functions use. The harness server never re-implements pipeline
 * logic; it can only WIRE the real functions into HTTP routes.
 */
export { annotatePage, collectBindings } from "../../../convex/lib/editorAnnotate";
export { buildFrameDocument } from "../../../convex/lib/editorFrame";
export { renderBlockHtml, renderZoneHtml } from "../../../convex/lib/editorBlocks";
export {
  validateBlock,
  zonesForPageKeys,
  zoneForKey,
  ZONE_ALLOWED_KINDS,
  ADDITIVE_ZONE_IDS,
  MAX_BLOCKS_PER_ZONE,
  MAX_VIDEO_BLOCKS_PER_SITE,
  MAX_BLOCK_JSON_BYTES,
} from "../../../convex/lib/editorZones";
export { generateBridgeSnippet } from "../../../lib/web-bridge/src/snippet";
export { fetchPage, crawlSite } from "../../../convex/lib/discovery/crawl";
export { extractPageModel, pageKeySegment } from "../../../convex/lib/discovery/html";
export { buildPageMap } from "../../../convex/lib/discovery/contentMap";
export { homePage, servicesPage, faqPage, SITE_PAGES } from "./sitePages";
