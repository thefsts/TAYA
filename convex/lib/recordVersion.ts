import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function recordVersion(
  ctx: MutationCtx,
  params: {
    siteId: Id<"sites">;
    actorName: string;
    entityType: string;
    entityId?: string;
    snapshot: unknown;
  },
): Promise<void> {
  await ctx.db.insert("contentVersions", {
    siteId: params.siteId,
    entityType: params.entityType,
    entityId: params.entityId ?? "",
    snapshot: params.snapshot,
    createdByName: params.actorName,
  });
}
