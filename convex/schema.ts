import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
  }).index("by_slug", ["slug"]),

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
    priceCents: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    squareItemId: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

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
  }).index("by_site", ["siteId"]),

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
    url: v.string(),
    thumbnailUrl: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    optimizedSizeBytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    altText: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  squareConfig: defineTable({
    siteId: v.id("sites"),
    connected: v.boolean(),
    environment: v.string(),
    applicationId: v.optional(v.string()),
    locationId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    checkoutEnabled: v.boolean(),
  }).index("by_site", ["siteId"]),

  squareCatalogMappings: defineTable({
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    squareItemId: v.string(),
    squareVariationId: v.string(),
  }).index("by_site", ["siteId"]),

  emailSettings: defineTable({
    siteId: v.id("sites"),
    fromName: v.string(),
    fromEmail: v.string(),
    replyToEmail: v.string(),
    notifyOnNewLead: v.boolean(),
    notifyOnBooking: v.boolean(),
  }).index("by_site", ["siteId"]),

  contentVersions: defineTable({
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    snapshot: v.any(),
    createdByName: v.string(),
  }).index("by_site", ["siteId"]),

  activityLog: defineTable({
    siteId: v.id("sites"),
    actorName: v.string(),
    action: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    page: v.optional(v.string()),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    details: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  backups: defineTable({
    siteId: v.id("sites"),
    label: v.string(),
    sizeBytes: v.number(),
    snapshot: v.any(),
  }).index("by_site", ["siteId"]),

  crmConnections: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    status: v.string(),
    authMethod: v.string(),
    accountName: v.optional(v.string()),
    orgId: v.optional(v.string()),
    apiKeyEncrypted: v.optional(v.string()),
    apiKeyLast4: v.optional(v.string()),
    ssoEnabled: v.boolean(),
    apiHealth: v.string(),
    lastHealthCheckAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_provider", ["siteId", "provider"]),

  crmEntitySyncSettings: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    entityType: v.string(),
    direction: v.string(),
    enabled: v.boolean(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_provider_entity", ["siteId", "provider", "entityType", "direction"]),

  crmSyncLogs: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    entityType: v.string(),
    direction: v.string(),
    status: v.string(),
    entityRef: v.optional(v.string()),
    message: v.optional(v.string()),
    attempt: v.number(),
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
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    text: v.string(),
    avatarUrl: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
  }).index("by_site", ["siteId"]),

  pricingTiers: defineTable({
    siteId: v.id("sites"),
    planName: v.string(),
    price: v.optional(v.string()),
    interval: v.optional(v.string()),
    description: v.optional(v.string()),
    features: v.any(),
    isHighlighted: v.boolean(),
    ctaLabel: v.string(),
    ctaUrl: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
  }).index("by_site", ["siteId"]),

  formSubmissions: defineTable({
    siteId: v.id("sites"),
    formType: v.string(),
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
    submitterPhone: v.optional(v.string()),
    message: v.optional(v.string()),
    data: v.any(),
    status: v.string(),
    submittedAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_status", ["siteId", "status"]),

  siteHealthLogs: defineTable({
    siteId: v.id("sites"),
    url: v.string(),
    statusCode: v.optional(v.number()),
    responseMs: v.optional(v.number()),
    isUp: v.boolean(),
    error: v.optional(v.string()),
    checkedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_checkedAt", ["siteId", "checkedAt"]),
});
