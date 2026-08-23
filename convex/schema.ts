import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Phase 10 — Agency Edition™
  agencies: defineTable({
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    primaryColor: v.string(),
    accentColor: v.string(),
    supportEmail: v.string(),
    helpCenterUrl: v.optional(v.string()),
    featureFlags: v.any(),
    licensingStatus: v.string(),
    billingNotes: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  sites: defineTable({
    name: v.string(),
    slug: v.string(),
    status: v.string(),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    brandColorPrimary: v.string(),
    brandColorSecondary: v.string(),
    whiteLabelEnabled: v.boolean(),
    poweredByFsts: v.boolean(),
    websiteType: v.string(),
    enabledModules: v.any(),
    // Phase 10 — Agency Edition™
    agencyId: v.optional(v.id("agencies")),
    reviewsWidgetCdnMigrated: v.optional(v.boolean()),
    reviewsWidgetInlineEverUsed: v.optional(v.boolean()),
  }).index("by_slug", ["slug"]).index("by_agency", ["agencyId"]),

  users: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    isSuperAdmin: v.boolean(),
    isActive: v.boolean(),
    roles: v.array(
      v.object({
        siteId: v.id("sites"),
        role: v.string(),
      }),
    ),
    // Clerk invitation metadata. No invitation ticket, session token, password,
    // or other secret is ever persisted in Convex.
    inviteStatus: v.optional(v.string()),
    invitedAt: v.optional(v.number()),
    clerkInvitationId: v.optional(v.string()),
    invitationLastError: v.optional(v.string()),
    // Phase 10 — Agency Edition™
    agencyId: v.optional(v.id("agencies")),
    isAgencyAdmin: v.optional(v.boolean()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  homepageContent: defineTable({
    siteId: v.id("sites"),
    heroHeadline: v.string(),
    heroSubheadline: v.string(),
    heroImageUrl: v.optional(v.string()),
    sections: v.any(),
  }).index("by_site", ["siteId"]),

  footerContent: defineTable({
    siteId: v.id("sites"),
    columns: v.any(),
    socialLinks: v.any(),
    copyrightText: v.string(),
  }).index("by_site", ["siteId"]),

  contactInfo: defineTable({
    siteId: v.id("sites"),
    email: v.string(),
    phone: v.string(),
    address: v.string(),
    mapEmbedUrl: v.optional(v.string()),
    hours: v.any(),
  }).index("by_site", ["siteId"]),

  courses: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.string(),
    description: v.string(),
    durationLabel: v.optional(v.string()),
    /** Price in integer minor units (cents). null = explicitly cleared; absent = not set. */
    priceCents: v.optional(v.union(v.number(), v.null())),
    /** Exempts an intentionally contact-only course from online checkout and price requirements. */
    contactOnly: v.optional(v.boolean()),
    /** Course is fulfilled by an external provider rather than the local checkout flow. */
    externalCourse: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    // ── Capacity & Registration fields ───────────────────────────────────
    capacity: v.optional(v.number()),
    waitlistCapacity: v.optional(v.number()),
    registrationOpenAt: v.optional(v.number()),
    registrationCloseAt: v.optional(v.number()),
    startDateTime: v.optional(v.number()),
    endDateTime: v.optional(v.number()),
    timezone: v.optional(v.string()),
    lifecycleStatus: v.optional(v.string()),
    registrationStatus: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    autoCloseRegistration: v.optional(v.boolean()),
    autoArchive: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_lifecycleStatus", ["siteId", "lifecycleStatus"]),

  events: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.string(),
    description: v.string(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
    /** Price in integer minor units (cents). null = explicitly cleared; absent = not set. */
    priceCents: v.optional(v.union(v.number(), v.null())),
    /**
     * Optional reference to a course slug on the same site.
     * When set and no matching course slug exists, the event is considered
     * "orphaned" and flagged in the admin dashboard.
     */
    courseSlug: v.optional(v.string()),
    // ── Capacity & Registration fields ───────────────────────────────────
    capacity: v.optional(v.number()),
    waitlistCapacity: v.optional(v.number()),
    registrationOpenAt: v.optional(v.number()),
    registrationCloseAt: v.optional(v.number()),
    startDateTime: v.optional(v.number()),
    endDateTime: v.optional(v.number()),
    timezone: v.optional(v.string()),
    lifecycleStatus: v.optional(v.string()),
    registrationStatus: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    autoCloseRegistration: v.optional(v.boolean()),
    autoArchive: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_lifecycleStatus", ["siteId", "lifecycleStatus"]),

  // ── Registrations ─────────────────────────────────────────────────────
  registrations: defineTable({
    siteId: v.id("sites"),
    entityType: v.union(v.literal("course"), v.literal("event")),
    entityId: v.string(),
    // userId: Clerk user ID for dashboard-managed registrations; customerEmail
    // for public bookings (kept for backward-compat with existing promotion/
    // cancellation logic that checks userId.includes("@")).
    userId: v.string(),
    status: v.union(
      v.literal("confirmed"),
      v.literal("waitlisted"),
      v.literal("cancelled"),
    ),
    registeredAt: v.number(),
    cancelledAt: v.optional(v.number()),
    promotedFromWaitlistAt: v.optional(v.number()),
    // ── Public-booking customer fields (optional; absent for admin-created) ──
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    // "public" | "admin"
    bookingSource: v.optional(v.string()),
    // "registered" | "attended" | "no_show"
    attendanceStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
    termsAccepted: v.optional(v.boolean()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId", "entityType"])
    .index("by_site_entity", ["siteId", "entityType", "entityId"])
    .index("by_customer_email", ["siteId", "customerEmail"]),

  articles: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    slug: v.string(),
    status: v.string(),
    excerpt: v.optional(v.string()),
    body: v.string(),
    coverImageUrl: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    category: v.optional(v.string()),
    author: v.optional(v.string()),
    readingTime: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featured: v.optional(v.boolean()),
    scheduledAt: v.optional(v.number()),
    seoTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    socialTitle: v.optional(v.string()),
    socialDescription: v.optional(v.string()),
    socialImageUrl: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_status", ["siteId", "status"]),

  seoSettings: defineTable({
    siteId: v.id("sites"),
    pagePath: v.string(),
    title: v.string(),
    description: v.string(),
    ogImageUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_path", ["siteId", "pagePath"]),

  mediaAssets: defineTable({
    siteId: v.id("sites"),
    // storageId is set for files uploaded via Convex File Storage (new path)
    storageId: v.optional(v.id("_storage")),
    // url is kept for externally-linked images (URL tab) and legacy records
    url: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    optimizedSizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    altText: v.optional(v.string()),
    /** Normalized focal point X coordinate (0–1). Used as CSS object-position. */
    focalX: v.optional(v.number()),
    /** Normalized focal point Y coordinate (0–1). Used as CSS object-position. */
    focalY: v.optional(v.number()),
    // ── Enhanced Media Library fields ──────────────────────────────────────────
    /** Free-form tag strings for filtering and organisation */
    tags: v.optional(v.array(v.string())),
    /** Free-form category string for grouping */
    category: v.optional(v.string()),
    /** When true, asset is hidden from pickers but URL remains live */
    archived: v.optional(v.boolean()),
    /** Cached count of content records referencing this asset */
    usageCount: v.optional(v.number()),
    // ── Derivative variants generated server-side by media.generateDerivatives ──
    /** 150px wide WebP thumbnail for UI grids and thumbnails */
    thumbStorageId: v.optional(v.id("_storage")),
    /** 400px wide WebP for small display contexts */
    smallStorageId: v.optional(v.id("_storage")),
    /** 800px wide WebP for standard content areas */
    mediumStorageId: v.optional(v.id("_storage")),
    /** 1400px wide WebP for large display contexts */
    largeStorageId: v.optional(v.id("_storage")),
    /** 2400px wide WebP for hero / full-bleed slots */
    large2xStorageId: v.optional(v.id("_storage")),
    /** When derivatives were generated (ms since epoch) */
    derivativesGeneratedAt: v.optional(v.number()),
    /** Processing state for derivative generation */
    processingStatus: v.optional(v.string()),
    /** Last derivative generation error, if any */
    processingError: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  siteSettings: defineTable({
    siteId: v.id("sites"),
    businessName: v.string(),
    tagline: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    notificationEmail: v.optional(v.string()),
    senderName: v.optional(v.string()),
    replyToEmail: v.optional(v.string()),
    googlePlaceId: v.optional(v.string()),
    timezone: v.optional(v.string()),
    locale: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  navigationItems: defineTable({
    siteId: v.id("sites"),
    label: v.string(),
    href: v.string(),
    order: v.number(),
    isVisible: v.boolean(),
    openInNewTab: v.optional(v.boolean()),
  }).index("by_site", ["siteId"]),

  announcementBanners: defineTable({
    siteId: v.id("sites"),
    text: v.string(),
    bgColor: v.string(),
    link: v.optional(v.string()),
    isEnabled: v.boolean(),
  }).index("by_site", ["siteId"]),

  ctaSettings: defineTable({
    siteId: v.id("sites"),
    primaryLabel: v.string(),
    primaryUrl: v.string(),
    secondaryLabel: v.optional(v.string()),
    secondaryUrl: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  downloadableResources: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    format: v.optional(v.string()),
    sizeLabel: v.optional(v.string()),
    category: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_site", ["siteId"]),

  jobPostings: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    jobType: v.string(),
    location: v.optional(v.string()),
    description: v.string(),
    applyUrl: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_site", ["siteId"]),

  popupSettings: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    body: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    triggerType: v.string(),
    delaySecs: v.optional(v.number()),
    isEnabled: v.boolean(),
  }).index("by_site", ["siteId"]),

  faqs: defineTable({
    siteId: v.id("sites"),
    question: v.string(),
    answer: v.string(),
    order: v.number(),
    isActive: v.boolean(),
  }).index("by_site", ["siteId"]),

  testimonials: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    role: v.optional(v.string()),
    quote: v.string(),
    rating: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_site", ["siteId"]),

  formDefinitions: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    fields: v.any(),
    submitLabel: v.optional(v.string()),
    successMessage: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_slug", ["siteId", "slug"]),

  formSubmissions: defineTable({
    siteId: v.id("sites"),
    formId: v.id("formDefinitions"),
    values: v.any(),
    submittedAt: v.number(),
    status: v.string(),
    notes: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_form", ["formId"]),

  activityLog: defineTable({
    siteId: v.id("sites"),
    actorName: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    page: v.optional(v.string()),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_site", ["siteId"]),

  portalUsers: defineTable({
    siteId: v.id("sites"),
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_email", ["siteId", "email"]),

  portalSessions: defineTable({
    siteId: v.id("sites"),
    portalUserId: v.id("portalUsers"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_token_hash", ["tokenHash"]),
});
