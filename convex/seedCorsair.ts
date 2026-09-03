/**
 * Corsair Tactical Solutions — Onboarding Data Seeder
 *
 * ─── REFERENCE EXAMPLE — DO NOT MODIFY ──────────────────────────────────────
 * This file is the original Corsair-specific seeder written during the
 * Website #1 onboarding walkthrough. It is preserved as a concrete reference
 * so you can see what real seeded data looks like.
 *
 * For NEW client onboardings, do NOT copy-paste and edit this file.
 * Instead, use the parameterized seeder:
 *
 *   convex/seedClient.ts        ← generic seeder that accepts any config
 *   docs/CLIENT_SEED_CONFIG_TEMPLATE.json  ← Corsair's data as a copyable template
 *
 * Usage for a new client:
 *   1. Copy docs/CLIENT_SEED_CONFIG_TEMPLATE.json → docs/<client-slug>-seed-config.json
 *   2. Replace all values with the new client's data.
 *   3. Run:  npx convex run seedClient:seedClientSite '{
 *              "siteId": "<convex-site-id>",
 *              "config": <paste JSON here>
 *            }'
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Internal-only mutations called via `npx convex run` during the Website #1
 * onboarding walkthrough. These bypass the user-auth wrapper so the admin
 * can seed realistic content without needing a live Clerk session in the
 * automation context.
 *
 * IMPORTANT: These are `internalMutation` / `internalAction` — they can
 * NEVER be called from the browser client. They do not weaken the security
 * model of the dashboard.
 */

import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc" as const; // Production Corsair site (canonical — uncommon-cobra-336)

// ─── Step 1: Branding + Site Settings ─────────────────────────────────────────

export const seedBranding = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    // 1a. Update the sites record (legacy branding fields used by some views)
    await ctx.db.patch(siteId, {
      logoUrl: "https://storage.googleapis.com/corsair-tactical/logo-white.png",
      faviconUrl: "https://storage.googleapis.com/corsair-tactical/favicon.ico",
      brandColorPrimary: "#1A3A52",
      brandColorSecondary: "#C41E3A",
    });

    // 1b. Upsert siteSettings with full identity + branding
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const identityData = {
      siteId,
      businessName: "Corsair Tactical Solutions",
      tagline: "Professional Security Services & Security Training in Texas",
      logoUrl: "https://storage.googleapis.com/corsair-tactical/logo-white.png",
      faviconUrl: "https://storage.googleapis.com/corsair-tactical/favicon.ico",
      websiteType: "security_services",
      timezone: "America/Chicago",
      brandColorPrimary: "#1A3A52",
      brandColorSecondary: "#0f172a",
      brandColorAccent: "#C41E3A",
      fontHeading: "Inter",
      fontBody: "Inter",
      phone: "+1 (555) 847-2200",
      email: "corsairtacticalsolutions@gmail.com",
      address: "1247 Tactical Way, Suite 100, Quantico, VA 22134",
      identityUpdatedAt: Date.now(),
      brandingUpdatedAt: Date.now(),
      contactUpdatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, identityData);
    } else {
      await ctx.db.insert("siteSettings", identityData);
    }

    return { ok: true, step: "branding" };
  },
});

// ─── Step 2: Homepage Content ──────────────────────────────────────────────────

export const seedHomepage = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("homepageContent")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const heroData = {
      heroHeadline: "Professional Security Services Across All 50 States",
      heroSubheadline:
        "Corsair Tactical Solutions provides professional security services, armed protective services, private investigations, and state-certified security training nationwide. Veteran-owned. Licensed & Insured.",
      heroImageUrl: "https://storage.googleapis.com/corsair-tactical/hero-range.jpg",
      sections: [
        {
          type: "features",
          headline: "Why Train With Corsair?",
          items: [
            {
              icon: "shield",
              title: "Experienced, Certified Instructor",
              body: "Veteran-owned and operated. Texas DPS-certified with deep experience in firearms instruction, security training, and LTC certification.",
            },
            {
              icon: "target",
              title: "Texas LTC Experts",
              body: "Specialising in Texas License to Carry certification, DPS security officer training, and private firearms instruction for all skill levels.",
            },
            {
              icon: "users",
              title: "500+ Students Trained",
              body: "North Texas's trusted training partner — 5.0 average rating from students. Real-world, practical instruction every time.",
            },
          ],
        },
      ],
    };

    if (existing) {
      await ctx.db.patch(existing._id, heroData);
    } else {
      await ctx.db.insert("homepageContent", { siteId, ...heroData });
    }

    return { ok: true, step: "homepage" };
  },
});

// ─── Step 3: Navigation ────────────────────────────────────────────────────────

export const seedNavigation = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    // Remove any existing nav items first (idempotent)
    const existing = await ctx.db
      .query("navigationItems")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const item of existing) await ctx.db.delete(item._id);

    const navItems = [
      { label: "Home", href: "/", order: 0 },
      { label: "About", href: "/about", order: 1 },
      { label: "Courses", href: "/courses", order: 2 },
      { label: "Events", href: "/events", order: 3 },
      { label: "Blog", href: "/blog", order: 4 },
      { label: "Contact", href: "/contact", order: 5 },
      { label: "Member Portal", href: "/portal/corsair-tactical-solutions/login", order: 6 },
    ];

    for (const item of navItems) {
      await ctx.db.insert("navigationItems", {
        siteId,
        ...item,
        isVisible: true,
        openInNewTab: false,
      });
    }

    return { ok: true, step: "navigation", count: navItems.length };
  },
});

// ─── Step 4: Footer ────────────────────────────────────────────────────────────

export const seedFooter = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("footerContent")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const footerData = {
      columns: [
        {
          heading: "Training",
          links: [
            { label: "Firearms Fundamentals", href: "/courses/firearms-fundamentals" },
            { label: "CQB Course", href: "/courses/cqb" },
            { label: "Leadership & Tactics", href: "/courses/leadership-tactics" },
            { label: "Upcoming Events", href: "/events" },
          ],
        },
        {
          heading: "Company",
          links: [
            { label: "About Us", href: "/about" },
            { label: "Instructors", href: "/team" },
            { label: "Blog", href: "/blog" },
            { label: "Contact", href: "/contact" },
          ],
        },
        {
          heading: "Legal",
          links: [
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
            { label: "Refund Policy", href: "/refund-policy" },
          ],
        },
      ],
      socialLinks: [
        { platform: "facebook", url: "https://facebook.com/corsairtactical" },
        { platform: "instagram", url: "https://instagram.com/corsairtactical" },
        { platform: "youtube", url: "https://youtube.com/@corsairtactical" },
      ],
      copyrightText: "© 2026 Corsair Tactical Solutions. All rights reserved.",
    };

    if (existing) {
      await ctx.db.patch(existing._id, footerData);
    } else {
      await ctx.db.insert("footerContent", { siteId, ...footerData });
    }

    return { ok: true, step: "footer" };
  },
});

