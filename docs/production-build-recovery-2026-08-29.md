# Production Build Recovery — 2026-08-29

This marker records the production recovery verification after Vercel failed on a transient `App` default-export mismatch.

Verified on current `main` before this commit:

- `artifacts/fsts-dashboard/src/main.tsx` imports `App` as the default export.
- `artifacts/fsts-dashboard/src/App.tsx` ends with `export default App;`.
- Node remains pinned to 24.x.
- pnpm remains the required package manager.

Purpose: trigger a clean production build from the corrected `main` revision so the deployed artifact can be verified green before additional feature work proceeds.
