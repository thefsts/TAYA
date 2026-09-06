/**
 * P5 — Public / Unauthenticated Production Audit (REAL CLICKS)
 *
 * Drives a real Chromium against live production surfaces with real user
 * interactions (clicks, form fills, submissions) and records:
 *   - page console errors, page errors, and failed network requests (404/5xx)
 *   - dead buttons / links (clicks that produce no navigation, no UI change)
 *   - working vs broken flows end-to-end
 *
 * Surfaces covered:
 *   A. Auth URLs (sign-in, sign-up, sso-callback) — Clerk card render
 *   B. Marketing site (fstsclientsystem.com) — nav links, login click-through
 *   C. App SPA unauth guards (/, /app, deep links) — redirect behavior
 *   D. Public HTTP endpoints (uncommon-cobra-336.convex.site) — CORS + 200s
 *   E. Live client websites — corsairtacticalsolution.com (nav, contact form submit)
 *      + portal registration/login/dashboard/logout on app.fstsclientsystem.com
 *   F. Public Form Builder route (if any published form exists)
 *
 * Artifacts:
 *   /workspace/outputs/p5-public-audit/shots/*.png      (screenshots)
 *   /workspace/outputs/p5-public-audit/findings.json    (structured findings)
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const OUT = "/workspace/outputs/p5-public-audit";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });

const APP = "https://app.fstsclientsystem.com";
const MARKETING = "https://fstsclientsystem.com";
const CORSAIR = "https://www.corsairtacticalsolution.com";
const CONVEX_SITE = "https://uncommon-cobra-336.convex.site";

const CONSOLE_ERRORS = [];
const NETWORK_4XX_5XX = [];
const FINDINGS = [];

function record(severity, area, action, expected, observed, pass) {
  const f = { severity, area, action, expected, observed, pass, at: new Date().toISOString() };
  FINDINGS.push(f);
  console.log(`${pass ? "PASS" : severity} | ${area} | ${action} | ${observed}`);
}

async function attachErrorListeners(page, tag) {
  page.on("console", (m) => {
    if (m.type() === "error") CONSOLE_ERRORS.push({ tag, text: m.text().slice(0, 500) });
  });
  page.on("pageerror", (e) => CONSOLE_ERRORS.push({ tag, text: `PAGEERROR: ${e.message.slice(0, 500)}` }));
  page.on("requestfailed", (r) => {
    const failure = r.failure()?.errorText || "";
    if (!/ERR_ABORTED/.test(failure))
      NETWORK_4XX_5XX.push({ tag, url: r.url().slice(0, 200), failure });
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/\.(png|jpg|jpeg|svg|ico|webp|woff2?|map|css|js)(\?|$)/.test(r.url())) {
      NETWORK_4XX_5XX.push({ tag, url: r.url().slice(0, 200), status: r.status() });
    }
  });
}

const browser = await chromium.launch({
  executablePath: "/root/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function freshPage(tag, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await attachErrorListeners(page, tag);
  return { ctx, page };
}

/* ════════════════════════════════════════════════════════════════════
   A. AUTH URLS — real Clerk card render + form presence
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ A. AUTH URLS ═══");
{
  const { ctx, page } = await freshPage("auth");
  try {
    // A1: /sign-in renders skinned Clerk card with live inputs
    await page.goto(`${APP}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const cardOk = await page
      .waitForSelector(".cl-cardBox input, .cl-cardBox .cl-formButtonPrimary", { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    record("info", "auth", "render /sign-in", "Clerk card in .cl-cardBox", cardOk ? "Clerk card rendered with live input/button" : "NO Clerk card", cardOk);
    await page.screenshot({ path: `${SHOTS}/A1-signin.png`, fullPage: false });

    // A2: real typing into Clerk email field (verify field is interactive)
    const emailInput = page.locator(".cl-cardBox input").first();
    let typingOk = false;
    if (cardOk && (await emailInput.count()) > 0) {
      try {
        await emailInput.fill("qa-p5-audit@fstsclientsystem.test");
        typingOk = (await emailInput.inputValue()) === "qa-p5-audit@fstsclientsystem.test";
      } catch {}
    }
    record("info", "auth", "type into Clerk email input", "field accepts typed text", typingOk ? "field interactive, value accepted" : "field NOT interactive", typingOk);

    // A3: real click on Continue button → Clerk responds (validation or next step)
    const continueBtn = page.locator(".cl-cardBox button.cl-formButtonPrimary").first();
    let continueOk = false, continueNote = "continue button not found";
    if (cardOk && (await continueBtn.count()) > 0) {
      const before = page.url();
      try {
        await continueBtn.click({ timeout: 10000 });
        await page.waitForTimeout(3500);
        const urlChanged = page.url() !== before;
        // Clerk shows either factor selection, validation error, or stays
        const errVisible = await page.locator(".cl-cardBox .cl-formFieldErrorText, .cl-cardBox [role='alert']").count();
        const factorChoices = await page.locator(".cl-cardBox button:has-text('password'), .cl-cardBox input[type='password']").count();
        const algoFallback = await page.locator(".cl-cardBox .cl-alternative").count();
        continueOk = urlChanged || errVisible > 0 || factorChoices > 0 || algoFallback > 0;
        continueNote = `urlChanged=${urlChanged} errVisible=${errVisible} factorChoices=${factorChoices} alt=${algoFallback}`;
      } catch (e) {
        continueNote = `click failed: ${e.message.slice(0, 120)}`;
      }
    }
    record("info", "auth", "click Continue on sign-in", "Clerk responds (factor/step/validation)", `${continueNote}`, continueOk);

    // A4: /sign-up renders
    await page.goto(`${APP}/sign-up`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const signUpOk = await page
      .waitForSelector(".cl-cardBox input", { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    record("info", "auth", "render /sign-up", "Clerk card", signUpOk ? "sign-up card rendered" : "NO sign-up card", signUpOk);
    await page.screenshot({ path: `${SHOTS}/A4-signup.png` });

    // A5: /sign-up real submit with invalid short password → validation message
    if (signUpOk) {
      try {
        await page.goto(`${APP}/sign-up`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector(".cl-cardBox input", { timeout: 20000 });
        const inputs = page.locator(".cl-cardBox input");
        const n = await inputs.count();
        // fill every visible text/email/password field with a too-short password
        for (let i = 0; i < n; i++) {
          const el = inputs.nth(i);
          const type = await el.getAttribute("type");
          if (type === "checkbox") continue;
          await el.fill(type === "email" ? "qa-p5-audit@fstsclientsystem.test" : "shortpw");
        }
        const btn = page.locator(".cl-cardBox button.cl-formButtonPrimary").first();
        if ((await btn.count()) > 0) await btn.click();
        await page.waitForTimeout(3500);
        const errCount = await page.locator(".cl-cardBox .cl-formFieldErrorText, .cl-cardBox [role='alert']").count();
        record("info", "auth", "sign-up invalid submit", "client-side validation message appears", `error elements=${errCount}`, errCount > 0);
      } catch (e) {
        record("medium", "auth", "sign-up invalid submit", "validation message", `exception: ${e.message.slice(0, 120)}`, false);
      }
    }

    // A6: sso-callback renders (should be a silent/redirect page, no crash)
    const ssoResp = await page.goto(`${APP}/sso-callback?is_native=true`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    record("info", "auth", "render /sso-callback", "page loads without crash", `status=${ssoResp ? ssoResp.status() : "nav-error"}`, !!ssoResp);

    // A7: 404 page renders NotFound (not blank/white screen)
    await page.goto(`${APP}/this-route-does-not-exist-p5`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const notFoundText = await page.locator("text=/404|not found|Not Found/i").count();
    const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
    record("info", "auth", "render unknown route -> 404 page", "NotFound with message, not blank", `match404=${notFoundText} bodyLen=${bodyText.length}`, notFoundText > 0 && bodyText.length > 10);
    await page.screenshot({ path: `${SHOTS}/A7-404.png` });

    // A8: root / redirects signed-out users to Landing (no crash)
    await page.goto(`${APP}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const rootText = (await page.locator("body").innerText().catch(() => "")).trim();
    record("info", "auth", "render / (signed out)", "Landing or sign-in prompt, no crash", `bodyLen=${rootText.length}`, rootText.length > 50);
    await page.screenshot({ path: `${SHOTS}/A8-root.png` });
  } finally {
    await ctx.close();
  }
}

/* ═════════════════════════════════════════════════════════ %%═
   B. MARKETING SITE — nav + login click-through (fixed in PR #29)
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ B. MARKETING SITE ═══");
{
  const { ctx, page } = await freshPage("marketing");
  try {
    await page.goto(MARKETING, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000); // SPA hydrate

    // B1: hero renders
    const heroText = await page.locator("body").innerText().catch(() => "");
    record("info", "marketing", "render landing", "hero copy visible", `textLen=${heroText.length}`, heroText.length > 200);
    await page.screenshot({ path: `${SHOTS}/B1-marketing-landing.png` });

    // B2: all anchor links are live (no 404s among internal links) — real click on Login
    const loginLink = page.locator("a:has-text('Login'), a:has-text('login'), button:has-text('Login'), button:has-text('login')").first();
    if ((await loginLink.count()) > 0) {
      const href = await loginLink.getAttribute("href").catch(() => null);
      let clickOk = false, note = "";
      try {
        const popupWait = page.waitForEvent("popup", { timeout: 4000 }).catch(() => null);
        await loginLink.click({ timeout: 8000 });
        const popup = await popupWait;
        if (popup) {
          await popup.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
          note = `popup-> ${popup.url()} — landed on D8 sign-in`;
          clickOk = /app\.fstsclientsystem\.com\/sign-in/.test(popup.url());
          await popup.screenshot({ path: `${SHOTS}/B2-login-click-popup.png` }).catch(() => {});
          await popup.close();
        } else {
          await page.waitForTimeout(2500);
          note = `same-tab -> ${page.url()}`;
          clickOk = /app\.fstsclientsystem\.com\/sign-in/.test(page.url());
          await page.screenshot({ path: `${SHOTS}/B2-login-click.png` });
        }
      } catch (e) {
        note = `click failed: ${e.message.slice(0, 120)}`;
      }
      record("medium", "marketing", "click Login", "lands on app.fstsclientsystem.com/sign-in", note, clickOk);
    } else {
      record("high", "marketing", "click Login", "Login control must exist", "no Login link/button found on landing", false);
    }

    // B3: crawl every internal link on landing for dead links (real navigations)
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).filter(Boolean)
    );
    const internal = hrefs.filter((h) => h.startsWith("/") || h.includes("fstsclientsystem"));
    const unique = [...new Set(internal)];
    let deadLinks = [];
    for (const h of unique.slice(0, 25)) {
      const abs = h.startsWith("http") ? h : `${MARKETING}${h}`;
      const r = await page.request.get(abs, { maxRedirects: 5, timeout: 20000 }).catch(() => null);
      if (!r || r.status() >= 400) deadLinks.push({ href: h, status: r ? r.status() : "ERR" });
    }
    record(
      "medium", "marketing", "crawl all landing links", "all internal links resolve",
      `${unique.length} unique internal links, dead: ${deadLinks.length ? JSON.stringify(deadLinks) : "none"}`,
      deadLinks.length === 0
    );
  } finally {
    await ctx.close();
  }
}

/* ════════════════════════════════════════════════════════════════════
   C. APP SPA UNAUTH GUARDS — deep links redirect correctly
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ C. APP SPA GUARDS ═══");
{
  const { ctx, page } = await freshPage("guards");
  try {
    const guards = [
      "/app",
      "/app/sites/qd7cpjk68m0z4rme5hw4sqgeys8bk1zc",
      "/app/sites/qd7cpjk68m0z4rme5hw4sqgeys8bk1zc/settings",
      "/app/sites/qd7cpjk68m0z4rme5hw4sqgeys8bk1zc/pages",
      "/app/admin/users",
      "/app/admin/sites",
      "/app/admin/platform-controls",
      "/app/admin/design-lock",
      "/app/onboard",
    ];
    for (const path of guards) {
      await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(4000); // allow Clerk redirect cycle
      const url = page.url();
      const text = (await page.locator("body").innerText().catch(() => "")).trim();
      const protectedOk =
        /accounts\.app\.fstsclientsystem\.com|\/sign-in/.test(url) ||
        /sign in|sign-in|log in|log in to/i.test(text) || text.length < 200;
      record("medium", "guards", `deep link ${path}`, "redirects to sign-in (no data leak)", `final=${url.replace(APP, "")} textLen=${text.length}`, protectedOk);
      if (path === guards[1]) await page.screenshot({ path: `${SHOTS}/C-guard-site.png` });
    }
  } finally {
    await ctx.close();
  }
}

/* ═══════════════════════════ flow, Corsair portal
   D. PUBLIC HTTP ENDPOINTS — CORS + status codes + payloads
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ D. PUBLIC ENDPOINTS ═══");
{
  const { ctx, page } = await freshPage("endpoints");
  try {
    const corsairSlug = "corsair-tactical-solutions";
    const fstsSlug = "httpswwwfstacktsolutionscom";
    const GETS = [
      ["site", "site"], ["homepage", "homepage"], ["footer", "footer"],
      ["contact", "contact"], ["events", "events"], ["courses", "courses"],
      ["articles", "articles"], ["seo", "seo"], ["media", "media"],
      ["faqs", "faqs"], ["testimonials", "testimonials"], ["pricing", "pricing"],
      ["navigation", "navigation"], ["announcement", "announcement"], ["cta", "cta"],
      ["team", "team"], ["downloads", "downloads"], ["jobs", "jobs"],
      ["popup", "popup"], ["policy", "policy"], ["reviews", "reviews"],
      ["products", "products"], ["services", "services"],
    ];
    // NOTE: /api/public/form is intentionally EXCLUDED from the blanket 200
    // sweep. It is a form-detail endpoint requiring BOTH ?slug= and ?form=
    // params and only returns 200 when that specific form is published; with
    // no published forms in production, a 404 "form not found or not
    // published" is CORRECT behavior, not a dead endpoint.
    let passCount = 0, failList = [];
    for (const [label, ep] of GETS) {
      for (const slug of [corsairSlug, fstsSlug]) {
        const r = await page.request.get(`${CONVEX_SITE}/api/public/${ep}?slug=${slug}`, { timeout: 20000 }).catch(() => null);
        if (r && r.status() === 200) {
          passCount++;
        } else {
          failList.push(`${ep}/${slug}:${r ? r.status() : "ERR"}`);
        }
      }
    }
    // Form endpoint contract check (correct-cleanup, not blanket-200):
    // missing form param and unknown form must both be clean 404 JSON.
    const formNoParam = await page.request.get(`${CONVEX_SITE}/api/public/form?slug=${corsairSlug}`, { timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "GET form without form param", "clean 404 (endpoint requires ?form=)", `status=${formNoParam?.status() ?? "ERR"}`, formNoParam?.status() === 404);
    const formBadForm = await page.request.get(`${CONVEX_SITE}/api/public/form?slug=${corsairSlug}&form=does-not-exist`, { timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "GET form unknown form", "clean 404 (no published form with that slug)", `status=${formBadForm?.status() ?? "ERR"}`, formBadForm?.status() === 404);
    record("high", "endpoints", "public GET endpoints x 2 sites", "all 200", `${passCount}/${GETS.length * 2} ok; failures: ${failList.join(", ") || "none"}`, failList.length === 0);

    // D2: CORS preflight (browser-usable)
    const pre = await page.request.fetch(`${CONVEX_SITE}/api/public/homepage?slug=${corsairSlug}`, { method: "OPTIONS", timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "OPTIONS preflight", "204/200 + CORS headers", `status=${pre?.status() ?? "ERR"} allow-origin=${pre?.headers()["access-control-allow-origin"] ?? "none"}`, pre && pre.status() < 300 && !!pre.headers()["access-control-allow-origin"]);

    // D3: bad slug → 404 (not 500, not leak)
    const bad = await page.request.get(`${CONVEX_SITE}/api/public/site?slug=no-such-site-xyz`, { timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "GET site bad-slug", "404 not found", `status=${bad?.status() ?? "ERR"}`, bad?.status() === 404);

    // D4: submit without slug/formType → 400 (validation works)
    const badSub = await page.request.post(`${CONVEX_SITE}/api/public/submit`, { data: { name: "x" }, headers: { "content-type": "application/json" }, timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "POST submit missing fields", "400", `status=${badSub?.status() ?? "ERR"}`, badSub?.status() === 400);

    // D5: submit with non-existent slug → controlled failure
    const badSub2 = await page.request.post(`${CONVEX_SITE}/api/public/submit`, { data: { slug: "no-such-site-xyz", formType: "contact", name: "a", email: "b@c.co" }, headers: { "content-type": "application/json" }, timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "POST submit bad slug", "controlled 4xx/5xx w/ json error", `status=${badSub2?.status() ?? "ERR"}`, !!badSub2 && badSub2.status() >= 400 && badSub2.status() < 500);

    // D6: REAL contact-form submission to Corsair (then cleaned up later)
    const stamp = Date.now();
    const realSub = await page.request.post(`${CONVEX_SITE}/api/public/submit`, {
      data: {
        slug: corsairSlug, formType: "contact",
        name: "TAYA P5 Audit (delete me)", email: "p5-audit@fstsclientsystem.test",
        phone: "555-0100", message: `P5 public audit real submission ${stamp}`,
      },
      headers: { "content-type": "application/json" },
      timeout: 20000,
    }).catch(() => null);
    let subId = null;
    try { subId = (await realSub.json())?.data?.id ?? (await realSub.json())?.id; } catch {}
    record("high", "endpoints", "REAL POST contact submit (Corsair)", "200 + id, submission stored", `status=${realSub?.status() ?? "ERR"} id=${subId}`, realSub?.status() === 200 && !!subId);
    writeFileSync(`${OUT}/contact-submission-id.txt`, String(subId ?? "null"));

    // D7: OPTIONS on submit
    const pre2 = await page.request.fetch(`${CONVEX_SITE}/api/public/submit`, { method: "OPTIONS", timeout: 15000 }).catch(() => null);
    record("medium", "endpoints", "OPTIONS submit preflight", "2xx + CORS", `status=${pre2?.status() ?? "ERR"}`, !!pre2 && pre2.status() < 300);
  } finally {
    await ctx.close();
  }
}

/* ════════════════════════════════════════════════════════════════════
   E1. LIVE CLIENT WEBSITE (Corsair) — nav pages + REAL contact form
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ E1. LIVE CORSAIR SITE ═══");
{
  const { ctx, page } = await freshPage("corsair-site");
  try {
    // E1a: every nav page loads + hero copy
    const pagesToHit = ["/", "/about", "/security-services", "/security-training", "/courses", "/events", "/blog", "/contact", "/faq", "/instructors", "/private-investigations", "/church-safety", "/security-assessments", "/property-manager-services", "/legal-compliance"];
    let okPages = 0, badPages = [];
    for (const p of pagesToHit) {
      const r = await page.goto(`${CORSAIR}${p}`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
      if (r && r.status() === 200) okPages++;
      else badPages.push(`${p}:${r ? r.status() : "ERR"}`);
    }
    record("high", "corsair-site", "15 nav pages load", "all 200", `${okPages}/15; bad: ${badPages.join(",") || "none"}`, okPages === 15);
    await page.screenshot({ path: `${SHOTS}/E1-corsair-home.png` });

    // E1b: REAL contact form submission through the actual UI
    await page.goto(`${CORSAIR}/contact`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    const nameIn = page.locator("input[placeholder='Name']").first();
    if ((await nameIn.count()) > 0) {
      await nameIn.fill("TAYA P5 Audit");
      await page.locator("input[placeholder='Phone']").first().fill("555-0100");
      await page.locator("input[placeholder='Email']").first().fill("p5-audit@fstsclientsystem.test");
      await page.locator("textarea[placeholder='Message']").first().fill(`Real UI contact submission P5 audit ${Date.now()}. Safe to delete.`);
      const consent = page.locator("input[type='checkbox']").first();
      if ((await consent.count()) > 0) await consent.check();
      const sendBtn = page.locator("button:has-text('Send'), button:has-text('Send Message'), button:has-text('Submit'), button:has-text('send')").first();
      let sentOk = false, note = "";
      if ((await sendBtn.count()) > 0) {
        await sendBtn.click({ timeout: 10000 });
        await page.waitForTimeout(5000);
        const confirm = await page.locator("text=/thank you|Thank You|received|success|submitted|We'll get back|We will get back/i").count();
        const bodyTxt = await page.locator("body").innerText().catch(() => "");
        sentOk = confirm > 0 || /thank you|received|success|submitted|get back/i.test(bodyTxt);
        note = `confirmMsg=${confirm} bodyMatch=${/thank you|received|success|submitted|get back/i.test(bodyTxt)}`;
      } else note = "no Send button found";
      record("high", "corsair-site", "REAL contact form submit via UI", "confirmation shown to visitor", note, sentOk);
      await page.screenshot({ path: `${SHOTS}/E1b-contact-after.png` });
    } else {
      record("high", "corsair-site", "REAL contact form submit via UI", "form fields present", "Name input not found on /contact", false);
    }

    // E1c: portal link / login link on live site (if present)
    await page.goto(`${CORSAIR}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    const portalLink = page.locator("a:has-text('Portal'), a:has-text('portal'), a[href*='portal']").first();
    if ((await portalLink.count()) > 0) {
      const href = await portalLink.getAttribute("href");
      record("info", "corsair-site", "portal link present", "links to app portal", `href=${href}`, true);
    } else {
      record("info", "corsair-site", "portal link present", "optional", "no portal link on homepage nav (info only)", true);
    }
  } finally {
    await ctx.close();
  }
}

/* ════════════════════════════════════════════════════════════════════
   E2. CLIENT PORTAL FLOW (real register → dashboard → clicks → logout)
   ════════════════════════════════════════════════════════════════════ */
