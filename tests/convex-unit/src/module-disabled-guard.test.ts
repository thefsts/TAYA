/**
 * Module-disabled guard — write-path tests
 *
 * Uses the real Convex functions and schema against an in-memory backend
 * (convex-test). Proves that `requireModuleEnabled` blocks mutations —
 * not just reads — when a site has a module explicitly disabled via
 * `enabledModules.<key> = false`.
 *
 * Covers:
 *   1. courses  — create / update / remove all throw when disabled
 *   2. events   — create / update / remove all throw when disabled
 *   3. articles — create / update / remove all throw when disabled
 *   4. Reads return empty/null (soft) while mutations throw (hard)
 *   5. Re-enabling the module unblocks writes immediately
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ── helpers ──────────────────────────────────────────────────────────────────

function baseSiteDoc(name: string, slug: string, enabledModules: Record<string, boolean> = {}) {
  return {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules,
  };
}

function ownerUserDoc(clerkUserId: string, siteId: Id<"sites">) {
  return {
    clerkUserId,
    name: clerkUserId,
    email: `${clerkUserId}@test.local`,
    isSuperAdmin: false,
    isActive: true,
    roles: [{ siteId, role: "owner" }],
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────

type Seeded = {
  /** Site whose modules are all disabled */
  disabledSite: Id<"sites">;
  /** Site with all modules enabled (default) */
  enabledSite: Id<"sites">;
};

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);
  s = await t.run(async (ctx) => {
    const disabledSite = await ctx.db.insert(
      "sites",
      baseSiteDoc("Disabled Modules Site", "disabled-modules-site", {
        courses: false,
        events: false,
        articles: false,
      }),
    );
    const enabledSite = await ctx.db.insert(
      "sites",
      baseSiteDoc("Enabled Modules Site", "enabled-modules-site", {}),
    );

    // Seed the same owner on both sites so tenant-access is never the reason
    // a test fails.
    await ctx.db.insert("users", {
      clerkUserId: "owner_both",
      name: "owner_both",
      email: "owner_both@test.local",
      isSuperAdmin: false,
      isActive: true,
      roles: [
        { siteId: disabledSite, role: "owner" },
        { siteId: enabledSite, role: "owner" },
      ],
    });

    return { disabledSite, enabledSite };
  });
});

// ── Courses ───────────────────────────────────────────────────────────────────

