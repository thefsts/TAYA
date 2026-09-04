/**
 * WHITE-LABEL / RESELLER EDITION POLICY (DORMANT) — Phase 6.
 *
 * ARCHITECTURE NOTE (FSTS product direction, locked):
 *   TAYA is the product brand. The TAYA client dashboard is NOT white-labeled
 *   and must never be — clients see "TAYA System™" chrome, the TAYA logo on
 *   login, the standard TAYA navigation style, and the TAYA product
 *   attribution footer. Client customization in the current product is
 *   limited to the already-supported elements: the client logo, client name,
 *   live domain, and site-specific content inside their workspace.
 *
 *   This module is the RESERVED seam for a possible future "White Label /
 *   Reseller Edition" of TAYA — a separate paid product model FSTS may offer
 *   later. It is intentionally NOT wired into any production component: the
 *   master switch below is hard-off, and no production file imports from
 *   this module. white-label.test.tsx enforces both invariants so the seam
 *   cannot silently activate.
 *
 * RESERVED SEMANTICS (for the future edition, unchanged from the original
 * design, so a future flip is a product decision — not a code rewrite):
 *   - `whiteLabelEnabled` is chrome-only. It NEVER changes permissions,
 *     routes, or any capability gate (RBAC, module gating, Design Lock™).
 *   - White-labeled sites would present their own name/logo in the shell,
 *     a neutral sub-label, and their own brand accent.
 *   - Internal users (superadmin / internal QA) would always see TAYA chrome.
 *   - Agency chrome takes precedence for labels.
 *   - `poweredByFsts=false` would hide the product attribution independently.
 */

/** MASTER SWITCH — hard-off. The white-label edition is not a TAYA feature. */
export const WHITE_LABEL_EDITION_ENABLED = false;

/** Fallback sub-label reserved for the future edition's neutral sidebar. */
export const WHITE_LABEL_SIDEBAR_LABEL = "Client Dashboard";

/** Neutral "Powered By" card copy reserved for the future edition. */
export const WHITE_LABEL_POWERED_BY_COPY =
  "This dashboard is your account's control center. Every account activity is recorded in your Activity Log for full transparency.";

export interface WhiteLabelSiteFields {
  name?: string | null;
  logoUrl?: string | null;
  domain?: string | null;
  brandColorPrimary?: string | null;
  whiteLabelEnabled?: boolean | null;
  poweredByFsts?: boolean | null;
}

export interface WhiteLabelBrandingFields {
  brandColorPrimary?: string | null;
  /** Set when the client saved the Branding tab at least once. */
  brandingUpdatedAt?: number | null;
}

export interface WhiteLabelChrome {
  /** True only when the edition is enabled AND the site is white-labeled. */
  isWhiteLabel: boolean;
  /** Whether the "Powered by" footer badge is shown. */
  showPoweredBy: boolean;
  /** Sub-label under the site name in the sidebar ("" when agency covers it). */
  sidebarLabel: string;
  /** HSL triplet ("H S% L%") for the inline --primary override, or null. */
  accentTriplet: string | null;
  /** The client's brand hex actually applied, or null (white-label only). */
  accentHex: string | null;
}

/**
 * Convert a 6-digit hex color to the "H S% L%" triplet used by the TAYA CSS
 * variables (`hsl(var(--primary))`). Returns null for anything that is not a
 * strict `#rrggbb` value — never throws, never executes anything from input.
 * (Reserved for the future edition; unused in the current product.)
 */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * RESERVED EDITION API — resolves what a white-labeled site WOULD see.
 * Because WHITE_LABEL_EDITION_ENABLED is false, this always reports standard
 * TAYA chrome for every caller: isWhiteLabel=false, showPoweredBy follows
 * poweredByFsts, no label, no accent. Keep this behavior even when the
 * edition ships — the switch then becomes per-account entitlement.
 *
 * @param site       The site record (name/logoUrl/brandColorPrimary/whiteLabelEnabled/poweredByFsts).
 * @param branding   Optional siteSettings branding doc (brandColorPrimary wins over the site record).
 * @param hasAgency  True when an agency manages this site — agency chrome takes precedence.
 * @param isInternalUser  True for superadmin / internal QA — always TAYA chrome.
 */
export function whiteLabelChrome(
  site: WhiteLabelSiteFields | null | undefined,
  branding: WhiteLabelBrandingFields | null | undefined,
  hasAgency: boolean,
  isInternalUser = false,
): WhiteLabelChrome {
  const isWhiteLabel =
    WHITE_LABEL_EDITION_ENABLED && !isInternalUser && site?.whiteLabelEnabled === true;
  if (!isWhiteLabel) {
    return {
      isWhiteLabel: false,
      showPoweredBy: site?.poweredByFsts ?? true,
      sidebarLabel: "",
      accentTriplet: null,
      accentHex: null,
    };
  }
  // Reserved-edition branch — unreachable while the edition is disabled.
  const brandHex =
    branding?.brandColorPrimary?.trim() || site?.brandColorPrimary?.trim() || "";
  const accentTriplet = brandHex ? hexToHslTriplet(brandHex) : null;
  return {
    isWhiteLabel: true,
    showPoweredBy: false,
    sidebarLabel: !hasAgency ? WHITE_LABEL_SIDEBAR_LABEL : "",
    accentHex: accentTriplet ? brandHex : null,
    accentTriplet,
  };
}

/**
 * RESERVED EDITION API — auth page identity for a future white-labeled site.
 * Returns the TAYA platform brand (nulls) unless the edition is enabled.
 */
export function authBrand(
  site: WhiteLabelSiteFields | null | undefined,
): { logoUrl: string | null; name: string | null; isWhiteLabel: boolean } {
  const isWhiteLabel = WHITE_LABEL_EDITION_ENABLED && site?.whiteLabelEnabled === true;
  return {
    logoUrl: isWhiteLabel ? site?.logoUrl ?? null : null,
    name: isWhiteLabel ? site?.name ?? null : null,
    isWhiteLabel,
  };
}
