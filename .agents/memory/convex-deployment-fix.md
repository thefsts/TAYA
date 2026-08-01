---
name: Convex deployment fix
description: Documents the resolved CONVEX_DEPLOY_KEY / VITE_CONVEX_URL mismatch and the test-mode provisioning pattern.
---

# Convex Deployment Fix

**Why:** CONVEX_DEPLOY_KEY targeted `uncommon-cobra-336` but VITE_CONVEX_URL pointed at `clean-marlin-94` — two different backends. Now resolved.

**Resolution:**
- `uncommon-cobra-336.convex.cloud` is the production backend (matches CONVEX_DEPLOY_KEY).
- `CLERK_JWT_ISSUER_DOMAIN=clerk.fstsclientsystem.com` and `CONVEX_DEPLOYMENT_ENVIRONMENT=production` are set there.
- `VITE_CONVEX_URL` secret updated to `https://uncommon-cobra-336.convex.cloud`.
- `convex.json` `prodUrl` updated to `uncommon-cobra-336`.
- `scripts/deploy-convex.sh` now passes `check-prod-env.sh` and deploys to correct backend.

**How to apply:** Any future Convex deploy via `bash scripts/deploy-convex.sh` targets `uncommon-cobra-336`. If you see "Not authorized" errors against a Convex URL, check that the deploy key and VITE_CONVEX_URL point at the same deployment.

# Test-Mode Provisioning Pattern

`convex/provision.ts` contains `upsertTestAgency`, `upsertTestSite`, `upsertTestUser`, and `verifyProvisioning` — all gated by `requireTestEnvironment()`.

**To use (one-time provisioning without a Clerk JWT):**
1. Temporarily: `npx convex env remove CONVEX_DEPLOYMENT_ENVIRONMENT --prod` + `npx convex env set CONVEX_TEST_MODE true --prod`
2. Deploy directly: `CONVEX_DEPLOY_KEY=... npx convex deploy --yes --typecheck disable`
3. Call the provision mutations via HTTP (no auth needed in test mode)
4. Restore: `npx convex env remove CONVEX_TEST_MODE --prod` + `npx convex env set CONVEX_DEPLOYMENT_ENVIRONMENT production --prod`

**Why:** Clerk FAPI at `clerk.fstsclientsystem.com` has no DNS CNAME set up, so no browser-based Clerk session is obtainable from the Replit environment. Test-mode mutations are the only available path for automation-driven provisioning.
