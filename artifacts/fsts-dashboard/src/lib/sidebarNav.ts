/**
 * sidebarNav.ts
 *
 * Pure, data-driven sidebar navigation model for the TAYA client workspace.
 * No React dependency — structure, gating and hide-empty behavior are
 * unit-testable directly.
 *
 * PHASE 6 (adaptive dashboard) — this file is DERIVED from the canonical
 * capability registry (capabilityRegistry.ts). Every navigation surface is
 * a registry entry; nothing renders that the registry does not declare. The
 * derivation pipeline, in order:
 *
 *   support classification → scope → enabled-modules gating →
 *   role permission → business-fit de-clutter → terminology label →
 *   group placement → hide-empty
 *
 * Rules (PM-approved adaptive dashboard spec):
 *   - NATIVE + enabled + permitted        → SHOW
 *   - module explicitly disabled          → HIDE
 *   - permission "none"                   → HIDE
 *   - FUTURE / UNSUPPORTED                → HIDE (they are not in
 *                                          CAPABILITY_REGISTRY at all;
 *                                          FUTURE_CAPABILITIES documents the
 *                                          missing backend contracts)
 *   - modules or permissions unknown (query loading/failed) → CORE-ONLY
 *     fallback: core-tier items still render so the workspace is never
 *     blank; optional-tier items are hidden until the truth is known —
 *     never guessed (PM decision 3).
 *   - superAdmin bypasses permission gating (retains admin visibility) but
 *     module gating still applies (a disabled module is disabled).
 *   - capabilities without a roleModuleKey have NO role gate beyond site
 *     membership (registry contract — matches legacy always-visible items
 *     like All Pages, Website Settings, Site Verification, My Permissions).
 *   - read_only sees a view-capable menu; it never sees the owner's
 *     edit/manage affordances because permission levels drive what renders.
 *   - admin-scope capabilities (e.g. User Management at /app/admin/users)
 *     render for superAdmins only (legacy superAdminOnly contract).
 *   - hiddenByDefault de-clutter applies ONLY when the site owner has made
 *     no explicit module decision (unset map entry): explicit true OR false
 *     always wins over the business-profile default.
 *   - terminology is presentation only: labels resolve site override →
 *     business profile → registry default; never affects gating.
 *
 * Legacy 7-group layout (edit-website/media/business/communication/marketing/
 * site/taya-managed) is reorganized into the 8 capability groups
 * (overview/website/content/business/engagement/growth/tools/account).
 * LEGACY_GROUP_ALIASES (from the registry) maps persisted sidebar state
 * forward — see useSidebarUi.ts.
 *
 * Compatibility exports preserved: buildSidebarGroups, isItemVisible,
 * SIDEBAR_GROUP_IDS, SIDEBAR_MODULE_KEYS, SidebarBuildContext,
 * SidebarNavItem, SidebarNavGroup (findGroupOfHref lives in SidebarNav.tsx).
 */

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  FileText,
  Inbox,
  LayoutTemplate,
  Megaphone,
  ShieldCheck as ShieldCheckIcon,
  SquarePen,
  Wrench,
} from "lucide-react";

import {
  CAPABILITY_GROUP_IDS,
  CAPABILITY_GROUP_TITLES,
  CAPABILITY_REGISTRY,
  type CapabilityDefinition,
} from "./capabilityRegistry";
import { SIDEBAR_MODULE_KEYS as DERIVED_MODULE_KEYS } from "./capabilityRegistry";
import {
  resolveCapabilityLabel,
  isHiddenByBusinessFit,
  type TerminologyContext,
} from "./capabilityTerminology";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  isDesignLocked?: boolean;
  moduleKey?: string;
  badge?: "mediaBroken";
  superAdminOnly?: boolean;
  children?: SidebarNavItem[];
}

export interface SidebarNavGroup {
  id: string;
  title: string;
  icon?: LucideIcon;
  items: SidebarNavItem[];
}