// ─── Step 5: Contact Info ──────────────────────────────────────────────────────

export const seedContactInfo = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("contactInfo")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const contactData = {
      email: "corsairtacticalsolutions@gmail.com",
      phone: "214-335-6652",
      address: "North Texas — Available in all 50 states",
      mapEmbedUrl: undefined,
      hours: [
        { day: "Monday", open: "09:00", close: "18:00" },
        { day: "Tuesday", open: "09:00", close: "18:00" },
        { day: "Wednesday", open: "09:00", close: "18:00" },
        { day: "Thursday", open: "09:00", close: "18:00" },
        { day: "Friday", open: "09:00", close: "18:00" },
        { day: "Saturday", open: "08:00", close: "16:00" },
        { day: "Sunday", open: null, close: null },
      ],
    };

    if (existing) {
      await ctx.db.patch(existing._id, contactData);
    } else {
      await ctx.db.insert("contactInfo", { siteId, ...contactData });
    }

    return { ok: true, step: "contact" };
  },
});

// ─── Step 6: SEO Settings ─────────────────────────────────────────────────────

export const seedSeo = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("seoSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    // Remove old SEO records (idempotent)
    for (const r of existing) await ctx.db.delete(r._id);

    const seoPages = [
      {
        pagePath: "/",
        title: "Corsair Tactical Solutions | Professional Security Services & Training",
        description:
          "Professional security services, armed protection, private investigations, and state-certified security training nationwide. Veteran-owned. Licensed & Insured.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-home.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/",
      },
      {
        pagePath: "/courses",
        title: "Training Courses — Corsair Tactical Solutions",
        description:
          "Texas DPS-certified security officer training, Texas License to Carry (LTC) certification, defensive shooting, and private firearms instruction. All skill levels.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-courses.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/courses",
      },
      {
        pagePath: "/about",
        title: "About Corsair Tactical Solutions — Veteran-Owned Security & Training",
        description:
          "Corsair Tactical Solutions is a veteran-owned, Texas DPS-certified security and firearms training company serving North Texas and nationwide.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-about.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/about",
      },
      {
        pagePath: "/contact",
        title: "Contact Us | Corsair Tactical Solutions",
        description:
          "Get in touch with Corsair Tactical Solutions for firearms training, security services, and private investigations. Call 214-335-6652 or email us.",
        canonicalUrl: "https://corsairtacticalsolutions.com/contact",
      },
    ];

    for (const seo of seoPages) {
      await ctx.db.insert("seoSettings", { siteId, ...seo });
    }

    return { ok: true, step: "seo", count: seoPages.length };
  },
});

// ─── Step 7: Articles ─────────────────────────────────────────────────────────

export const seedArticles = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const a of existing) await ctx.db.delete(a._id);

    const now = Date.now();

    await ctx.db.insert("articles", {
      siteId,
      title: "Everything You Need to Know About Getting Your Texas LTC",
      slug: "texas-ltc-complete-guide",
      status: "published",
      excerpt:
        "Texas License to Carry requirements, costs, and what to expect on class day — answered by a certified LTC instructor.",
      body: `## What Is the Texas LTC?

The Texas License to Carry (LTC) — formerly called the CHL (Concealed Handgun License) — is the state permit that allows you to carry a handgun, concealed or open, in Texas and in many other states through reciprocity agreements.

## Requirements

To obtain a Texas LTC you must:
- Be 21 or older (18+ for active military)
- Be a U.S. citizen or permanent resident
- Not be prohibited under state or federal law from possessing a firearm
- Complete a state-approved LTC course (classroom + range)
- Submit fingerprints and a DPS application

## What Happens in Class?

Our one-day LTC course covers:
1. **Texas handgun laws** — where you can and can't carry, duty to retreat, use of force rules
2. **Safe storage** — especially if you have children in the home
3. **Handgun safety and operation** — for students new to handguns
4. **Shooting proficiency qualification** — 50 rounds at varying distances; passing score is required

We provide everything you need for the classroom portion. Bring your own handgun and 50 rounds of ammunition for the range, or let us know in advance and we can arrange a loaner.

## After Class

Once you've passed, you submit your DPS application online, schedule fingerprinting, and your license arrives by mail within 60 days. Corsair signs your proficiency certificate the same day.

## Ready to Sign Up?

[Contact us](https://corsairtacticalsolutions.com/contact) or call **214-335-6652** to register for the next available class.`,
      coverImageUrl: "https://storage.googleapis.com/corsair-tactical/blog-ltc-guide.jpg",
      publishedAt: now - 5 * 24 * 60 * 60 * 1000,
      category: "LTC",
      author: "Corsair Tactical Solutions",
      readingTime: "5 min read",
      tags: ["texas-ltc", "license-to-carry", "concealed-carry", "beginners"],
      featured: true,
      seoTitle: "Texas LTC Guide — Corsair Tactical Solutions",
      metaDescription:
        "Everything you need to know about getting your Texas License to Carry: requirements, cost, what happens in class, and next steps after you pass.",
    });

    await ctx.db.insert("articles", {
      siteId,
      title: "Level II vs Level III Security Training: What's the Difference?",
      slug: "level-2-vs-level-3-security-training",
      status: "published",
      excerpt:
        "Thinking about a career in security? Here's exactly what each Texas DPS certification covers and which one you need.",
      body: `## Texas Security Officer Licensing

Texas regulates security officers through the Department of Public Safety (DPS). There are two primary licensing tiers for private security officers:

## Level II — Unarmed Security Officer

Level II is the entry-level license required for **all** security officers in Texas, armed or unarmed. If you want to work as an unarmed guard, Level II is all you need.

**What it covers:**
- Legal authority and limits of a security officer
- Use of force continuum
- Report writing and documentation
- Professional conduct and appearance

**Cost at Corsair:** $65  
**Duration:** 1 day  
**Who needs it:** Anyone starting a career in security

## Level III — Armed Security Officer

Level III is required to carry a firearm on duty. You **must already hold or obtain Level II** before applying for Level III.

**What it covers:**
- All Level II content
- Firearm safety and handling
- Shooting proficiency qualification
- Laws governing armed security officers

**Cost at Corsair:** $130  
**Duration:** 2 days  
**Who needs it:** Anyone who wants to carry a firearm as a security officer

## Level IV — Personal Protection Officer (PPO / Bodyguard)

Level IV is the highest tier, authorising you to work as an executive protection specialist or bodyguard.

**Cost at Corsair:** $225  
**Duration:** 2 days  
**Bundle deal:** Level III + IV together for $400 (save $45)

## Which Should You Take?

If you're new to security: start with Level II.  
If you want to carry: add Level III.  
If executive protection is your goal: go straight to the Level III + IV bundle.

Call us at **214-335-6652** — we'll help you map out the right path.`,
      coverImageUrl: "https://storage.googleapis.com/corsair-tactical/blog-security-levels.jpg",
      publishedAt: now - 12 * 24 * 60 * 60 * 1000,
      category: "Security Training",
      author: "Corsair Tactical Solutions",
      readingTime: "6 min read",
      tags: ["security-training", "level-2", "level-3", "texas-dps", "security-officer"],
      featured: false,
      seoTitle: "Level II vs Level III Security Training Texas — Corsair Tactical Solutions",
      metaDescription:
        "Understand the difference between Texas DPS Level II and Level III security officer certifications — and which one you need for your career.",
    });

    return { ok: true, step: "articles", count: 2 };
  },
});

