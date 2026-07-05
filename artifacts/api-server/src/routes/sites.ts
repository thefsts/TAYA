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
  contactInfoTable,
  emailSettingsTable,
  homepageContentTable,
  footerContentTable,
  seoSettingsTable,
  userSiteRolesTable,
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
import { logActivity } from "../lib/activityLog";

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

  // FSTS-WOS client onboarding standard: no manual seeding should ever be required.
  // Seed default content rows so dashboard editors work immediately for a new site.
  await Promise.all([
    db.insert(homepageContentTable).values({
      siteId: site.id,
      heroHeadline: `Welcome to ${site.name}`,
      heroSubheadline: "Edit this hero section from the Homepage editor.",
    }),
    db.insert(footerContentTable).values({
      siteId: site.id,
      copyrightText: `© ${new Date().getFullYear()} ${site.name}. All rights reserved.`,
    }),
    db.insert(contactInfoTable).values({
      siteId: site.id,
      email: "",
      phone: "",
      address: "",
    }),
    db.insert(seoSettingsTable).values({
      siteId: site.id,
      pagePath: "/",
      title: site.name,
      description: `${site.name} — powered by Full Stack Tech Solutions.`,
    }),
  ]);

  const creator = req.dashboardUser;
  if (creator && !creator.isSuperAdmin) {
    await db.insert(userSiteRolesTable).values({ userId: creator.id, siteId: site.id, role: "client_admin" });
  }

  await logActivity({
    siteId: site.id,
    actor: creator,
    action: "created",
    entityType: "site",
    page: "Site Onboarding",
    newValue: site,
  });

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

async function checkWebsiteHealth(
  domain: string | null,
): Promise<{ websiteOnline: boolean | null; sslActive: boolean | null; responseTimeMs: number | null }> {
  if (!domain) return { websiteOnline: null, sslActive: null, responseTimeMs: null };
  const url = `https://${domain}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const start = Date.now();
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    return { websiteOnline: response.ok || response.status < 500, sslActive: true, responseTimeMs: Date.now() - start };
  } catch {
    return { websiteOnline: false, sslActive: null, responseTimeMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

router.get("/sites/:siteId/dashboard-summary", requireAuth, async (req, res): Promise<void> => {
  const params = GetSiteDashboardSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { siteId } = params.data;

  const [site, courses, events, articles, media, backups, [squareConfig], [contactInfo], [emailSettings], recentActivity] =
    await Promise.all([
      db.select().from(sitesTable).where(eq(sitesTable.id, siteId)),
      db.select().from(coursesTable).where(eq(coursesTable.siteId, siteId)),
      db.select().from(eventsTable).where(eq(eventsTable.siteId, siteId)),
      db.select().from(articlesTable).where(eq(articlesTable.siteId, siteId)),
      db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.siteId, siteId)),
      db.select().from(backupsTable).where(eq(backupsTable.siteId, siteId)).orderBy(desc(backupsTable.createdAt)),
      db.select().from(squareConfigTable).where(eq(squareConfigTable.siteId, siteId)),
      db.select().from(contactInfoTable).where(eq(contactInfoTable.siteId, siteId)),
      db.select().from(emailSettingsTable).where(eq(emailSettingsTable.siteId, siteId)),
      db
        .select()
        .from(activityLogTable)
        .where(eq(activityLogTable.siteId, siteId))
        .orderBy(desc(activityLogTable.createdAt))
        .limit(10),
    ]);

  const health = await checkWebsiteHealth(site[0]?.domain ?? null);

  res.json(
    GetSiteDashboardSummaryResponse.parse({
      siteId,
      courseCount: courses.length,
      eventCount: events.length,
      articleCount: articles.length,
      mediaCount: media.length,
      lastBackupAt: backups[0]?.createdAt ?? null,
      squareConnected: squareConfig?.connected ?? false,
      emailConfigured: !!(emailSettings?.fromEmail),
      formsConfigured: !!(contactInfo?.email),
      ...health,
      recentActivity,
    }),
  );
});

export default router;
