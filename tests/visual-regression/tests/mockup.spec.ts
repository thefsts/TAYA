import { test, expect } from "@playwright/test";

const BASE = "/__mockup";

async function waitForNetwork(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("mockup-sandbox visual regression", () => {
  test("gallery root page", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await waitForNetwork(page);
    await expect(page).toHaveScreenshot("gallery.png", { fullPage: true });
  });

  test("CoursesListingPage mockup", async ({ page }) => {
    await page.goto(`${BASE}/preview/CoursesListingPage`);
    await waitForNetwork(page);
    await expect(page).toHaveScreenshot("CoursesListingPage.png", {
      fullPage: true,
    });
  });

  test("HomepageCoursesSection mockup", async ({ page }) => {
    await page.goto(`${BASE}/preview/HomepageCoursesSection`);
    await waitForNetwork(page);
    await expect(page).toHaveScreenshot("HomepageCoursesSection.png", {
      fullPage: true,
    });
  });
});
