/**
 * sidebarNav.ts
 *
 * Pure, data-driven sidebar navigation model for the TAYA client workspace
 * (Phase 2: WordPress-like sidebar). No React dependency — structure, gating
 * and hide-empty behavior are unit-testable directly.
 *
 * Client-first, WordPress-like structure:
 *   - Flat "Dashboard" entry first (always visible, handled by the layout).
 *   - Collapsible groups in client language: Edit Website, Media, Business,
 *     Communication, Marketing, Site, and TAYA Managed (design tier).
 *   - Every item gated by the site's enabledModules map; groups whose items
 *     are all hidden are dropped entirely ("hide empty groups").
 *   - Design-tier destinations tagged isDesignLocked keep the TAYA lock
 *     affordance for non-superAdmin clients; superAdmins keep full access.
 *   - Nested submenus (one level) only where the destination honors the deep
 *     link (e.g. Blog -> Drafts/Published via ?filter=).
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
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
  LayoutTemplate,
  Lock,
  Mail,
  Megaphone,
  MessageSquareQuote,
  MousePointerClick,
  Navigation as NavIcon,
  Newspaper,
  Package,
  Phone,
  ScrollText,
  Search,
  Settings,
  ShieldCheck as ShieldCheckIcon,
  ShoppingBag,
  SquarePen,
  Star,
  UserCog,
  Users,
  Zap,
} from "lucide-react";

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
  enabledModules?: Record<string, boolean> | null;
  isSuperAdmin: boolean;
}

/** All module keys referenced by the sidebar (tests verify coverage vs. gating). */
export const SIDEBAR_MODULE_KEYS = [
  "homepage", "articles", "announcement", "cta", "popup", "policy", "team",
  "careers", "downloads", "media", "services", "products", "courses",
  "events", "forms", "contact", "seo", "reviews", "portal", "payments",
  "commerce", "email", "crm", "history", "backups", "navigation", "footer",
] as const;

export const SIDEBAR_GROUP_IDS = [
  "edit-website", "media", "business", "communication", "marketing", "site",
  "taya-managed",
] as const;

const HREF = (siteId: string, leaf: string) => `/app/sites/${siteId}/${leaf}`;

export function isItemVisible(item: SidebarNavItem, ctx: SidebarBuildContext): boolean {
  if (item.superAdminOnly && !ctx.isSuperAdmin) return false;
  if (!item.moduleKey) return true;
  const modules = ctx.enabledModules;
  if (modules == null) return true;
  return modules[item.moduleKey] !== false;
}

