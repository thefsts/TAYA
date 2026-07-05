---
name: FSTS dashboard superadmin bootstrap
description: How isSuperAdmin is assigned in the FSTS Client Dashboard, relevant when e2e-testing any /app/admin/* route.
---

The FSTS dashboard (`artifacts/api-server/src/middlewares/auth.ts`) grants `isSuperAdmin` only to the very first Clerk user ever created in the DB (`isFirstUser` check). Every subsequently signed-up test/demo user is a regular (non-admin) user and gets redirected away from `/app/admin/*` routes to the plain `/app` "Your Sites" view.

**Why:** simple single-tenant bootstrap pattern — there's no invite/promote-admin flow yet.

**How to apply:** when e2e-testing admin-only pages (site management, user management) with `runTest`/Clerk auth, a freshly created test user will NOT have access — the test will look like a routing bug but isn't. Prefer verifying admin-gated flows via direct DB checks (`psql "$DATABASE_URL"`) or an unauthenticated `screenshot` call (which skips the client-side `me.isSuperAdmin` gate entirely since `me` is undefined) rather than assuming a new signup can act as admin.