// ─── Step 8: Courses ──────────────────────────────────────────────────────────
//
// Slugs here MUST match src/lib/courses.ts in thefsts/Corsair-Tactical-Solutions.
// The FSTSPublicBookingForm looks up availability by entitySlug — a mismatch
// causes the form to fall back to "Call to Register".

export const seedCourses = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const c of existing) await ctx.db.delete(c._id);

    const now = Date.now();
    // registrationOpenAt: open now; registrationCloseAt: 1 day before class starts
    // These are course-level defaults; event records carry the per-session window.
    const courses = [
      // ── License to Carry ──────────────────────────────────────────────────
      {
        title: "Texas License to Carry Certification / Basic Handgun",
        slug: "texas-ltc-certification-basic-handgun",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Combined Texas LTC certification with basic handgun fundamentals. Covers Texas gun laws, use of force, safety, grip, stance, trigger control, and live-fire proficiency qualification. All skill levels welcome.",
        durationLabel: "6–7 hrs",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-ltc.jpg",
      },
      {
        title: "Texas LTC Shooting Proficiency",
        slug: "texas-ltc-shooting-proficiency",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Live-fire shooting proficiency qualification for the Texas License to Carry. For students who have completed the LTC classroom portion (online or in-person) and need their range qualification. Bring your own firearm and 50 rounds, or rent from us.",
        durationLabel: "1–2 hrs",
        priceCents: 7500,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-ltc.jpg",
      },
      {
        title: "Texas License to Carry Certification (Wichita)",
        slug: "texas-ltc-wichita",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Full Texas LTC certification course offered in the Wichita Falls area. Covers all state requirements, written exam, and live-fire proficiency qualification.",
        durationLabel: "6–8 hrs",
        priceCents: 12500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-ltc.jpg",
      },
      {
        title: "Online Texas License to Carry Assessment",
        slug: "online-texas-ltc-assessment",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Complete the Texas LTC classroom portion online through our trusted training partner, Texas Carry Academy. Self-paced, state-approved. Schedule your live-fire qualification with Corsair at the range once complete.",
        durationLabel: "4–6 hrs online + range",
        priceCents: null,
        externalCourse: true,
        capacity: 50,
        timezone: "America/Chicago",
        autoCloseRegistration: false,
        autoArchive: false,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-ltc.jpg",
      },
      // ── Beginner Firearms ─────────────────────────────────────────────────
      {
        title: "Basic Handgun Skills Training (Personal 1:1)",
        slug: "basic-handgun-skills-training",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Private 1:1 firearms instruction tailored to your skill level. Covers handgun fundamentals, safe handling, grip, stance, sight alignment, trigger control, and live-fire practice. Available for individuals and small groups.",
        durationLabel: "1.5 hrs",
        priceCents: 7500,
        capacity: 6,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "First Shots Basic Firearm Training",
        slug: "first-shots-basic-firearm-training",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Entry-level safe firearms introduction for first-time gun owners and curious beginners. Covers safe storage, handling rules, and a live-fire introduction at the range.",
        durationLabel: "2–3 hrs",
        priceCents: 5000,
        capacity: 10,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "Introduction to Firearms",
        slug: "introduction-to-firearms",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Comprehensive introduction to firearm safety, terminology, types of firearms, safe storage, and responsible ownership. Ideal for new gun owners or anyone considering purchasing their first firearm.",
        durationLabel: "3–4 hrs",
        priceCents: 5000,
        capacity: 12,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      // ── Defensive & Scenario-Based ────────────────────────────────────────
      {
        title: "Defensive Shooting Skills",
        slug: "defensive-shooting-skills",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Real-world defensive shooting skills including threat identification, draw from concealment, moving and shooting, malfunction drills, and scenario-based decision-making. Intermediate course.",
        durationLabel: "4–6 hrs",
        priceCents: 15000,
        capacity: 12,
        waitlistCapacity: 4,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "Concealed Carry Home Defense",
        slug: "concealed-carry-home-defense",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Practical skills for carrying concealed and defending your home. Covers draw techniques, clearing rooms, low-light shooting, legal considerations, and safe storage in the home.",
        durationLabel: "4–6 hrs",
        priceCents: 15000,
        capacity: 12,
        waitlistCapacity: 4,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "Continuing Education",
        slug: "continuing-education",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Ongoing skills refresher for shooters who want to maintain and build on their existing training. Covers fundamentals review, updated defensive techniques, and practical range drills to reinforce muscle memory.",
        durationLabel: "2–4 hrs",
        priceCents: 7500,
        capacity: 12,
        waitlistCapacity: 4,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      // ── Security Training & Certification ─────────────────────────────────
      {
        title: "Level 2 Unarmed Security Officer",
        slug: "level-2-security-officer",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level II unarmed security officer training. Required for all licensed security officers in Texas. Covers legal authority, use of force continuum, report writing, and professional conduct.",
        durationLabel: "1–2 days",
        priceCents: 6500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level2.jpg",
      },
      {
        title: "Level 3 Armed Security Officer — Commissioned",
        slug: "level-3-armed-security-officer",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level III armed security officer training. Covers firearm safety, shooting proficiency qualification, legal use of force, and all requirements for a Texas armed security license. Prerequisite: Level II license.",
        durationLabel: "3–5 days",
        priceCents: 13000,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level3.jpg",
      },
      {
        title: "Level 4 Bodyguard (Personal Protection Officer)",
        slug: "level-4-bodyguard",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level IV personal protection officer training. Designed for executive protection professionals. Covers threat assessment, protective driving, close-protection tactics, and all Level IV requirements.",
        durationLabel: "3–5 days",
        priceCents: 22500,
        capacity: 12,
        waitlistCapacity: 4,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level4.jpg",
      },
      {
        title: "Level III + IV Complete Package",
        slug: "level-3-4-complete-package",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Complete your Level III Armed Security and Level IV Personal Protection Officer certifications together. Save $45 vs. taking them separately — the fastest path to fully licensed PPO status.",
        durationLabel: "5–7 days",
        priceCents: 40000,
        capacity: 12,
        waitlistCapacity: 4,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-bundle.jpg",
      },
      {
        title: "Non-Lethal Defense Training",
        slug: "non-lethal-defense-training",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Training in non-lethal defensive tools and techniques including OC spray, tasers, and hand-to-hand defensive measures. Ideal for security officers, civilians, and those who prefer non-lethal options.",
        durationLabel: "2–4 hrs",
        priceCents: null,
        // Intentionally contact-only: rates vary by individual and group session.
        contactOnly: true,
        capacity: 15,
        timezone: "America/Chicago",
        autoCloseRegistration: false,
        autoArchive: false,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level2.jpg",
      },
      {
        title: "Firearm Proficiency Re-Qualification",
        slug: "firearm-proficiency-requalification",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Annual or required re-qualification for armed security officers and LTC holders. Covers current qualification course of fire and documents your proficiency score for DPS renewal.",
        durationLabel: "1–2 hrs",
        priceCents: 7500,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level3.jpg",
      },
      {
        title: "Armed First Responder",
        slug: "armed-first-responder",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Comprehensive armed response training for security personnel, law enforcement, and civilians in high-risk environments. Covers tactics, medical response integration, legal considerations, and live-fire qualification.",
        durationLabel: "2 days",
        priceCents: 59500,
        capacity: 12,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level3.jpg",
      },
      // ── Rifle & Shotgun ───────────────────────────────────────────────────
      {
        title: "Shotgun Course",
        slug: "shotgun-course",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Hands-on shotgun fundamentals covering safe handling, loading/unloading, stance, sight picture, pattern selection, and live-fire practice. Suitable for home-defense and sport shooting applications.",
        durationLabel: "3–4 hrs",
        priceCents: 7500,
        capacity: 10,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "AR-15 Rifle Course",
        slug: "ar-15-rifle-course",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Rifle fundamentals and live-fire marksmanship with the AR-15 platform. Covers safe operation, zeroing, support positions, and practical accuracy drills. Great for new AR owners and those looking to sharpen their rifle skills.",
        durationLabel: "3–4 hrs",
        priceCents: 7500,
        capacity: 10,
        waitlistCapacity: 3,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      // ── First Aid & Medical Response ───────────────────────────────────────
      {
        title: "Stop the Bleed Training",
        slug: "stop-the-bleed-training",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Hands-on tourniquet application and wound-packing instruction using the American College of Surgeons' Stop the Bleed curriculum. Ideal for individuals, businesses, churches, schools, and security teams.",
        durationLabel: "2 hrs",
        priceCents: 7500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
      {
        title: "First Aid Training",
        slug: "first-aid-training",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Comprehensive first aid training covering CPR, AED use, wound care, shock management, and emergency response. Certified instruction for individuals, teams, and organizations.",
        durationLabel: "4 hrs",
        priceCents: 7500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
    ];

    for (const course of courses) {
      await ctx.db.insert("courses", { siteId, ...course });
    }

    return { ok: true, step: "courses", count: courses.length };
  },
});

// ─── Ensure Corsair courses exist (deploy-key smoke-test helper) ──────────────
//
// Called by scripts/smoke-test-free-booking.sh via `npx convex run` when the
// availability endpoint returns 404, meaning the Corsair courses have not been
// seeded into this deployment yet.
//
// This is an internal action. The Convex CLI can invoke it with a deployment
// key, but browser clients cannot use it to write catalog data. It is
// IDEMPOTENT — it checks for each course by slug before inserting, so running
// it multiple times never creates duplicates.
//
// The site is looked up by slug rather than hardcoded siteId so this works
// across deployments where the Corsair site may have a different document ID.

export const ensureCorsairCourses = internalAction({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; skipped: number; siteFound: boolean }> => {
    return await ctx.runMutation(internal.seedCorsair._ensureCorsairCoursesMutation, {});
  },
});

export const _ensureCorsairCoursesMutation = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; skipped: number; siteFound: boolean; siteCreated: boolean }> => {
    // Resolve site by slug — works across deployments regardless of siteId
    let site: any = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", "corsair-tactical-solutions"))
      .first();

    let siteCreated = false;
    if (!site) {
      // Create a minimal Corsair site so the smoke test can validate the booking flow.
      // This site is used by the Corsair Tactical Solutions public website and is
      // needed for the public booking endpoints to resolve correctly.
      const newSiteId = await ctx.db.insert("sites", {
        name: "Corsair Tactical Solutions",
        slug: "corsair-tactical-solutions",
        status: "active",
        brandColorPrimary: "#1a1a2e",
        brandColorSecondary: "#e8c547",
        whiteLabelEnabled: false,
        poweredByFsts: true,
        websiteType: "standard",
        enabledModules: { courses: true, events: true },
        domain: "corsairtacticalsolutions.com",
        logoUrl: "https://storage.googleapis.com/corsair-tactical/logo-white.png",
        faviconUrl: "https://storage.googleapis.com/corsair-tactical/favicon.ico",
      } as any);
      site = await ctx.db.get(newSiteId);
      siteCreated = true;
    }

    const siteId = site._id;

    const courseDefs = [
      {
        title: "Texas License to Carry (LTC)",
        slug: "texas-ltc-certification-basic-handgun",
        status: "published",
        description:
          "Texas DPS-certified License to Carry course. Covers Texas handgun laws, safe storage, shooting proficiency qualification, and all requirements to obtain your Texas LTC. All skill levels welcome — loaner firearms available.",
        durationLabel: "1 day",
        priceCents: 10000,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-ltc.jpg",
      },
      {
        title: "Level II Unarmed Security Officer Training",
        slug: "level-2-security-training",
        status: "published",
        description:
          "Texas DPS-certified Level II unarmed security officer training. Required for all licensed security officers in Texas. Covers legal authority, use of force, report writing, and professional conduct.",
        durationLabel: "1 day",
        priceCents: 6500,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level2.jpg",
      },
      {
        title: "Level III Armed Security Officer Training",
        slug: "level-3-security-training",
        status: "published",
        description:
          "Texas DPS-certified Level III armed security officer training. Covers firearm safety, shooting proficiency, legal use of force, and all requirements for a Texas armed security officer license.",
        durationLabel: "2 days",
        priceCents: 13000,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level3.jpg",
      },
      {
        title: "Level IV Personal Protection Officer (PPO) Training",
        slug: "level-4-ppo-training",
        status: "published",
        description:
          "Texas DPS-certified Level IV bodyguard and personal protection officer training. Designed for executive protection professionals. Covers protective driving, threat assessment, and close-protection tactics.",
        durationLabel: "2 days",
        priceCents: 22500,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-level4.jpg",
      },
      {
        title: "Level III + IV Complete Package",
        slug: "level-3-4-security-bundle",
        status: "published",
        description:
          "Complete your Level III and Level IV certifications together and save $45. The fastest path from unarmed to fully licensed personal protection officer.",
        durationLabel: "3 days",
        priceCents: 40000,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-bundle.jpg",
      },
      {
        title: "Basic Handgun & Private Instruction",
        slug: "basic-handgun-private-instruction",
        status: "published",
        description:
          "Private 1:1 firearms instruction tailored to your skill level and goals. Includes beginner handgun fundamentals, defensive shooting skills, and scenario-based training. Available for individuals and small groups.",
        durationLabel: "Flexible",
        // Intentionally contact-only: private and group session rates vary.
        priceCents: null,
        contactOnly: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
    ];

    let inserted = 0;
    let skipped = 0;
    for (const def of courseDefs) {
      const existing = await (ctx.db.query("courses") as any)
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .filter((q: any) => q.eq(q.field("slug"), def.slug))
        .first();
      if (existing) {
        skipped++;
      } else {
        await ctx.db.insert("courses", { siteId, ...def } as any);
        inserted++;
      }
    }
    return { inserted, skipped, siteFound: true, siteCreated };
  },
});

