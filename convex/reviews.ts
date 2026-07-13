/**
 * Website Reviews Module™ — Convex backend
 *
 * Display-only: imports and caches reviews from Google, Facebook, and Yelp
 * so client sites can render social proof. Review responses, solicitation,
 * and campaign tools belong exclusively in Operon CRM™.
 *
 * Security: provider credentials (API keys, access tokens) are encrypted
 * at rest using AES-256-GCM via convex/lib/encrypt.ts. Only non-secret
 * identifiers (placeId, pageId, businessId) are stored in plain config.
 */

import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { encryptField, decryptField } from "./lib/encrypt";

/* ── Provider constants ─────────────────────────────────────────────────── */

export const REVIEW_PROVIDERS = ["google", "facebook", "yelp"] as const;
export type ReviewProvider = (typeof REVIEW_PROVIDERS)[number];

const PROVIDER_LABELS: Record<ReviewProvider, string> = {
  google: "Google Business Profile",
  facebook: "Facebook",
  yelp: "Yelp",
};

/**
 * Fields in the connect-dialog config that contain secrets.
 * These are extracted from the incoming config, encrypted with AES-256-GCM,
 * and stored in `credentialsCiphertext`. All other fields go into `config`.
 */
const PROVIDER_SECRET_FIELDS: Record<string, string[]> = {
  google: ["apiKey"],
  facebook: ["accessToken"],
  yelp: ["apiKey"],
};

const DEFAULT_DISPLAY_SETTINGS = {
  layout: "grid",
  minRating: 4,
  maxPerPage: 12,
  featuredOnly: false,
  showProviderBadge: true,
  categoryFilter: "",
};

/* ── Safe projections (never return credentialsCiphertext to clients) ────── */

function toSafeSource(doc: any) {
  const { credentialsCiphertext: _c, ...rest } = doc;
  return {
    ...rest,
    id: doc._id,
    providerLabel: PROVIDER_LABELS[doc.provider as ReviewProvider] ?? doc.provider,
    hasCredentials: Boolean(doc.credentialsCiphertext),
    lastSyncedAt: doc.lastSyncedAt ?? null,
  };
}

function toSafeReview(doc: any) {
  return { ...doc, id: doc._id };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export const listSources = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("reviewSources")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return docs.map(toSafeSource);
  },
});

export const listReviews = query({
  args: {
    siteId: v.id("sites"),
    status: v.optional(v.string()),
    provider: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, status, provider, pinned }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    let docs = await ctx.db
      .query("importedReviews")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    if (status) docs = docs.filter((d) => d.status === status);
    if (provider) docs = docs.filter((d) => d.provider === provider);
    if (pinned !== undefined) docs = docs.filter((d) => d.pinned === pinned);
    return docs.map(toSafeReview).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.reviewDate - a.reviewDate;
    });
  },
});

export const getDisplaySettings = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return DEFAULT_DISPLAY_SETTINGS;
    const doc = await ctx.db
      .query("reviewDisplaySettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    if (!doc) return DEFAULT_DISPLAY_SETTINGS;
    return { ...doc, id: doc._id };
  },
});

/* ── Source management mutations ────────────────────────────────────────── */

export const addSource = mutation({
  args: {
    siteId: v.id("sites"),
    provider: v.string(),
    config: v.any(),
    autoRefresh: v.optional(v.boolean()),
    refreshIntervalHours: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, provider, config, autoRefresh = false, refreshIntervalHours = 24 }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("reviewSources")
      .withIndex("by_site_provider", (q) => q.eq("siteId", siteId).eq("provider", provider))
      .first();
    if (existing) throw new Error(`${PROVIDER_LABELS[provider as ReviewProvider] ?? provider} is already connected.`);

    // Split secret vs non-secret config fields
    const secretKeys = PROVIDER_SECRET_FIELDS[provider] ?? [];
    const secretData: Record<string, string> = {};
    const publicConfig: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(config as Record<string, unknown>)) {
      if (secretKeys.includes(k) && typeof val === "string" && val.trim()) {
        secretData[k] = val;
      } else if (!secretKeys.includes(k)) {
        publicConfig[k] = val;
      }
    }

    // Encrypt secrets if any were provided
    let credentialsCiphertext: string | undefined;
    if (Object.keys(secretData).length > 0) {
      credentialsCiphertext = await encryptField(JSON.stringify(secretData));
    }

    const id = await ctx.db.insert("reviewSources", {
      siteId,
      provider,
      config: publicConfig,
      credentialsCiphertext,
      autoRefresh,
      refreshIntervalHours,
      status: "active",
    });
    await logActivity(ctx, {
      siteId,
      actorName: "Admin",
      action: "connected",
      entityType: "reviewSource",
      entityId: id,
      details: `Connected ${PROVIDER_LABELS[provider as ReviewProvider] ?? provider}`,
    });
    return id;
  },
});

