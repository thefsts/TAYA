/**
 * PHASE 3 \u2014 VISUAL EDITOR SURFACE (spec \u00a79\u2013\u00a711, \u00a717, \u00a726).
 *
 * ADDITIVE ONLY \u2014 builds on the Phase 2 contract, never replaces it:
 *   - drafts/publishes still flow through publishing.saveDraft /
 *     publishContentMap (single overlay writer internal.publishing._applyOverlay);
 *   - revisions live in contentVersions (recorded by publishing's
 *     recordVersion calls at publish time);
 *   - the only NEW durable state is editorFrameTokens \u2014 the single-use
 *     frame credential for the cross-origin editor iframe (\u00a726).
 *
 * Why frame tokens exist: the editor preview iframe loads the customer's
 * REAL website, which is cross-origin to the dashboard. An iframe src URL
 * cannot carry an Authorization header, so the /api/editor/frame HTTP
 * action authorizes via an opaque token in the query string instead.
 * The token is:
 *   - MINTED only by an authenticated dashboard mutation (createFrameToken)
 *             after checkSiteAccess \u2014 user-scoped + site-scoped;
 *   - SINGLE-USE, BURNED FIRST \u2014 the frame route burns it before doing
 *             anything else, so a token leaked into browser history /
 *             referrers / logs is dead before anyone can replay it, and
 *             two concurrent loads cannot both consume one token;
 *   - TTL-BOUNDED (FRAME_TOKEN_TTL_MS) \u2014 stale tokens expire on their own;
 *   - UNRELATED to any Convex/Clerk id \u2014 opaque 64-hex from WebCrypto.
 *             The siteId scope is re-verified at consumption: a site
 *             member's token can never render another tenant's site, and
 *             a revoked role fails the access re-check.
 *
 * TENANT ISOLATION (\u00a722): every entry point here is site-scoped.
 * createFrameToken uses checkSiteAccess; editorRevisions returns null
 * without access; restoreAsDraft re-checks access AND permission AND that
 * the revision row belongs to the same site (a cross-tenant caller gets
 * Forbidden, never another tenant's data).
 */

import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { requirePermission } from "./lib/requirePermission";
import { PERMISSIONS } from "./lib/permissions";
import { logActivity } from "./lib/logActivity";
import { generateVerificationToken } from "./lib/ownershipChecks";

/** Frame token lifetime \u2014 minted at iframe load, consumed within minutes. */
export const FRAME_TOKEN_TTL_MS = 5 * 60 * 1000;

/** Opaque 64-hex frame token \u2014 crypto-backed, never id-derived. */
function generateFrameToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Deterministic test environments only \u2014 Convex always has WebCrypto.
  return generateVerificationToken() + generateVerificationToken();
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// createFrameToken \u2014 mint the iframe credential (dashboard \u2192 iframe src)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * Mint a single-use frame token. The dashboard calls this right before
 * setting the editor iframe's src; the opaque token plus the \u00a75 route
 * path are the only credentials in the frame URL.
 *
 * `path` is normalized ("/" default) and VALIDATED AGAINST THE SITE'S OWN
 * CONTENT-MAP PAGES at consumption time (in _frameSite) \u2014 a tampered
 * path cannot make the frame render anything outside the site's crawled
 * routes.
 */
export const createFrameToken = mutation({
  args: {
    siteId: v.id("sites"),
    path: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, path }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    if (!(await checkSiteAccess(ctx, siteId))) {
      throw new ConvexError("Forbidden: site access required");
    }

    let routePath = typeof path === "string" && path.startsWith("/") ? path : "/";
    // No query strings / fragments / trailing normalization games \u2014 the
    // consumption check matches discovered routes exactly.
    routePath = routePath.split(/[?#]/)[0];

    const token = generateFrameToken();
    await ctx.db.insert("editorFrameTokens", {
      siteId,
      clerkUserId: identity.subject,
      token,
      mintedAt: Date.now(),
    });

    return { token, path: routePath, expiresAt: Date.now() + FRAME_TOKEN_TTL_MS };
  },
});

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Frame-token consumption (internal \u2014 called only by the httpAction)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * BURN a frame token \u2014 the FIRST thing /api/editor/frame does with it.
 * Returns the token's (siteId, clerkUserId) scope ONLY when the token
 * exists, is unused, and is within TTL. Replays (usedAt set) and stale
 * tokens return null \u2014 indistinguishable from unknown tokens.
 *
 * Burning before authorizing (instead of after) closes the concurrent
 * double-use race: whichever request burns first wins; the other gets
 * null even if both started simultaneously.
 */
export const _burnFrameToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const doc = await ctx.db
      .query("editorFrameTokens")
      .withIndex("by_token", (q: any) => q.eq("token", token))
      .first();
    if (!doc) return null;
    if (doc.usedAt !== undefined) return null; // replay \u2014 dead
    if (Date.now() - doc.mintedAt > FRAME_TOKEN_TTL_MS) return null; // expired

    await ctx.db.patch(doc._id, { usedAt: Date.now() });
    return { siteId: doc.siteId, clerkUserId: doc.clerkUserId };
  },
});

