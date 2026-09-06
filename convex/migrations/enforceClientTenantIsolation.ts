import { mutation, query } from "../_generated/server";

/**
 * One-off production guard/repair for the two live client owner accounts.
 *
 * Owner-reported defect (2026-09-06): signing in as the FSTS client account
 * opened the Corsair workspace. These two accounts are intentionally
 * single-site owners today, so this migration pins each Clerk identity to the
 * one canonical site it is allowed to own.
 *
 * Safe properties:
 * - resolves sites by canonical slug, never hard-coded site ids
 * - resolves users by the already-verified Clerk ids from the prior invitation
 *   repair
 * - refuses to run if either canonical site or user is missing
 * - only edits the two known client records
 * - idempotent
 */

const FSTS_CLERK_ID = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const FSTS_EMAIL = "cdweemsbey@gmail.com";
const FSTS_SITE_SLUG = "httpswwwfstacktsolutionscom";

const CORSAIR_CLERK_ID = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const CORSAIR_SITE_SLUG = "corsair-tactical-solutions";

async function snapshot(ctx: any) {
  const [users, sites] = await Promise.all([
    ctx.db.query("users").collect(),
    ctx.db.query("sites").collect(),
  ]);

  const fstsSite = sites.find((s: any) => s.slug === FSTS_SITE_SLUG) ?? null;
  const corsairSite = sites.find((s: any) => s.slug === CORSAIR_SITE_SLUG) ?? null;
  const fstsUser = users.find((u: any) => u.clerkUserId === FSTS_CLERK_ID) ?? null;
  const corsairUser = users.find((u: any) => u.clerkUserId === CORSAIR_CLERK_ID) ?? null;

  return { fstsSite, corsairSite, fstsUser, corsairUser };
}

export const audit = query({
  args: {},
  handler: async (ctx) => {
    const { fstsSite, corsairSite, fstsUser, corsairUser } = await snapshot(ctx);
    return {
      fsts: {
        expectedEmail: FSTS_EMAIL,
        expectedSiteSlug: FSTS_SITE_SLUG,
        siteId: fstsSite?._id ?? null,
        userId: fstsUser?._id ?? null,
        actualEmail: fstsUser?.email ?? null,
        active: fstsUser?.isActive ?? null,
        roles: fstsUser?.roles ?? null,
        hasForeignRole:
          !!fstsUser && !!fstsSite &&
          (fstsUser.roles ?? []).some((r: any) => String(r.siteId) !== String(fstsSite._id)),
      },
      corsair: {
        expectedEmail: CORSAIR_EMAIL,
        expectedSiteSlug: CORSAIR_SITE_SLUG,
        siteId: corsairSite?._id ?? null,
        userId: corsairUser?._id ?? null,
        actualEmail: corsairUser?.email ?? null,
        active: corsairUser?.isActive ?? null,
        roles: corsairUser?.roles ?? null,
        hasForeignRole:
          !!corsairUser && !!corsairSite &&
          (corsairUser.roles ?? []).some((r: any) => String(r.siteId) !== String(corsairSite._id)),
      },
    };
  },
});

export const repair = mutation({
  args: {},
  handler: async (ctx) => {
    const { fstsSite, corsairSite, fstsUser, corsairUser } = await snapshot(ctx);

    if (!fstsSite) throw new Error(`Missing canonical site: ${FSTS_SITE_SLUG}`);
    if (!corsairSite) throw new Error(`Missing canonical site: ${CORSAIR_SITE_SLUG}`);
    if (!fstsUser) throw new Error(`Missing FSTS user: ${FSTS_CLERK_ID}`);
    if (!corsairUser) throw new Error(`Missing Corsair user: ${CORSAIR_CLERK_ID}`);

    const log: string[] = [];

    const fstsRole = (fstsUser.roles ?? []).find(
      (r: any) => String(r.siteId) === String(fstsSite._id),
    );
    const corsairRoles = (corsairUser.roles ?? []).filter(
      (r: any) => String(r.siteId) === String(corsairSite._id),
    );

    // FSTS is a single-site owner account. If its expected role disappeared,
    // restore only the owner role on the canonical FSTS site.
    const exactFstsRoles = fstsRole
      ? [{ siteId: fstsSite._id, role: fstsRole.role }]
      : [{ siteId: fstsSite._id, role: "owner" }];

    // Corsair currently carries owner + content_editor. Preserve every role it
    // already has on Corsair, but strip roles for all other tenants. If none
    // remain, restore the minimum owner role so the account is not locked out.
    const exactCorsairRoles = corsairRoles.length > 0
      ? corsairRoles.map((r: any) => ({ siteId: corsairSite._id, role: r.role }))
      : [{ siteId: corsairSite._id, role: "owner" }];

    await ctx.db.patch(fstsUser._id, {
      email: FSTS_EMAIL,
      isActive: true,
      isSuperAdmin: false,
      roles: exactFstsRoles,
    });
    log.push(`FSTS pinned to ${FSTS_SITE_SLUG}; foreign tenant roles removed`);

    await ctx.db.patch(corsairUser._id, {
      email: CORSAIR_EMAIL,
      isActive: true,
      isSuperAdmin: false,
      roles: exactCorsairRoles,
    });
    log.push(`Corsair pinned to ${CORSAIR_SITE_SLUG}; foreign tenant roles removed`);

    return {
      repaired: true,
      log,
      fsts: {
        clerkUserId: FSTS_CLERK_ID,
        email: FSTS_EMAIL,
        siteId: fstsSite._id,
        siteSlug: fstsSite.slug,
        roles: exactFstsRoles,
      },
      corsair: {
        clerkUserId: CORSAIR_CLERK_ID,
        email: CORSAIR_EMAIL,
        siteId: corsairSite._id,
        siteSlug: corsairSite.slug,
        roles: exactCorsairRoles,
      },
    };
  },
});