// ─── Step 9: Events ───────────────────────────────────────────────────────────
//
// Slugs here MUST match the slug field in src/data/events.ts in
// thefsts/Corsair-Tactical-Solutions so the FSTSPublicBookingForm can look up
// availability. Past events are kept for booking history continuity; upcoming
// events drive the live registration form.

export const seedEvents = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    // Helper: ms timestamp for a specific Central-time date at a given hour.
    // CDT (UTC-5): Mar 2nd Sunday → Nov 1st Sunday each year (e.g. Mar 8–Nov 1, 2026).
    // CST (UTC-6): Nov 1st Sunday → Mar 2nd Sunday (e.g. Nov 2, 2026 – Mar 7, 2027).
    function ctMs(isoDate: string, hour = 9, tz: "CDT" | "CST" = "CDT"): number {
      const offset = tz === "CST" ? "-06:00" : "-05:00";
      return new Date(`${isoDate}T${String(hour).padStart(2, "0")}:00:00${offset}`).getTime();
    }

    const events = [
      // ── Past events (match website slugs — kept for history) ─────────────
      {
        title: "Texas LTC Certification Class — June 2026",
        slug: "texas-ltc-certification-class-jun2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "completed",
        registrationStatus: "closed",
        description:
          "Texas License to Carry certification class. Full-day classroom and range session covering the Texas LTC curriculum. Includes written exam and live-fire qualification.",
        startAt: ctMs("2026-06-28", 9),
        endAt: ctMs("2026-06-28", 17),
        startDateTime: ctMs("2026-06-28", 9),
        endDateTime: ctMs("2026-06-28", 17),
        location: "Dallas, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-05-01", 0),
        registrationCloseAt: ctMs("2026-06-27", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Texas LTC Certification Class — July 2026",
        slug: "texas-ltc-certification-class-jul2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "completed",
        registrationStatus: "closed",
        description:
          "Complete your Texas License to Carry certification in a one-day course covering all state requirements, written exam, and live-fire qualification at Eagle Gun Range.",
        startAt: ctMs("2026-07-19", 9),
        endAt: ctMs("2026-07-19", 17),
        startDateTime: ctMs("2026-07-19", 9),
        endDateTime: ctMs("2026-07-19", 17),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-05-15", 0),
        registrationCloseAt: ctMs("2026-07-18", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Level III/IV Security Officer Training — July 2026",
        slug: "level-iii-iv-security-training-jul2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "completed",
        registrationStatus: "closed",
        description:
          "Four-day combined Level III and Level IV security officer certification course. Covers all requirements for Texas Level III (Armed) and Level IV (Personal Protection) security officer certification.",
        startAt: ctMs("2026-07-07", 8),
        endAt: ctMs("2026-07-10", 18),
        startDateTime: ctMs("2026-07-07", 8),
        endDateTime: ctMs("2026-07-10", 18),
        location: "Dallas, TX",
        courseSlug: "level-3-4-complete-package",
        priceCents: 40000,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-05-15", 0),
        registrationCloseAt: ctMs("2026-07-06", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      // ── Upcoming events (Aug–Oct 2026) ────────────────────────────────────
      {
        title: "Texas LTC Certification Class — August 2026",
        slug: "texas-ltc-certification-class-aug2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification class. One-day classroom and live-fire range qualification covering all Texas LTC requirements. All skill levels welcome. Bring your handgun and 50 rounds, or ask about loaners.",
        startAt: ctMs("2026-08-30", 9),
        endAt: ctMs("2026-08-30", 17),
        startDateTime: ctMs("2026-08-30", 9),
        endDateTime: ctMs("2026-08-30", 17),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-07-01", 0),
        registrationCloseAt: ctMs("2026-08-29", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Level 2 Unarmed Security Officer Training — August 2026",
        slug: "level-2-security-officer-aug2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level II unarmed security officer training. Required for all licensed security officers in Texas. Covers legal authority, use of force, report writing, and professional conduct. Class sizes intentionally small.",
        startAt: ctMs("2026-08-23", 8),
        endAt: ctMs("2026-08-23", 17),
        startDateTime: ctMs("2026-08-23", 8),
        endDateTime: ctMs("2026-08-23", 17),
        location: "Dallas, TX",
        courseSlug: "level-2-security-officer",
        priceCents: 6500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-07-01", 0),
        registrationCloseAt: ctMs("2026-08-22", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg",
      },
      {
        title: "Level III/IV Security Officer Training — September 2026",
        slug: "level-iii-iv-security-training-sep2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Combined Level III Armed Security and Level IV Personal Protection Officer certification — four-day intensive. Covers all DPS requirements, firearm qualification, and executive protection tactics. Prerequisite: Level II license.",
        startAt: ctMs("2026-09-13", 8),
        endAt: ctMs("2026-09-16", 18),
        startDateTime: ctMs("2026-09-13", 8),
        endDateTime: ctMs("2026-09-16", 18),
        location: "Dallas, TX",
        courseSlug: "level-3-4-complete-package",
        priceCents: 40000,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-07-15", 0),
        registrationCloseAt: ctMs("2026-09-12", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-sep-level34.jpg",
      },
      {
        title: "Texas LTC Certification Class — September 2026",
        slug: "texas-ltc-certification-class-sep2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — September session. Full-day classroom and live-fire range qualification. All skill levels welcome. Bring your handgun and 50 rounds, or ask about loaners.",
        startAt: ctMs("2026-09-27", 9),
        endAt: ctMs("2026-09-27", 17),
        startDateTime: ctMs("2026-09-27", 9),
        endDateTime: ctMs("2026-09-27", 17),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-08-01", 0),
        registrationCloseAt: ctMs("2026-09-26", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Texas LTC Certification Class — October 2026",
        slug: "texas-ltc-certification-class-oct2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — October session. One-day classroom and live-fire qualification at the range. All skill levels welcome.",
        startAt: ctMs("2026-10-18", 9),
        endAt: ctMs("2026-10-18", 17),
        startDateTime: ctMs("2026-10-18", 9),
        endDateTime: ctMs("2026-10-18", 17),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-09-01", 0),
        registrationCloseAt: ctMs("2026-10-17", 17),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      // ── Nov 2026 (CST — clocks fall back Nov 1, 2026) ────────────────────
      {
        title: "Level 2 Unarmed Security Officer Training — November 2026",
        slug: "level-2-security-officer-nov2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level II unarmed security officer training — November session. Required for all licensed security officers in Texas. Covers legal authority, use of force, report writing, and professional conduct. Small class sizes.",
        startAt: ctMs("2026-11-08", 8, "CST"),
        endAt: ctMs("2026-11-08", 17, "CST"),
        startDateTime: ctMs("2026-11-08", 8, "CST"),
        endDateTime: ctMs("2026-11-08", 17, "CST"),
        location: "Dallas, TX",
        courseSlug: "level-2-security-officer",
        priceCents: 6500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-09-15", 0, "CDT"),
        registrationCloseAt: ctMs("2026-11-07", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg",
      },
      {
        title: "Level III/IV Security Officer Training — November 2026",
        slug: "level-iii-iv-security-training-nov2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Combined Level III Armed Security and Level IV Personal Protection Officer certification — four-day intensive, November session. Covers all DPS requirements, firearm qualification, and executive protection tactics. Prerequisite: Level II license.",
        startAt: ctMs("2026-11-10", 8, "CST"),
        endAt: ctMs("2026-11-13", 18, "CST"),
        startDateTime: ctMs("2026-11-10", 8, "CST"),
        endDateTime: ctMs("2026-11-13", 18, "CST"),
        location: "Dallas, TX",
        courseSlug: "level-3-4-complete-package",
        priceCents: 40000,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-09-15", 0, "CDT"),
        registrationCloseAt: ctMs("2026-11-09", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-sep-level34.jpg",
      },
      {
        title: "Texas LTC Certification Class — November 2026",
        slug: "texas-ltc-certification-class-nov2026",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — November session. Full-day classroom and live-fire range qualification. All skill levels welcome. Bring your handgun and 50 rounds, or ask about loaners.",
        startAt: ctMs("2026-11-15", 9, "CST"),
        endAt: ctMs("2026-11-15", 17, "CST"),
        startDateTime: ctMs("2026-11-15", 9, "CST"),
        endDateTime: ctMs("2026-11-15", 17, "CST"),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-10-01", 0, "CDT"),
        registrationCloseAt: ctMs("2026-11-14", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      // ── Q1 2027 (CST until Mar 14, 2027; CDT from Mar 14 onward) ─────────
      {
        title: "Level 2 Unarmed Security Officer Training — January 2027",
        slug: "level-2-security-officer-jan2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level II unarmed security officer training — January 2027 session. Required entry-level license for all security officers in Texas. Covers legal authority, use of force, report writing, and professional conduct.",
        startAt: ctMs("2027-01-10", 8, "CST"),
        endAt: ctMs("2027-01-10", 17, "CST"),
        startDateTime: ctMs("2027-01-10", 8, "CST"),
        endDateTime: ctMs("2027-01-10", 17, "CST"),
        location: "Dallas, TX",
        courseSlug: "level-2-security-officer",
        priceCents: 6500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-11-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-01-09", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg",
      },
      {
        title: "Texas LTC Certification Class — January 2027",
        slug: "texas-ltc-certification-class-jan2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — January 2027 session. One-day classroom and live-fire range qualification covering all Texas LTC requirements. All skill levels welcome.",
        startAt: ctMs("2027-01-17", 9, "CST"),
        endAt: ctMs("2027-01-17", 17, "CST"),
        startDateTime: ctMs("2027-01-17", 9, "CST"),
        endDateTime: ctMs("2027-01-17", 17, "CST"),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-11-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-01-16", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Level III/IV Security Officer Training — February 2027",
        slug: "level-iii-iv-security-training-feb2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Combined Level III Armed Security and Level IV Personal Protection Officer certification — four-day intensive, February 2027. All DPS requirements, firearm qualification, and executive protection tactics. Prerequisite: Level II license.",
        startAt: ctMs("2027-02-09", 8, "CST"),
        endAt: ctMs("2027-02-12", 18, "CST"),
        startDateTime: ctMs("2027-02-09", 8, "CST"),
        endDateTime: ctMs("2027-02-12", 18, "CST"),
        location: "Dallas, TX",
        courseSlug: "level-3-4-complete-package",
        priceCents: 40000,
        capacity: 15,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-12-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-02-08", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-sep-level34.jpg",
      },
      {
        title: "Texas LTC Certification Class — February 2027",
        slug: "texas-ltc-certification-class-feb2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — February 2027 session. Full-day classroom and live-fire range qualification. All skill levels welcome. Bring your handgun and 50 rounds, or ask about loaners.",
        startAt: ctMs("2027-02-21", 9, "CST"),
        endAt: ctMs("2027-02-21", 17, "CST"),
        startDateTime: ctMs("2027-02-21", 9, "CST"),
        endDateTime: ctMs("2027-02-21", 17, "CST"),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2026-12-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-02-20", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Level 2 Unarmed Security Officer Training — March 2027",
        slug: "level-2-security-officer-mar2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas DPS-certified Level II unarmed security officer training — March 2027 session. Required entry-level license for all security officers in Texas. Covers legal authority, use of force, report writing, and professional conduct.",
        startAt: ctMs("2027-03-08", 8, "CST"),
        endAt: ctMs("2027-03-08", 17, "CST"),
        startDateTime: ctMs("2027-03-08", 8, "CST"),
        endDateTime: ctMs("2027-03-08", 17, "CST"),
        location: "Dallas, TX",
        courseSlug: "level-2-security-officer",
        priceCents: 6500,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2027-01-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-03-07", 17, "CST"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg",
      },
      {
        title: "Texas LTC Certification Class — March 2027",
        slug: "texas-ltc-certification-class-mar2027",
        status: "published",
        isPublished: true,
        lifecycleStatus: "open",
        registrationStatus: "open",
        description:
          "Texas License to Carry certification — March 2027 session. One-day classroom and live-fire range qualification. All skill levels welcome. Bring your handgun and 50 rounds, or ask about loaners.",
        startAt: ctMs("2027-03-22", 9, "CDT"),
        endAt: ctMs("2027-03-22", 17, "CDT"),
        startDateTime: ctMs("2027-03-22", 9, "CDT"),
        endDateTime: ctMs("2027-03-22", 17, "CDT"),
        location: "Farmers Branch, TX",
        courseSlug: "texas-ltc-certification-basic-handgun",
        priceCents: 10000,
        capacity: 20,
        waitlistCapacity: 5,
        timezone: "America/Chicago",
        registrationOpenAt: ctMs("2027-01-15", 0, "CST"),
        registrationCloseAt: ctMs("2027-03-21", 17, "CDT"),
        autoCloseRegistration: true,
        autoArchive: true,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
    ];

    for (const event of events) {
      await ctx.db.insert("events", { siteId, ...event });
    }

    return { ok: true, step: "events", count: events.length };
  },
});

// ─── Step 10: Testimonials ────────────────────────────────────────────────────

export const seedTestimonials = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const t of existing) await ctx.db.delete(t._id);

    const testimonials = [
      {
        name: "Shamira",
        role: "Texas License to Carry",
        company: "",
        rating: 5,
        text: "This LTC training class was amazing. The teachers were very knowledgeable. So enjoyed the energy. Continue to do what y'all do!",
        isActive: true,
        order: 0,
      },
      {
        name: "Ronique",
        role: "Texas License to Carry",
        company: "",
        rating: 5,
        text: "Exceeded my expectations. The instructors were knowledgeable, safety-conscious, and provided a supportive learning environment. Highly recommend!",
        isActive: true,
        order: 1,
      },
      {
        name: "Juanita",
        role: "Texas LTC",
        company: "",
        rating: 5,
        text: "Best decision I made! The instructor was patient and thorough. I felt completely prepared and confident walking out. 10/10 would recommend to anyone looking to get their LTC.",
        isActive: true,
        order: 2,
      },
      {
        name: "Marcus",
        role: "Level III Security Training",
        company: "",
        rating: 5,
        text: "Got my Level III through Corsair. No fluff, no wasted time — exactly what you need to pass the DPS requirements. The instructor clearly knows his stuff and makes sure you do too.",
        isActive: true,
        order: 3,
      },
      {
        name: "Danielle",
        role: "Women's Firearms Training",
        company: "",
        rating: 5,
        text: "As a first-time shooter I was nervous, but the environment felt so safe and non-judgmental. By the end I was comfortable loading, firing, and clearing malfunctions on my own. Incredible experience.",
        isActive: true,
        order: 4,
      },
    ];

    for (const t of testimonials) {
      await ctx.db.insert("testimonials", { siteId, ...t });
    }

    return { ok: true, step: "testimonials", count: testimonials.length };
  },
});

// ─── Step 11: Email Configuration ────────────────────────────────────────────

export const seedEmailConfig = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("emailSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const emailData = {
      fromName: "Corsair Tactical Solutions",
      fromEmail: "noreply@corsairtacticalsolutions.com",
      replyToEmail: "corsairtacticalsolutions@gmail.com",
      notificationEmail: "corsairtacticalsolutions@gmail.com",
      notifyOnNewLead: true,
      notifyOnBooking: true,
      // resendApiKey intentionally omitted — client must supply their own Resend API key
      // via the dashboard Email Config page (Task #65)
    };

    if (existing) {
      await ctx.db.patch(existing._id, emailData);
    } else {
      await ctx.db.insert("emailSettings", { siteId, ...emailData });
    }

    return { ok: true, step: "email", warning: "resendApiKey NOT set — client must configure via dashboard before live email delivery works" };
  },
});

// ─── Step 12: Portal Configuration ───────────────────────────────────────────

export const seedPortalConfig = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("portalConfigs")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const portalData = {
      siteId,
      enabled: true,
      registrationOpen: true,
      requireApproval: false,
      logoUrl: "https://storage.googleapis.com/corsair-tactical/logo-dark.png",
      primaryColor: "#1A3A52",
      welcomeMessage:
        "Welcome to the Corsair Tactical Solutions Client Portal. Access your course materials, training certificates, and booking history here. Questions? Contact us at corsairtacticalsolutions@gmail.com.",
      enabledFeatures: {
        courseMaterials: true,
        certificates: true,
        bookingHistory: true,
        messaging: false,
      },
    };

    if (existing) {
      await ctx.db.patch(existing._id, portalData);
    } else {
      await ctx.db.insert("portalConfigs", portalData);
    }

    return { ok: true, step: "portalConfig" };
  },
});

