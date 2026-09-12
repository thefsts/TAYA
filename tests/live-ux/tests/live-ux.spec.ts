/**
 * live-ux.spec.ts — Chat B §5: the 15 mandatory LIVE UX flows.
 *
 * Every flow drives the REAL client experience in real Chromium against the
 * harness's three origins (dashboard 4173 / convex 7788 / site 4175):
 *
 *   Dashboard → Edit Website → live site in the editor iframe → click a real
 *   element → the simple contextual editor → the change previews →
 *   Save Draft → Preview → Publish → reload (persists) → History/Restore.
 *
 * Nothing is mocked INSIDE the browser: the driver page runs the REAL
 * VisualEditor.tsx via the same wouter Route production App.tsx registers,
 * the iframe renders the REAL annotated page (buildFrameDocument) with the
 * REAL bridge contract, and mutations hit the harness store that mirrors
 * convex/publishing.ts + convex/editor.ts + convex/editorZones.ts.
 *
 * Flow numbering follows the Chat B mandate:
 *  1  click real heading → edit            9  locked/unsupported → explanation
 *  2  click paragraph → edit              10  Save Draft
 *  3  click image → replace/alt           11  Preview draft on actual site
 *  4  click button → label+destination    12  Publish
 *  5  add YouTube/Vimeo video             13  reload → published persists
 *  6  add/select managed PDF              14  History open + restore
 *  7  edit repeatable item (structural)   15  another tenant cannot access
 *  8  add permitted block to safe spot
 */
import { test, expect, type Page, type Frame } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/* ── constants ──────────────────────────────────────────────────────── */
const EDITOR_URL = "/app/sites/site_harborview/editor";
const DASHBOARD = "https://127.0.0.1:4173";
const SITE_ORIGIN = "https://127.0.0.1:4175";
const CONVEX_ORIGIN = "https://127.0.0.1:7788";
const PREVIEW_TOKEN = "a1b2c3d4e5f6a7b8"; // harborview preview token (harness store)
const EVIDENCE_DIR = path.join(__dirname, "..", "evidence");

/* ── harness control channel (server-side, not browser-side) ────────── */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // harness cert is self-signed

async function harnessReset() {
  const res = await fetch(`${DASHBOARD}/harness/reset`, { method: "POST" });
  if (res.status !== 201) throw new Error(`reset failed: ${res.status}`);
}

