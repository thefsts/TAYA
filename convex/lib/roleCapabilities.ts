/**
 * Role Capabilities — Phase 9: Client Permissions™
 *
 * Defines named client roles plus the FSTS-only internal QA role and their
 * default per-module permission levels.
 * Permission levels (ascending): none < view < edit < manage
 */

export const ROLES = [
  "internal_qa",
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
  internal_qa: "FSTS Internal QA",
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

export const DASHBOARD_MODULES = [
  "dashboard", "homepage", "courses", "events", "articles", "media", "faq",
  "testimonials", "forms", "inbox", "navigation", "announcement", "cta", "team",
  "careers", "downloads", "popup", "policy", "contact", "footer", "seo",
  "payments", "commerce", "email", "crm", "health", "history", "activity",
  "backups", "help",
] as const;

export type DashboardModule = (typeof DASHBOARD_MODULES)[number];

export const MODULE_LABELS: Record<DashboardModule, string> = {
  dashboard: "Dashboard", homepage: "Homepage", courses: "Courses", events: "Events",
  articles: "Articles", media: "Media Library", faq: "FAQ", testimonials: "Testimonials",
  forms: "Forms", inbox: "Contact Inbox", navigation: "Navigation",
  announcement: "Announcement Banner", cta: "CTA Buttons", team: "Team", careers: "Careers",
  downloads: "Downloads", popup: "Popup", policy: "Policy Pages", contact: "Contact Info",
  footer: "Footer", seo: "SEO Settings", payments: "Square Payments", commerce: "Commerce",
  email: "Email Config", crm: "Marketing & CRM", health: "Health Monitor",
  history: "Version History", activity: "Activity Log", backups: "Backups", help: "Help Center",
};

export type PermissionLevel = "none" | "view" | "edit" | "manage";
export const PERMISSION_LEVELS: PermissionLevel[] = ["none", "view", "edit", "manage"];
export type RoleCapabilityMap = Record<DashboardModule, PermissionLevel>;
type FullCapabilityMatrix = Record<Role, RoleCapabilityMap>;

const MANAGE_ALL: RoleCapabilityMap = Object.fromEntries(
  DASHBOARD_MODULES.map((module) => [module, module === "help" ? "view" : "manage"]),
) as RoleCapabilityMap;
const VIEW_ALL: RoleCapabilityMap = Object.fromEntries(
  DASHBOARD_MODULES.map((module) => [module, "view"]),
) as RoleCapabilityMap;

export const ROLE_CAPABILITIES: FullCapabilityMatrix = {
  // Internal QA intentionally mirrors the client Owner module surface. It remains
  // a distinct role, and Global Design Lock still requires isSuperAdmin.
  internal_qa: MANAGE_ALL,
  owner: MANAGE_ALL,
  manager: {
    dashboard: "manage", homepage: "edit", courses: "edit", events: "edit", articles: "edit", media: "edit",
    faq: "edit", testimonials: "edit", forms: "edit", inbox: "edit", navigation: "edit", announcement: "edit",
    cta: "edit", team: "edit", careers: "edit", downloads: "edit", popup: "edit", policy: "edit", contact: "edit",
    footer: "edit", seo: "edit", payments: "view", commerce: "view", email: "view", crm: "edit", health: "view",
    history: "view", activity: "view", backups: "view", help: "view",
  },
  marketing: {
    dashboard: "view", homepage: "edit", courses: "view", events: "view", articles: "edit", media: "edit",
    faq: "edit", testimonials: "edit", forms: "view", inbox: "view", navigation: "view", announcement: "edit",
    cta: "edit", team: "view", careers: "none", downloads: "none", popup: "edit", policy: "none", contact: "none",
    footer: "none", seo: "edit", payments: "none", commerce: "none", email: "none", crm: "manage", health: "none",
    history: "none", activity: "none", backups: "none", help: "view",
  },
  content_editor: {
    dashboard: "view", homepage: "edit", courses: "edit", events: "edit", articles: "edit", media: "edit",
    faq: "edit", testimonials: "edit", forms: "view", inbox: "view", navigation: "none", announcement: "none",
    cta: "none", team: "edit", careers: "edit", downloads: "edit", popup: "none", policy: "edit", contact: "none",
    footer: "none", seo: "view", payments: "none", commerce: "none", email: "none", crm: "none", health: "none",
    history: "view", activity: "view", backups: "none", help: "view",
  },
  course_manager: {
    dashboard: "view", homepage: "none", courses: "manage", events: "none", articles: "none", media: "view",
    faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none",
    footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "none", health: "none",
    history: "none", activity: "none", backups: "none", help: "view",
  },
  events_manager: {
    dashboard: "view", homepage: "none", courses: "none", events: "manage", articles: "none", media: "view",
    faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none",
    footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "none", health: "none",
    history: "none", activity: "none", backups: "none", help: "view",
  },
  finance: {
    dashboard: "view", homepage: "none", courses: "view", events: "view", articles: "none", media: "none",
    faq: "none", testimonials: "none", forms: "none", inbox: "none", navigation: "none", announcement: "none",
    cta: "none", team: "none", careers: "none", downloads: "none", popup: "none", policy: "none", contact: "none",
    footer: "none", seo: "none", payments: "manage", commerce: "manage", email: "none", crm: "none", health: "none",
    history: "view", activity: "view", backups: "none", help: "view",
  },
  support: {
    dashboard: "view", homepage: "none", courses: "view", events: "view", articles: "view", media: "none",
    faq: "view", testimonials: "view", forms: "view", inbox: "manage", navigation: "none", announcement: "none",
    cta: "none", team: "view", careers: "none", downloads: "none", popup: "none", policy: "view", contact: "view",
    footer: "none", seo: "none", payments: "none", commerce: "none", email: "none", crm: "view", health: "view",
    history: "none", activity: "view", backups: "none", help: "view",
  },
  read_only: VIEW_ALL,
};

export function permissionAtLeast(levelA: PermissionLevel, levelB: PermissionLevel): boolean {
  return PERMISSION_LEVELS.indexOf(levelA) >= PERMISSION_LEVELS.indexOf(levelB);
}

export const WRITE_ROLES_NEW = new Set<Role>(
  (ROLES as readonly Role[]).filter((role) =>
    Object.values(ROLE_CAPABILITIES[role]).some((level) => level === "edit" || level === "manage"),
  ),
);
