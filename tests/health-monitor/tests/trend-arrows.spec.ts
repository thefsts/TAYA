/**
 * Trend Arrow Tests — Health Monitor
 *
 * Verifies that the mini category overview on the Health Monitor page correctly
 * renders TrendingUp, TrendingDown, and no-arrow states based on comparing the
 * two most-recent scans (scanHistory[0] vs scanHistory[1]).
 *
 * Data is seeded via the `healthScans:testHarness` Convex action, which is only
 * active when CONVEX_TEST_MODE=true is set in the Convex environment. The action
 * delegates to internal mutations so no destructive API surface is exposed in
 * production.
 *
 * The Convex client must be accessible as window.__convex (exposed in dev mode
 * by App.tsx).
 *
 * Auth: requires CLERK_TEST_TOKEN env var — a signed-in Clerk session for a user
 * with access to at least one site. See follow-up task #162 for auto-provisioning.
 *
 * Run: pnpm --filter @workspace/health-monitor-tests run test
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:80";

function makeCategoryScores(performanceScore: number): Record<string, unknown> {
  const status = (s: number): string => (s >= 75 ? "good" : s >= 50 ? "warning" : "critical");
  const categories = [
    "performance", "seo", "accessibility", "security",
    "forms", "email", "payments", "media",
    "content", "mobile", "uptime", "backups",
  ];
  return Object.fromEntries(
    categories.map((cat) => {
      const score = cat === "performance" ? performanceScore : 80;
      return [cat, { score, status: status(score), trend: "stable", lastScannedAt: Date.now(), issues: [], actions: [] }];
    })
  );
}

async function seedScan(
  page: Page,
  siteId: string,
  overallScore: number,
  performanceScore: number,
  scannedAt: number,
): Promise<void> {
  const categoryScores = makeCategoryScores(performanceScore);
  await page.evaluate(
    async ({ siteId, overallScore, performanceScore, scannedAt, categoryScores }) => {
      const convex = (window as any).__convex;
      if (!convex) throw new Error("window.__convex not found — dev mode required");
      await convex.action("healthScans:testHarness", {
        op: "seedScan",
        siteId,
        overallScore,
        status: overallScore >= 75 ? "good" : "warning",
        categoryScores,
        scannedAt,
      });
    },
    { siteId, overallScore, performanceScore, scannedAt, categoryScores }
  );
}

async function deleteAllScans(page: Page, siteId: string): Promise<void> {
  await page.evaluate(async ({ siteId }) => {
    const convex = (window as any).__convex;
    if (!convex) throw new Error("window.__convex not found");
    await convex.action("healthScans:testHarness", { op: "deleteAllScans", siteId });
  }, { siteId });
}

async function navigateToHealthMonitor(page: Page, siteId: string): Promise<void> {
  await page.goto(`${BASE}/app/sites/${siteId}/health`);
  await page.waitForTimeout(2500);
}

test.describe("Health Monitor — trend arrows", () => {
  let siteId: string | null = null;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    const clerkToken = process.env.CLERK_TEST_TOKEN;
    if (!clerkToken) {
      return;
    }

    await page.goto(`${BASE}/`);
    await page.evaluate((token) => {
      localStorage.setItem("__clerk_db_jwt", token);
    }, clerkToken);
    await page.goto(`${BASE}/app/sites`);
    await page.waitForTimeout(3000);

    const siteLinks = await page.locator('a[href*="/app/sites/"]').all();
    for (const link of siteLinks) {
      const href = await link.getAttribute("href");
      if (href) {
        const match = href.match(/\/app\/sites\/([^/]+)/);
        if (match && match[1]) {
          siteId = match[1];
          break;
        }
      }
    }
  });

  test.afterAll(async () => {
    if (siteId && page) {
      try {
        await deleteAllScans(page, siteId);
      } catch {
        // best-effort cleanup
      }
    }
    await page.close();
  });

  test("no arrow when only one scan exists", async () => {
    if (!siteId || !process.env.CLERK_TEST_TOKEN) {
      test.skip(true, "CLERK_TEST_TOKEN not set or no site available");
      return;
    }
    const id = siteId;
    const now = Date.now();

    await deleteAllScans(page, id);
    await seedScan(page, id, 72, 72, now - 60_000);
    await navigateToHealthMonitor(page, id);

    const overallCard = page.locator(".grid.grid-cols-6");
    const performanceCell = overallCard.locator(
      `[href*="/media"], div.text-center`
    ).first();

    await expect(performanceCell.locator("svg.lucide-trending-up")).toHaveCount(0);
    await expect(performanceCell.locator("svg.lucide-trending-down")).toHaveCount(0);
  });

  test("TrendingUp arrow when second scan improves performance score", async () => {
    if (!siteId || !process.env.CLERK_TEST_TOKEN) {
      test.skip(true, "CLERK_TEST_TOKEN not set or no site available");
      return;
    }
    const id = siteId;
    const now = Date.now();

    await deleteAllScans(page, id);
    await seedScan(page, id, 60, 60, now - 120_000);
    await seedScan(page, id, 80, 80, now - 60_000);
    await navigateToHealthMonitor(page, id);

    const overallCard = page.locator(".grid.grid-cols-6");
    const trendingUpIcons = overallCard.locator("svg.lucide-trending-up");
    await expect(trendingUpIcons.first()).toBeVisible();
  });

  test("TrendingDown arrow when second scan regresses performance score", async () => {
    if (!siteId || !process.env.CLERK_TEST_TOKEN) {
      test.skip(true, "CLERK_TEST_TOKEN not set or no site available");
      return;
    }
    const id = siteId;
    const now = Date.now();

    await deleteAllScans(page, id);
    await seedScan(page, id, 80, 80, now - 120_000);
    await seedScan(page, id, 60, 60, now - 60_000);
    await navigateToHealthMonitor(page, id);

    const overallCard = page.locator(".grid.grid-cols-6");
    const trendingDownIcons = overallCard.locator("svg.lucide-trending-down");
    await expect(trendingDownIcons.first()).toBeVisible();
  });
});
