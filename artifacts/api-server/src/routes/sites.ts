import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  sitesTable,
  coursesTable,
  eventsTable,
  articlesTable,
  mediaAssetsTable,
  backupsTable,
  squareConfigTable,
  activityLogTable,
  crmConnectionsTable,
  defaultModulesForWebsiteType,
  type UserSiteRole,
  type WebsiteType,
} from "@workspace/db";
import {
  CreateSiteBody,
  GetSiteParams,
  UpdateSiteParams,
  UpdateSiteBody,
  DeleteSiteParams,
  GetSiteDashboardSummaryParams,
  GetSiteDashboardSummaryResponse,
  ListSitesResponse,
  GetSiteResponse,
  UpdateSiteResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSuperAdmin } from "../lib/rbac";

const router: IRouter = Router();

router.get("/sites", requireAuth, async (req, res): Promise<void> => {
  const user = req.dashboardUser!;
  const allSites = await db.select().from(sitesTable);
  const sites = user.isSuperAdmin
    ? allSites
    : allSites.filter((s) => user.roleAssignments.some((r: UserSiteRole) => r.siteId === s.id));

  res.json(ListSitesResponse.parse(sites));
});

router.post("/sites", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const websiteType = (parsed.data.websiteType ?? "business_website") as WebsiteType;
  const values = {
    ...parsed.data,
    websiteType,
    enabledModules: parsed.data.enabledModules ?? defaultModulesForWebsiteType(websiteType),
  };
  const [site] = await db.insert(sitesTable).values(values).returning();
  // Every new site gets a default-installed-but-not-connected Operon Connector row.
  await db.insert(crmConnectionsTable).values({ siteId: site.id, provider: "operon" });
  res.status(201).json(GetSiteResponse.parse(site));
});

router.get("/sites/:siteId", requireAuth, async (req, res): Promise<void> => {
  const params = GetSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, params.data.siteId));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(GetSiteResponse.parse(site));
});

router.patch("/sites/:siteId", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = UpdateSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const values = { ...parsed.data } as typeof parsed.data & { enabledModules?: ReturnType<typeof defaultModulesForWebsiteType> };
  if (values.websiteType && !values.enabledModules) {
    values.enabledModules = defaultModulesForWebsiteType(values.websiteType as WebsiteType);
  }
  const [site] = await db
    .update(sitesTable)
    .set(values)
    .where(eq(sitesTable.id, params.data.siteId))
    .returning();
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(UpdateSiteResponse.parse(site));
});

router.delete("/sites/:siteId", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = DeleteSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [site] = await db.delete(sitesTable).where(eq(sitesTable.id, params.data.siteId)).returning();
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/sites/:siteId/dashboard-summary", requireAuth, async (req, res): Promise<void> => {
  const params = GetSiteDashboardSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { siteId } = params.data;

  const [courses, events, articles, media, backups, [squareConfig], recentActivity] = await Promise.all([
    db.select().from(coursesTable).where(eq(coursesTable.siteId, siteId)),
    db.select().from(eventsTable).where(eq(eventsTable.siteId, siteId)),
    db.select().from(articlesTable).where(eq(articlesTable.siteId, siteId)),
    db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.siteId, siteId)),
    db.select().from(backupsTable).where(eq(backupsTable.siteId, siteId)).orderBy(desc(backupsTable.createdAt)),
    db.select().from(squareConfigTable).where(eq(squareConfigTable.siteId, siteId)),
    db
      .select()
      .from(activityLogTable)
      .where(eq(activityLogTable.siteId, siteId))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(10),
  ]);

  res.json(
    GetSiteDashboardSummaryResponse.parse({
      siteId,
      courseCount: courses.length,
      eventCount: events.length,
      articleCount: articles.length,
      mediaCount: media.length,
      lastBackupAt: backups[0]?.createdAt ?? null,
      squareConnected: squareConfig?.connected ?? false,
      recentActivity,
    }),
  );
});

export default router;
