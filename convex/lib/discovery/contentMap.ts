/**
 * PHASE 2 — Universal Website Adapter: §5 page/content map + §4→§7 workspace
 * auto-conform derivation (PR-2).
 *
 * PURE LIBRARY — no Convex ctx, no network, no per-customer logic.
 *
 * Two pure functions:
 *
 *   buildPageMap(snapshot)
 *       Converts a completed DiscoverySnapshot into the durable PAGE MAP
 *       stored in siteContentMaps: pages[] (path, label, title, keyCount)
 *       plus entries keyed by the §5 semantic content keys
 *       (home.hero.heading, services.items[0].title, about.intro.body …).
 *       The crawl's contentMap is the SINGLE SOURCE OF TRUTH for keys and
 *       values (html.ts/foldIntoContentMap derive them); this builder only
 *       re-shapes them into the persisted entry format. Draft/published
 *       overlays are applied later by the writers — never fabricated here.
 *
 *   conformWorkspace(snapshot)
 *       Derives the §7 workspace configuration plan from the discovery
 *       snapshot: an ENABLE-ONLY enabledModules patch (a discovered /courses
 *       route turns the courses module ON — discovery can never turn a
 *       module OFF or grant any RBAC permission), navigation entries for
 *       discovered routes, and the pages list for the workspace page
 *       navigator.
 *
 * Spec discipline:
 *  - §5: "avoid brittle raw DOM selectors as the permanent contract" — the
 *    page map is keyed by the snapshot's semantic keys, which html.ts
 *    derives from page/section/element semantics.
 *  - §7 auto-conform is UI/module/page-map configuration ONLY: it never
 *    grants RBAC permissions, never overwrites owner roles, and never
 *    exposes admin/system modules (CONFORMABLE_MODULES is deliberately
 *    narrower than the full dashboard universe — payments, commerce, email,
 *    crm, health, history, activity, backups… can never be derived from a
 *    crawl).
 *  - §23 websites-are-data: the route→module table is generic (any site,
 *    any customer); there is NO per-customer slug branch in this file.
 */

import { pageKeySegment } from "./html";
import { MODULE_NAV_MAP } from "../siteProvisioning";
import type { DiscoverySnapshot } from "./crawl";

// ─────────────────────────────────────────────────────────────────────────────
// §5 PAGE MAP TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Persisted entry value kind (§5 element types + discovery-native kinds). */
export type ContentEntryType =
  | "text"
  | "image"
  | "url"
  | "list_item"
  | "button"
  | "link"
  | "repeatable"
  | "video"
  | "download";

/** Map of §5 semantic content key → persisted entry (draft/published overlays). */
export interface ContentMapEntries {
  [key: string]: {
    /** Value kind (§5 element types + discovery-native kinds). */
    type: ContentEntryType;
    /** Value as discovered by the crawl (immutable baseline). */
    discovered: string;
    /** Draft value saved by a user (Visual Editor). */
    draft?: string;
    /** Value live on the website via the bridge (set at publish). */
    published?: string;
    /** True when a later crawl no longer finds this key. */
    stale?: boolean;
    /** Where the discovered value came from (evidence, §14). */
    evidence?: string;
  };
}

/** One page in the durable page map. */
export interface PageMapPage {
  /** Route path, e.g. "/services" or "/" (home). */
  path: string;
  /** Human label derived from nav label, <title>, or the path segment. */
  label: string;
  /** Page <title> as discovered. */
  title: string | null;
  /** Number of content keys attributed to this page. */
  keyCount: number;
}