// ─── Step 13: Review Source + Sample Review ───────────────────────────────────

export const seedReviews = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    // Check if a review source already exists
    const existingSource = await ctx.db
      .query("reviewSources")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    let sourceId = existingSource?._id;

    if (!existingSource) {
      sourceId = await ctx.db.insert("reviewSources", {
        siteId,
        provider: "google",
        config: {
          placeId: "ChIJ_pending_corsair_tactical_solutions",
          businessName: "Corsair Tactical Solutions",
        },
        autoRefresh: false,
        refreshIntervalHours: 24,
        status: "active",
      });
    }

    // Insert sample review (simulating a synced Google review)
    const existingReviews = await ctx.db
      .query("importedReviews")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const r of existingReviews) await ctx.db.delete(r._id);

    await ctx.db.insert("importedReviews", {
      siteId,
      sourceId: sourceId!,
      provider: "google",
      externalId: "google-review-001-corsair",
      reviewerName: "Shamira J.",
      rating: 5,
      text: "This LTC training class was amazing. The teachers were very knowledgeable. So enjoyed the energy. Continue to do what y'all do!",
      reviewDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      status: "approved",
      pinned: true,
      cachedAt: Date.now(),
    });

    await ctx.db.insert("importedReviews", {
      siteId,
      sourceId: sourceId!,
      provider: "google",
      externalId: "google-review-002-corsair",
      reviewerName: "Ronique M.",
      rating: 5,
      text: "Exceeded my expectations. The instructors were knowledgeable, safety-conscious, and provided a supportive learning environment. Highly recommend!",
      reviewDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      status: "approved",
      pinned: false,
      cachedAt: Date.now(),
    });

    await ctx.db.insert("importedReviews", {
      siteId,
      sourceId: sourceId!,
      provider: "google",
      externalId: "google-review-003-corsair",
      reviewerName: "Marcus T.",
      rating: 5,
      text: "Got my Level III through Corsair. No fluff, no wasted time — exactly what you need to pass DPS requirements. Instructor knows his stuff and makes sure you do too.",
      reviewDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
      status: "approved",
      pinned: false,
      cachedAt: Date.now(),
    });

    return { ok: true, step: "reviews", count: 2 };
  },
});

