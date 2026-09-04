import { mutation, query } from "../_generated/server";

/**
 * One-off production repair for dead image URLs in Corsair Tactical Solutions
 * CMS records.
 *
 * Background: the original seed data referenced images hosted on a Google
 * Cloud Storage bucket (`storage.googleapis.com/corsair-tactical/*`) that the
 * site owner has since taken offline. Every one of those URLs now returns 404,
 * leaving broken image references in the production CMS records and (for the
 * two blog articles) broken cover images on the live public website once the
 * public site stops querying the retired slug.
 *
 * Repair strategy: replace each dead URL with a live, semantically equivalent
 * image already served by the Corsair public website itself (site-relative
 * paths under /images/corsair-real/*, plus /og-default.jpg for social
 * previews). Site-relative paths are the only URL shape that renders through
 * the public site's next/image pipeline (its remotePatterns allowlist only
 * permits images.unsplash.com for absolute hosts) and they resolve correctly
 * inside the dashboard's Visual Editor preview iframe, which loads the real
 * site domain. Original bytes are unrecoverable: the GCS bucket is offline and
 * no copies of those filenames exist in either repository, so each replacement
 * is a semantic equivalent chosen from the site's own approved catalog imagery.
 *
 * Safety: this mutation is idempotent. It only patches records whose image
 * fields currently equal one of the known-dead URLs; records already repaired
 * (or subsequently edited by the client) are skipped. It never deletes or
 * re-inserts content records, so client edits made through the dashboard are
 * preserved. Re-running the full seed is intentionally avoided: seedArticles,
 * seedCourses and seedEvents delete every site record before re-inserting,
 * which would destroy client edits.
 */

const DEAD_HOST = "https://storage.googleapis.com/corsair-tactical/";

/**
 * Dead filename -> live replacement (every URL verified HTTP 200 on the live
 * site). Content fields map to site-relative paths; branding fields map to
 * absolute URLs (see the strategy note above).
 */
const REPLACEMENTS: Record<string, string> = {
  // Homepage hero
  "hero-range.jpg": "/images/corsair-real/hero-corsair-training-outdoor-01.jpg",

  // Blog article covers
  "blog-ltc-guide.jpg": "/images/corsair-real/ltc-cert-basic-handgun-01.png",
  "blog-security-levels.jpg":
    "/images/corsair-real/classroom-training-group-01.jpg",

  // Course imagery (matched to the same imagery the live course catalog uses
  // for the equivalent course pages)
  "course-ltc.jpg": "/images/corsair-real/ltc-cert-basic-handgun-01.png",
  "course-level2.jpg": "/images/corsair-real/level-2-unarmed-officer-01.png",
  "course-level3.jpg": "/images/corsair-real/level-3-armed-security-01.jpg",
  "course-level4.jpg": "/images/corsair-real/level-4-bodyguard-01.jpg",
  "course-bundle.jpg": "/images/corsair-real/hilton-training-braids-01.jpg",
  "course-private.jpg":
    "/images/corsair-real/basic-handgun-1on1-personal-01.jpg",

  // Event imagery (events page renders flyer images; these back the event
  // records that pair with the flyer-driven listing)
  "event-aug-ltc.jpg": "/images/corsair-real/ltc-shooting-proficiency-01.png",
  "event-aug-level2.jpg": "/images/corsair-real/level-2-unarmed-officer-01.png",
  "event-sep-level34.jpg":
    "/images/corsair-real/hilton-training-braids-01.jpg",

  // SEO social previews (unconsumed by the public site today; og-default.jpg
  // is the site's own fallback social image)
  "og-home.jpg": "/og-default.jpg",
  "og-courses.jpg": "/og-default.jpg",
  "og-about.jpg": "/og-default.jpg",

  // Branding (sites.logoUrl/faviconUrl, portalConfigs.logoUrl). These render
  // via plain <img> tags in the TAYA dashboard / client portal (served from
  // app.fstsclientsystem.com), so they MUST be absolute URLs pointing at the
  // live public site — site-relative paths would 404 against the dashboard
  // domain. This matches the seedBranding convention already in seedCorsair.ts
  // and the site-owner-fixed production sites.logoUrl value.
  "logo-white.png":
    "https://www.corsairtacticalsolution.com/corsair-logo-transparent.png",
  "logo-dark.png": "https://www.corsairtacticalsolution.com/corsair-logo.png",
  "favicon.ico": "https://www.corsairtacticalsolution.com/favicon.ico",
};

function isDead(url: string | undefined | null): url is string {
  return typeof url === "string" && url.startsWith(DEAD_HOST);
}

function replacementFor(url: string): string | null {
  const fileName = url.slice(DEAD_HOST.length);
  return REPLACEMENTS[fileName] ?? null;
}