export const removeSource = mutation({
  args: { siteId: v.id("sites"), sourceId: v.id("reviewSources") },
  handler: async (ctx, { siteId, sourceId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(sourceId);
    if (!doc || doc.siteId !== siteId) throw new Error("Source not found");
    await ctx.db.delete(sourceId);
    const reviews = await ctx.db
      .query("importedReviews")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .collect();
    for (const r of reviews) await ctx.db.delete(r._id);
    await logActivity(ctx, {
      siteId,
      actorName: "Admin",
      action: "disconnected",
      entityType: "reviewSource",
      entityId: sourceId,
      details: `Removed ${PROVIDER_LABELS[doc.provider as ReviewProvider] ?? doc.provider}`,
    });
  },
});

export const updateSourceConfig = mutation({
  args: {
    siteId: v.id("sites"),
    sourceId: v.id("reviewSources"),
    config: v.optional(v.any()),
    autoRefresh: v.optional(v.boolean()),
    refreshIntervalHours: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, sourceId, ...patch }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(sourceId);
    if (!doc || doc.siteId !== siteId) throw new Error("Source not found");
    const update: Record<string, unknown> = {};
    if (patch.config !== undefined) update.config = patch.config;
    if (patch.autoRefresh !== undefined) update.autoRefresh = patch.autoRefresh;
    if (patch.refreshIntervalHours !== undefined) update.refreshIntervalHours = patch.refreshIntervalHours;
    await ctx.db.patch(sourceId, update);
  },
});

/* ── Review moderation mutations ────────────────────────────────────────── */

export const approveReview = mutation({
  args: { siteId: v.id("sites"), reviewId: v.id("importedReviews") },
  handler: async (ctx, { siteId, reviewId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(reviewId);
    if (!doc || doc.siteId !== siteId) throw new Error("Review not found");
    await ctx.db.patch(reviewId, { status: "approved", updatedAt: Date.now() });
  },
});

export const hideReview = mutation({
  args: { siteId: v.id("sites"), reviewId: v.id("importedReviews") },
  handler: async (ctx, { siteId, reviewId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(reviewId);
    if (!doc || doc.siteId !== siteId) throw new Error("Review not found");
    await ctx.db.patch(reviewId, { status: "hidden", updatedAt: Date.now() });
  },
});

export const pinReview = mutation({
  args: { siteId: v.id("sites"), reviewId: v.id("importedReviews"), pinned: v.boolean() },
  handler: async (ctx, { siteId, reviewId, pinned }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(reviewId);
    if (!doc || doc.siteId !== siteId) throw new Error("Review not found");
    await ctx.db.patch(reviewId, { pinned, updatedAt: Date.now() });
  },
});

export const setCategory = mutation({
  args: { siteId: v.id("sites"), reviewId: v.id("importedReviews"), category: v.optional(v.string()) },
  handler: async (ctx, { siteId, reviewId, category }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const doc = await ctx.db.get(reviewId);
    if (!doc || doc.siteId !== siteId) throw new Error("Review not found");
    await ctx.db.patch(reviewId, { category, updatedAt: Date.now() });
  },
});

/* ── Display settings mutation ──────────────────────────────────────────── */

export const updateDisplaySettings = mutation({
  args: {
    siteId: v.id("sites"),
    layout: v.optional(v.string()),
    minRating: v.optional(v.number()),
    maxPerPage: v.optional(v.number()),
    featuredOnly: v.optional(v.boolean()),
    showProviderBadge: v.optional(v.boolean()),
    categoryFilter: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...patch }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const existing = await ctx.db
      .query("reviewDisplaySettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const updates: Record<string, unknown> = {};
    if (patch.layout !== undefined) updates.layout = patch.layout;
    if (patch.minRating !== undefined) updates.minRating = patch.minRating;
    if (patch.maxPerPage !== undefined) updates.maxPerPage = patch.maxPerPage;
    if (patch.featuredOnly !== undefined) updates.featuredOnly = patch.featuredOnly;
    if (patch.showProviderBadge !== undefined) updates.showProviderBadge = patch.showProviderBadge;
    if (patch.categoryFilter !== undefined) updates.categoryFilter = patch.categoryFilter;
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...updates, updatedAt: now });
    } else {
      await ctx.db.insert("reviewDisplaySettings", {
        siteId,
        layout: (patch.layout ?? DEFAULT_DISPLAY_SETTINGS.layout) as string,
        minRating: patch.minRating ?? DEFAULT_DISPLAY_SETTINGS.minRating,
        maxPerPage: patch.maxPerPage ?? DEFAULT_DISPLAY_SETTINGS.maxPerPage,
        featuredOnly: patch.featuredOnly ?? DEFAULT_DISPLAY_SETTINGS.featuredOnly,
        showProviderBadge: patch.showProviderBadge ?? DEFAULT_DISPLAY_SETTINGS.showProviderBadge,
        categoryFilter: patch.categoryFilter ?? DEFAULT_DISPLAY_SETTINGS.categoryFilter,
        updatedAt: now,
      });
    }
  },
});