export function buildSidebarGroups(ctx: SidebarBuildContext): SidebarNavGroup[] {
  const { siteId } = ctx;

  const visibleItems = (items: SidebarNavItem[]): SidebarNavItem[] =>
    items
      .map((item) => {
        if (!isItemVisible(item, ctx)) return null;
        if (item.children) {
          const kids = visibleItems(item.children);
          if (kids.length === 0) return null;
          return { ...item, children: kids };
        }
        return item;
      })
      .filter((item): item is SidebarNavItem => item !== null);

  const groups: SidebarNavGroup[] = [
    {
      id: "edit-website",
      title: "Edit Website",
      icon: SquarePen,
      items: [
        { id: "pages", label: "All Pages", href: HREF(siteId, "pages"), icon: FileStack },
        { id: "homepage", label: "Homepage", href: HREF(siteId, "homepage"), icon: LayoutTemplate, moduleKey: "homepage" },
        {
          id: "blog",
          label: "Blog & Articles",
          href: HREF(siteId, "articles"),
          icon: FileText,
          moduleKey: "articles",
          children: [
            { id: "blog-all", label: "All Articles", href: HREF(siteId, "articles"), icon: FileText, moduleKey: "articles" },
            { id: "blog-drafts", label: "Drafts", href: HREF(siteId, "articles") + "?filter=draft", icon: FileText, moduleKey: "articles" },
            { id: "blog-published", label: "Published", href: HREF(siteId, "articles") + "?filter=published", icon: FileText, moduleKey: "articles" },
          ],
        },
        { id: "flyers", label: "Flyers", href: HREF(siteId, "flyers"), icon: Newspaper },
        { id: "faq", label: "FAQ", href: HREF(siteId, "faq"), icon: HelpCircle },
        { id: "announcement", label: "Announcement Banner", href: HREF(siteId, "announcement"), icon: Megaphone, moduleKey: "announcement" },
        { id: "cta", label: "CTA Buttons", href: HREF(siteId, "cta"), icon: MousePointerClick, moduleKey: "cta" },
        { id: "popup", label: "Popup", href: HREF(siteId, "popup"), icon: Bell, moduleKey: "popup" },
        { id: "policies", label: "Policy Pages", href: HREF(siteId, "policies"), icon: ScrollText, moduleKey: "policy" },
        { id: "team", label: "Team", href: HREF(siteId, "team"), icon: Users, moduleKey: "team" },
        { id: "careers", label: "Careers", href: HREF(siteId, "careers"), icon: Briefcase, moduleKey: "careers" },
        { id: "downloads", label: "Downloads", href: HREF(siteId, "downloads"), icon: Download, moduleKey: "downloads" },
      ],
    },
    {
      id: "media",
      title: "Media",
      icon: ImageIcon,
      items: [
        { id: "media-library", label: "Media Library", href: HREF(siteId, "media"), icon: ImageIcon, moduleKey: "media", badge: "mediaBroken" },
      ],
    },
    {
      id: "business",
      title: "Business",
      icon: Briefcase,
      items: [
        { id: "services", label: "Services", href: HREF(siteId, "services"), icon: Briefcase, moduleKey: "services" },
        { id: "products", label: "Products", href: HREF(siteId, "products"), icon: Package, moduleKey: "products" },
        { id: "courses", label: "Courses & Classes", href: HREF(siteId, "courses"), icon: BookOpen, moduleKey: "courses" },
        {
          id: "events",
          label: "Events",
          href: HREF(siteId, "events"),
          icon: Calendar,
          moduleKey: "events",
          children: [
            { id: "events-upcoming", label: "Upcoming", href: HREF(siteId, "events"), icon: Calendar, moduleKey: "events" },
            { id: "events-past", label: "Past Events", href: HREF(siteId, "events") + "?filter=past", icon: Calendar, moduleKey: "events" },
          ],
        },
      ],
    },
    {
      id: "communication",
      title: "Communication",
      icon: Inbox,
      items: [
        { id: "forms", label: "Forms", href: HREF(siteId, "forms"), icon: FormInput, moduleKey: "forms" },
        { id: "contact-inbox", label: "Contact Inbox", href: HREF(siteId, "inbox"), icon: Inbox, moduleKey: "contact" },
      ],
    },
    {
      id: "marketing",
      title: "Marketing",
      icon: Megaphone,
      items: [
        { id: "seo", label: "SEO Settings", href: HREF(siteId, "seo"), icon: Search, moduleKey: "seo" },
        { id: "testimonials", label: "Testimonials", href: HREF(siteId, "testimonials"), icon: MessageSquareQuote },
        { id: "reviews", label: "Reviews", href: HREF(siteId, "reviews"), icon: Star, moduleKey: "reviews" },
      ],
    },
    {
      id: "site",
      title: "Site",
      icon: Settings,
      items: [
        { id: "website-settings", label: "Website Settings", href: HREF(siteId, "settings"), icon: Settings, isDesignLocked: true },
        { id: "contact-info", label: "Contact Info", href: HREF(siteId, "contact"), icon: Phone, moduleKey: "contact" },
        { id: "my-permissions", label: "My Permissions", href: HREF(siteId, "permissions"), icon: ShieldCheckIcon },
        { id: "site-users", label: "Site Users", href: HREF(siteId, "users"), icon: Users },
        { id: "automation", label: "Automation Engine™", href: HREF(siteId, "automation"), icon: Zap },
        { id: "portal-manager", label: "Portal Manager™", href: HREF(siteId, "portal"), icon: UserCog, moduleKey: "portal" },
        { id: "user-management", label: "User Management", href: "/app/admin/users", icon: Users, superAdminOnly: true },
        { id: "help-center", label: "Help Center", href: HREF(siteId, "help"), icon: HelpCircle },
      ],
    },
    {
      id: "taya-managed",
      title: "TAYA Managed",
      icon: Lock,
      items: [
        { id: "payment-providers", label: "Payment Providers", href: HREF(siteId, "payment-providers"), icon: CreditCard, isDesignLocked: true },
        { id: "square-payments", label: "Square Payments", href: HREF(siteId, "payments"), icon: CreditCard, isDesignLocked: true, moduleKey: "payments" },
        { id: "commerce", label: "Commerce", href: HREF(siteId, "commerce"), icon: ShoppingBag, isDesignLocked: true, moduleKey: "commerce" },
        { id: "email-config", label: "Email Configuration", href: HREF(siteId, "email"), icon: Mail, isDesignLocked: true, moduleKey: "email" },
        { id: "crm", label: "Marketing & CRM", href: HREF(siteId, "crm"), icon: Building2, isDesignLocked: true, moduleKey: "crm" },
        { id: "health-monitor", label: "Health Monitor", href: HREF(siteId, "health"), icon: HeartPulse, isDesignLocked: true },
        { id: "version-history", label: "Version History", href: HREF(siteId, "history"), icon: History, isDesignLocked: true, moduleKey: "history" },
        { id: "activity-log", label: "Activity Log", href: HREF(siteId, "activity"), icon: Zap, isDesignLocked: true },
        { id: "backups", label: "Backups", href: HREF(siteId, "backups"), icon: DatabaseBackup, isDesignLocked: true, moduleKey: "backups" },
        { id: "menu-builder", label: "Menu Builder", href: HREF(siteId, "nav"), icon: NavIcon, isDesignLocked: true, moduleKey: "navigation" },
        { id: "footer-structure", label: "Footer Structure", href: HREF(siteId, "footer"), icon: LayoutTemplate, isDesignLocked: true, moduleKey: "footer" },
      ],
    },
  ];

  return groups
    .filter((g) => visibleItems(g.items).length > 0)
    .map((g) => ({ ...g, items: visibleItems(g.items) }));
}