export interface SidebarBuildContext {
  siteId: string;
  /** enabledModules map — null/undefined = query still loading or failed. */
  enabledModules?: Record<string, boolean> | null;
  isSuperAdmin: boolean;
  /**
   * Phase 6: role permission levels keyed by roleCapabilities
   * DASHBOARD_MODULES key (shape of accessControl.getMyPermissions
   * `permissions`). null/undefined = query still loading, failed, or the
   * caller has not wired it yet → CORE-ONLY fallback for optional items.
   * A superAdmin bypasses permission gating entirely.
   */
  rolePermissions?:
    | Record<string, "none" | "view" | "edit" | "manage">
    | null;
  /** Phase 6: business type (drives terminology profile + hiddenByDefault). */
  websiteType?: string | null;
  /** Phase 6: per-site label overrides (site terminology settings). */
  terminologyOverrides?: Record<string, string> | null;
}

/**
 * All module keys the sidebar gates on — DERIVED from the canonical
 * registry (the unique moduleKeys of every capability). Superset of the
 * legacy Phase 2 list: every legacy key is retained, and the Phase 6
 * surfaces (faq, testimonials, health, activity, …) are covered too.
 * Re-exported from capabilityRegistry so consumers/tests keep one import.
 */
export const SIDEBAR_MODULE_KEYS = DERIVED_MODULE_KEYS;

/**
 * The 8 capability groups in render order, derived from the registry.
 * "overview" is the flat Dashboard entry rendered by the layout
 * (inSidebar: false in the registry) — sidebar groups proper start at
 * "website".
 */
export const SIDEBAR_GROUP_IDS = CAPABILITY_GROUP_IDS;

const HREF = (siteId: string, leaf: string) => `/app/sites/${siteId}/${leaf}`;

/** Group header icons (presentation only — one per SIDEBAR_GROUP_IDS entry). */
const GROUP_ICONS: Record<string, LucideIcon> = {
  overview: LayoutTemplate,
  website: SquarePen,
  content: FileText,
  business: Briefcase,
  engagement: Inbox,
  growth: Megaphone,
  tools: Wrench,
  account: ShieldCheckIcon,
};

/**
 * Effective role-gate level for a capability in this context:
 *
 *   "ungated"  — the capability declares no roleModuleKey: no role gate
 *                beyond site membership (registry contract; legacy
 *                always-visible surfaces).
 *   "manage"   — superAdmin bypass (retains admin visibility).
 *   "unknown"  — the permission query is loading/failed/not wired: never
 *                guess (CORE-ONLY fallback for optional tier).
 *   "none"     — the viewer's role explicitly lacks the capability.
 *   "view" / "edit" / "manage" — the truthful level from the matrix.
 */
function roleGateLevel(
  cap: CapabilityDefinition,
  ctx: SidebarBuildContext,
): "none" | "view" | "edit" | "manage" | "unknown" | "ungated" {
  const key = cap.roleModuleKey ?? cap.moduleKey;
  if (!key) return "ungated";
  if (ctx.isSuperAdmin) return "manage";
  const perms = ctx.rolePermissions;
  if (perms == null) return "unknown";
  const level = perms[key];
  return level === "view" || level === "edit" || level === "manage"
    ? level
    : "none";
}

/**
 * Full derivation pipeline for a single registry capability. Returns true
 * when the item should render in this context. Order matters:
 *
 *   1. support  — only NATIVE renders (FUTURE/UNSUPPORTED never enter the
 *      registry; assertRegistryInvariants enforces this structurally).
 *   2. scope    — admin-surface capabilities are superAdmin-only.
 *   3. module   — explicit false hides; unknown map is core-only.
 *   4. role     — "none" hides; "unknown" is core-only; superAdmin bypass.
 *   5. business-fit — hiddenByDefault de-clutter, only when the owner has
 *      made no explicit module decision (unset entry).
 *
 * Terminology (labels) never gates — it is presentation only and resolves
 * later in buildSidebarGroups.
 */