console.log("\n═══ E2. PORTAL FLOW ═══");
const portalUserId = { id: null };
{
  const { ctx, page } = await freshPage("portal");
  try {
    const slug = "corsair-tactical-solutions";
    // E2a: portal login page renders
    await page.goto(`${APP}/portal/${slug}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    const loginCard = await page.locator("input[type='email']").count();
    record("medium", "portal", "render portal login", "email+password form", `emailInputs=${loginCard}`, loginCard > 0);
    await page.screenshot({ path: `${SHOTS}/E2a-portal-login.png` });

    // E2b: REAL login attempt with unknown user → friendly error (no lockout side effect: user doesn't exist)
    if (loginCard > 0) {
      await page.locator("input[type='email']").first().fill("no-such-user@fstsclientsystem.test");
      await page.locator("input[type='password']").first().fill("SomePassword12345");
      await page.locator("button[type='submit']").first().click({ timeout: 10000 });
      await page.waitForTimeout(4000);
      const errText = (await page.locator("body").innerText().catch(() => ""));
      const friendlyErr = /invalid email or password|not found|invalid|incorrect|no account/i.test(errText);
      record("medium", "portal", "portal login bad user", "friendly error, no crash", `friendlyErr=${friendlyErr} url=${page.url().includes("/login") ? "stayed on login" : page.url()}`, friendlyErr);
      await page.screenshot({ path: `${SHOTS}/E2b-portal-bad-login.png` });
    }

    // E2c: portal register page renders
    await page.goto(`${APP}/portal/${slug}/register`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    const regFields = await page.locator("#firstName, #lastName, input[type='email']").count();
    record("medium", "portal", "render portal register", "first/last/email/password fields", `fields=${regFields}`, regFields >= 3);
    await page.screenshot({ path: `${SHOTS}/E2c-portal-register.png` });

    // E2d: REAL registration (creates portal member — cleanup recorded for deletion)
    if (regFields >= 3) {
      const stamp = Date.now();
      const TEST_EMAIL = `p5-audit-${stamp}@fstsclientsystem.test`;
      const TEST_PW = "P5AuditPortal12345";
      writeFileSync(`${OUT}/portal-test-user.txt`, JSON.stringify({ email: TEST_EMAIL, password: TEST_PW, slug }));
      await page.locator("#firstName").first().fill("P5");
      await page.locator("#lastName").first().fill("Audit");
      await page.locator("input[type='email']").first().fill(TEST_EMAIL);
      await page.locator("input[type='password']").first().fill(TEST_PW);
      const pwFields = page.locator("input[type='password']");
      if ((await pwFields.count()) > 1) await pwFields.nth(1).fill(TEST_PW);
      await page.locator("button[type='submit']").first().click({ timeout: 10000 });
      await page.waitForTimeout(6000);
      const onDash = /\/portal\/[^/]+\/dashboard/.test(page.url());
      record("high", "portal", "REAL portal registration + auto-login", "lands on member dashboard", `url=${page.url()}`, onDash);
      await page.screenshot({ path: `${SHOTS}/E2d-portal-dashboard.png`, fullPage: true });

      if (onDash) {
        // E2e: dashboard content — does member see anything?
        const bodyTxt = (await page.locator("body").innerText().catch(() => "")).trim();
        const featureCards = await page.locator("text=/My Courses|My Events|Secure Documents|Messages|Certificates|Invoices/i").count();
        const emptyState = /contact your administrator|Your Portal/i.test(bodyTxt);
        record("high", "portal", "portal dashboard features render", "enabled feature cards visible", `featureCards=${featureCards} emptyState=${emptyState}`, featureCards > 0);

        // E2f: REAL CLICKS on every sidebar NavLink — dead or live?
        const deadNavLinks = [];
        for (const label of ["My Profile", "Account Settings", "Dashboard"]) {
          const nl = page.locator(`aside >> text=${JSON.stringify(label)}`).first();
          if ((await nl.count()) > 0) {
            // Sectioned dashboards switch panels IN PLACE (no URL change), so
            // record both URL and visible content before/after each click.
            const beforeUrl = page.url();
            const beforeTxt = (await page.locator("main, [role=main], body").first().innerText().catch(() => "")).trim();
            try { await nl.click({ timeout: 6000 }); } catch {}
            await page.waitForTimeout(1200);
            const afterUrl = page.url();
            const afterTxt = (await page.locator("main, [role=main], body").first().innerText().catch(() => "")).trim();
            const urlChanged = beforeUrl !== afterUrl;
            const uiChanged = beforeTxt !== afterTxt;
            // A live click produces navigation OR a visible panel change; a
            // dead element produces neither.
            if (!urlChanged && !uiChanged) deadNavLinks.push(label);
          }
        }
        record("high", "portal", "click sidebar NavLinks (Profile/Settings/Dashboard)", "each click navigates or switches panel", deadNavLinks.length ? `DEAD: ${deadNavLinks.join(", ")} (clicks produce no navigation or panel change)` : "all clicked links navigated or switched panels", deadNavLinks.length === 0);

        // E2g: REAL click Sign out → returns to login
        const signOut = page.locator("aside >> button:has-text('Sign out')").first();
        let outOk = false, outNote = "";
        if ((await signOut.count()) > 0) {
          const before = page.url();
          await signOut.click({ timeout: 8000 });
          await page.waitForTimeout(4000);
          const after = page.url();
          outOk = /\/login/.test(after) || before !== after;
          outNote = `before=${before.replace(APP, "")} after=${after.replace(APP, "")}`;
        } else outNote = "Sign out button not found";
        record("high", "portal", "REAL Sign out click", "session cleared, back to login", outNote, outOk);
        await page.screenshot({ path: `${SHOTS}/E2g-portal-logout.png` });

        // E2h: session truly dead — dashboard no longer accessible
        await page.goto(`${APP}/portal/${slug}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(4000);
        const backToLogin = /\/login/.test(page.url());
        record("high", "portal", "dashboard after logout", "redirects to login (session invalidated)", `url=${page.url().replace(APP, "")}`, backToLogin);

        // E2i: REAL login with the just-created account (round-trip login)
        await page.locator("input[type='email']").first().fill(TEST_EMAIL);
        await page.locator("input[type='password']").first().fill(TEST_PW);
        await page.locator("button[type='submit']").first().click({ timeout: 10000 });
        await page.waitForTimeout(5000);
        const relog = /\/dashboard/.test(page.url());
        record("high", "portal", "REAL re-login with created account", "back on dashboard", `url=${page.url().replace(APP, "")}`, relog);
        await page.screenshot({ path: `${SHOTS}/E2i-portal-relogin.png` });
      }
    }
  } finally {
    await ctx.close();
  }
}