async function setActingUser(userId: string) {
  const res = await fetch(`${DASHBOARD}/harness/acting-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(`acting-user failed: ${res.status}`);
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

/** Dispatcher call into the harness store (mirrors convex mutations). */
async function dispatch(path: string, args: Record<string, unknown>, kind: "query" | "mutation" | "action" = "mutation") {
  const res = await fetch(`${DASHBOARD}/harness/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, kind }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${path}: ${body.error}`);
  return body.data;
}

/* ── editor-page helpers ────────────────────────────────────────────── */
/** The editor iframe renders at the convex origin (/api/editor/frame?…). */
async function editorFrame(page: Page): Promise<Frame> {
  await expect
    .poll(() => Promise.resolve(page.frames().some((f) => f.url().includes("/api/editor/frame"))), { timeout: 20_000 })
    .toBe(true);
  return page.frames().find((f) => f.url().includes("/api/editor/frame"))!;
}

async function openEditor(page: Page): Promise<Frame> {
  await page.goto(EDITOR_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Visual Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  const frame = await editorFrame(page);
  await frame.waitForSelector("[data-taya-edit]", { timeout: 20_000 });
  return frame;
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true });
}

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 1 — click a real heading in the live preview → edit it
 * ════════════════════════════════════════════════════════════════════ */
test("flow 1 — click real heading → edit and see the change", async ({ page }) => {
  const frame = await openEditor(page);

  // The heading on the REAL rendered page inside the editor.
  const heading = frame.locator('[data-taya-edit="home.hero.heading"]');
  await expect(heading).toHaveText("Welcome to Harborview Dental");
  await heading.click();

  // The contextual editor identifies it plainly: "Heading", never a §5 key.
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Type a new heading like a client would.
  const textarea = page.locator("textarea").first();
  await textarea.fill("Welcome to Harborview Dental Care");
  await shot(page, "flow01-heading-edit");

  // The draft preview applies to the REAL rendered page immediately.
  await expect(heading).toHaveText("Welcome to Harborview Dental Care", { timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 2 — click a paragraph → edit it
 * ════════════════════════════════════════════════════════════════════ */
test("flow 2 — click real paragraph → edit and see the change", async ({ page }) => {
  const frame = await openEditor(page);

  const sub = frame.locator('[data-taya-edit="home.hero.subheading"]');
  await sub.click();

  await expect(page.getByText("Paragraph", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Gentle, modern dental care for your whole family.");
  await shot(page, "flow02-paragraph-edit");

  await expect(sub).toHaveText("Gentle, modern dental care for your whole family.", { timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 3 — click image → replace + alt text
 * ════════════════════════════════════════════════════════════════════ */
test("flow 3 — click image → replace image and set alt text", async ({ page }) => {
  const frame = await openEditor(page);

  const img = frame.locator('[data-taya-edit="home.hero.image"]');
  await img.click();

  await expect(page.getByText("Image", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // ImagePickerField → SmartImageEditor dialog → "URL" tab.
  await page.getByRole("button", { name: "Change Image" }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow03-image-dialog");
  await page.getByRole("button", { name: "URL", exact: true }).click();

  const NEW_URL = "https://images.unsplash.com/photo-1588776814546-1ffcf0f8f2a3?w=1200&q=80";
  await dialog.locator('[aria-label="Image URL"]').fill(NEW_URL);
  await dialog.locator('[aria-label="Alt Text"]').fill("A calm, bright dental treatment room");
  await shot(page, "flow03-image-filled");
  await dialog.getByRole("button", { name: "Save Image" }).click();

  // The dialog closes and the picker applies the new URL to the preview.
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await shot(page, "flow03-image-applied");

  // The REAL rendered page now shows the new image (draft preview).
  await expect(img).toHaveAttribute("src", NEW_URL, { timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 4 — click button → label + destination
 * ════════════════════════════════════════════════════════════════════ */
test("flow 4 — click button → edit label and destination", async ({ page }) => {
  const frame = await openEditor(page);

  const btn = frame.locator('[data-taya-edit="home.hero.primaryButton.label"]');
  await expect(btn).toHaveText("Book an appointment");
  await btn.click();

  await expect(page.getByText("Button", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Label + Destination side by side (companion href key rides the entry).
  const labelInput = page.locator("input").first();
  await labelInput.fill("Book your visit");

  const destInput = page.locator('input[placeholder*="/about"]').first();
  await destInput.fill("/services");
  await shot(page, "flow04-button-edit");

  // Destination verdict badge — client-language classification.
  await expect(page.getByText("Page on this site", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  await expect(btn).toHaveText("Book your visit", { timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 5 — add a YouTube video in an allowed location
 * ════════════════════════════════════════════════════════════════════ */
test("flow 5 — add YouTube video to the video area", async ({ page }) => {
  const frame = await openEditor(page);

  // "+ Add content to this page" → "+ Add video" → "Video area".
  await page.getByRole("button", { name: "Add content to this page" }).click();
  await shot(page, "flow05-add-panel-open");
  await page.getByRole("button", { name: "+ Add video" }).click();
  await shot(page, "flow05-where-chips");
  await page.getByRole("button", { name: "Video area", exact: true }).click();

  // BlockForm: "Video link (YouTube or Vimeo)" + provider detection card.
  await page.getByLabel("Video link (YouTube or Vimeo)").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(page.getByText("youtube video detected")).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Caption (optional)").fill("Meet Dr. Lee and the team");
  await shot(page, "flow05-video-form");

  await page.getByRole("button", { name: "Add to page" }).click();

  // The block appears in the "Content blocks on this page" list (draft state)
  // AND on the REAL rendered page in the video area.
  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Meet Dr. Lee and the team").first()).toBeVisible({ timeout: 10_000 });
  const videoCard = frame.locator('[data-taya-block-id] a.taya-video-card, [data-taya-block-id] .taya-video-card').first();
  await expect(videoCard).toBeVisible({ timeout: 15_000 });
  await shot(page, "flow05-video-added");

  // Workflow: adding a block IS a draft ("Draft saved — preview or publish").
  await expect(page.getByText("Draft saved — preview or publish")).toBeVisible({ timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 6 — add/select a managed PDF resource
 * ════════════════════════════════════════════════════════════════════ */
test("flow 6 — add managed PDF resource to the main content area", async ({ page }) => {
  const frame = await openEditor(page);

  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add resource" }).click();
  // PDFs are allowed in: content / article-feed / resource-grid / service-list.
  await page.getByRole("button", { name: "Main content area", exact: true }).click();

  // The select lists the site's MANAGED downloads (dl_new_patient).
  const pdfSelect = page.locator("select");
  // The option's VALUE is the managed download id (its text is just the
  // title - the harness download has no format suffix).
  await pdfSelect.selectOption("dl_new_patient");
  await page.getByLabel("Title", { exact: true }).fill("New Patient Form");
  await shot(page, "flow06-pdf-form");

  await page.getByRole("button", { name: "Add to page" }).click();

  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("New Patient Form").first()).toBeVisible({ timeout: 10_000 });
  const pdfCard = frame.locator('[data-taya-block-id] .taya-pdf-card, [data-taya-block-id] a.taya-pdf-card').first();
  await expect(pdfCard).toBeVisible({ timeout: 15_000 });
  await shot(page, "flow06-pdf-added");
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 7 — edit a repeatable item (click + structural op)
 * ════════════════════════════════════════════════════════════════════ */
test("flow 7 — click a repeatable service item → edit + Move up", async ({ page }) => {
  const frame = await openEditor(page);

  // A repeatable item title on the REAL page (item 1 of the services list).
  const item = frame.locator('[data-taya-edit="home.services.items[1].title"]');
  await item.click();

  // The card identifies it as a "Heading" (kindOf classifies H1-H6 as
  // heading before list_item) + the section panel lists the items.
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Teeth Whitening & Cosmetic Care");
  await shot(page, "flow07-item-edit");

  // Structural: "Sections with repeatable items" → Move item 2 up.
  const itemsPanel = page.locator("div").filter({ hasText: "Sections with repeatable items" }).first();
  await expect(itemsPanel).toBeVisible({ timeout: 10_000 });
  // Home has TWO repeatable sections (services + faq) \u2014 scope to the
  // services row so the locator is unique ("Homepage \u00b7 services \u00b7 items 1").
  const row2 = itemsPanel.locator("div.rounded-md", { hasText: "services \u00b7 items 1" });
  await row2.getByRole("button", { name: "Move up" }).click();
  await shot(page, "flow07-item-moved");

  // The REAL page reflects the new order (draft preview via structural ops).
  const firstService = frame.locator('[data-taya-edit^="home.services.items["][data-taya-edit$=".title"]').first();
  await expect(firstService).toHaveText("Teeth Whitening & Cosmetic Care", { timeout: 10_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 8 — add a permitted block to a safe location
 * ═══════════════════════════════════════════════════════ workflow 8 ══ */
test("flow 8 — add permitted text block to a safe location", async ({ page }) => {
  const frame = await openEditor(page);

  await page.getByRole("button", { name: "Add content to this page" }).click();
  await page.getByRole("button", { name: "+ Add text" }).click();
  // hero, content, video-section, faq-list, cta-stack, footer all allow text;
  // pick "Main content area" (content zone).
  await page.getByRole("button", { name: "Main content area", exact: true }).click();

  // BlockForm for text: a textarea.
  await page.getByLabel("Text", { exact: true }).fill("Now accepting new patients — book today.");
  // Honest wording shows WHILE the form is open (where the block will
  // live, in client language — never a zone id).
  await expect(page.getByText("It will show up in the main content area", { exact: false })).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow08-text-form");
  await page.getByRole("button", { name: "Add to page" }).click();

  await expect(page.getByText("Content blocks on this page")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Now accepting new patients — book today.").first()).toBeVisible({ timeout: 10_000 });
  const textBlock = frame.locator('[data-taya-block-id]').filter({ hasText: "Now accepting new patients" }).first();
  await expect(textBlock).toBeVisible({ timeout: 15_000 });
  await shot(page, "flow08-text-added");
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 9 — locked/unsupported insertion → clear explanation (never silent)
 * ════════════════════════════════════════════════════════════════════ */
test("flow 9 — locked areas and unsupported insertions are explained", async ({ page }) => {
  const frame = await openEditor(page);

  // (a) Click a non-annotated area of the nav bar itself - the FAR RIGHT of
  // the bar, past the last link, so the hit target is the bar (design-locked
  // layout chrome), never one of the inline links at the left edge.
  const navBar = frame.locator("nav.site-nav").first();
  const navBox = await navBar.boundingBox();
  const navRight = Math.max(60, (navBox?.width ?? 200) - 10);
  await navBar.click({ position: { x: navRight, y: 12 } });
  await expect(
    page.getByText("That part of the page is managed by FSTS. Contact your TAYA representative to make changes."),
  ).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow09-locked-nav");

  // (b) An external link click is explained, never silently ignored.
  await frame.locator('nav.site-nav a[href^="https://facebook.com"]').click();
  await expect(
    page.getByText("Links to other websites open on the live site. To keep your edits safe, they are not followed inside the editor."),
  ).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow09-external-link");

  // (c) Unsupported insertion on /faq: images and PDFs have no allowed zone
  // on that page → the chips are disabled + the honest sentence shows.
  // Scope to main: the sidebar also has a "FAQ" nav item, but the page
  // pill is the one inside the editor body (button.rounded-full).
  await page.getByRole("main").getByRole("button", { name: "FAQ", exact: true }).click(); // page pill

  // The page-pill click REMOUNTS the iframe (its key is frameUrl, which
  // changes with the path) so the captured handle goes stale. Poll for the
  // LIVE /faq frame (the iframe src is /api/editor/frame?token=...&path=%2Ffaq)
  // and wait for its real heading binding to be stamped. Ground-truth key on
  // /faq is "faq.heading" (sectionKeyRoot("/faq", "faq") collapses to the page
  // segment itself - not "faq.page.heading").
  await expect
    .poll(
      async () =>
        Promise.all(
          page
            .frames()
            .filter((f) => f.url().includes("path=%2Ffaq"))
            .map((f) => f.locator('[data-taya-edit="faq.heading"]').count()),
        ),
      { timeout: 20_000 },
    )
    .toEqual([1]);

  // Open the Add panel (chips only exist once it is open).
  await page.getByRole("button", { name: "Add content to this page" }).click();

  // Image and PDF have no allowed zone on /faq — chips disabled + the
  // honest plain-language sentence (never silent).
  const imageChip = page.getByRole("button", { name: "+ Add image" });
  await expect(imageChip).toBeVisible({ timeout: 10_000 });
  await expect(imageChip).toBeDisabled();
  const pdfChip = page.getByRole("button", { name: "+ Add resource" });
  await expect(pdfChip).toBeDisabled();
  await expect(
    page.getByText("Images, PDF resources can't be added to this page — its set areas don't include a spot for them.", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });

  // And the page's OWN content type is offered: a client CAN add a Q&A to
  // their FAQ page (the dedicated-page section resolves the FAQ-list zone).
  const faqChip = page.getByRole("button", { name: "+ Add FAQ" });
  await expect(faqChip).toBeEnabled();
  await shot(page, "flow09-unsupported-faq");
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 10 + 11 — Save Draft → Preview the draft ON THE ACTUAL SITE
 * ════════════════════════════════════════════════════════════════════ */
test("flow 10+11 — Save Draft → see the draft on the actual site (preview)", async ({ page }) => {
  const frame = await openEditor(page);

  // Make a real edit (heading), then Save Draft.
  const heading = frame.locator('[data-taya-edit="home.hero.heading"]');
  await heading.click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await page.locator("textarea").first().fill("Preview Draft Heading (Alice)");
  await expect(heading).toHaveText("Preview Draft Heading (Alice)", { timeout: 10_000 });

  await shot(page, "flow10-before-save");
  await page.getByRole("button", { name: "Save Draft" }).click();
  // The banner confirms the draft is server-saved.
  await expect(page.getByText("Draft saved — preview or publish")).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow10-draft-saved");

  // The server now holds the draft (saveDraft wrote entries to the store).
  const state = await harnessState();
  const hv = state.sites.find((s: any) => s.siteId === "site_harborview");
  expect(hv.drafts).toContain("home.hero.heading");

  // FLOW 11 — the draft is visible on the ACTUAL SITE at the preview URL.
  // The site origin serves the real HTML + REAL bridge snippet; the snippet
  // fetches convex /api/bridge/draft with the taya_preview token and shows
  // the draft overlay INSTEAD of the published values.
  await page.goto(`${SITE_ORIGIN}/?taya_preview=${PREVIEW_TOKEN}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1, h2, [data-taya-edit]", { timeout: 15_000 });
  // taya:preview-applied event fires when the overlay lands.
  await page.waitForFunction(
    () => (window as any).__tayaPreviewApplied === true,
    { timeout: 15_000 },
  ).catch(() => {});
  const siteHeading = page.locator("h1, h2").first();
  await expect(siteHeading).toHaveText("Preview Draft Heading (Alice)", { timeout: 15_000 });
  await shot(page, "flow11-site-preview");

  // And WITHOUT the token the public site still shows the published value.
  await page.goto(SITE_ORIGIN + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200); // bridge content pass
  const publicHeading = page.locator("h1, h2").first();
  await expect(publicHeading).toHaveText("Welcome to Harborview Dental", { timeout: 15_000 });
  await shot(page, "flow11-site-public");
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 12 + 13 — Publish → reload → published content persists
 * ════════════════════════════════════════════════════════════════════ */
test("flow 12+13 — Publish → reload → published values persist everywhere", async ({ page }) => {
  const frame = await openEditor(page);

  // Edit the hero heading and save as a draft.
  const heading = frame.locator('[data-taya-edit="home.hero.heading"]');
  await heading.click();
  await page.locator("textarea").first().fill("Published Heading (Alice)");
  await expect(heading).toHaveText("Published Heading (Alice)", { timeout: 10_000 });
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText("Draft saved — preview or publish")).toBeVisible({ timeout: 10_000 });

  // FLOW 12 — Publish.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published to the live website")).toBeVisible({ timeout: 15_000 });
  await shot(page, "flow12-published");

  // The PUBLIC site now serves the published value (no token needed).
  const content = await bridgeContent("harborview");
  expect(content.values["home.hero.heading"]).toBe("Published Heading (Alice)");

  // FLOW 13 — reload the editor: the published value persists.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Visual Editor", exact: true })).toBeVisible({ timeout: 20_000 });
  const frame2 = await editorFrame(page);
  await frame2.waitForSelector('[data-taya-edit="home.hero.heading"]', { timeout: 20_000 });
  await expect(frame2.locator('[data-taya-edit="home.hero.heading"]')).toHaveText("Published Heading (Alice)");
  await shot(page, "flow13-reload-persists");

  // And the server recorded the revision (History will show it).
  const state = await harnessState();
  const hv = state.sites.find((s: any) => s.siteId === "site_harborview");
  expect(hv.revisions.length).toBe(1);
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 14 — History open + restore an earlier revision
 * ════════════════════════════════════════════════════════════════════ */
test("flow 14 — History → restore earlier revision as draft", async ({ page }) => {
  // Seed two published revisions: v1, then v2 (restore will target v1).
  await dispatch("publishing.saveDraft", { siteId: "site_harborview", entries: [{ key: "home.hero.heading", value: "Revision One Heading" }] });
  await dispatch("publishing.publishContentMap", { siteId: "site_harborview" });
  await dispatch("publishing.saveDraft", { siteId: "site_harborview", entries: [{ key: "home.hero.heading", value: "Revision Two Heading" }] });
  await dispatch("publishing.publishContentMap", { siteId: "site_harborview" });

  const frame = await openEditor(page);

  // The live page shows the CURRENT (v2) value.
  await expect(frame.locator('[data-taya-edit="home.hero.heading"]')).toHaveText("Revision Two Heading");

  // Open History.
  // Exact match: "History" substring-matches the sidebar's "Version
  // History" button; "Version history" case-insensitively matches it too.
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Version history", { exact: true })).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow14-history-open");

  // Both revisions are listed, newest first, with their summaries. Scope
  // to the Restore button's own row (the row div directly wrapping each
  // button + summary); a bare div filter would over-match every ancestor.
  const rows = page
    .getByRole("button", { name: "Restore", exact: true })
    .locator("xpath=ancestor::div[1]")
    .filter({ hasText: "Published 1 value to the live website" });
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });

  // Restore the EARLIER revision (the second row = older).
  const restoreButtons = page.getByRole("button", { name: "Restore", exact: true });
  await expect(restoreButtons.first()).toBeVisible();
  await restoreButtons.nth(1).click();
  await expect(page.getByText("Previous version restored as a draft. Review it, then publish when ready.")).toBeVisible({ timeout: 10_000 });
  await shot(page, "flow14-restored");

  // The restored draft previews on the REAL page. Restore REMOUNTS the
  // iframe (a fresh token via loadFrame) so the captured handle is stale;
  // poll for the CURRENT frame instead.
  await expect
    .poll(() => Promise.resolve(page.frames().some((f) => f.url().includes("/api/editor/frame"))), { timeout: 20_000 })
    .toBe(true);
  const liveFrame14 = page.frames().find((f) => f.url().includes("/api/editor/frame"))!;
  await expect(
    liveFrame14.locator('[data-taya-edit="home.hero.heading"]'),
  ).toHaveText("Revision One Heading", { timeout: 15_000 });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOW 15 — another tenant cannot access or edit this site
 * ════════════════════════════════════════════════════════════════════ */
test("flow 15 — another tenant (Bob) cannot access Harborview's editor", async ({ page }) => {
  // Alice publishes something so Harborview has content on the line.
  await dispatch("publishing.saveDraft", { siteId: "site_harborview", entries: [{ key: "home.hero.heading", value: "Alice Only Heading" }] });
  await dispatch("publishing.publishContentMap", { siteId: "site_harborview" });

  // Bob tries to open Harborview's editor. Production parity: site-scoped
  // QUERIES return null/[] for a caller without access (only mutations
  // throw Forbidden), so the UI degrades honestly to the EmptyState.
  await setActingUser("user_bob");
  await page.goto(EDITOR_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Your website hasn't been connected yet")).toBeVisible({ timeout: 20_000 });
  await shot(page, "flow15-bob-denied");

  // No site data leaks: the bridge keeps serving Harborview's public values,
  // Bob's site-scoped QUERY returns null (production parity - queries never
  // leak data and never throw), and Bob's MUTATION is rejected Forbidden.
  const bobContent = await dispatch("contentMap.get", { siteId: "site_harborview" }, "query");
  expect(bobContent).toBeNull();
  const bobSave = await dispatch("publishing.saveDraft", { siteId: "site_harborview", entries: [] }, "mutation").catch((e) => e.message);
  expect(bobSave).toContain("Forbidden");

  const state = await harnessState();
  const hv = state.sites.find((s: any) => s.siteId === "site_harborview");
  expect(hv.drafts).toEqual([]); // Alice's publish already cleared drafts
  expect(hv.members).toEqual(["user_alice"]); // membership unchanged

  // Restore Alice for subsequent tests.
  await setActingUser("user_alice");
});
