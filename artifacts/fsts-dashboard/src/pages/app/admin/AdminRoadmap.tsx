/**
 * AdminRoadmap — Interactive FSTS Improvement Roadmap
 *
 * Lets FSTS staff browse improvements by wave, filter by priority / category /
 * tag / status, and track milestone progress — without opening the PDF.
 * The PDF download button is retained for offline reference.
 *
 * Data is sourced from the same CATEGORIES / WAVES constants that power
 * scripts/generate-roadmap-pdf.mjs. Keep the two files in sync when adding
 * or changing roadmap items.
 */

import { useState, useMemo } from "react";
import { Redirect } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ArrowLeft,
  Filter,
  X,
  Target,
} from "lucide-react";
import { Link } from "wouter";

// ---------------------------------------------------------------------------
// Data — mirrors scripts/generate-roadmap-pdf.mjs exactly
// ---------------------------------------------------------------------------

type Priority = "P0" | "P1" | "P2" | "P3";
type TaskStatus = "PROPOSED" | "ACTIVE" | "DONE";

interface RoadmapItem {
  id: number;
  wave: number;
  priority: Priority;
  tags: string[];
  what: string;
  why: string;
}

interface Category {
  id: string;
  title: string;
  color: string;
  lightColor: string;
  borderColor: string;
  items: RoadmapItem[];
}

interface Wave {
  num: number;
  title: string;
  description: string;
  color: string;
  lightColor: string;
  milestone: string | null;
}

