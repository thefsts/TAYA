/**
 * PHASE 2 — UNIVERSAL WEBSITE ADAPTER: discovery API (spec §4–§6, §16).
 *
 * The Convex function surface for the read-only site-discovery crawler:
 *
 *   triggerDiscovery (action, public)   — a user with site access starts a
 *       crawl for their own site (manual re-run of the automatic discovery).
 *   run (internalAction)                — the crawl itself: load site →
 *       crawlSite(domain) → persist snapshot → set connectionMode. This is
 *       the function provisioning schedules (fire-and-forget), so discovery
 *       is automatic after every site creation with a domain (§4 "auto").
 *   persistSnapshot (internalMutation)  — the only writer of
 *       discoverySnapshots. kind="initial" for the first crawl of a site
 *       (§16 initial snapshot), "refresh" afterwards.
 *   getLatestSnapshot (query, public)   — the snapshot doc (site-scoped).
 *   getReport (query, public)           — the compact onboarding report
 *       (§4 step 11 "show onboarding report") for the setup screen.
 *   listSnapshots (query, public)       — crawl history (status/time).
 *
 * §16 READ-ONLY DISCIPLINE:
 *   - The crawl performs only GET fetches of the client's own public site.
 *     It never writes to the website, never touches live content, and never
 *     fabricates data: a failed crawl is persisted with status "failed" + an
 *     explicit failureReason (§14: never a silent pass).
 *   - The snapshot is a review artifact. Nothing in this module applies
 *     discovered content to any live site — that is the Phase 3 editor's job
 *     and only after a user acts on the snapshot.
 *
 * TENANT ISOLATION (§22):
 *   - triggerDiscovery verifies the caller's site access through the same
 *     internal access-check query as the health scans (never unverified
 *     client-supplied IDs).
 *   - All reads are site-scoped: a user without a role on the site gets
 *     null/[] — the same contract as every other module.
 *   - run/persistSnapshot are internal-only (not callable from the
 *     dashboard); the scheduler or the access-checked action drives them.
 *
 * CONNECTION MODES (§6): every successful crawl sets
 * sites.connectionMode = "DISCOVERED_EXTERNAL" until a bridge is verified
 * (ownershipVerification flips it to TAYA_CONNECTED; TAYA_NATIVE is assigned
 * at provisioning when the site has no external domain). TAYA_NATIVE /
 * TAYA_CONNECTED allow edit+publish; DISCOVERED_EXTERNAL is draft-edit-only
 * with "Publishing connection required" — enforced server-side in
 * publishing.publishContentMap, which no UI can bypass.
 *
 * §7 AUTO-CONFORM: persistSnapshot's completed branch applies
 * conformWorkspace's plan atomically with the snapshot: enable-only module
 * merge (UI configuration only), nav-row inserts for newly-enabled modules
 * (deduped by href), and the durable §5 siteContentMaps upsert (draft/
 * published overlays preserved; vanished keys marked stale). No RBAC
 * grants, no admin modules, no per-customer logic.
 */

import { query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";
import { logActivity } from "./lib/logActivity";
import { crawlSite } from "./lib/discovery/crawl";
import {
  buildPageMap,
  conformWorkspace,
  mergeEnabledModules,
} from "./lib/discovery/contentMap";
import { buildSiteProfile } from "./lib/discovery/siteProfile";

// ─────────────────────────────────────────────────────────────────────────────
// Public read surface (site-scoped)
// ─────────────────────────────────────────────────────────────────────────────

/** Latest snapshot for the site (site-scoped read; null when none). */
export const getLatestSnapshot = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    return latestSnapshotDoc(ctx, siteId);
  },
});

/**
 * The onboarding report (§4 step 11): crawl status, platform, pages found,
 * keyCount, discovered routes, and site metadata — for the user to review
 * (§16 "user reviews mappings" — read-only, no publish implication).
 */
export const getReport = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return null;
    const snap = await latestSnapshotDoc(ctx, siteId);
    if (!snap) return null;
    const report = snap.report ?? null;
    return {
      snapshotId: snap._id,
      kind: snap.kind,
      status: snap.status,
      domain: snap.domain,
      failureReason: snap.failureReason ?? null,
      ...(report
        ? {
            platform: report.platform ?? null,
            keyCount: report.keyCount ?? 0,
            pages: report.pages ?? [],
            routes: report.routes ?? [],
            meta: report.meta ?? null,
            generatedAt: report.generatedAt ?? null,
          }
        : {}),
    };
  },
});

