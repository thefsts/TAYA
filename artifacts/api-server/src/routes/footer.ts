import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, footerContentTable } from "@workspace/db";
import {
  GetFooterContentParams,
  GetFooterContentResponse,
  UpdateFooterContentParams,
  UpdateFooterContentBody,
  UpdateFooterContentResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, contentEditorRoles } from "../lib/rbac";
import { logActivity } from "../lib/activityLog";
import { recordVersion } from "../lib/contentVersions";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/footer",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetFooterContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [content] = await db
      .select()
      .from(footerContentTable)
      .where(eq(footerContentTable.siteId, params.data.siteId));
    if (!content) {
      res.json(
        GetFooterContentResponse.parse({
          siteId: params.data.siteId,
          columns: [],
          socialLinks: [],
          copyrightText: "",
          updatedAt: new Date(),
        }),
      );
      return;
    }
    res.json(GetFooterContentResponse.parse(content));
  },
);

router.put(
  "/sites/:siteId/footer",
  requireAuth,
  requireSiteRole(...contentEditorRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = UpdateFooterContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateFooterContentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(footerContentTable)
      .where(eq(footerContentTable.siteId, params.data.siteId));
    const [content] = existing
      ? await db
          .update(footerContentTable)
          .set(parsed.data)
          .where(eq(footerContentTable.siteId, params.data.siteId))
          .returning()
      : await db
          .insert(footerContentTable)
          .values({ siteId: params.data.siteId, ...parsed.data })
          .returning();
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: existing ? "updated" : "created",
      entityType: "footer",
      page: "Footer",
      previousValue: existing,
      newValue: content,
    });
    await recordVersion({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      entityType: "footer",
      entityId: content.id,
      snapshot: content,
    });
    res.json(UpdateFooterContentResponse.parse(content));
  },
);

export default router;
