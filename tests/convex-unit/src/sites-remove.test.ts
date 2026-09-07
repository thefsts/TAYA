/**
 * P4 follow-up — sites.remove full data-footprint cleanup tests.
 *
 * sites.remove previously deleted ONLY the sites doc. Every seed/content row
 * was left dangling as an orphan (verified in production: 20 orphaned
 * navigationItems after deleting temp verification sites). This suite pins
 * the new contract:
 *
 *   ✓ remove deletes every site-scoped row (content, layout, config, CRM,
 *     bookings, integrations, portal, automation, health, add-ons, activity)
 *   ✓ remove releases referenced media storage blobs
 *   ✓ remove strips the site's roles from platform users (users NEVER deleted)
 *   ✓ remove leaves other sites' rows and global tables untouched
 *   ✓ remove removes the sites doc itself; slug can be immediately reused
 *   ✓ remove is SuperAdmin-only; a rejected caller deletes nothing
 *   ✓ purgeOrphanedSiteData sweeps only rows whose siteId points at a dead
 *     site; live-site rows and global tables are untouched
 *   ✓ purgeOrphanedSiteData is SuperAdmin-only
 *   ✓ purgeOrphanedSiteData strips ghost user roles
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { SITE_SCOPED_TABLES } from "../../../convex/sites";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── Helpers ────────────────────────────────────────────────────────────────

function userDoc(
  clerkUserId: string,
  overrides: Partial<{
    isSuperAdmin: boolean;
    isActive: boolean;
    roles: { siteId: any; role: string }[];
  }> = {},
) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [],
    ...overrides,
  };
}

let t: ReturnType<typeof convexTest>;

beforeEach(async () => {
  t = convexTest(schema, modules);

  // Seed users BEFORE any mutation so provisionUser never bootstraps a
  // first-user superadmin mid-test.
  await t.run(async (ctx) => {
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("regular_user"));
    await ctx.db.insert("users", userDoc("member_user"));
  });
});

const asSuper = () => t.withIdentity({ subject: "superadmin" });
const asRegular = () => t.withIdentity({ subject: "regular_user" });
const asMember = () => t.withIdentity({ subject: "member_user" });

const BASE_ARGS = {
  name: "Acme Dental",
  slug: "",
};

/** Count rows in a site-scoped table for a given siteId (by_site index). */
async function countRows(siteId: any, table: string) {
  return await t.run(async (ctx) => {
    const index = table === "registrations" ? "by_site_entity" : "by_site";
    const rows = await (ctx.db as any)
      .query(table)
      .withIndex(index, (q: any) => q.eq("siteId", siteId))
      .collect();
    return rows.length;
  });
}

/**
 * Verify the core contract — zero rows for siteId across EVERY site-scoped
 * table — by scanning each table's full contents and matching on siteId.
 */
async function expectZeroRowsFor(siteId: string) {
  const leftovers = await t.run(async (ctx) => {
    const leftovers: string[] = [];
    for (const table of SITE_SCOPED_TABLES) {
      const rows = await (ctx.db as any).query(table).collect();
      for (const row of rows) {
        if (String(row.siteId) === siteId) {
          leftovers.push(`${table}:${String(row._id)}`);
        }
      }
    }
    return leftovers;
  });
  expect(leftovers).toEqual([]);
}

