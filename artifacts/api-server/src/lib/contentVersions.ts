import { db, contentVersionsTable } from "@workspace/db";
import type { AuthedUser } from "../middlewares/auth";

export async function recordVersion(params: {
  siteId: number;
  actor: AuthedUser | undefined;
  entityType: string;
  entityId?: number | null;
  snapshot: unknown;
}): Promise<void> {
  await db.insert(contentVersionsTable).values({
    siteId: params.siteId,
    entityType: params.entityType,
    entityId: params.entityId ?? 0,
    snapshot: params.snapshot as object,
    createdByName: params.actor?.name ?? "Unknown user",
  });
}
