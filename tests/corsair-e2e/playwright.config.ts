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
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: resolveChromiumPath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  webServer: {
    command: "bash -c 'cd /home/runner/workspace/corsair-source && pnpm run dev'",
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