/* ════════════════════════════════════════════════════════════════════
   SUMMARY + artifacts
   ════════════════════════════════════════════════════════════════════ */
await browser.close();

const summary = {
  at: new Date().toISOString(),
  totals: {
    checks: FINDINGS.length,
    passed: FINDINGS.filter((f) => f.pass).length,
    failed: FINDINGS.filter((f) => !f.pass).length,
  },
  consoleErrors: CONSOLE_ERRORS,
  networkErrors: NETWORK_4XX_5XX,
  findings: FINDINGS,
};
writeFileSync(`${OUT}/findings.json`, JSON.stringify(summary, null, 2));
console.log(`\n═══════ P5 PUBLIC AUDIT SUMMARY ═══════`);
console.log(`checks=${summary.totals.checks} passed=${summary.totals.passed} failed=${summary.totals.failed}`);
console.log(`consoleErrors=${CONSOLE_ERRORS.length} networkErrors=${NETWORK_4XX_5XX.length}`);
if (FINDINGS.filter((f) => !f.pass).length) {
  console.log(`\nFAILED CHECKS:`);
  for (const f of FINDINGS.filter((f) => !f.pass)) console.log(`  [${f.severity}] ${f.area} :: ${f.action} :: ${f.observed}`);
}
if (CONSOLE_ERRORS.length) {
  console.log(`\nCONSOLE ERRORS (dedup):`);
  const seen = new Set();
  for (const e of CONSOLE_ERRORS) {
    const k = e.text.slice(0, 80);
    if (!seen.has(k)) { seen.add(k); console.log(`  [${e.tag}] ${e.text.slice(0, 220)}`); }
  }
}
