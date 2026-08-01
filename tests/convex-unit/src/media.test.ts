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
      .withIdentity({ subject: "owner_a" })
      .mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    expect(result.deleted).toBe(1);
  });

  it("leaves the real-URL record untouched", async () => {
    await t.withIdentity({ subject: "owner_a" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const remaining = await t.run((ctx) => ctx.db.get(s.realUrlId));
    expect(remaining).not.toBeNull();
    expect(remaining?.url).toBe("https://cdn.example.com/photo.png");
  });

  it("leaves the storageId record untouched", async () => {
    await t.withIdentity({ subject: "owner_a" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const remaining = await t.run((ctx) => ctx.db.get(s.storageAssetId));
    expect(remaining).not.toBeNull();
    expect(remaining?.storageId).toBeTruthy();
  });

  it("actually removes the base64 record from the database", async () => {
    await t.withIdentity({ subject: "owner_a" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

    const gone = await t.run((ctx) => ctx.db.get(s.dataUrlId));
    expect(gone).toBeNull();
  });
});

describe("migrateDeleteDataUrls — idempotency", () => {
  it("returns deleted=0 when called a second time on an already-clean library", async () => {
    const caller = () =>
      t.withIdentity({ subject: "owner_a" }).mutation(api.media.migrateDeleteDataUrls, { siteId: s.siteA });

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