const CATEGORIES: Category[] = [
  {
    id: "user-mgmt",
    title: "User Management & Access Control",
    color: "#6366f1",
    lightColor: "#eef2ff",
    borderColor: "#a5b4fc",
    items: [
      { id: 11, wave: 2, priority: "P1", tags: ["Client UX", "Security"],
        what: "Let admins manually unlock a locked portal user account",
        why: "Admins can unblock users without developer intervention, reducing support delays." },
      { id: 12, wave: 2, priority: "P1", tags: ["Security", "Reliability"],
        what: "Stop other user management pages from leaking the full site list",
        why: "Prevents unauthorized data exposure by scoping site lists to the correct context." },
      { id: 13, wave: 2, priority: "P2", tags: ["Reliability", "Technical debt"],
        what: "Confirm portal lockout and password flow can't be broken by a future change",
        why: "Guards against regressions that could lock users out permanently." },
      { id: 144, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm addSiteRole stays blocked even if superadmin status is set after roles already exist",
        why: "Closes a privilege escalation window where late-granted superadmin could bypass role guards." },
      { id: 145, wave: 2, priority: "P1", tags: ["Security", "Reliability"],
        what: "Catch a superadmin partial update silently wiping roles on any site owner",
        why: "Prevents accidental data loss that could lock site owners out of their own accounts." },
      { id: 146, wave: 2, priority: "P1", tags: ["Security", "Reliability"],
        what: "Confirm role changes made through users.update are always recorded in the activity log",
        why: "Full audit trail for every permission change so admins can trace who changed what and when." },
      { id: 181, wave: 1, priority: "P1", tags: ["Security"],
        what: "Catch a stale legacy role grant the moment a permission is renamed or removed",
        why: "Prevents ghost permissions that outlive their intended purpose from accumulating over time." },
      { id: 187, wave: 3, priority: "P2", tags: ["Client UX", "Automation"],
        what: "Let site owners invite dashboard users directly from their site — without needing a super admin",
        why: "Eliminates the bottleneck of requiring FSTS staff involvement for every user invitation." },
    ],
  },
  {
    id: "permissions",
    title: "Permissions & Route Security",
    color: "#dc2626",
    lightColor: "#fef2f2",
    borderColor: "#fca5a5",
    items: [
      { id: 85, wave: 1, priority: "P0", tags: ["Security"],
        what: "Make the guard check smart enough to catch null checks that don't show an access-denied message",
        why: "Ensures users always see a clear 'access denied' message instead of a confusing blank screen." },
      { id: 86, wave: 1, priority: "P0", tags: ["Security", "Infrastructure"],
        what: "Extend the access-denied guard requirement to any new route category added outside the sites folder",
        why: "Future-proofs the app so new routes automatically inherit the correct access-denied behavior." },
      { id: 159, wave: 1, priority: "P0", tags: ["Security"],
        what: "Confirm write-path guards work for CRM, forms, and media modules too",
        why: "Closes gaps where CRM or media write operations could bypass module-access checks." },
      { id: 164, wave: 1, priority: "P0", tags: ["Security"],
        what: "Confirm a client-role user is automatically blocked from every design-locked route",
        why: "Enforces the client permission boundary so clients can't reach admin-only design tools." },
      { id: 171, wave: 1, priority: "P0", tags: ["Security"],
        what: "Confirm the Footer, Email, CRM, and Payments pages can't be unlocked by a client user",
        why: "Hardens the client boundary on critical business and payment configuration pages." },
      { id: 172, wave: 1, priority: "P0", tags: ["Security"],
        what: "Catch a client user bypassing the navigation update and delete guards too",
        why: "Ensures mutation guards on nav items cover all roles, not just the read-path checks." },
      { id: 184, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm the module-access grid for site users also covers every role",
        why: "Guarantees no role is accidentally excluded from the module-access matrix." },
      { id: 185, wave: 2, priority: "P1", tags: ["Security", "Infrastructure"],
        what: "Confirm the module-access matrix stays complete when a dashboard module is added or removed",
        why: "Prevents new modules from launching without any permission boundaries set." },
      { id: 186, wave: 2, priority: "P1", tags: ["Client UX", "Security"],
        what: "Confirm the permissions preview always matches the role actually being saved",
        why: "Admins see exactly what they're granting before they save — no surprise permission gaps." },
    ],
  },
  {
    id: "media",
    title: "Media & Images",
    color: "#0891b2",
    lightColor: "#ecfeff",
    borderColor: "#67e8f9",
    items: [
      { id: 14, wave: 1, priority: "P0", tags: ["Client UX", "Revenue"],
        what: "Let clients actually use their uploaded images across their whole site",
        why: "Unlocks the media library as a shared asset pool, so clients get full value from every upload." },
      { id: 15, wave: 1, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Prevent broken images when a media asset is deleted that's still in use",
        why: "Eliminates embarrassing broken-image placeholders on client-facing websites." },
      { id: 16, wave: 2, priority: "P2", tags: ["Technical debt", "Infrastructure"],
        what: "Clean up legacy base64 images already in clients' media libraries",
        why: "Reduces database size and speeds up media library load times across all client sites." },
      { id: 44, wave: 2, priority: "P2", tags: ["Reliability"],
        what: "Confirm the purge tool is safe to run when a site has thousands of records across multiple pages",
        why: "Prevents partial deletes that would leave orphaned records when running cleanup at scale." },
      { id: 45, wave: 3, priority: "P2", tags: ["Client UX", "Automation"],
        what: "Let clients fix broken images directly from the nav badge — not just see the count",
        why: "Turns the broken-image badge into an actionable fix flow instead of a passive warning." },
      { id: 80, wave: 4, priority: "P3", tags: ["Client UX"],
        what: "Verify the image editor is keyboard-navigable and screen-reader friendly",
        why: "Makes the image editor accessible to users who rely on keyboards or assistive technology." },
      { id: 81, wave: 1, priority: "P1", tags: ["Client UX", "Automation"],
        what: "Auto-generate alt text when images are uploaded so clients never have empty alt text",
        why: "Improves SEO and accessibility on every client website automatically, with zero extra effort from clients." },
      { id: 82, wave: 1, priority: "P1", tags: ["Reliability"],
        what: "Confirm image picker flows work end-to-end in a real browser across every module",
        why: "Catches browser-specific picker bugs before clients encounter them on live sites." },
    ],
  },
  {
    id: "email",
    title: "Email & Notifications",
    color: "#16a34a",
    lightColor: "#f0fdf4",
    borderColor: "#86efac",
    items: [
      { id: 21, wave: 1, priority: "P0", tags: ["Client UX", "Reliability"],
        what: "Make failed welcome email deliveries visible so admins know when a new registrant didn't get their email",
        why: "Admins can proactively follow up instead of discovering the issue after a registrant complains." },
      { id: 22, wave: 1, priority: "P1", tags: ["Reliability", "Client UX"],
        what: "Warn admins when the lead alert recipient address looks wrong or bounces",
        why: "Catches misconfigured alert emails before real leads go unnoticed." },
      { id: 23, wave: 1, priority: "P1", tags: ["Client UX", "Automation"],
        what: "Let admins send a test lead alert to confirm their notification email is working",
        why: "One-click confidence check so admins know leads are flowing to the right inbox." },
      { id: 26, wave: 1, priority: "P1", tags: ["Technical debt", "Reliability"],
        what: "Fix broken tests in the email suite that are silently hiding regressions",
        why: "Restores reliable CI feedback so email bugs are caught before they reach production." },
      { id: 27, wave: 1, priority: "P1", tags: ["Reliability"],
        what: "Confirm the notification email override reaches the right address end-to-end",
        why: "Guarantees the override setting actually redirects emails — not just stores the address." },
      { id: 65, wave: 1, priority: "P0", tags: ["Client UX", "Automation"],
        what: "Let admins configure their Resend API key from the Email Config page — not the Convex dashboard",
        why: "Removes a technical barrier that currently requires developer access to configure email." },
      { id: 66, wave: 1, priority: "P0", tags: ["Reliability", "Client UX"],
        what: "Confirm a real email reaches the right inbox once Resend is configured for the first client",
        why: "End-to-end proof that the Resend integration actually delivers before clients go live." },
      { id: 141, wave: 1, priority: "P1", tags: ["Reliability"],
        what: "Confirm the welcome email fires when a new user is created — and only then",
        why: "Prevents duplicate welcome emails from confusing new users during re-invites or re-seeding." },
      { id: 142, wave: 3, priority: "P2", tags: ["Client UX", "Automation"],
        what: "Let admins re-send the welcome email to a pending user who hasn't signed in yet",
        why: "Admins can help users who lost their welcome email without creating a new account." },
      { id: 143, wave: 1, priority: "P1", tags: ["Reliability"],
        what: "Make sure welcome emails link to the correct dashboard URL after deployment",
        why: "New users land on the right domain — not a broken or dev preview link." },
      { id: 202, wave: 1, priority: "P0", tags: ["Revenue", "Reliability"],
        what: "Alert admins the moment a paid order confirmation email permanently fails to deliver",
        why: "Paid customers always know their order went through — failed emails surface immediately." },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding & Site Setup",
    color: "#d97706",
    lightColor: "#fffbeb",
    borderColor: "#fcd34d",
    items: [
      { id: 72, wave: 2, priority: "P1", tags: ["Automation", "Client UX"],
        what: "Add an onboarding wizard so admins can seed a new client without touching the CLI",
        why: "Non-technical staff can onboard new clients end-to-end through the dashboard UI." },
      { id: 73, wave: 2, priority: "P1", tags: ["Reliability", "Security"],
        what: "Confirm the seeder runs end-to-end for a second site without corrupting the first",
        why: "Verifies multi-site isolation so onboarding a second client never affects existing data." },
      { id: 90, wave: 2, priority: "P1", tags: ["Reliability"],
        what: "Make sure a second launch on the same session can't silently create a duplicate site",
        why: "Prevents orphaned duplicate site records from confusing admins and fragmenting data." },
      { id: 91, wave: 2, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Confirm the temp domain is assigned to the site record when the client picks a temporary URL",
        why: "New clients can immediately preview their site at the expected URL after onboarding." },
      { id: 93, wave: 2, priority: "P2", tags: ["Client UX"],
        what: "Seed placeholder services when onboarding creates a site with services enabled",
        why: "New sites launch with example content rather than an empty, confusing services section." },
      { id: 110, wave: 4, priority: "P3", tags: ["Client UX"],
        what: "Remember that the getting-started nudge was dismissed so it doesn't reappear on every visit",
        why: "Eliminates a repetitive UI annoyance that makes the dashboard feel unpolished." },
      { id: 111, wave: 4, priority: "P3", tags: ["Client UX"],
        what: "Confirm the placeholder nudge banner shows and disappears at the right times",
        why: "Makes the onboarding experience feel intentional — guides new users, then gets out of the way." },
      { id: 192, wave: 2, priority: "P2", tags: ["Infrastructure", "Technical debt"],
        what: "Add a CONTRIBUTING guide so new contributors always commit with the right identity",
        why: "Prevents messy commit history and identity-check failures from new team members." },
    ],
  },
  {
    id: "products",
    title: "Products & Commerce",
    color: "#7c3aed",
    lightColor: "#f5f3ff",
    borderColor: "#c4b5fd",
    items: [
      { id: 107, wave: 3, priority: "P2", tags: ["Client UX", "Revenue"],
        what: "Let visitors see which product categories exist before filtering",
        why: "Visitors can browse categories without guessing what's available, boosting discoverability." },
      { id: 108, wave: 2, priority: "P1", tags: ["Reliability"],
        what: "Make sure filtering products by category can't silently return wrong results",
        why: "Prevents clients from unknowingly showing incorrect product sets to customers." },
      { id: 109, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm disabled-module sites can't have their products scraped via the public endpoint",
        why: "Protects product data from sites that haven't purchased the commerce module." },
      { id: 112, wave: 2, priority: "P1", tags: ["Reliability", "Technical debt"],
        what: "Catch a future refactor that breaks the products list endpoint's visibility filter",
        why: "Automated check that draft/hidden products can never leak to the public storefront." },
      { id: 114, wave: 2, priority: "P2", tags: ["Client UX"],
        what: "Confirm seeded product titles always carry the client's business name",
        why: "Demo products feel branded from day one, giving clients a realistic preview of their store." },
      { id: 118, wave: 2, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Confirm featured products can't appear in the featured spotlight if they're still hidden",
        why: "Prevents draft products from accidentally appearing in premium homepage real estate." },
      { id: 123, wave: 2, priority: "P1", tags: ["Reliability"],
        what: "Prevent two products from sharing the same slug on the same site",
        why: "Eliminates broken product URLs caused by slug collisions that route to the wrong item." },
      { id: 169, wave: 3, priority: "P2", tags: ["Client UX", "Revenue"],
        what: "Make sure client admins can manage their Square discounts without needing FSTS staff help",
        why: "Clients can run promotions independently, removing a support dependency on FSTS staff." },
    ],
  },
  {
    id: "payments",
    title: "Payments & Checkout",
    color: "#059669",
    lightColor: "#ecfdf5",
    borderColor: "#6ee7b7",
    items: [
      { id: 203, wave: 1, priority: "P0", tags: ["Revenue", "Reliability"],
        what: "Confirm Square payments still process correctly end-to-end after the idempotency changes",
        why: "Validates that the idempotency hardening didn't break the actual checkout flow for real customers." },
      { id: 204, wave: 1, priority: "P0", tags: ["Revenue", "Reliability", "Security"],
        what: "Harden the provider-agnostic payment webhook with the same idempotency and email-state guards",
        why: "Ensures future payment integrations can't double-charge customers or skip order confirmation emails." },
      { id: 206, wave: 1, priority: "P0", tags: ["Revenue", "Reliability"],
        what: "Block checkout when a course or event price is missing or corrupt so no broken order reaches Square",
        why: "Prevents $0 or malformed orders from reaching Square, protecting clients from disputes and chargebacks." },
    ],
  },
  {
    id: "courses",
    title: "Courses & Classes",
    color: "#ea580c",
    lightColor: "#fff7ed",
    borderColor: "#fdba74",
    items: [
      { id: 157, wave: 1, priority: "P1", tags: ["Security", "Reliability"],
        what: "Confirm courses stay hidden when the agency switches the module off platform-wide",
        why: "Module toggles work at the platform level — clients can't circumvent a module being disabled." },
      { id: 158, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm a disabled-module site can't be unlocked by a direct courses.get call",
        why: "API-level guard prevents clever URL manipulation from bypassing module restrictions." },
      { id: 189, wave: 1, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Confirm lifecycle alerts in the edit dialog always reflect live registration data",
        why: "Admins editing a class see accurate enrollment counts, not stale cached data." },
      { id: 193, wave: 1, priority: "P0", tags: ["Revenue", "Reliability"],
        what: "Make sure a client with a stale session can't register for a class that's already been cancelled",
        why: "Prevents ghost registrations where customers pay for a class that no longer exists." },
      { id: 194, wave: 1, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Catch a flyer that stays published after its linked class is deleted outright",
        why: "Orphaned flyers advertising deleted classes are automatically unpublished to avoid customer confusion." },
      { id: 195, wave: 1, priority: "P1", tags: ["Reliability", "Automation"],
        what: "Confirm the lifecycle clock is registered so tick can never be silently skipped",
        why: "Class status transitions (open → full → closed) happen on schedule rather than getting stuck." },
      { id: 207, wave: 3, priority: "P2", tags: ["Client UX", "Automation"],
        what: "Let admins fix a broken course link on an event from the warning banner — not just see it",
        why: "Turns a passive warning about broken course links into a one-click repair action." },
    ],
  },
  {
    id: "services",
    title: "Services",
    color: "#0284c7",
    lightColor: "#f0f9ff",
    borderColor: "#7dd3fc",
    items: [
      { id: 92, wave: 1, priority: "P0", tags: ["Client UX", "Reliability"],
        what: "Confirm services created in the dashboard actually appear on the public website",
        why: "Closes the gap where a service looks correct in the dashboard but never surfaces on the live site." },
      { id: 94, wave: 2, priority: "P1", tags: ["Reliability"],
        what: "Prevent two services from sharing the same slug on the same site",
        why: "Avoids URL collisions that cause the wrong service page to load for customers." },
      { id: 137, wave: 1, priority: "P1", tags: ["Client UX"],
        what: "Seed services data for Corsair so the live services section appears on the website",
        why: "Corsair's website displays a real services section immediately after seeding, no manual entry needed." },
    ],
  },
  {
    id: "flyers",
    title: "Flyers & Marketing",
    color: "#be185d",
    lightColor: "#fdf2f8",
    borderColor: "#f9a8d4",
    items: [
      { id: 167, wave: 3, priority: "P2", tags: ["Client UX", "Automation"],
        what: "Let clients duplicate an existing flyer instead of rebuilding from scratch",
        why: "Dramatically speeds up flyer creation for recurring events — clients copy and adjust instead of starting over." },
      { id: 168, wave: 3, priority: "P2", tags: ["Client UX", "Security"],
        what: "Confirm health notifications give a clear 'access denied' message to non-admin users",
        why: "Non-admin users get a clear boundary message instead of an unexplained error." },
    ],
  },
  {
    id: "sidebar",
    title: "Sidebar & Navigation",
    color: "#475569",
    lightColor: "#f8fafc",
    borderColor: "#cbd5e1",
    items: [
      { id: 176, wave: 4, priority: "P3", tags: ["Client UX"],
        what: "Add a Role Permissions link to the per-site sidebar so admins can reach it from inside a site",
        why: "Eliminates navigation friction — admins can jump directly to role settings from any site context." },
    ],
  },
  {
    id: "performance",
    title: "Performance & Build Quality",
    color: "#9333ea",
    lightColor: "#faf5ff",
    borderColor: "#d8b4fe",
    items: [
      { id: 54, wave: 4, priority: "P3", tags: ["Technical debt", "Infrastructure"],
        what: "Fix the circular vendor chunk warning so every production build is clean",
        why: "Clean builds with no warnings make it easier to spot real problems in CI output." },
      { id: 55, wave: 4, priority: "P3", tags: ["Client UX"],
        what: "Make page transitions feel instant by preloading chunks on hover",
        why: "Dashboard navigation feels snappier — chunks are ready before the user clicks." },
      { id: 83, wave: 4, priority: "P2", tags: ["Client UX"],
        what: "Extend loading-skeleton guards to the remaining dashboard pages not yet covered",
        why: "Eliminates blank-flash loading states on pages that currently show nothing while data loads." },
      { id: 84, wave: 2, priority: "P2", tags: ["Technical debt", "Reliability"],
        what: "Confirm a dropped skeleton guard shows up as a failing test — not a silent blank page",
        why: "Prevents future regressions where a missing skeleton silently degrades the loading experience." },
    ],
  },
  {
    id: "cms",
    title: "CMS & Live Data",
    color: "#0d9488",
    lightColor: "#f0fdfa",
    borderColor: "#5eead4",
    items: [
      { id: 135, wave: 1, priority: "P0", tags: ["Client UX", "Reliability"],
        what: "Confirm a price change in the dashboard actually updates the Corsair website within 60 seconds",
        why: "Clients can trust the dashboard price is what customers see — no manual cache purge needed." },
      { id: 136, wave: 1, priority: "P1", tags: ["Client UX", "Reliability"],
        what: "Extend live CMS data to the course detail pages so per-course pricing is also accurate",
        why: "Detail pages reflect real pricing, preventing customers from seeing stale rates." },
    ],
  },
  {
    id: "security-seeding",
    title: "Security & Seeding Safeguards",
    color: "#b91c1c",
    lightColor: "#fff1f2",
    borderColor: "#fca5a5",
    items: [
      { id: 129, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm the seed gate can't be bypassed if SEED_ALLOWED is set to 'false' or empty",
        why: "Prevents accidental data seeding on production environments from a misconfigured env var." },
      { id: 130, wave: 2, priority: "P1", tags: ["Security"],
        what: "Make sure the add-on catalog seed can't run on production even if someone sets SEED_ALLOWED by mistake",
        why: "Belt-and-suspenders protection against overwriting live add-on catalog data." },
      { id: 131, wave: 2, priority: "P1", tags: ["Security"],
        what: "Confirm visitors can't forge form submissions for a site they don't belong to",
        why: "Closes a cross-site form injection vector where a malicious visitor could pollute another site's CRM." },
    ],
  },
  {
    id: "infra",
    title: "Infrastructure & DevOps",
    color: "#1d4ed8",
    lightColor: "#eff6ff",
    borderColor: "#93c5fd",
    items: [
      { id: 20, wave: 1, priority: "P1", tags: ["Infrastructure"],
        what: "Make sure Vercel deploys cleanly against the rewritten commit history",
        why: "Unblocks deployments that were failing because of the history rewrite required for identity cleanup." },
      { id: 30, wave: 2, priority: "P2", tags: ["Infrastructure", "Reliability"],
        what: "Make the client-website E2E suite actually run in CI against a deployed site",
        why: "Catches client-facing website regressions in CI instead of after a client reports them." },
      { id: 58, wave: 2, priority: "P2", tags: ["Infrastructure", "Technical debt"],
        what: "Make sure the workspace branch can't silently drift ahead of origin/main again",
        why: "Prevents the confusing scenario where local and remote history diverge without warning." },
      { id: 61, wave: 1, priority: "P1", tags: ["Infrastructure", "Client UX"],
        what: "Confirm www.fstsclientsystem.com actually redirects once the Vercel alias is added",
        why: "Clients can reach the dashboard at the canonical www address — not just the bare domain." },
      { id: 62, wave: 2, priority: "P1", tags: ["Infrastructure", "Security"],
        what: "Turn on the branch protection rule so the identity check can't be bypassed on GitHub",
        why: "Enforces commit identity standards at the repository level — no accidental bypass via direct push." },
      { id: 211, wave: 1, priority: "P0", tags: ["Client UX", "Infrastructure"],
        what: "Confirm clients can actually sign in once the Cloudflare DNS fix is applied",
        why: "Verifies the DNS fix resolves the sign-in issue for clients on all networks." },
    ],
  },
];

const WAVES: Wave[] = [
  {
    num: 1,
    title: "Wave 1 — Corsair Critical",
    description: "Security, payments, authentication, email, live CMS, class/event correctness",
    color: "#dc2626",
    lightColor: "#fef2f2",
    milestone: "Milestone: Corsair First-Site Production Completion",
  },
  {
    num: 2,
    title: "Wave 2 — Website #2 Readiness",
    description: "Multi-tenant safeguards, onboarding reliability, reusable seeding, permissions, CI/E2E",
    color: "#d97706",
    lightColor: "#fffbeb",
    milestone: "Milestone: Website #2 Ready",
  },
  {
    num: 3,
    title: "Wave 3 — Client Self-Service",
    description: "Reduce FSTS manual support requirements",
    color: "#7c3aed",
    lightColor: "#f5f3ff",
    milestone: null,
  },
  {
    num: 4,
    title: "Wave 4 — UX & Performance",
    description: "Loading states, navigation speed, accessibility, dashboard polish",
    color: "#0891b2",
    lightColor: "#ecfeff",
    milestone: null,
  },
  {
    num: 5,
    title: "Wave 5 — Growth & Enhancement",
    description: "Marketing, commerce, advanced automation, and non-blocking improvements",
    color: "#16a34a",
    lightColor: "#f0fdf4",
    milestone: null,
  },
];

// ---------------------------------------------------------------------------
// Task-status snapshot (updated as tasks progress)
// All items default to PROPOSED unless listed here.
// ---------------------------------------------------------------------------
const TASK_STATUS_OVERRIDES: Record<number, TaskStatus> = {
  // Add overrides here as tasks move to ACTIVE or DONE, e.g.:
  // 85: "ACTIVE",
  // 172: "DONE",
};

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

const ALL_ITEMS = CATEGORIES.flatMap((c) =>
  c.items.map((i) => ({ ...i, categoryId: c.id, categoryTitle: c.title, categoryColor: c.color }))
);

const ALL_TAGS = Array.from(new Set(ALL_ITEMS.flatMap((i) => i.tags))).sort();

function getStatus(id: number): TaskStatus {
  return TASK_STATUS_OVERRIDES[id] ?? "PROPOSED";
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<Priority, { badge: string; dot: string; label: string }> = {
  P0: { badge: "bg-red-50 text-red-700 border-red-200",    dot: "bg-red-500",    label: "P0 Critical" },
  P1: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", label: "P1 Required" },
  P2: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500",   label: "P2 Important" },
  P3: { badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-600", label: "P3 Enhancement" },
};

const STATUS_STYLES: Record<TaskStatus, { badge: string; label: string }> = {
  PROPOSED: { badge: "bg-slate-100 text-slate-600 border-slate-200", label: "Proposed" },
  ACTIVE:   { badge: "bg-blue-100 text-blue-700 border-blue-200",    label: "Active" },
  DONE:     { badge: "bg-green-100 text-green-700 border-green-200", label: "Done" },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ItemRow({ item, categoryColor }: { item: RoadmapItem; categoryColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const status = getStatus(item.id);
  const priorityStyle = PRIORITY_STYLES[item.priority];
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        {/* ID chip */}
        <span
          className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-6 min-w-[2.25rem] rounded text-[11px] font-mono font-semibold text-white px-1.5"
          style={{ backgroundColor: categoryColor }}
        >
          #{item.id}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Badge className={`text-[10px] border px-1.5 py-0 ${priorityStyle.badge}`}>
              {priorityStyle.label}
            </Badge>
            <Badge className={`text-[10px] border px-1.5 py-0 ${statusStyle.badge}`}>
              {statusStyle.label}
            </Badge>
            {item.tags.map((tag) => (
              <Badge key={tag} className="text-[10px] border bg-slate-50 text-slate-500 border-slate-200 px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-900 font-medium leading-snug">{item.what}</p>
        </div>

        <div className="flex-shrink-0 mt-0.5">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Why it matters</p>
          <p className="text-sm text-slate-700">{item.why}</p>
        </div>
      )}
    </div>
  );
}

function CategoryGroup({
  category,
  items,
}: {
  category: Category;
  items: RoadmapItem[];
}) {
  const [open, setOpen] = useState(true);

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-left mb-1"
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-sm font-semibold text-slate-700 flex-1">{category.title}</span>
        <span className="text-xs text-slate-400">{items.length}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-1.5 pl-4">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} categoryColor={category.color} />
          ))}
        </div>
      )}
    </div>
  );
}

