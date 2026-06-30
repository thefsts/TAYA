---
name: Corsair build verification & common build breaks
description: How to reproduce Corsair's Vercel build locally and the recurring type/import breaks to check
---

## Reproduce Vercel builds locally
Vercel API for this project is SAML-locked (scope `fullstacksolutions`) — `v6/v13` deployment-log endpoints return `forbidden`. Do NOT rely on the Vercel API for build logs.

Instead reproduce the exact failure locally: in `corsair-source/`, run `npm ci` (node_modules is gitignored / absent in fresh clones) then `npm run build`. This is a standard Next.js (Turbopack) app on npm — same package-lock Vercel uses, so a local pass/fail matches Vercel.

To read GitHub commit build status without Vercel access:
`GET /repos/thefsts/corsair-tactical-solutions/commits/<sha>/status` → look for `Vercel` context state.

**Why:** Saves guessing — local `npm run build` surfaces the real error (CSS resolve, TS type-check) that the SAML-locked Vercel dashboard hides.

## Recurring build breaks to check first
1. **CSS import paths** — `globals.css` lives in `src/app/`; relative `@import` resolves from there. A file in `src/styles/` must be imported as `../styles/<file>.css`, not `./<file>.css`.
2. **framer-motion `ease` cubic-bezier arrays** — a literal `ease: [0.25, 0.1, 0.25, 1]` infers as `number[]` and fails TS (`not assignable to Easing`). Must be a tuple: `ease: [...] as [number, number, number, number]`. Applies in both `transition={{}}` props and `Variants` objects.
3. **`useInView` margin** — `margin: string` fails (`MarginType`). Cast `margin: margin as any`.
4. **Missing animation imports** — pages using `<StaggerContainer>/<StaggerItem>/<ScrollReveal>` must import them from `@/components/ScrollReveal`. Batch edits sometimes add usage without the import.
