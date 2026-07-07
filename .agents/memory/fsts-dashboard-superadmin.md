---
name: FSTS dashboard superadmin bootstrap
description: Convex deploy, Clerk JWT setup, and auth guard details for the FSTS Client Dashboard
---

The FSTS dashboard grants `isSuperAdmin` only to the very first Clerk user ever provisioned in the Convex `users` table (`isFirstUser` check in `convex/lib/getCurrentUser.ts`). Every subsequent user is a regular user and gets redirected from `/app/admin/*` to `/app`.

**Why:** simple bootstrap pattern — no invite/promote-admin flow exists yet.

## Convex deploy command
```
bash scripts/deploy-convex.sh
```
`CONVEX_DEPLOY_KEY` is stored as a Replit secret — no manual key entry needed. `CONVEX_TMPDIR` is pinned to `/home/runner/workspace/.convex-tmp` inside the script to avoid cross-filesystem `mkdtemp` failures (do not use `/tmp`).

**Why:** `/tmp` is on a different filesystem from the workspace on Replit, causing `mkdtemp` to fail.

## Clerk JWT issuer domain (for first Convex deploy)
Decode from `VITE_CLERK_PUBLISHABLE_KEY` in bash:
```python
python3 -c "import base64,os; pk=os.environ['VITE_CLERK_PUBLISHABLE_KEY']; b64=pk.split('_',2)[2]; b64+='='*(4-len(b64)%4); print(base64.b64decode(b64).decode().strip('\$'))"
# → e.g. musical-shiner-39.clerk.accounts.dev
```
Set in Convex before first deploy: `npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<decoded>"`

## Admin guard — null-safety fix applied
Both `AdminUsers.tsx` and `AdminSites.tsx` now use:
```tsx
if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;
```
**Why:** The old `if (me && !me.isSuperAdmin)` let `null` (unprovisioned/unauthenticated user) fall through to the full admin page. Correct pattern redirects both null and non-superadmin.

## Name resolution — use || not ??
`convex/lib/getCurrentUser.ts` `provisionUser` uses `||` for the name chain (fixed):
```ts
const name = identity.name || [identity.givenName, identity.familyName].filter(Boolean).join(" ") || identity.email || identity.subject;
```
**Why:** `??` only bypasses null/undefined. Clerk can emit empty string for `identity.name`; `||` falls through empty strings to givenName+familyName or email.

## E2E testing note
When testing admin-gated pages with `runTest`/Clerk auth, a freshly created test user will NOT have superadmin access (DB already has users from prior sessions). Verify admin flows by checking the role badge in the header ("SUPER_ADMIN" vs "USER") before asserting admin page access.
