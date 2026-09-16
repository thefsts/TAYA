/**
 * owner-acceptance.spec.ts — Chat D PR #58 OWNER PRODUCT ACCEPTANCE.
 *
 * The owner (FSTS founder) is signing off on the CLIENT experience. This
 * spec drives only what a client sees and does, in real Chromium against
 * the harness's three origins (dashboard 4173 / convex 7788 / site 4175):
 *
 *   A3  an ORDINARY section button/link (not the hero) gets a Label +
 *       Destination editor — the §3 companion ".href" key coverage fix.
 *   A5  Page SEO lives in the editor rail ("Search & social settings"):
 *       meta title/description, canonical, noindex, social fields, and
 *       it persists through the EXISTING seoSettings storage.
 *   A6  Site Health on the dashboard (client-visible, not design-locked)
 *       + Analytics (GA4/GTM/Search Console) client-safe for an owner,
 *       and a read_only site member gets the explained view-only card.
 *   A7  Page-coverage spot checks: /services and /faq headline/paragraph/
 *       image/button-link editing + honest classification of anything
 *       that is not editable (FSTS-locked vs no matching zone vs bug).
 *
 * Every assertion is CLIENT language ("Destination", "Meta title",
 * "View-only access") — never engine ids, keys, or zone names.
 */
import { test, expect, type Page, type Frame } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/* ──────────────────────────────────────────── constants ──────────────── */
const DASHBOARD = "https://127.0.0.1:4173";
const SITE_ORIGIN = "https://127.0.0.1:4175";
const CONVEX_ORIGIN = "https://127.0.0.1:7788";
const EDITOR_URL = "/app/sites/site_harborview/editor";
const SETTINGS_URL = "/app/sites/site_harborview/settings";
const DASHBOARD_URL = "/app/sites/site_harborview";
const HEALTH_URL = "/app/sites/site_harborview/health";
const EVIDENCE_DIR = path.join(__dirname, "..", "evidence");

const LOCKED_NOTICE =
  "That part of the page is managed by FSTS. Contact your TAYA representative to make changes.";

