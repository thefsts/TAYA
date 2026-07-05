import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailSettingsTable } from "@workspace/db";
import {
  GetEmailSettingsParams,
  GetEmailSettingsResponse,
  UpdateEmailSettingsParams,
  UpdateEmailSettingsBody,
  UpdateEmailSettingsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, adminRoles } from "../lib/rbac";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/email-settings",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetEmailSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [settings] = await db
      .select()
      .from(emailSettingsTable)
      .where(eq(emailSettingsTable.siteId, params.data.siteId));
    if (!settings) {
      res.json(
        GetEmailSettingsResponse.parse({
          siteId: params.data.siteId,
          fromName: "",
          fromEmail: "",
          replyToEmail: "",
          notifyOnNewLead: true,
          notifyOnBooking: true,
          updatedAt: new Date(),
        }),
      );
      return;
    }
    res.json(GetEmailSettingsResponse.parse(settings));
  },
);

router.put(
  "/sites/:siteId/email-settings",
  requireAuth,
  requireSiteRole(...adminRoles, "marketing"),
  async (req, res): Promise<void> => {
    const params = UpdateEmailSettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateEmailSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(emailSettingsTable)
      .where(eq(emailSettingsTable.siteId, params.data.siteId));
    const [settings] = existing
      ? await db
          .update(emailSettingsTable)
          .set(parsed.data)
          .where(eq(emailSettingsTable.siteId, params.data.siteId))
          .returning()
      : await db
          .insert(emailSettingsTable)
          .values({ siteId: params.data.siteId, ...parsed.data })
          .returning();
    res.json(UpdateEmailSettingsResponse.parse(settings));
  },
);

export default router;