function isCapabilityVisible(
  cap: CapabilityDefinition,
  ctx: SidebarBuildContext,
): boolean {
  // 1. Support classification.
  if (cap.support !== "native") return false;

  // 2. Scope: platform-admin surfaces are superAdmin-only.
  if (cap.scope === "admin" && !ctx.isSuperAdmin) return false;

  // 3. Module gating. An explicitly disabled module hides the item.
  //    An unknown modules map (loading/failed) hides OPTIONAL items but
  //    never CORE ones (core-only fallback).
  if (cap.moduleKey) {
    const modules = ctx.enabledModules;
    if (modules != null && modules[cap.moduleKey] === false) return false;
    if (modules == null && cap.tier === "optional") return false;
  }

  // 4. Role permission gating.
  const level = roleGateLevel(cap, ctx);
  if (level === "none") return false;
  if (level === "unknown" && cap.tier === "optional") return false;

  // 5. Business-fit de-clutter (hiddenByDefault): hide ONLY when the
  //    module entry is unset — an explicit owner decision (true OR false)
  //    always wins over the profile default. Core tier is never
  //    business-hidden (isHiddenByBusinessFit enforces this too).
  if (
    cap.tier === "optional" &&
    ctx.enabledModules != null &&
    isHiddenByBusinessFit(cap.key, ctx.websiteType ?? null) &&
    ctx.enabledModules[cap.moduleKey ?? ""] === undefined
  ) {
    return false;
  }

  return true;
}

/**
 * Compatibility export (contract from Phase 2, updated for Phase 6 core-only
 * semantics). Legacy item-level gating for raw SidebarNavItem trees, kept
 * for callers and tests that construct items directly.
 *
 * buildSidebarGroups uses the full registry pipeline above (including role
 * and business-fit gating); this helper intentionally covers only the
 * legacy surface: superAdminOnly + module gating. Null/unknown modules now
 * hide optional (moduleKey-bearing) items — the PM-approved core-only
 * fallback — instead of showing everything.
 */
export function isItemVisible(item: SidebarNavItem, ctx: SidebarBuildContext): boolean {
  if (item.superAdminOnly && !ctx.isSuperAdmin) return false;
  if (!item.moduleKey) return true; // core-tier surfaces: always renderable
  const modules = ctx.enabledModules;
  if (modules == null) return false; // unknown → core-only
  if (modules[item.moduleKey] === false) return false;
  return true;
}

/**
 * Build the sidebar groups from the canonical capability registry.
 *
 * The registry is the single source of truth: group order, group ids, item
 * order within groups, routes, designLock flags, tiers, scopes, icons,
 * submenu children and badges all come from CAPABILITY_REGISTRY. This
 * function applies the Phase 6 gating pipeline, resolves presentation
 * labels through the terminology layer, and drops groups with no visible
 * items (hide-empty).
 */
export function buildSidebarGroups(ctx: SidebarBuildContext): SidebarNavGroup[] {
  const { siteId } = ctx;
  const termCtx: TerminologyContext = {
    websiteType: ctx.websiteType ?? null,
    siteOverrides: ctx.terminologyOverrides ?? null,
  };

  // Registry routes are bare leaves under /app/sites/:siteId/ (e.g.
  // "pages", "articles?filter=draft") — or absolute platform routes for
  // admin destinations (e.g. "/app/admin/users").
  const hrefFor = (route: string): string =>
    route.startsWith("/") ? route : HREF(siteId, route);

  const itemFor = (cap: CapabilityDefinition): SidebarNavItem | null => {
    if (cap.inSidebar === false) return null; // dashboard → layout flat entry
    if (!isCapabilityVisible(cap, ctx)) return null;

    const item: SidebarNavItem = {
      id: cap.key,
      label: resolveCapabilityLabel(cap.key, termCtx),
      href: hrefFor(cap.route),
      icon: cap.icon,
      isDesignLocked: cap.designLocked ? true : undefined,
      moduleKey: cap.moduleKey,
      badge: cap.badge,
      superAdminOnly: cap.scope === "admin" ? true : undefined,
    };

    if (cap.children) {
      item.children = cap.children.map((child) => ({
        id: child.id,
        label: child.label,
        href: hrefFor(child.route),
        icon: child.icon,
        moduleKey: cap.moduleKey,
      }));
    }

    return item;
  };

  const groups: SidebarNavGroup[] = SIDEBAR_GROUP_IDS.filter(
    (gid) => gid !== "overview",
  ).map((gid) => ({
    id: gid,
    title: CAPABILITY_GROUP_TITLES[gid],
    icon: GROUP_ICONS[gid],
    items: CAPABILITY_REGISTRY.filter((c) => c.group === gid)
      .map(itemFor)
      .filter((i): i is SidebarNavItem => i !== null),
  }));

  // hide-empty: groups whose items are all gated away are dropped.
  return groups.filter((g) => g.items.length > 0);
}