/**
 * Resolve the burned token's scope to a renderable page: re-verify the
 * user still has access to the site (roles may have been revoked since
 * mint), require a content map with the site's discovered pages, and
 * validate the requested path against THOSE pages (the \u00a75 page map is
 * the allowlist \u2014 not a free-form URL).
 *
 * Returns { domain, path, mode } or null. `domain` is the bare domain the
 * crawl used (https:// is added by the caller).
 */
export const _frameSite = internalQuery({
  args: {
    siteId: v.id("sites"),
    clerkUserId: v.string(),
    path: v.string(),
  },
  handler: async (ctx, { siteId, clerkUserId, path }) => {
    // \u2500\u2500 access re-check (same discipline as siteAccessInternal.check) \u2500\u2500
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (!user || !user.isActive) return null;
    if (!user.isSuperAdmin && !user.roles.some((r: any) => r.siteId === siteId)) return null;

    const site = await ctx.db.get(siteId);
    if (!site || !site.domain) return null;

    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();
    if (!map) return null;

    const pages: Array<{ path: string }> = (map.pages as any) ?? [];
    const allowed = new Set<string>(["/"]);
    for (const p of pages) if (typeof p?.path === "string") allowed.add(p.path);

    let routePath = typeof path === "string" && path.startsWith("/") ? path.split(/[?#]/)[0] : "/";
    if (!allowed.has(routePath)) return null; // not a discovered route

    return {
      domain: site.domain,
      path: routePath,
      mode: (site as any).connectionMode ?? null,
    };
  },
});

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// editorRevisions \u2014 \u00a717 revision history (site-scoped read)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * The editor's revision history (\u00a717): Published date/time, Published by,
 * and a revision summary. The site's publish revisions (contentVersions \u00b7
 * entityType content_map_publish) newest-first. Site-scoped: no access \u2192
 * null \u2014 a cross-tenant caller learns nothing, not even that revisions
 * exist.
 */
export const editorRevisions = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    const docs = await ctx.db
      .query("contentVersions")
      .withIndex("by_site_entity", (q: any) =>
        q.eq("siteId", siteId).eq("entityType", "content_map_publish"),
      )
      .order("desc")
      .collect();
    // Client-safe fields only (\u00a726: clients never see semantic keys,
    // ids, JSON, or role names \u2014 the summary is plain-language).
    return docs.map((d: any) => {
      const snapshot = (d.snapshot as any) ?? {};
      const keys: Record<string, string> = snapshot.keys ?? {};
      const n = Object.keys(keys).length;
      return {
        revisionId: d._id as string,
        publishedAt: (snapshot.publishedAt as number) ?? null,
        publishedBy: d.createdByName,
        keyCount: n,
        summary: `Published ${n} value${n === 1 ? "" : "s"} to the live website`,
      };
    });
  },
});

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// restoreAsDraft \u2014 SAFE restoration (\u00a717): restore becomes a draft first
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// The published overlay is NEVER touched by a restore. The restored values
// land in the DRAFT overlay via the same single writer as every other
// edit (internal.publishing._applyOverlay), so the owner can Preview \u2192
// Publish (or discard) exactly like any other change. Nothing goes live
// until the owner publishes it \u2014 restoring an old revision can never
// regress the live site by accident.
export const restoreAsDraft = mutation({
  args: {
    siteId: v.id("sites"),
    revisionId: v.id("contentVersions"),
  },
  handler: async (ctx, { siteId, revisionId }) => {
    // Permission floor first (superadmin bypass; site roles checked).
    const user = await requirePermission(ctx, siteId, PERMISSIONS.CONTENT_UPDATE);

    // \u2500\u2500 TENANT ISOLATION \u2014 the revision must belong to THIS site. A
    // revisionId from another tenant is Forbidden, never a restore of
    // their content into this site's draft (which would leak their values).
    const revision = await ctx.db.get(revisionId);
    if (!revision || String(revision.siteId) !== String(siteId)) {
      throw new ConvexError("Forbidden: revision not found for this site");
    }
    if (revision.entityType !== "content_map_publish") {
      throw new ConvexError("Only publish revisions can be restored");
    }

    const map = await ctx.db
      .query("siteContentMaps")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .first();
    if (!map) {
      throw new ConvexError("No content map for this site yet \u2014 discovery must complete first.");
    }

    // Restored values \u2192 DRAFT overlay (allowlist: unknown keys are ignored
    // by _applyOverlay \u2014 a revision older than a map refresh stays safe).
    const keys: Record<string, string> = (revision.snapshot as any)?.keys ?? {};
    const entries = Object.entries(keys)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => ({ key, value }));
    if (entries.length === 0) {
      throw new ConvexError("Revision contains no restorable content");
    }

    await ctx.runMutation(internal.publishing._applyOverlay, {
      siteId,
      overlay: "draft",
      entries,
    });

    await logActivity(ctx, {
      siteId,
      actorName: user.name,
      action: "restored",
      entityType: "content draft",
      page: "Visual Editor",
      details: `Restored an earlier published version as a draft \u2014 ${entries.length} value${
        entries.length === 1 ? "" : "s"
      } (publish to go live)`,
    });

    return { ok: true, restoredKeys: entries.length };
  },
});