describe("courses module disabled — write path is blocked", () => {
  const as = () => t.withIdentity({ subject: "owner_both" });

  it("create throws with 'not enabled' when courses module is off", async () => {
    await expect(
      as().mutation(api.courses.create, {
        siteId: s.disabledSite,
        title: "Texas LTC",
        slug: "texas-ltc",
        description: "License to carry course",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("update throws with 'not enabled' when courses module is off", async () => {
    // Seed a course directly so we have a valid ID to try updating.
    const courseId = await t.run(async (ctx) =>
      ctx.db.insert("courses", {
        siteId: s.disabledSite,
        title: "Seeded Course",
        slug: "seeded-course",
        description: "Seeded directly",
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.courses.update, {
        siteId: s.disabledSite,
        courseId,
        title: "Updated Title",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("remove throws with 'not enabled' when courses module is off", async () => {
    const courseId = await t.run(async (ctx) =>
      ctx.db.insert("courses", {
        siteId: s.disabledSite,
        title: "Seeded Course",
        slug: "seeded-course-remove",
        description: "Seeded directly",
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.courses.remove, {
        siteId: s.disabledSite,
        courseId,
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("list returns empty (soft) rather than throwing when courses module is off", async () => {
    const result = await as().query(api.courses.list, { siteId: s.disabledSite });
    expect(result).toEqual([]);
  });

  it("get returns null (soft) rather than throwing when courses module is off", async () => {
    const courseId = await t.run(async (ctx) =>
      ctx.db.insert("courses", {
        siteId: s.disabledSite,
        title: "Seeded Course",
        slug: "seeded-course-get",
        description: "Seeded directly",
        status: "draft",
      }),
    );
    const result = await as().query(api.courses.get, {
      siteId: s.disabledSite,
      courseId,
    });
    expect(result).toBeNull();
  });

  it("create succeeds on a site where courses module is enabled", async () => {
    const course = await as().mutation(api.courses.create, {
      siteId: s.enabledSite,
      title: "Enabled Course",
      slug: "enabled-course",
      description: "Should work fine",
    });
    expect(course.title).toBe("Enabled Course");
    expect(course.siteId).toBe(s.enabledSite);
  });
});

// ── Re-enable unblocks writes ─────────────────────────────────────────────────

describe("re-enabling a module unblocks the write path", () => {
  it("create succeeds after courses module is re-enabled", async () => {
    const as = () => t.withIdentity({ subject: "owner_both" });

    // Confirm the guard fires before re-enabling.
    await expect(
      as().mutation(api.courses.create, {
        siteId: s.disabledSite,
        title: "Blocked",
        slug: "blocked",
        description: "Should not land",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);

    // Re-enable the module by patching the site document directly.
    await t.run(async (ctx) => {
      await ctx.db.patch(s.disabledSite, {
        enabledModules: { courses: true, events: false, articles: false },
      });
    });

    // Now the mutation must succeed.
    const course = await as().mutation(api.courses.create, {
      siteId: s.disabledSite,
      title: "Re-enabled Course",
      slug: "re-enabled-course",
      description: "Module is back on",
    });
    expect(course.title).toBe("Re-enabled Course");
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

describe("events module disabled — write path is blocked", () => {
  const as = () => t.withIdentity({ subject: "owner_both" });

  it("create throws when events module is off", async () => {
    await expect(
      as().mutation(api.events.create, {
        siteId: s.disabledSite,
        title: "Summer Shoot",
        slug: "summer-shoot",
        description: "Outdoor shooting event",
        startAt: "2026-08-15T09:00:00.000Z",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("update throws when events module is off", async () => {
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        siteId: s.disabledSite,
        title: "Seeded Event",
        slug: "seeded-event",
        description: "Seeded directly",
        startAt: new Date("2026-08-15T09:00:00.000Z").getTime(),
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.events.update, {
        siteId: s.disabledSite,
        eventId,
        title: "Updated",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("remove throws when events module is off", async () => {
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        siteId: s.disabledSite,
        title: "Seeded Event Remove",
        slug: "seeded-event-remove",
        description: "Seeded directly",
        startAt: new Date("2026-08-15T09:00:00.000Z").getTime(),
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.events.remove, {
        siteId: s.disabledSite,
        eventId,
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });
});

// ── Articles ──────────────────────────────────────────────────────────────────

describe("articles module disabled — write path is blocked", () => {
  const as = () => t.withIdentity({ subject: "owner_both" });

  it("create throws when articles module is off", async () => {
    await expect(
      as().mutation(api.articles.create, {
        siteId: s.disabledSite,
        title: "Blocked Article",
        slug: "blocked-article",
        body: "This should not be saved",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("update throws when articles module is off", async () => {
    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        siteId: s.disabledSite,
        title: "Seeded Article",
        slug: "seeded-article",
        body: "Seeded directly",
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.articles.update, {
        siteId: s.disabledSite,
        articleId,
        title: "Should Not Patch",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });

  it("remove throws when articles module is off", async () => {
    const articleId = await t.run(async (ctx) =>
      ctx.db.insert("articles", {
        siteId: s.disabledSite,
        title: "Seeded Article Remove",
        slug: "seeded-article-remove",
        body: "Seeded directly",
        status: "draft",
      }),
    );

    await expect(
      as().mutation(api.articles.remove, {
        siteId: s.disabledSite,
        articleId,
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });
});

// ── Superadmin is not exempt ───────────────────────────────────────────────────

describe("superadmin is not exempt from module-disabled guard", () => {
  it("superadmin cannot create a course on a site with courses disabled", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: "superadmin_module_test",
        name: "Super Admin",
        email: "superadmin_module_test@test.local",
        isSuperAdmin: true,
        isActive: true,
        roles: [],
      });
    });

    await expect(
      t.withIdentity({ subject: "superadmin_module_test" }).mutation(api.courses.create, {
        siteId: s.disabledSite,
        title: "SA Course Attempt",
        slug: "sa-course-attempt",
        description: "Superadmin should still be blocked",
      }),
    ).rejects.toThrow(/not enabled|disabled/i);
  });
});