/** The durable page map document body (siteContentMaps.body). */
export interface PageMapDoc {
  /** Version of the page-map format. */
  version: 1;
  /** Map domain at crawl time. */
  domain: string;
  /** Pages discovered (§4). */
  pages: PageMapPage[];
  /** Semantic content entries (§5). */
  entries: ContentMapEntries;
  /** Total entry count. */
  keyCount: number;
  /** Timestamp of the snapshot this map was built from. */
  builtFromSnapshotAt: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 route → §7 module table (generic; NO per-customer logic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic route → dashboard-module table (§7 "auto-conform client workspace").
 * A discovered route maps to the client-facing module that manages that kind
 * of content. This table is data — mapping a new site shape never requires
 * a per-customer code path.
 */
export const ROUTE_MODULE_TABLE: Array<{ path: string; module: string; label: string }> = [
  { path: "/services", module: "services", label: "Services" },
  { path: "/courses", module: "courses", label: "Courses" },
  { path: "/events", module: "events", label: "Events" },
  { path: "/products", module: "products", label: "Products" },
  { path: "/team", module: "team", label: "Team" },
  { path: "/faq", module: "faq", label: "FAQ" },
  { path: "/blog", module: "articles", label: "Blog" },
  { path: "/articles", module: "articles", label: "Articles" },
  { path: "/resources", module: "articles", label: "Resources" },
  { path: "/testimonials", module: "testimonials", label: "Testimonials" },
  { path: "/careers", module: "careers", label: "Careers" },
  { path: "/downloads", module: "downloads", label: "Downloads" },
];

/**
 * The module keys auto-conform may ENABLE. Deliberately narrow: the full
 * dashboard module universe includes admin/system surfaces that a crawl
 * must never expose on a client workspace. Only client-facing content
 * modules are conform-eligible.
 */
export const CONFORMABLE_MODULES: readonly string[] = [
  "homepage", "courses", "events", "articles", "media", "faq",
  "testimonials", "team", "careers", "downloads", "contact", "footer", "seo",
  "services", "products",
];

/**
 * Map a discovered route path to a conformable module (exact match or
 * sub-route: "/courses" and "/courses/basic-pistol" both hit courses;
 * "/training/classes" hits nothing). Returns null for unknown routes —
 * they are fine, they simply appear as pages in the navigator.
 */
export function moduleForRoute(path: string): string | null {
  if (path === "/") return null;
  let best: string | null = null;
  for (const row of ROUTE_MODULE_TABLE) {
    if (path === row.path || path.startsWith(row.path + "/")) {
      if (best === null || row.path.length > best.length) best = row.path;
    }
  }
  if (best === null) return null;
  const moduleKey = ROUTE_MODULE_TABLE.find((r) => r.path === best)!.module;
  return CONFORMABLE_MODULES.includes(moduleKey) ? moduleKey : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPageMap — §5 page/content map from a completed snapshot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a page label: nav label (§4 route label) → page <title> → path
 * segment title-cased. Deterministic.
 */
function pageLabel(path: string, title: string | null, routes: DiscoverySnapshot["routes"]): string {
  if (path === "/") return "Home";
  const nav = routes.find((r) => r.path === path);
  if (nav?.label) return nav.label;
  if (title && title.trim()) return title.trim().slice(0, 80);
  const segment = path.replace(/^\//, "").split("/")[0] ?? "";
  return segment
    ? segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : path;
}

/** Normalize a crawl contentMap type into the persisted entry type. */
function normalizeEntryType(type: string): ContentEntryType {
  switch (type) {
    case "text":
    case "image":
    case "url":
    case "list_item":
    case "button":
    case "link":
    case "repeatable":
    case "video":
    case "download":
      return type;
    default:
      return "text";
  }
}

/**
 * Build the durable §5 page/content map from a completed discovery snapshot.
 * PURE: same snapshot in → identical map out (pinned by tests).
 *
 * Entry keys/values come from snapshot.contentMap (the crawl's canonical
 * fold — single source of truth). Per-page key counts attribute each key to
 * the page with the LONGEST matching pageKeySegment prefix, so nested routes
 * ("/training/classes" → "training.classes.*") are not misattributed to
 * their parent ("/training").
 */
export function buildPageMap(snapshot: DiscoverySnapshot): PageMapDoc {
  const fetched = snapshot.pages.filter((p) => p.status === "fetched" && p.model);

  // Home first, then lexicographic — deterministic ordering.
  const ordered = [...fetched].sort((a, b) =>
    a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path),
  );

  const pageSegs = ordered.map((p) => ({ path: p.path, seg: pageKeySegment(p.path) }));
  const perPageKeys = new Map<string, string[]>(ordered.map((p) => [p.path, [] as string[]]));

  const entries: ContentMapEntries = {};
  for (const [key, entry] of Object.entries(snapshot.contentMap)) {
    entries[key] = {
      type: normalizeEntryType(entry.type),
      discovered: entry.value,
      evidence: entry.evidence,
    };
    // Attribute to the longest matching page segment (namesake elision means
    // "/services" page keys read "services.items[0].title" — still prefixed).
    let owner: { path: string; seg: string } | null = null;
    for (const p of pageSegs) {
      if (key === p.seg || key.startsWith(p.seg + ".")) {
        if (owner === null || p.seg.length > owner.seg.length) owner = p;
      }
    }
    if (owner) perPageKeys.get(owner.path)!.push(key);
  }

  const pages: PageMapPage[] = ordered.map((p) => ({
    path: p.path,
    label: pageLabel(p.path, p.model!.meta.title ?? null, snapshot.routes),
    title: p.model!.meta.title ?? null,
    keyCount: perPageKeys.get(p.path)?.length ?? 0,
  }));

  return {
    version: 1,
    domain: snapshot.domain,
    pages,
    entries,
    keyCount: Object.keys(entries).length,
    builtFromSnapshotAt: snapshot.crawlCompletedAt ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// conformWorkspace — §7 auto-conform derivation (PURE)
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-conform plan: what the discovery snapshot says the workspace needs. */
export interface ConformPlan {
  /** ENABLE-ONLY patch for sites.enabledModules (conformable keys only). */
  enabledModulesPatch: Record<string, boolean>;
  /** Navigation entries to insert, deduped by href (caller skips existing). */
  navEntries: Array<{ label: string; href: string; moduleKey: string }>;
  /** Pages for the workspace page navigator (from the §5 page map). */
  pages: PageMapPage[];
  /** Module keys the snapshot ENABLED (evidence for the activity log). */
  enabledModuleKeys: string[];
}

/**
 * Derive the §7 workspace auto-conform plan from a completed snapshot.
 * PURE. The caller (discovery.persistSnapshot) applies this ATOMICALLY in
 * the same transaction as the snapshot insert:
 *  - enabledModules: enable-only merge (never disables, never grants).
 *  - navigationItems: insert only entries whose href is not already present.
 *  - siteContentMaps: upsert with draft/published preservation + stale marks.
 * Idempotent by construction: applying the same plan twice changes nothing
 * the second time.
 */
export function conformWorkspace(
  snapshot: DiscoverySnapshot,
  /** Inferred site type (§2 siteProfile inference) — the restaurant
   * commerce policy gate below keys off it. Optional for pure-plan callers. */
  inferredSiteType?: string | null,
): ConformPlan {
  const pageMap = buildPageMap(snapshot);
  const modules: Record<string, boolean> = {};

  // PM locked rule (restaurant convergence): a restaurant site NEVER gets
  // the generic `products` module auto-enabled — even with genuine
  // storefront evidence (/shop, /products, cart vocabulary). The route
  // still becomes a page in the navigator; the module waits for an
  // explicit owner/FSTS enablement decision. All other site types keep
  // the existing universal behavior.
  const restaurantNoProducts =
    inferredSiteType === "restaurant" ? "products" : null;

  for (const route of snapshot.routes) {
    const moduleKey = moduleForRoute(route.path);
    if (moduleKey && moduleKey !== restaurantNoProducts) modules[moduleKey] = true;
  }
  const enabledModuleKeys = Object.keys(modules);

  // Navigation candidates, deduped by href:
  //  1. Standard MODULE_NAV_MAP entries for modules conform ENABLED — a
  //     business_website site provisions with courses/events OFF (no nav
  //     rows seeded); if the crawl finds /courses, conform turns the module
  //     on AND provides the nav row the native seeding would have made.
  //  2. Non-standard conformable routes (/services, /team, /faq, …) with
  //     the crawl's own nav label.
  const navEntries: ConformPlan["navEntries"] = [];
  const seenHref = new Set<string>();
  for (const [moduleKey, entry] of Object.entries(MODULE_NAV_MAP)) {
    if (modules[moduleKey] !== true) continue;
    if (entry.href === "/") continue; // Home nav is always seeded
    if (seenHref.has(entry.href)) continue;
    seenHref.add(entry.href);
    navEntries.push({ label: entry.label, href: entry.href, moduleKey });
  }
  for (const row of ROUTE_MODULE_TABLE) {
    if (seenHref.has(row.path)) continue;
    const route = snapshot.routes.find((r) => r.path === row.path);
    if (!route) continue;
    if (modules[row.module] !== true) continue;
    seenHref.add(row.path);
    navEntries.push({
      label: route.label || row.label,
      href: row.path,
      moduleKey: row.module,
    });
  }

  return {
    enabledModulesPatch: modules,
    navEntries,
    pages: pageMap.pages,
    enabledModuleKeys,
  };
}

/**
 * Merge a conform plan's module patch into an existing enabledModules map.
 * ENABLE-ONLY: existing true stays true, existing false stays false unless
 * the patch enables it, and unknown patch keys are dropped (never invents
 * module keys outside CONFORMABLE_MODULES).
 *
 * §6 override preservation: when `overrides` carries an explicit owner
 * decision for a module key (set by sites.update with an explicit
 * enabledModules payload), the owner's decision WINS over the conform
 * patch — a later re-crawl can never silently re-enable a module the
 * owner explicitly disabled (and never disable one they enabled).
 */
export function mergeEnabledModules(
  current: Record<string, boolean> | undefined | null,
  patch: Record<string, boolean>,
  overrides?: Record<string, boolean> | null,
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...(current ?? {}) };
  const ownerDecisions = overrides ?? {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === true && CONFORMABLE_MODULES.includes(key)) {
      // The owner's explicit decision outranks the crawl's inference.
      if (key in ownerDecisions) continue;
      merged[key] = true;
    }
  }
  // Owner decisions are also authoritative over any pre-crawl stale value
  // for their keys (they were set AFTER the last conform by definition).
  for (const [key, value] of Object.entries(ownerDecisions)) {
    if (value === true && CONFORMABLE_MODULES.includes(key)) merged[key] = true;
    else if (value === false) merged[key] = false;
  }
  return merged;
}
