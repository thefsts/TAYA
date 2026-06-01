import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, existsSync } from "fs";
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

function warnMissingBaselines(names: string[]): void {
  const snapshotDir = resolve(
    __dirname,
    "../snapshots/mockup.spec.ts-snapshots"
  );

  const existingFiles = existsSync(snapshotDir)
    ? readdirSync(snapshotDir)
    : [];

  const hasBaseline = (snapshotName: string): boolean =>
    existingFiles.some((f) => f.startsWith(`${snapshotName}-`));

  const missing: string[] = [];

  if (!hasBaseline("gallery")) {
    missing.push("gallery (root page)");
  }

  for (const name of names) {
    if (!hasBaseline(name)) {
      missing.push(`${name} mockup`);
    }
  }

  if (missing.length > 0) {
    const list = missing.map((m) => `  • ${m}`).join("\n");
    console.warn(
      `\n⚠  No visual baseline found for the following mockup(s):\n${list}\n` +
        `   The test(s) above will fail until you generate baselines.\n` +
        `   Run:  pnpm run test:visual:update\n`
    );
  }
}

const mockupNames = discoverMockupNames();

if (mockupNames.length === 0) {
  throw new Error(
    "discoverMockupNames() returned no components — check that " +
      "artifacts/mockup-sandbox/src/.generated/mockup-components.ts exists and is non-empty."
  );
}

warnMissingBaselines(mockupNames);

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
