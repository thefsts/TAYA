import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  BookOpen,
  LayoutTemplate,
  BookOpen as CoursesIcon,
  Calendar,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  MessageSquareQuote,
  FormInput,
  Inbox,
  Navigation,
  Megaphone,
  MousePointerClick,
  Download,
  Users,
  Briefcase,
  Bell,
  ScrollText,
  Phone,
  Search,
  CreditCard,
  ShoppingBag,
  Mail,
  Building2,
  HeartPulse,
  History,
  Activity,
  DatabaseBackup,
  LifeBuoy,
  ShieldCheck,
  Settings,
  Zap,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type AccessLevel = "superadmin" | "owner" | "manager" | "client" | "all";

interface ModuleDoc {
  key: string;
  label: string;
  icon: any;
  section: string;
  description: string;
  purpose: string;
  configSteps: string[];
  clientCanChange: string[];
  clientCannotChange: string[];
  accessLevel: AccessLevel;
  featureFlag?: string;
  designLocked?: boolean;
  notes?: string;
}

const ACCESS_COLORS: Record<AccessLevel, string> = {
  superadmin: "bg-purple-100 text-purple-700 border-purple-200",
  owner: "bg-blue-100 text-blue-700 border-blue-200",
  manager: "bg-green-100 text-green-700 border-green-200",
  client: "bg-slate-100 text-slate-700 border-slate-200",
  all: "bg-slate-50 text-slate-600 border-slate-200",
};

const ACCESS_LABELS: Record<AccessLevel, string> = {
  superadmin: "FSTS Admin Only",
  owner: "Site Owner+",
  manager: "Manager+",
  client: "All Roles",
  all: "All Roles",
};

