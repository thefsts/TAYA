/**
 * capabilityRegistry.ts
 *
 * Phase 6 (Chat A): The canonical capability registry for the TAYA client
 * dashboard. This is the single source of truth that every adaptive surface
 * composes from — sidebar navigation, stat cards, Getting Started, Quick
 * Edit, and upcoming-workspace cards. Registry drift (four overlapping
 * module lists) is unified by deriving from here.
 *
 * CRITICAL PRODUCT RULE (PM-approved): the dashboard must never pretend an
 * unsupported workflow exists. Every adaptive capability is classified:
 *
 *   NATIVE          — genuinely implemented: real backend tables, real
 *                     permissions, real editing/publishing workflows, real
 *                     client behavior. These are the registry entries below.
 *   SAFE ALIAS      — a NATIVE capability presented under a business-specific
 *                     label ONLY where fields, permissions, workflows,
 *                     editing, publishing, and client behavior genuinely fit
 *                     (e.g. courses → "Training Programs" for a training
 *                     academy: it IS the course catalog). Aliases live in
 *                     capabilityTerminology.ts and change PRESENTATION ONLY.
 *   FUTURE/UNSUPPORTED — a business workflow that does NOT exist yet (Trips,
 *                     Destinations, Bookings, Appointments, Reservations,
 *                     Listings, Agents, Showings, Menu Items, Donations,
 *                     Members, Plans, Travelers, Analytics…). These are NEVER
 *                     renamed onto Courses/Events/Products. They are recorded
 *                     in FUTURE_CAPABILITIES with the missing contract and
 *                     are hidden from the live client dashboard.
 *
 * This module is pure data — no React, no network, no side effects. It is
 * unit-testable directly and mirrored by nothing: other registries derive
 * FROM it, never the other way around.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  CreditCard,
  DatabaseBackup,
  Download,
  FileStack,
  FileText,
  FormInput,
  HeartPulse,
  HelpCircle,
  History,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  Mail,
  Megaphone,
  MessageSquareQuote,
  MousePointerClick,
  Newspaper,
  Package,
  Phone,
  ScrollText,
  Search,
  Settings,
  ShieldCheck as ShieldCheckIcon,
  BadgeCheck,
  ShoppingBag,
  SquarePen,
  Star,
  UserCog,
  Users,
  Wrench,
  Zap,
  Bell,
  Building2,
  HelpCircle as HelpIcon,
  Navigation as NavIcon,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────
 * Group taxonomy (mission §6 — 8 groups)
 * ────────────────────────────────────────────────────────────────────── */

/**
 * The eight canonical sidebar groups. Old (Phase 2) group ids map forward
 * via LEGACY_GROUP_ALIASES so a user's persisted collapsed-group state
 * survives the reorganization.
 */
export const CAPABILITY_GROUP_IDS = [
  "overview",
  "website",
  "content",
  "business",
  "engagement",
  "growth",
  "tools",
  "account",
] as const;

export type CapabilityGroupId = (typeof CAPABILITY_GROUP_IDS)[number];

export const CAPABILITY_GROUP_TITLES: Record<CapabilityGroupId, string> = {
  overview: "Overview",
  website: "Website",
  content: "Content",
  business: "Business",
  engagement: "Engagement",
  growth: "Growth",
  tools: "Tools",
  account: "Account",
};

/**
 * Phase 2 group ids → Phase 6 group ids. Used by useSidebarUi hydration so
 * stored collapsed groups carry forward. Unknown ids are dropped (existing
 * junk-filter behavior). "business" is unchanged and needs no alias.
 */
export const LEGACY_GROUP_ALIASES: Record<string, CapabilityGroupId> = {
  "edit-website": "website",
  media: "content",
  communication: "engagement",
  marketing: "growth",
  site: "website",
  "taya-managed": "tools",
};