// ─── Step 14: Site Services (siteServices table) ──────────────────────────────

export const seedSiteServices = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("siteServices")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const s of existing) await ctx.db.delete(s._id);

    const services = [
      {
        title: "Security Services",
        slug: "security-services",
        description:
          "Professional armed and unarmed security for businesses, events, churches, and organizations. Licensed, insured, and veteran-led. Serving clients throughout Texas and nationwide.",
        shortDescription: "Armed & unarmed security for businesses, events, and organizations.",
        price: "Call for quote",
        category: "Security",
        order: 0,
        isVisible: true,
        ctaLabel: "Get a Quote",
        ctaUrl: "/contact",
      },
      {
        title: "Security Training",
        slug: "security-training",
        description:
          "Texas DPS-certified Level II, III, and IV security officer training. Start or renew your security credentials with a certified instructor. Level II $65 · Level III $130 · Level IV $225 · Bundle $400.",
        shortDescription: "Texas DPS-certified Level II, III, and IV security officer courses.",
        price: "From $65",
        category: "Training",
        order: 1,
        isVisible: true,
        ctaLabel: "View Courses",
        ctaUrl: "/courses",
      },
      {
        title: "Texas LTC / Private Instruction",
        slug: "texas-ltc-private-instruction",
        description:
          "Texas License to Carry certification, beginner handgun training, defensive shooting, and 1:1 private instruction. All skill levels welcome — from first-time shooters to experienced carriers.",
        shortDescription: "Texas LTC certification and private 1:1 firearms instruction.",
        price: "LTC from $100",
        category: "Firearms Training",
        order: 2,
        isVisible: true,
        ctaLabel: "Book a Class",
        ctaUrl: "/contact",
      },
    ];

    for (const service of services) {
      await ctx.db.insert("siteServices", { siteId, ...service });
    }

    return { ok: true, step: "siteServices", count: services.length };
  },
});