const MODULES: ModuleDoc[] = [
  {
    key: "dashboard",
    label: "Site Dashboard",
    icon: Activity,
    section: "Content",
    description: "At-a-glance metrics, recent activity, website health score, and status overview.",
    purpose: "The landing page for every site workspace. Provides a bird's-eye view of content counts, health, and recent admin actions.",
    configSteps: ["No manual configuration required — the dashboard auto-populates from other modules."],
    clientCanChange: ["Read-only by design — no settings to change."],
    clientCannotChange: ["Dashboard layout is fixed — super-admins cannot customize widgets per-site yet."],
    accessLevel: "all",
  },
  {
    key: "homepage",
    label: "Homepage Editor",
    icon: LayoutTemplate,
    section: "Content",
    description: "Edit the hero headline, hero image, and custom content sections that appear on the site's home page.",
    purpose: "Lets client editors control the most visible page without touching code. Supports versioning and rollback.",
    configSteps: [
      "Navigate to Site → Homepage.",
      "Set a hero headline and sub-headline.",
      "Optionally upload a hero background image.",
      "Add custom sections using the section builder.",
      "Save — changes are immediately reflected in the public API.",
    ],
    clientCanChange: ["Hero headline and sub-headline", "Hero image", "Custom sections (text, image, CTA)"],
    clientCannotChange: ["Homepage template layout or design system", "Navigation structure (managed in Navigation module)"],
    accessLevel: "client",
    featureFlag: "homepage",
  },
  {
    key: "courses",
    label: "Course Manager",
    icon: CoursesIcon,
    section: "Content",
    description: "Create and manage training courses, associate them with Square catalog items, and publish to the public website.",
    purpose: "Used by training academies and security companies to publish their course catalog.",
    configSteps: [
      "Navigate to Site → Courses.",
      "Create a course with title, slug, description, duration, and price.",
      "Optionally link to a Square catalog item for checkout.",
      "Set status to 'published' to make it visible on the website.",
    ],
    clientCanChange: ["Course title, description, duration, price", "Cover image", "Publication status", "Square item link"],
    clientCannotChange: ["Course URL structure (slug is set at creation)", "Site-level module availability"],
    accessLevel: "client",
    featureFlag: "courses",
  },
  {
    key: "events",
    label: "Event Manager",
    icon: Calendar,
    section: "Content",
    description: "Create and manage events with start/end times, location, and optional Square ticketing integration.",
    purpose: "Allows clients to publish upcoming events and classes to their website.",
    configSteps: [
      "Navigate to Site → Events.",
      "Create an event with title, date/time, location, and description.",
      "Optionally link to a Square item for ticket purchase.",
      "Publish to make it visible on the website.",
    ],
    clientCanChange: ["Event details, date/time, location", "Cover image", "Publication status"],
    clientCannotChange: ["Event template design", "Calendar widget embed code"],
    accessLevel: "client",
    featureFlag: "events",
  },
  {
    key: "articles",
    label: "Articles / Blog",
    icon: FileText,
    section: "Content",
    description: "Full-featured blog and article management with per-article SEO, scheduling, tagging, and featured image.",
    purpose: "Powers the client's content marketing. Articles are fetched by the public website via the Convex HTTP API.",
    configSteps: [
      "Navigate to Site → Articles.",
      "Create an article with title, body, and optional SEO fields.",
      "Set an author, category, and tags.",
      "Schedule a publish date or publish immediately.",
      "Mark as featured to highlight on the blog index.",
    ],
    clientCanChange: ["All article content including SEO overrides", "Author name, categories, tags", "Scheduled publish date"],
    clientCannotChange: ["Blog index template or design", "URL structure (slug is set at creation)"],
    accessLevel: "client",
    featureFlag: "articles",
  },
  {
    key: "media",
    label: "Media Library",
    icon: ImageIcon,
    section: "Content",
    description: "Upload and manage media assets. Supports images with optional alt text and size metadata.",
    purpose: "Centralized asset store for all site images referenced across modules.",
    configSteps: [
      "Navigate to Site → Media Library.",
      "Upload images via the upload button.",
      "Add alt text for accessibility.",
      "Copy the asset URL to use in other modules.",
    ],
    clientCanChange: ["Upload and delete their own assets", "Alt text"],
    clientCannotChange: ["Globally shared assets (each site has its own isolated library)"],
    accessLevel: "client",
    featureFlag: "media",
  },
  {
    key: "faq",
    label: "FAQ Manager",
    icon: HelpCircle,
    section: "Content",
    description: "Manage a list of frequently asked questions visible on the website.",
    purpose: "Reduces support burden by letting clients maintain their own FAQ page.",
    configSteps: ["Navigate to Site → FAQ.", "Add, edit, reorder, and toggle visibility of FAQ items."],
    clientCanChange: ["All FAQ content", "Order and visibility of items"],
    clientCannotChange: ["FAQ page layout or design"],
    accessLevel: "client",
  },
  {
    key: "testimonials",
    label: "Testimonials",
    icon: MessageSquareQuote,
    section: "Content",
    description: "Manage customer testimonials with rating, name, role, company, and avatar.",
    purpose: "Surfaces social proof on the website. Display-only content import — active review features (requesting, responding, campaigning) belong exclusively in Operon CRM™.",
    configSteps: ["Navigate to Site → Testimonials.", "Create testimonials and toggle active/inactive."],
    clientCanChange: ["All testimonial content, photos, ratings", "Active/inactive state"],
    clientCannotChange: ["Testimonials cannot be fetched from Google/Yelp here — that is an Operon CRM™ feature"],
    accessLevel: "client",
    notes: "TAYA™ provides display-only review import. Active review workflows (requesting, responding, campaigning) are Operon CRM™ features, not available here.",
  },
  {
    key: "forms",
    label: "Form Builder",
    icon: FormInput,
    section: "Content",
    description: "Drag-and-drop form builder with field types, validation, email notifications, and submission tracking.",
    purpose: "Replaces static contact forms. Forms are embedded on the website via the public form URL.",
    configSteps: [
      "Navigate to Site → Forms.",
      "Create a form using the builder (text, email, phone, select, checkbox, textarea, file fields).",
      "Configure submission settings and email notifications.",
      "Embed the form URL on the website.",
    ],
    clientCanChange: ["Form fields, labels, validation rules", "Notification recipients", "Form status (active/draft)"],
    clientCannotChange: ["Form styling — inherits site theme", "Form URL slug (set at creation)"],
    accessLevel: "client",
    featureFlag: "forms",
  },
  {
    key: "inbox",
    label: "Contact Inbox",
    icon: Inbox,
    section: "Content",
    description: "View and manage form submissions from all site forms in one place.",
    purpose: "Central inbox for all inbound leads, contact requests, and form responses.",
    configSteps: ["Navigate to Site → Contact Inbox.", "Review, mark as read, or archive submissions."],
    clientCanChange: ["Mark read/unread, archive submissions"],
    clientCannotChange: ["Submission data (read-only once received)"],
    accessLevel: "client",
  },
  {
    key: "navigation",
    label: "Navigation Manager",
    icon: Navigation,
    section: "Site Modules",
    description: "Manage the primary navigation menu items: labels, links, order, and visibility.",
    purpose: "Controls what links appear in the site's header nav. Design-locked to prevent breaking site structure.",
    configSteps: [
      "Navigate to Site → Navigation.",
      "Add, reorder, show/hide, or delete navigation items.",
      "Each item has a label, URL, and optional 'open in new tab' flag.",
    ],
    clientCanChange: ["Nothing — this module is Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All navigation settings — only FSTS super-admins can modify"],
    accessLevel: "superadmin",
    designLocked: true,
  },
  {
    key: "announcement",
    label: "Announcement Banner",
    icon: Megaphone,
    section: "Site Modules",
    description: "A dismissable banner that appears at the top of the website with a custom message and optional CTA link.",
    purpose: "Used for time-sensitive promotions, alerts, or announcements.",
    configSteps: ["Navigate to Site → Announcement.", "Set banner text, background color, and optional link.", "Toggle active/inactive."],
    clientCanChange: ["Banner text, color, link", "Active/inactive state"],
    clientCannotChange: ["Banner position or animation style"],
    accessLevel: "client",
    featureFlag: "announcement",
  },
  {
    key: "cta",
    label: "CTA Buttons",
    icon: MousePointerClick,
    section: "Site Modules",
    description: "Configure primary and secondary call-to-action buttons used across the website.",
    purpose: "Ensures consistent CTAs sitewide. Referenced by the public API and rendered by the website theme.",
    configSteps: ["Navigate to Site → CTA Buttons.", "Set primary button label and URL.", "Optionally add a secondary CTA."],
    clientCanChange: ["Button labels and URLs"],
    clientCannotChange: ["Button placement on the website — determined by the theme"],
    accessLevel: "client",
  },
  {
    key: "team",
    label: "Team Manager",
    icon: Users,
    section: "Site Modules",
    description: "Manage team member profiles with name, role, bio, credentials, and photo.",
    purpose: "Powers the 'Meet the Team' section on the website.",
    configSteps: ["Navigate to Site → Team.", "Add team members with photo and bio.", "Toggle active/inactive and reorder."],
    clientCanChange: ["All team member data including photos"],
    clientCannotChange: ["Team section layout or card design"],
    accessLevel: "client",
  },
  {
    key: "careers",
    label: "Careers Manager",
    icon: Briefcase,
    section: "Site Modules",
    description: "Post job openings with title, type, location, description, and apply link.",
    purpose: "Enables clients to run basic recruitment from their website.",
    configSteps: ["Navigate to Site → Careers.", "Create job postings and toggle active/inactive."],
    clientCanChange: ["All job posting content and status"],
    clientCannotChange: ["Careers page design or ATS integrations"],
    accessLevel: "client",
  },
  {
    key: "downloads",
    label: "Downloads Manager",
    icon: Download,
    section: "Site Modules",
    description: "Manage downloadable resources (PDFs, guides, forms) available to site visitors.",
    purpose: "Content hub for gated or free resource downloads.",
    configSteps: ["Navigate to Site → Downloads.", "Add resources with title, URL, format, and category."],
    clientCanChange: ["All download content", "Active/inactive and order"],
    clientCannotChange: ["Download page template design"],
    accessLevel: "client",
  },
  {
    key: "popup",
    label: "Popup Manager",
    icon: Bell,
    section: "Site Modules",
    description: "Configure a site popup with title, body, CTA, and trigger type (time delay or exit intent).",
    purpose: "Lead capture and conversion optimization through strategic popups.",
    configSteps: ["Navigate to Site → Popup.", "Set popup content and trigger.", "Toggle enabled/disabled."],
    clientCanChange: ["All popup content and trigger settings"],
    clientCannotChange: ["Popup animation style or z-index behavior"],
    accessLevel: "client",
  },
  {
    key: "policy",
    label: "Policy Pages",
    icon: ScrollText,
    section: "Site Modules",
    description: "Manage Privacy Policy, Terms of Service, and other legal policy pages.",
    purpose: "Keeps legal documents up to date and accessible on the website.",
    configSteps: ["Navigate to Site → Policy Pages.", "Edit each policy type with rich text content."],
    clientCanChange: ["Policy content (rich text)"],
    clientCannotChange: ["Policy page template or URL structure"],
    accessLevel: "client",
  },
  {
    key: "settings",
    label: "Website Settings™",
    icon: Settings,
    section: "Configuration",
    description: "Master site configuration: identity, branding, contact defaults, SEO globals, analytics, and legal links.",
    purpose: "Single source of truth for site-wide configuration. Values are inherited by other modules as defaults.",
    configSteps: [
      "Navigate to Site → Website Settings.",
      "Fill in Identity: business name, tagline, logo, favicon, timezone.",
      "Fill in Branding: primary/secondary/accent colors, heading/body fonts.",
      "Fill in Contact: phone, email, address, business hours.",
      "Fill in SEO: global title template, meta description, OG image.",
      "Fill in Integrations: GA4 measurement ID, GTM container ID, Meta Pixel.",
      "Fill in Legal: privacy policy URL, terms of service URL.",
    ],
    clientCanChange: ["All settings within their assigned role permissions"],
    clientCannotChange: ["Site slug, enabled modules, or agency assignment — those require FSTS admin"],
    accessLevel: "owner",
  },
  {
    key: "contact",
    label: "Contact Info",
    icon: Phone,
    section: "Configuration",
    description: "Configure the site's public contact details: email, phone, address, map embed, and business hours.",
    purpose: "Feeds the contact page and is referenced by the public API.",
    configSteps: ["Navigate to Site → Contact Info.", "Fill in all contact fields and business hours.", "Add Google Maps embed URL for the map widget."],
    clientCanChange: ["All contact details"],
    clientCannotChange: ["Contact page design or layout"],
    accessLevel: "client",
    featureFlag: "contact",
  },
  {
    key: "footer",
    label: "Footer Editor",
    icon: LayoutTemplate,
    section: "Configuration",
    description: "Manage footer columns (with links), social links, and copyright text.",
    purpose: "Powers the site's footer. Design-locked to prevent structural breakage.",
    configSteps: ["Navigate to Site → Footer.", "Edit footer columns, links, social links, and copyright text."],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All footer settings require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "footer",
  },
  {
    key: "seo",
    label: "SEO Settings",
    icon: Search,
    section: "Configuration",
    description: "Per-page SEO overrides: title, meta description, OG image, canonical URL.",
    purpose: "Fine-grained SEO control per page beyond the global defaults in Website Settings.",
    configSteps: ["Navigate to Site → SEO Settings.", "Add per-page SEO records for key pages.", "Values here override global Website Settings SEO defaults."],
    clientCanChange: ["All per-page SEO fields"],
    clientCannotChange: ["Robots.txt or sitemap generation — those are at the website/CDN level"],
    accessLevel: "client",
    featureFlag: "seo",
  },
  {
    key: "payment-providers",
    label: "Payment Providers",
    icon: CreditCard,
    section: "Configuration",
    description: "Connect and manage payment provider credentials (Square, Stripe, PayPal, etc.) for this site.",
    purpose: "Central hub for all payment connector credentials. Credentials are encrypted before storage.",
    configSteps: [
      "Navigate to Site → Payment Providers.",
      "Click 'Connect' for the desired provider.",
      "Enter API credentials (access token, application ID, location ID).",
      "Run the health check to confirm connectivity.",
      "Enable checkout to allow customer transactions.",
    ],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All credential management requires FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
  },
  {
    key: "payments",
    label: "Square Payments",
    icon: CreditCard,
    section: "Configuration",
    description: "Manage Square Payments configuration, catalog sync, orders, and discounts.",
    purpose: "Legacy Square integration panel. New sites should use Payment Providers module.",
    configSteps: ["Configure via Payment Providers module.", "Square catalog and order data appear here once connected."],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All Square settings require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "payments",
  },
  {
    key: "commerce",
    label: "Square Commerce",
    icon: ShoppingBag,
    section: "Configuration",
    description: "View catalog items synced from Square, manage mappings to courses/events, and view orders.",
    purpose: "Bridges the Square catalog with FSTS content modules for seamless checkout.",
    configSteps: ["Connect Square via Payment Providers.", "Run catalog sync to import items.", "Map Square items to courses and events."],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All commerce settings require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "commerce",
  },
  {
    key: "email",
    label: "Email Config",
    icon: Mail,
    section: "Configuration",
    description: "Configure email sender identity and notification preferences for form submissions and bookings.",
    purpose: "Ensures outbound emails use the client's brand identity.",
    configSteps: ["Navigate to Site → Email Config.", "Set from name, from email, and reply-to.", "Toggle notification types."],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All email configuration requires FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "email",
  },
  {
    key: "crm",
    label: "Operon Connector™",
    icon: Building2,
    section: "Marketing & CRM",
    description: "Bi-directional sync connector between TAYA™ and Operon CRM™. Configure credentials, entity sync settings, and monitor API health.",
    purpose: "The sole sanctioned integration point between TAYA™ and Operon CRM™. Supports per-entity sync toggles and an activity log with retry.",
    configSteps: [
      "Navigate to Site → Marketing & CRM.",
      "Enter Operon CRM™ API credentials (API key or SSO).",
      "Run a health check to confirm connectivity.",
      "Configure outbound sync (contacts, quotes, orders) and inbound sync (appointment status, lead tags).",
      "Monitor the sync activity log for errors and retry failures.",
    ],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All CRM connection settings require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "crm",
    notes: "The Operon Connector™ is pre-installed (inactive) for every new site. Activate by entering credentials.",
  },
  {
    key: "automation",
    label: "Automation Engine™",
    icon: Zap,
    section: "Automation",
    description: "Rule-based automation: trigger actions (email, webhook, Operon sync) when conditions are met.",
    purpose: "Automates repetitive actions across the platform without custom code.",
    configSteps: [
      "Navigate to Site → Automation Engine™.",
      "Create a rule with a trigger type (form submit, course enroll, etc.).",
      "Add conditions to filter which events trigger the rule.",
      "Add actions (send email, call webhook, sync to Operon).",
      "Enable the rule to activate it.",
    ],
    clientCanChange: ["Nothing — Automation Engine™ is currently FSTS admin only"],
    clientCannotChange: ["All automation rules require FSTS super-admin access"],
    accessLevel: "superadmin",
  },
  {
    key: "health",
    label: "Health Monitor",
    icon: HeartPulse,
    section: "System",
    description: "Run website health scans that check uptime, performance, SEO, security, and content quality. View notifications and dismiss alerts.",
    purpose: "Proactive monitoring to catch issues before clients notice them.",
    configSteps: ["Navigate to Site → Health Monitor.", "Run a manual scan or wait for the scheduled cron.", "Review per-category scores and dismiss resolved alerts."],
    clientCanChange: ["Dismiss notifications"],
    clientCannotChange: ["Health scan schedule (managed by Convex crons)", "Scan categories or thresholds"],
    accessLevel: "owner",
    designLocked: true,
  },
  {
    key: "history",
    label: "Version History",
    icon: History,
    section: "System",
    description: "View and restore previous versions of homepage content and other versioned entities.",
    purpose: "Rollback safety net — every save creates a version snapshot.",
    configSteps: ["Navigate to Site → Version History.", "Browse entity snapshots.", "Click Restore to revert to a previous version."],
    clientCanChange: ["Nothing — read-only for clients"],
    clientCannotChange: ["All restore actions require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
  },
  {
    key: "activity",
    label: "Activity Log",
    icon: Activity,
    section: "System",
    description: "Full audit trail of every admin action taken on the site — who did what and when.",
    purpose: "Compliance and accountability. Searchable and filterable.",
    configSteps: ["Navigate to Site → Activity Log.", "Review the log — no configuration required."],
    clientCanChange: ["Nothing — read-only"],
    clientCannotChange: ["Log entries cannot be deleted or modified"],
    accessLevel: "superadmin",
    designLocked: true,
  },
  {
    key: "backups",
    label: "Backups",
    icon: DatabaseBackup,
    section: "System",
    description: "Automated site snapshots with one-click restore. Backups capture all site content and settings.",
    purpose: "Disaster recovery. Scheduled backups run via Convex crons.",
    configSteps: ["Navigate to Site → Backups.", "View automated backup history.", "Create a manual backup.", "Restore from any backup point."],
    clientCanChange: ["Nothing — Design-Locked™ (FSTS admin only)"],
    clientCannotChange: ["All backup and restore actions require FSTS super-admin access"],
    accessLevel: "superadmin",
    designLocked: true,
    featureFlag: "backups",
  },
  {
    key: "help",
    label: "Help Center",
    icon: LifeBuoy,
    section: "System",
    description: "Searchable help documentation embedded in the dashboard. Includes quick-start guides and contact links.",
    purpose: "Reduces inbound support requests by putting answers in context.",
    configSteps: ["No configuration required — always visible to all roles."],
    clientCanChange: ["Nothing — read-only documentation"],
    clientCannotChange: ["Help content — future: configurable per-agency help center URL"],
    accessLevel: "all",
  },
  {
    key: "permissions",
    label: "My Permissions",
    icon: ShieldCheck,
    section: "System",
    description: "Shows the current user's effective permissions across all modules for this site.",
    purpose: "Transparency for client users — they can see exactly what they can and cannot do.",
    configSteps: ["No configuration — auto-populates from role assignments and site overrides."],
    clientCanChange: ["Nothing — read-only view of their own permissions"],
    clientCannotChange: ["Permission levels — those are set by FSTS admins in Access Control"],
    accessLevel: "all",
  },
];

const SECTIONS = Array.from(new Set(MODULES.map((m) => m.section)));

function ModuleCard({ mod }: { mod: ModuleDoc }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = mod.icon;

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">{mod.label}</span>
            <Badge className={`text-[10px] border ${ACCESS_COLORS[mod.accessLevel]}`}>
              {ACCESS_LABELS[mod.accessLevel]}
            </Badge>
            {mod.designLocked && (
              <Badge className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                Design-Locked™
              </Badge>
            )}
            {mod.featureFlag && (
              <Badge className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200">
                flag: {mod.featureFlag}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{mod.description}</p>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50 space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Purpose</p>
            <p className="text-slate-700">{mod.purpose}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Configuration Steps</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              {mod.configSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">✓ Client Can Change</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {mod.clientCanChange.map((s, i) => <li key={i} className="text-xs">{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">✗ Client Cannot Change</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {mod.clientCannotChange.map((s, i) => <li key={i} className="text-xs">{s}</li>)}
              </ul>
            </div>
          </div>

          {mod.notes && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <strong>Note:</strong> {mod.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Maintenance — Purge legacy base64 media
// ---------------------------------------------------------------------------

type PurgeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; deleted: number }
  | { status: "error"; message: string };

function PurgeBase64MediaPanel() {
  const sites = useQuery(api.sites.list);
  const migrateDeleteDataUrls = useMutation(api.media.migrateDeleteDataUrls);
  const [states, setStates] = useState<Record<string, PurgeState>>({});

  async function runPurge(siteId: Id<"sites">) {
    setStates((prev) => ({ ...prev, [siteId]: { status: "running" } }));
    try {
      const result = await migrateDeleteDataUrls({ siteId });
      setStates((prev) => ({ ...prev, [siteId]: { status: "done", deleted: result.deleted } }));
    } catch (err: any) {
      setStates((prev) => ({ ...prev, [siteId]: { status: "error", message: err.message ?? "Unknown error" } }));
    }
  }

  if (!sites) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sites.map((site: any) => {
        const state: PurgeState = states[site._id] ?? { status: "idle" };
        return (
          <div
            key={site._id}
            className="flex items-center justify-between gap-4 border border-slate-200 rounded-md px-4 py-3 bg-white"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{site.name}</p>
              <p className="text-xs text-slate-400">{site.slug}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {state.status === "done" && (
                <span className={`text-xs font-medium flex items-center gap-1 ${state.deleted > 0 ? "text-amber-600" : "text-green-600"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {state.deleted > 0 ? `${state.deleted} record${state.deleted !== 1 ? "s" : ""} purged` : "No legacy records"}
                </span>
              )}
              {state.status === "error" && (
                <span className="text-xs text-red-500 truncate max-w-[200px]" title={state.message}>Error: {state.message}</span>
              )}
              <Button
                size="sm"
                variant={state.status === "done" ? "outline" : "destructive"}
                className="text-xs"
                disabled={state.status === "running"}
                onClick={() => runPurge(site._id)}
              >
                {state.status === "running" ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Running…</>
                ) : state.status === "done" ? (
                  <><Trash2 className="h-3.5 w-3.5 mr-1" />Run again</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5 mr-1" />Purge base64 media</>
                )}
              </Button>
            </div>
          </div>
        );
      })}
      {sites.length === 0 && (
        <p className="text-sm text-slate-400 py-4 text-center">No sites found.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function AdminPlatformRunbook() {
  const me = useQuery(api.users.me);
  const [searchQuery, setSearchQuery] = useState("");

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  const query = searchQuery.toLowerCase();
  const filtered = MODULES.filter(
    (m) =>
      !query ||
      m.label.toLowerCase().includes(query) ||
      m.description.toLowerCase().includes(query) ||
      m.section.toLowerCase().includes(query) ||
      (m.featureFlag ?? "").includes(query),
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/app">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sites
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Runbook</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">
          Internal documentation for FSTS team members — module purposes, configuration steps, and client permission boundaries.
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white border border-slate-200 rounded-md p-4 mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Access Level Legend</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCESS_COLORS) as AccessLevel[]).map((level) => (
            <Badge key={level} className={`text-xs border ${ACCESS_COLORS[level]}`}>{ACCESS_LABELS[level]}</Badge>
          ))}
          <Badge className="text-xs bg-amber-50 text-amber-700 border border-amber-200">Design-Locked™ = FSTS admin changes only</Badge>
          <Badge className="text-xs bg-violet-50 text-violet-700 border border-violet-200">flag: X = enabled/disabled by site module key</Badge>
        </div>
      </div>

      {/* Product Boundary Callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-6 text-sm text-blue-800">
        <strong>Product Boundary:</strong> TAYA™ manages website operations only. Features that act on customers or leads
        (customer outreach, active review workflows, appointment management, lead intelligence, advanced ecommerce)
        belong in <strong>Operon CRM™</strong>, connected exclusively via the <strong>Operon Connector™</strong>.
        See <code className="font-mono text-xs bg-blue-100 px-1 rounded">docs/product-boundaries.md</code> for the full spec.
      </div>

      {/* Maintenance Actions */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Maintenance Actions</p>
            <p className="text-xs text-slate-500">One-time and idempotent data cleanup tools. Safe to run multiple times.</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-800 mb-1 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-slate-400" />
              Purge legacy base64 media
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Removes <code className="font-mono bg-slate-100 px-1 rounded">data:</code> URL records from a site's media library.
              These were created before Convex File Storage was adopted and cannot be served as real CDN links.
              Records with a <code className="font-mono bg-slate-100 px-1 rounded">storageId</code> or a real <code className="font-mono bg-slate-100 px-1 rounded">https://</code> URL are never touched.
              Run this for every site before Website #1 onboarding.
            </p>
            <PurgeBase64MediaPanel />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800 mb-1 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-slate-400" />
              Improvement Roadmap PDF
            </p>
            <p className="text-xs text-slate-500 mb-3">
              The roadmap PDF is generated from{" "}
              <code className="font-mono bg-slate-100 px-1 rounded">scripts/roadmap-data.json</code> and is
              automatically regenerated on every post-merge run — no manual step required when improvements
              are added or updated. Download the latest version below.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="/fsts-dashboard-roadmap.pdf"
                download="FSTS-Improvement-Roadmap.pdf"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/30 hover:border-primary/60 rounded-md px-3 py-2 bg-primary/5 hover:bg-primary/10 no-underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download Current Roadmap PDF
              </a>
              <span className="text-xs text-slate-400">
                Regenerates automatically after every merge via{" "}
                <code className="font-mono bg-slate-100 px-1 rounded">scripts/post-merge.sh</code>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search modules…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Modules by section */}
      {SECTIONS.map((section) => {
        const sectionMods = filtered.filter((m) => m.section === section);
        if (sectionMods.length === 0) return null;
        return (
          <div key={section} className="mb-8">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">{section}</h2>
            <div className="space-y-2">
              {sectionMods.map((mod) => <ModuleCard key={mod.key} mod={mod} />)}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No modules match "<strong>{searchQuery}</strong>".
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-400">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p>TAYA System™ — Internal Platform Runbook</p>
            <p className="mt-1">This document is for FSTS team members only. Do not share with clients.</p>
          </div>
          <a
            href="/fsts-dashboard-roadmap.pdf"
            download="FSTS-Improvement-Roadmap.pdf"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/30 hover:border-primary/60 rounded-md px-3 py-1.5 bg-primary/5 hover:bg-primary/10 no-underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download Improvement Roadmap PDF
          </a>
        </div>
      </div>
    </div>
  );
}
