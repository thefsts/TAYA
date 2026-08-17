/**
 * Media mutation unit tests — migrateDeleteDataUrls
 *
 * Verifies:
 *   1. Deletes only records whose `url` field starts with "data:" (legacy base64).
 *   2. Leaves records with a real URL untouched.
 *   3. Leaves records with a storageId (new upload path) untouched.
 *   4. Returns the correct deleted count.
 *   5. Is idempotent — calling it a second time on a clean library returns 0.
 *   6. Rejects unauthenticated callers.
 *   7. Rejects callers who have no role on the target site.
 *
 * @vitest-environment edge-runtime
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function siteDoc(name: string, slug: string) {
  return {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#000000",
    brandColorSecondary: "#ffffff",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "professional_services",
    enabledModules: { media: true },
  };
}

function userDoc(
  clerkUserId: string,
  overrides: Partial<{
    isSuperAdmin: boolean;
    isActive: boolean;
    roles: { siteId: Id<"sites">; role: string }[];
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

function mediaDoc(
  siteId: Id<"sites">,
  urlOrStorageId:
    | { url: string }
    | { storageId: string },
  fileName = "test.png",
) {
  return {
    siteId,
    fileName,
    mimeType: "image/png",
    sizeBytes: 1024,
    ...urlOrStorageId,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

type Seeded = {
  siteA: Id<"sites">;
  siteB: Id<"sites">;
  dataUrlId: Id<"mediaAssets">;
  realUrlId: Id<"mediaAssets">;
  storageAssetId: Id<"mediaAssets">;
};

let t: ReturnType<typeof convexTest>;
let s: Seeded;

beforeEach(async () => {
  t = convexTest(schema, modules);

  s = await t.run(async (ctx) => {
    const siteA = await ctx.db.insert("sites", siteDoc("Site A", "site-a"));
    const siteB = await ctx.db.insert("sites", siteDoc("Site B", "site-b"));

    // Seed users before any function call to avoid accidental superadmin bootstrap.
    await ctx.db.insert("users", userDoc("superadmin", { isSuperAdmin: true }));
    await ctx.db.insert("users", userDoc("owner_a", { roles: [{ siteId: siteA, role: "owner" }] }));
    await ctx.db.insert("users", userDoc("outsider", { roles: [] }));

    // Three media records on Site A:
    //   1. Legacy base64  → should be deleted
    //   2. Real https URL → must NOT be deleted
    //   3. storageId path → must NOT be deleted
    const dataUrlId = await ctx.db.insert("mediaAssets", mediaDoc(siteA, {
      url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
    }, "legacy-base64.png"));

    const realUrlId = await ctx.db.insert("mediaAssets", mediaDoc(siteA, {
      url: "https://cdn.example.com/photo.png",
    }, "cdn-photo.png"));

    // Store a real blob to get a valid storageId.
    const realStorageId = await ctx.storage.store(new Blob(["fake-png-bytes"], { type: "image/png" }));
    const storageAssetId = await ctx.db.insert("mediaAssets", {
      siteId: siteA,
      storageId: realStorageId,
      fileName: "uploaded.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    });

    return { siteA, siteB, dataUrlId, realUrlId, storageAssetId };
  });
});

// ---------------------------------------------------------------------------

describe("migrateDeleteDataUrls — happy path", () => {
  it("deletes only the data: URL record and returns deleted=1", async () => {
    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    expect(result.deleted).toBe(1);
  });

  it("leaves the real-URL record untouched", async () => {
    await t.withIdentity({ subject: "superadmin" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const remaining = await t.run((ctx) => ctx.db.get(s.realUrlId));
    expect(remaining).not.toBeNull();
    expect(remaining?.url).toBe("https://cdn.example.com/photo.png");
  });

  it("leaves the storageId record untouched", async () => {
    await t.withIdentity({ subject: "superadmin" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const remaining = await t.run((ctx) => ctx.db.get(s.storageAssetId));
    expect(remaining).not.toBeNull();
    expect(remaining?.storageId).toBeTruthy();
  });

  it("actually removes the base64 record from the database", async () => {
    await t.withIdentity({ subject: "superadmin" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const gone = await t.run((ctx) => ctx.db.get(s.dataUrlId));
    expect(gone).toBeNull();
  });
});

describe("migrateDeleteDataUrls — idempotency", () => {
  it("returns deleted=0 when called a second time on an already-clean library", async () => {
    const caller = () =>
      t.withIdentity({ subject: "superadmin" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const first = await caller();
    expect(first.deleted).toBe(1);

    const second = await caller();
    expect(second.deleted).toBe(0);
  });

  it("returns deleted=0 on a site that never had any base64 records", async () => {
    // Site B has no media records at all.
    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteB });

    expect(result.deleted).toBe(0);
  });
});

describe("migrateDeleteDataUrls — access control", () => {
  it("rejects unauthenticated callers", async () => {
    await expect(
      t.mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("rejects a user with no role on the target site", async () => {
    await expect(
      t.withIdentity({ subject: "outsider" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("allows a superadmin to purge any site", async () => {
    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    expect(result.deleted).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — added to guard against future schema / logic regressions
// ---------------------------------------------------------------------------

describe("migrateDeleteDataUrls — edge case: record has both data: URL and storageId", () => {
  /**
   * The schema allows both `url` and `storageId` to be present on a single
   * record (both fields are optional).  If `url` starts with "data:" the
   * purge logic must still delete the record — the storageId does not
   * grant immunity.
   */
  it("deletes a record that carries both a data: URL and a storageId", async () => {
    // Insert a hybrid record on Site B (no other media there).
    const hybridId = await t.run(async (ctx) => {
      const realStorageId = await ctx.storage.store(
        new Blob(["hybrid-bytes"], { type: "image/png" }),
      );
      return ctx.db.insert("mediaAssets", {
        siteId: s.siteB,
        storageId: realStorageId,
        url: "data:image/png;base64,AAAA",
        fileName: "hybrid.png",
        mimeType: "image/png",
        sizeBytes: 512,
      });
    });

    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteB });

    expect(result.deleted).toBe(1);

    const gone = await t.run((ctx) => ctx.db.get(hybridId));
    expect(gone).toBeNull();
  });

  it("does NOT delete the storageId-only record on the same site run", async () => {
    // Insert one data:+storageId hybrid and one pure-storageId record on Site B.
    await t.run(async (ctx) => {
      const sid1 = await ctx.storage.store(
        new Blob(["hybrid"], { type: "image/png" }),
      );
      const sid2 = await ctx.storage.store(
        new Blob(["pure"], { type: "image/png" }),
      );
      await ctx.db.insert("mediaAssets", {
        siteId: s.siteB,
        storageId: sid1,
        url: "data:image/png;base64,AAAA",
        fileName: "hybrid.png",
        mimeType: "image/png",
        sizeBytes: 512,
      });
      await ctx.db.insert("mediaAssets", {
        siteId: s.siteB,
        storageId: sid2,
        fileName: "pure.png",
        mimeType: "image/png",
        sizeBytes: 512,
      });
    });

    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteB });

    // Only the hybrid (data: URL) record should be removed.
    expect(result.deleted).toBe(1);
  });
});

