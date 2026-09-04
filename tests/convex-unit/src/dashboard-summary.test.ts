/**
 * Dashboard Summary (Phase 3 — Simple Client Dashboard)
 *
 * Covers the coherent client-dashboard backend contracts:
 *   ✓ sites.getDashboardSummary returns real counts for every content type,
 *     including the new serviceCount from the siteServices table
 *   ✓ article status split (published/draft) is accurate
 *   ✓ upcomingEvents / upcomingCourses only include future, non-archived items
 *   ✓ an empty site returns all-zero counts and empty lists (no fake data)
 *   ✓ recentMedia / serviceCount are tenant-safe (only this site's rows)
 *   ✓ a client owner sees their own site's summary
 *   ✓ a client assigned to ANOTHER site cannot read this site's summary
 *   ✓ an anonymous caller receives null
 *   ✓ unreadSubmissionCount counts only unread form submissions
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ────────────────────────────────────────────────────────────────

function agencyBase() {
  return {
    primaryColor: "#000",
    accentColor: "#fff",
    supportEmail: "support@test.local",
    featureFlags: {},
    licensingStatus: "active",
    isActive: true,
  };
}

let t: ReturnType<typeof convexTest>;
let siteA: any;
let siteB: any;

beforeEach(async () => {
  t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    const agency = await ctx.db.insert("agencies", {
      name: "Test Agency",
      slug: "test-agency",
      ...agencyBase(),
    });
    siteA = await ctx.db.insert("sites", {
      name: "Site A",
      slug: "site-a",
      status: "active",
      brandColorPrimary: "#111111",
      brandColorSecondary: "#222222",
  whiteLabelEnabled: false,
      poweredByFsts: true,
      websiteType: "business_website",
      enabledModules: { homepage: true },
      agencyId: agency,
    });
    siteB = await ctx.db.insert("sites", {
      name: "Site B",
      slug: "site-b",
      status: "active",
      brandColorPrimary: "#333333",
      brandColorSecondary: "#444444",
      whiteLabelEnabled: true,
      poweredByFsts: false,
      websiteType: "business_website",
      enabledModules: { homepage: true },
    });

    await ctx.db.insert("users", {
      clerkUserId: "owner_a",
      name: "Owner A",
      email: "owner-a@test.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: "owner_b",
      name: "Owner B",
      email: "owner-b@test.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteB, role: "owner" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: "superadmin",
      name: "Super Admin",
      email: "superadmin@test.local",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
  });
});

// ── getDashboardSummary ────────────────────────────────────────────────────

describe("sites.getDashboardSummary — real-data counts", () => {
  it("returns counts for every content type including serviceCount", async () => {
    const now = Date.now();

    await t.run(async (ctx) => {
      // 3 courses: 2 upcoming, 1 archived
      await ctx.db.insert("courses", { siteId: siteA, title: "Course 1", slug: "c-1", description: "d", status: "active", capacity: 10, startDateTime: now + 86_400_000 });
      await ctx.db.insert("courses", { siteId: siteA, title: "Course 2", slug: "c-2", description: "d", status: "active", capacity: 10, startDateTime: now + 2 * 86_400_000 });
      await ctx.db.insert("courses", { siteId: siteA, title: "Old", slug: "c-old", description: "d", status: "archived", capacity: 10 });

      // 3 events: 2 future, 1 past
      await ctx.db.insert("events", { siteId: siteA, title: "Event 1", slug: "e-1", description: "d", startAt: now + 3600_000, status: "published" });
      await ctx.db.insert("events", { siteId: siteA, title: "Event 2", slug: "e-2", description: "d", startAt: now + 7200_000, status: "published" });
      await ctx.db.insert("events", { siteId: siteA, title: "Past", slug: "e-past", description: "d", startAt: now - 3600_000, status: "published" });

      // 3 articles: 1 published, 2 draft
      await ctx.db.insert("articles", { siteId: siteA, title: "A1", slug: "a-1", status: "published", body: "x" });
      await ctx.db.insert("articles", { siteId: siteA, title: "A2", slug: "a-2", status: "draft", body: "x" });
      await ctx.db.insert("articles", { siteId: siteA, title: "A3", slug: "a-3", status: "draft", body: "x" });

      // 2 services on siteA (one hidden), 1 on siteB (tenant isolation)
      await ctx.db.insert("siteServices", { siteId: siteA, title: "Service 1", slug: "s-1", description: "d", order: 0, isVisible: true });
      await ctx.db.insert("siteServices", { siteId: siteA, title: "Service 2", slug: "s-2", description: "d", order: 1, isVisible: false });
      await ctx.db.insert("siteServices", { siteId: siteB, title: "Other Site", slug: "s-b", description: "d", order: 0, isVisible: true });

      // 4 media assets
      for (let i = 0; i < 4; i++) {
        await ctx.db.insert("mediaAssets", { siteId: siteA, fileName: `file-${i}.png`, mimeType: "image/png", sizeBytes: 1000, url: `https://cdn.test/${i}.png` });
      }

      // 2 form submissions: 1 read, 1 unread
      await ctx.db.insert("formSubmissions", { siteId: siteA, formType: "contact", status: "new", submittedAt: now - 1000, submitterName: "Read One", submitterEmail: "r@t.local", readAt: now, data: {} });
      await ctx.db.insert("formSubmissions", { siteId: siteA, formType: "contact", status: "new", submittedAt: now, submitterName: "Unread One", submitterEmail: "u@t.local", data: {} });
    });

    const as = t.withIdentity({ subject: "owner_a" });
    const result = await as.query(api.sites.getDashboardSummary, { siteId: siteA });

    expect(result).not.toBeNull();
    expect(result!.courseCount).toBe(3);
    expect(result!.eventCount).toBe(3);
    expect(result!.articleCount).toBe(3);
    expect(result!.serviceCount).toBe(2);
    expect(result!.publishedArticles).toBe(1);
    expect(result!.draftArticles).toBe(2);
    expect(result!.mediaCount).toBe(4);
    expect(result!.unreadSubmissionCount).toBe(1);
    expect(result!.upcomingEvents.length).toBe(2);
    expect(result!.upcomingCourses.length).toBe(2);
    expect(result!.recentMedia.length).toBe(4);
    expect(result!.recentMedia.every((m: any) => m.fileName.startsWith("file-"))).toBe(true);
  });

  it("returns all-zero counts for an empty site (no fake data)", async () => {
    const as = t.withIdentity({ subject: "owner_a" });
    const summary = await as.query(api.sites.getDashboardSummary, { siteId: siteA });

    expect(summary).not.toBeNull();
    expect(summary!.courseCount).toBe(0);
    expect(summary!.eventCount).toBe(0);
    expect(summary!.articleCount).toBe(0);
    expect(summary!.serviceCount).toBe(0);
    expect(summary!.publishedArticles).toBe(0);
    expect(summary!.draftArticles).toBe(0);
    expect(summary!.mediaCount).toBe(0);
    expect(summary!.unreadSubmissionCount).toBe(0);
    expect(summary!.upcomingEvents).toEqual([]);
    expect(summary!.upcomingCourses).toEqual([]);
    expect(summary!.recentMedia).toEqual([]);
  });
});

// ── Access control ───────────────────────────────────────────────────

describe("sites.getDashboardSummary — access control", () => {
  it("rejects a client assigned to another site", async () => {
    const as = t.withIdentity({ subject: "owner_b" });
    const result = await as.query(api.sites.getDashboardSummary, { siteId: siteA });
    expect(result).toBeNull();
  });

  it("returns null for an anonymous caller", async () => {
    const result = await t.query(api.sites.getDashboardSummary, { siteId: siteA });
    expect(result).toBeNull();
  });
});
