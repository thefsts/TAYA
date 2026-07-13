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
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:80",
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: resolveChromiumPath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