/** Insert a realistic site-scoped row for testing per-table cleanup. */
async function seedRow(
  table: string,
  siteId: any,
  extra: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) => {
    const rows: Record<string, Record<string, unknown>> = {
      articles: { siteId, title: "Hello", slug: "hello", status: "published", body: "…" },
      courses: { siteId, title: "Course", slug: "course", status: "draft", description: "d" },
      events: { siteId, title: "Event", slug: "event", status: "draft", description: "d", startAt: 1 },
      faqs: { siteId, question: "Q?", answer: "A.", order: 0, isActive: true },
      testimonials: { siteId, name: "A", text: "Great!", isActive: true, order: 0 },
      teamMembers: { siteId, name: "N", isActive: true, order: 0 },
      jobPostings: { siteId, title: "Job", jobType: "full_time", description: "d", isActive: true },
      siteServices: { siteId, title: "S", slug: "s", description: "d", order: 0, isVisible: true },
      siteProducts: { siteId, title: "P", slug: "p", description: "d", order: 0, isVisible: true },
      downloadableResources: { siteId, title: "R", url: "u", isActive: true, order: 0 },
      pricingTiers: { siteId, planName: "T", features: [], isHighlighted: false, ctaLabel: "C", isActive: true, order: 0 },
      flyers: { siteId, title: "F", status: "draft" },
      forms: { siteId, name: "Form", slug: "form", status: "active", fields: [], settings: {} },
      formSubmissions: { siteId, formType: "contact", data: {}, status: "unread", submittedAt: 1 },
      mediaAssets: { siteId, fileName: "photo.png", mimeType: "image/png", sizeBytes: 10 },
      homepageContent: { siteId, heroHeadline: "H", heroSubheadline: "S", sections: [] },
      footerContent: { siteId, columns: [], socialLinks: [], copyrightText: "C" },
      contactInfo: { siteId, email: "", phone: "", address: "", hours: [] },
      seoSettings: { siteId, pagePath: "/", title: "T", description: "D" },
      navigationItems: { siteId, label: "Home", href: "/", isVisible: true, order: 0 },
      announcementBanner: { siteId, text: "M", bgColor: "#000", isEnabled: true },
      siteCtaConfig: { siteId, primaryLabel: "C", primaryUrl: "u" },
      popupConfig: { siteId, title: "P", body: "c", triggerType: "exit", isEnabled: true },
      siteSettings: { siteId },
      siteRoleOverrides: { siteId, role: "client_admin", module: "home", level: "view" },
      contentVersions: { siteId, entityType: "article", entityId: "e", snapshot: {}, createdByName: "n" },
      policyPages: { siteId, policyType: "privacy", content: "B", updatedAt: 1 },
      registrations: { siteId, entityType: "course", entityId: "e1", userId: "u1", status: "confirmed", registeredAt: 1 },
      crmConnections: { siteId, provider: "operon", status: "not_connected", authMethod: "api_key", ssoEnabled: false, apiHealth: "unknown" },
      crmEntitySyncSettings: { siteId, provider: "operon", entityType: "course", direction: "both", enabled: true },
      crmSyncLogs: { siteId, provider: "operon", entityType: "course", direction: "outbound", status: "success", attempt: 1 },
      crmInboundRecords: { siteId, provider: "operon", entityType: "course", payload: {}, appliedAt: 1 },
      emailSettings: { siteId, fromName: "N", fromEmail: "e@t.local", replyToEmail: "e@t.local", notifyOnNewLead: true, notifyOnBooking: true },
      paymentConnectors: { siteId, provider: "square", isActive: false, status: "not_connected", hasWebhookKey: false, checkoutEnabled: false },
      paymentEvents: { siteId, provider: "square", eventType: "payment", status: "ok" },
      squareConfig: { siteId, connected: false, environment: "production", checkoutEnabled: false },
      squareCatalogItems: { siteId, squareItemId: "i", name: "N", lastSyncedAt: 1 },
      squareOrders: { siteId, squareOrderId: "o", amountCents: 100, status: "open", createdAt: 1 },
      squareDiscounts: { siteId, squareDiscountId: "d", name: "D", discountType: "percent" },
      squareCatalogMappings: { siteId, entityType: "course", entityId: "e", squareItemId: "i" },
      reviewSources: { siteId, provider: "google", config: {}, autoRefresh: false, status: "ok" },
      importedReviews: null, // requires sourceId FK — inserted separately
      reviewDisplaySettings: { siteId, layout: "grid", minRating: 1, maxPerPage: 10, featuredOnly: false, showProviderBadge: true },
      automationRules: { siteId, name: "R", triggerType: "form_submitted", conditions: [], actions: [], enabled: true },
      automationRunLog: null, // requires ruleId FK — inserted separately
      portalConfigs: { siteId, enabled: false, registrationOpen: false, requireApproval: false, enabledFeatures: [] },
      portalUsers: { siteId, email: "p@t.local", firstName: "P", lastName: "U", passwordHash: "h", passwordSalt: "s", role: "member", status: "active", emailVerified: false },
      portalSessions: null, // requires portalUserId FK — inserted separately
      siteHealthLogs: { siteId, url: "https://x", isUp: true, checkedAt: 1 },
      websiteHealthScans: { siteId, overallScore: 100, status: "healthy", categoryScores: {}, scannedAt: 1 },
      healthNotifications: { siteId, type: "tip", severity: "info", message: "m" },
      backups: { siteId, label: "L", sizeBytes: 10, snapshot: {} },
      activityLog: { siteId, actorName: "a", action: "created", entityType: "site" },
      siteAddOns: null, // requires addOnId FK — inserted separately
      onboardingProgress: { siteId, sessionKey: "s1", currentStep: 3, stepData: {}, status: "completed" },
      discoverySnapshots: { siteId, kind: "initial", status: "completed", domain: "example.com", startedAt: 1 },
    };
    // FK-chained rows: create the parent row only when the child table is
    // the one being seeded (keeps global tables like addOnCatalog clean).
    if (table === "importedReviews") {
      const sourceId = await ctx.db.insert("reviewSources", {
        ...(rows.reviewSources as any),
      });
      (rows as any).importedReviews = {
        siteId,
        sourceId,
        provider: "google",
        externalId: "x",
        reviewerName: "A",
        rating: 5,
        reviewDate: 1,
        status: "approved",
        pinned: false,
        cachedAt: 1,
      };
    }
    if (table === "automationRunLog") {
      const ruleId = await ctx.db.insert("automationRules", {
        ...(rows.automationRules as any),
      });
      (rows as any).automationRunLog = {
        siteId,
        ruleId,
        ruleName: "R",
        triggerType: "form_submitted",
        triggerPayload: {},
        status: "success",
        actionResults: [],
        completedAt: 1,
      };
    }
    if (table === "portalSessions") {
      const portalUserId = await ctx.db.insert("portalUsers", {
        ...(rows.portalUsers as any),
      });
      (rows as any).portalSessions = {
        siteId,
        portalUserId,
        token: "k",
        expiresAt: 2,
        lastActiveAt: 1,
      };
    }
    if (table === "siteAddOns") {
      const addOnId = await ctx.db.insert("addOnCatalog", {
        slug: `test-addon-${Math.random().toString(36).slice(2, 8)}`,
        name: "Test Add-on",
        description: "d",
        category: "marketing",
        pricingTier: "starter",
        isActive: true,
        isBeta: false,
        features: [],
        eligiblePlans: [],
        trialDays: 0,
        sortOrder: 0,
      });
      (rows as any).siteAddOns = {
        siteId,
        addOnId,
        status: "enabled",
        createdAt: 1,
        updatedAt: 1,
      };
    }
    const doc = { ...(rows[table] ?? { siteId }), ...extra };
    return await ctx.db.insert(table as any, doc as any);
  });
}

