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
    squareItemId: v.optional(v.string()),
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
    lastCatalogSyncAt: v.optional(v.number()),
    webhookSignatureKey: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  squareCatalogItems: defineTable({
    siteId: v.id("sites"),
    squareItemId: v.string(),
    squareVariationId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    category: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_squareItemId", ["siteId", "squareItemId"]),

  squareOrders: defineTable({
    siteId: v.id("sites"),
    squareOrderId: v.string(),
    squarePaymentId: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amountCents: v.number(),
    status: v.string(),
    refundStatus: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_squareOrderId", ["siteId", "squareOrderId"]),

  squareDiscounts: defineTable({
    siteId: v.id("sites"),
    squareDiscountId: v.string(),
    name: v.string(),
    code: v.optional(v.string()),
    discountType: v.string(),
    amount: v.optional(v.number()),
    percentage: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_squareDiscountId", ["siteId", "squareDiscountId"]),

  squareCatalogMappings: defineTable({
    siteId: v.id("sites"),
    entityType: v.string(),
    entityId: v.string(),
    squareItemId: v.string(),
    squareVariationId: v.optional(v.string()),
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
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
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
    syncPayload: v.optional(v.any()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_status", ["siteId", "status"])
    .index("by_site_entity", ["siteId", "entityType"]),

  // Inbound records written back from CRM → dashboard during polling
  crmInboundRecords: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    entityType: v.string(),
    crmRecordId: v.optional(v.string()),
    entityRef: v.optional(v.string()),
    payload: v.any(),
    appliedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_entity", ["siteId", "entityType"]),

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

  // Phase 3 — Form Builder
  forms: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    slug: v.string(),
    status: v.string(),
    fields: v.any(),
    settings: v.any(),
    templateType: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_slug", ["siteId", "slug"]),

  formSubmissions: defineTable({
    siteId: v.id("sites"),
    formId: v.optional(v.id("forms")),
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
    .index("by_site_status", ["siteId", "status"])
    .index("by_form", ["formId"]),

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

  // Phase 2 — Content Modules
  policyPages: defineTable({
    siteId: v.id("sites"),
    policyType: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_type", ["siteId", "policyType"]),

  navigationItems: defineTable({
    siteId: v.id("sites"),
    label: v.string(),
    href: v.string(),
    isVisible: v.boolean(),
    order: v.number(),
    openInNewTab: v.optional(v.boolean()),
  }).index("by_site", ["siteId"]),

  announcementBanner: defineTable({
    siteId: v.id("sites"),
    text: v.string(),
    bgColor: v.string(),
    link: v.optional(v.string()),
    isEnabled: v.boolean(),
  }).index("by_site", ["siteId"]),

  siteCtaConfig: defineTable({
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
    order: v.number(),
  }).index("by_site", ["siteId"]),

  teamMembers: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    role: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    credentials: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
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

  popupConfig: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    body: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    triggerType: v.string(),
    delaySecs: v.optional(v.number()),
    isEnabled: v.boolean(),
  }).index("by_site", ["siteId"]),

  // WOS Phase 2 — Website Settings™
  siteSettings: defineTable({
    siteId: v.id("sites"),
    // Identity
    businessName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    websiteType: v.optional(v.string()),
    timezone: v.optional(v.string()),
    // Branding
    brandColorPrimary: v.optional(v.string()),
    brandColorSecondary: v.optional(v.string()),
    brandColorAccent: v.optional(v.string()),
    fontHeading: v.optional(v.string()),
    fontBody: v.optional(v.string()),
    // Contact
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    businessHours: v.optional(v.any()),
    // Social links
    socialLinks: v.optional(v.any()),
    // SEO defaults
    seoGlobalTitle: v.optional(v.string()),
    seoGlobalDescription: v.optional(v.string()),
    seoOgImageUrl: v.optional(v.string()),
    // Integrations / Analytics
    analyticsGa4: v.optional(v.string()),
    analyticsGtm: v.optional(v.string()),
    analyticsPixel: v.optional(v.string()),
    cookieConsentEnabled: v.optional(v.boolean()),
    cookiePolicyUrl: v.optional(v.string()),
    // Legal
    privacyPolicyUrl: v.optional(v.string()),
    termsOfServiceUrl: v.optional(v.string()),
    // Per-section save timestamps
    identityUpdatedAt: v.optional(v.number()),
    brandingUpdatedAt: v.optional(v.number()),
    contactUpdatedAt: v.optional(v.number()),
    seoUpdatedAt: v.optional(v.number()),
    integrationsUpdatedAt: v.optional(v.number()),
    legalUpdatedAt: v.optional(v.number()),
  }).index("by_site", ["siteId"]),

  // Phase 9 — Client Permissions™
  siteRoleOverrides: defineTable({
    siteId: v.id("sites"),
    role: v.string(),
    module: v.string(),
    level: v.string(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_role", ["siteId", "role"]),

  websiteHealthScans: defineTable({
    siteId: v.id("sites"),
    overallScore: v.number(),
    status: v.string(),
    categoryScores: v.any(),
    scannedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_scannedAt", ["siteId", "scannedAt"]),

  healthNotifications: defineTable({
    siteId: v.id("sites"),
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    category: v.optional(v.string()),
    readAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
  }).index("by_site", ["siteId"]),

  // ── WOS Phase 1 — Payment Connector Framework™ ─────────────────────────────

  paymentConnectors: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    isActive: v.boolean(),
    status: v.string(),
    environment: v.optional(v.string()),
    credentialsCiphertext: v.optional(v.string()),
    credentialsMeta: v.optional(v.any()),
    hasWebhookKey: v.boolean(),
    checkoutEnabled: v.boolean(),
    healthStatus: v.optional(v.string()),
    healthMessage: v.optional(v.string()),
    lastHealthCheckAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    settings: v.optional(v.any()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_provider", ["siteId", "provider"])
    .index("by_site_active", ["siteId", "isActive"]),

  paymentEvents: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    eventType: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    status: v.string(),
    amountCents: v.optional(v.number()),
    currency: v.optional(v.string()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_provider", ["siteId", "provider"]),

  // Website Reviews Module™
  reviewSources: defineTable({
    siteId: v.id("sites"),
    provider: v.string(),
    config: v.any(),
    credentialsCiphertext: v.optional(v.string()),
    autoRefresh: v.boolean(),
    refreshIntervalHours: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    lastSyncStats: v.optional(
      v.object({
        upserted: v.number(),
        unchanged: v.number(),
        removed: v.number(),
      })
    ),
  })
    .index("by_site", ["siteId"])
    .index("by_site_provider", ["siteId", "provider"]),

  importedReviews: defineTable({
    siteId: v.id("sites"),
    sourceId: v.id("reviewSources"),
    provider: v.string(),
    externalId: v.string(),
    reviewerName: v.string(),
    reviewerPhotoUrl: v.optional(v.string()),
    rating: v.number(),
    text: v.optional(v.string()),
    reviewDate: v.number(),
    status: v.string(),
    pinned: v.boolean(),
    category: v.optional(v.string()),
    cachedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_site_status", ["siteId", "status"])
    .index("by_source", ["sourceId"])
    .index("by_site_external", ["siteId", "externalId"]),

  reviewDisplaySettings: defineTable({
    siteId: v.id("sites"),
    layout: v.string(),
    minRating: v.number(),
    maxPerPage: v.number(),
    featuredOnly: v.boolean(),
    showProviderBadge: v.boolean(),
  }).index("by_site", ["siteId"]),

  // WOS Phase 8 — Automation Engine™
  automationRules: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: v.string(),
    conditions: v.array(
      v.object({
        field: v.string(),
        operator: v.string(),
        value: v.string(),
      })
    ),
    actions: v.array(
      v.object({
        type: v.string(),
        order: v.number(),
        config: v.any(),
      })
    ),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    lastRunStatus: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_trigger", ["siteId", "triggerType"]),

  automationRunLog: defineTable({
    siteId: v.id("sites"),
    ruleId: v.id("automationRules"),
    ruleName: v.string(),
    triggerType: v.string(),
    triggerPayload: v.any(),
    status: v.string(),
    actionResults: v.array(
      v.object({
        actionType: v.string(),
        order: v.number(),
        status: v.string(),
        message: v.optional(v.string()),
      })
    ),
    completedAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_rule", ["ruleId"])
    .index("by_site_status", ["siteId", "status"]),
});
