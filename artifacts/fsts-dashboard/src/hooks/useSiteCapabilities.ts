/**
 * useSiteCapabilities.ts
 *
 * Phase 6 (Chat A): THE single capability model for a viewer looking at a
 * site workspace. Every adaptive dashboard surface — sidebar navigation,
 * stat cards, Getting Started, Quick Edit, upcoming-workspace cards —
 * composes from this one hook instead of keeping four overlapping module
 * lists in drift.
 *
 * The hook wires three runtime truths together:
 *
 *   1. enabledModules   — the site's effective module map
 *                         (api.sites.getEffectiveModules).
 *   2. rolePermissions  — the viewer's truthful permission levels
 *                         (api.accessControl.getMyPermissions; Phase B2's
 *                         38-key additive matrix incl. services, products,
 *                         reviews, flyers, portal, automation, site_users,
 *                         payment_providers).
 *   3. terminology      — the site's business profile (site.websiteType)
 *                         plus per-site label overrides.
 *
 * Truthfulness rules (PM-approved adaptive dashboard spec):
 *
 *   - UNKNOWN  \u2192 CORE-ONLY. While either query is loading or failed, only
 *     core-tier capabilities resolve visible (never guess an optional
 *     surface into existence — Decision 3). superAdmin bypasses permission
 *     gating but not module gating.
 *   - EXPLICIT module decision (true/false) always beats business-fit
 *     de-clutter; business-fit hides only when the owner has not decided.
 *   - The viewer never sees an affordance their role cannot use: navigation
 *     requires \u2265 view (sidebarNav pipeline); stat cards / Quick Edit /
 *     Getting Started are level-aware through isCapabilityUsable().
 *   - TERMINOLOGY IS PRESENTATION ONLY — labels, never gating.
 *   - FUTURE/UNSUPPORTED workflows (Trips, Destinations, Bookings, …) are
 *     not in the registry and can never resolve visible; no surface may
 *     alias them onto Courses/Events/Products.
 *
 * This hook is the UI-side counterpart of the sidebarNav.ts pipeline: it
 * exposes the same derivation as data for card surfaces (which need
 * capability definitions + levels, not just a nav tree). Navigation itself
 * still flows through buildSidebarGroups — both derive from the same
 * registry and the same ctx, so they can never disagree.
 */

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import {
  CAPABILITY_REGISTRY,
  getCapability,
  type CapabilityDefinition,
} from "@/lib/capabilityRegistry";
import {
  resolveCapabilityLabel,
  isHiddenByBusinessFit,
  type TerminologyContext,
} from "@/lib/capabilityTerminology";

/** Mirrors accessControl.getMyPermissions's success shape. */
export interface MyPermissionsPayload {
  isSuperAdmin: boolean;
  role: string | null;
  permissions: Record<string, "none" | "view" | "edit" | "manage">;
}

export type CapabilityLevel = "none" | "view" | "edit" | "manage";

/** What the viewer can actually do with a capability right now. */
export interface SiteCapability {
  /** Registry entry (key, route, group, tier, scope, icon, …). */
  capability: CapabilityDefinition;
  /** Truthful level for this viewer: "none" when ungated-but-absent. */
  level: CapabilityLevel;
  /** Can the viewer see this surface at all (sidebar + cards)? */
  visible: boolean;
  /** Can the viewer at least view it? (Navigation / read-only cards.) */
  canView: boolean;
  /** Can the viewer edit it? */
  canEdit: boolean;
  /** Can the viewer manage it? */
  canManage: boolean;
  /** Resolved presentation label (site override → profile → default). */
  label: string;
}

export interface SiteCapabilities {
  /** All resolved capabilities keyed by capability key. */
  byKey: Record<string, SiteCapability>;
  /** Capability keys in registry order. */
  keys: string[];
  /** True when either truth source is still loading/failed (core-only). */
  isCoreOnly: boolean;
  /** True when the viewer is a superAdmin (bypasses role gating). */
  isSuperAdmin: boolean;
  /** Resolved permission map (or null while unknown). */
  rolePermissions: Record<string, CapabilityLevel> | null;
  /** Site's effective module map (or null while unknown). */
  enabledModules: Record<string, boolean> | null;
  /** Business type driving the terminology profile. */
  websiteType: string | null;
  /** Per-site label overrides (extension point; empty until backend ships). */
  terminologyOverrides: Record<string, string> | null;
}