/* ──────────────────────────────────────────────────────────────────────
 * Capability model
 * ────────────────────────────────────────────────────────────────────── */

/** How the capability is supported by the platform today. */
export type SupportClassification = "native" | "future" | "unsupported";

/**
 * Tier decides the null/failed-state fallback (PM decision 3):
 *   core     — universal workspace surface; shown even while module /
 *              permission queries are loading or failed (core-only state).
 *   optional — capability-driven; hidden until the site's effective modules
 *              AND the viewer's permissions are known (never guessed).
 */
export type CapabilityTier = "core" | "optional";

/** Who the capability is for. */
export type CapabilityScope = "client" | "admin" | "either";

export interface CapabilityDefinition {
  /** Stable machine key (also the terminology + permission reference). */
  key: string;
  /** Default (generic) presentation label. */
  defaultLabel: string;
  /**
   * Route leaf under `/app/sites/:siteId/` — or an absolute route for
   * platform-level destinations (e.g. /app/admin/users).
   */
  route: string;
  /** Canonical group (one of CAPABILITY_GROUP_IDS). */
  group: CapabilityGroupId;
  /** Core (always-on) vs optional (module-gated). */
  tier: CapabilityTier;
  /** Shows the TAYA Design Lock affordance for non-superAdmin clients. */
  designLocked?: boolean;
  /** client = client workspace; admin = FSTS superAdmin surface only. */
  scope: CapabilityScope;
  /**
   * Key in the site's effective-modules map (sites.getEffectiveModules).
   * Absent (core capabilities) = not module-gated. Undefined map entry
   * means "not toggled" → visible (safe default, matches legacy gating).
   */
  moduleKey?: string;
  /**
   * Key in the role-capability matrix (roleCapabilities.DASHBOARD_MODULES /
   * getMyPermissions). Navigation requires ≥ view. Absent = no role gate
   * beyond site membership (matches legacy behavior for those items).
   */
  roleModuleKey?: string;
  /** lucide icon for the sidebar item / workspace cards. */
  icon: LucideIcon;
  /** Participates in business-profile label overrides (presentation only). */
  terminology?: boolean;
  /** Support classification — every live registry entry is "native". */
  support: SupportClassification;
  /** Rendered as a sidebar nav item (dashboard is the layout's flat entry). */
  inSidebar?: boolean;
  /** One-level submenu (deep links). */
  children?: { id: string; label: string; route: string; icon: LucideIcon }[];
  /** Badge source id (e.g. broken media count). */
  badge?: "mediaBroken";
}

/* ──────────────────────────────────────────────────────────────────────
 * The registry
 * ────────────────────────────────────────────────────────────────────── */

