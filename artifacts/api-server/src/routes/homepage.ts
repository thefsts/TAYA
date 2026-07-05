import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, homepageContentTable } from "@workspace/db";
import {
  GetHomepageContentParams,
  GetHomepageContentResponse,
  UpdateHomepageContentParams,
  UpdateHomepageContentBody,
  UpdateHomepageContentResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, contentEditorRoles, anySiteRole } from "../lib/rbac";
import { logActivity } from "../lib/activityLog";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/homepage",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetHomepageContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [content] = await db
      .select()
      .from(homepageContentTable)
      .where(eq(homepageContentTable.siteId, params.data.siteId));
    if (!content) {
      res.json(
        GetHomepageContentResponse.parse({
          siteId: params.data.siteId,
          heroHeadline: "",
          heroSubheadline: "",
          heroImageUrl: null,
          sections: [],
          updatedAt: new Date(),
        }),
      );
      return;
    }
    res.json(GetHomepageContentResponse.parse(content));
  },
);

router.put(
  "/sites/:siteId/homepage",
  requireAuth,
  requireSiteRole(...contentEditorRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = UpdateHomepageContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateHomepageContentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(homepageContentTable)
      .where(eq(homepageContentTable.siteId, params.data.siteId));

    const [content] = existing
      ? await db
          .update(homepageContentTable)
          .set(parsed.data)
          .where(eq(homepageContentTable.siteId, params.data.siteId))
          .returning()
      : await db
          .insert(homepageContentTable)
          .values({ siteId: params.data.siteId, ...parsed.data })
          .returning();

    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: existing ? "updated" : "created",
      entityType: "homepage",
      page: "Homepage",
      previousValue: existing,
      newValue: content,
    });

    res.json(UpdateHomepageContentResponse.parse(content));
  },
);

export default router;
