import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

function resolveChromiumPath(): string {
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath) return envPath;
  try {
    return execSync("which chromium", { encoding: "utf8" }).trim();
  } catch {
    return "chromium";
  }
}

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:80",
    headless: true,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    launchOptions: {
      executablePath: resolveChromiumPath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  snapshotDir: "./snapshots",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