export const CAPABILITY_REGISTRY: CapabilityDefinition[] = [
  /* ── OVERVIEW ────────────────────────────────────────────────────── */
  {
    key: "dashboard",
    defaultLabel: "Dashboard",
    route: "",
    group: "overview",
    tier: "core",
    scope: "client",
    roleModuleKey: "dashboard",
    icon: LayoutDashboard,
    support: "native",
    inSidebar: false, // rendered as the layout's always-visible flat entry
  },

  /* ── WEBSITE ─────────────────────────────────────────────────────── */
  {
    key: "pages",
    defaultLabel: "All Pages",
    route: "pages",
    group: "website",
    tier: "core",
    scope: "client",
    icon: FileStack,
    support: "native",
  },
  {
    key: "visual-editor",
    defaultLabel: "Visual Editor",
    route: "editor",
    group: "website",
    tier: "core",
    scope: "client",
    icon: MousePointerClick,
    support: "native",
  },
  {
    key: "homepage",
    defaultLabel: "Homepage",
    route: "homepage",
    group: "website",
    tier: "optional",
    scope: "client",
    moduleKey: "homepage",
    roleModuleKey: "homepage",
    icon: LayoutTemplate,
    support: "native",
  },
  {
    key: "navigation",
    defaultLabel: "Menu Builder",
    route: "nav",
    group: "website",
    tier: "optional",
    scope: "client",
    moduleKey: "navigation",
    roleModuleKey: "navigation",
    designLocked: true,
    icon: NavIcon,
    support: "native",
  },
  {
    key: "footer",
    defaultLabel: "Footer",
    route: "footer",
    group: "website",
    tier: "optional",
    scope: "client",
    moduleKey: "footer",
    roleModuleKey: "footer",
    designLocked: true,
    icon: LayoutTemplate,
    support: "native",
  },
  {
    key: "website-settings",
    defaultLabel: "Website Settings",
    route: "settings",
    group: "website",
    tier: "core",
    // Per-tab RBAC lives inside the page (PART 13) — never blanket-locked.
    scope: "client",
    icon: Settings,
    support: "native",
  },
  {
    key: "contact",
    defaultLabel: "Contact Info",
    route: "contact",
    group: "website",
    tier: "optional",
    scope: "client",
    moduleKey: "contact",
    roleModuleKey: "contact",
    icon: Phone,
    support: "native",
  },
  {
    key: "site-verification",
    defaultLabel: "Site Verification",
    route: "verification",
    group: "website",
    tier: "core",
    scope: "client",
    icon: BadgeCheck,
    support: "native",
  },

  /* ── CONTENT ─────────────────────────────────────────────────────── */
  {
    key: "articles",
    defaultLabel: "Blog & Articles",
    route: "articles",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "articles",
    roleModuleKey: "articles",
    terminology: true,
    icon: FileText,
    support: "native",
    children: [
      { id: "articles-all", label: "All Articles", route: "articles", icon: FileText },
      { id: "articles-drafts", label: "Drafts", route: "articles?filter=draft", icon: FileText },
      { id: "articles-published", label: "Published", route: "articles?filter=published", icon: FileText },
    ],
  },
  {
    key: "faq",
    defaultLabel: "FAQ",
    route: "faq",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "faq",
    roleModuleKey: "faq",
    icon: HelpCircle,
    support: "native",
  },
  {
    key: "flyers",
    defaultLabel: "Flyers",
    route: "flyers",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "flyers",
    roleModuleKey: "flyers",
    icon: Newspaper,
    support: "native",
  },
  {
    key: "announcement",
    defaultLabel: "Announcement Banner",
    route: "announcement",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "announcement",
    roleModuleKey: "announcement",
    icon: Megaphone,
    support: "native",
  },
  {
    key: "cta",
    defaultLabel: "CTA Buttons",
    route: "cta",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "cta",
    roleModuleKey: "cta",
    icon: MousePointerClick,
    support: "native",
  },
  {
    key: "popup",
    defaultLabel: "Popup",
    route: "popup",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "popup",
    roleModuleKey: "popup",
    icon: Bell,
    support: "native",
  },
  {
    key: "policy",
    defaultLabel: "Policy Pages",
    route: "policies",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "policy",
    roleModuleKey: "policy",
    terminology: true,
    icon: ScrollText,
    support: "native",
  },
  {
    key: "media",
    defaultLabel: "Media Library",
    route: "media",
    group: "content",
    tier: "optional",
    scope: "client",
    moduleKey: "media",
    roleModuleKey: "media",
    icon: ImageIcon,
    support: "native",
    badge: "mediaBroken",
  },

  /* ── BUSINESS ────────────────────────────────────────────────────── */
  {
    key: "services",
    defaultLabel: "Services",
    route: "services",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "services",
    roleModuleKey: "services",
    terminology: true,
    icon: Briefcase,
    support: "native",
  },
  {
    key: "products",
    defaultLabel: "Products",
    route: "products",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "products",
    roleModuleKey: "products",
    terminology: true,
    icon: Package,
    support: "native",
  },
  {
    key: "courses",
    defaultLabel: "Courses & Classes",
    route: "courses",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "courses",
    roleModuleKey: "courses",
    terminology: true,
    icon: BookOpen,
    support: "native",
  },
  {
    key: "events",
    defaultLabel: "Events",
    route: "events",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "events",
    roleModuleKey: "events",
    terminology: true,
    icon: Calendar,
    support: "native",
    children: [
      { id: "events-upcoming", label: "Upcoming", route: "events", icon: Calendar },
      { id: "events-past", label: "Past Events", route: "events?filter=past", icon: Calendar },
    ],
  },
  {
    key: "payments",
    defaultLabel: "Square Payments",
    route: "payments",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "payments",
    roleModuleKey: "payments",
    designLocked: true,
    icon: CreditCard,
    support: "native",
  },
  {
    key: "commerce",
    defaultLabel: "Commerce",
    route: "commerce",
    group: "business",
    tier: "optional",
    scope: "client",
    moduleKey: "commerce",
    roleModuleKey: "commerce",
    designLocked: true,
    icon: ShoppingBag,
    support: "native",
  },

  /* ── ENGAGEMENT ──────────────────────────────────────────────────── */
  {
    key: "forms",
    defaultLabel: "Forms",
    route: "forms",
    group: "engagement",
    tier: "optional",
    scope: "client",
    moduleKey: "forms",
    roleModuleKey: "forms",
    terminology: true,
    icon: FormInput,
    support: "native",
  },
  {
    key: "inbox",
    defaultLabel: "Contact Inbox",
    route: "inbox",
    group: "engagement",
    tier: "optional",
    scope: "client",
    // Shares the "contact" module toggle with Contact Info (legacy contract).
    moduleKey: "contact",
    roleModuleKey: "inbox",
    terminology: true,
    icon: Inbox,
    support: "native",
  },
  {
    key: "team",
    defaultLabel: "Team",
    route: "team",
    group: "engagement",
    tier: "optional",
    scope: "client",
    moduleKey: "team",
    roleModuleKey: "team",
    terminology: true,
    icon: Users,
    support: "native",
  },
  {
    key: "careers",
    defaultLabel: "Careers",
    route: "careers",
    group: "engagement",
    tier: "optional",
    scope: "client",
    moduleKey: "careers",
    roleModuleKey: "careers",
    icon: Briefcase,
    support: "native",
  },
  {
    key: "downloads",
    defaultLabel: "Downloads",
    route: "downloads",
    group: "engagement",
    tier: "optional",
    scope: "client",
    moduleKey: "downloads",
    roleModuleKey: "downloads",
    terminology: true,
    icon: Download,
    support: "native",
  },
  {
    key: "portal",
    defaultLabel: "Portal Manager\u2122",
    route: "portal",
    group: "engagement",
    tier: "optional",
    scope: "client",
    moduleKey: "portal",
    roleModuleKey: "portal",
    icon: UserCog,
    support: "native",
  },

  /* ── GROWTH ──────────────────────────────────────────────────────── */
  {
    key: "seo",
    defaultLabel: "SEO Settings",
    route: "seo",
    group: "growth",
    tier: "optional",
    scope: "client",
    moduleKey: "seo",
    roleModuleKey: "seo",
    icon: Search,
    support: "native",
  },
  {
    key: "reviews",
    defaultLabel: "Reviews",
    route: "reviews",
    group: "growth",
    tier: "optional",
    scope: "client",
    moduleKey: "reviews",
    roleModuleKey: "reviews",
    terminology: true,
    icon: Star,
    support: "native",
  },
  {
    key: "testimonials",
    defaultLabel: "Testimonials",
    route: "testimonials",
    group: "growth",
    tier: "optional",
    scope: "client",
    moduleKey: "testimonials",
    roleModuleKey: "testimonials",
    terminology: true,
    icon: MessageSquareQuote,
    support: "native",
  },
  {
    key: "crm",
    defaultLabel: "Marketing & CRM",
    route: "crm",
    group: "growth",
    tier: "optional",
    scope: "client",
    moduleKey: "crm",
    roleModuleKey: "crm",
    designLocked: true,
    icon: Building2,
    support: "native",
  },

  /* ── TOOLS ───────────────────────────────────────────────────────── */
  {
    key: "automation",
    defaultLabel: "Automation Engine\u2122",
    route: "automation",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "automation",
    roleModuleKey: "automation",
    icon: Zap,
    support: "native",
  },
  {
    key: "email",
    defaultLabel: "Email Configuration",
    route: "email",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "email",
    roleModuleKey: "email",
    designLocked: true,
    icon: Mail,
    support: "native",
  },
  {
    key: "payment-providers",
    defaultLabel: "Payment Providers",
    route: "payment-providers",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "payment_providers",
    roleModuleKey: "payment_providers",
    designLocked: true,
    icon: CreditCard,
    support: "native",
  },
  {
    key: "health",
    defaultLabel: "Health Monitor",
    route: "health",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "health",
    roleModuleKey: "health",
    designLocked: true,
    icon: HeartPulse,
    support: "native",
  },
  {
    key: "history",
    defaultLabel: "Version History",
    route: "history",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "history",
    roleModuleKey: "history",
    designLocked: true,
    icon: History,
    support: "native",
  },
  {
    key: "activity",
    defaultLabel: "Activity Log",
    route: "activity",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "activity",
    roleModuleKey: "activity",
    designLocked: true,
    icon: Zap,
    support: "native",
  },
  {
    key: "backups",
    defaultLabel: "Backups",
    route: "backups",
    group: "tools",
    tier: "optional",
    scope: "client",
    moduleKey: "backups",
    roleModuleKey: "backups",
    designLocked: true,
    icon: DatabaseBackup,
    support: "native",
  },

  /* ── ACCOUNT ─────────────────────────────────────────────────────── */
  {
    key: "my-permissions",
    defaultLabel: "My Permissions",
    route: "permissions",
    group: "account",
    tier: "core",
    scope: "client",
    icon: ShieldCheckIcon,
    support: "native",
  },
  {
    // PM decision 4: visible only when the viewer's role permits viewing
    // the site roster (role gate added in Phase B2 — users.list gate is
    // site membership, so every site role may view; edits stay superAdmin).
    key: "site-users",
    defaultLabel: "Site Users",
    route: "users",
    group: "account",
    tier: "core",
    scope: "client",
    roleModuleKey: "site_users",
    icon: Users,
    support: "native",
  },
  {
    key: "help",
    defaultLabel: "Help Center",
    route: "help",
    group: "account",
    tier: "core",
    scope: "client",
    roleModuleKey: "help",
    icon: HelpIcon,
    support: "native",
  },
  {
    key: "user-management",
    defaultLabel: "User Management",
    route: "/app/admin/users",
    group: "account",
    tier: "core",
    scope: "admin",
    icon: Users,
    support: "native",
  },
];

