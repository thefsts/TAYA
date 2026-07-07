import { query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess } from "./lib/requireSiteAccess";

export const ping = query({
  args: {},
  handler: async (_ctx) => {
    return { status: "ok" as const };
  },
});

export const getRecentLogs = query({
  args: { siteId: v.id("sites"), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, limit }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const docs = await ctx.db
      .query("siteHealthLogs")
      .withIndex("by_site_checkedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(limit ?? 48);
    return docs.map((d) => ({
      ...d,
      id: d._id,
      checkedAt: new Date(d.checkedAt).toISOString(),
    }));
  },
});

export const getSummary = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    const recent = await ctx.db
      .query("siteHealthLogs")
      .withIndex("by_site_checkedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(24);
    if (recent.length === 0) {
      return { status: "unknown" as const, uptime24h: null, avgResponseMs: null, lastCheckedAt: null };
    }
    const up = recent.filter((r) => r.isUp).length;
    const uptime24h = Math.round((up / recent.length) * 100);
    const withMs = recent.filter((r) => r.responseMs != null);
    const avgResponseMs = withMs.length
      ? Math.round(withMs.reduce((s, r) => s + (r.responseMs ?? 0), 0) / withMs.length)
      : null;
    const latest = recent[0];
    return {
      status: latest.isUp ? ("up" as const) : ("down" as const),
      uptime24h,
      avgResponseMs,
      lastCheckedAt: new Date(latest.checkedAt).toISOString(),
      lastStatusCode: latest.statusCode,
      lastError: latest.error,
    };
  },
});

export const recordHealthCheck = internalMutation({
  args: {
    siteId: v.id("sites"),
    url: v.string(),
    statusCode: v.optional(v.number()),
    responseMs: v.optional(v.number()),
    isUp: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("siteHealthLogs", { ...args, checkedAt: Date.now() });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("siteHealthLogs")
      .withIndex("by_site_checkedAt", (q) =>
        q.eq("siteId", args.siteId).lt("checkedAt", cutoff)
      )
      .collect();
    for (const doc of old) await ctx.db.delete(doc._id);
  },
});

export const getAllActiveSites = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sites").collect();
  },
});

export const checkAllSites = internalAction({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.runQuery(internal.health.getAllActiveSites, {});
    await Promise.allSettled(
      sites
        .filter((site: any) => site.domain)
        .map(async (site: any) => {
          const url = site.domain.startsWith("http")
            ? site.domain
            : `https://${site.domain}`;
          const start = Date.now();
          let statusCode: number | undefined;
          let responseMs: number | undefined;
          let isUp = false;
          let error: string | undefined;
          try {
            const res = await fetch(url, {
              method: "GET",
              signal: AbortSignal.timeout(10000),
            });
            responseMs = Date.now() - start;
            statusCode = res.status;
            isUp = res.status < 500;
          } catch (err: any) {
            responseMs = Date.now() - start;
            error = (err as Error).message ?? String(err);
          }
          await ctx.runMutation(internal.health.recordHealthCheck, {
            siteId: site._id,
            url,
            statusCode,
            responseMs,
            isUp,
            error,
          });
        })
    );
  },
});
