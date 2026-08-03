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

const SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc" as const;

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
      { label: "Member Portal", href: "/portal/corsair-tactical/login", order: 6 },
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

export const seedCourses = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const c of existing) await ctx.db.delete(c._id);

    const courses = [
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
        priceCents: undefined,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-private.jpg",
      },
    ];

    for (const course of courses) {
      await ctx.db.insert("courses", { siteId, ...course });
    }

    return { ok: true, step: "courses", count: courses.length };
  },
});

// ─── Step 9: Events ───────────────────────────────────────────────────────────

export const seedEvents = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    const now = Date.now();
    const events = [
      {
        title: "Texas LTC Class — August 2026",
        slug: "texas-ltc-aug-2026",
        status: "published",
        description:
          "Texas License to Carry certification class. Covers Texas handgun laws, safe storage, and shooting proficiency qualification. All skill levels welcome. Bring your handgun and 50 rounds, or contact us about a loaner.",
        startAt: now + 14 * 24 * 60 * 60 * 1000,
        endAt: now + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
        location: "North Texas — contact us for venue details",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-ltc.jpg",
      },
      {
        title: "Level II Security Training — August 2026",
        slug: "level-2-security-aug-2026",
        status: "published",
        description:
          "Texas DPS-certified Level II unarmed security officer training. Required for all security officers in Texas. Register before seats fill — class sizes are intentionally small.",
        startAt: now + 21 * 24 * 60 * 60 * 1000,
        endAt: now + 21 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
        location: "North Texas — contact us for venue details",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-level2.jpg",
      },
      {
        title: "Level III + IV Bundle — September 2026",
        slug: "level-3-4-bundle-sep-2026",
        status: "published",
        description:
          "Two-day intensive combining Level III armed security and Level IV personal protection officer certification. Save $45 vs. taking them separately. Prerequisite: Level II license or enrol in our combo package.",
        startAt: now + 45 * 24 * 60 * 60 * 1000,
        endAt: now + 47 * 24 * 60 * 60 * 1000,
        location: "North Texas — contact us for venue details",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-sep-level34.jpg",
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
