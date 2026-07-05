import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, userSiteRolesTable, type DashboardUser, type UserSiteRole } from "@workspace/db";

export type AuthedUser = DashboardUser & { roleAssignments: UserSiteRole[] };

declare global {
  namespace Express {
    interface Request {
      dashboardUser?: AuthedUser;
    }
  }
}

async function provisionUser(clerkUserId: string): Promise<DashboardUser> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@unknown.local`;
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (existing) {
    return existing;
  }

  const isFirstUser = (await db.select().from(usersTable)).length === 0;

  const [created] = await db
    .insert(usersTable)
    .values({ clerkUserId, name, email, isSuperAdmin: isFirstUser, isActive: true })
    .onConflictDoNothing({ target: usersTable.clerkUserId })
    .returning();

  if (created) {
    return created;
  }

  const [raceWinner] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  if (!raceWinner) {
    throw new Error(`Failed to provision or find dashboard user for clerkUserId=${clerkUserId}`);
  }
  return raceWinner;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await provisionUser(auth.userId);
    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }
    const roleAssignments = await db
      .select()
      .from(userSiteRolesTable)
      .where(eq(userSiteRolesTable.userId, user.id));
    req.dashboardUser = { ...user, roleAssignments };
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to resolve dashboard user");
    res.status(500).json({ error: "Failed to resolve user" });
  }
}
