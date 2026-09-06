import { mutation, query } from "../_generated/server";

/**
 * Production repair for the two live client owner accounts.
 *
 * Verified directly in Clerk on 2026-09-06:
 * - cdweemsbey@gmail.com -> user_3IqPwkRg7oeRLHcCRv0N4yxlMRs
 * - corsairtacticalsolutions@gmail.com -> user_3IsuGrs6vmVY9rDYlZ86SZn7l9k
 *
 * Verified directly in Convex:
 * - FSTS site qd74hpd1vk391fkpy797xk7dzh8drmz9 / httpswwwfstacktsolutionscom
 * - Corsair site qd7cpjk68m0z4rme5hw4sqgeys8bk1zc / corsair-tactical-solutions
 *
 * The prior repair had the two Clerk subjects reversed. This mutation resolves
 * rows by email, validates the exact canonical sites, then atomically restores
 * the correct Clerk identity + tenant roles. It is idempotent.
 */

const FSTS_EMAIL = "cdweemsbey@gmail.com";
const FSTS_CLERK_ID = "user_3IqPwkRg7oeRLHcCRv0N4yxlMRs";
const FSTS_SITE_SLUG = "httpswwwfstacktsolutionscom";
const FSTS_SITE_ID = "qd74hpd1vk391fkpy797xk7dzh8drmz9";

const CORSAIR_EMAIL = "corsairtacticalsolutions@gmail.com";
const CORSAIR_CLERK_ID = "user_3IsuGrs6vmVY9rDYlZ86SZn7l9k";
const CORSAIR_SITE_SLUG = "corsair-tactical-solutions";
const CORSAIR_SITE_ID = "qd7cpjk68m0z4rme5hw4sqgeys8bk1zc";

async function exactUserByEmail(ctx: any, email: string) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .collect();
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one user row for ${email}; found ${rows.length}`);
  }
  return rows[0];
}

async function exactSiteBySlug(ctx: any, slug: string, expectedId: string) {
  const rows = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .collect();
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one site for ${slug}; found ${rows.length}`);
  }
  if (String(rows[0]._id) !== expectedId) {
    throw new Error(`Site id mismatch for ${slug}: expected ${expectedId}, found ${rows[0]._id}`);
  }
  return rows[0];
}

async function snapshot(ctx: any) {
  const [fstsUser, corsairUser, fstsSite, corsairSite] = await Promise.all([
    exactUserByEmail(ctx, FSTS_EMAIL),
    exactUserByEmail(ctx, CORSAIR_EMAIL),
    exactSiteBySlug(ctx, FSTS_SITE_SLUG, FSTS_SITE_ID),
    exactSiteBySlug(ctx, CORSAIR_SITE_SLUG, CORSAIR_SITE_ID),
  ]);
  return { fstsUser, corsairUser, fstsSite, corsairSite };
}

function roleSiteIds(user: any): string[] {
  return (user.roles ?? []).map((r: any) => String(r.siteId));
}

export const audit = query({
  args: {},
  handler: async (ctx) => {
    const { fstsUser, corsairUser, fstsSite, corsairSite } = await snapshot(ctx);
    return {
      fsts: {
        email: fstsUser.email,
        currentClerkUserId: fstsUser.clerkUserId,
        expectedClerkUserId: FSTS_CLERK_ID,
        siteId: fstsSite._id,
        siteSlug: fstsSite.slug,
        roles: fstsUser.roles,
        roleSiteIds: roleSiteIds(fstsUser),
        isSuperAdmin: fstsUser.isSuperAdmin,
        isAgencyAdmin: fstsUser.isAgencyAdmin ?? false,
        isActive: fstsUser.isActive,
        correct:
          fstsUser.clerkUserId === FSTS_CLERK_ID &&
          fstsUser.isSuperAdmin === false &&
          roleSiteIds(fstsUser).length === 1 &&
          roleSiteIds(fstsUser)[0] === FSTS_SITE_ID,
      },
      corsair: {
        email: corsairUser.email,
        currentClerkUserId: corsairUser.clerkUserId,
        expectedClerkUserId: CORSAIR_CLERK_ID,
        siteId: corsairSite._id,
        siteSlug: corsairSite.slug,
        roles: corsairUser.roles,
        roleSiteIds: roleSiteIds(corsairUser),
        isSuperAdmin: corsairUser.isSuperAdmin,
        isAgencyAdmin: corsairUser.isAgencyAdmin ?? false,
        isActive: corsairUser.isActive,
        correct:
          corsairUser.clerkUserId === CORSAIR_CLERK_ID &&
          corsairUser.isSuperAdmin === false &&
          roleSiteIds(corsairUser).length === 2 &&
          roleSiteIds(corsairUser).every((id) => id === CORSAIR_SITE_ID),
      },
    };
  },
});

export const repair = mutation({
  args: {},
  handler: async (ctx) => {
    const { fstsUser, corsairUser, fstsSite, corsairSite } = await snapshot(ctx);

    const fstsRoles = [{ siteId: fstsSite._id, role: "owner" }];
    const corsairRoles = [
      { siteId: corsairSite._id, role: "owner" },
      { siteId: corsairSite._id, role: "content_editor" },
    ];

    await ctx.db.patch(fstsUser._id, {
      clerkUserId: FSTS_CLERK_ID,
      email: FSTS_EMAIL,
      roles: fstsRoles,
      isSuperAdmin: false,
      isAgencyAdmin: false,
      isActive: true,
    });

    await ctx.db.patch(corsairUser._id, {
      clerkUserId: CORSAIR_CLERK_ID,
      email: CORSAIR_EMAIL,
      roles: corsairRoles,
      isSuperAdmin: false,
      isAgencyAdmin: false,
      isActive: true,
    });

    return {
      repaired: true,
      fsts: {
        userId: fstsUser._id,
        email: FSTS_EMAIL,
        clerkUserId: FSTS_CLERK_ID,
        siteId: fstsSite._id,
        siteSlug: fstsSite.slug,
        roles: fstsRoles,
      },
      corsair: {
        userId: corsairUser._id,
        email: CORSAIR_EMAIL,
        clerkUserId: CORSAIR_CLERK_ID,
        siteId: corsairSite._id,
        siteSlug: corsairSite.slug,
        roles: corsairRoles,
      },
    };
  },
});
