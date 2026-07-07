import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

function truncate(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > 500 ? `${str.slice(0, 500)}…` : str;
}

export async function logActivity(
  ctx: MutationCtx,
  params: {
    siteId: Id<"sites">;
    actorName: string;
    action: string;
    entityType: string;
    entityId?: string;
    page?: string;
    previousValue?: unknown;
    newValue?: unknown;
    details?: string;
  },
): Promise<void> {
  await ctx.db.insert("activityLog", {
    siteId: params.siteId,
    actorName: params.actorName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    page: params.page ?? params.entityType,
    previousValue: truncate(params.previousValue) ?? undefined,
    newValue: truncate(params.newValue) ?? undefined,
    details: params.details,
  });
}
