/**
 * Client-side copy of role capability definitions.
 * Keep in sync with convex/lib/roleCapabilities.ts.
 */

export const ROLES = [
  "owner",
  "manager",
  "marketing",
  "content_editor",
  "course_manager",
  "events_manager",
  "finance",
  "support",
  "read_only",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  marketing: "Marketing",
  content_editor: "Content Editor",
  course_manager: "Course Manager",
  events_manager: "Events Manager",
  finance: "Finance",
  support: "Support",
  read_only: "Read Only",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control over all site modules — equivalent to a site administrator.",
  manager: "Can edit most content and configuration; read-only for payments and email.",
  marketing: "Manages marketing content, CRM, SEO, and announcements.",
  content_editor: "Edits pages, articles, courses, and media. No configuration access.",
  course_manager: "Manages courses and course media only.",
  events_manager: "Manages events and event media only.",
  finance: "Manages payments and commerce; read-only for courses and events.",
  support: "Manages the contact inbox and has read-only access to most content.",
  read_only: "Can view all modules but cannot make any changes.",
};

export const DASHBOARD_MODULES = [
  "dashboard",
  "homepage",
  "courses",
  "events",
  "articles",
  "media",
  "faq",
  "testimonials",
  "forms",
  "inbox",
  "navigation",
  "announcement",
  "cta",
  "team",
  "careers",
  "downloads",
  "popup",
  "policy",
  "contact",
  "footer",
  "seo",
  "payments",
  "commerce",
  "email",
  "crm",
  "health",
  "history",
  "activity",
  "backups",
  "help",
] as const;

export type DashboardModule = (typeof DASHBOARD_MODULES)[number];

export const MODULE_LABELS: Record<DashboardModule, string> = {
  dashboard: "Dashboard",
  homepage: "Homepage",
  courses: "Courses",
  events: "Events",
  articles: "Articles",
  media: "Media Library",
  faq: "FAQ",
  testimonials: "Testimonials",
  forms: "Forms",
  inbox: "Contact Inbox",
  navigation: "Navigation",
  announcement: "Announcement Banner",
  cta: "CTA Buttons",
  team: "Team",
  careers: "Careers",
  downloads: "Downloads",
  popup: "Popup",
  policy: "Policy Pages",
  contact: "Contact Info",
  footer: "Footer",
  seo: "SEO Settings",
  payments: "Square Payments",
  commerce: "Commerce",
  email: "Email Config",
  crm: "Marketing & CRM",
  health: "Health Monitor",
  history: "Version History",
  activity: "Activity Log",
  backups: "Backups",
  help: "Help Center",
};

export const MODULE_SECTIONS: { label: string; modules: DashboardModule[] }[] = [
  {
    label: "Content",
    modules: ["dashboard", "homepage", "courses", "events", "articles", "media", "faq", "testimonials", "forms", "inbox"],
  },
  {
    label: "Site Modules",
    modules: ["navigation", "announcement", "cta", "team", "careers", "downloads", "popup", "policy"],
  },
  {
    label: "Configuration",
    modules: ["contact", "footer", "seo", "payments", "commerce", "email"],
  },
  {
    label: "Marketing & CRM",
    modules: ["crm"],
  },
  {
    label: "System",
    modules: ["health", "history", "activity", "backups", "help"],
  },
];

export type PermissionLevel = "none" | "view" | "edit" | "manage";

export const PERMISSION_LEVELS: PermissionLevel[] = ["none", "view", "edit", "manage"];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: "No access",
  view: "View",
  edit: "Edit",
  manage: "Manage",
};

export const PERMISSION_LEVEL_COLORS: Record<PermissionLevel, string> = {
  none: "bg-slate-100 text-slate-400",
  view: "bg-blue-50 text-blue-700",
  edit: "bg-amber-50 text-amber-700",
  manage: "bg-green-50 text-green-700",
};

export type RoleCapabilityMap = Record<DashboardModule, PermissionLevel>;

const MANAGE_ALL: RoleCapabilityMap = Object.fromEntries(
  DASHBOARD_MODULES.map((m) => [m, m === "help" ? "view" : "manage"]),
) as RoleCapabilityMap;

const VIEW_ALL: RoleCapabilityMap = Object.fromEntries(
  DASHBOARD_MODULES.map((m) => [m, "view"]),
) as RoleCapabilityMap;