/* ──────────────────────────────────────────────────────────────────────
 * Derived lookups (compatibility + queries)
 * ────────────────────────────────────────────────────────────────────── */

export const CAPABILITIES_BY_KEY: Record<string, CapabilityDefinition> =
  Object.fromEntries(CAPABILITY_REGISTRY.map((c) => [c.key, c]));

export function getCapability(key: string): CapabilityDefinition | undefined {
  return CAPABILITIES_BY_KEY[key];
}

export function capabilitiesInGroup(group: CapabilityGroupId): CapabilityDefinition[] {
  return CAPABILITY_REGISTRY.filter((c) => c.group === group);
}

/**
 * Module keys the sidebar gates on — DERIVED from the registry (superset of
 * the legacy Phase 2 list; the legacy keys all remain). Exported for
 * compatibility with sidebarNav.ts consumers and tests.
 *
 * NOTE: submenu deep-links (?filter=draft etc.) gate on the parent's module
 * key at render time, so children don't contribute keys here.
 */
export const SIDEBAR_MODULE_KEYS: readonly string[] = Array.from(
  new Set(
    CAPABILITY_REGISTRY
      .map((c) => c.moduleKey)
      .filter((k): k is string => !!k),
  ),
);

/**
 * Every key referenced by the role-capability matrix (Phase B2 additions
 * included). Derivation target for roleCapabilities.DASHBOARD_MODULES —
 * kept as a cross-check, not a replacement (roleCapabilities.ts remains
 * the owner of the matrix and its mirror contract with Convex).
 */
