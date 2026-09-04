import { mutation, query } from "../_generated/server";

/**
 * One-off production repair: canonicalize the Corsair Tactical Solutions CMS
 * records to the live production domain.
 *
 * Background: the site was onboarded with the client-supplied domain
 * `corsairtacticalsolutions.com` (plural). Live verification shows that domain
 * is an owner-run Azure 301 redirect bridge to the actual production site,
 * which is served by Vercel at `https://www.corsairtacticalsolution.com`
 * (singular, with the apex 308-redirecting to www). The Corsair repository
 * itself treats the singular www domain as canonical — `src/lib/seo.ts`
 * defaults SITE_URL to `https://www.corsairtacticalsolution.com` and every
 * legal/contact page and structured-data block references it. This mismatch
 * was flagged as MC-4 in docs/CORSAIR_PRODUCTION_CERTIFICATION.md.
 *
 * This repair aligns the TAYA CMS records with the domain that actually
 * serves the site, so health checks, the Visual Editor preview, dashboard
 * "visit site" links, and public SEO records all point at the real origin
 * instead of through an owner's redirect hop:
 *   - sites.domain: corsairtacticalsolutions.com -> www.corsairtacticalsolution.com
 *   - seoSettings.canonicalUrl (4 seeded rows): https://corsairtacticalsolutions.com/...
 *     -> https://www.corsairtacticalsolution.com/...
 *   - articles.body seeded link: https://corsairtacticalsolutions.com/contact
 *     -> https://www.corsairtacticalsolution.com/contact
 *
 * Out of scope, deliberately:
 *   - contact.email (corsairtacticalsolutions@gmail.com) — the owner's real
 *     business mailbox, referenced throughout the Corsair repo; not a domain
 *     configuration error.
 *   - emailSettings.fromEmail (noreply@corsairtacticalsolutions.com) — the
 *     Resend sender identity; which domain the owner verifies in their own
 *     Resend account is an owner decision (see the closeout report).
 *   - The plural apex 301 bridge and the broken plural-www TLS cert —
 *     owner-controlled DNS (external action required, documented).
 *
 * Safety: idempotent. Only patches fields currently equal to a known-plural
 * value; client edits are preserved, nothing is deleted or re-inserted.
 */

const PLURAL_HOST = "corsairtacticalsolutions.com";
const CANONICAL_HOST = "www.corsairtacticalsolution.com";

/** Old canonical URL -> new canonical URL (both verified live). */
const CANONICAL_URLS: Record<string, string> = {
  "https://corsairtacticalsolutions.com/":
    "https://www.corsairtacticalsolution.com/",
  "https://corsairtacticalsolutions.com/courses":
    "https://www.corsairtacticalsolution.com/courses",
  "https://corsairtacticalsolutions.com/about":
    "https://www.corsairtacticalsolution.com/about",
  "https://corsairtacticalsolutions.com/contact":
    "https://www.corsairtacticalsolution.com/contact",
};

/** Seeded article-body link -> canonical equivalent. */
const BODY_LINKS: Record<string, string> = {
  "https://corsairtacticalsolutions.com/contact":
    "https://www.corsairtacticalsolution.com/contact",
};

function isPlural(url: string | undefined | null): url is string {
  return typeof url === "string" && url.includes(PLURAL_HOST);
}

/**
 * Patches every Corsair CMS record carrying the plural domain. Returns
 * per-table counts for the closeout audit trail.
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

    // sites.domain (single record)
    {
      let patched = 0;
      if (site.domain === PLURAL_HOST) {
        await (ctx.db as any).patch(siteId, { domain: CANONICAL_HOST });
        patched += 1;
      }
      report.sites = { scanned: 1, patched };
      patchedTotal += patched;
    }

    // seoSettings.canonicalUrl
    {
      const rows = await (ctx.db as any)
        .query("seoSettings")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      let patched = 0;
      for (const row of rows) {
        if (isPlural(row.canonicalUrl)) {
          const next = CANONICAL_URLS[row.canonicalUrl] ??
            row.canonicalUrl.replace(PLURAL_HOST, CANONICAL_HOST);
          await (ctx.db as any).patch(row._id, { canonicalUrl: next });
          patched += 1;
        }
      }
      report.seoSettings = { scanned: rows.length, patched };
      patchedTotal += patched;
    }

    // articles.body (seeded contact link)
    {
      const rows = await (ctx.db as any)
        .query("articles")
        .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
        .collect();
      let patched = 0;
      for (const row of rows) {
        if (typeof row.body === "string" && row.body.includes(PLURAL_HOST)) {
          let body = row.body;
          for (const [from, to] of Object.entries(BODY_LINKS)) {
            body = body.split(from).join(to);
          }
          // Fallback for any other plural-domain link a client may have pasted.
          body = body.split(`https://${PLURAL_HOST}`).join(`https://${CANONICAL_HOST}`);
          if (body !== row.body) {
            await (ctx.db as any).patch(row._id, { body });
            patched += 1;
          }
        }
      }
      report.articles = { scanned: rows.length, patched };
      patchedTotal += patched;
    }

    return { site: site.slug, canonicalDomain: CANONICAL_HOST, tables: report, patchedTotal };
  },
});

/**
 * Read-only audit companion. Reports every remaining plural-domain reference
 * in the Corsair CMS records (sites.domain, seoSettings.canonicalUrl,
 * articles.body) so the closeout can prove zero remain.
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

    if (isPlural(site.domain)) {
      remaining.push({ table: "sites", id: siteId, field: "domain", url: site.domain! });
    }
    if (isPlural(site.logoUrl)) {
      remaining.push({ table: "sites", id: siteId, field: "logoUrl", url: site.logoUrl! });
    }

    const seoRows = await (ctx.db as any)
      .query("seoSettings")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();
    for (const row of seoRows) {
      if (isPlural(row.canonicalUrl)) {
        remaining.push({ table: "seoSettings", id: row._id, field: "canonicalUrl", url: row.canonicalUrl });
      }
    }

    const articleRows = await (ctx.db as any)
      .query("articles")
      .withIndex("by_site", (q: any) => q.eq("siteId", siteId))
      .collect();
    for (const row of articleRows) {
      if (typeof row.body === "string" && row.body.includes(PLURAL_HOST)) {
        const idx = row.body.indexOf(PLURAL_HOST);
        remaining.push({
          table: "articles",
          id: row._id,
          field: "body",
          url: `...${row.body.slice(Math.max(0, idx - 40), idx + 60)}...`,
        });
      }
    }

    return { site: site.slug, pluralReferencesRemaining: remaining.length, remaining };
  },
});
