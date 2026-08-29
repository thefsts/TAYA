import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { provisionUser } from "./lib/getCurrentUser";
import { logActivity } from "./lib/logActivity";

/**
 * Manually clears a client-portal login lockout.
 *
 * Security boundary: this is intentionally restricted to FSTS superadmins.
 * Portal lockouts are an authentication/security control and must not be
 * bypassable by ordinary client roles.
 */
export const unlockPortalUser = mutation({
  args: { portalUserId: v.id("portalUsers") },
  handler: async (ctx, { portalUserId }) => {
    const admin = await provisionUser(ctx);
    if (!admin.isSuperAdmin) {
      throw new Error("Forbidden: superadmin only");
    }

    const portalUser = await ctx.db.get(portalUserId);
    if (!portalUser) throw new Error("Portal user not found");

    const previousFailedLoginCount = portalUser.failedLoginCount ?? 0;
    const previousLockedUntil = portalUser.lockedUntil;

    await ctx.db.patch(portalUserId, {
      failedLoginCount: 0,
      lockedUntil: undefined,
    });

    await logActivity(ctx, {
      siteId: portalUser.siteId,
      actorName: admin.name,
      action: "unlocked portal account",
      entityType: "portalUser",
      entityId: String(portalUserId),
      page: "portal",
      previousValue: {
        failedLoginCount: previousFailedLoginCount,
        lockedUntil: previousLockedUntil,
      },
      newValue: { failedLoginCount: 0, lockedUntil: null },
      details: `Manually cleared portal login lockout for ${portalUser.email}`,
    });

    return {
      success: true,
      portalUserId,
      previousFailedLoginCount,
      previousLockedUntil: previousLockedUntil ?? null,
    };
  },
});