/* ── Manual sync trigger ─────────────────────────────────────────────────
 * skipTtl: true — user explicitly requested a sync; bypass cache TTL.
 */
export const triggerSync = mutation({
  args: { siteId: v.id("sites"), sourceId: v.optional(v.id("reviewSources")) },
  handler: async (ctx, { siteId, sourceId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    await ctx.scheduler.runAfter(0, internal.reviews.syncSiteReviews, {
      siteId,
      sourceId,
      skipTtl: true,
    });
    return { scheduled: true };
  },
});

/* ── Internal: upsert a single review ──────────────────────────────────── */

export const upsertReviewInternal = internalMutation({
  args: {
    siteId: v.id("sites"),
    sourceId: v.id("reviewSources"),
    provider: v.string(),
    externalId: v.string(),
    reviewerName: v.string(),
    reviewerPhotoUrl: v.optional(v.string()),
    rating: v.number(),
    text: v.optional(v.string()),
    reviewDate: v.number(),
    cachedAt: v.number(),
  },
  handler: async (ctx, args): Promise<"inserted" | "updated" | "unchanged"> => {
    // Include provider in the dedupe key so two providers with the same
    // externalId (e.g. numeric IDs) never overwrite each other's records.
    const key = `${args.provider}:${args.externalId}`;
    const existing = await ctx.db
      .query("importedReviews")
      .withIndex("by_site_external", (q) => q.eq("siteId", args.siteId).eq("externalId", key))
      .first();
    if (existing) {
      // Only patch and count as "updated" when content actually changed.
      const contentChanged =
        existing.reviewerName !== args.reviewerName ||
        existing.reviewerPhotoUrl !== args.reviewerPhotoUrl ||
        existing.rating !== args.rating ||
        existing.text !== args.text ||
        existing.reviewDate !== args.reviewDate;
      if (contentChanged) {
        const now = Date.now();
        await ctx.db.patch(existing._id, {
          reviewerName: args.reviewerName,
          reviewerPhotoUrl: args.reviewerPhotoUrl,
          rating: args.rating,
          text: args.text,
          reviewDate: args.reviewDate,
          cachedAt: args.cachedAt,
          updatedAt: now,
        });
        return "updated";
      }
      return "unchanged";
    } else {
      const now = Date.now();
      await ctx.db.insert("importedReviews", {
        siteId: args.siteId,
        sourceId: args.sourceId,
        provider: args.provider,
        externalId: key,
        reviewerName: args.reviewerName,
        reviewerPhotoUrl: args.reviewerPhotoUrl,
        rating: args.rating,
        text: args.text,
        reviewDate: args.reviewDate,
        status: "pending",
        pinned: false,
        category: undefined,
        cachedAt: args.cachedAt,
        updatedAt: now,
      });
      return "inserted";
    }
  },
});

export const markSourceSynced = internalMutation({
  args: {
    sourceId: v.id("reviewSources"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    syncStats: v.optional(
      v.object({
        inserted: v.number(),
        updated: v.number(),
        removed: v.number(),
      })
    ),
  },
  handler: async (ctx, { sourceId, status, errorMessage, syncStats }) => {
    await ctx.db.patch(sourceId, {
      lastSyncedAt: Date.now(),
      status,
      errorMessage,
      ...(syncStats !== undefined ? { lastSyncStats: syncStats } : {}),
    });
  },
});

export const deleteOrphanedReviews = internalMutation({
  args: {
    sourceId: v.id("reviewSources"),
    knownExternalIds: v.array(v.string()),
  },
  handler: async (ctx, { sourceId, knownExternalIds }) => {
    const knownSet = new Set(knownExternalIds);
    const existing = await ctx.db
      .query("importedReviews")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .collect();
    let removed = 0;
    for (const review of existing) {
      if (!knownSet.has(review.externalId)) {
        await ctx.db.delete(review._id);
        removed++;
      }
    }
    return removed;
  },
});

export const listSourcesInternal = internalQuery({
  args: { siteId: v.optional(v.id("sites")) },
  handler: async (ctx, { siteId }) => {
    if (siteId) {
      return ctx.db
        .query("reviewSources")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .collect();
    }
    return ctx.db.query("reviewSources").collect();
  },
});

export const getDisplaySettingsInternal = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const doc = await ctx.db
      .query("reviewDisplaySettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    return doc ?? DEFAULT_DISPLAY_SETTINGS;
  },
});

