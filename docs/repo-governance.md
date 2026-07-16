# Repository Governance

> **Authoritative reference.** These rules apply to all contributors and all automated agents working in this codebase. When in doubt, consult this document before committing or opening a PR.

---

## 1. Two-Repository Rule

Full Stack Tech Solutions maintains two separate codebases that must **never** be mixed.

| What | Repository |
|------|-----------|
| **FSTS-WOS™ Dashboard** — client dashboard platform (site settings, pages, forms, SEO, analytics, the Operon Connector™, and all modules defined in `docs/product-boundaries.md §1`) | `thefsts/FSTS-client-Dashboard-for-sites-` |
| **Corsair Tactical Solutions website** — public marketing site, course pages, multilingual content, training photos | `thefsts/Corsair-Tactical-Solutions` |

### What belongs here (Dashboard repo)

- Convex functions, schema, and backend logic for the FSTS-WOS™ platform
- React dashboard UI (`artifacts/fsts-dashboard/`)
- Shared libraries (`lib/`) used by the dashboard
- Scripts and CI tooling for the dashboard platform
- Documentation about the dashboard product (this file, `docs/product-boundaries.md`, etc.)

### What does NOT belong here

- Corsair website Next.js pages, components, or routes
- Course translation JSON files for the Corsair site
- Corsair-specific public image assets (training photos, course banners, etc.)
- Any feature that acts on customers or leads in Operon CRM™ (see `docs/product-boundaries.md §2`)

If you are doing Corsair website work, switch to the `thefsts/Corsair-Tactical-Solutions` repository.

---

## 2. Commit Identity

Every commit to this repository must be authored as:

```
Name:  Thefsts
Email: amorebey@gmail.com
```

This is enforced automatically in `scripts/post-merge.sh` via `git config user.name` / `git config user.email` on every merge. Do not override these values when committing manually.

---

## 3. Automated Boundary Enforcement

`scripts/check-boundary.sh` runs two classes of checks on every CI push:

1. **CRM term scan** — scans source files for Operon CRM™ feature terms that must not appear in FSTS-WOS™ code (see `docs/product-boundaries.md §2.1`).
2. **Repository separation check** — errors if any Corsair website artifacts are staged for commit into this repo (Next.js page trees outside `fsts-dashboard`, Corsair i18n JSON files, Corsair public image assets).

The check is registered as a named validation step (`boundary-check`) and runs automatically. A failing boundary check must be resolved before the commit is accepted.

To run the check manually:

```bash
bash scripts/check-boundary.sh
```

---

## 4. How to Handle Misplaced Work

If you discover Corsair website tasks queued in this project's task board, or Corsair files staged for commit here:

1. Cancel or remove the misplaced tasks with a note: *"Corsair website work — move to Corsair workspace."*
2. Move any staged files back to an unstaged state and re-apply the work in the `thefsts/Corsair-Tactical-Solutions` workspace.
3. Run `bash scripts/check-boundary.sh` to confirm the boundary is clean before committing.

---

## 5. Related Documents

- `docs/product-boundaries.md` — full product boundary specification (FSTS-WOS™ vs. Operon CRM™ vs. Operon Connector™)
- `scripts/check-boundary.sh` — boundary enforcement script
- `scripts/post-merge.sh` — post-merge hook (git identity + GitHub mirror sync)
