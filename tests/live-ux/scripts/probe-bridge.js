// Probe the SITE origin like a real visitor: the REAL bridge snippet must
// fetch /api/bridge/content cross-origin (CORS *) and apply published values,
// and ?taya_preview=<token> must overlay DRAFT values (flow 11 evidence).
const pw = require("/workspace/repo/tests/e2e/node_modules/@playwright/test");
const fs = require("node:fs");

const CHROME = "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome";

(async () => {
  const browser = await pw.chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors"],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // 1. Plain visit — snippet applies PUBLISHED values, fires taya:bridge-ready.
  const events = [];
  await page.goto("https://127.0.0.1:4175/", { waitUntil: "load", timeout: 20000 });
  await page.exposeFunction("__noop", () => {});
  const ready = await page.evaluate(() => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      document.addEventListener("taya:bridge-ready", (e) => finish(`ready:${JSON.stringify(e.detail)}`), { once: true });
      // snippet may already have run before we listened
      if (window.__tayaAppliedCount !== undefined) finish(`applied:${window.__tayaAppliedCount}`);
      setTimeout(() => finish(document.querySelector('[data-taya-edit="home.hero.heading"]')?.textContent ?? "TIMEOUT"), 4000);
    });
  });
  const heading = await page.textContent('[data-taya-edit="home.hero.heading"]');
  console.log("published heading:", JSON.stringify(heading), "| event:", ready);
  console.log("taya-edit elements on live home:", await page.locator("[data-taya-edit]").count());

  // 2. Draft a value via the harness dispatcher (as Alice), then preview it
  //    on the REAL site origin with the REAL snippet + token.
  const r = await fetch("https://127.0.0.1:4173/harness/api", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "publishing.saveDraft", kind: "mutation",
      args: { siteId: "site_harborview", entries: [{ key: "home.hero.heading", value: "Preview Draft Heading (Alice)" }] },
    }),
  }).then((x) => x.json());
  console.log("saveDraft:", JSON.stringify(r));

  await page.goto("https://127.0.0.1:4175/?taya_preview=a1b2c3d4e5f6a7b8", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1500);
  const draftHeading = await page.textContent('[data-taya-edit="home.hero.heading"]');
  console.log("preview-mode heading:", JSON.stringify(draftHeading));

  // 3. Without the token, the draft must NOT leak (public sees published).
  await page.goto("https://127.0.0.1:4175/", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1200);
  const publicHeading = await page.textContent('[data-taya-edit="home.hero.heading"]');
  console.log("public heading (no token):", JSON.stringify(publicHeading));

  // 4. Wrong token → no draft leak either.
  await page.goto("https://127.0.0.1:4175/?taya_preview=000000000000ffff", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(1200);
  const wrongHeading = await page.textContent('[data-taya-edit="home.hero.heading"]');
  console.log("wrong-token heading:", JSON.stringify(wrongHeading));

  // 5. Reset (leave pristine for the spec).
  await fetch("https://127.0.0.1:4173/harness/reset", { method: "POST" });

  fs.mkdirSync("/workspace/repo/tests/live-ux/evidence", { recursive: true });
  await page.screenshot({ path: "/workspace/repo/tests/live-ux/evidence/probe-bridge-public.png" });
  await browser.close();
  console.log("done");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