// ── remove: full footprint cleanup ──────────────────────────────────────────

describe("sites.remove — full data-footprint cleanup", () => {
  it("deletes every site-scoped row across all tables", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const siteId = result.id;

    // Seed one row in EVERY site-scoped table for this site.
    for (const table of SITE_SCOPED_TABLES) {
      await seedRow(table, siteId);
    }

    await asSuper().mutation(api.sites.remove, { siteId });

    await expectZeroRowsFor(String(siteId));

    // The site doc itself is gone.
    const siteDoc = await t.run(async (ctx) => ctx.db.get(siteId));
    expect(siteDoc).toBeNull();
  });

  it("releases referenced media storage blobs", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const siteId = result.id;

    // Seed a media asset with a REAL stored blob, then verify the blob is
    // released along with the doc (getUrl returns null once deleted).
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["fake-png"], { type: "image/png" }));
    });
    await seedRow("mediaAssets", siteId, { storageId });
    const urlBefore = await t.run(async (ctx) => ctx.storage.getUrl(storageId));
    expect(urlBefore).toBeTruthy();

    await asSuper().mutation(api.sites.remove, { siteId });

    await expectZeroRowsFor(String(siteId));
    const urlAfter = await t.run(async (ctx) => ctx.storage.getUrl(storageId));
    expect(urlAfter).toBeNull();
  });

  it("strips the site's roles from platform users but never deletes users", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const siteId = result.id;

    // Give the member a role on this site (and on another live site, to
    // ensure only the dead site's role is stripped).
    const other = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Other Site",
    });

    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "member_user"))
        .first();
      await ctx.db.patch(member!._id, {
        roles: [
          { siteId, role: "client_admin" },
          { siteId: other.id, role: "client_viewer" },
        ],
      });
    });

    await asSuper().mutation(api.sites.remove, { siteId });

    const member = await t.run(async (ctx) => {
      const member = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "member_user"))
        .first();
      return { roles: member!.roles, exists: true };
    });

    // User still exists; only the deleted site's role is gone.
    expect(member.exists).toBe(true);
    expect(member.roles).toHaveLength(1);
    expect(String(member.roles[0].siteId)).toBe(String(other.id));
  });

  it("leaves other sites' rows and global tables untouched", async () => {
    const acme = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const other = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Other Site",
    });

    // Seed content for both sites.
    await seedRow("navigationItems", acme.id);
    await seedRow("navigationItems", other.id);
    await seedRow("articles", acme.id);
    await seedRow("articles", other.id);

    await asSuper().mutation(api.sites.remove, { siteId: acme.id });

    // Other site's rows survive (5 nav items seeded by sites.create + the
    // 1 manual row = 6; articles only has the 1 manual row).
    expect(await countRows(other.id, "navigationItems")).toBe(6);
    expect(await countRows(other.id, "articles")).toBe(1);
    // Users (global) survive.
    const userCount = await t.run(async (ctx) => {
      return (await ctx.db.query("users").collect()).length;
    });
    expect(userCount).toBe(3);
    // Other site doc survives.
    const otherDoc = await t.run(async (ctx) => ctx.db.get(other.id));
    expect(otherDoc).not.toBeNull();
  });

  it("frees the slug for immediate reuse", async () => {
    const first = await asSuper().mutation(api.sites.create, BASE_ARGS);
    await asSuper().mutation(api.sites.remove, { siteId: first.id });

    // Same name → same slugified base → should now reuse "acme-dental"
    // instead of colliding into "acme-dental-2".
    const second = await asSuper().mutation(api.sites.create, BASE_ARGS);
    expect(second.slug).toBe("acme-dental");
  });

  it("is SuperAdmin-only and a rejected caller deletes nothing", async () => {
    const result = await asSuper().mutation(api.sites.create, BASE_ARGS);
    const siteId = result.id;
    await seedRow("navigationItems", siteId);

    await expect(
      asRegular().mutation(api.sites.remove, { siteId }),
    ).rejects.toThrow(/Forbidden/);

    const siteDoc = await t.run(async (ctx) => ctx.db.get(siteId));
    expect(siteDoc).not.toBeNull();
    // 5 nav items seeded by sites.create + the 1 manual row = 6.
    expect(await countRows(siteId, "navigationItems")).toBe(6);
  });

  it("throws for a site that does not exist", async () => {
    // Create a site then hard-delete only its doc to get a REAL (but dead)
    // site id — the arg validator requires a well-formed Convex id.
    const temp = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Gone Site",
    });
    await t.run(async (ctx) => ctx.db.delete(temp.id));
    await expect(
      asSuper().mutation(api.sites.remove, { siteId: temp.id }),
    ).rejects.toThrow(/Site not found/);
  });
});

