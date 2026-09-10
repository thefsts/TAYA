/**
 * capabilityTerminology.ts
 *
 * Phase 6 (Chat B layer): business-specific presentation terminology for
 * TAYA client workspaces. Derived from the PM-approved module audit matrix
 * (§5) with one governing rule:
 *
 *   TERMINOLOGY IS PRESENTATION ONLY. Backend capability names stay generic
 *   (courses, services, team, forms, products). A label override is a SAFE
 *   ALIAS — allowed ONLY where the native capability's fields, permissions,
 *   workflows, editing, publishing, and client behavior genuinely fit the
 *   business meaning of the new label. Where they do not, the capability is
 *   recorded as FUTURE/UNSUPPORTED in capabilityRegistry.ts and NEVER
 *   relabeled (e.g. products must not become "Listings" — no real-estate
 *   lifecycle exists; products must not become "Plans" — no recurring
 *   billing exists).
 *
 * Deviations from the approved matrix table (hard product rule wins):
 *   - real_estate products: "Listings" rejected → hidden-by-default instead
 *     (listings is a FUTURE capability).
 *   - membership products: "Member Plans" rejected → hidden-by-default
 *     (plans is a FUTURE capability — no recurring billing semantics).
 *   - restaurant inbox: "Reservation Inbox" rejected → default
 *     "Contact Inbox" (a reservation-named inbox implies a booking engine
 *     that does not exist).
 *   - restaurant forms: "Reservations" → "Reservation Requests" (a form
 *     collects requests; it does not confirm reservations).
 *   - security_company forms: "Enrollment" → "Service Inquiry" (guards are
 *     not enrolled; the training/security column of the matrix merged two
 *     distinct businesses).
 *
 * Per-site overrides are data-driven: callers pass a key→label map from site
 * data. No customer name or customer-specific string is hardcoded here.
 */

import { CAPABILITIES_BY_KEY, type CapabilityDefinition } from "./capabilityRegistry";

/* ──────────────────────────────────────────────────────────────────────
 * Profile model
 * ────────────────────────────────────────────────────────────────────── */

/**
 * A business-profile terminology pack.
 *
 * labels          — SAFE ALIAS presentation labels by capability key.
 * hiddenByDefault — capabilities that are NOT relevant to this business
 *                   ("—" in the approved matrix). They stay out of the
 *                   workspace unless the owner explicitly enables them
 *                   (explicit true in enabledModules always wins). This is
 *                   a default, not a lock: it de-clutters without pretending
 *                   the capability is impossible.
 */
export interface TerminologyProfile {
  labels: Record<string, string>;
  hiddenByDefault?: string[];
}

/**
 * Per-site label overrides (highest precedence). Structurally arbitrary —
 * sourced from site data by the caller; nothing customer-specific is
 * hardcoded in this module.
 */
export type SiteTerminologyOverrides = Record<string, string>;

export interface TerminologyContext {
  websiteType?: string | null;
  siteOverrides?: SiteTerminologyOverrides | null;
}

/* ──────────────────────────────────────────────────────────────────────
 * Business profiles (PM-approved matrix §5)
 * ────────────────────────────────────────────────────────────────────── */

