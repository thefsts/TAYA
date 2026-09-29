# Phase 1 — Editor Completion — E11 Final Report

**Status:** COMPLETE — **DO NOT MERGE — STOP FOR PM REVIEW**
**Branch:** `fsts/phase1-editor-completion`
**Base:** exact `main @ 9f86e01` (`9f86e0168b2601ef631afbffc6205d63831e2ba8`)
**Identity:** `thefsts <amorebey@gmail.com>` (all Phase-1 commits)
**Remote HEAD == local HEAD:** `6b8ea7f` (verified via `git ls-remote` + `FETCH_HEAD`)
**Draft PR:** https://github.com/thefsts/TAYA/pull/63 (base `main`, DRAFT)

---

## 1. What this branch delivers

TAYA edits **existing external websites in place** — it crawls a live site
(discovery), builds a semantic content map, and lets clients edit in place via
a bridge/iframe. This branch completes the Phase-1 "use it myself" mission:
the editor-completion work (E1–E9), the full verification battery (E10), the
live-UX contract alignment (E10b), and this report (E11).

### Commit ledger (all authored `thefsts <amorebey@gmail.com>`)

| SHA | Scope | Summary |
|-----|-------|---------|
| `f461e04` | E1–E3 | Widen insertable kinds; fix nav feel; kill white flash |
| `fb4ea2c` | E4–E6 | Annotator audit lock; resizable rail; Media Library insert |
| `3e74e45` | E7–E8 | Video scope flag; TAYA Web Bridge install runbook |
| `88f8a1d` | E9 | Offline acceptance harness (fixture + capture + audit) |
| `6b8ea7f` | E10b | Align live-ux specs with E2 nav-chrome contract + E1 widening |

Pushes were normal (no force). Each checkpoint was pushed early and the remote
SHA verified after each push (E1–E3, E4–E6, E7–E8, E9, E10b).

---

## 2. Workstream detail

### E1 — Widen `ZONE_ALLOWED_KINDS`
`convex/lib/editorZones.ts`: ordinary content (`image`, `link`) is now addable
wherever it genuinely belongs, on every page — not only in the single generic
`content` zone. Structured, section-specific kinds (`faq_item`, `cta`) stay
scoped to the zones whose sections host them. The protected boundary is
untouched (no arbitrary HTML/scripts; structure/layout remain Design-Locked).
Unit tests updated: `tests/convex-unit/src/editorZones.test.ts` (32/32).

### E2 — Navigation fixes (`VisualEditor.tsx` + `editorFrame.ts`)
- **Honest notice** when a clicked same-site path is not in the discovered
  page set (never a silent no-op).
- **Demote** the always-visible page pill strip to a compact **"Choose a page"**
  fallback picker (`aria-haspopup="menu"`, `role="menuitem"` page buttons). The
  in-frame site nav becomes the PRIMARY page switcher.
