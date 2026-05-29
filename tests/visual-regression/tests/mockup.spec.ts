import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = "/__mockup";

async function waitForNetwork(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
}

function discoverMockupNames(): string[] {
  const filePath = resolve(
    __dirname,
    "../../../artifacts/mockup-sandbox/src/.generated/mockup-components.ts"
  );
  const content = readFileSync(filePath, "utf8");
  const names: string[] = [];
  const regex = /"\.\/components\/mockups\/([^"]+)\.tsx"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

const mockupNames = discoverMockupNames();

if (mockupNames.length === 0) {
  throw new Error(
    "discoverMockupNames() returned no components — check that " +
      "artifacts/mockup-sandbox/src/.generated/mockup-components.ts exists and is non-empty."
  );
}

test.describe("mockup-sandbox visual regression", () => {
  test("gallery root page", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await waitForNetwork(page);
    await expect(page).toHaveScreenshot("gallery.png", { fullPage: true });
  });

  for (const name of mockupNames) {
    test(`${name} mockup`, async ({ page }) => {
      await page.goto(`${BASE}/preview/${name}`);
      await waitForNetwork(page);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
  }
});
