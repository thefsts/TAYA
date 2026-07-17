/**
 * E2E pricing guard: Defensive Shooting Skills — booking panel
 *
 * Verifies that the customer-visible UI shows the correct $150 price for the
 * Defensive Shooting Skills course. A bad merge or copy/paste of another
 * course's pricingOptions would silently display the wrong dollar amount to
 * customers; this test catches that before it reaches production.
 *
 * Checks:
 *   1. The hero price badge on the course detail page shows "$150" (or "From $150")
 *   2. The BookingForm header "Starting at" price shows "$150"
 *   3. The booking panel package list includes "Standard Course" at "$150"
 *   4. No "Advanced Package" option appears in the booking panel
 *
 * No authentication is required — this is a public page on the Corsair website.
 */

import { test, expect } from "@playwright/test";

const COURSE_URL = "/courses/defensive-shooting-skills";

test.describe("Defensive Shooting Skills — pricing regression guard", () => {
  test('hero badge shows the $150 price', async ({ page }) => {
    await page.goto(COURSE_URL);

    // The hero section renders a price badge containing either "$150" (when
    // the Square catalog item is resolved) or "From $150" (fallback from
    // course.price). Both pass; what must NOT appear is any other amount.
    const priceBadge = page.locator('span', { hasText: /\$150/ }).first();
    await expect(priceBadge).toBeVisible();
  });

  test('BookingForm header shows "$150" as the starting price', async ({ page }) => {
    await page.goto(COURSE_URL);

    // The BookingForm header renders:
    //   course.pricingOptions[0]?.priceLabel ?? `$${course.pricingOptions[0]?.price}`
    // For dss-standard (price: 150, no priceLabel) this resolves to "$150".
    // It appears as the large red figure under "Starting at" in the panel header.
    const bookingHeader = page.locator('[class*="bg-gradient-to-r"]').filter({
      has: page.locator('text=$150'),
    });
    await expect(bookingHeader).toBeVisible();
  });

  test('booking panel package list shows "Standard Course — $150"', async ({ page }) => {
    await page.goto(COURSE_URL);

    // Step 1 of the BookingForm renders one radio option per pricingOption.
    // The option name and price are rendered side-by-side inside a <label>.
    const standardOption = page.locator('label', {
      hasText: /Standard Course/,
    });
    await expect(standardOption).toBeVisible();
    await expect(standardOption).toContainText('$150');
  });

  test('booking panel does NOT show an "Advanced Package" option', async ({ page }) => {
    await page.goto(COURSE_URL);

    // Defensive Shooting Skills has exactly one pricing option (Standard Course).
    // If a bad merge introduces an "Advanced Package" copied from another course,
    // this assertion fails and the regression is caught before customers see it.
    const advancedPackage = page.locator('text=Advanced Package');
    await expect(advancedPackage).toHaveCount(0);
  });
});
