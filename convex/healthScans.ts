import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkSiteAccess, requireSiteAccessMutation } from "./lib/requireSiteAccess";

export type CategoryScore = {
  score: number;
  status: "good" | "warning" | "critical";
  lastScannedAt: number;
  trend: "improving" | "stable" | "declining";
  issues: string[];
  actions: string[];
};

export type HealthScanCategories = {
  performance: CategoryScore;
  seo: CategoryScore;
  accessibility: CategoryScore;
  security: CategoryScore;
  forms: CategoryScore;
  email: CategoryScore;
  payments: CategoryScore;
  media: CategoryScore;
  content: CategoryScore;
  mobile: CategoryScore;
  uptime: CategoryScore;
  backups: CategoryScore;
};

function scoreStatus(score: number): "good" | "warning" | "critical" {
  if (score >= 75) return "good";
  if (score >= 50) return "warning";
  return "critical";
}

export const getLatestScan = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return null;
    return ctx.db
      .query("websiteHealthScans")
      .withIndex("by_site_scannedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .first();
  },
});

export const getScanHistory = query({
  args: { siteId: v.id("sites"), limit: v.optional(v.number()) },
  handler: async (ctx, { siteId, limit }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    return ctx.db
      .query("websiteHealthScans")
      .withIndex("by_site_scannedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(limit ?? 30);
  },
});

export const getNotifications = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];
    const notifications = await ctx.db
      .query("healthNotifications")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(50);
    return notifications.filter((n) => !n.dismissedAt);
  },
});

export const getUnreadNotificationCount = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return 0;
    const notifications = await ctx.db
      .query("healthNotifications")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    return notifications.filter((n) => !n.readAt && !n.dismissedAt).length;
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("healthNotifications") },
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    await requireSiteAccessMutation(ctx, notification.siteId);
    await ctx.db.patch(notificationId, { readAt: Date.now() });
  },
});

export const markAllNotificationsRead = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireSiteAccessMutation(ctx, siteId);
    const notifications = await ctx.db
      .query("healthNotifications")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();
    const now = Date.now();
    for (const n of notifications) {
      if (!n.readAt) await ctx.db.patch(n._id, { readAt: now });
    }
  },
});

export const dismissNotification = mutation({
  args: { notificationId: v.id("healthNotifications") },
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    await requireSiteAccessMutation(ctx, notification.siteId);
    await ctx.db.patch(notificationId, { dismissedAt: Date.now() });
  },
});

export const _seedTestScan = internalMutation({
  args: {
    siteId: v.id("sites"),
    overallScore: v.number(),
    status: v.string(),
    categoryScores: v.any(),
    scannedAt: v.optional(v.number()),
  },
  handler: async (ctx, { siteId, overallScore, status, categoryScores, scannedAt }) => {
    return ctx.db.insert("websiteHealthScans", {
      siteId,
      overallScore,
      status,
      categoryScores,
      scannedAt: scannedAt ?? Date.now(),
    });
  },
});

export const _deleteAllScans = internalMutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const scans = await ctx.db
      .query("websiteHealthScans")
      .withIndex("by_site_scannedAt", (q) => q.eq("siteId", siteId))
      .collect();
    for (const scan of scans) {
      await ctx.db.delete(scan._id);
    }
    return scans.length;
  },
});

export const testHarness = action({
  args: {
    op: v.union(v.literal("seedScan"), v.literal("deleteAllScans")),
    siteId: v.id("sites"),
    overallScore: v.optional(v.number()),
    status: v.optional(v.string()),
    categoryScores: v.optional(v.any()),
    scannedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (process.env.CONVEX_TEST_MODE !== "true") {
      throw new Error("testHarness is only available in test environments (CONVEX_TEST_MODE=true)");
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId: args.siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");

    if (args.op === "seedScan") {
      return ctx.runMutation(internal.healthScans._seedTestScan, {
        siteId: args.siteId,
        overallScore: args.overallScore ?? 70,
        status: args.status ?? "warning",
        categoryScores: args.categoryScores ?? {},
        scannedAt: args.scannedAt,
      });
    }
    if (args.op === "deleteAllScans") {
      return ctx.runMutation(internal.healthScans._deleteAllScans, { siteId: args.siteId });
    }
  },
});

export const triggerScan = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const hasAccess = await ctx.runQuery(internal.lib.siteAccessInternal.check, {
      clerkUserId: identity.subject,
      siteId,
    });
    if (!hasAccess) throw new Error("Forbidden: site access required");
    await ctx.runAction(internal.healthScans.runScanForSite, { siteId });
    return { success: true };
  },
});