describe("migrateDeleteDataUrls — edge case: URL starting with 'data-' is NOT base64", () => {
  /**
   * A URL such as "data-export/image.png" or a CDN path like
   * "https://cdn.example.com/data-lake/photo.png" must NOT be treated as a
   * legacy base64 record.  Only strings that start with the exact token
   * "data:" (colon, not hyphen) qualify for deletion.
   */

  const nonBase64Urls = [
    "data-export/image.png",
    "data-placeholder.svg",
    "/media/data-driven/chart.png",
    "https://cdn.example.com/data-lake/photo.png",
  ];

  for (const url of nonBase64Urls) {
    it(`preserves record with url="${url}"`, async () => {
      const id = await t.run((ctx) =>
        ctx.db.insert("mediaAssets", {
          siteId: s.siteB,
          url,
          fileName: "data-look-alike.png",
          mimeType: "image/png",
          sizeBytes: 256,
        }),
      );

      const result = await t
        .withIdentity({ subject: "superadmin" })
        .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteB });

      expect(result.deleted).toBe(0);

      const still = await t.run((ctx) => ctx.db.get(id));
      expect(still).not.toBeNull();
      expect(still?.url).toBe(url);
    });
  }
});

describe("migrateDeleteDataUrls — edge case: 50+ mixed records, exact count", () => {
  /**
   * Inserts a large batch of records (well above the default Convex query
   * page size of 8) on a fresh site and verifies that deleted exactly equals
   * the number of data: records seeded — no under-count, no over-count.
   */
  it("deletes exactly the data: records in a 55-record mixed library", async () => {
    const DATA_URL_COUNT = 30;
    const REAL_URL_COUNT = 15;
    const STORAGE_COUNT = 10;
    const TOTAL_EXPECTED_DELETED = DATA_URL_COUNT;

    const siteC = await t.run((ctx) =>
      ctx.db.insert("sites", siteDoc("Site C", "site-c")),
    );

    await t.run(async (ctx) => {
      // data: URL records — must all be purged
      for (let i = 0; i < DATA_URL_COUNT; i++) {
        await ctx.db.insert("mediaAssets", {
          siteId: siteC,
          url: `data:image/png;base64,BASE64DATA${i}`,
          fileName: `base64-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 100 + i,
        });
      }
      // Real https URL records — must survive
      for (let i = 0; i < REAL_URL_COUNT; i++) {
        await ctx.db.insert("mediaAssets", {
          siteId: siteC,
          url: `https://cdn.example.com/real-${i}.png`,
          fileName: `real-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 2000 + i,
        });
      }
      // Storage-backed records — must survive
      for (let i = 0; i < STORAGE_COUNT; i++) {
        const sid = await ctx.storage.store(
          new Blob([`stored-${i}`], { type: "image/png" }),
        );
        await ctx.db.insert("mediaAssets", {
          siteId: siteC,
          storageId: sid,
          fileName: `stored-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 3000 + i,
        });
      }
    });

    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: siteC });

    expect(result.deleted).toBe(TOTAL_EXPECTED_DELETED);

    // Verify surviving records count matches expectation.
    const survivors = await t.run((ctx) =>
      ctx.db
        .query("mediaAssets")
        .withIndex("by_site", (q) => q.eq("siteId", siteC))
        .collect(),
    );
    expect(survivors).toHaveLength(REAL_URL_COUNT + STORAGE_COUNT);

    // None of the survivors should have a data: URL.
    for (const doc of survivors) {
      expect(doc.url?.startsWith("data:") ?? false).toBe(false);
    }
  });

  it("is idempotent on the large mixed library (second run returns 0)", async () => {
    const siteD = await t.run((ctx) =>
      ctx.db.insert("sites", siteDoc("Site D", "site-d")),
    );

    await t.run(async (ctx) => {
      for (let i = 0; i < 55; i++) {
        const isBase64 = i % 2 === 0;
        await ctx.db.insert("mediaAssets", {
          siteId: siteD,
          url: isBase64
            ? `data:image/png;base64,DATA${i}`
            : `https://cdn.example.com/img-${i}.png`,
          fileName: `img-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 1000,
        });
      }
    });

    const first = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: siteD });

    // 55 records, every even index is base64 → indices 0,2,4,...,54 = 28 records
    expect(first.deleted).toBe(28);

    const second = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: siteD });

    expect(second.deleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-site isolation — the critical regression guard
// ---------------------------------------------------------------------------

describe("migrateDeleteDataUrls — cross-site isolation", () => {
  /**
   * Runs the purge against Site A while Site B holds its own data: URL records.
   * Site B's records must be 100% intact after the call — zero tolerance for
   * cross-client data loss.
   */
  it("does not delete data: URL records belonging to a different site", async () => {
    // Seed three data: URL records on Site B so we have something to protect.
    const siteBIds = await t.run(async (ctx) => {
      const ids: Id<"mediaAssets">[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push(
          await ctx.db.insert("mediaAssets", {
            siteId: s.siteB,
            url: `data:image/png;base64,SITE_B_DATA_${i}`,
            fileName: `site-b-legacy-${i}.png`,
            mimeType: "image/png",
            sizeBytes: 512 + i,
          }),
        );
      }
      return ids;
    });

    // Purge only Site A (which already has one data: URL record from beforeEach).
    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    // Site A's single data: URL record should have been removed.
    expect(result.deleted).toBe(1);

    // Every Site B record must still exist and be unmodified.
    for (const id of siteBIds) {
      const doc = await t.run((ctx) => ctx.db.get(id));
      expect(doc).not.toBeNull();
      expect(doc?.siteId).toStrictEqual(s.siteB);
      expect(doc?.url?.startsWith("data:")).toBe(true);
    }

    // Confirm the full Site B count via index query too.
    const siteBDocs = await t.run((ctx) =>
      ctx.db
        .query("mediaAssets")
        .withIndex("by_site", (q) => q.eq("siteId", s.siteB))
        .collect(),
    );
    expect(siteBDocs).toHaveLength(3);
  });

  it("purging Site B does not touch Site A's surviving records", async () => {
    // Seed one data: URL record on Site B.
    await t.run((ctx) =>
      ctx.db.insert("mediaAssets", {
        siteId: s.siteB,
        url: "data:image/png;base64,SITE_B_ONLY",
        fileName: "site-b-only.png",
        mimeType: "image/png",
        sizeBytes: 256,
      }),
    );

    // Purge Site B.
    const result = await t
      .withIdentity({ subject: "superadmin" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteB });

    expect(result.deleted).toBe(1);

    // Site A's real-URL and storageId records must be intact.
    const realUrl = await t.run((ctx) => ctx.db.get(s.realUrlId));
    expect(realUrl).not.toBeNull();
    expect(realUrl?.url).toBe("https://cdn.example.com/photo.png");

    const storage = await t.run((ctx) => ctx.db.get(s.storageAssetId));
    expect(storage).not.toBeNull();
    expect(storage?.storageId).toBeTruthy();

    // Site A's data: URL record (seeded in beforeEach) must also still exist
    // because we only purged Site B this time.
    const dataUrl = await t.run((ctx) => ctx.db.get(s.dataUrlId));
    expect(dataUrl).not.toBeNull();
    expect(dataUrl?.url?.startsWith("data:")).toBe(true);
  });
});
