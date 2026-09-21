/**
 * CHAT D — CLIENT WEBSITE MANAGEMENT COMPLETION: new-function integration tests.
 * @vitest-environment edge-runtime
 *
 * Covers the Chat D gap-closers against the REAL handlers (no mocks of
 * requirePermission / rolePermissions):
 *
 *   G4  downloads.generateUploadUrl  — CONTENT_CREATE tier + downloads
 *       module enabled + PDF-only MIME gating.
 *   G4  downloads.createFromStorage   — resolves the storage URL, stamps
 *       format "PDF" + sizeLabel, inserts a storageId-backed row.
 *   G4  downloads.remove              — deletes the uploaded blob with the row.
 *   G4  downloads.update              — storage-backed rows reject manual URL edits.
 *   G5  seo.importFromDiscovery       — creates rows for discovered pages with
 *       live meta; NEVER overwrites existing rows (owner edits preserved);
 *       skips pages with nothing to import (§14 no fabricated data);
 *       trailing-slash paths normalize so "/about/" and "/about" don't
 *       duplicate.
 *
 * A marketing-role user is used for the download flow — the tier decision
 * (CONTENT_CREATE, not MEDIA_UPLOAD) means marketing can publish PDFs even
 * though it lacks MEDIA_DELETE.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const modules = import.meta.glob("../../../convex/**/*.ts");

let t: ReturnType<typeof convexTest>;
let siteA: Id<"sites">;
let siteNoDownloads: Id<"sites">;

const asAdmin = () => t.withIdentity({ subject: "superadmin" });
const asOwner = () => t.withIdentity({ subject: "owner_user" });
const asMarketing = () => t.withIdentity({ subject: "marketing_user" });
const asReadOnly = () => t.withIdentity({ subject: "read_only_user" });

