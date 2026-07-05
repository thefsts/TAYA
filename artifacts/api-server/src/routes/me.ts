import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sitesTable, type UserSiteRole } from "@workspace/db";
import { GetMeResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const user = req.dashboardUser!;
  const roleAssignments = await Promise.all(
    user.roleAssignments.map(async (assignment: UserSiteRole) => {
      const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, assignment.siteId));
      return { siteId: assignment.siteId, siteName: site?.name ?? "Unknown site", role: assignment.role };
    }),
  );

  res.json(
    GetMeResponse.parse({
      id: user.id,
      clerkUserId: user.clerkUserId,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      roleAssignments,
    }),
  );
});

export default router;
