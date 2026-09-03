import { query } from "./_generated/server";
import { v } from "convex/values";
import { checkSiteAccess } from "./lib/requireSiteAccess";

/**
 * Unified pages view — aggregates all editable content types for a site
 * into a single list with type, title, status, last updated, and edit href.
 *
 * Status values are limited to those actually supported by the backend:
 *   - "published" — live on the public website
 *   - "draft" — saved but not yet published
 *   - "scheduled" — scheduled for future publication (articles only)
 *   - "archived" — hidden from public site
 *   - "active" — enabled/visible (used by non-article content types)
 *   - "inactive" — disabled/hidden
 */
export const getAllPages = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    if (!await checkSiteAccess(ctx, siteId)) return [];

    const now = Date.now();

    const [
      homepage,
      articles,
      policies,
      faqs,
      services,
      products,
      courses,
      events,
      testimonials,
    ] = await Promise.all([
      ctx.db.query("homepageContent").withIndex("by_site", (q) => q.eq("siteId", siteId)).first(),
      ctx.db.query("articles").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("policyPages").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("faqs").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("siteServices").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("siteProducts").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("courses").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("events").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
      ctx.db.query("testimonials").withIndex("by_site", (q) => q.eq("siteId", siteId)).collect(),
    ]);

    const pages: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
      updatedAt: string;
      editHref: string;
    }> = [];

    // Homepage (single record)
    if (homepage) {
      pages.push({
        id: `homepage-${homepage._id}`,
        type: "Homepage",
        title: "Homepage",
        status: "published",
        updatedAt: new Date(homepage._creationTime).toISOString(),
        editHref: "homepage",
      });
    }

    // Articles
    for (const a of articles) {
      let status = a.status ?? "draft";
      // Articles with scheduledAt in the future and status "published" are "scheduled"
      if (status === "published" && a.scheduledAt && a.scheduledAt > now) {
        status = "scheduled";
      }
      pages.push({
        id: `article-${a._id}`,
        type: "Article",
        title: a.title,
        status,
        updatedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date(a._creationTime).toISOString(),
        editHref: "articles",
      });
    }

    // Policy pages
    for (const p of policies) {
      pages.push({
        id: `policy-${p._id}`,
        type: "Policy",
        title: p.policyType.charAt(0).toUpperCase() + p.policyType.slice(1) + " Policy",
        status: "published",
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date(p._creationTime).toISOString(),
        editHref: "policies",
      });
    }

    // FAQ items
    for (const f of faqs) {
      pages.push({
        id: `faq-${f._id}`,
        type: "FAQ",
        title: f.question,
        status: f.isActive === false ? "inactive" : "active",
        updatedAt: new Date(f._creationTime).toISOString(),
        editHref: "faq",
      });
    }

    // Services (no status field — use isVisible for active/inactive)
    for (const s of services) {
      pages.push({
        id: `service-${s._id}`,
        type: "Service",
        title: s.title,
        status: s.isVisible === false ? "inactive" : "active",
        updatedAt: new Date(s._creationTime).toISOString(),
        editHref: "services",
      });
    }

    // Products (no status field — use isVisible for active/inactive)
    for (const p of products) {
      pages.push({
        id: `product-${p._id}`,
        type: "Product",
        title: p.title,
        status: p.isVisible === false ? "inactive" : "active",
        updatedAt: new Date(p._creationTime).toISOString(),
        editHref: "products",
      });
    }

    // Courses
    for (const c of courses) {
      let status = c.status ?? "published";
      if (status === "published" && c.startDateTime && c.startDateTime > now && c.registrationOpenAt && c.registrationOpenAt > now) {
        status = "scheduled";
      }
      pages.push({
        id: `course-${c._id}`,
        type: "Course",
        title: c.title,
        status,
        updatedAt: new Date(c._creationTime).toISOString(),
        editHref: "courses",
      });
    }

    // Events
    for (const e of events) {
      let status = e.status ?? "published";
      if (status === "published" && e.startAt > now) {
        status = "scheduled";
      }
      pages.push({
        id: `event-${e._id}`,
        type: "Event",
        title: e.title,
        status,
        updatedAt: new Date(e._creationTime).toISOString(),
        editHref: "events",
      });
    }

    // Testimonials
    for (const t of testimonials) {
      pages.push({
        id: `testimonial-${t._id}`,
        type: "Testimonial",
        title: t.name ?? "Anonymous",
        status: t.isActive === false ? "inactive" : "active",
        updatedAt: new Date(t._creationTime).toISOString(),
        editHref: "testimonials",
      });
    }

    // Sort by updatedAt descending
    pages.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return pages;
  },
});