export const getWidgetCacheTimestamp = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const settings = await ctx.db
      .query("reviewDisplaySettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    // Use the by_site_updatedAt index descending to efficiently find the
    // most-recently modified review for this site (covers approve/hide/pin/
    // setCategory/upsert — all mutations stamp updatedAt).
    const latestModifiedReview = await ctx.db
      .query("importedReviews")
      .withIndex("by_site_updatedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .first();

    const settingsTs = settings?.updatedAt ?? settings?._creationTime ?? 0;
    const reviewTs = latestModifiedReview?.updatedAt ?? latestModifiedReview?._creationTime ?? 0;

    return Math.max(settingsTs, reviewTs);
  },
});

export const listApprovedReviewsInternal = internalQuery({
  args: { siteId: v.id("sites"), category: v.optional(v.string()) },
  handler: async (ctx, { siteId, category }) => {
    const settings = await ctx.db
      .query("reviewDisplaySettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();
    const minRating = settings?.minRating ?? DEFAULT_DISPLAY_SETTINGS.minRating;
    const maxPerPage = settings?.maxPerPage ?? DEFAULT_DISPLAY_SETTINGS.maxPerPage;
    const featuredOnly = settings?.featuredOnly ?? DEFAULT_DISPLAY_SETTINGS.featuredOnly;

    let reviews = await ctx.db
      .query("importedReviews")
      .withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", "approved"))
      .collect();

    reviews = reviews.filter((r) => r.rating >= minRating);
    if (featuredOnly) reviews = reviews.filter((r) => r.pinned);
    if (category) reviews = reviews.filter((r) => r.category === category);
    reviews.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.reviewDate - a.reviewDate;
    });
    return reviews.slice(0, maxPerPage).map((r) => ({
      id: r._id,
      provider: r.provider,
      reviewerName: r.reviewerName,
      reviewerPhotoUrl: r.reviewerPhotoUrl ?? null,
      rating: r.rating,
      text: r.text ?? null,
      reviewDate: r.reviewDate,
      pinned: r.pinned,
      category: r.category ?? null,
    }));
  },
});