export const TERMINOLOGY_PROFILES: Record<string, TerminologyProfile> = {
  church: {
    labels: {
      courses: "Bible Studies",
      events: "Church Calendar",
      services: "Ministries",
      team: "Staff & Leadership",
      downloads: "Bulletin & Sermons",
      articles: "News & Updates",
      careers: "Join the Team",
      policy: "Church Policies",
      reviews: "Reviews",
      testimonials: "Testimonials",
      forms: "Prayer & Connection",
      inbox: "Contact Inbox",
    },
    hiddenByDefault: ["products"],
  },

  real_estate: {
    labels: {
      // courses as Training & CE: the course catalog genuinely carries
      // CE curricula (title/description/schedule/enrollment) — SAFE ALIAS.
      courses: "Training & CE",
      events: "Open Houses & Tours",
      services: "Property Services",
      // team as Agents & Brokers: the roster (name/title/bio/photo/contact)
      // genuinely presents an agent roster. It does NOT manage listings or
      // showings (see FUTURE_CAPABILITIES) — roster presentation only.
      team: "Agents & Brokers",
      downloads: "Documents & Disclosures",
      articles: "Market Updates",
      careers: "Careers",
      policy: "Policies & Disclosures",
      reviews: "Client Reviews",
      testimonials: "Success Stories",
      forms: "Property Inquiry",
      inbox: "Inquiry Inbox",
    },
    // "Listings" is a FUTURE capability — products must NOT be relabeled.
    hiddenByDefault: ["products"],
  },

  medical: {
    labels: {
      courses: "Patient Education",
      events: "Classes & Events",
      products: "Products",
      services: "Treatments",
      team: "Providers & Staff",
      downloads: "Patient Forms",
      articles: "Health Articles",
      careers: "Careers",
      policy: "Patient Notices",
      reviews: "Patient Reviews",
      testimonials: "Patient Stories",
      // A form collects appointment REQUESTS; it does not book appointments
      // (bookings/appointments are FUTURE capabilities).
      forms: "Appointment Request",
      inbox: "Patient Messages",
    },
  },

  legal: {
    labels: {
      courses: "Continuing Ed",
      events: "Seminars & Events",
      services: "Practice Areas",
      team: "Attorneys & Staff",
      downloads: "Client Documents",
      articles: "Legal Insights",
      careers: "Careers",
      policy: "Legal Notices",
      reviews: "Client Reviews",
      testimonials: "Case Results",
      forms: "Case Evaluation",
      inbox: "Case Inquiries",
    },
    hiddenByDefault: ["products"],
  },

  restaurant: {
    labels: {
      courses: "Culinary Classes",
      events: "Events & Specials",
      // products as Menu Items: SAFE ALIAS for basic items — Square catalog
      // fields (name/price/description/image/category) genuinely fit a menu
      // board. Modifiers, dietary sections, and sold-out rotation are NOT
      // supported and are recorded as the FUTURE "menu-items" capability.
      // ⚠ Flagged for PM veto (critical product rule exception judgment).
      products: "Menu Items",
      team: "Staff",
      careers: "Careers",
      reviews: "Reviews",
      // A form collects reservation REQUESTS; the reservation engine itself
      // (slots, party size, holds) is a FUTURE capability.
      forms: "Reservation Requests",
    },
    hiddenByDefault: ["services", "downloads", "articles", "policy", "testimonials"],
  },

  training_academy: {
    labels: {
      // PM-approved SAFE ALIAS: the course catalog IS the training-program
      // catalog (curriculum, sessions, enrollment).
      courses: "Training Programs",
      events: "Sessions",
      products: "Equipment & Gear",
      team: "Instructors",
      downloads: "Training Materials",
      articles: "Industry Articles",
      careers: "Careers",
      policy: "Company Policies",
      reviews: "Client Reviews",
      testimonials: "Client Stories",
      forms: "Enrollment",
      inbox: "Enrollment Inbox",
    },
  },

  security_company: {
    labels: {
      // PM-approved SAFE ALIAS: security training programs are course
      // catalogs with curricula and enrollment — genuinely fits.
      courses: "Training Programs",
      events: "Sessions",
      products: "Equipment & Gear",
      services: "Guard Services",
      team: "Instructors & Guards",
      downloads: "Training Materials",
      articles: "Industry Articles",
      careers: "Careers",
      policy: "Company Policies",
      reviews: "Client Reviews",
      testimonials: "Client Stories",
      forms: "Service Inquiry",
      inbox: "Inquiry Inbox",
    },
  },

  property_management: {
    labels: {
      events: "Property Tours",
      services: "Property Services",
      team: "Property Managers",
      downloads: "Lease Docs",
      articles: "News",
      careers: "Careers",
      policy: "Lease Policies",
      reviews: "Tenant Reviews",
      testimonials: "Testimonials",
      forms: "Maintenance Request",
      inbox: "Request Inbox",
    },
    hiddenByDefault: ["courses", "products"],
  },

  membership: {
    labels: {
      // courses as Programs: class/program offerings genuinely fit the
      // course catalog (schedule, capacity, enrollment).
      courses: "Programs",
      events: "Member Events",
      services: "Member Services",
      team: "Team",
      downloads: "Member Resources",
      articles: "Newsletter",
      policy: "Membership Terms",
      reviews: "Member Reviews",
      testimonials: "Member Stories",
      forms: "Membership Interest",
      inbox: "Member Messages",
    },
    // "Plans" is a FUTURE capability — products must NOT be relabeled.
    hiddenByDefault: ["products", "careers"],
  },
};

