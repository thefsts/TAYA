---
name: Corsair Vercel root directory
description: The Vercel project for corsairtacticalsolution.com builds from the REPO ROOT, not from corsair-source/
---

## The Rule
All production code changes must go to the repo ROOT files:
- `src/app/globals.css` (not `corsair-source/src/app/globals.css`)
- `src/components/HeroCarousel.tsx` (not `corsair-source/src/...`)
- `src/app/[locale]/page.tsx` (not `corsair-source/src/...`)
- etc.

**Why:** The GitHub repo `thefsts/Corsair-Tactical-Solutions` has rootDirectory=null in Vercel project settings, meaning Vercel builds from the repo root. The root has its own complete Next.js app (src/, next.config.ts, package.json). `corsair-source/` is a separate Next.js app that is NOT deployed — it was the development workspace but changes there never reach production.

**How to apply:**
- When making any CSS, component, or page changes for the Corsair live site, target files under `src/` at the repo root, NOT under `corsair-source/`.
- Push via blob→tree→commit→PATCH (GitHub API) as documented in corsair-push.md.
- After push, Vercel auto-deploys from main; poll dpl status then alias domains using the Vercel token (VERCEL_TOKEN secret, team: team_00AzAewtangFumhXtrI6kseh, project: prj_dUtXgicvwQB5DDhsdMbfs6tLilL2).
- If Vercel is set to rootDirectory=corsair-source by mistake, the build fails with next-intl errors. Revert to null via PATCH /v9/projects/{id}.
