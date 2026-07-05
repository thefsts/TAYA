import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activityLogTable } from "@workspace/db";
import { ListActivityLogParams, ListActivityLogResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/activity-log",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListActivityLogParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const entries = await db
      .select()
      .from(activityLogTable)
      .where(eq(activityLogTable.siteId, params.data.siteId))
      .orderBy(desc(activityLogTable.createdAt));
    res.json(ListActivityLogResponse.parse(entries));
  },
);

export default router;
