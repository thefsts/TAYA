# TAYA — Chat 2 Final Visual Editor Coverage / Client Editing Acceptance

**Mission:** Finish and prove the Phase 6 Visual Editor coverage so a client
can edit every ordinary piece of their website content, while FSTS keeps
ownership of the protected design system.

**Status:** COMPLETE — all suites green, all A–H Chromium acceptance scenarios
pass with evidence.

---

## 1. Repository / Git

| Field | Value |
|---|---|
| Repository | `thefsts/TAYA` |
| Git identity | `thefsts <amorebey@gmail.com>` |
| Branch | `chat2/visual-editor-coverage` |
| Base | `origin/fsts/client-website-mgmt-completion` (PR #58 head) |
| PR #58 head at assignment | `78539841a41d2a465fad6ef8dc20d923e7035c1a` (OPEN, GREEN, UNMERGED) |
| `origin/main` at assignment | `af290ea7584403f37cdb10ed5c3aacef9e1da3d6` |
| PR #58 merged? | NO — left untouched |
| Merged to main? | NO |
| Force push? | NO |

The branch is **stacked on PR #58's head**, so the seven files that overlap
with PR #58 already contain PR #58's work; my changes are strictly additive
on top (verified: no PR #58 line is reverted — every deletion in the diff is
my own refactor of the image control into image/background + alt companions).

---

## 2. What was already owned by Chat D / PR #58 (NOT duplicated)

In-app Clerk Account/Sign Out corrections, Site Health client access, Health
no longer falsely Design Locked, Navigation/Footer client permission
corrections, direct PDF upload infrastructure, SEO import from discovery,
client GA4, client GTM, Google Search Console verification, Page SEO inside
the Visual Editor, ordinary button/link destination discovery `.href` keys,
visible "+ Add link" action, Welcome Tour persistence fix, narrow editor rail
block-name layout fix, owner-acceptance browser harness additions.

All of the above were **preserved** and consumed, never recreated.

---

## 3. What this mission added (the remaining coverage)

### 3.1 Hero editing completion (Req 1)
- `convex/lib/discovery/html.ts`: `PageModel.hero` extended with `imageAlt`,
  `backgroundImage`, `secondaryButton`; `extractHero` now collects the
  primary **and** secondary CTA, the hero image alt, and the hero background
  image. New exported helper `heroBoundaryOffset(bodyHtml)` scopes hero
  button detection so a later section's CTA is never mistaken for the hero's
  secondary button.
- `convex/lib/editorAnnotate.ts`: annotates `hero.image.alt`,
  `hero.backgroundImage` (type `background`), `hero.secondaryButton.label`,
  and the secondary `.href` companion.
- `convex/lib/discovery/crawl.ts`: folds the new hero keys into the content
  map.
- `convex/lib/editorFrame.ts`: `applyValue` handles `type === "background"`
  (`el.style.backgroundImage`); `applyOverlay` folds `.alt` onto `<img>`.
- `lib/web-bridge/src/snippet.ts`: the published-site snippet applies
  `background` and folds `.alt` companions.
- `convex/publishing.ts`: `guardLinkValue` passes through `background`.

### 3.2 Image alt-text workflow (Req 2)
- Alt text is now an editable companion key (`.alt`) that rides its base
  image element through discovery, annotation, the frame overlay, the
  published snippet, and the editor.
- `VisualEditor.tsx`: `EditControl` renders an **Alt text** input for image
  and background controls; `applyDraftPreview` folds `.alt` companions into
  the base entry's `alt` field.
- `ImagePickerField.tsx`: new `onAltChange` prop propagates the alt text
  typed in the Media Library dialog back to the content map.

### 3.3 Video / PDF / Form workflows (Req 3–5)
Already present from Phase 6 + Chat D; verified end-to-end in the A–H
acceptance run (YouTube + Vimeo add, arbitrary embed HTML rejected; managed
PDF picker + direct upload; form placement routed to the EXISTING FormBuilder
with a clean return).

### 3.4 Coverage matrix (Req 6)
Machine-checked matrix written by acceptance test F to
`tests/live-ux/evidence/ah-F-coverage-matrix.json` and committed as
`docs/visual-editor-coverage-matrix.json`. Every sampled item is classified
EDITABLE / FSTS DESIGN LOCKED / UNSUPPORTED BY CURRENT SITE CONTRACT / BUG.
**BUG count: 0.**

### 3.5 Button audit (Req 8)
`docs/visual-editor-button-audit.md` — every control is WORKS / DISABLED WITH
CLEAR REASON / HIDDEN BY PERMISSION / FSTS DESIGN LOCKED WITH EXPLANATION.
**0 dead, 0 empty, 0 silent, 0 fake buttons.**

---

## 4. Test results (all green)

| Suite | Result |
|---|---|
| live-ux (incl. A–H acceptance, owner-acceptance, responsive-a11y, protocol-parity) | **41 / 41 passed** |
| convex-unit | **1015 / 1015 passed** |
| dashboard | **499 / 499 passed** |
| design-lock | **50 / 50 passed** |
| typecheck | **green** |
| production build | **EXIT = 0** |

No test was weakened.

---

## 5. Chromium acceptance A–H (Req 13)

`tests/live-ux/tests/acceptance-ah.spec.ts` — **9 / 9 passed**, real Chromium,
real dashboard components, real frame protocol. Evidence screenshots in
`tests/live-ux/evidence/ah-*.png` (22 files) plus the matrix JSON.

| Scenario | Result |
|---|---|
| A — hero completion (headline, subheadline, both CTAs, image, background, alt) | PASS |
| B — image workflow (replace + alt → Save Draft → Preview → Publish → reload persists) | PASS |
| B2 — Add Image via the EXISTING Media Library | PASS |
| C — video workflow (YouTube + Vimeo, reject arbitrary embed HTML) | PASS |
| D — PDF/resource (managed picker + direct upload, Chat D contract) | PASS |
| E — form placement (choose existing form → EXISTING FormBuilder → clean return) | PASS |
| F — coverage matrix (every sampled item EDITABLE or honestly classified) | PASS |
| G — design lock (ordinary content succeeds AND protected design changes fail) | PASS |
| H — roles (owner + manager + content_editor edit; read_only blocked; wrong tenant denied) | PASS |

---

## 6. Design Lock (Req 9)

Proven both ways in acceptance test G: ordinary content edits succeed, and
protected design changes fail with the plain-language locked notice rendered
in a `role="status"` region ("That part of the page is managed by FSTS.
Contact your TAYA representative to make changes.").

---

## 7. Role / tenant testing (Req 10)

Acceptance test H: owner (harborview) edits, manager (riverside) edits,
content_editor (riverside) edits, read_only is blocked, and a wrong-tenant
user is denied. RBAC is enforced server-side; the client mirrors it.

---

## 8. Responsive + accessibility (Req 11–12)

`tests/live-ux/tests/responsive-a11y.spec.ts` (5 tests) covers the device
toggle, the 1440 / 1024 / 768 / 390 viewports keeping Save/Publish reachable,
keyboard selection in the preview, the locked-content status region, the
labeled alt-text workflow, and labeled client controls. The PR #57
full-screen layout (left rail ~28–30%, right live site filling the rest) is
preserved.

---

## 9. Final declarations

- **MERGE READY: NO**
- **DO NOT MERGE. Stop for PM review.**
