import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, mediaAssetsTable } from "@workspace/db";
import {
  ListMediaAssetsParams,
  ListMediaAssetsResponse,
  CreateMediaAssetParams,
  CreateMediaAssetBody,
  DeleteMediaAssetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, contentEditorRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/media-assets",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListMediaAssetsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const assets = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.siteId, params.data.siteId));
    res.json(ListMediaAssetsResponse.parse(assets));
  },
);

router.post(
  "/sites/:siteId/media-assets",
  requireAuth,
  requireSiteRole(...contentEditorRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = CreateMediaAssetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateMediaAssetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [asset] = await db
      .insert(mediaAssetsTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    res.status(201).json(asset);
  },
);

router.delete(
  "/sites/:siteId/media-assets/:mediaAssetId",
  requireAuth,
  requireSiteRole(...contentEditorRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = DeleteMediaAssetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [asset] = await db
      .delete(mediaAssetsTable)
      .where(
        and(eq(mediaAssetsTable.siteId, params.data.siteId), eq(mediaAssetsTable.id, params.data.mediaAssetId)),
      )
      .returning();
    if (!asset) {
      res.status(404).json({ error: "Media asset not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
