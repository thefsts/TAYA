import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, seoSettingsTable } from "@workspace/db";
import {
  ListSeoSettingsParams,
  ListSeoSettingsResponse,
  CreateSeoSettingParams,
  CreateSeoSettingBody,
  UpdateSeoSettingParams,
  UpdateSeoSettingBody,
  UpdateSeoSettingResponse,
  DeleteSeoSettingParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, marketingRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/seo-settings",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListSeoSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const settings = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.siteId, params.data.siteId));
    res.json(ListSeoSettingsResponse.parse(settings));
  },
);

router.post(
  "/sites/:siteId/seo-settings",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = CreateSeoSettingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateSeoSettingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [setting] = await db
      .insert(seoSettingsTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    res.status(201).json(UpdateSeoSettingResponse.parse(setting));
  },
);

router.patch(
  "/sites/:siteId/seo-settings/:seoSettingId",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = UpdateSeoSettingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateSeoSettingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [setting] = await db
      .update(seoSettingsTable)
      .set(parsed.data)
      .where(
        and(eq(seoSettingsTable.siteId, params.data.siteId), eq(seoSettingsTable.id, params.data.seoSettingId)),
      )
      .returning();
    if (!setting) {
      res.status(404).json({ error: "SEO setting not found" });
      return;
    }
    res.json(UpdateSeoSettingResponse.parse(setting));
  },
);

router.delete(
  "/sites/:siteId/seo-settings/:seoSettingId",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = DeleteSeoSettingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [setting] = await db
      .delete(seoSettingsTable)
      .where(
        and(eq(seoSettingsTable.siteId, params.data.siteId), eq(seoSettingsTable.id, params.data.seoSettingId)),
      )
      .returning();
    if (!setting) {
      res.status(404).json({ error: "SEO setting not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
