/**
 * Client Website Integration E2E — Neutral Contract Tests
 *
 * Verifies that a client website built on FSTS-WOS™ exposes the standard
 * public-facing contract: courses are listed with correct pricing, a booking
 * form is reachable, and event pages show required pricing before any
 * payment is submitted.
 *
 * These tests are intentionally CLIENT-NEUTRAL.  They use no Corsair-specific
 * slugs, images, or branding.  The base URL is injected via the
 * CLIENT_E2E_BASE_URL environment variable; tests skip gracefully when no
 * client website is running.
 *
 * Replace the slug constants below with the actual slugs defined in the
 * specific client website under test, or parameterise via environment
 * variables in CI.
 */

import { test, expect } from "@playwright/test";

const COURSES_PATH = process.env.CLIENT_COURSES_PATH ?? "/courses";
const EXAMPLE_COURSE_PATH = process.env.CLIENT_EXAMPLE_COURSE_PATH ?? "";

// ---------------------------------------------------------------------------
// Guard: skip the entire suite when no client website is reachable.
// This prevents CI failures when the client E2E suite runs in the platform
// repo without an external client dev server.
// ---------------------------------------------------------------------------
test.beforeAll(async ({ browser }) => {
  const baseURL = process.env.CLIENT_E2E_BASE_URL ?? "http://localhost:3000";
  let reachable = false;
  try {
    const page = await browser.newPage();
    const res = await page.goto(baseURL, { timeout: 5_000 }).catch(() => null);
    reachable = res !== null && res.status() < 500;
    await page.close();
  } catch {
    reachable = false;
  }
  if (!reachable) {
    // Playwright doesn't support dynamic test.skip in beforeAll, so we use
    // an environment flag checked at the top of each test.
    process.env._CLIENT_E2E_SKIP = "1";
  }
});

function skipIfNoServer() {
  if (process.env._CLIENT_E2E_SKIP === "1") {
    test.skip(true, "No client website running at CLIENT_E2E_BASE_URL — skipping.");
  }
}

// ---------------------------------------------------------------------------
// 1. Course listing page
// ---------------------------------------------------------------------------
test.describe("Course listing page", () => {
  test("renders a list of courses with price information", async ({ page }) => {
    skipIfNoServer();

    await page.goto(COURSES_PATH);
    await page.waitForLoadState("networkidle");

    // Expect at least one element containing a dollar amount to be visible.
    // This confirms that course prices are rendered (not hidden or zero).
    const priceElements = page.locator("text=/\\$\\d+/");
    await expect(priceElements.first()).toBeVisible();
  });

  test("does not display a $0 price on any course card", async ({ page }) => {
    skipIfNoServer();

    await page.goto(COURSES_PATH);
    await page.waitForLoadState("networkidle");

    // A $0 price almost always signals a broken courseSlug or pricing bug.
    const zeroPrices = page.locator("text=$0");
    await expect(zeroPrices).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Individual course / booking page (only when a path is configured)
// ---------------------------------------------------------------------------
test.describe("Course detail / booking page", () => {
  test.skip(
    !EXAMPLE_COURSE_PATH,
    "Set CLIENT_EXAMPLE_COURSE_PATH to enable course-detail tests",
  );

  test("shows a price in the booking panel", async ({ page }) => {
    skipIfNoServer();

    await page.goto(EXAMPLE_COURSE_PATH);
    await page.waitForLoadState("networkidle");

    // Booking panel or price badge must contain a dollar amount.
    const priceEl = page.locator("text=/\\$\\d+/").first();
    await expect(priceEl).toBeVisible();
  });

  test("does not show a $0 amount in the booking panel", async ({ page }) => {
    skipIfNoServer();

    await page.goto(EXAMPLE_COURSE_PATH);
    await page.waitForLoadState("networkidle");

    const zeroPrices = page.locator("text=$0");
    await expect(zeroPrices).toHaveCount(0);
  });

  test("booking panel has at least one selectable pricing option", async ({ page }) => {
    skipIfNoServer();

    await page.goto(EXAMPLE_COURSE_PATH);
    await page.waitForLoadState("networkidle");

    // The booking form should render at least one radio or button for an option.
    const options = page.locator("input[type=radio], label[for]");
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });
});