function WaveSection({
  wave,
  filteredItems,
  allWaveItems,
  defaultOpen,
}: {
  wave: Wave;
  filteredItems: (RoadmapItem & { categoryId: string; categoryTitle: string; categoryColor: string })[];
  allWaveItems: (RoadmapItem & { categoryId: string; categoryTitle: string; categoryColor: string })[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const doneCount = allWaveItems.filter((i) => getStatus(i.id) === "DONE").length;
  const activeCount = allWaveItems.filter((i) => getStatus(i.id) === "ACTIVE").length;
  const pct = allWaveItems.length > 0 ? Math.round((doneCount / allWaveItems.length) * 100) : 0;

  // Group filtered items by category, preserving category order
  const categoriesInWave = CATEGORIES.filter((c) =>
    filteredItems.some((i) => i.categoryId === c.id)
  );

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
      {/* Wave header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
        style={{ backgroundColor: wave.lightColor }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold" style={{ color: wave.color }}>
              {wave.title}
            </span>
            {wave.milestone && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ borderColor: wave.color, color: wave.color, backgroundColor: "#fff" }}
              >
                <Target className="h-3 w-3" />
                {wave.milestone}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{wave.description}</p>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: wave.color }}
              />
            </div>
            <span className="text-[11px] text-slate-500 flex-shrink-0">
              {doneCount}/{allWaveItems.length} done
              {activeCount > 0 && ` · ${activeCount} active`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <span className="text-xs text-slate-500">{filteredItems.length} shown</span>
          {open
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Wave body */}
      {open && (
        <div className="px-5 py-4 bg-white">
          {filteredItems.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No items match the current filters.</p>
          ) : (
            categoriesInWave.map((cat) => (
              <CategoryGroup
                key={cat.id}
                category={cat}
                items={filteredItems.filter((i) => i.categoryId === cat.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneProgressBar({
  label,
  waveNum,
  color,
}: {
  label: string;
  waveNum: number;
  color: string;
}) {
  const items = ALL_ITEMS.filter((i) => i.wave === waveNum);
  const done = items.filter((i) => getStatus(i.id) === "DONE").length;
  const active = items.filter((i) => getStatus(i.id) === "ACTIVE").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const p0Items = items.filter((i) => i.priority === "P0");
  const p0Done = p0Items.filter((i) => getStatus(i.id) === "DONE").length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {done} of {total} complete · {active} active
          </p>
        </div>
        <span className="text-2xl font-bold flex-shrink-0" style={{ color }}>{pct}%</span>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <p className="text-xs text-slate-500">
        P0 Critical: {p0Done}/{p0Items.length} done
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminRoadmap() {
  const me = useQuery(api.users.me);

  // Filters
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Loading
  if (me === undefined) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!me || !me.isSuperAdmin) {
    return <Redirect to="/app" />;
  }

  const toggleFilter = <T extends string>(
    list: T[],
    setList: React.Dispatch<React.SetStateAction<T[]>>,
    value: T
  ) => {
    setList((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const clearFilters = () => {
    setSelectedPriorities([]);
    setSelectedCategories([]);
    setSelectedTags([]);
    setSelectedStatuses([]);
    setSearchQuery("");
  };

  const hasFilters =
    selectedPriorities.length > 0 ||
    selectedCategories.length > 0 ||
    selectedTags.length > 0 ||
    selectedStatuses.length > 0 ||
    searchQuery.trim() !== "";

  const filteredByWave = (waveNum: number) => {
    return ALL_ITEMS.filter((item) => {
      if (item.wave !== waveNum) return false;
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(item.priority)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.categoryId)) return false;
      if (selectedTags.length > 0 && !item.tags.some((t) => selectedTags.includes(t))) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(getStatus(item.id))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !item.what.toLowerCase().includes(q) &&
          !item.why.toLowerCase().includes(q) &&
          !String(item.id).includes(q)
        ) return false;
      }
      return true;
    });
  };

  const allWaveItems = (waveNum: number) => ALL_ITEMS.filter((i) => i.wave === waveNum);

  const totalShown = WAVES.reduce((sum, w) => sum + filteredByWave(w.num).length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/app/admin/runbook">
              <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-3.5 w-3.5" />
                Platform Runbook
              </button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Improvement Roadmap</h1>
          <p className="text-sm text-slate-500 mt-1">
            {ALL_ITEMS.length} improvements across {WAVES.length} waves · FSTS internal
          </p>
        </div>
        <a
          href="/fsts-dashboard-roadmap.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </a>
      </div>

      {/* Milestone progress bars */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <MilestoneProgressBar
          label="Corsair Critical (Wave 1)"
          waveNum={1}
          color="#dc2626"
        />
        <MilestoneProgressBar
          label="Website #2 Ready (Wave 2)"
          waveNum={2}
          color="#d97706"
        />
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search by ID, description, or reason…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="space-y-2.5">
          {/* Priority */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Priority</p>
            <div className="flex flex-wrap gap-1.5">
              {(["P0", "P1", "P2", "P3"] as Priority[]).map((p) => {
                const s = PRIORITY_STYLES[p];
                const active = selectedPriorities.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggleFilter(selectedPriorities, setSelectedPriorities, p)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      active ? s.badge : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(["PROPOSED", "ACTIVE", "DONE"] as TaskStatus[]).map((s) => {
                const style = STATUS_STYLES[s];
                const active = selectedStatuses.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleFilter(selectedStatuses, setSelectedStatuses, s)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      active ? style.badge : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = selectedCategories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleFilter(selectedCategories, setSelectedCategories, c.id)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      active
                        ? "text-white border-transparent"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                    style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: active ? "white" : c.color }}
                    />
                    {c.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleFilter(selectedTags, setSelectedTags, tag)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      active
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {hasFilters && (
          <p className="mt-3 text-xs text-slate-400">
            Showing {totalShown} of {ALL_ITEMS.length} items
          </p>
        )}
      </div>

      {/* Wave sections */}
      {WAVES.map((wave, idx) => (
        <WaveSection
          key={wave.num}
          wave={wave}
          filteredItems={filteredByWave(wave.num)}
          allWaveItems={allWaveItems(wave.num)}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
}