export const getSiteForScan = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) return null;

    const squareConfig = await ctx.db
      .query("squareConfig")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const emailSettings = await ctx.db
      .query("emailSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .first();

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const media = await ctx.db
      .query("mediaAssets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const articles = await ctx.db
      .query("articles")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const seoSettings = await ctx.db
      .query("seoSettings")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .collect();

    const recentHealthLogs = await ctx.db
      .query("siteHealthLogs")
      .withIndex("by_site_checkedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .take(24);

    const recentBackup = await ctx.db
      .query("backups")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .order("desc")
      .first();

    const prevScan = await ctx.db
      .query("websiteHealthScans")
      .withIndex("by_site_scannedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .first();

    return { site, squareConfig, emailSettings, forms, media, courses, articles, seoSettings, recentHealthLogs, recentBackup, prevScan };
  },
});

export const saveScanResult = internalMutation({
  args: {
    siteId: v.id("sites"),
    overallScore: v.number(),
    status: v.string(),
    categoryScores: v.any(),
  },
  handler: async (ctx, { siteId, overallScore, status, categoryScores }) => {
    const scanId = await ctx.db.insert("websiteHealthScans", {
      siteId,
      overallScore,
      status,
      categoryScores,
      scannedAt: Date.now(),
    });
    // Prune old scans (keep last 90)
    const old = await ctx.db
      .query("websiteHealthScans")
      .withIndex("by_site_scannedAt", (q) => q.eq("siteId", siteId))
      .order("desc")
      .collect();
    if (old.length > 90) {
      for (const doc of old.slice(90)) await ctx.db.delete(doc._id);
    }
    return scanId;
  },
});

export const createNotification = internalMutation({
  args: {
    siteId: v.id("sites"),
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Don't duplicate active notifications of same type
    const existing = await ctx.db
      .query("healthNotifications")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), args.type),
          q.eq(q.field("dismissedAt"), undefined)
        )
      )
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("healthNotifications", args);
  },
});

