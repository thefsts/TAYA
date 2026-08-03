/**
 * Tenant-safe site lookup helper.
 *
 * Resolves a public-facing `siteSlug` to a full site document.
 * Throws a descriptive error if the site is not found or not active,
 * so public queries can never accidentally serve data for inactive tenants.
 *
 * All public (unauthenticated) queries MUST use this helper instead of
 * accepting a raw `siteId` from the caller.
 */
export async function siteFromSlug(ctx: any, siteSlug: string): Promise<any> {
  const site = await ctx.db
    .query("sites")
    .withIndex("by_slug", (q: any) => q.eq("slug", siteSlug))
    .first();
  if (!site) {
    throw new Error(`Site not found: ${siteSlug}`);
  }
  if (site.status !== "active") {
    throw new Error(`Site is not active: ${siteSlug}`);
  }
  return site;
}
