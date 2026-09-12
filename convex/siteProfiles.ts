/**
 * PHASE 6 — Auto-conform site profiles: the READ-ONLY recommendation surface.
 *
 * Chat C §3/§5: the persisted site profile (siteContentMaps.siteProfile, built
 * by discovery.persistSnapshot via buildSiteProfile) and the capability
 * recommendations it carries are exposed here for the dashboard / MATAYA.
 *
 * §5 boundary discipline (hard):
 *  - SUGGEST-ONLY. No mutation in this file. Recommendations NEVER grant a
 *    permission, enable a module on their own, enable payments, alter tenant
 *    data, or publish anything. The only way a capability becomes live is the
 *    owner's own explicit action through the existing authority paths
 *    (roleCapabilities / sites.update / onboarding.launch).
 *  - Site-scoped: every query runs checkSiteAccess first; no access → null —
 *    a cross-tenant caller learns nothing, not even that a profile exists.
 *  - Honest absence: a site that has not been crawled yet (or whose crawl
 *    failed) has NO profile — the queries return null, never a fabricated
 *    recommendation (§14).
 */

import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";

/** The persisted site profile row for the site's latest content map. */
async function mapFor(ctx: any, siteId: any) {
  return ctx.db
    .query("siteContentMaps")
    .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
    .first();
}

// ────────────────────────────────────────────────────────────────────────────
// internalGetProfile — for actions (no ctx.db) like ai.chat (§5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Internal (action-only) profile read. Actions run outside the transaction
 * and cannot use ctx.db; ai.chat calls this to ground the assistant in the
 * site's discovered context. Returns { siteProfile: null } when absent —
 * the caller degrades to no site context (§14: honest absence).
 */
export const internalGetProfile = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const map = await mapFor(ctx, siteId);
    return { siteProfile: (map as any)?.siteProfile ?? null };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// getProfile — the full site profile (§3)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The site's capability profile: inferred site type + terminology +
 * content types + §4 editability classification + raw signal counts.
 * Null until a completed discovery crawl has built one (§14 honesty).
 */
export const getProfile = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    const map = await mapFor(ctx, siteId);
    const profile = (map as any)?.siteProfile ?? null;
    if (!profile) return null;
    return {
      // The §5 recommendation payload shape is pinned by tests.
      version: profile.version,
      generatedAt: profile.generatedAt,
      siteType: profile.siteType,
      terminology: profile.terminology,
      capabilities: profile.capabilities,
      contentTypes: profile.contentTypes,
      editability: profile.editability,
      signals: profile.signals,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// getRecommendations — the suggest-only capability surface (§5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * The site's capability recommendations for the dashboard/MATAYA surface:
 * autoEnabled (modules discovery already turned on via §7 auto-conform —
 * listed for transparency, not as new grants) and suggested (capabilities
 * the crawl's evidence supports that the owner has NOT enabled — these are
 * SUGGESTIONS ONLY; nothing here mutates roles, modules, payments, or any
 * tenant state).
 */
export const getRecommendations = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    const map = await mapFor(ctx, siteId);
    const profile = (map as any)?.siteProfile ?? null;
    if (!profile) return null;
    const capabilities = profile.capabilities ?? null;
    if (!capabilities) return null;
    return {
      siteType: profile.siteType ?? null,
      terminology: profile.terminology ?? null,
      autoEnabled: capabilities.autoEnabled ?? [],
      suggested: capabilities.suggested ?? [],
    };
  },
});
