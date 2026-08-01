/**
 * Playwright config — Client Website Integration E2E Suite
 *
 * This suite is reserved for end-to-end tests that run against an external
 * client website served by its own dev server.  No client website is bundled
 * inside the FSTS-WOS™ platform repo; tests are skipped gracefully when no
 * baseURL is reachable.
 *
 * To run against a local client dev server:
 *   CLIENT_E2E_BASE_URL=http://localhost:3000 pnpm run test:corsair-e2e
 */
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

const baseURL = process.env.CLIENT_E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: resolveChromiumPath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  // No webServer: client website must be running externally before tests start.
  // The CI job for client-specific E2E testing starts the client dev server
  // separately and passes its URL via CLIENT_E2E_BASE_URL.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