- **Narrow the locked-click notice** so nav/header/footer **CHROME** is silent.
  Before this change, clicking any non-annotated area of the nav fired the
  "managed by FSTS" notice, which the client reported as "the nav feels locked".
  The guard is mission-mandated (mission "Root cause 2 … it is a bug, not the
  Design Lock policy" / "A1 … not for nav containers, logos, or non-link nav
  areas") and is **kept**.

### E3 — White-flash fix
`frameLoading` state; removed `key={frameUrl}`; busy overlay rendered from the
first moment the frame is (re)mounted.

### E4 — Annotator omissions audit + locking test
Audit found the base annotator **already** stamps section `.body` 1:1 and
`.footer.text` → **flagged as base-implemented** (see §4). Fixed the stale
header comment in `convex/lib/editorAnnotate.ts` to an honest-binding policy
block; added the A4 lock test in `tests/convex-unit/src/editor.test.ts` (36/36).

### E5 — Resizable editor rail
`railWidth` state + `clampRailWidth(280..600)`; pointer drag + keyboard
(Arrow / Shift+Arrow); `role="separator"` with `aria-valuenow/min/max`;
`--rail-w` CSS var. Tests in `artifacts/fsts-dashboard/src/test/visual-editor.test.tsx`.

### E6 — Media Library insert surface
New `artifacts/fsts-dashboard/src/components/MediaLibraryInsert.tsx`; wired
"Browse Media Library" into `BlockForm` (image/pdf/video scoped to kind).

### E7 — Video-by-URL confirm
Confirmed `convex/lib/videoEmbeds.ts` `parseVideoUrl` supports **YouTube +
Vimeo only** (parity 3/3). **Flagged** the mission-text discrepancy (mission
mentions Wistia/HTML5) in `docs/PHASE1_E7_VIDEO_SCOPE_FLAG.md`: discovery is
wide, the editor is YouTube+Vimeo by design.

### E8 — Multi-site onboarding + bridge verification + runbook
Verified multi-site onboarding (self-service + admin; 109/109) and the TAYA Web
Bridge install/verification contract (51/51). Created
`docs/TAYA_WEB_BRIDGE_INSTALL_RUNBOOK.md`.

### E9 — Offline acceptance harness
`tests/fixtures/sample-site-snapshot/` (manifest + pages + captured snapshot);
`tests/convex-unit/src/acceptance-harness.test.ts` (6/6; zones match surviving
materials exactly); `tests/acceptance-harness/capture-snapshot.mjs`; audit doc
`docs/PHASE1_E9_ACCEPTANCE_HARNESS.md`.

### E10 — Full verification battery
Full convex-unit, full dashboard (vitest), typecheck (convex + dashboard),
production build, and every named suite (Design Lock, RBAC, tenant isolation,
Visual Editor, discovery/content-map, bridge, publishing/history, downloads,
media, forms, SEO, live-ux, owner-acceptance, responsive-a11y, protocol-parity).

### E10b — Live-UX contract alignment (this commit)
Aligned the 7 stale live-ux specs with the E2 nav-chrome contract and the E1
zone widening. See §3.

---

## 3. E10b — locked product behavior & spec updates

### Locked product behavior (the contract now enforced by the specs)
- Clicking a real website navigation **LINK** navigates inside TAYA.
- Clicking navigation/header/footer **CHROME**, the logo area, or non-link
  whitespace does **NOT** show the "managed by FSTS" Design Lock notice.
- The Design Lock notice appears **only** when the client actually attempts to
  edit/change genuinely protected structure.
- Nav/header/footer structure is **NOT** made editable to satisfy this.
- Design Lock is **NOT** weakened; the old "nav feels locked" behavior is
  **NOT** restored.

### Specs updated (only stale assertions encoding the old behavior)
| Spec | Change |
|------|--------|
| `acceptance-ah` F | Nav-chrome click now asserted **silent** via `expectNavChromeSilent` (no notice, no false edit affordance, no navigation); coverage-matrix classification updated. |
| `acceptance-ah` G | Silent nav-chrome tail; **NEW G2** positive Design Lock test. |
| `live-ux` flow 9 | Part (a) silent nav chrome; part (c) switched to the "Choose a page" picker (E2 removed the page pill). |
| `owner-acceptance` A7 /services | `switchToPage` via the picker; corrected the E1-induced stale chip assertion. |
| `owner-acceptance` A7 /faq | `switchToPage` via the picker + silent nav chrome. |
| `owner-acceptance` A7 home | Silent nav chrome. |
| `responsive-a11y` locked-notice | Notice exercised on a **genuinely protected structural area** (`ul.card-list` container) and still asserted as a `role="status"` region. |

### New positive Design Lock test (G2)
Proves the lock is **narrowed, not removed**: as a client owner (not a
super-admin), `siteSettings.updateBranding` / `updateIdentity` /
`updateIntegrations` and `sites.update` all throw `/Forbidden/i` (server
enforced), and clicking a genuinely protected structural container in the
editor still produces the client-safe locked explanation.

### Note on the G2 / a11y target
`section.hero` is **annotated** `home.hero.backgroundImage` (i.e. editable), so
it cannot serve as the protected target. G2 and the a11y test use the
`ul.card-list` structural **container** (children editable; the wrapper itself
is not an editable element) — clicking its own padding is refused with the
notice.

### E1-induced stale assertion (distinct root cause)
`owner-acceptance` A7 /services asserted `+ Add image` was **disabled** on
`/services`. E1 widened `service-list` to allow `image`/`link`/`pdf`, so the
chip is now **enabled**; the FAQ chip stays **disabled** (service-list is not a
`faq-list` zone). This assertion was **latent** — the test previously failed
earlier at `switchToPage`, so it never reached the chip checks. Corrected to the
approved E1 behavior (not a weakening).

---

## 4. Verification results

| Suite / gate | Result |
|--------------|--------|
| **Full live-ux (Playwright)** | **42 / 42 green** (41 original + new G2) |
| Convex unit | 1066 pass |
| Dashboard (vitest) | 534 pass |
| Design Lock | 50 / 50 |
| RBAC | pass |
| Tenant isolation | pass |
| Visual Editor | pass |
| discovery / content-map | pass |
| Bridge | pass |
| publishing / history | pass |
| downloads / media / forms / SEO | pass |
| owner-acceptance | pass (incl. A7 /services, /faq, home) |
| responsive-a11y | pass |
| protocol-parity | pass |
| Typecheck (convex + dashboard) | EXIT = 0 |
| Production build (dashboard) | ✓ |

---

## 5. Flags (explicit, per the REDO directive)

1. **E4 was already base-implemented.** The base annotator already stamped
   section `.body` 1:1 and `.footer.text`. E4 therefore reduced to an audit +
   comment honesty fix + a locking test — no new binding logic was invented.
2. **E7 editor video = YouTube + Vimeo only.** Mission text mentions
   Wistia/HTML5; the editor intentionally supports YouTube + Vimeo (discovery
   remains wide). Documented in `docs/PHASE1_E7_VIDEO_SCOPE_FLAG.md`.
3. **E2 nav-chrome behavior change + live-ux spec updates.** The E2 chrome-guard
   is mission-mandated and kept; the 7 stale specs were updated to the new
   contract (E10b), plus one latent E1-induced assertion in A7 /services.
4. **No implementation details were invented** where the surviving mission doc
   + detailed summary did not support them.

---

## 6. Merge status

**DO NOT MERGE.** The branch is safely pushed (`remote == local == 6b8ea7f`) and
a **DRAFT** PR (#63) is open against `main`. This report and the branch are
**STOPPED for PM review** before any merge.
