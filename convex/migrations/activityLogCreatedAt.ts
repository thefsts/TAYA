import { mutation } from "../_generated/server";

/**
 * One-time production migration for legacy activityLog documents created
 * before the explicit createdAt field was introduced.
 *
 * Uses Convex's immutable _creationTime as the safest historical timestamp.
 * Safe to run repeatedly: rows that already have createdAt are skipped.
 */
export const backfill = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("activityLog").collect();
    let updated = 0;
    let alreadySet = 0;

    for (const row of rows) {
      if (typeof (row as any).createdAt === "number") {
        alreadySet += 1;
        continue;
      }

      await ctx.db.patch(row._id, {
        createdAt: row._creationTime,
      });
      updated += 1;
    }

    return { scanned: rows.length, updated, alreadySet };
  },
});
