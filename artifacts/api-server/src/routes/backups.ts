import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  backupsTable,
  homepageContentTable,
  coursesTable,
  eventsTable,
  articlesTable,
  seoSettingsTable,
  footerContentTable,
  contactInfoTable,
} from "@workspace/db";
import {
  ListBackupsParams,
  ListBackupsResponse,
  CreateBackupParams,
  RestoreBackupParams,
  RestoreBackupResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, adminRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/backups",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListBackupsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const backups = await db
      .select()
      .from(backupsTable)
      .where(eq(backupsTable.siteId, params.data.siteId))
      .orderBy(desc(backupsTable.createdAt));
    res.json(ListBackupsResponse.parse(backups));
  },
);

router.post(
  "/sites/:siteId/backups",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = CreateBackupParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const { siteId } = params.data;

    const [homepage, courses, events, articles, seo, footer, contact] = await Promise.all([
      db.select().from(homepageContentTable).where(eq(homepageContentTable.siteId, siteId)),
      db.select().from(coursesTable).where(eq(coursesTable.siteId, siteId)),
      db.select().from(eventsTable).where(eq(eventsTable.siteId, siteId)),
      db.select().from(articlesTable).where(eq(articlesTable.siteId, siteId)),
      db.select().from(seoSettingsTable).where(eq(seoSettingsTable.siteId, siteId)),
      db.select().from(footerContentTable).where(eq(footerContentTable.siteId, siteId)),
      db.select().from(contactInfoTable).where(eq(contactInfoTable.siteId, siteId)),
    ]);

    const snapshot = { homepage, courses, events, articles, seo, footer, contact };
    const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const label = `Backup ${new Date().toISOString()}`;

    const [backup] = await db.insert(backupsTable).values({ siteId, label, sizeBytes, snapshot }).returning();
    res.status(201).json(backup);
  },
);

router.post(
  "/sites/:siteId/backups/:backupId/restore",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = RestoreBackupParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [backup] = await db
      .select()
      .from(backupsTable)
      .where(and(eq(backupsTable.siteId, params.data.siteId), eq(backupsTable.id, params.data.backupId)));
    if (!backup) {
      res.status(404).json({ error: "Backup not found" });
      return;
    }
    res.json(RestoreBackupResponse.parse(backup));
  },
);

export default router;