/** Crawl history for the site (light rows — statuses and times, no snapshot payload). */
export const listSnapshots = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!(await checkSiteAccess(ctx, siteId))) return [];
    const rows = await ctx.db
      .query("discoverySnapshots")
      .withIndex("by_site_startedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(20);
    return rows.map((r) => {
      const report: any = (r as any).report ?? null;
      return {
        _id: r._id,
        kind: r.kind,
        status: r.status,
        domain: r.domain,
        platform: report?.platform ?? null,
        keyCount: report?.keyCount ?? 0,
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? null,
        failureReason: r.failureReason ?? null,
        triggeredBy: r.triggeredBy ?? null,
      };
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Public trigger (access-checked) → internal run
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a discovery crawl for a site the caller can access (§4 auto-discovery,
 * user-triggered re-run). Same access pattern as healthScans.triggerScan.
 */
export const triggerDiscovery = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");
    return await ctx.runAction(internal.discovery.run, {
      siteId,
      triggeredBy: "user",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal: site load + the crawl + the snapshot writer
// ─────────────────────────────────────────────────────────────────────────────

/** Load the site row for crawling (internal query — actions have no ctx.db). */
export const _siteForDiscovery = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) return null;
    return {
      _id: site._id,
      name: site.name,
      domain: site.domain ?? null,
    };
  },
});

/**
 * The discovery crawl (internalAction — network fetches are only allowed in
 * actions). Loads the site, runs the read-only crawl, and persists the
 * snapshot through persistSnapshot (which also sets connectionMode +
 * detectedPlatform on success). Scheduled by provisionSite / sites.create
 * (fire-and-forget runAfter(0)), or invoked by triggerDiscovery.
 */
export const run = internalAction({
  args: { siteId: v.id("sites"), triggeredBy: v.optional(v.string()) },
  handler: async (ctx, { siteId, triggeredBy }): Promise<any> => {
    const site = await ctx.runQuery(internal.discovery._siteForDiscovery, { siteId });
    const actor = triggeredBy ?? "system";

    if (!site) {
      // §14: explicit failure — the site vanished between scheduling and run.
      await ctx.runMutation(internal.discovery.persistSnapshot, {
        siteId,
        status: "failed",
        failureReason: "Site not found when the crawl ran.",
        triggeredBy: actor,
      });
      return { status: "failed", reason: "Site not found when the crawl ran." };
    }
    if (!site.domain) {
      // No domain yet → nothing to crawl. Recorded explicitly (§14) so the
      // report says why there is no snapshot instead of staying blank.
      await ctx.runMutation(internal.discovery.persistSnapshot, {
        siteId,
        status: "failed",
        failureReason: "No domain recorded on the site — nothing to discover.",
        triggeredBy: actor,
      });
      return { status: "failed", reason: "No domain recorded on the site — nothing to discover." };
    }

    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof crawlSite>>;
    try {
      result = await crawlSite(site.domain);
    } catch (error: any) {
      result = {
        snapshot: null,
        failureReason: `Crawl threw: ${error?.message?.slice(0, 200) ?? "unknown error"}`,
      };
    }
    const completedAt = Date.now();

    if (result.snapshot) {
      await ctx.runMutation(internal.discovery.persistSnapshot, {
        siteId,
        status: "completed",
        domain: site.domain,
        snapshot: result.snapshot,
        startedAt,
        completedAt,
        triggeredBy: actor,
      });
      return {
        status: "completed",
        keyCount: result.snapshot.keyCount,
        platform: result.snapshot.platform,
      };
    }

    // §14: explicit failure with reason — never a fabricated snapshot.
    await ctx.runMutation(internal.discovery.persistSnapshot, {
      siteId,
      status: "failed",
      domain: site.domain,
      failureReason: result.failureReason ?? "Crawl failed without a reason.",
      startedAt,
      completedAt,
      triggeredBy: actor,
    });
    return { status: "failed", reason: result.failureReason ?? "Crawl failed without a reason." };
  },
});

/**
 * The ONLY writer of discoverySnapshots (internalMutation). Denormalizes the
 * report fields (status/platform/keyCount/pages/routes/meta) onto the row so
 * the setup screen reads light rows instead of the full snapshot payload.
 * On success it also patches the site's connectionMode (§6 — DISCOVERED_EXTERNAL
 * until a bridge is verified) and detectedPlatform (§4 "identify technology").
 * kind: "initial" while the site has no prior snapshot (§16), else "refresh".
 */
export const persistSnapshot = internalMutation({
  args: {
    siteId: v.id("sites"),
    status: v.string(), // "completed" | "failed"
    domain: v.optional(v.string()),
    snapshot: v.optional(v.any()),
    failureReason: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prior = await latestSnapshotDoc(ctx, args.siteId);
    const kind = prior ? "refresh" : "initial";

    const snap: any = args.snapshot ?? null;
    const report: any = snap
      ? {
          domain: snap.domain,
          platform: snap.platform ?? null,
          keyCount: snap.keyCount ?? 0,
          pages: (snap.pages ?? []).map((p: any) => ({ path: p.path, status: p.status })),
          routes: (snap.routes ?? []).map((r: any) => ({
            path: r.path,
            source: r.source,
            label: r.label,
          })),
          meta: snap.siteMeta ?? null,
          generatedAt: snap.crawlCompletedAt ?? null,
        }
      : null;

    const snapshotId = await ctx.db.insert("discoverySnapshots", {
      siteId: args.siteId,
      kind,
      status: args.status,
      domain: args.domain ?? "",
      // Full snapshot payload — the review artifact (§16). Kept only for
      // completed crawls; failed crawls carry the explicit failureReason.
      ...(snap ? { snapshot: snap } : {}),
      ...(report ? { report } : {}),
      ...(args.failureReason ? { failureReason: args.failureReason } : {}),
      startedAt: args.startedAt ?? Date.now(),
      ...(args.completedAt !== undefined ? { completedAt: args.completedAt } : {}),
      ...(args.triggeredBy ? { triggeredBy: args.triggeredBy } : {}),
    });

    // §6/§14: a successful crawl identifies the publishing mode and
    // platform — but NEVER downgrades a stronger mode. TAYA_CONNECTED
    // (ownership verified: the bridge stays live across refresh crawls)
    // and TAYA_NATIVE (hosted by TAYA) survive a crawl; only an
    // unidentified external site is set to DISCOVERED_EXTERNAL.
    if (args.status === "completed" && snap) {
      const siteBeforePatch = await ctx.db.get(args.siteId);
      const currentMode = (siteBeforePatch as any)?.connectionMode;
      const nextMode =
        currentMode === "TAYA_CONNECTED" || currentMode === "TAYA_NATIVE"
          ? currentMode
          : "DISCOVERED_EXTERNAL";
      // ── Phase 6 site profile (§2/§3) — built in the same transaction ──
      const profile = buildSiteProfile(snap, nextMode);
      await ctx.db.patch(args.siteId, {
        connectionMode: nextMode,
        detectedPlatform: snap.platform ?? undefined,
        // The adaptive layer's own inference — never touches the owner's
        // websiteType choice (§2: no hardcoded rigid industry apps).
        inferredWebsiteType: profile.siteType.type,
        inferredSiteTypeConfidence: profile.siteType.confidence,
      });

      // ── §7 AUTO-CONFORM (same transaction, atomic with the snapshot) ──
      // Route → module UI configuration ONLY: enable-only module merge,
      // nav-row inserts for newly-enabled modules, and the durable §5
      // page/content map upsert. NO RBAC grants, NO admin modules, no
      // per-customer logic — pure derivation from the snapshot.
      const plan = conformWorkspace(snap);
      const siteForConform = await ctx.db.get(args.siteId);

      if (siteForConform) {
        // Enable-only merge (conformable keys only; never disables). The
        // owner's explicit module decisions (moduleOverrides, set only by
        // sites.update) outrank the crawl's inference — a refresh re-crawl
        // can never re-enable a module the owner disabled (§6).
        await ctx.db.patch(args.siteId, {
          enabledModules: mergeEnabledModules(
            (siteForConform as any).enabledModules,
            plan.enabledModulesPatch,
            (siteForConform as any).moduleOverrides,
          ),
        });

        // Nav inserts, deduped by href (idempotent).
        const existingNav = await ctx.db
          .query("navigationItems")
          .withIndex("by_site", (q: any) => q.eq("siteId", args.siteId))
          .collect();
        const seenHref = new Set(existingNav.map((n: any) => n.href));
        let navInserted = 0;
        for (const entry of plan.navEntries) {
          if (seenHref.has(entry.href)) continue;
          const count = existingNav.length + navInserted;
          await ctx.db.insert("navigationItems", {
            siteId: args.siteId,
            label: entry.label,
            href: entry.href,
            isVisible: true,
            order: count,
            openInNewTab: false,
          });
          navInserted++;
        }

        // §5 content map upsert — preserve draft/published overlays; mark
        // vanished keys stale (they stay in the map; discovery never
        // deletes the reference baseline).
        const pageMap = buildPageMap(snap);
        const priorMap = await ctx.db
          .query("siteContentMaps")
          .withIndex("by_site", (q: any) => q.eq("siteId", args.siteId))
          .first();
        if (priorMap) {
          const priorEntries: Record<string, any> = (priorMap.entries as any) ?? {};
          const merged: Record<string, any> = {};
          for (const [key, entry] of Object.entries(pageMap.entries)) {
            const prior = priorEntries[key];
            merged[key] = {
              ...entry,
              ...(prior?.draft !== undefined ? { draft: prior.draft } : {}),
              ...(prior?.published !== undefined ? { published: prior.published } : {}),
            };
          }
          // Keys the old map had that the new crawl no longer found: keep
          // them, marked stale (§14 explicit, never silently deleted).
          let staleCount = 0;
          for (const [key, prior] of Object.entries(priorEntries)) {
            if (merged[key]) continue;
            merged[key] = { ...(prior as any), stale: true };
            staleCount++;
          }
          await ctx.db.patch(priorMap._id, {
            domain: pageMap.domain,
            pages: pageMap.pages,
            entries: merged,
            keyCount: pageMap.keyCount,
            builtFromSnapshotAt: pageMap.builtFromSnapshotAt ?? undefined,
            conformed: priorMap.conformed ?? true,
            refreshedAt: Date.now(),
            // §3: the profile is re-derived on every completed crawl and
            // replaced wholesale (it is a derived artifact — the previous
            // crawl's inference is not "user data" to preserve).
            siteProfile: profile,
          });
        } else {
          await ctx.db.insert("siteContentMaps", {
            siteId: args.siteId,
            version: pageMap.version,
            domain: pageMap.domain,
            pages: pageMap.pages,
            entries: pageMap.entries,
            keyCount: pageMap.keyCount,
            conformed: true,
            builtFromSnapshotAt: pageMap.builtFromSnapshotAt ?? undefined,
            refreshedAt: Date.now(),
            siteProfile: profile,
          });
        }

        const activityDetails =
          `Workspace auto-conformed: enabled ${plan.enabledModuleKeys.length} module${
            plan.enabledModuleKeys.length === 1 ? "" : "s"
          }` +
          (navInserted > 0 ? `, added ${navInserted} nav item${navInserted === 1 ? "" : "s"}` : "") +
          `, ${pageMap.keyCount} content keys mapped` +
          `, site profile inferred (${profile.siteType.type}, confidence ${profile.siteType.confidence.toFixed(2)}).`;
        await logActivity(ctx, {
          siteId: args.siteId,
          actorName: "TAYA Discovery",
          action: "workspace_auto_conformed",
          entityType: "site",
          entityId: String(snapshotId),
          page: "Discovery",
          details: activityDetails,
        });
      }
    }

    const site = await ctx.db.get(args.siteId);
    await logActivity(ctx, {
      siteId: args.siteId,
      actorName: args.triggeredBy === "user" ? site?.name ?? "Site owner" : "TAYA Discovery",
      action: args.status === "completed" ? "site_discovery_completed" : "site_discovery_failed",
      entityType: "site",
      entityId: String(snapshotId),
      page: "Discovery",
      details:
        args.status === "completed"
          ? `Discovered ${report?.keyCount ?? 0} content keys across ${report?.pages?.length ?? 0} pages (${snap.platform ?? "platform unknown"}).`
          : args.failureReason ?? "Discovery failed.",
    });

    return { snapshotId, kind, status: args.status };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function latestSnapshotDoc(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
): Promise<Doc<"discoverySnapshots"> | null> {
  return ctx.db
    .query("discoverySnapshots")
    .withIndex("by_site_startedAt", (q) => q.eq("siteId", siteId))
    .order("desc")
    .first();
}