export const runScanForSite = internalAction({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const data = await ctx.runQuery(internal.healthScans.getSiteForScan, { siteId });
    if (!data) return;

    const { site, squareConfig, emailSettings, forms, media, courses, articles, seoSettings, recentHealthLogs, recentBackup, prevScan } = data;
    const now = Date.now();

    // ── UPTIME ─────────────────────────────────────────────────────────
    const uptimeLogs = recentHealthLogs;
    const upCount = uptimeLogs.filter((l: any) => l.isUp).length;
    const uptimePercent = uptimeLogs.length > 0 ? Math.round((upCount / uptimeLogs.length) * 100) : 0;
    const uptimeScore = uptimeLogs.length === 0 ? 50 : uptimePercent;
    const uptimeIssues: string[] = [];
    const uptimeActions: string[] = [];
    if (uptimeLogs.length === 0) uptimeIssues.push("No uptime data — configure a domain to start monitoring");
    else if (uptimePercent < 99) { uptimeIssues.push(`Uptime is ${uptimePercent}% over the last 24 checks`); uptimeActions.push("Contact your hosting provider if outages are frequent"); }

    // ── SECURITY ────────────────────────────────────────────────────────
    let securityScore = 50;
    const securityIssues: string[] = [];
    const securityActions: string[] = [];
    if (site.domain) {
      const hasHttps = site.domain.startsWith("https://") || !site.domain.startsWith("http");
      if (hasHttps) { securityScore = 85; }
      else { securityIssues.push("Site is not using HTTPS"); securityActions.push("Enable SSL certificate in hosting settings"); }

      // Try to check security headers
      try {
        const url = site.domain.startsWith("http") ? site.domain : `https://${site.domain}`;
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        const headers = res.headers;
        const hasHSTS = headers.get("strict-transport-security");
        const hasCSP = headers.get("content-security-policy");
        const hasXFrame = headers.get("x-frame-options");
        if (!hasHSTS) { securityScore -= 10; securityIssues.push("Missing HSTS header"); }
        if (!hasCSP) { securityScore -= 5; securityIssues.push("Missing Content-Security-Policy header"); }
        if (!hasXFrame) { securityScore -= 5; securityIssues.push("Missing X-Frame-Options header"); }
        if (!hasHSTS || !hasCSP || !hasXFrame) securityActions.push("Ask your FSTS team to configure security headers");
      } catch {
        // ignore fetch errors during scan
      }
    } else {
      securityIssues.push("No domain configured — security check skipped");
      securityActions.push("Add your domain in Site Settings");
    }

    // ── PERFORMANCE ─────────────────────────────────────────────────────
    const avgResponseMs = uptimeLogs.length > 0
      ? Math.round(uptimeLogs.filter((l: any) => l.responseMs).reduce((s: number, l: any) => s + (l.responseMs ?? 0), 0) / Math.max(uptimeLogs.filter((l: any) => l.responseMs).length, 1))
      : null;
    let perfScore = 70;
    const perfIssues: string[] = [];
    const perfActions: string[] = [];
    if (avgResponseMs !== null) {
      if (avgResponseMs < 500) perfScore = 95;
      else if (avgResponseMs < 1000) { perfScore = 80; perfIssues.push(`Average response time is ${avgResponseMs}ms`); }
      else if (avgResponseMs < 2000) { perfScore = 60; perfIssues.push(`Slow response time: ${avgResponseMs}ms`); perfActions.push("Contact FSTS support to investigate server performance"); }
      else { perfScore = 40; perfIssues.push(`Very slow response time: ${avgResponseMs}ms`); perfActions.push("Contact FSTS support immediately — server may be overloaded"); }
    } else {
      perfIssues.push("No performance data available — add a domain to enable monitoring");
    }
    const largeImages = media.filter((m: any) => m.sizeBytes > 2 * 1024 * 1024);
    if (largeImages.length > 0) {
      perfScore = Math.max(perfScore - 10, 0);
      perfIssues.push(`${largeImages.length} image(s) exceed 2MB and may slow page load`);
      perfActions.push("Use Smart Image Manager to optimize large images");
    }

    // ── SEO ─────────────────────────────────────────────────────────────
    let seoScore = 60;
    const seoIssues: string[] = [];
    const seoActions: string[] = [];
    const homepageSeo = seoSettings.find((s: any) => s.pagePath === "/" || s.pagePath === "home");
    if (!homepageSeo?.title) { seoScore -= 15; seoIssues.push("Missing homepage SEO title"); seoActions.push("Add an SEO title in SEO Settings"); }
    if (!homepageSeo?.description) { seoScore -= 15; seoIssues.push("Missing homepage meta description"); seoActions.push("Add a meta description in SEO Settings"); }
    if (!homepageSeo?.ogImageUrl) { seoScore -= 10; seoIssues.push("Missing Open Graph image for social sharing"); seoActions.push("Upload an OG image in SEO Settings"); }
    const missingAlt = media.filter((m: any) => !m.altText && m.mimeType?.startsWith("image/"));
    if (missingAlt.length > 0) { seoScore -= Math.min(missingAlt.length * 3, 15); seoIssues.push(`${missingAlt.length} image(s) missing alt text`); seoActions.push("Add alt text to images in the Media Library"); }
    seoScore = Math.max(seoScore, 0);

    // ── ACCESSIBILITY ───────────────────────────────────────────────────
    let a11yScore = 75;
    const a11yIssues: string[] = [];
    const a11yActions: string[] = [];
    if (missingAlt.length > 0) { a11yScore -= Math.min(missingAlt.length * 5, 25); a11yIssues.push(`${missingAlt.length} images lack alt text (screen reader issue)`); a11yActions.push("Use the AI assistant to generate alt text for your images"); }
    a11yScore = Math.max(a11yScore, 30);

    // ── FORMS ────────────────────────────────────────────────────────────
    const publishedForms = forms.filter((f: any) => f.status === "published");
    let formsScore = publishedForms.length > 0 ? 85 : 50;
    const formsIssues: string[] = [];
    const formsActions: string[] = [];
    if (forms.length === 0) { formsIssues.push("No forms created yet"); formsActions.push("Create a contact form in the Forms section"); }
    else if (publishedForms.length === 0) { formsIssues.push("Forms exist but none are published"); formsActions.push("Publish your forms so visitors can submit them"); }

    // ── EMAIL ────────────────────────────────────────────────────────────
    let emailScore = 50;
    const emailIssues: string[] = [];
    const emailActions: string[] = [];
    if (!emailSettings) { emailIssues.push("Email not configured"); emailActions.push("Set up email in Email Config"); }
    else if (!emailSettings.fromEmail) { emailScore = 40; emailIssues.push("Sender email not set"); emailActions.push("Add a from email address in Email Config"); }
    else { emailScore = 85; }

    // ── PAYMENTS ─────────────────────────────────────────────────────────
    let paymentsScore = 50;
    const paymentsIssues: string[] = [];
    const paymentsActions: string[] = [];
    if (!squareConfig) { paymentsIssues.push("Square Payments not configured"); paymentsActions.push("Connect Square in Square Payments settings"); }
    else if (!squareConfig.connected) { paymentsScore = 30; paymentsIssues.push("Square is disconnected"); paymentsActions.push("Reconnect Square in Square Payments settings"); }
    else { paymentsScore = 90; }

    // ── MEDIA ────────────────────────────────────────────────────────────
    let mediaScore = 80;
    const mediaIssues: string[] = [];
    const mediaActions: string[] = [];
    if (media.length === 0) { mediaScore = 50; mediaIssues.push("No media uploaded yet"); mediaActions.push("Upload images to your Media Library"); }
    const unoptimized = media.filter((m: any) => m.mimeType && !m.mimeType.includes("webp") && !m.mimeType.includes("avif") && m.sizeBytes > 500 * 1024);
    if (unoptimized.length > 0) { mediaScore -= Math.min(unoptimized.length * 5, 20); mediaIssues.push(`${unoptimized.length} image(s) are not optimized (not WebP/AVIF)`); mediaActions.push("Use Smart Image Manager to convert images to WebP"); }

    // ── CONTENT ──────────────────────────────────────────────────────────
    let contentScore = 70;
    const contentIssues: string[] = [];
    const contentActions: string[] = [];
    const publishedCourses = courses.filter((c: any) => c.status === "published" || c.status === "active");
    const publishedArticles = articles.filter((a: any) => a.status === "published");
    if (publishedCourses.length === 0) { contentScore -= 20; contentIssues.push("No published courses"); contentActions.push("Add and publish courses in the Courses section"); }
    if (publishedArticles.length === 0) { contentScore -= 10; contentIssues.push("No published articles/blog posts"); contentActions.push("Publish articles to improve SEO and engagement"); }
    const missingImages = courses.filter((c: any) => !c.imageUrl);
    if (missingImages.length > 0) { contentScore -= Math.min(missingImages.length * 3, 15); contentIssues.push(`${missingImages.length} course(s) missing images`); contentActions.push("Add images to all courses for better engagement"); }

    // ── MOBILE ──────────────────────────────────────────────────────────
    const mobileScore = 80;
    const mobileIssues: string[] = [];
    const mobileActions: string[] = [];
    if (largeImages.length > 0) { mobileIssues.push(`${largeImages.length} large image(s) may load slowly on mobile`); mobileActions.push("Optimize images for faster mobile loading"); }

    // ── BACKUPS ─────────────────────────────────────────────────────────
    let backupScore = 50;
    const backupIssues: string[] = [];
    const backupActions: string[] = [];
    if (!recentBackup) { backupIssues.push("No backups found"); backupActions.push("Backups run automatically — check back after 3 AM UTC"); }
    else {
      const daysSinceBackup = (now - recentBackup._creationTime) / (1000 * 60 * 60 * 24);
      if (daysSinceBackup < 2) { backupScore = 95; }
      else if (daysSinceBackup < 7) { backupScore = 75; backupIssues.push(`Last backup was ${Math.round(daysSinceBackup)} days ago`); }
      else { backupScore = 40; backupIssues.push(`Last backup was ${Math.round(daysSinceBackup)} days ago`); backupActions.push("Contact FSTS support if automated backups have stopped"); }
    }

    // ── TRENDS ────────────────────────────────────────────────────────────
    function getTrend(currentScore: number, catKey: string): "improving" | "stable" | "declining" {
      if (!prevScan?.categoryScores) return "stable";
      const prev = (prevScan.categoryScores as any)[catKey]?.score;
      if (prev === undefined) return "stable";
      if (currentScore > prev + 5) return "improving";
      if (currentScore < prev - 5) return "declining";
      return "stable";
    }

    const categoryScores: HealthScanCategories = {
      performance: { score: perfScore, status: scoreStatus(perfScore), lastScannedAt: now, trend: getTrend(perfScore, "performance"), issues: perfIssues, actions: perfActions },
      seo: { score: seoScore, status: scoreStatus(seoScore), lastScannedAt: now, trend: getTrend(seoScore, "seo"), issues: seoIssues, actions: seoActions },
      accessibility: { score: a11yScore, status: scoreStatus(a11yScore), lastScannedAt: now, trend: getTrend(a11yScore, "accessibility"), issues: a11yIssues, actions: a11yActions },
      security: { score: securityScore, status: scoreStatus(securityScore), lastScannedAt: now, trend: getTrend(securityScore, "security"), issues: securityIssues, actions: securityActions },
      forms: { score: formsScore, status: scoreStatus(formsScore), lastScannedAt: now, trend: getTrend(formsScore, "forms"), issues: formsIssues, actions: formsActions },
      email: { score: emailScore, status: scoreStatus(emailScore), lastScannedAt: now, trend: getTrend(emailScore, "email"), issues: emailIssues, actions: emailActions },
      payments: { score: paymentsScore, status: scoreStatus(paymentsScore), lastScannedAt: now, trend: getTrend(paymentsScore, "payments"), issues: paymentsIssues, actions: paymentsActions },
      media: { score: mediaScore, status: scoreStatus(mediaScore), lastScannedAt: now, trend: getTrend(mediaScore, "media"), issues: mediaIssues, actions: mediaActions },
      content: { score: contentScore, status: scoreStatus(contentScore), lastScannedAt: now, trend: getTrend(contentScore, "content"), issues: contentIssues, actions: contentActions },
      mobile: { score: mobileScore, status: scoreStatus(mobileScore), lastScannedAt: now, trend: getTrend(mobileScore, "mobile"), issues: mobileIssues, actions: mobileActions },
      uptime: { score: uptimeScore, status: scoreStatus(uptimeScore), lastScannedAt: now, trend: getTrend(uptimeScore, "uptime"), issues: uptimeIssues, actions: uptimeActions },
      backups: { score: backupScore, status: scoreStatus(backupScore), lastScannedAt: now, trend: getTrend(backupScore, "backups"), issues: backupIssues, actions: backupActions },
    };

    const scores = Object.values(categoryScores).map((c) => c.score);
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const overallStatus = overallScore >= 75 ? "Excellent" : overallScore >= 50 ? "Needs Attention" : "Critical Issues";

    await ctx.runMutation(internal.healthScans.saveScanResult, {
      siteId,
      overallScore,
      status: overallStatus,
      categoryScores,
    });

    // ── NOTIFICATIONS ──────────────────────────────────────────────────────
    if (uptimeScore < 90 && uptimeLogs.length > 0) {
      await ctx.runMutation(internal.healthScans.createNotification, {
        siteId, type: "uptime_low", severity: "critical",
        message: `Site uptime is ${uptimePercent}% — some visitors may be seeing downtime`,
        category: "uptime",
      });
    }
    if (!emailSettings) {
      await ctx.runMutation(internal.healthScans.createNotification, {
        siteId, type: "email_not_configured", severity: "warning",
        message: "Email delivery is not configured — form submissions won't send notifications",
        category: "email",
      });
    }
    if (squareConfig && !squareConfig.connected) {
      await ctx.runMutation(internal.healthScans.createNotification, {
        siteId, type: "square_disconnected", severity: "critical",
        message: "Square Payments is disconnected — customers cannot complete purchases",
        category: "payments",
      });
    }
    if (missingAlt.length > 3) {
      await ctx.runMutation(internal.healthScans.createNotification, {
        siteId, type: "missing_alt_text", severity: "warning",
        message: `${missingAlt.length} images are missing alt text — this affects SEO and accessibility`,
        category: "media",
      });
    }
  },
});

export const runScanForAllSites = internalAction({
  args: {},
  handler: async (ctx) => {
    const sites = await ctx.runQuery(internal.health.getAllActiveSites, {});
    await Promise.allSettled(
      sites.map(async (site: any) => {
        try {
          await ctx.runAction(internal.healthScans.runScanForSite, { siteId: site._id });
        } catch {
          // continue scanning other sites on error
        }
      })
    );
  },
});
