// Chromium probe: verify the editor body mounts after the wouter Route fix.
// Checks (a) /harness/api calls now carry siteId, (b) iframe present with real
// site content, (c) client-facing copy rendered, (d) no page errors.
const pw = require("/workspace/repo/tests/e2e/node_modules/@playwright/test");
const fs = require("node:fs");

(async () => {
  const browser = await pw.chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors"],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const apiCalls = [];
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/harness/api") || u.includes("/api/editor/frame")) {
      let body = "";
      try { body = r.postData() || ""; } catch {}
      apiCalls.push({ url: u.replace("https://127.0.0.1:4173", ""), body: body.slice(0, 120) });
    }
  });

  await page.goto("https://127.0.0.1:4173/app/sites/site_harborview/editor", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2500);

  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "<evaluate failed>");
  console.log("=== API CALLS ===");
  apiCalls.slice(0, 25).forEach((c) => console.log(`${c.url}  body=${c.body}`));
  console.log("\n=== PAGE ERRORS ===");
  console.log(pageErrors.length ? pageErrors.slice(0, 5).join("\n---\n") : "(none)");
  console.log("\n=== BODY TEXT (first 700 chars) ===");
  console.log(typeof bodyText === "string" ? bodyText.slice(0, 700) : bodyText);

  const frame = page.frames().find((f) => f.url().includes("/api/editor/frame"));
  console.log("\n=== IFRAME ===");
  if (frame) {
    const frameText = await frame.evaluate(() => document.body.innerText).catch((e) => `frame eval failed: ${e}`);
    console.log("frame url:", frame.url());
    console.log("frame text (first 300):", typeof frameText === "string" ? frameText.slice(0, 300) : frameText);
  } else {
    console.log("NO frame found. frame urls:", page.frames().map((f) => f.url()).join(" | "));
  }

  fs.mkdirSync("/workspace/repo/tests/live-ux/evidence", { recursive: true });
  await page.screenshot({ path: "/workspace/repo/tests/live-ux/evidence/probe-route-fix.png", fullPage: false });
  console.log("\nscreenshot: evidence/probe-route-fix.png");
  await browser.close();
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