export const CAPABILITY_ROLE_MODULE_KEYS: readonly string[] = Array.from(
  new Set(
    CAPABILITY_REGISTRY
      .map((c) => c.roleModuleKey)
      .filter((k): k is string => !!k),
  ),
);

/* ──────────────────────────────────────────────────────────────────────
 * FUTURE / UNSUPPORTED capabilities (PM critical product rule)
 * ────────────────────────────────────────────────────────────────────── */

export interface FutureCapability {
  /** Stable machine key for the not-yet-real workflow. */
  key: string;
  /** The business-facing label it would carry when it ships. */
  label: string;
  /** Website types that would want it (presentation planning only). */
  websiteTypes: string[];
  /**
   * What is missing before this can ever be shown: the backend/workflow
   * contract that does not exist today. No fake adaptive UI may alias
   * these onto Courses/Events/Products.
   */
  missingContract: string;
}

/**
 * Business workflows that are NOT built. They are never rendered in the
 * live client dashboard and must never be faked by renaming generic
 * catalog modules. Each entry records exactly what contract is missing.
 */
export const FUTURE_CAPABILITIES: FutureCapability[] = [
  {
    key: "trips",
    label: "Trips",
    websiteTypes: ["travel"],
    missingContract:
      "No trips table, itinerary fields, pricing-per-trip, booking workflow, or traveler roster exists. Requires: trips schema + capacity/departure management + booking + cancellation + traveler assignments + public trip pages.",
  },
  {
    key: "destinations",
    label: "Destinations",
    websiteTypes: ["travel"],
    missingContract:
      "No destination taxonomy (region/season/activities) or destination detail pages exist distinct from generic articles. Requires: destinations schema + taxonomy + itinerary linkage + public destination pages.",
  },
  {
    key: "bookings",
    label: "Bookings",
    websiteTypes: ["travel", "medical", "professional_services", "real_estate", "restaurant"],
    missingContract:
      "No reservation/appointment engine: no availability calendar, slot inventory, confirmation workflow, or cancel/reschedule flows. Requires: availability schema + slot booking + email confirmations + cancellation policy handling.",
  },
  {
    key: "appointments",
    label: "Appointments",
    websiteTypes: ["medical", "professional_services", "real_estate"],
    missingContract:
      "Same as bookings — no provider calendars, service durations, or client self-scheduling. Requires: provider availability + duration rules + client-facing scheduler + status workflow.",
  },
  {
    key: "reservations",
    label: "Reservations",
    websiteTypes: ["restaurant"],
    missingContract:
      "No table/party-size/time-slot reservation system. Requires: floor plan or party-size config + slot inventory + hold/expiry workflow + front-of-house confirmation.",
  },
  {
    key: "listings",
    label: "Listings",
    websiteTypes: ["real_estate", "property_management"],
    missingContract:
      "No MLS-style listing entity: no address/price/beds/baths/sqft fields, status lifecycle (active/pending/sold), or listing detail pages. Products must NOT be relabeled Listings — price/description fields do not carry real-estate lifecycle or search semantics.",
  },
  {
    key: "agents",
    label: "Agents",
    websiteTypes: ["real_estate"],
    missingContract:
      "No agent-brokerage entity (license #, brokerage, specialties, assigned listings). The team module (name/title/bio/photo/contact) is a SAFE ALIAS for the agent ROSTER presentation only; it does NOT manage listings or showing assignments.",
  },
  {
    key: "showings",
    label: "Showings",
    websiteTypes: ["real_estate"],
    missingContract:
      "No showing scheduling: no property×agent×buyer calendar, feedback capture, or lockbox/availability rules. Requires: showing schema + scheduling workflow + feedback + agent assignment.",
  },
  {
    key: "menu-items",
    label: "Menu Items",
    websiteTypes: ["restaurant"],
    missingContract:
      "No restaurant menu structure or contract exists: no menu sections/categories, modifiers/options, availability/sold-out state, dietary/allergen information, pricing model, images/descriptions, or ordering relationship distinct from a generic catalog. PM VETOED the products\u2192\u201cMenu Items\u201d SAFE ALIAS (post-acceptance correction) \u2014 products must NOT be relabeled or presented as a restaurant menu. Restaurant products stays hidden-by-default (safe business-fit) until this contract is built; see capabilityTerminology.ts restaurant profile.",
  },
  {
    key: "donations",
    label: "Donations",
    websiteTypes: ["church"],
    missingContract:
      "No donation/donor workflow: no funds, recurring giving, donor statements, or receipt tax text. Requires: donations schema + payment integration for giving + donor management + statement export.",
  },
  {
    key: "members",
    label: "Members",
    websiteTypes: ["church", "membership", "property_management"],
    missingContract:
      "No member roster: no membership tiers, join/renew workflow, member-only content gating, or directory privacy controls. (portalUsers are end-user logins, not a membership business registry.)",
  },
  {
    key: "plans",
    label: "Plans",
    websiteTypes: ["membership"],
    missingContract:
      "No membership-plan entity (billing cadence, benefits, tier rules) or plan→member linkage. Products must NOT be relabeled Plans: no recurring billing or benefit-gating semantics exist.",
  },
  {
    key: "travelers",
    label: "Travelers",
    websiteTypes: ["travel"],
    missingContract:
      "No traveler profile/manifest entity (passport/dietary/emergency data, room assignments). Requires: traveler schema + trip linkage + manifest export.",
  },
  {
    key: "analytics",
    label: "Analytics",
    websiteTypes: ["*"],
    missingContract:
      "No analytics surface in the client dashboard (agency analytics flag is provisioned but no client-facing reporting page exists). Reserved for the OVERVIEW group; never rendered until built.",
  },
];

