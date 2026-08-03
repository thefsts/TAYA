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
      tagline: "Elite Training. Tactical Excellence.",
      logoUrl: "https://storage.googleapis.com/corsair-tactical/logo-white.png",
      faviconUrl: "https://storage.googleapis.com/corsair-tactical/favicon.ico",
      websiteType: "training_academy",
      timezone: "America/New_York",
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
      heroHeadline: "Elite Tactical Training for Professionals",
      heroSubheadline:
        "Corsair Tactical Solutions provides world-class firearms instruction, close-quarters combat training, and tactical leadership courses for law enforcement, military, and civilian professionals.",
      heroImageUrl: "https://storage.googleapis.com/corsair-tactical/hero-range.jpg",
      sections: [
        {
          type: "features",
          headline: "Why Choose Corsair Tactical",
          items: [
            {
              icon: "shield",
              title: "Expert Instructors",
              body: "All instructors are active or retired military and law enforcement with 15+ years of operational experience.",
            },
            {
              icon: "target",
              title: "Certified Programs",
              body: "NRA-certified and state-approved courses from beginner fundamentals to advanced tactical operations.",
            },
            {
              icon: "users",
              title: "Small Class Sizes",
              body: "Maximum 8 students per instructor ensures personalized attention and maximum skill development.",
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
      phone: "+1 (555) 847-2200",
      address: "1247 Tactical Way, Suite 100, Quantico, VA 22134",
      mapEmbedUrl:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3111.5!2d-77.34!3d38.52!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzjCsDMxJzA5LjIiTiA3N8KwMjAnMDguNCJX!5e0!3m2!1sen!2sus!4v1234567890",
      hours: [
        { day: "Monday", open: "08:00", close: "17:00" },
        { day: "Tuesday", open: "08:00", close: "17:00" },
        { day: "Wednesday", open: "08:00", close: "17:00" },
        { day: "Thursday", open: "08:00", close: "17:00" },
        { day: "Friday", open: "08:00", close: "17:00" },
        { day: "Saturday", open: "09:00", close: "14:00" },
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
        title: "Corsair Tactical Solutions — Elite Tactical Training in Quantico, VA",
        description:
          "Professional firearms instruction, close-quarters combat, and tactical leadership training. NRA-certified instructors. Small class sizes. Serving law enforcement, military, and civilians.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-home.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/",
      },
      {
        pagePath: "/courses",
        title: "Tactical Training Courses — Corsair Tactical Solutions",
        description:
          "Browse our full catalog of tactical training courses: firearms fundamentals, CQB, leadership & tactics, and more.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-courses.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/courses",
      },
      {
        pagePath: "/about",
        title: "About Corsair Tactical Solutions — Our Instructors & Mission",
        description:
          "Learn about Corsair Tactical Solutions, our experienced instructors, and our mission to provide elite tactical training to professionals and civilians.",
        ogImageUrl: "https://storage.googleapis.com/corsair-tactical/og-about.jpg",
        canonicalUrl: "https://corsairtacticalsolutions.com/about",
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
      title: "Tactical Defense Fundamentals: Building Your Foundation",
      slug: "tactical-defense-fundamentals",
      status: "published",
      excerpt:
        "Whether you're a first-time shooter or an experienced professional, mastering the fundamentals is the non-negotiable foundation of tactical proficiency.",
      body: `## Why Fundamentals Matter

In tactical training, there are no shortcuts. Every advanced skill—from room-clearing to vehicle extraction—is built on a foundation of mastered fundamentals. At Corsair Tactical Solutions, we see the results of skipped fundamentals every day: students who can't maintain accuracy under stress because they never truly owned their stance, grip, sight picture, and trigger control.

## The Four Pillars

**1. Stance and Platform**
Your platform is your base of stability under recoil and stress. The modified Weaver and Isosceles stances each have tactical applications. We teach both and help you identify which is right for your body mechanics.

**2. Grip**
A proper high-grip, thumbs-forward grip reduces muzzle flip and keeps you on target for follow-up shots. We use force-feedback training tools to help students feel the correct pressure before they fire a single round.

**3. Sight Alignment and Picture**
The front sight is your truth. In defensive situations, a properly aligned front sight on a slightly blurry target beats a perfect target focus every time. We train dry-fire fundamentals for two hours before students ever load a magazine.

**4. Trigger Control**
Trigger reset is the secret most shooters don't learn until they've been shooting for years. We teach it on Day 1.

## Join Our Next Fundamentals Course

Our next **Firearms Fundamentals** course runs the second Saturday of every month. Class size is capped at 8 students. [Register here](/courses/firearms-fundamentals).`,
      coverImageUrl: "https://storage.googleapis.com/corsair-tactical/blog-fundamentals.jpg",
      publishedAt: now - 7 * 24 * 60 * 60 * 1000, // 1 week ago
      category: "Training",
      author: "Sgt. Marcus Webb (Ret.)",
      readingTime: "6 min read",
      tags: ["fundamentals", "firearms", "training", "beginners"],
      featured: true,
      seoTitle: "Tactical Defense Fundamentals — Corsair Tactical Solutions",
      metaDescription:
        "Learn why mastering the fundamentals of stance, grip, sight alignment, and trigger control is the non-negotiable foundation of every tactical skill.",
    });

    await ctx.db.insert("articles", {
      siteId,
      title: "Choosing Your First Defensive Firearm: A Practical Guide",
      slug: "choosing-first-defensive-firearm",
      status: "published",
      excerpt:
        "With thousands of handguns on the market, first-time buyers are overwhelmed. Here's the framework our instructors use when advising new students.",
      body: `## The Wrong Way to Choose

Most people buy their first defensive firearm based on what a friend owns, what looked cool at the gun store, or what was on sale. None of these are good criteria.

## Our Selection Framework

We advise every new student to evaluate a firearm on five criteria before purchasing:

1. **Ergonomic fit** — Can you reach the trigger with a proper grip? Can you operate all controls without shifting your grip?
2. **Reliability** — Has the model been proven reliable with a wide variety of ammunition?
3. **Caliber** — For defensive use, the 9mm offers the best balance of capacity, recoil, and terminal performance for most shooters.
4. **Concealability** — If you plan to carry, size matters. Full-size pistols are easier to shoot accurately but harder to carry all day.
5. **Maintenance** — You should be able to field-strip, clean, and reassemble your firearm without needing a manual.

## Our Top Recommendations for 2026

We have no sponsorship relationships and no financial incentive to recommend any particular firearm. Our recommendations are based solely on instructor experience and student outcomes.

**For beginners:** Glock 19 (9mm) — reliable, common, parts-abundant  
**For smaller hands:** SIG Sauer P365 (9mm) — exceptional ergonomics for smaller frames  
**For budget buyers:** Smith & Wesson M&P Shield Plus — proven reliability at a lower price point`,
      coverImageUrl: "https://storage.googleapis.com/corsair-tactical/blog-first-handgun.jpg",
      publishedAt: now - 14 * 24 * 60 * 60 * 1000, // 2 weeks ago
      category: "Gear",
      author: "Lt. Dana Hargrove (Ret.)",
      readingTime: "8 min read",
      tags: ["gear", "handguns", "beginners", "buying-guide"],
      featured: false,
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
        title: "Firearms Fundamentals",
        slug: "firearms-fundamentals",
        status: "published",
        description:
          "The essential foundation course for new and returning shooters. Covers safe handling, stance, grip, sight alignment, trigger control, and basic malfunction clearing. NRA Basic Pistol certified.",
        durationLabel: "8 hours (1 day)",
        priceCents: 24900,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-fundamentals.jpg",
      },
      {
        title: "Close-Quarters Battle (CQB) Foundations",
        slug: "cqb-foundations",
        status: "published",
        description:
          "Builds on the fundamentals course. Introduces room-clearing concepts, hallway tactics, angle shooting, and team movement. Requires completion of Firearms Fundamentals or equivalent demonstrated proficiency.",
        durationLabel: "16 hours (2 days)",
        priceCents: 49900,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-cqb.jpg",
      },
      {
        title: "Tactical Leadership & Decision-Making",
        slug: "leadership-tactics",
        status: "published",
        description:
          "Designed for team leaders, supervisors, and professionals who must make high-stakes decisions under stress. Combines scenario-based tactical exercises with leadership frameworks.",
        durationLabel: "24 hours (3 days)",
        priceCents: 89900,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-leadership.jpg",
      },
      {
        title: "Defensive Driving for Professionals",
        slug: "defensive-driving",
        status: "draft",
        description:
          "Coming Spring 2027 — advanced vehicle operations including evasive maneuvers, counter-ambush driving, and protective detail techniques. Registration opens January 2027.",
        durationLabel: "8 hours (1 day)",
        priceCents: 34900,
        imageUrl: "https://storage.googleapis.com/corsair-tactical/course-driving.jpg",
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
        title: "Firearms Fundamentals — August 2026",
        slug: "firearms-fundamentals-aug-2026",
        status: "published",
        description:
          "Monthly Firearms Fundamentals course. Limited to 8 students. All skill levels welcome. Loaner firearms available for first-time students who don't yet own a firearm.",
        startAt: now + 14 * 24 * 60 * 60 * 1000, // 2 weeks from now
        endAt: now + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
        location: "Corsair Range Facility, 1247 Tactical Way, Quantico VA",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-fundamentals.jpg",
      },
      {
        title: "CQB Foundations — August 2026 (Weekend Intensive)",
        slug: "cqb-foundations-aug-2026",
        status: "published",
        description:
          "Two-day close-quarters battle foundations course. Prerequisite: Firearms Fundamentals or demonstrated proficiency screening. Gear list provided upon registration.",
        startAt: now + 21 * 24 * 60 * 60 * 1000,
        endAt: now + 23 * 24 * 60 * 60 * 1000,
        location: "Corsair Range Facility, 1247 Tactical Way, Quantico VA",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-aug-cqb.jpg",
      },
      {
        title: "Tactical Leadership Intensive — September 2026",
        slug: "leadership-intensive-sep-2026",
        status: "published",
        description:
          "Three-day leadership and decision-making course. Designed for team leaders, supervisors, and security professionals. Includes scenario-based exercises and after-action reviews.",
        startAt: now + 45 * 24 * 60 * 60 * 1000,
        endAt: now + 48 * 24 * 60 * 60 * 1000,
        location: "Corsair Training Campus, 1247 Tactical Way, Quantico VA",
        imageUrl: "https://storage.googleapis.com/corsair-tactical/event-sep-leadership.jpg",
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
        name: "Officer James Whitfield",
        role: "Patrol Supervisor",
        company: "Fairfax County Police Department",
        rating: 5,
        text: "Corsair's CQB Foundations course is the most realistic, practical training I've taken outside of SWAT pre-qualification. Sgt. Webb's instruction style is direct, high-rep, and zero filler. Every officer on my team has now completed at least one Corsair course.",
        isActive: true,
        order: 0,
      },
      {
        name: "Cassandra Torres",
        role: "Private Security Contractor",
        company: "SecureStrike LLC",
        rating: 5,
        text: "I've been to a lot of training facilities and most of them are just range time with an instructor who reads slides. Corsair is different — the instructors actually teach you to think, not just shoot. The Leadership & Tactics course changed how I approach every job.",
        isActive: true,
        order: 1,
      },
      {
        name: "Marcus Delgado",
        role: "Veteran / Civilian Student",
        company: "",
        rating: 5,
        text: "I left the Army three years ago and wanted to refresh my tactical skills. The Firearms Fundamentals course was a perfect reset — rigorous enough to challenge a vet but thorough enough that I relearned things I thought I already knew.",
        isActive: true,
        order: 2,
      },
      {
        name: "Lt. Sarah Okonkwo (Ret.)",
        role: "Retired Navy EOD / Security Consultant",
        company: "Independent",
        rating: 5,
        text: "As a retired EOD officer, I was skeptical there was much new I could learn in a civilian course. I was wrong. The scenario design at Corsair reflects current threat environments, not textbook situations from 15 years ago.",
        isActive: true,
        order: 3,
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
      reviewerName: "Michael Brennan",
      rating: 5,
      text: "Best tactical training I've found outside of military service. Instructors are professional, curriculum is current, and the facility is first-rate. Took the CQB course last fall and enrolled in the Leadership course for next month.",
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
      reviewerName: "Priya Nair",
      rating: 5,
      text: "Completed Firearms Fundamentals as a complete beginner. Dana Hargrove is an exceptional instructor — patient, knowledgeable, and safety-first without being condescending. Left feeling genuinely confident and safe with a firearm.",
      reviewDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      status: "approved",
      pinned: false,
      cachedAt: Date.now(),
    });

    return { ok: true, step: "reviews", count: 2 };
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

    const failed = Object.entries(results).filter(([, v]: any) => v?.error);
    return {
      success: failed.length === 0,
      failed: failed.length,
      results,
    };
  },
});