export const ROLE_CAPABILITIES: Record<Role, RoleCapabilityMap> = {
  owner: MANAGE_ALL,

  manager: {
    dashboard: "manage", homepage: "edit", courses: "edit", events: "edit",
    articles: "edit", media: "edit", faq: "edit", testimonials: "edit",
    forms: "edit", inbox: "edit", navigation: "edit", announcement: "edit",
    cta: "edit", team: "edit", careers: "edit", downloads: "edit",
    popup: "edit", policy: "edit", contact: "edit", footer: "edit",
    seo: "edit", payments: "view", commerce: "view", email: "view",
    crm: "edit", health: "view", history: "view", activity: "view",
    backups: "view", help: "view",
  },

  marketing: {
    dashboard: "view", homepage: "edit", courses: "view", events: "view",
    articles: "edit", media: "edit", faq: "edit", testimonials: "edit",
    forms: "view", inbox: "view", navigation: "view", announcement: "edit",
    cta: "edit", team: "view", careers: "none", downloads: "none",
    popup: "edit", policy: "none", contact: "none", footer: "none",
    seo: "edit", payments: "none", commerce: "none", email: "none",
    crm: "manage", health: "none", history: "none", activity: "none",
    backups: "none", help: "view",
  },

  content_editor: {
    dashboard: "view", homepage: "edit", courses: "edit", events: "edit",
    articles: "edit", media: "edit", faq: "edit", testimonials: "edit",
    forms: "view", inbox: "view", navigation: "none", announcement: "none",
    cta: "none", team: "edit", careers: "edit", downloads: "edit",
    popup: "none", policy: "edit", contact: "none", footer: "none",
    seo: "view", payments: "none", commerce: "none", email: "none",
    crm: "none", health: "none", history: "view", activity: "view",
    backups: "none", help: "view",
  },

  course_manager: {
    dashboard: "view", homepage: "none", courses: "manage", events: "none",
    articles: "none", media: "view", faq: "none", testimonials: "none",
    forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none",
    popup: "none", policy: "none", contact: "none", footer: "none",
    seo: "none", payments: "none", commerce: "none", email: "none",
    crm: "none", health: "none", history: "none", activity: "none",
    backups: "none", help: "view",
  },

  events_manager: {
    dashboard: "view", homepage: "none", courses: "none", events: "manage",
    articles: "none", media: "view", faq: "none", testimonials: "none",
    forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none",
    popup: "none", policy: "none", contact: "none", footer: "none",
    seo: "none", payments: "none", commerce: "none", email: "none",
    crm: "none", health: "none", history: "none", activity: "none",
    backups: "none", help: "view",
  },

  finance: {
    dashboard: "view", homepage: "none", courses: "view", events: "view",
    articles: "none", media: "none", faq: "none", testimonials: "none",
    forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none",
    popup: "none", policy: "none", contact: "none", footer: "none",
    seo: "none", payments: "manage", commerce: "manage", email: "none",
    crm: "none", health: "none", history: "view", activity: "view",
    backups: "none", help: "view",
  },

  support: {
    dashboard: "view", homepage: "none", courses: "view", events: "view",
    articles: "view", media: "none", faq: "view", testimonials: "view",
    forms: "view", inbox: "manage", navigation: "none", announcement: "none",
    cta: "none", team: "view", careers: "none", downloads: "none",
    popup: "none", policy: "view", contact: "view", footer: "none",
    seo: "none", payments: "none", commerce: "none", email: "none",
    crm: "view", health: "view", history: "none", activity: "view",
    backups: "none", help: "view",
  },

  read_only: VIEW_ALL,
};

export function permissionAtLeast(a: PermissionLevel, b: PermissionLevel): boolean {
  return PERMISSION_LEVELS.indexOf(a) >= PERMISSION_LEVELS.indexOf(b);
}

// Phase 10 — Agency Edition™: platform-level feature flags available per agency
export const AGENCY_FEATURE_FLAGS = [
  "crm",
  "ecommerce",
  "forms",
  "media",
  "analytics",
  "backups",
  "version_history",
  "multi_user",
  "custom_domain",
  "white_label",
  "api_access",
  "priority_support",
] as const;

export type AgencyFeatureFlag = (typeof AGENCY_FEATURE_FLAGS)[number];

export const AGENCY_FEATURE_FLAG_LABELS: Record<AgencyFeatureFlag, string> = {
  crm: "Operon CRM Connector™",
  ecommerce: "Commerce & Payments",
  forms: "Form Builder",
  media: "Media Library",
  analytics: "Analytics Integration",
  backups: "Backups & Restore",
  version_history: "Version History",
  multi_user: "Multi-User Access",
  custom_domain: "Custom Domain",
  white_label: "White-Label Branding",
  api_access: "API Access",
  priority_support: "Priority Support",
};

export const AGENCY_FEATURE_FLAG_DESCRIPTIONS: Record<AgencyFeatureFlag, string> = {
  crm: "Operon Connector™ for bi-directional CRM sync",
  ecommerce: "Square Payments, Commerce, and checkout features",
  forms: "Drag-and-drop form builder with submission tracking",
  media: "Managed media library and asset optimization",
  analytics: "Google Analytics 4, Tag Manager, and pixel integrations",
  backups: "Automated site snapshots and one-click restore",
  version_history: "Full version history with per-field rollback",
  multi_user: "Multiple user roles and site-level permissions",
  custom_domain: "Custom domain configuration and management",
  white_label: "Agency-branded login, header, and help center",
  api_access: "Public REST API for external integrations",
  priority_support: "Dedicated support queue with SLA guarantee",
};