// ─── Step 15: Site Products (siteProducts table) ──────────────────────────────

export const seedSiteProducts = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("siteProducts")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const p of existing) await ctx.db.delete(p._id);

    const products = [
      {
        title: "Texas License to Carry (LTC)",
        slug: "texas-ltc-certification",
        description:
          "Complete Texas DPS-certified LTC certification course. Covers Texas handgun laws, safe storage, and shooting proficiency qualification. All skill levels welcome.",
        shortDescription: "Full-day LTC class — classroom + range qualification.",
        priceCents: 10000,
        priceLabel: "$100",
        category: "LTC Certification",
        order: 0,
        isVisible: true,
        isFeatured: true,
        ctaLabel: "Register",
        ctaUrl: "/contact",
      },
      {
        title: "Level II Unarmed Security Training",
        slug: "level-2-security-training",
        description:
          "Texas DPS-certified Level II unarmed security officer certification. Required for all security officers in Texas.",
        shortDescription: "DPS-certified unarmed security officer course.",
        priceCents: 6500,
        priceLabel: "$65",
        category: "Security Certification",
        order: 1,
        isVisible: true,
        isFeatured: false,
        ctaLabel: "Register",
        ctaUrl: "/contact",
      },
      {
        title: "Level III Armed Security Training",
        slug: "level-3-security-training",
        description:
          "Texas DPS-certified Level III armed security officer training. Includes firearm safety, shooting proficiency qualification, and legal use of force.",
        shortDescription: "DPS-certified armed security officer course.",
        priceCents: 13000,
        priceLabel: "$130",
        category: "Security Certification",
        order: 2,
        isVisible: true,
        isFeatured: false,
        ctaLabel: "Register",
        ctaUrl: "/contact",
      },
      {
        title: "Level IV Bodyguard / PPO Training",
        slug: "level-4-ppo-training",
        description:
          "Texas DPS-certified Level IV personal protection officer training for executive protection professionals.",
        shortDescription: "DPS-certified PPO / bodyguard certification.",
        priceCents: 22500,
        priceLabel: "$225",
        category: "Security Certification",
        order: 3,
        isVisible: true,
        isFeatured: false,
        ctaLabel: "Register",
        ctaUrl: "/contact",
      },
      {
        title: "Level III + IV Complete Package",
        slug: "level-3-4-bundle",
        description:
          "Complete your Level III and Level IV certifications together. The fastest path from unarmed to fully licensed personal protection officer — save $45 vs. purchasing separately.",
        shortDescription: "Level III + Level IV bundle — save $45.",
        priceCents: 40000,
        priceLabel: "$400 (save $45)",
        category: "Security Certification",
        order: 4,
        isVisible: true,
        isFeatured: true,
        ctaLabel: "Register",
        ctaUrl: "/contact",
      },
    ];

    for (const product of products) {
      await ctx.db.insert("siteProducts", { siteId, ...product });
    }

    return { ok: true, step: "siteProducts", count: products.length };
  },
});