/* ─────────── harness control channel (server-side) ───────────────────── */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function setActingUser(userId: string) {
  const res = await fetch(`${DASHBOARD}/harness/acting-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`acting-user failed: ${res.status}`);
}

async function dispatch(
  pathName: string,
  args: Record<string, unknown>,
  kind: "query" | "mutation" | "action" = "mutation",
) {
  const res = await fetch(`${DASHBOARD}/harness/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: pathName, args, kind }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${pathName}: ${body.error}`);
  return body.data;
}

/** GET /api/bridge/content as the PUBLIC snippet does — published values. */
async function bridgeContent(slug: string): Promise<any> {
  const res = await fetch(`${CONVEX_ORIGIN}/api/bridge/content?slug=${slug}`);
  return res.json();
}

/* ───────────────────── editor-page helpers ────────────────────────────── */
async function editorFrame(page: Page): Promise<Frame> {
  await expect
    .poll(() => Promise.resolve(page.frames().some((f) => f.url().includes("/api/editor/frame"))), { timeout: 20_000 })
    .toBe(true);
  return page.frames().find((f) => f.url().includes("/api/editor/frame"))!;
}

async function openEditor(page: Page): Promise<Frame> {
  await page.goto(EDITOR_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Website Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  const frame = await editorFrame(page);
  await frame.waitForSelector("[data-taya-edit]", { timeout: 20_000 });
  return frame;
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

/**
 * Switch the editor to a page by its client-visible pill label. The pill is
 * scoped to `main` (the sidebar has same-named nav items). The pill click
 * REMOUNTS the iframe (its React key is frameUrl) so captured frame handles
 * go stale — poll the LIVE frame by its percent-encoded path and wait for a
 * ground-truth key on that page to be stamped (flow 9's pattern).
 */
async function switchToPage(page: Page, label: "Home" | "Services" | "FAQ"): Promise<Frame> {
  await page.getByRole("main").getByRole("button", { name: label, exact: true }).click();
  const pathMark = label === "Home" ? "path=%2F" : label === "Services" ? "path=%2Fservices" : "path=%2Ffaq";
  const probeKey = label === "Home" ? "home.section5.body" : label === "Services" ? "services.heading" : "faq.heading";
  await expect
    .poll(
      async () =>
        Promise.all(
          page
            .frames()
            .filter((f) => f.url().includes(pathMark))
            .map((f) => f.locator(`[data-taya-edit="${probeKey}"]`).count()),
        ),
      { timeout: 20_000 },
    )
    .toEqual([1]);
  return page.frames().filter((f) => f.url().includes(pathMark))[0];
}

/** Click locked nav-bar chrome (far right, past the last link). The editor
 * iframe is CSS-scaled (contain-fit), so the nav's page-space box can be
 * under 12px tall — position INSIDE the box's real height, never a fixed y. */
async function clickLockedNavArea(frame: Frame) {
  const navBar = frame.locator("nav.site-nav").first();
  const navBox = await navBar.boundingBox();
  const navRight = Math.max(60, (navBox?.width ?? 200) - 10);
  const y = Math.max(2, Math.min(12, Math.floor((navBox?.height ?? 24) / 2)));
  await navBar.click({ position: { x: navRight, y } });
}

async function saveDraft(page: Page) {
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText(/Draft saved|drafts? saved/i).first()).toBeVisible({ timeout: 10_000 });
}

/* Harness state persists across runs AND across specs. Reset to seed before
 * every test so a previous run's published edits (e.g. home.section5.buttons[0]
 * = "Reach out today") never leak into this run's "Contact us" assertions.
 * Every test sets its acting user as its first step, so the reset resetting
 * the acting user is harmless. */
test.beforeEach(async () => {
  const res = await fetch(`${DASHBOARD}/harness/reset`, { method: "POST" });
  if (res.status !== 201) throw new Error(`harness reset failed: ${res.status}`);
});

/* ═════════════════════════════════════════════════════════════════════════
 * A3 — ordinary section button: Label + Destination (companion .href)
 * ════════════════════════════════════════════════════════════════════════ */
test("A3 — section button gets Label + Destination (ordinary client link)", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // An ORDINARY section CTA button on the real page (not the hero button).
  const btn = frame.locator('[data-taya-edit="home.section5.buttons[0]"]');
  await expect(btn).toHaveText("Contact us");
  await btn.click();

  // The card identifies it in client language — "Button" (an <a> CTA), never
  // a §5 key.
  await expect(page.getByText("Button", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Destination is editable — the §3 companion ".href" key coverage fix.
  // Old copy was: "This link's destination can't be edited yet".
  await expect(page.getByText("This link's destination can't be edited yet")).toHaveCount(0);
  await expect(page.getByText("Destination", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Label + Destination side by side, like the hero button.
  const labelInput = page.locator("input").first();
  await labelInput.fill("Reach out today");
  const destInput = page.locator('input[placeholder*="/about"]').first();
  await destInput.fill("/faq");
  await shot(page, "a3-section-button-destination");

  // Verdict badge in client language.
  await expect(page.getByText("Page on this site", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // The REAL rendered page updates both label and destination live.
  await expect(btn).toHaveText("Reach out today", { timeout: 10_000 });
  await expect(btn).toHaveAttribute("href", "/faq", { timeout: 10_000 });

  // Persist it end to end: Save Draft → Publish → reload still shows it.
  await saveDraft(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the live website")).toBeVisible({ timeout: 15_000 });
  const reloaded = await openEditor(page);
  const btn2 = reloaded.locator('[data-taya-edit="home.section5.buttons[0]"]');
  await expect(btn2).toHaveText("Reach out today");
  await expect(btn2).toHaveAttribute("href", "/faq");

  // And the PUBLIC site serves both published values through the bridge
  // (the snippet folds the companion .href onto the anchor at runtime).
  const content = await bridgeContent("harborview");
  expect(content.values["home.section5.buttons[0]"]).toBe("Reach out today");
  expect(content.values["home.section5.buttons[0].href"]).toBe("/faq");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A5 — Page SEO in the editor rail ("Search & social settings")
 * ════════════════════════════════════════════════════════════════════════ */
test("A5 — page SEO: meta title/description, canonical, noindex, social fields persist", async ({ page }) => {
  await setActingUser("user_alice");
  await openEditor(page);

  // The SEO card is IN the editor rail (no navigation away from editing).
  await expect(page.getByText("Search & social settings", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Show SEO settings" }).click();

  // Home page has a PRE-EXISTING seoSettings row → update path.
  await expect(page.getByText("For this page (home).", { exact: true })).toBeVisible({ timeout: 10_000 });

  // All seven §5 fields, labeled in client language.
  await page.getByLabel("Meta title", { exact: true }).fill("Harborview Dental — Family Dentistry in Harbor City");
  await page
    .getByLabel("Meta description", { exact: true })
    .fill("Gentle family dentistry in Harbor City. Cleanings, whitening, and same-day emergency care.");
  await page.getByLabel("Canonical URL", { exact: true }).fill("https://harborviewdental.example/");
  await page.getByLabel("Social title", { exact: true }).fill("Harborview Dental");
  await page.getByLabel("Social description", { exact: true }).fill("Gentle, modern dental care for your whole family.");
  await page
    .getByLabel("Social image URL", { exact: true })
    .fill("https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80");
  await page.getByLabel("Hide this page from search engines", { exact: true }).check();
  await shot(page, "a5-seo-panel-filled");

  // Save through the EXISTING seoSettings storage.
  await page.getByRole("button", { name: "Save search settings" }).click();
  await expect(page.getByText(/^Saved at/)).toBeVisible({ timeout: 10_000 });
  await shot(page, "a5-seo-panel-saved");

  // §5 no duplicate storage: the row persisted in seoSettings, keyed by page.
  const rows = await dispatch("seo.list", { siteId: "site_harborview" }, "query");
  const home = rows.find((r: any) => r.pagePath === "/");
  expect(home.title).toBe("Harborview Dental — Family Dentistry in Harbor City");
  expect(home.description).toBe("Gentle family dentistry in Harbor City. Cleanings, whitening, and same-day emergency care.");
  expect(home.canonicalUrl).toBe("https://harborviewdental.example/");
  expect(home.ogTitle).toBe("Harborview Dental");
  expect(home.ogDescription).toBe("Gentle, modern dental care for your whole family.");
  expect(home.ogImageUrl).toContain("photo-1588776814546");
  expect(home.noindex).toBe(true);

  // Reload the editor: the rail panel re-reads the same row (persistence).
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Website Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  await editorFrame(page);
  await page.getByRole("button", { name: "Show SEO settings" }).click();
  await expect(page.getByLabel("Meta title", { exact: true })).toHaveValue(
    "Harborview Dental — Family Dentistry in Harbor City",
    { timeout: 15_000 },
  );
  await expect(page.getByLabel("Canonical URL", { exact: true })).toHaveValue("https://harborviewdental.example/");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A6 — Analytics: client-safe GA4/GTM/Search Console for an owner
 * ════════════════════════════════════════════════════════════════════════ */
test("A6 — analytics GA4/GTM/Search Console saved client-safe", async ({ page }) => {
  await setActingUser("user_alice");
  await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Website Settings™" })).toBeVisible({ timeout: 20_000 });

  // The Analytics tab is client-visible (not design-locked away).
  await page.getByRole("tab", { name: "Analytics" }).click();

  await page.getByLabel("Google Analytics 4 (GA4) Measurement ID", { exact: true }).fill("G-HARBOR1234");
  await page.getByLabel("Google Tag Manager (GTM) Container ID", { exact: true }).fill("GTM-HARBOR7");
  await page.getByLabel("Google Search Console Verification Token", { exact: true }).fill("sc-verify-token-hv");
  await shot(page, "a6-analytics-filled");

  // Client-safe: CONTENT_UPDATE tier, no integrations/design gate.
  await page.getByRole("button", { name: "Save Analytics" }).click();
  await expect(page.getByText("Saved successfully", { exact: true })).toBeVisible({ timeout: 10_000 });
  await shot(page, "a6-analytics-saved");

  // Persisted in siteSettings (the snippet reads these on the live site).
  const d = await dispatch("siteSettings.get", { siteId: "site_harborview" }, "query");
  expect(d.analyticsGa4).toBe("G-HARBOR1234");
  expect(d.analyticsGtm).toBe("GTM-HARBOR7");
  expect(d.analyticsSearchConsole).toBe("sc-verify-token-hv");
  expect(typeof d.analyticsUpdatedAt).toBe("number");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A6 — Site Health on the dashboard: client-visible, not design-locked
 * ════════════════════════════════════════════════════════════════════════ */
test("A6 — dashboard Site Health card + health page for a client owner", async ({ page }) => {
  await setActingUser("user_alice");
  await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible({ timeout: 20_000 });

  // First visit: the 5-step client tour opens. The client closes it — and the
  // dismissal must PERSIST under their own user key (the WelcomeTour bug this
  // acceptance found: mount used to read the anonymous key while Close wrote
  // the per-user key, so the tour re-appeared on every visit).
  const tour = page.getByRole("dialog", { name: "Welcome tour" });
  await expect(tour).toBeVisible({ timeout: 20_000 });
  await shot(page, "a6-first-visit-tour");
  await page.getByRole("button", { name: "Close welcome tour" }).click();
  await expect(tour).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Welcome tour" })).toHaveCount(0);

  // The health card: score + status + client copy. NOT design-locked.
  await expect(page.getByText("Website Health Command Center™")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/No scan yet|Excellent — your site is healthy|Needs attention/)).toBeVisible({
    timeout: 15_000,
  });
  await shot(page, "a6-dashboard-health-card");

  // Click the card → the full Site Health page (client-visible route).
  await page.getByText("Website Health Command Center™").click();
  await expect(page).toHaveURL(/\/health$/);
  await expect(page.getByRole("button", { name: "Run Scan", exact: true })).toBeVisible({ timeout: 20_000 });
  // The seeded scan (score 82) drives the real numbers a client sees.
  await expect(page.getByText("82/100", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Last scan:", { exact: false })).toBeVisible({ timeout: 20_000 });
  await shot(page, "a6-health-page");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A6 — read_only role: Website Settings is view-only, analytics FORBIDDEN
 * ════════════════════════════════════════════════════════════════════════ */
test("A6 — read_only site member cannot edit settings (analytics forbidden)", async ({ page }) => {
  // Carol: read_only on Riverside.
  await setActingUser("user_carol");
  await page.goto("/app/sites/site_riverside/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("View-only access", { exact: true })).toBeVisible({ timeout: 20_000 });
  // No fake Save buttons, no forms whose Save would always fail.
  await expect(page.getByRole("button", { name: "Save Analytics" })).toHaveCount(0);
  await expect(page.getByLabel("Google Analytics 4 (GA4) Measurement ID", { exact: true })).toHaveCount(0);
  await shot(page, "a6-read-only-settings");

  // The backend ALSO rejects her analytics write (§9 forbidden proof).
  let forbidden = false;
  try {
    await dispatch("siteSettings.updateAnalytics", { siteId: "site_riverside", analyticsGa4: "G-NOPE" });
  } catch (e: any) {
    forbidden = String(e).includes("Forbidden");
  }
  expect(forbidden).toBe(true);

  // And she is not silently redirected away from the page she can VIEW.
  await expect(page).toHaveURL(/\/settings$/);
  await setActingUser("user_alice");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A7 — page coverage spot check: /services
 * ════════════════════════════════════════════════════════════════════════ */
test("A7 — /services: heading/paragraph/image/button editable + honest classification", async ({ page }) => {
  await setActingUser("user_alice");
  await openEditor(page);
  const frameServices = await switchToPage(page, "Services");

  // Heading editable.
  const heading = frameServices.locator('[data-taya-edit="services.heading"]');
  await expect(heading).toHaveText("Our services");
  await heading.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Everything your smile needs");
  await expect(heading).toHaveText("Everything your smile needs", { timeout: 10_000 });
  await shot(page, "a7-services-heading");

  // Paragraph editable (section intro).
  const body = frameServices.locator('[data-taya-edit="services.body"]');
  await body.click();
  await expect(page.getByText("Paragraph", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Every treatment, one gentle team.");
  await expect(body).toHaveText("Every treatment, one gentle team.", { timeout: 10_000 });

  // Image editable (service card image → URL + alt).
  const img = frameServices.locator('[data-taya-edit="services.items[0].image"]');
  await img.click();
  await expect(page.getByText("Image", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, "a7-services-image");

  // Repeatable item editing + add-content on /services.
  const item = frameServices.locator('[data-taya-edit="services.items[1].title"]');
  await item.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Cosmetic whitening");
  await expect(item).toHaveText("Cosmetic whitening", { timeout: 10_000 });
  await shot(page, "a7-services-item");

  // Add-content chip availability on /services: zones are service-list,
  // footer-content, video-section, cta-stack → image + FAQ chips disabled
  // (no zone allows them); link ENABLED (footer-content allows link);
  // PDF resource ENABLED (service-list allows pdf).
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await expect(page.getByRole("button", { name: "+ Add image", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "+ Add FAQ", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "+ Add link", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "+ Add resource", exact: true })).toBeEnabled();
  await shot(page, "a7-services-add-panel");

  // Classification is HONEST (no matching zone, not a bug): the sentence
  // explains why without promising other pages.
  await expect(page.getByText(/can't be added to this page/).first()).toBeVisible();

  // /services IS a services page: a PDF resource adds to the services list.
  await page.getByRole("button", { name: "+ Add resource", exact: true }).click();
  await page.getByRole("button", { name: "Services list", exact: true }).click();
  await page.locator("select").selectOption("dl_new_patient");
  await page.getByLabel("Title", { exact: true }).fill("New Patient Welcome Packet");
  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByText("Draft saved — preview or publish")).toBeVisible({ timeout: 10_000 });
  await shot(page, "a7-services-pdf-added");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A7 — page coverage spot check: /faq
 * ════════════════════════════════════════════════════════════════════════ */
test("A7 — /faq: heading/paragraph/items editable + FSTS-locked explanation", async ({ page }) => {
  await setActingUser("user_alice");
  await openEditor(page);
  const frameFaq = await switchToPage(page, "FAQ");

  // Heading editable.
  const heading = frameFaq.locator('[data-taya-edit="faq.heading"]');
  await expect(heading).toHaveText("Frequently asked questions");
  await heading.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Answers to common questions");
  await expect(heading).toHaveText("Answers to common questions", { timeout: 10_000 });
  await shot(page, "a7-faq-heading");

  // Repeatable FAQ item: question + answer both editable.
  const q = frameFaq.locator('[data-taya-edit="faq.items[0].title"]');
  await q.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Are you accepting new patients?");
  await expect(q).toHaveText("Are you accepting new patients?", { timeout: 10_000 });

  const a = frameFaq.locator('[data-taya-edit="faq.items[0].description"]');
  await a.click();
  await expect(page.getByText("Paragraph", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Yes — we usually see first visits within two weeks.");
  await expect(a).toHaveText("Yes — we usually see first visits within two weeks.", { timeout: 10_000 });
  await shot(page, "a7-faq-item");

  // NON-EDITABLE classification: nav links on /faq NAVIGATE the editor
  // (same-site links are page switches, not edits) — the LOCKED area is the
  // nav bar chrome itself (far right, past the last link).
  await clickLockedNavArea(frameFaq);
  await expect(page.getByText(LOCKED_NOTICE)).toBeVisible({ timeout: 10_000 });
  await shot(page, "a7-faq-locked-nav");
});

/* ═════════════════════════════════════════════════════════════════════════
 * A7 — home page spot check (button/link coverage summary record)
 * ════════════════════════════════════════════════════════════════════════ */
test("A7 — home: hero destination + locked nav classified", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // Hero button: label + destination (§2).
  const hero = frame.locator('[data-taya-edit="home.hero.primaryButton.label"]');
  await hero.click();
  await expect(page.getByText("Button", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("This link's destination can't be edited yet")).toHaveCount(0);
  const dest = page.locator('input[placeholder*="/about"]').first();
  await expect(dest).toBeVisible();
  await expect(dest).toHaveValue("/contact");
  await shot(page, "a7-home-hero-destination");

  // Locked header nav chrome (far right of the bar, no link hit target).
  await clickLockedNavArea(frame);
  await expect(page.getByText(LOCKED_NOTICE)).toBeVisible({ timeout: 10_000 });
  await shot(page, "a7-home-locked-nav");
});