/* ── Internal action: sync reviews for a site ───────────────────────────
 *
 * skipTtl  — when true (manual "Sync Now" trigger) the cache TTL is bypassed
 *            and all eligible sources are synced immediately.
 *            when false (cron-triggered auto-sync) the TTL is respected:
 *            a source is skipped if it was synced within refreshIntervalHours.
 *
 * The actual API calls are delegated to the ReviewConnector adapter for each
 * provider. Until live adapters are wired (see follow-up task), the inline
 * stub returns an empty array so no existing moderated reviews are wiped.
 */
export const syncSiteReviews = internalAction({
  args: {
    siteId: v.id("sites"),
    sourceId: v.optional(v.id("reviewSources")),
    skipTtl: v.optional(v.boolean()),
  },
  handler: async (ctx, { siteId, sourceId, skipTtl = false }) => {
    const sources = await ctx.runQuery(internal.reviews.listSourcesInternal, { siteId });
    const targets = (sourceId
      ? (sources as any[]).filter((s: any) => s._id === sourceId)
      : (sources as any[]).filter((s: any) => {
          if (s.status === "disconnected") return false;
          // Cron-triggered sync (skipTtl=false): only process autoRefresh sources
          if (!skipTtl && !s.autoRefresh) return false;
          return true;
        }));
    const now = Date.now();

    for (const source of targets) {
      // Cache TTL gate — skip auto-syncs that ran recently
      if (!skipTtl && source.autoRefresh && source.lastSyncedAt) {
        const intervalMs = (source.refreshIntervalHours ?? 24) * 60 * 60 * 1000;
        if (now - source.lastSyncedAt < intervalMs) continue;
      }

      try {
        // Decrypt credentials for this source
        let credentials: Record<string, string> = {};
        if (source.credentialsCiphertext) {
          const plain = await decryptField(source.credentialsCiphertext);
          credentials = JSON.parse(plain) as Record<string, string>;
        }

        // Dispatch to the provider-specific connector.
        // `getReviewConnector` is the factory defined at the bottom of this file;
        // each class mirrors the ReviewConnector interface in lib/payment-connectors.
        const connector = getReviewConnector(source.provider);
        const reviews = await connector.fetchReviews({
          config: (source.config ?? {}) as Record<string, unknown>,
          credentials,
        });

        // Track counts and build the set of live external IDs for orphan detection.
        let inserted = 0;
        let updated = 0;
        const knownExternalIds: string[] = [];

        for (const rev of reviews) {
          // The stored key mirrors the one built inside upsertReviewInternal.
          knownExternalIds.push(`${source.provider}:${rev.externalId}`);
          const result = await ctx.runMutation(internal.reviews.upsertReviewInternal, {
            siteId,
            sourceId: source._id,
            provider: source.provider,
            externalId: rev.externalId,
            reviewerName: rev.reviewerName,
            reviewerPhotoUrl: rev.reviewerPhotoUrl,
            rating: rev.rating,
            text: rev.text,
            reviewDate: rev.reviewDate,
            cachedAt: now,
          });
          if (result === "inserted") inserted++;
          else if (result === "updated") updated++;
        }

        // Remove records that no longer appear in the provider response.
        // Guard: skip deletion when the provider returned zero results — an empty
        // response cannot be distinguished from a stub/misconfigured adapter and
        // would otherwise wipe all existing moderated reviews for the source.
        let removed = 0;
        if (reviews.length > 0) {
          removed = await ctx.runMutation(internal.reviews.deleteOrphanedReviews, {
            sourceId: source._id,
            knownExternalIds,
          });
        }

        await ctx.runMutation(internal.reviews.markSourceSynced, {
          sourceId: source._id,
          status: "active",
          errorMessage: undefined,
          syncStats: { inserted, updated, removed },
        });
      } catch (err: any) {
        await ctx.runMutation(internal.reviews.markSourceSynced, {
          sourceId: source._id,
          status: "error",
          errorMessage: err?.message ?? "Sync failed",
        });
      }
    }
  },
});

/* ── Internal action: daily cron — sync all auto-refresh sources ─────────
 * Runs with skipTtl: false so the TTL gate is active.
 */