async function seedSite(
  ctx: any,
  name: string,
  slug: string,
  enabledModules: Record<string, boolean>,
): Promise<Id<"sites">> {
  return ctx.db.insert("sites", {
    name,
    slug,
    status: "active",
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "business_website",
    enabledModules,
  });
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkUserId: "superadmin",
      name: "FSTS Admin",
      email: "superadmin@unknown.local",
      isSuperAdmin: true,
      isActive: true,
      roles: [],
    });
    siteA = await seedSite(ctx, "Site A", "site-a", {
      downloads: true,
      seo: true,
    });
    siteNoDownloads = await seedSite(ctx, "No Downloads", "no-downloads", {
      downloads: false,
      seo: true,
    });
    await ctx.db.insert("users", {
      clerkUserId: "owner_user",
      name: "Site Owner",
      email: "owner@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "owner" }],
    });
    // marketing: CONTENT_VIEW/CREATE/UPDATE + MEDIA_VIEW/UPLOAD but NO
    // MEDIA_DELETE — the Chat D tier decision must still let them publish PDFs.
    await ctx.db.insert("users", {
      clerkUserId: "marketing_user",
      name: "Marketing Manager",
      email: "marketing@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "marketing" }],
    });
    await ctx.db.insert("users", {
      clerkUserId: "read_only_user",
      name: "Read Only",
      email: "readonly@client.test",
      isSuperAdmin: false,
      isActive: true,
      roles: [{ siteId: siteA, role: "read_only" }],
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── G4: downloads.generateUploadUrl ────────────────────────────────────────

describe("downloads.generateUploadUrl — CONTENT_CREATE tier + PDF-only", () => {
  it("returns a URL string for a marketing user (CONTENT_CREATE tier)", async () => {
    const url = await asMarketing().mutation(api.downloads.generateUploadUrl, {
      siteId: siteA,
      mimeType: "application/pdf",
    });
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("rejects a non-PDF MIME type", async () => {
    await expect(
      asMarketing().mutation(api.downloads.generateUploadUrl, {
        siteId: siteA,
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/PDF only/i);
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      t.mutation(api.downloads.generateUploadUrl, { siteId: siteA }),
    ).rejects.toThrow(/Not authenticated/i);
  });

  it("rejects read_only (no CONTENT_CREATE)", async () => {
    await expect(
      asReadOnly().mutation(api.downloads.generateUploadUrl, { siteId: siteA }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it("rejects when the downloads module is disabled for the site", async () => {
    // superadmin passes site access for any site — so the ONLY rejection
    // reason left is the disabled downloads module.
    await expect(
      asAdmin().mutation(api.downloads.generateUploadUrl, {
        siteId: siteNoDownloads,
      }),
    ).rejects.toThrow(/downloads.*not enabled/i);
  });
});

// ─── G4: downloads.createFromStorage / remove / update storage lifecycle ────

describe("downloads.createFromStorage — storage-backed PDF rows", () => {
  async function storePdf(): Promise<Id<"_storage">> {
    return await t.run((ctx) =>
      ctx.storage.store(new Blob(["%PDF-1.4 fake"], { type: "application/pdf" })),
    );
  }

  it("creates a row with resolved URL, format PDF, sizeLabel, storageId", async () => {
    const storageId = await storePdf();
    const result = await asMarketing().mutation(api.downloads.createFromStorage, {
      siteId: siteA,
      storageId,
      title: "Class Schedule",
      fileName: "schedule.pdf",
      sizeBytes: 2_500_000,
      category: "Schedules",
    });
    expect(result.title).toBe("Class Schedule");
    expect(result.format).toBe("PDF");
    expect(result.sizeLabel).toBe("2.4 MB");
    expect(result.storageId).toBe(storageId);
    expect(result.url).toMatch(/^https?:\/\//);
    expect(result.isActive).toBe(true);
  });

  it("rejects a missing/unknown storageId", async () => {
    // Store then delete a real blob — the Id stays valid but getUrl resolves
    // to null, exercising the handler's "could not be found" guard.
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["x"], { type: "application/pdf" }));
      await ctx.storage.delete(id);
      return id;
    });
    await expect(
      asMarketing().mutation(api.downloads.createFromStorage, {
        siteId: siteA,
        storageId,
        title: "Ghost",
        fileName: "ghost.pdf",
        sizeBytes: 10,
      }),
    ).rejects.toThrow(/could not be found/i);
  });

  it("rejects read_only (CONTENT_CREATE tier)", async () => {
    const storageId = await storePdf();
    await expect(
      asReadOnly().mutation(api.downloads.createFromStorage, {
        siteId: siteA,
        storageId,
        title: "Nope",
        fileName: "nope.pdf",
        sizeBytes: 10,
      }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it("remove deletes the uploaded blob together with the row", async () => {
    const storageId = await storePdf();
    const created = await asMarketing().mutation(api.downloads.createFromStorage, {
      siteId: siteA,
      storageId,
      title: "Temp PDF",
      fileName: "temp.pdf",
      sizeBytes: 1024,
    });
    await asOwner().mutation(api.downloads.remove, {
      siteId: siteA,
      resourceId: created.id,
    });
    const urlAfter = await t.run((ctx) => ctx.storage.getUrl(storageId));
    expect(urlAfter).toBeNull();
    const rows = await t.run((ctx) => ctx.db.query("downloadableResources").collect());
    expect(rows).toHaveLength(0);
  });

  it("update rejects a manual URL edit on a storage-backed row", async () => {
    const storageId = await storePdf();
    const created = await asMarketing().mutation(api.downloads.createFromStorage, {
      siteId: siteA,
      storageId,
      title: "Locked PDF",
      fileName: "locked.pdf",
      sizeBytes: 2048,
    });
    await expect(
      asOwner().mutation(api.downloads.update, {
        siteId: siteA,
        resourceId: created.id,
        url: "https://example.com/replacement.pdf",
      }),
    ).rejects.toThrow(/re-upload/i);
    // Same-URL or title-only patches still work.
    await asOwner().mutation(api.downloads.update, {
      siteId: siteA,
      resourceId: created.id,
      title: "Locked PDF (renamed)",
    });
    const row = await t.run(async (ctx) => {
      const rows = await ctx.db.query("downloadableResources").collect();
      return rows[0];
    });
    expect(row.title).toBe("Locked PDF (renamed)");
  });
});

// ─── G5: seo.importFromDiscovery — no-overwrite import ──────────────────────

describe("seo.importFromDiscovery — import live SEO without overwriting", () => {
  async function seedSnapshot(pages: Array<Record<string, unknown>>) {
    await t.run(async (ctx) => {
      await ctx.db.insert("discoverySnapshots", {
        siteId: siteA,
        kind: "refresh",
        status: "completed",
        domain: "example.com",
        startedAt: Date.now(),
        completedAt: Date.now(),
        triggeredBy: "owner@client.test",
        snapshot: { pages },
      });
    });
  }

  it("creates seoSettings rows for discovered pages with live meta", async () => {
    await seedSnapshot([
      {
        path: "/",
        url: "https://example.com/",
        status: "fetched",
        httpStatus: 200,
        bytes: 1000,
        model: {
          meta: {
            title: "Home — Example Co",
            description: "Welcome to Example Co.",
            ogTitle: null,
            ogDescription: null,
            ogImage: "https://example.com/og.png",
            canonical: "https://example.com/",
          },
        },
      },
    ]);
    const result = await asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(1);
    expect(result.createdPaths).toContain("/");
    const rows = await t.run((ctx) =>
      ctx.db.query("seoSettings").withIndex("by_site", (q: any) => q.eq("siteId", siteA)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Home — Example Co");
    expect(rows[0].ogImageUrl).toBe("https://example.com/og.png");
    expect(rows[0].importedFromDiscovery).toBe(true);
  });

  it("NEVER overwrites existing rows — owner edits preserved", async () => {
    await asOwner().mutation(api.seo.create, {
      siteId: siteA,
      pagePath: "/about",
      title: "MY HAND-EDITED TITLE",
      description: "Owner wrote this.",
    });
    await seedSnapshot([
      {
        path: "/about",
        url: "https://example.com/about",
        status: "fetched",
        httpStatus: 200,
        bytes: 500,
        model: {
          meta: { title: "Live About Page", description: "From the live site." },
        },
      },
    ]);
    const result = await asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(0);
    expect(result.skippedExisting).toBe(1);
    const rows = await t.run((ctx) =>
      ctx.db.query("seoSettings").withIndex("by_site", (q: any) => q.eq("siteId", siteA)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("MY HAND-EDITED TITLE");
  });

  it("trailing-slash discovered paths match existing normalized rows (no duplicates)", async () => {
    await asOwner().mutation(api.seo.create, {
      siteId: siteA,
      pagePath: "/about",
      title: "Hand-made",
      description: "d",
    });
    await seedSnapshot([
      {
        path: "/about/",
        status: "fetched",
        httpStatus: 200,
        bytes: 500,
        model: { meta: { title: "Live About", description: "live" } },
      },
    ]);
    const result = await asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(0);
    expect(result.skippedExisting).toBe(1);
  });

  it("skips pages with no live title AND no description (§14 no fabricated data)", async () => {
    await seedSnapshot([
      {
        path: "/empty",
        status: "fetched",
        httpStatus: 200,
        bytes: 100,
        model: { meta: { title: null, description: "" } },
      },
    ]);
    const result = await asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(0);
    expect(result.skippedEmpty).toBe(1);
  });

  it("skips error pages (status !== fetched) and pages without a model", async () => {
    await seedSnapshot([
      { path: "/boom", status: "error", httpStatus: 500, bytes: 0, model: null },
      { path: "/nomodel", status: "fetched", httpStatus: 200, bytes: 10, model: null },
    ]);
    const result = await asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(0);
    expect(result.skippedEmpty).toBe(0);
    expect(result.skippedExisting).toBe(0);
  });

  it("throws a clear error when no discovery snapshot exists", async () => {
    await expect(
      asOwner().mutation(api.seo.importFromDiscovery, { siteId: siteA }),
    ).rejects.toThrow(/No discovery snapshot/i);
  });

  it("rejects read_only callers (CONTENT_CREATE tier)", async () => {
    await seedSnapshot([]);
    await expect(
      asReadOnly().mutation(api.seo.importFromDiscovery, { siteId: siteA }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it("marketing can run the import (CONTENT_CREATE tier)", async () => {
    await seedSnapshot([
      {
        path: "/pricing",
        status: "fetched",
        httpStatus: 200,
        bytes: 400,
        model: { meta: { title: "Pricing", description: "Our rates." } },
      },
    ]);
    const result = await asMarketing().mutation(api.seo.importFromDiscovery, { siteId: siteA });
    expect(result.created).toBe(1);
  });
});

// ─── G6: siteSettings.updateAnalytics — client-safe tier ────────────────────

describe("siteSettings.updateAnalytics — client-safe GA4/GTM/Search Console (Chat D)", () => {
  it("owner can set GA4 + Search Console + GTM", async () => {
    const result = await asOwner().mutation(api.siteSettings.updateAnalytics, {
      siteId: siteA,
      analyticsGa4: "G-ABC123",
      analyticsGtm: "GTM-XYZ9",
      analyticsSearchConsole: "verify-token",
    });
    expect(result).toMatchObject({
      analyticsGa4: "G-ABC123",
      analyticsGtm: "GTM-XYZ9",
      analyticsSearchConsole: "verify-token",
    });
  });

  it("rejects read_only callers (CONTENT_UPDATE tier)", async () => {
    await expect(
      asReadOnly().mutation(api.siteSettings.updateAnalytics, {
        siteId: siteA,
        analyticsGa4: "G-NOPE",
      }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it("still rejects clients on updateIntegrations (Pixel/cookie stay superadmin)", async () => {
    await expect(
      asOwner().mutation(api.siteSettings.updateIntegrations, {
        siteId: siteA,
        analyticsPixel: "12345",
      }),
    ).rejects.toThrow(/Forbidden/i);
  });
});