export const FUTURE_CAPABILITY_KEYS: readonly string[] = FUTURE_CAPABILITIES.map((c) => c.key);

/** Is this key a not-yet-real workflow that must never render? */
export function isFutureCapability(key: string): boolean {
  return FUTURE_CAPABILITY_KEYS.includes(key);
}

/* ──────────────────────────────────────────────────────────────────────
 * Registry invariants (exported for tests)
 * ────────────────────────────────────────────────────────────────────── */

/** Every live registry entry must be a genuinely supported workflow. */
export function assertRegistryInvariants(): {
  allNative: boolean;
  noFutureKeysInRegistry: boolean;
  uniqueKeys: boolean;
  groupsValid: boolean;
} {
  const keys = CAPABILITY_REGISTRY.map((c) => c.key);
  const unique = new Set(keys).size === keys.length;
  const allNative = CAPABILITY_REGISTRY.every((c) => c.support === "native");
  const overlap = keys.filter((k) => FUTURE_CAPABILITY_KEYS.includes(k));
  const groupsValid = CAPABILITY_REGISTRY.every((c) =>
    (CAPABILITY_GROUP_IDS as readonly string[]).includes(c.group),
  );
  return {
    allNative,
    noFutureKeysInRegistry: overlap.length === 0,
    uniqueKeys: unique,
    groupsValid,
  };
}
