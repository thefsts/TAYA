import { query } from "../_generated/server";

/**
 * Temporary read-only production certification query.
 *
 * Run after the strict production schema deploy. It deliberately performs no
 * writes and exposes no secrets. Delete this migration helper after the TAYA
 * production migration and final certification are complete.
 */
export const validate = query({
  args: {},
  handler: async (ctx) => {
    const corsair = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", "corsair-tactical-solutions"))
      .first();

    if (!corsair) {
      throw new Error("Production validation failed: corsair-tactical-solutions site is missing");
    }

    const [
      siteSettings,
      users,
      activityLog,
      portalConfigs,
      portalUsers,
      portalSessions,
      homepageContent,
      navigationItems,
      footerContent,
      contactInfo,
      seoSettings,
      courses,
      events,
      services,
      products,
      flyers,
      forms,
      submissions,
      crmConnections,
      squareOrders,
      policyPages,
      importedReviews,
      automationRules,
      contentVersions,
      backups,
      healthLogs,
    ] = await Promise.all([
      ctx.db.query("siteSettings").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("activityLog").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("portalConfigs").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("portalUsers").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("portalSessions").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("navigationItems").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("footerContent").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("contactInfo").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("seoSettings").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("siteServices").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("siteProducts").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("flyers").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("forms").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("formSubmissions").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("crmConnections").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("squareOrders").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("policyPages").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("importedReviews").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("automationRules").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("contentVersions").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("backups").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
      ctx.db.query("siteHealthLogs").withIndex("by_site", (q) => q.eq("siteId", corsair._id)).collect(),
    ]);

    const activityMissingCreatedAt = activityLog.filter(
      (row) => typeof row.createdAt !== "number",
    ).length;

    if (activityMissingCreatedAt > 0) {
      throw new Error(
        `Production validation failed: ${activityMissingCreatedAt} Corsair activityLog rows still lack createdAt`,
      );
    }

    return {
      site: {
        id: corsair._id,
        slug: corsair.slug,
        name: corsair.name,
        status: corsair.status,
      },
      counts: {
        siteSettings: siteSettings.length,
        users: users.length,
        activityLog: activityLog.length,
        portalConfigs: portalConfigs.length,
        portalUsers: portalUsers.length,
        portalSessions: portalSessions.length,
        homepageContent: homepageContent.length,
        navigationItems: navigationItems.length,
        footerContent: footerContent.length,
        contactInfo: contactInfo.length,
        seoSettings: seoSettings.length,
        courses: courses.length,
        events: events.length,
        services: services.length,
        products: products.length,
        flyers: flyers.length,
        forms: forms.length,
        submissions: submissions.length,
        crmConnections: crmConnections.length,
        squareOrders: squareOrders.length,
        policyPages: policyPages.length,
        importedReviews: importedReviews.length,
        automationRules: automationRules.length,
        contentVersions: contentVersions.length,
        backups: backups.length,
        healthLogs: healthLogs.length,
      },
      invariants: {
        corsairExists: true,
        activityMissingCreatedAt,
        schemaAcceptedAllQueriedTables: true,
      },
    };
  },
});