// ─── Master seeder: run all steps for Corsair ─────────────────────────────────

export const seedAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const siteId = SITE_ID as any;
    const results: Record<string, unknown> = {};

    async function run(name: string, fn: () => Promise<unknown>) {
      try {
        results[name] = await fn();
        console.log(`✅ ${name}:`, JSON.stringify(results[name]));
      } catch (err: any) {
        results[name] = { error: err.message };
        console.error(`❌ ${name}:`, err.message);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (internal as any).seedCorsair;
    await run("branding", () => ctx.runMutation(sc.seedBranding, { siteId }));
    await run("homepage", () => ctx.runMutation(sc.seedHomepage, { siteId }));
    await run("navigation", () => ctx.runMutation(sc.seedNavigation, { siteId }));
    await run("footer", () => ctx.runMutation(sc.seedFooter, { siteId }));
    await run("contact", () => ctx.runMutation(sc.seedContactInfo, { siteId }));
    await run("seo", () => ctx.runMutation(sc.seedSeo, { siteId }));
    await run("articles", () => ctx.runMutation(sc.seedArticles, { siteId }));
    await run("courses", () => ctx.runMutation(sc.seedCourses, { siteId }));
    await run("events", () => ctx.runMutation(sc.seedEvents, { siteId }));
    await run("testimonials", () => ctx.runMutation(sc.seedTestimonials, { siteId }));
    await run("email", () => ctx.runMutation(sc.seedEmailConfig, { siteId }));
    await run("portal", () => ctx.runMutation(sc.seedPortalConfig, { siteId }));
    await run("reviews", () => ctx.runMutation(sc.seedReviews, { siteId }));
    await run("siteServices", () => ctx.runMutation(sc.seedSiteServices, { siteId }));
    await run("siteProducts", () => ctx.runMutation(sc.seedSiteProducts, { siteId }));

    const failed = Object.entries(results).filter(([, v]: any) => v?.error);
    return {
      success: failed.length === 0,
      failed: failed.length,
      results,
    };
  },
});
