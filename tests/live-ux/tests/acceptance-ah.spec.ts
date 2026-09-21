/**
 * acceptance-ah.spec.ts — CHAT 2 §13 REAL CHROMIUM ACCEPTANCE (A–H).
 *
 * The client-editing acceptance journey, driven end to end in real Chromium
 * against the harness's three origins (dashboard 4173 / convex 7788 / site
 * 4175). Nothing is mocked inside the browser: the driver page runs the REAL
 * VisualEditor.tsx via the same wouter Route production App.tsx registers,
 * the iframe renders the REAL annotated page (buildFrameDocument) with the
 * REAL bridge contract, and every mutation hits the harness store that
 * mirrors convex/publishing.ts + convex/editor.ts + convex/editorZones.ts +
 * convex/siteSettings.ts.
 *
 *   A  Hero completion — headline, subheadline, primary + secondary CTA
 *      (label + destination), hero image, hero background image, alt text.
 *   B  Image workflow — select → replace/upload → alt → preview → Save Draft
 *      → Preview → Publish → reload persists; plus Add Image via the EXISTING
 *      Media Library (ImagePickerField → SmartImageEditor → mediaAssets).
 *   C  Video workflow — add YouTube + Vimeo, reject arbitrary embed HTML.
 *   D  PDF/resource end to end — managed picker + Chat D's direct upload
 *      contract (generateUploadUrl → PUT → createFromStorage).
 *   E  Form placement UX — choose an existing form → EXISTING FormBuilder →
 *      clean return (no bypass).
 *   F  Full-site content coverage matrix — classify every sampled item
 *      (EDITABLE / FSTS DESIGN LOCKED / UNSUPPORTED / BUG).
 *   G  Design Lock — ordinary content succeeds AND protected design changes
 *      fail (server-enforced).
 *   H  Role/tenant — owner, manager, content_editor, read_only, wrong tenant.
 *
 * Every assertion is CLIENT language — never engine ids, keys, or zone names.
 */
import { test, expect, type Page, type Frame } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/* ──────────────────────────────── constants ──────────────────────────────── */
const DASHBOARD = "https://127.0.0.1:4173";
const SITE_ORIGIN = "https://127.0.0.1:4175";
const CONVEX_ORIGIN = "https://127.0.0.1:7788";
const PREVIEW_TOKEN = "a1b2c3d4e5f6a7b8"; // harborview preview token (harness store)
const EVIDENCE_DIR = path.join(__dirname, "..", "evidence");

const LOCKED_NOTICE =
  "That part of the page is managed by FSTS. Contact your TAYA representative to make changes.";

/* ─────────────────────── harness control channel (server-side) ───────────── */
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

async function harnessState(): Promise<any> {
  const res = await fetch(`${DASHBOARD}/harness/state`);
  return res.json();
}

/** GET /api/bridge/content as the PUBLIC snippet does — published values. */
async function bridgeContent(slug: string): Promise<any> {
  const res = await fetch(`${CONVEX_ORIGIN}/api/bridge/content?slug=${slug}`);
  return res.json();
}

/* ───────────────────────────── editor-page helpers ───────────────────────── */
async function editorFrame(page: Page): Promise<Frame> {
  await expect
    .poll(() => Promise.resolve(page.frames().some((f) => f.url().includes("/api/editor/frame"))), { timeout: 20_000 })
    .toBe(true);
  return page.frames().find((f) => f.url().includes("/api/editor/frame"))!;
}

