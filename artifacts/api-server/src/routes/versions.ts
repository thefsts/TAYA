import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, contentVersionsTable } from "@workspace/db";
import { ListContentVersionsResponse, RestoreContentVersionParams, RestoreContentVersionResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, contentEditorRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/versions",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const siteId = parseInt(req.params.siteId as string, 10);
    if (!Number.isFinite(siteId)) {
      res.status(400).json({ error: "Invalid site id" });
      return;
    }
    const versions = await db
      .select()
      .from(contentVersionsTable)
      .where(eq(contentVersionsTable.siteId, siteId))
      .orderBy(desc(contentVersionsTable.createdAt));
    res.json(ListContentVersionsResponse.parse(versions));
  },
);

router.post(
  "/sites/:siteId/versions/:versionId/restore",
  requireAuth,
  requireSiteRole(...contentEditorRoles),
  async (req, res): Promise<void> => {
    const params = RestoreContentVersionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [version] = await db
      .select()
      .from(contentVersionsTable)
      .where(
        and(
          eq(contentVersionsTable.siteId, params.data.siteId),
          eq(contentVersionsTable.id, params.data.versionId),
        ),
      );
    if (!version) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    res.json(RestoreContentVersionResponse.parse(version));
  },
);

export default router;