/** Convenience accessor with a safe unknown-key default. */
export function getSiteCapability(
  model: SiteCapabilities,
  key: string,
): SiteCapability | null {
  return model.byKey[key] ?? null;
}

/**
 * The single capability model for a viewer on a site.
 *
 * NOTE on terminologyOverrides: no backend table field exists today (it is
 * an honestly-documented frontend extension point — see
 * capabilityTerminology.ts). Pass site data when that ships; until then it
 * stays null and labels resolve default → profile.
 */
export function useSiteCapabilities(
  siteId: string | Id<"sites">,
  options: {
    websiteType?: string | null;
    terminologyOverrides?: Record<string, string> | null;
  } = {},
): SiteCapabilities {
  const effectiveModules = useQuery(api.sites.getEffectiveModules, {
    siteId: siteId as Id<"sites">,
  });
  const myPermissions = useQuery(api.accessControl.getMyPermissions, {
    siteId: siteId as Id<"sites">,
  });

  const isSuperAdmin = myPermissions?.isSuperAdmin ?? false;
  const rolePermissions: Record<string, CapabilityLevel> | null =
    myPermissions?.permissions ?? null;
  const enabledModules: Record<string, boolean> | null =
    (effectiveModules as Record<string, boolean> | null) ?? null;

  const websiteType = options.websiteType ?? null;
  const terminologyOverrides = options.terminologyOverrides ?? null;

  const isCoreOnly = rolePermissions == null || enabledModules == null;

  const termCtx: TerminologyContext = { websiteType, siteOverrides: terminologyOverrides };

  const byKey: Record<string, SiteCapability> = {};
  const keys: string[] = [];
  for (const capability of CAPABILITY_REGISTRY) {
    keys.push(capability.key);

    const moduleKey = capability.moduleKey;
    const roleKey = capability.roleModuleKey ?? capability.moduleKey;

    // Module truth: explicit false hides; unknown map → optional hidden
    // (core-only); core items never module-gated.
    let moduleVisible = true;
    if (moduleKey) {
      if (enabledModules != null && enabledModules[moduleKey] === false) {
        moduleVisible = false;
      } else if (enabledModules == null && capability.tier === "optional") {
        moduleVisible = false;
      }
    }

    // Role truth (superAdmin bypass; unknown → optional hidden).
    let level: CapabilityLevel = "none";
    if (!roleKey) {
      // Ungated beyond site membership (legacy always-visible surfaces:
      // Pages, Visual Editor, Website Settings, Site Verification, My
      // Permissions). No role gate to fail.
      level = "view";
    } else if (isSuperAdmin) {
      level = "manage";
    } else if (rolePermissions != null) {
      const raw = rolePermissions[roleKey];
      level =
        raw === "view" || raw === "edit" || raw === "manage" ? raw : "none";
    } else if (capability.tier === "core") {
      // Core-tier role-gated surfaces (Help Center, Site Users, the flat
      // Dashboard entry) stay reachable while the permission truth is
      // loading/failed — "unknown" hides only the optional tier (PM
      // decision 3). This mirrors roleGateLevel() in sidebarNav.ts so the
      // hook and the navigation pipeline can never disagree. Optional-tier
      // role-gated items stay "none" (never guessed into existence).
      level = "view";
    }

    // Business-fit de-clutter: only when the owner has not decided.
    const businessHidden =
      capability.tier === "optional" &&
      enabledModules != null &&
      isHiddenByBusinessFit(capability.key, websiteType) &&
      enabledModules[capability.moduleKey ?? ""] === undefined;

    const scopeVisible = capability.scope !== "admin" || isSuperAdmin;
    const supportVisible = capability.support === "native";
    const visible =
      supportVisible && scopeVisible && moduleVisible && level !== "none" &&
      !businessHidden &&
      // Optional tier while truth is unknown → core-only (never guess).
      !(capability.tier === "optional" && (rolePermissions == null || enabledModules == null));

    byKey[capability.key] = {
      capability,
      level,
      visible,
      canView: visible && level !== "none",
      canEdit: visible && (level === "edit" || level === "manage"),
      canManage: visible && level === "manage",
      label: resolveCapabilityLabel(capability.key, termCtx),
    };
  }

  return {
    byKey,
    keys,
    isCoreOnly,
    isSuperAdmin,
    rolePermissions,
    enabledModules,
    websiteType,
    terminologyOverrides,
  };
}