/**
 * Patches every production CMS record carrying a known-dead image URL.
 * Returns per-table counts for the closeout audit trail.
 */
export const repair = mutation({
  args: {},
  handler: async (ctx) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", "corsair-tactical-solutions"))
      .first();
    if (!site) throw new Error("corsair-tactical-solutions site not found");

    const siteId = site._id;
    const report: Record<string, { scanned: number; patched: number }> = {};
    let patchedTotal = 0;

    async function patchTable(
      tableName: string,
      fields: string[],
    ): Promise<void> {
      // Narrow the table union to the two shapes this repair touches.
      const rows = await (ctx.db as any)
        .query(tableName)
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();

      let patched = 0;
      for (const row of rows) {
        const patch: Record<string, string> = {};
        for (const field of fields) {
          const current = row[field];
          if (isDead(current)) {
            const replacement = replacementFor(current);
            if (replacement) patch[field] = replacement;
          }
        }
        if (Object.keys(patch).length > 0) {
          await (ctx.db as any).patch(row._id, patch);
          patched += 1;
        }
      }
      report[tableName] = { scanned: rows.length, patched };
      patchedTotal += patched;
    }

    // homepageContent.heroImageUrl
    await patchTable("homepageContent", ["heroImageUrl"]);
    // articles.coverImageUrl / ogImageUrl / socialImageUrl
    await patchTable("articles", [
      "coverImageUrl",
      "ogImageUrl",
      "socialImageUrl",
    ]);
    // courses.imageUrl
    await patchTable("courses", ["imageUrl"]);
    // events.imageUrl
    await patchTable("events", ["imageUrl"]);
    // seoSettings.ogImageUrl
    await patchTable("seoSettings", ["ogImageUrl"]);

    // sites.logoUrl / sites.faviconUrl (single record; no by_site index)
    {
      const sitePatch: Record<string, string> = {};
      if (isDead(site.logoUrl)) {
        const r = replacementFor(site.logoUrl);
        if (r) sitePatch.logoUrl = r;
      }
      if (isDead(site.faviconUrl)) {
        const r = replacementFor(site.faviconUrl);
        if (r) sitePatch.faviconUrl = r;
      }
      if (Object.keys(sitePatch).length > 0) {
        await (ctx.db as any).patch(siteId, sitePatch);
        patchedTotal += 1;
      }
      report.sites = {
        scanned: 1,
        patched: Object.keys(sitePatch).length > 0 ? 1 : 0,
      };
    }

    // portalConfigs.logoUrl (dashboard/portal-internal branding; no by_site
    // index helper shared with the generic loop, handled explicitly here)
    {
      const rows = await (ctx.db as any)
        .query("portalConfigs")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      let patched = 0;
      for (const row of rows) {
        if (isDead(row.logoUrl)) {
          const r = replacementFor(row.logoUrl);
          if (r) {
            await (ctx.db as any).patch(row._id, { logoUrl: r });
            patched += 1;
          }
        }
      }
      report.portalConfigs = { scanned: rows.length, patched };
      patchedTotal += patched;
    }

    return { site: site.slug, tables: report, patchedTotal };
  },
});

/**
 * Read-only audit companion. Reports every remaining dead-host reference in
 * the Corsair production records so the closeout can prove zero remain.
 */
export const audit = query({
  args: {},
  handler: async (ctx) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", "corsair-tactical-solutions"))
      .first();
    if (!site) throw new Error("corsair-tactical-solutions site not found");
    const siteId = site._id;

    const remaining: Array<{ table: string; id: string; field: string; url: string }> = [];

    async function scanTable(tableName: string, fields: string[]) {
      const rows = await (ctx.db as any)
        .query(tableName)
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      for (const row of rows) {
        for (const field of fields) {
          if (isDead(row[field])) {
            remaining.push({
              table: tableName,
              id: row._id,
              field,
              url: row[field],
            });
          }
        }
      }
    }

    await scanTable("homepageContent", ["heroImageUrl"]);
    await scanTable("articles", ["coverImageUrl", "ogImageUrl", "socialImageUrl"]);
    await scanTable("courses", ["imageUrl"]);
    await scanTable("events", ["imageUrl"]);
    await scanTable("seoSettings", ["ogImageUrl"]);
    await scanTable("portalConfigs", ["logoUrl"]);
    if (isDead(site.logoUrl)) {
      remaining.push({ table: "sites", id: siteId, field: "logoUrl", url: site.logoUrl });
    }
    if (isDead(site.faviconUrl)) {
      remaining.push({ table: "sites", id: siteId, field: "faviconUrl", url: site.faviconUrl });
    }

    return { site: site.slug, deadReferencesRemaining: remaining.length, remaining };
  },
});
