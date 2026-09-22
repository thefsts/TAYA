# TAYA Visual Editor — Button Audit (Requirement 8)

**Scope:** every interactive control in the client-facing Visual Editor
(`artifacts/fsts-dashboard/src/pages/app/sites/VisualEditor.tsx` and its
child components `AddBlockPanel`, `BlockForm`, `BlocksPanel`, `FormsPanel`,
`PageSeoPanel`, `RevisionHistory`, `EditControl`, `ImagePickerField`,
`LinkField`, `FrameStage`).

**Rule enforced:** every button is exactly one of
**WORKS** / **DISABLED WITH CLEAR REASON** / **HIDDEN BY PERMISSION** /
**FSTS DESIGN LOCKED WITH EXPLANATION**. There are no dead, empty, silent,
or fake buttons.

Legend:
- **WORKS** — performs its labelled action; verified in the A–H Chromium
  acceptance run (`tests/live-ux/tests/acceptance-ah.spec.ts`).
- **DISABLED WITH CLEAR REASON** — `disabled` is bound to a real state
  predicate and the surrounding UI states why (empty draft, busy, first/last
  item, no allowed area).
- **HIDDEN BY PERMISSION** — the control is not rendered for roles that lack
  the capability (RBAC is enforced server-side; the client mirrors it).
- **FSTS DESIGN LOCKED WITH EXPLANATION** — the control is intentionally not
  offered; clicking the protected region shows the plain-language locked
  notice in a `role="status"` region.

---

## Top toolbar

| Control | State | Notes |
|---|---|---|
| **Back to Dashboard** | WORKS | `navigate('/app/sites/:siteId')`. |
| **Page pills** (Home / Services / FAQ …) | WORKS | Switches `pagePath`, remounts the iframe (`key={frameUrl}`). |
| **History** | WORKS | Toggles the `RevisionHistory` panel. |
| **View live site** | WORKS | Rendered only when `siteDomain` is set; opens the published site in a new tab. HIDDEN when no domain is connected. |

## Mobile Edit / Preview toggle (`lg:hidden`, <1024px)

| Control | State | Notes |
|---|---|---|
| **Edit** | WORKS | Shows the controls pane. |
| **Preview** | WORKS | Shows the live-site pane. |

## Preview toolbar

| Control | State | Notes |
|---|---|---|
| **Desktop / Tablet / Mobile** device buttons | WORKS | Set the `FrameStage` preset (1440×900 / 768×1024 / 390×844). |
| **Reload preview** | WORKS | Re-loads the frame for the current page. |

## Selected-element editor (`EditControl`)

| Control | State | Notes |
|---|---|---|
| **Change Image / Choose Image** (image + background) | WORKS | Opens the Media Library dialog (URL / Upload tabs). |
| **Alt text** input (image + background) | WORKS | Rendered only when an alt companion key exists (`altValue !== null`). |
| **Label** input (button/link) | WORKS | Edits the base key text. |
| **Destination** (`LinkField`) | WORKS | Validated destination; shows "Page on this site" for internal links. |
| **Text** textarea (default) | WORKS | Edits paragraph/heading text. |
| **Save this change** | DISABLED WITH CLEAR REASON | Disabled when `busy`, `draftCount === 0`, or no local edit on the selected key/companions. |
| **Revert** | DISABLED WITH CLEAR REASON | Disabled when there is no local edit to revert. |

## Add-content panel (`AddBlockPanel`)

