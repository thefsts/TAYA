import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userSiteRolesTable, sitesTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
  ListUsersResponse,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSuperAdmin } from "../lib/rbac";

const router: IRouter = Router();

async function hydrateUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const assignments = await db.select().from(userSiteRolesTable).where(eq(userSiteRolesTable.userId, userId));
  const roleAssignments = await Promise.all(
    assignments.map(async (a) => {
      const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, a.siteId));
      return { siteId: a.siteId, siteName: site?.name ?? "Unknown site", role: a.role };
    }),
  );
  return { ...user, roleAssignments };
}

router.get("/users", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable);
  const hydrated = await Promise.all(users.map((u) => hydrateUser(u.id)));
  res.json(ListUsersResponse.parse(hydrated));
});

router.post("/users", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { roleAssignments, ...userFields } = parsed.data;
  const [user] = await db
    .insert(usersTable)
    .values({ ...userFields, clerkUserId: `pending:${userFields.email}` })
    .returning();

  if (roleAssignments?.length) {
    await db
      .insert(userSiteRolesTable)
      .values(roleAssignments.map((r) => ({ userId: user.id, siteId: r.siteId, role: r.role })));
  }

  res.status(201).json(UpdateUserResponse.parse(await hydrateUser(user.id)));
});

router.patch("/users/:userId", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { roleAssignments, ...userFields } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (Object.keys(userFields).length > 0) {
    await db.update(usersTable).set(userFields).where(eq(usersTable.id, params.data.userId));
  }

  if (roleAssignments) {
    await db.delete(userSiteRolesTable).where(eq(userSiteRolesTable.userId, params.data.userId));
    if (roleAssignments.length > 0) {
      await db
        .insert(userSiteRolesTable)
        .values(roleAssignments.map((r) => ({ userId: params.data.userId, siteId: r.siteId, role: r.role })));
    }
  }

  res.json(UpdateUserResponse.parse(await hydrateUser(params.data.userId)));
});

router.delete("/users/:userId", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