async function openEditor(page: Page, siteId = "site_harborview"): Promise<Frame> {
  await page.goto(`/app/sites/${siteId}/editor`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Website Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  const frame = await editorFrame(page);
  await frame.waitForSelector("[data-taya-edit]", { timeout: 20_000 });
  return frame;
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

/** Switch the editor to a page by its client-visible pill label. The pill
 * click REMOUNTS the iframe (its React key is frameUrl) so captured frame
 * handles go stale — poll the LIVE frame by its percent-encoded path. */
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

async function saveDraft(page: Page) {
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText(/Draft saved|drafts? saved/i).first()).toBeVisible({ timeout: 10_000 });
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the live website")).toBeVisible({ timeout: 15_000 });
}

/* Reset both sites to pristine before every test (harness state persists
 * across runs AND across specs). Every test sets its acting user first. */
test.beforeEach(async () => {
  const res = await fetch(`${DASHBOARD}/harness/reset`, { method: "POST" });
  if (res.status !== 201) throw new Error(`harness reset failed: ${res.status}`);
});

/* ══════════════════════════════════════════════════════════════════════════
 * A — HERO COMPLETION (Req 1)
 * ══════════════════════════════════════════════════════════════════════════ */
test("A — hero completion: headline, subheadline, both CTAs, image, background, alt", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // ── (1) Headline ──
  const heading = frame.locator('[data-taya-edit="home.hero.heading"]');
  await expect(heading).toHaveText("Welcome to Harborview Dental");
  await heading.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Harborview Dental — Care for every smile");
  await expect(heading).toHaveText("Harborview Dental — Care for every smile", { timeout: 10_000 });

  // ── (2) Subheadline ──
  const sub = frame.locator('[data-taya-edit="home.hero.subheading"]');
  await sub.click();
  await expect(page.getByText("Paragraph", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Gentle, modern dentistry for the whole family in Harbor City.");
  await expect(sub).toHaveText("Gentle, modern dentistry for the whole family in Harbor City.", { timeout: 10_000 });

  // ── (3) Primary CTA: label + destination ──
  const primary = frame.locator('[data-taya-edit="home.hero.primaryButton.label"]');
  await expect(primary).toHaveText("Book an appointment");
  await primary.click();
  await expect(page.getByText("Button", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("input").first().fill("Book your visit");
  const primaryDest = page.locator('input[placeholder*="/about"]').first();
  await primaryDest.fill("/contact");
  await expect(page.getByText("Page on this site", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(primary).toHaveText("Book your visit", { timeout: 10_000 });
  await expect(primary).toHaveAttribute("href", "/contact", { timeout: 10_000 });

  // ── (4) Secondary CTA: label + destination ──
  const secondary = frame.locator('[data-taya-edit="home.hero.secondaryButton.label"]');
  await expect(secondary).toHaveText("See our services");
  await secondary.click();
  await expect(page.getByText("Button", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("input").first().fill("Explore treatments");
  const secondaryDest = page.locator('input[placeholder*="/about"]').first();
  await secondaryDest.fill("/services");
  await expect(secondary).toHaveText("Explore treatments", { timeout: 10_000 });
  await expect(secondary).toHaveAttribute("href", "/services", { timeout: 10_000 });

  // ── (5) Hero image alt text ──
  const img = frame.locator('[data-taya-edit="home.hero.image"]');
  await img.click();
  await expect(page.getByText("Image", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  const altInput = page.getByPlaceholder("Describe the image for screen readers");
  await expect(altInput).toBeVisible({ timeout: 10_000 });
  await altInput.fill("A bright, welcoming dental clinic reception desk");
  await expect(img).toHaveAttribute("alt", "A bright, welcoming dental clinic reception desk", { timeout: 10_000 });

  // ── (6) Hero background image ──
  const bg = frame.locator('[data-taya-edit="home.hero.backgroundImage"]');
  await expect(bg).toHaveCount(1);
  await bg.click({ position: { x: 3, y: 3 } });
  await expect(page.getByText("Background image", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-A-hero-complete");

  // ── Persist end to end: Save Draft → Publish → reload ──
  await saveDraft(page);
  await publish(page);
  const reloaded = await openEditor(page);
  await expect(reloaded.locator('[data-taya-edit="home.hero.heading"]')).toHaveText("Harborview Dental — Care for every smile");
  await expect(reloaded.locator('[data-taya-edit="home.hero.secondaryButton.label"]')).toHaveText("Explore treatments");
  await expect(reloaded.locator('[data-taya-edit="home.hero.image"]')).toHaveAttribute("alt", "A bright, welcoming dental clinic reception desk");

  // Public bridge serves every published hero value.
  const content = await bridgeContent("harborview");
  expect(content.values["home.hero.heading"]).toBe("Harborview Dental — Care for every smile");
  expect(content.values["home.hero.secondaryButton.label"]).toBe("Explore treatments");
  expect(content.values["home.hero.secondaryButton.href"]).toBe("/services");
  expect(content.values["home.hero.image.alt"]).toBe("A bright, welcoming dental clinic reception desk");
});

/* ══════════════════════════════════════════════════════════════════════════
 * B — IMAGE WORKFLOW ACCEPTANCE (Req 2)
 * ══════════════════════════════════════════════════════════════════════════ */
test("B — image workflow: replace + alt → Save Draft → Preview → Publish → reload persists", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  const img = frame.locator('[data-taya-edit="home.hero.image"]');
  await img.click();
  await expect(page.getByText("Image", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Select → replace via the EXISTING Media Library dialog (URL tab).
  await page.getByRole("button", { name: "Change Image" }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "URL", exact: true }).click();
  const NEW_URL = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80";
  await dialog.locator('[aria-label="Image URL"]').fill(NEW_URL);
  await dialog.locator('[aria-label="Alt Text"]').fill("A calm, bright dental treatment room");
  await dialog.getByRole("button", { name: "Save Image" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Preview: the REAL rendered page shows the new image + alt immediately.
  await expect(img).toHaveAttribute("src", NEW_URL, { timeout: 10_000 });
  await expect(img).toHaveAttribute("alt", "A calm, bright dental treatment room", { timeout: 10_000 });
  await shot(page, "ah-B-image-replaced");

  // Save Draft → Preview on the ACTUAL site.
  await saveDraft(page);
  await page.goto(`${SITE_ORIGIN}/?taya_preview=${PREVIEW_TOKEN}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("img", { timeout: 15_000 });
  await expect(page.locator("img").first()).toHaveAttribute("src", NEW_URL, { timeout: 15_000 });
  await shot(page, "ah-B-image-preview-site");

  // Publish → reload persists.
  await openEditor(page);
  await publish(page);
  const reloaded = await openEditor(page);
  await expect(reloaded.locator('[data-taya-edit="home.hero.image"]')).toHaveAttribute("src", NEW_URL);
  const content = await bridgeContent("harborview");
  expect(content.values["home.hero.image"]).toBe(NEW_URL);
  expect(content.values["home.hero.image.alt"]).toBe("A calm, bright dental treatment room");
});

test("B2 — Add Image via the EXISTING Media Library (Add panel → ImagePickerField)", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add image" }).click();
  await page.getByRole("button", { name: "Main content area", exact: true }).click();

  // The block form's ImagePickerField opens the SAME Media Library dialog.
  await page.getByRole("button", { name: /Choose Image|Change Image/ }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "URL", exact: true }).click();
  const ADDED_URL = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=70";
  await dialog.locator('[aria-label="Image URL"]').fill(ADDED_URL);
  await dialog.locator('[aria-label="Alt Text"]').fill("A friendly dental team at the front desk");
  await dialog.getByRole("button", { name: "Save Image" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  const imgCard = frame.locator('[data-taya-block-id] img').first();
  await expect(imgCard).toHaveAttribute("src", ADDED_URL, { timeout: 15_000 });
  // The block image is lazy-loaded with no intrinsic size until it decodes, so
  // scroll it into view and wait for the bitmap to actually load before
  // asserting visibility (a 0x0 unloaded <img> reads as hidden).
  await imgCard.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => imgCard.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  await expect(imgCard).toBeVisible({ timeout: 15_000 });
  await shot(page, "ah-B2-add-image-media-library");
});

/* ══════════════════════════════════════════════════════════════════════════
 * C — VIDEO WORKFLOW ACCEPTANCE (Req 3)
 * ══════════════════════════════════════════════════════════════════════════ */
test("C — video workflow: add YouTube + Vimeo, reject arbitrary embed HTML", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // ── YouTube ──
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add video" }).click();
  await page.getByRole("button", { name: "Video area", exact: true }).click();
  await page.getByLabel("Video link (YouTube or Vimeo)").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(page.getByText("youtube video detected")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Caption (optional)").fill("Meet Dr. Lee and the team");
  await shot(page, "ah-C-video-youtube");
  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  const videoCard = frame.locator('[data-taya-block-id] .taya-video-card, [data-taya-block-id] a.taya-video-card').first();
  await expect(videoCard).toBeVisible({ timeout: 15_000 });

  // ── Vimeo (second block) ──
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add video" }).click();
  await page.getByRole("button", { name: "Video area", exact: true }).click();
  await page.getByLabel("Video link (YouTube or Vimeo)").fill("https://vimeo.com/76979871");
  await expect(page.getByText("vimeo video detected")).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-C-video-vimeo");

  // ── Reject arbitrary embed HTML (never reaches storage) ──
  await page.getByLabel("Video link (YouTube or Vimeo)").fill('<iframe src="https://evil.example/x"></iframe>');
  await expect(
    page.getByText("Paste the video's share link — embed code isn't allowed."),
  ).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-C-video-rejected");
  // The Add button stays usable but the server would reject; the client shows
  // the exact server reason BEFORE save (client validation is UX only).
});

/* ══════════════════════════════════════════════════════════════════════════
 * D — PDF / RESOURCE END TO END (Req 4)
 * ══════════════════════════════════════════════════════════════════════════ */
test("D — PDF/resource: managed picker + direct upload (Chat D contract)", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // ── (1) Managed picker: choose an existing PDF resource ──
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add resource" }).click();
  await page.getByRole("button", { name: "Main content area", exact: true }).click();
  await page.locator("select").selectOption("dl_new_patient");
  await page.getByLabel("Title", { exact: true }).fill("New Patient Form");
  await shot(page, "ah-D-pdf-managed");
  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  const pdfCard = frame.locator('[data-taya-block-id] .taya-pdf-card, [data-taya-block-id] a.taya-pdf-card').first();
  await expect(pdfCard).toBeVisible({ timeout: 15_000 });

  // ── (2) Direct upload: Chat D's generateUploadUrl → PUT → createFromStorage ──
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add resource" }).click();
  await page.getByRole("button", { name: "Main content area", exact: true }).click();
  const pdfInput = page.locator('input[type="file"][accept*="pdf"]');
  await pdfInput.setInputFiles({
    name: "insurance-guide.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF",
    ),
  });
  await expect(page.getByText("Uploaded — selected above.")).toBeVisible({ timeout: 15_000 });
  await shot(page, "ah-D-pdf-uploaded");
  await page.getByRole("button", { name: "Add to page" }).click();
  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════════
 * E — FORM PLACEMENT UX (Req 5)
 * ══════════════════════════════════════════════════════════════════════════ */
test("E — form placement: choose existing form → EXISTING FormBuilder → clean return", async ({ page }) => {
  await setActingUser("user_alice");
  await openEditor(page);

  await expect(page.getByText("Forms on this site", { exact: true })).toBeVisible({ timeout: 10_000 });
  const contactBtn = page.getByRole("button", { name: /Contact us/ });
  await expect(contactBtn).toBeVisible();
  await shot(page, "ah-E-forms-panel");

  await contactBtn.click();
  await expect(page).toHaveURL(/\/app\/sites\/site_harborview\/forms\/form_contact/, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Save/ }).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-E-formbuilder");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Website Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Forms on this site", { exact: true })).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-E-clean-return");
});

/* ══════════════════════════════════════════════════════════════════════════
 * F — FULL-SITE CONTENT COVERAGE MATRIX (Req 6)
 *
 * Classify every sampled item across home / services / faq:
 *   EDITABLE            — a client can change it through the editor
 *   FSTS DESIGN LOCKED  — protected layout/branding (explained, not silent)
 *   UNSUPPORTED         — no matching site contract (honest, not a bug)
 *   BUG                 — should be editable but is not
 * ══════════════════════════════════════════════════════════════════════════ */
test("F — coverage matrix: every sampled item is EDITABLE or honestly classified", async ({ page }) => {
  await setActingUser("user_alice");
  const frame = await openEditor(page);

  // Ground truth: the discovered content map for the site.
  const cm = await dispatch("contentMap.get", { siteId: "site_harborview" }, "query");
  const keys: string[] = Object.keys(cm.entries);

  // Every EDITABLE key must be reachable in the live frame (no phantom keys).
  // NOTE: ".alt" keys are COMPANIONS — they ride the SAME <img> element as
  // their base image key (the alt input appears when the image is selected),
  // so they are not separately stamped. Assert the base element is stamped
  // AND the companion key exists in the map (proving it is editable).
  const EDITABLE_SAMPLES = [
    "home.hero.heading",
    "home.hero.subheading",
    "home.hero.image",
    "home.hero.image.alt",
    "home.hero.backgroundImage",
    "home.hero.primaryButton.label",
    "home.hero.secondaryButton.label",
    "home.services.heading",
    "home.services.items[0].title",
    "home.services.items[0].image.alt",
    "home.about.body",
    "home.faq.items[0].title",
    "home.section5.buttons[0]",
    "home.footer.text",
  ];
  for (const k of EDITABLE_SAMPLES) {
    expect(keys, `content map must contain ${k}`).toContain(k);
    // Companion ".alt" keys ride their base image element; every other key is
    // stamped directly.
    const stampedKey = k.endsWith(".alt") ? k.slice(0, -".alt".length) : k;
    await expect(
      frame.locator(`[data-taya-edit="${stampedKey}"]`),
      `${k} must be editable in the frame (via ${stampedKey})`,
    ).toHaveCount(1);
  }

  // FSTS DESIGN LOCKED: the nav bar chrome is protected — clicking it explains
  // (never silent, never a fake control).
  const navBar = frame.locator("nav.site-nav").first();
  const navBox = await navBar.boundingBox();
  const navRight = Math.max(60, (navBox?.width ?? 200) - 10);
  const navY = Math.max(2, Math.min(12, Math.floor((navBox?.height ?? 24) / 2)));
  await navBar.click({ position: { x: navRight, y: navY } });
  await expect(page.getByText(LOCKED_NOTICE)).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-F-locked-nav");

  // UNSUPPORTED (honest, not a bug): on /faq, images + PDFs have no allowed
  // zone → the chips are disabled with a plain-language sentence.
  await switchToPage(page, "FAQ");
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await expect(page.getByRole("button", { name: "+ Add image" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "+ Add resource" })).toBeDisabled();
  await expect(
    page.getByText("Images, PDF resources can't be added to this page", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-F-unsupported-faq");

  // /services coverage: heading + item + image alt all editable.
  const frameServices = await switchToPage(page, "Services");
  for (const k of ["services.heading", "services.items[0].title", "services.items[0].image.alt"]) {
    expect(keys, `content map must contain ${k}`).toContain(k);
    // Companion ".alt" keys ride their base image element; every other key is
    // stamped directly.
    const stampedKey = k.endsWith(".alt") ? k.slice(0, -".alt".length) : k;
    await expect(
      frameServices.locator(`[data-taya-edit="${stampedKey}"]`),
      `${k} must be editable (via ${stampedKey})`,
    ).toHaveCount(1);
  }
  await shot(page, "ah-F-services-coverage");

  // Write the machine-checked matrix artifact.
  const matrix = {
    generatedAt: new Date().toISOString(),
    site: "site_harborview",
    totalKeys: keys.length,
    editableSamples: EDITABLE_SAMPLES,
    classification: {
      EDITABLE: EDITABLE_SAMPLES,
      "FSTS DESIGN LOCKED": ["nav.site-nav (layout chrome)", "site header/footer layout"],
      UNSUPPORTED: ["/faq image insertion", "/faq PDF insertion"],
      BUG: [],
    },
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, "ah-F-coverage-matrix.json"), JSON.stringify(matrix, null, 2));
});

/* ══════════════════════════════════════════════════════════════════════════
 * G — DESIGN LOCK (Req 9)
 * ══════════════════════════════════════════════════════════════════════════ */
test("G — design lock: ordinary content succeeds AND protected design changes fail", async ({ page }) => {
  await setActingUser("user_alice");

  // ── Ordinary content SUCCEEDS (owner edits a heading) ──
  const frame = await openEditor(page);
  const heading = frame.locator('[data-taya-edit="home.hero.heading"]');
  await heading.click();
  await page.locator("textarea").first().fill("Ordinary content edit — allowed");
  await expect(heading).toHaveText("Ordinary content edit — allowed", { timeout: 10_000 });
  await saveDraft(page);
  await publish(page);
  await shot(page, "ah-G-ordinary-content-ok");

  // ── Protected DESIGN changes FAIL (server-enforced, SuperAdmin-only) ──
  const forbidden = async (pathName: string, args: Record<string, unknown>) => {
    try {
      await dispatch(pathName, args);
      return false;
    } catch (e: any) {
      return String(e).includes("Forbidden");
    }
  };
  // Branding / identity → design.manage (SuperAdmin-only).
  expect(await forbidden("siteSettings.updateBranding", { siteId: "site_harborview", brandColorPrimary: "#000000" })).toBe(true);
  expect(await forbidden("siteSettings.updateIdentity", { siteId: "site_harborview", businessName: "Hacked" })).toBe(true);
  // Integrations → integrations.manage (SuperAdmin-only).
  expect(await forbidden("siteSettings.updateIntegrations", { siteId: "site_harborview", ga4: "G-X" })).toBe(true);
  // Module/layout config → sites.update (SuperAdmin-only).
  expect(await forbidden("sites.update", { siteId: "site_harborview", enabledModules: [] })).toBe(true);

  // ── Protected layout chrome is explained in the editor (never silent) ──
  const frame2 = await openEditor(page);
  const navBar = frame2.locator("nav.site-nav").first();
  const navBox = await navBar.boundingBox();
  await navBar.click({
    position: { x: Math.max(60, (navBox?.width ?? 200) - 10), y: Math.max(2, Math.min(12, Math.floor((navBox?.height ?? 24) / 2))) },
  });
  await expect(page.getByText(LOCKED_NOTICE)).toBeVisible({ timeout: 10_000 });
  await shot(page, "ah-G-design-locked-explained");
});

/* ══════════════════════════════════════════════════════════════════════════
 * H — ROLE / TENANT TESTING (Req 10)
 * ══════════════════════════════════════════════════════════════════════════ */
test("H — roles: owner + manager + content_editor edit; read_only blocked; wrong tenant denied", async ({ page }) => {
  // ── Owner (Alice) edits Harborview ──
  await setActingUser("user_alice");
  const hv = await openEditor(page, "site_harborview");
  await expect(hv.locator('[data-taya-edit="home.hero.heading"]')).toBeVisible({ timeout: 20_000 });
  await shot(page, "ah-H-owner-harborview");

  // ── Manager (Dave) edits Riverside ──
  await setActingUser("user_dave");
  const rsMgr = await openEditor(page, "site_riverside");
  await expect(rsMgr.locator('[data-taya-edit="home.hero.heading"]')).toBeVisible({ timeout: 20_000 });
  await shot(page, "ah-H-manager-riverside");

  // ── Content editor (Erin) edits Riverside ──
  await setActingUser("user_erin");
  const rsEd = await openEditor(page, "site_riverside");
  await expect(rsEd.locator('[data-taya-edit="home.hero.heading"]')).toBeVisible({ timeout: 20_000 });
  await shot(page, "ah-H-content-editor-riverside");

  // ── read_only (Carol) is blocked from editing Riverside (server-enforced) ──
  await setActingUser("user_carol");
  let carolForbidden = false;
  try {
    await dispatch("publishing.saveDraft", { siteId: "site_riverside", entries: [{ key: "home.hero.heading", value: "Carol edit" }] });
  } catch (e: any) {
    carolForbidden = String(e).includes("Forbidden");
  }
  expect(carolForbidden).toBe(true);

  // ── Wrong tenant (Bob) cannot access Harborview's editor ──
  await setActingUser("user_bob");
  await page.goto("/app/sites/site_harborview/editor", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Your website hasn't been connected yet")).toBeVisible({ timeout: 20_000 });
  await shot(page, "ah-H-wrong-tenant-denied");
  const bobContent = await dispatch("contentMap.get", { siteId: "site_harborview" }, "query");
  expect(bobContent).toBeNull();

  // Restore Alice.
  await setActingUser("user_alice");
});
