import { PERMISSIONS, type Permission } from "./permissions";

export type CapabilityTier = "content" | "design";
export type CapabilityCategory =
  | "Content"
  | "Site Modules"
  | "Configuration"
  | "Integrations"
  | "System";

export interface Capability {
  id: string;
  label: string;
  description: string;
  tier: CapabilityTier;
  category: CapabilityCategory;
  /** Named RBAC permission enforced server-side for this capability. */
  permission?: Permission;
}

export const CAPABILITIES: Capability[] = [
  // ── Content tier (client-editable) ─────────────────────────────────────
  {
    id: "edit_homepage",
    label: "Edit Homepage Content",
    description: "Update hero headline, subheadline, hero image, and content sections.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_courses",
    label: "Manage Courses",
    description: "Create, update, and delete course catalog items.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_events",
    label: "Manage Events",
    description: "Create, update, and delete scheduled events.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_articles",
    label: "Manage Articles",
    description: "Create, publish, and delete blog articles.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_media",
    label: "Media Library",
    description: "Upload, organize, and delete media assets.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_faq",
    label: "Manage FAQs",
    description: "Add, edit, reorder, and remove FAQ entries.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_testimonials",
    label: "Manage Testimonials",
    description: "Add, edit, and remove customer testimonials.",
    tier: "content",
    category: "Content",
  },
  {
    id: "manage_forms",
    label: "Manage Forms",
    description: "Create and edit custom contact and lead forms.",
    tier: "content",
    category: "Content",
  },
  {
    id: "view_inbox",
    label: "View Contact Inbox",
    description: "Read and manage incoming form submissions.",
    tier: "content",
    category: "Content",
  },
  {
    id: "edit_announcement",
    label: "Announcement Banner",
    description: "Update the site-wide announcement banner text and link.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "manage_cta",
    label: "CTA Buttons",
    description: "Update call-to-action button labels and URLs.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "manage_team",
    label: "Manage Team",
    description: "Add, update, and remove team member profiles.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "manage_careers",
    label: "Manage Job Postings",
    description: "Post and manage career opportunities.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "manage_downloads",
    label: "Manage Downloads",
    description: "Add and manage downloadable resources.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "configure_popup",
    label: "Popup Configuration",
    description: "Configure the site popup text, trigger, and CTA.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "edit_policies",
    label: "Policy Pages",
    description: "Edit Privacy Policy, Terms of Service, and other policy documents.",
    tier: "content",
    category: "Site Modules",
  },
  {
    id: "configure_seo",
    label: "SEO Settings",
    description: "Update meta titles, descriptions, and Open Graph images per page.",
    tier: "content",
    category: "Configuration",
  },
  {
    id: "edit_contact_info",
    label: "Contact Information",
    description: "Update business address, phone, email, and hours.",
    tier: "content",
    category: "Configuration",
  },
  {
    id: "manage_pricing",
    label: "Pricing & Payment Settings",
    description: "Manage pricing tiers and payment display settings.",
    tier: "content",
    category: "Configuration",
  },

  // ── Design tier (FSTS super-admin only) ────────────────────────────────
  {
    id: "edit_navigation",
    label: "Navigation Structure",
    description: "Add, remove, reorder, or rename top-level navigation items.",
    tier: "design",
    category: "Configuration",
    permission: PERMISSIONS.LAYOUT_MANAGE,
  },
  {
    id: "edit_footer",
    label: "Footer Layout",
    description: "Edit footer columns, social links, and copyright text.",
    tier: "design",
    category: "Configuration",
    permission: PERMISSIONS.LAYOUT_MANAGE,
  },
  {
    id: "configure_email",
    label: "Email Provider Settings",
    description: "Set the sending email address, display name, and notification triggers.",
    tier: "design",
    category: "Configuration",
    permission: PERMISSIONS.INTEGRATIONS_MANAGE,
  },
  {
    id: "configure_crm",
    label: "CRM Connector Credentials",
    description: "Connect or disconnect the Operon CRM integration and manage API keys.",
    tier: "design",
    category: "Integrations",
    permission: PERMISSIONS.INTEGRATIONS_MANAGE,
  },
  {
    id: "configure_square",
    label: "Square Payment Credentials",
    description: "Set the Square application ID, access token, and location ID.",
    tier: "design",
    category: "Integrations",
    permission: PERMISSIONS.INTEGRATIONS_MANAGE,
  },
  {
    id: "update_site_branding",
    label: "Site Branding & Logo",
    description: "Update brand colors, logo, favicon, and white-label settings.",
    tier: "design",
    category: "Configuration",
    permission: PERMISSIONS.DESIGN_MANAGE,
  },
  {
    id: "manage_enabled_modules",
    label: "Module Configuration",
    description: "Enable or disable site modules (courses, events, careers, etc.).",
    tier: "design",
    category: "Configuration",
    permission: PERMISSIONS.DESIGN_MANAGE,
  },
  {
    id: "manage_routes",
    label: "Route Configuration",
    description: "Configure URL routes and path-level settings.",
    tier: "design",
    category: "System",
    permission: PERMISSIONS.CODE_MANAGE,
  },
  {
    id: "view_health_monitor",
    label: "Health Monitor",
    description: "View uptime and health check logs for this site.",
    tier: "design",
    category: "System",
    permission: PERMISSIONS.DEPLOYMENT_MANAGE,
  },
  {
    id: "view_version_history",
    label: "Version History",
    description: "Browse and restore previous content snapshots.",
    tier: "design",
    category: "System",
    permission: PERMISSIONS.DEPLOYMENT_MANAGE,
  },
  {
    id: "view_activity_log",
    label: "Activity Log",
    description: "View the audit trail of all changes made to this site.",
    tier: "design",
    category: "System",
    permission: PERMISSIONS.DEPLOYMENT_MANAGE,
  },
  {
    id: "manage_backups",
    label: "Backup Management",
    description: "Create, download, and restore site backups.",
    tier: "design",
    category: "System",
    permission: PERMISSIONS.DEPLOYMENT_MANAGE,
  },
];

export const DESIGN_LOCKED_IDS = new Set(
  CAPABILITIES.filter((c) => c.tier === "design").map((c) => c.id),
);

export function isDesignLocked(capabilityId: string): boolean {
  return DESIGN_LOCKED_IDS.has(capabilityId);
}

export const CONTENT_CAPABILITIES = CAPABILITIES.filter((c) => c.tier === "content");
export const DESIGN_CAPABILITIES = CAPABILITIES.filter((c) => c.tier === "design");

/** Routes that are design-locked (FSTS super-admins only). */
export const DESIGN_LOCKED_PATHS = new Set([
  "nav",
  "footer",
  "email",
  "crm",
  "payments",
  "commerce",
  "health",
  "history",
  "activity",
  "backups",
]);