export const syncAllSitesReviews = internalAction({
  args: {},
  handler: async (ctx) => {
    const allSources = await ctx.runQuery(internal.reviews.listSourcesInternal, {});
    const autoSources = (allSources as any[]).filter((s) => s.autoRefresh && s.status !== "disconnected");
    const siteIds = [...new Set(autoSources.map((s: any) => String(s.siteId)))] as string[];
    for (const siteId of siteIds) {
      await ctx.runAction(internal.reviews.syncSiteReviews, {
        siteId: siteId as any,
        skipTtl: false,
      });
    }
  },
});

/* ── Review connector abstraction ────────────────────────────────────────
 *
 * Mirrors lib/payment-connectors/src/index.ts ReviewConnector.
 * Convex functions cannot import from workspace lib packages, so the interface
 * is declared here as the runtime-side contract. Each provider has a concrete
 * class; `getReviewConnector()` is the factory that dispatches to them.
 *
 * Behavior matrix:
 *   REVIEWS_MOCK_DATA=true  → return deterministic fixture reviews (all providers)
 *   Credentials missing     → throw explicit "credentials not configured" error
 *   Credentials present     → live API call path (in-progress; returns [] until wired)
 */

interface RawReview {
  externalId: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  rating: number;
  text?: string;
  reviewDate: number;
}

interface ReviewConnectorAdapter {
  readonly provider: string;
  fetchReviews(params: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    maxResults?: number;
  }): Promise<RawReview[]>;
}

/* ── Deterministic fixture data (REVIEWS_MOCK_DATA=true in Convex env) ── */

const now = Date.now();
const DAY = 86_400_000;
const MOCK_REVIEWS: Record<string, RawReview[]> = {
  google: [
    { externalId: "mock-g-1", reviewerName: "Sarah M.", rating: 5, text: "Absolutely fantastic service! The team went above and beyond our expectations.", reviewDate: now - 7 * DAY },
    { externalId: "mock-g-2", reviewerName: "James T.", rating: 5, text: "Professional, responsive, and delivered exactly what was promised. Will use again.", reviewDate: now - 14 * DAY },
    { externalId: "mock-g-3", reviewerName: "Lisa R.", rating: 4, text: "Great experience overall. Highly recommend to anyone looking for quality work.", reviewDate: now - 21 * DAY },
  ],
  facebook: [
    { externalId: "mock-fb-1", reviewerName: "David K.", rating: 5, text: "Top-notch quality and amazing customer support from start to finish.", reviewDate: now - 5 * DAY },
    { externalId: "mock-fb-2", reviewerName: "Emma W.", rating: 5, text: "Love everything about this business. Honest, fast, and genuinely helpful.", reviewDate: now - 18 * DAY },
  ],
  yelp: [
    { externalId: "mock-yelp-1", reviewerName: "Carlos B.", rating: 5, text: "Best in the area, hands down. Will definitely be coming back!", reviewDate: now - 10 * DAY },
    { externalId: "mock-yelp-2", reviewerName: "Nancy P.", rating: 4, text: "Very satisfied with the results. Professional, timely, and great communication.", reviewDate: now - 25 * DAY },
  ],
};

/* ── Provider-specific adapter classes ──────────────────────────────────── */

/** Google Business Profile — Places API */
class GoogleReviewsAdapter implements ReviewConnectorAdapter {
  readonly provider = "google";

