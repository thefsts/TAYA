import { db, activityLogTable } from "@workspace/db";
import type { AuthedUser } from "../middlewares/auth";

function truncate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > 500 ? `${str.slice(0, 500)}…` : str;
}

export async function logActivity(params: {
  siteId: number;
  actor: AuthedUser | undefined;
  action: string;
  entityType: string;
  entityId?: number | null;
  page?: string;
  previousValue?: unknown;
  newValue?: unknown;
  details?: string;
}): Promise<void> {
  await db.insert(activityLogTable).values({
    siteId: params.siteId,
    actorName: params.actor?.name ?? "Unknown user",
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    page: params.page ?? params.entityType,
    previousValue: truncate(params.previousValue),
    newValue: truncate(params.newValue),
    details: params.details ?? null,
  });
}