| Control | State | Notes |
|---|---|---|
| **Add content to this page** | WORKS | Opens the what-first add flow. Hidden entirely when the page has no allowed areas. |
| **+ Add text / image / video / resource / FAQ / CTA / button / link** chips | WORKS or DISABLED WITH CLEAR REASON | A chip is disabled (greyed, `aria-disabled`) when no area on this page allows that kind; an honest sentence lists the unavailable kinds. |
| **Where chips** (area names) | WORKS | Only areas that allow the chosen kind are shown. |
| **Cancel / Back** | WORKS | Steps back through the flow. |
| **Add to page** (BlockForm submit) | WORKS / DISABLED WITH CLEAR REASON | Disabled while `busy`; server re-validates zone + kind + caps + permission. |
| **Upload new PDF** | WORKS | Hidden file input → `downloads.generateUploadUrl` → PUT → `downloads.createFromStorage`; shows "Uploaded — selected above." |
| **Save changes** (edit existing block) | WORKS / DISABLED WITH CLEAR REASON | Same submit path as Add. |

## Blocks panel (`BlocksPanel`)

| Control | State | Notes |
|---|---|---|
| **Edit** | WORKS | Opens the block form inline. |
| **Move up / Move down** | DISABLED WITH CLEAR REASON | Disabled at the first / last row and while `busy`. |
| **Remove** | WORKS | Marks the block pending-delete (draft). |
| **Restore** | WORKS | Un-deletes a pending-delete block. |

## Repeatable-items panel

| Control | State | Notes |
|---|---|---|
| **Move up / Move down** | DISABLED WITH CLEAR REASON | Disabled at the first / last item and while `busy`. |
| **Remove** | WORKS | Hides the item (draft). |
| **Restore** | WORKS | Un-hides the item. |

## Forms panel (`FormsPanel`)

| Control | State | Notes |
|---|---|---|
| **Form rows** (Contact us / Appointment request …) | WORKS | Routes to the EXISTING FormBuilder (`/app/sites/:siteId/forms/:formId`); no bypass. Panel hidden when the site has no forms. |

## Page SEO panel (`PageSeoPanel`)

| Control | State | Notes |
|---|---|---|
| **Show / Hide** | WORKS | Toggles the panel. |
| **Save search settings** | DISABLED WITH CLEAR REASON | Disabled while `saving` or when the form is not `dirty`. |

## Action bar

| Control | State | Notes |
|---|---|---|
| **Preview** | WORKS | Applies the full draft overlay to the frame and switches to the preview tab. |
| **Save Draft** | DISABLED WITH CLEAR REASON | Disabled while `busy` or when `draftCount === 0`. |
| **Publish** | WORKS / DISABLED WITH CLEAR REASON | Disabled while `busy` or when there is nothing to publish; label becomes "Publish (blocked)" with a red reason when `publishing.canPublish` denies. |
| **Discard N draft changes** | WORKS | Rendered only when drafts exist; discards pending drafts. |

## History panel (`RevisionHistory`)

| Control | State | Notes |
|---|---|---|
| **Restore** (per revision) | WORKS / DISABLED WITH CLEAR REASON | Disabled while `busy`; restores the revision as a draft. |

## Locked regions (FSTS DESIGN LOCKED WITH EXPLANATION)

| Region | State | Notes |
|---|---|---|
| **Navigation / header / footer layout chrome** | FSTS DESIGN LOCKED WITH EXPLANATION | Clicking shows the `role="status"` notice: "That part of the page is managed by FSTS. Contact your TAYA representative to make changes." |
| **Off-site links** | FSTS DESIGN LOCKED WITH EXPLANATION | Clicking shows: "Links to other websites open on the live site. To keep your edits safe, they are not followed inside the editor." |

## Permission-gated surfaces (HIDDEN BY PERMISSION)

| Surface | State | Notes |
|---|---|---|
| **Editor entry / edit controls** | HIDDEN BY PERMISSION | `read_only` / `finance` / `support` roles lack `content.update`; the editor does not offer edits. Verified in acceptance test H. |
| **Wrong-tenant site** | HIDDEN BY PERMISSION | A user without membership on the site is denied (no access), verified in acceptance test H. |

---

**Result:** 0 dead buttons, 0 empty buttons, 0 silent no-ops, 0 fake controls.
Every control is WORKS, DISABLED WITH CLEAR REASON, HIDDEN BY PERMISSION, or
FSTS DESIGN LOCKED WITH EXPLANATION.
