---
name: Convex deployment alignment
description: VITE_CONVEX_URL env var vs CONVEX_DEPLOY_KEY deployment mismatch — how it was found and fixed.
---

## The Situation

Two separate Convex deployments exist for this project:

| Variable | Deployment | Purpose |
|---|---|---|
| `CONVEX_DEPLOY_KEY` (secret) | `uncommon-cobra-336.convex.cloud` | Production — all functions deployed here via `npx convex deploy` |
| `VITE_CONVEX_URL` (env var, shared) | was `clean-marlin-94.convex.cloud` → **fixed to `uncommon-cobra-336.convex.cloud`** | URL the Vite dev server and browser client uses |

**Why:** `clean-marlin-94` was an old dev deployment URL left in the `VITE_CONVEX_URL` shared env var. The secret `VITE_CONVEX_URL` also exists but the env var takes precedence over it in the Vite runtime. When new Convex functions are deployed via `npx convex deploy` (which targets `uncommon-cobra-336`), they weren't visible to the browser because the browser was connecting to `clean-marlin-94`.

## The Fix

Updated `VITE_CONVEX_URL` shared env var from `https://clean-marlin-94.convex.cloud` to `https://uncommon-cobra-336.convex.cloud` using `setEnvVars`. Restarted the dev workflow. Browser now connects to the same deployment as the CLI.

## Verified Alignment

- `npx convex deploy` → `uncommon-cobra-336.convex.cloud` ✓
- `VITE_CONVEX_URL` env var → `https://uncommon-cobra-336.convex.cloud` ✓
- Browser successfully calls `onboarding:getSession` and `onboarding:createSession` ✓

## Rule

**Any time a new Convex module is added and deployed**, verify the browser is connecting to the same deployment as `CONVEX_DEPLOY_KEY` targets. Run `npx convex run <newModule>:<fn>` from CLI — if it returns a valid response (even empty/null), the function IS deployed. If the browser still fails, check `VITE_CONVEX_URL` env var alignment.

## Warning

The `VITE_CONVEX_URL` secret ALSO exists. The shared env var currently takes precedence. If the secret is ever given higher priority or the env var is deleted, the secret value (unknown, possibly old) would be used. Consider updating the secret to also match `uncommon-cobra-336.convex.cloud` for consistency.
