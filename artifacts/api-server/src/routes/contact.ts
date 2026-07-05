import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contactInfoTable } from "@workspace/db";
import {
  GetContactInfoParams,
  GetContactInfoResponse,
  UpdateContactInfoParams,
  UpdateContactInfoBody,
  UpdateContactInfoResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, contentEditorRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/contact-info",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetContactInfoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [info] = await db.select().from(contactInfoTable).where(eq(contactInfoTable.siteId, params.data.siteId));
    if (!info) {
      res.json(
        GetContactInfoResponse.parse({
          siteId: params.data.siteId,
          email: "",
          phone: "",
          address: "",
          mapEmbedUrl: null,
          hours: [],
          updatedAt: new Date(),
        }),
      );
      return;
    }
    res.json(GetContactInfoResponse.parse(info));
  },
);

router.put(
  "/sites/:siteId/contact-info",
  requireAuth,
  requireSiteRole(...contentEditorRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = UpdateContactInfoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateContactInfoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(contactInfoTable)
      .where(eq(contactInfoTable.siteId, params.data.siteId));
    const [info] = existing
      ? await db
          .update(contactInfoTable)
          .set(parsed.data)
          .where(eq(contactInfoTable.siteId, params.data.siteId))
          .returning()
      : await db
          .insert(contactInfoTable)
          .values({ siteId: params.data.siteId, ...parsed.data })
          .returning();
    res.json(UpdateContactInfoResponse.parse(info));
  },
);

export default router;