/**
 * Website types with no business-specific profile use default labels only
 * (business_website, ecommerce, professional_services, construction,
 * manufacturing, custom_enterprise, and any unknown type — safe default).
 */

/* ──────────────────────────────────────────────────────────────────────
 * Resolution helpers
 * ────────────────────────────────────────────────────────────────────── */

function profileFor(websiteType?: string | null): TerminologyProfile | null {
  if (!websiteType) return null;
  return TERMINOLOGY_PROFILES[websiteType] ?? null;
}

/**
 * Resolve the presentation label for a capability:
 *   per-site override → business-profile label → registry default.
 *
 * Overrides and profile labels apply ONLY to capabilities flagged
 * `terminology: true` in the registry (defense-in-depth: a stray override
 * for e.g. "media" is ignored, keeping the surface intentionally small).
 */
export function resolveCapabilityLabel(
  capabilityKey: string,
  ctx: TerminologyContext = {},
): string {
  const capability: CapabilityDefinition | undefined = CAPABILITIES_BY_KEY[capabilityKey];
  if (!capability) return capabilityKey;
  if (!capability.terminology) return capability.defaultLabel;
  const siteOverride = ctx.siteOverrides?.[capabilityKey];
  if (typeof siteOverride === "string" && siteOverride.trim().length > 0) {
    return siteOverride.trim();
  }
  const profile = profileFor(ctx.websiteType);
  const profileLabel = profile?.labels[capabilityKey];
  if (typeof profileLabel === "string" && profileLabel.trim().length > 0) {
    return profileLabel.trim();
  }
  return capability.defaultLabel;
}

/**
 * Is this optional capability NOT relevant to the business by default?
 * ("—" in the approved matrix.) True only when the site's enabled-modules
 * entry is UNSET — an explicit owner decision (true OR false) always wins.
 * Core capabilities are never business-hidden.
 */
export function isHiddenByBusinessFit(
  capabilityKey: string,
  websiteType?: string | null,
): boolean {
  const capability: CapabilityDefinition | undefined = CAPABILITIES_BY_KEY[capabilityKey];
  if (!capability) return false;
  if (capability.tier === "core") return false;
  const profile = profileFor(websiteType);
  return profile?.hiddenByDefault?.includes(capabilityKey) ?? false;
}

/**
 * All label sources for one capability (transparency for My Permissions /
 * debugging / tests): which layer won and why.
 */
export function explainCapabilityLabel(
  capabilityKey: string,
  ctx: TerminologyContext = {},
): { label: string; source: "site-override" | "profile" | "default" } {
  const capability: CapabilityDefinition | undefined = CAPABILITIES_BY_KEY[capabilityKey];
  if (!capability || !capability.terminology) {
    return { label: capability?.defaultLabel ?? capabilityKey, source: "default" };
  }
  const siteOverride = ctx.siteOverrides?.[capabilityKey];
  if (typeof siteOverride === "string" && siteOverride.trim().length > 0) {
    return { label: siteOverride.trim(), source: "site-override" };
  }
  const profile = profileFor(ctx.websiteType);
  const profileLabel = profile?.labels[capabilityKey];
  if (typeof profileLabel === "string" && profileLabel.trim().length > 0) {
    return { label: profileLabel.trim(), source: "profile" };
  }
  return { label: capability.defaultLabel, source: "default" };
}