// ── purgeOrphanedSiteData: one-time production cleanup ─────────────────────

describe("sites.purgeOrphanedSiteData — orphan sweep", () => {
  it("deletes rows whose siteId points at a dead site, preserving live rows", async () => {
    const live = await asSuper().mutation(api.sites.create, BASE_ARGS);
    await seedRow("navigationItems", live.id);
    await seedRow("articles", live.id);

    // Simulate the OLD remove: delete only the sites doc, leaving rows.
    const dead = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Dead Site",
    });
    await seedRow("navigationItems", dead.id, { label: "Orphan Nav" });
    await seedRow("articles", dead.id, { title: "Orphan Article" });
    await t.run(async (ctx) => ctx.db.delete(dead.id));

    const result = await asSuper().mutation(api.sites.purgeOrphanedSiteData, {});

    expect(result.liveSites).toBe(1);
    // The dead site had my seeded rows PLUS the rows sites.create seeded
    // (nav, homepage, footer, contact, seo, crm) before its doc was deleted.
    expect(result.deleted.articles).toBe(1);
    expect(result.deleted.navigationItems).toBeGreaterThanOrEqual(1);
    // Zero orphans remain anywhere.
    await expectZeroRowsFor(String(dead.id));

    // Live site rows intact (5 nav seeded by create + 1 manual = 6).
    expect(await countRows(live.id, "navigationItems")).toBe(6);
    expect(await countRows(live.id, "articles")).toBe(1);
  });

  it("sweeps orphans across every site-scoped table", async () => {
    const live = await asSuper().mutation(api.sites.create, BASE_ARGS);

    // Simulate a legacy delete for a second site with rows in every table.
    const dead = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Dead Site",
    });
    for (const table of SITE_SCOPED_TABLES) {
      await seedRow(table, dead.id);
    }
    await t.run(async (ctx) => ctx.db.delete(dead.id));

    const result = await asSuper().mutation(api.sites.purgeOrphanedSiteData, {});

    // Every table had exactly one orphan → every table reported 1.
    expect(Object.keys(result.deleted).sort()).toEqual([...SITE_SCOPED_TABLES].sort());

    await expectZeroRowsFor(String(dead.id));
    // Live site untouched.
    const leftovers = await t.run(async (ctx) => {
      let n = 0;
      for (const table of SITE_SCOPED_TABLES) {
        const rows = await (ctx.db as any).query(table).collect();
        n += rows.filter((r: any) => String(r.siteId) === String(live.id)).length;
      }
      return n;
    });
    // sites.create seeded rows for the live site — they all survive.
    expect(leftovers).toBeGreaterThan(0);
  });

  it("strips ghost user roles", async () => {
    const live = await asSuper().mutation(api.sites.create, BASE_ARGS);

    const dead = await asSuper().mutation(api.sites.create, {
      ...BASE_ARGS,
      name: "Dead Site",
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "member_user"))
        .first();
      await ctx.db.patch(member!._id, {
        roles: [
          { siteId: live.id, role: "client_viewer" },
          { siteId: dead.id, role: "client_admin" },
        ],
      });
    });
    await t.run(async (ctx) => ctx.db.delete(dead.id));

    const result = await asSuper().mutation(api.sites.purgeOrphanedSiteData, {});
    expect(result.rolesStripped).toBe(1);

    const member = await t.run(async (ctx) => {
      const member = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", "member_user"))
        .first();
      return member!.roles;
    });
    expect(member).toHaveLength(1);
    expect(String(member[0].siteId)).toBe(String(live.id));
  });

  it("is SuperAdmin-only", async () => {
    await expect(
      asRegular().mutation(api.sites.purgeOrphanedSiteData, {}),
    ).rejects.toThrow(/Forbidden/);
  });
});
