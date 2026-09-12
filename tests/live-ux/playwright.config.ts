/**
 * playwright.config.ts — Chat B live UX proof (§5).
 *
 * Drives the REAL client experience end-to-end in a real Chromium:
 *   dashboard  https://127.0.0.1:4173   (REAL VisualEditor driver page)
 *   convex     https://127.0.0.1:7788   (bridge/frame API mirroring convex/http.ts)
 *   site       https://127.0.0.1:4175   (real test-site HTML + REAL bridge snippet)
 *
 * The 15 mandatory flows run against REAL RENDERED PAGES — clicking real
 * headings/paragraphs/images/buttons inside the editor iframe, adding
 * video/PDF/text blocks, Save Draft → Preview → Publish → reload →
 * History/Restore, and tenant isolation.
 *
 * Harness notes:
 *  - Self-signed certs: ignoreHTTPSErrors + NODE_EXTRA_CA_CERTS (the site
 *    origin's bridge snippet must also fetch convex cross-origin).
 *  - webServer boots the harness (or reuses one already running — the
 *    earlier probes keep a harness up; reuse keeps boot deterministic).
 *  - Bundles (dist/pipeline.mjs, dist/store.mjs, dist/parent.js) are the
 *    REAL production code, built by `npm run bundle` (package.json test).
 *  - Chromium: system-installed headless shell used by the earlier probes
 *    (chromium-1217), no-sandbox flags required inside the container.
 */
import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = __dirname; // tests/live-ux (certs/cert.pem lives here)
const CERT = join(ROOT, "certs", "cert.pem");

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "evidence/report", open: "never" }]],
  use: {
    baseURL: "https://127.0.0.1:4173",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    contextOptions: {
      // 1440×900 — the client's desktop working view (§6 responsive runs
      // separate viewport assertions inside the specs).
      viewport: { width: 1440, height: 900 },
    },
    launchOptions: {
      executablePath: "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-certificate-errors",
      ],
    },
  },
  webServer: {
    command: "node harness/runtime.mjs",
    url: "https://127.0.0.1:4173/harness/state",
    cwd: join(__dirname),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Node fetch from the harness (and Playwright's webServer probe) must
      // trust the self-signed cert — same requirement as the probes.
      NODE_EXTRA_CA_CERTS: existsSync(CERT) ? CERT : "",
    },
    ignoreHTTPSErrors: true,
  },
});