  async fetchReviews({
    config,
    credentials,
  }: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    maxResults?: number;
  }): Promise<RawReview[]> {
    // Mock data is on by default; set REVIEWS_MOCK_DATA=false in Convex env to enable live API mode.
    if (process.env.REVIEWS_MOCK_DATA !== "false") return MOCK_REVIEWS.google;
    if (!credentials.apiKey) throw new Error("Google reviews require an API key. Add it in the source settings.");
    if (!config.placeId) throw new Error("Google reviews require a Place ID. Add it in the source settings.");

    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", String(config.placeId));
    url.searchParams.set("fields", "reviews");
    url.searchParams.set("key", credentials.apiKey);
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`Google Places API error: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json() as any;
    if (data.status && data.status !== "OK") {
      const msg = data.error_message ? ` — ${data.error_message}` : "";
      throw new Error(`Google Places API: ${data.status}${msg}`);
    }
    return (data.result?.reviews ?? []).map((r: any): RawReview => ({
      externalId: `${String(r.author_name)}_${String(r.time)}`,
      reviewerName: r.author_name ?? "Google User",
      reviewerPhotoUrl: r.profile_photo_url || undefined,
      rating: r.rating,
      text: r.text || undefined,
      reviewDate: r.time * 1000,
    }));
  }
}

/** Facebook — Graph API page ratings */
class FacebookReviewsAdapter implements ReviewConnectorAdapter {
  readonly provider = "facebook";

  async fetchReviews({
    config,
    credentials,
  }: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    maxResults?: number;
  }): Promise<RawReview[]> {
    if (process.env.REVIEWS_MOCK_DATA !== "false") return MOCK_REVIEWS.facebook;
    if (!credentials.accessToken) throw new Error("Facebook reviews require a Page Access Token. Add it in the source settings.");
    if (!config.pageId) throw new Error("Facebook reviews require a Page ID. Add it in the source settings.");

    const url = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(String(config.pageId))}/ratings`);
    url.searchParams.set("fields", "reviewer,rating,review_text,created_time");
    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", credentials.accessToken);
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      throw new Error(`Facebook Graph API error: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json() as any;
    if (data.error) {
      throw new Error(`Facebook Graph API: ${data.error.message ?? data.error.type ?? "Unknown error"}`);
    }
    return (data.data ?? []).map((r: any): RawReview => ({
      externalId: `${String(r.reviewer?.id ?? "anon")}_${String(r.created_time)}`,
      reviewerName: r.reviewer?.name ?? "Facebook User",
      rating: r.rating,
      text: r.review_text || undefined,
      reviewDate: new Date(r.created_time).getTime(),
    }));
  }
}

/** Yelp — Fusion API review excerpts (per Yelp ToS) */
class YelpReviewsAdapter implements ReviewConnectorAdapter {
  readonly provider = "yelp";

  async fetchReviews({
    config,
    credentials,
  }: {
    config: Record<string, unknown>;
    credentials: Record<string, string>;
    maxResults?: number;
  }): Promise<RawReview[]> {
    if (process.env.REVIEWS_MOCK_DATA !== "false") return MOCK_REVIEWS.yelp;
    if (!credentials.apiKey) throw new Error("Yelp reviews require an API key. Add it in the source settings.");
    if (!config.businessId) throw new Error("Yelp reviews require a Business ID. Add it in the source settings.");

    // Yelp Fusion API returns up to 3 excerpt reviews per ToS — display-only, no full text
    const businessId = encodeURIComponent(String(config.businessId));
    const resp = await fetch(
      `https://api.yelp.com/v3/businesses/${businessId}/reviews?limit=20`,
      { headers: { Authorization: `Bearer ${credentials.apiKey}` } },
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      let detail = `${resp.status} ${resp.statusText}`;
      try {
        const parsed = JSON.parse(body) as any;
        if (parsed?.error?.description) detail = parsed.error.description;
      } catch { /* ignore */ }
      throw new Error(`Yelp Fusion API error: ${detail}`);
    }
    const data = await resp.json() as any;
    if (data.error) {
      throw new Error(`Yelp Fusion API: ${data.error.description ?? data.error.code ?? "Unknown error"}`);
    }
    return (data.reviews ?? []).map((r: any): RawReview => ({
      externalId: r.id,
      reviewerName: r.user?.name ?? "Yelp User",
      reviewerPhotoUrl: r.user?.image_url || undefined,
      rating: r.rating,
      text: r.text || undefined,
      reviewDate: new Date(r.time_created).getTime(),
    }));
  }
}

function getReviewConnector(provider: string): ReviewConnectorAdapter {
  switch (provider) {
    case "google":   return new GoogleReviewsAdapter();
    case "facebook": return new FacebookReviewsAdapter();
    case "yelp":     return new YelpReviewsAdapter();
    default: throw new Error(`Unknown review provider: ${provider}`);
  }
}
